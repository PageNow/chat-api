import * as path from "path";

require('dotenv').config();

import * as CDK from '@aws-cdk/core';
import * as IAM from '@aws-cdk/aws-iam';
import * as ElasticCache from '@aws-cdk/aws-elasticache';
import * as Cognito from '@aws-cdk/aws-cognito';
import * as Lambda from '@aws-cdk/aws-lambda';
import * as RDS from '@aws-cdk/aws-rds';
import * as EC2 from '@aws-cdk/aws-ec2';
import * as ApiGateway from '@aws-cdk/aws-apigateway';
import * as ApiGatewayV2 from '@aws-cdk/aws-apigatewayv2';
import * as ApiGatewayIntegrations from '@aws-cdk/aws-apigatewayv2-integrations';

const DB_NAME = 'ChatDB';
const COGNITO_POOL_ID = process.env.COGNITO_POOL_ID;

export class ChatApiStack extends CDK.Stack {

    private vpc: EC2.Vpc;
    private privateSubnet1: EC2.Subnet;
    private privateSubnet2: EC2.Subnet;
    private lambdaSG: EC2.SecurityGroup;
    private lambdaLayer: Lambda.LayerVersion;
    private redisEndpointAddress: string;
    private redisEndpointPort: string;
    private redisPort: number = 6379;
    private dbCluster: RDS.ServerlessCluster;
    private rdsProxy: RDS.DatabaseProxy;
    
    // Lambda functions are stored by name
    private functions: { [key: string]: Lambda.Function } = {};

    /**
     * Adds a Lambda Function to an internal list of functions indexed by name.
     * The function code is assumed to be located in `../src/functions/${name}.js`.
     *  
     * @param name - name of the function
     */
    private addFunction = (
        name: string, isTestFunction: boolean = false, useRedis: boolean = false,
        useUserDb: boolean = false, memorySize: number = 128
    ): void => {
        const fn = new Lambda.Function(this, name, {
            vpc: this.vpc,
            vpcSubnets: { subnets: [ this.privateSubnet1, this.privateSubnet2 ] },
            securityGroups: [ this.lambdaSG ],
            code: Lambda.Code.fromAsset(path.resolve(__dirname, isTestFunction
                ? `../src/test_functions/${name}` : `../src/functions/${name}`)),
            runtime: Lambda.Runtime.NODEJS_12_X,
            handler: `${name}.handler`,
            memorySize: memorySize
        });
        fn.addLayers(this.lambdaLayer);
        if (useRedis) {
            fn.addEnvironment("REDIS_HOST", this.redisEndpointAddress);
            fn.addEnvironment("REDIS_PORT", this.redisEndpointPort);
        }
        if (useUserDb) {
            fn.addEnvironment("DB_USER", process.env.RDS_USERNAME!);
            fn.addEnvironment("DB_HOST", process.env.RDS_PROXY_HOST!);
            fn.addEnvironment("DB_DATABASE", process.env.RDS_DB_NAME!);
            fn.addEnvironment("DB_PASSWORD", process.env.RDS_PASSWORD!);
            fn.addEnvironment("DB_PORT", process.env.RDS_PORT!);
            this.rdsProxy.grantConnect(fn, process.env.RDS_USERNAME);
        }
        fn.addEnvironment("DB_CLUSTER_ARN", this.dbCluster.clusterArn);
        fn.addEnvironment("DB_SECRET_ARN", this.dbCluster.secret?.secretArn || '');
        fn.addEnvironment("DB_NAME", DB_NAME);

        this.functions[name] = fn;
        this.dbCluster.grantDataApiAccess(fn);
    };

    /**
     * Retrieves the Lambda function by its name
     * 
     * @param name - name of the Lambda function
     */
    private getFn(name: string): Lambda.Function {
        return this.functions[name];
    };

