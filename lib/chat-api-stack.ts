import * as path from "path";

import * as CDK from '@aws-cdk/core';
import * as IAM from '@aws-cdk/aws-iam';
import * as AppSync from '@aws-cdk/aws-appsync';
import * as Cognito from '@aws-cdk/aws-cognito';
import * as Lambda from '@aws-cdk/aws-lambda';
import * as RDS from '@aws-cdk/aws-rds';
import * as EC2 from '@aws-cdk/aws-ec2';

import { ChatSchema } from './schema';

const DB_NAME = 'ChatDB';

// Interface used as parameter to create resolvers for API
interface ResolverOptions {
    source: string | AppSync.BaseDataSource,
    requestMappingTemplate?: AppSync.MappingTemplate,
    responseMappingTemplate?: AppSync.MappingTemplate
};

export class ChatApiStack extends CDK.Stack {

    readonly api: AppSync.GraphqlApi;

    private lambdaLayer: Lambda.LayerVersion;
    
    // Lambda functions are stored by name
    private functions: { [key: string]: Lambda.Function } = {};

    /**
     * Adds a Lambda Function to an internal list of functions indexed by name.
     * The function code is assumed to be located in `../src/functions/${name}.js`.
     *  
     * @param name - name of the function
     */
     private addFunction = (name: string, environment: {[key: string]: string}, cluster: RDS.ServerlessCluster): void => {
        const fn = new Lambda.Function(this, name, {
            code: Lambda.Code.fromAsset(path.resolve(__dirname, `../src/functions/${name}`)),
            runtime: Lambda.Runtime.NODEJS_12_X,
            handler: `${name}.handler`,
            environment: environment
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

    /**
     * Creates a resolver.
     * 
     * A resolver attaches a data source to a specific field in the schema.
     * 
     * @param typeName - type (e.g. Query, Mutation)
     * @param fieldName - resolvable fields
     * @param options - ResolverOptions
     */
     private createLambdaResolver = (typeName: string, fieldName: string, options: ResolverOptions)
        :AppSync.BaseDataSource => {
        let source = (typeof(options.source) === 'string') ?
            this.api.addLambdaDataSource(`${options.source}DS`, this.getFn(options.source)) :
            options.source;

        source.createResolver({ typeName, fieldName, ...options });
        return source;
    }

    constructor(scope: CDK.Construct, id: string, props?: CDK.StackProps) {
        super(scope, id, props);

        /**
         * Set up PostgreSQL
         */
        const vpc = new EC2.Vpc(this, 'ChatVPC');
        // const dbCluster = new RDS.DatabaseCluster(this, 'ChatCluster', {
        //     engine: RDS.DatabaseClusterEngine.auroraPostgres({ version: RDS.AuroraPostgresEngineVersion.VER_11_6 }),
        //     parameterGroup: RDS.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql11'),
        //     instanceProps: {
        //         instanceType: EC2.InstanceType.of(EC2.InstanceClass.BURSTABLE3, EC2.InstanceSize.MEDIUM),
        //         vpcSubnets: {
        //           subnetType: EC2.SubnetType.PRIVATE,
        //         },
        //         vpc,
        //     },
        //     defaultDatabaseName: DB_NAME
        // });
        // const dbClusterArn = `arn:aws:rds:${this.region}:${this.account}:cluster:${dbCluster.clusterIdentifier}`;

        // const dbProxy = new RDS.DatabaseProxy(this, 'ChatClusterProxy', {
        //     proxyTarget: RDS.ProxyTarget.fromCluster(dbCluster),
        //     secrets: [dbCluster.secret!],
        //     vpc,
        // });
        // const role = new IAM.Role(this, 'ChatClusterProxyRole', {
        //     assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com')
        // });
        // dbProxy.grantConnect(role, 'admin'); // Grant the role connection access to the DB Proxy for database user 'admin'.
        // const dbClusterArn = `arn:aws:rds:${this.region}:${this.account}:cluster:${dbCluster.clusterIdentifier}`;

        // const dbClusterEnv = {
        //     "DB_CLUSTER_ARN": dbClusterArn,
        //     "DB_SECRET_ARN": dbCluster.secret?.secretArn || '',
        //     "DB_NAME": DB_NAME
        // };

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
        const userPool = Cognito.UserPool.fromUserPoolId(this, 'pagenow-userpool', 'us-east-1_014HGnyeu');

        this.api = new AppSync.GraphqlApi(this, "ChatAPI", {
            name: "ChatAPI",
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: AppSync.AuthorizationType.USER_POOL,
                    userPoolConfig: {
                        userPool: userPool
                    }
                },
                additionalAuthorizationModes: [
                    { authorizationType: AppSync.AuthorizationType.IAM }
                ]
            },
            schema: ChatSchema(),
            logConfig: { fieldLogLevel: AppSync.FieldLogLevel.ALL }
        });

        /**
         * Create Lambda functions
         */
         this.lambdaLayer = new Lambda.LayerVersion(this, "lambdaModule", {
            code: Lambda.Code.fromAsset(path.join(__dirname, '../src/layer')),
            compatibleRuntimes: [Lambda.Runtime.NODEJS_12_X],
            layerVersionName: "chatLayer"
        });
        
        ['create_conversation', 'get_direct_conversation'].forEach(
            (fn) => { this.addFunction(fn, dbClusterEnv, dbCluster) }
        );

        /**
         * Add resolvers
         */
        // Add query resolver
        this.createLambdaResolver("Query", "getDirectConversation", { source: "get_direct_conversation" });

        // Add mutation resolver
        this.createLambdaResolver("Mutation", "createConversation", { source: "create_conversation" });

        // // Add type resolvers
        // conversationDS.createResolver({
        //     typeName: "UserConversation",
        //     fieldName: "conversations",
        //     requestMappingTemplate: AppSync.MappingTemplate.fromString(conversationUserConversationRequestStr),
        //     responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultItem()
        // });

        // // Add query resolvers

        // // Querying from userConversation table
        // userConversationDS.createResolver({
        //     typeName: "Query",
        //     fieldName: "allUserConversations",
        //     requestMappingTemplate: AppSync.MappingTemplate.fromString(allUserConversationsRequestStr),
        //     responseMappingTemplate: AppSync.MappingTemplate.fromString(allUserConversationsResponseStr)
        // });
        

        // directMessageDS.createResolver({
        //     typeName: "Mutation",
        //     fieldName: "createDirectMessage",
        //     requestMappingTemplate: AppSync.MappingTemplate.fromString(createDirectMessageRequestStr),
        //     responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultItem()
        // });

        

        // directMessageDS.createResolver({
        //     typeName: "Query",
        //     fieldName: "allDirectMessagesConnection",
        //     requestMappingTemplate: AppSync.MappingTemplate.fromString(allDirectMessagesConnectionRequestStr),
        //     responseMappingTemplate: AppSync.MappingTemplate.fromString(allDirectMessagesConnectionResponseStr)
        // });

        // directMessageDS.createResolver({
        //     typeName: "Query",
        //     fieldName: "allDirectMessages",
        //     requestMappingTemplate: AppSync.MappingTemplate.fromString(allDirectMessagesRequestStr),
        //     responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultList()
        // });

        // directMessageDS.createResolver({
        //     typeName: "Query",
        //     fieldName: "allDirectMessagesFrom",
        //     requestMappingTemplate: AppSync.MappingTemplate.fromString(allDirectMessagesFromRequestStr),
        //     responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultList()
        // });

        new CDK.CfnOutput(this, "chat-api", {
            value: this.api.graphqlUrl,
            description: "Chat api endpoint",
            exportName: "chatApiEndpoint"
        });
    }
}
