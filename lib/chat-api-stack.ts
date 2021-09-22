import * as path from "path";

require('dotenv').config();

import * as CDK from '@aws-cdk/core';
import * as IAM from '@aws-cdk/aws-iam';
import * as Cognito from '@aws-cdk/aws-cognito';
import * as Lambda from '@aws-cdk/aws-lambda';
import * as RDS from '@aws-cdk/aws-rds';
import * as EC2 from '@aws-cdk/aws-ec2';
import * as ApiGateway from '@aws-cdk/aws-apigateway';
import * as ApiGatewayV2 from '@aws-cdk/aws-apigatewayv2';
import * as ApiGatewayIntegrations from '@aws-cdk/aws-apigatewayv2-integrations';

import { ChatSchema } from './schema';

const DB_NAME = 'ChatDB';
const COGNITO_POOL_ID = process.env.COGNITO_POOL_ID;

export class ChatApiStack extends CDK.Stack {

    private lambdaLayer: Lambda.LayerVersion;
    
    // Lambda functions are stored by name
    private functions: { [key: string]: Lambda.Function } = {};

    /**
     * Adds a Lambda Function to an internal list of functions indexed by name.
     * The function code is assumed to be located in `../src/functions/${name}.js`.
     *  
     * @param name - name of the function
     */
    private addFunction = (
        name: string, cluster: RDS.ServerlessCluster, environment: {[key: string]: string},
        isTestFunction: boolean = false, memorySize: number = 128
    ): void => {
        const fn = new Lambda.Function(this, name, {
            code: Lambda.Code.fromAsset(path.resolve(__dirname, isTestFunction
                ? `src/test_functions/${name}` : `../src/functions/${name}`)),
            runtime: Lambda.Runtime.NODEJS_12_X,
            handler: `${name}.handler`,
            environment: environment,
            memorySize: memorySize
        });
        fn.addLayers(this.lambdaLayer);
        this.functions[name] = fn;
        cluster.grantDataApiAccess(fn);
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

        /**
         * Set up PostgreSQL
         */
        const vpc = new EC2.Vpc(this, 'ChatVPC');

        const dbCluster = new RDS.ServerlessCluster(this, 'ChatCluster', {
            engine: RDS.DatabaseClusterEngine.AURORA_POSTGRESQL,
            parameterGroup: RDS.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql10'),
            vpc,
            scaling: {
                autoPause: CDK.Duration.minutes(5), // default is to pause after 5 minutes of idle time
                minCapacity: RDS.AuroraCapacityUnit.ACU_2, // default is 2 Aurora capacity units (ACUs)
                maxCapacity: RDS.AuroraCapacityUnit.ACU_4, // default is 16 Aurora capacity units (ACUs)
            },
            defaultDatabaseName: DB_NAME
        });
        const dbClusterEnv = {
            "DB_CLUSTER_ARN": dbCluster.clusterArn,
            "DB_SECRET_ARN": dbCluster.secret?.secretArn || '',
            "DB_NAME": DB_NAME
        };

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

        [
            'get_direct_conversation', 'get_user_conversations', 'get_conversation_messages',
            'create_conversation', 'create_direct_message', 'set_message_is_read',
            'on_create_direct_message', 'connect', 'close_connection',
            'send_message'
        ].forEach(
            (fn) => { this.addFunction(fn, dbCluster, dbClusterEnv) }
        );

        [
            'add_users', 'add_friendship'
        ].forEach(
            (fn) => { this.addFunction(fn, dbCluster, dbClusterEnv, true) }
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
        const chatRestResource = restApi.root.addResource('chat');


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

        [ 'send_message' ].forEach(fn => {
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