    constructor(scope: CDK.Construct, id: string, props?: CDK.StackProps) {
        super(scope, id, props);

        this.vpc = EC2.Vpc.fromLookup(this, 'PagenowVPC', {
            isDefault: false,
            vpcId: process.env.VPC_ID
        }) as EC2.Vpc;
    
        const vpc = new EC2.Vpc(this, 'ChatVPC');

        this.privateSubnet1 = EC2.Subnet.fromSubnetAttributes(this, 'privateSubnet1', {
            subnetId: process.env.PRIVATE_SUBNET1_ID!,
            routeTableId: process.env.PRIVATE_ROUTE_TABLE_ID!,
            availabilityZone: process.env.SUBNET1_AZ!
        }) as EC2.Subnet;
        this.privateSubnet2 = EC2.Subnet.fromSubnetAttributes(this, 'privateSubnet2', {
            subnetId: process.env.PRIVATE_SUBNET2_ID!,
            routeTableId: process.env.PRIVATE_ROUTE_TABLE_ID!,
            availabilityZone: process.env.SUBNET2_AZ!
        }) as EC2.Subnet;

        if (process.env.LAMBDA_SG_ID === 'none') {
            this.lambdaSG = new EC2.SecurityGroup(this, "lambdaSg", {
                vpc: this.vpc,
                description: "Security group for Lambda functions"
            });
        } else {
            this.lambdaSG = EC2.SecurityGroup.fromLookup(
                this, "lambdaSG", process.env.LAMBDA_SG_ID!) as EC2.SecurityGroup;
        }

        // Create Redis cluster if it does not already exist
        if (process.env.REDIS_SG_ID !== 'none' && process.env.REDIS_ENDPOINT_ADDRESS !== 'none' && process.env.REDIS_ENDPOINT_PORT !== 'none') {
            this.redisEndpointAddress = process.env.REDIS_ENDPOINT_ADDRESS!;
            this.redisEndpointPort = process.env.REDIS_ENDPOINT_PORT!;
        } else {
            const redisSubnet1 = new EC2.Subnet(this, 'redisSubnet1', {
                availabilityZone: 'us-west-2a',
                cidrBlock: '10.0.5.0/24',
                vpcId: process.env.VPC_ID!,
                mapPublicIpOnLaunch: false
            });
            const redisSubnet2 = new EC2.Subnet(this, 'redisSubnet2', {
                availabilityZone: 'us-west-2b',
                cidrBlock: '10.0.6.0/24',
                vpcId: process.env.VPC_ID!,
                mapPublicIpOnLaunch: false
            });
            const redisSG = new EC2.SecurityGroup(this, "redisSg", {
                vpc: this.vpc,
                description: "Security group for Redis Cluster"
            });
            redisSG.addIngressRule(
                this.lambdaSG,
                EC2.Port.tcp(this.redisPort)
            );

            const redisSubnets = new ElasticCache.CfnSubnetGroup(this, "RedisSubnets", {
                cacheSubnetGroupName: "RedisSubnets",
                description: "Subnet Group for Redis Cluster",
                subnetIds: [ redisSubnet1.subnetId, redisSubnet2.subnetId ]
            });

            const redisCluster = new ElasticCache.CfnReplicationGroup(this, "PagenowCluster", {
                replicationGroupDescription: "PagenowReplicationGroup",
                cacheNodeType: "cache.t3.small",
                engine: "redis",
                numCacheClusters: 2,
                automaticFailoverEnabled: true,
                multiAzEnabled: true,
                cacheSubnetGroupName: redisSubnets.ref,
                securityGroupIds: [ redisSG.securityGroupId ],
                port: this.redisPort
            });

            this.redisEndpointAddress = redisCluster.attrPrimaryEndPointAddress;
            this.redisEndpointPort = redisCluster.attrPrimaryEndPointPort;
        }

        /**
         * Lookup and retrieve RDS proxy
         */
        const rdsProxySG = EC2.SecurityGroup.fromLookup(this, "rdsProxySG", process.env.RDS_PROXY_SG_ID!);
        rdsProxySG.addIngressRule(
            this.lambdaSG,
            EC2.Port.tcp(parseInt(process.env.RDS_PORT!, 10))
        );
        this.rdsProxy = RDS.DatabaseProxy.fromDatabaseProxyAttributes(this, "RDSProxy", {
            dbProxyArn: process.env.RDS_PROXY_ARN!,
            dbProxyName: process.env.RDS_PROXY_NAME!,
            endpoint: process.env.RDS_PROXY_HOST!,
            securityGroups: [rdsProxySG]
        }) as RDS.DatabaseProxy;

        /**
         * Set up PostgreSQL
         */
        this.dbCluster = new RDS.ServerlessCluster(this, 'ChatCluster', {
            engine: RDS.DatabaseClusterEngine.AURORA_POSTGRESQL,
            parameterGroup: RDS.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql10'),
            vpc: this.vpc,
            scaling: {
                autoPause: CDK.Duration.minutes(5), // default is to pause after 5 minutes of idle time
                minCapacity: RDS.AuroraCapacityUnit.ACU_2, // default is 2 Aurora capacity units (ACUs)
                maxCapacity: RDS.AuroraCapacityUnit.ACU_4, // default is 16 Aurora capacity units (ACUs)
            },
            defaultDatabaseName: DB_NAME
        });

        /**
         * Retrieve existing user pool
         */
        const userPool = Cognito.UserPool.fromUserPoolId(this, 'pagenow-userpool', COGNITO_POOL_ID!);

        /**
         * Create Lambda functions
         */
        this.lambdaLayer = new Lambda.LayerVersion(this, "lambdaModule", {
            code: Lambda.Code.fromAsset(path.join(__dirname, '../src/layer')),
            compatibleRuntimes: [Lambda.Runtime.NODEJS_12_X],
            layerVersionName: "chatLayer"
        });

        // not test function, use redis, not use user db
        [
            'connect', 'close_connection', 'send_message',
            'read_messages'
        ].forEach(
            (fn) => { this.addFunction(fn, false, true) }
        );

        // not test function, not use redis, not use user db
        [
            'get_user_conversations', 'get_conversation_messages', 'get_conversation_participants',
            'get_user_direct_conversation', 'create_conversation', 'get_conversation'
        ].forEach(
            (fn) => { this.addFunction(fn) }
        );

        // test function, not use redis, use user db
        [
            'add_users', 'add_friendship', 'add_conversations', 'add_messages',
            'test_create_conversation'
        ].forEach(
            (fn) => { this.addFunction(fn, true, false, true) }
        );

        // test function, use redis, use user db
        [
            'test_send_message'
        ].forEach(
            (fn) => { this.addFunction(fn, true, true, true) }
        );

        /**
         * API Gateway for chat REST endpoint
         */
        const restApi = new ApiGateway.RestApi(this, 'ChatRestApi', {
            deploy: true,
            deployOptions: {
                stageName: process.env.REST_API_DEPLOY_STAGE
            },
            defaultCorsPreflightOptions: {
                allowHeaders: [
                  'Content-Type',
                  'X-Amz-Date',
                  'Authorization',
                  'X-Api-Key',
                ],
                allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                allowCredentials: true,
                allowOrigins: ['http://localhost:4200'],
            },
        });

        /**
         * REST Api Endpoint Definitions
         */

        // create conversation - path: /conversation
        const conversationResource = restApi.root.addResource('conversation');
        conversationResource.addMethod(
            'POST',
            new ApiGateway.LambdaIntegration(this.getFn('create_conversation'), { proxy: true })
        );
        // get direct (one-to-one) conversation - path: /conversation/direct/{userId}
        const directConversationResource = conversationResource.addResource('direct');
        const directConversationUserResource = directConversationResource.addResource('{userId}');
        directConversationUserResource.addMethod(
            'GET',
            new ApiGateway.LambdaIntegration(this.getFn('get_user_direct_conversation'), { proxy: true })
        );

        // get all conversations of the request user - path: /conversations
        const conversationsResource = restApi.root.addResource('conversations');
        conversationsResource.addMethod(
            'GET',
            new ApiGateway.LambdaIntegration(this.getFn('get_user_conversations'), { proxy: true })
        );
        // get conversation of the given conversationId - path: /conversations/{conversationId}
        const conversationsIdResource = conversationsResource.addResource('{conversationId}');
        conversationsIdResource.addMethod(
            'GET',
            new ApiGateway.LambdaIntegration(this.getFn('get_conversation'), { proxy: true })
        );
        // get conversation messages of conversationId - path: /conversations/{conversationId}/messages
        const conversationMessagesResource = conversationsIdResource.addResource('messages');
        conversationMessagesResource.addMethod(
            'GET',
            new ApiGateway.LambdaIntegration(this.getFn('get_conversation_messages'), { proxy: true })
        );
        // get conversation participants of conversationId - path: /conversations/{conversationId}/participants
        const conversationParticipantsResource = conversationsIdResource.addResource('participants');
        conversationParticipantsResource.addMethod(
            'GET',
            new ApiGateway.LambdaIntegration(this.getFn('get_conversation_participants'), { proxy: true })
        );

        /**
         * API Gateway for real-time chat websocket
         */
        const webSocketApi = new ApiGatewayV2.WebSocketApi(this, 'ChatWebsocketApi', {
            connectRouteOptions: {
                integration: new ApiGatewayIntegrations.LambdaWebSocketIntegration({
                    handler: this.getFn('connect')
                })
            },
            disconnectRouteOptions: {
                integration: new ApiGatewayIntegrations.LambdaWebSocketIntegration({
                    handler: this.getFn('close_connection')
                })
            }
        });
        webSocketApi.addRoute('send-message', {
            integration: new ApiGatewayIntegrations.LambdaWebSocketIntegration({
                handler: this.getFn('send_message')
            })
        });
        webSocketApi.addRoute('read-messages', {
            integration: new ApiGatewayIntegrations.LambdaWebSocketIntegration({
                handler: this.getFn('read_messages')
            })
        });
        const apiStage = new ApiGatewayV2.WebSocketStage(this, 'DevStage', {
            webSocketApi,
            stageName: process.env.WEBSOCKET_API_DEPLOY_STAGE!,
            autoDeploy: true,
        });
        const connectionsArns = this.formatArn({
            service: 'execute-api',
            resourceName: `${apiStage.stageName}/POST/*`,
            resource: webSocketApi.apiId,
        });

        [ 'send_message', 'read_messages', 'test_send_message' ].forEach(fn => {
            this.getFn(fn).addToRolePolicy(
                new IAM.PolicyStatement({
                    actions: ['execute-api:ManageConnections'],
                    resources: [connectionsArns]
                })
            )
        });

        /**
         * CloudFormation stack output
         */
         new CDK.CfnOutput(this, 'websocketApiUrl', {
            value: webSocketApi.apiEndpoint
        });
        new CDK.CfnOutput(this, 'restApiUrl', {
            value: restApi.url
        });
    }
}
