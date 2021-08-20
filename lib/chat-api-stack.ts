import * as path from "path";

import * as CDK from '@aws-cdk/core';
import * as DDB from '@aws-cdk/aws-dynamodb';
import * as IAM from '@aws-cdk/aws-iam';
import * as AppSync from '@aws-cdk/aws-appsync';
import * as Cognito from '@aws-cdk/aws-cognito';
import * as Lambda from '@aws-cdk/aws-lambda';

import { ChatSchema } from './schema';
import {
    createDirectMessageRequestStr, createUserConversationRequestStr,
    conversationUserConversationRequestStr, allDirectMessagesConnectionRequestStr,
    allDirectMessagesConnectionResponseStr, allDirectMessagesRequestStr,
    allDirectMessagesFromRequestStr, directMessageConversationRequestStr
} from './map-template-str';

// Interface used as parameter to create resolvers for API
interface ResolverOptions {
    source: string | AppSync.BaseDataSource,
    requestMappingTemplate?: AppSync.MappingTemplate,
    responseMappingTemplate?: AppSync.MappingTemplate
};

export class ChatApiStack extends CDK.Stack {

    readonly api: AppSync.GraphqlApi;

    // Lambda functions are stored by name
    private functions: { [key: string]: Lambda.Function } = {};

    /**
     * Adds a Lambda Function to an internal list of functions indexed by name.
     * The function code is assumed to be located in `../src/functions/${name}.js`.
     *  
     * @param name - name of the function
     */
     private addFunction = (name: string): void => {
        const fn = new Lambda.Function(this, name, {
            code: Lambda.Code.fromAsset(path.resolve(__dirname, `../src/functions/${name}`)),
            runtime: Lambda.Runtime.NODEJS_12_X,
            handler: `${name}.handler`
        });
        this.functions[name] = fn;
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

        const conversationTable = new DDB.Table(this, 'ConversationTable', {
            billingMode: DDB.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: "id",
                type: DDB.AttributeType.STRING
            }
        });

        const directMessageTable = new DDB.Table(this, 'DirectMessageTable', {
            billingMode: DDB.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: "conversationId",
                type: DDB.AttributeType.STRING
            },
            sortKey: {
                name: "createdAt",
                type: DDB.AttributeType.STRING
            }
        });

        const userConversationTable = new DDB.Table(this, 'UserConversationTable', {
            billingMode: DDB.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: "userId",
                type: DDB.AttributeType.STRING
            },
            sortKey: {
                name: "conversationId",
                type: DDB.AttributeType.STRING
            }
        });
        userConversationTable.addGlobalSecondaryIndex({
            indexName: "conversationId-index",
            partitionKey: {
                name: "conversationId",
                type: DDB.AttributeType.STRING
            }
        });

        const directMessageConversationTable = new DDB.Table(this, 'DirectMessageConversationTable', {
            billingMode: DDB.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: "userPairId",
                type: DDB.AttributeType.STRING
            },
            sortKey: {
                name: "conversationId",
                type: DDB.AttributeType.STRING
            }
        });

        /**
         * Create Lambda functions
         */
        ['create_conversation'].forEach(
            (fn) => { this.addFunction(fn) }
        );

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
         * Add IAM role/policy
         */
        const apiDynamoDBRole = new IAM.Role(this, 'FullDynamoDBRole', {
            assumedBy: new IAM.CompositePrincipal(
                new IAM.ServicePrincipal('appsync.amazonaws.com'),
                new IAM.ServicePrincipal('lambda.amazonaws.com')
            )
        });
        apiDynamoDBRole.addToPolicy(new IAM.PolicyStatement({
            effect: IAM.Effect.ALLOW,
            resources: [
                conversationTable.tableArn,
                directMessageTable.tableArn,
                userConversationTable.tableArn,
                `${userConversationTable.tableArn}/index/conversationId-index`,
                directMessageConversationTable.tableArn
            ],
            actions: ["dynamodb:*"]
        }));

        /**
         * Add resolvers
         */
        const conversationDS = this.api.addDynamoDbDataSource("conversationDS", conversationTable);
        const directMessageDS = this.api.addDynamoDbDataSource("messageDS", directMessageTable);
        const userConversationDS = this.api.addDynamoDbDataSource("userConversationDS", userConversationTable);
        const directMessageConversationDS = this.api.addDynamoDbDataSource("userPairConversationDS", directMessageConversationTable);

        // conversationDS.createResolver({
        //     typeName: "Mutation",
        //     fieldName: "createConversation",
        //     requestMappingTemplate: AppSync.MappingTemplate.fromString(createConversationRequestStr),
        //     responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultItem()
        // });

        directMessageDS.createResolver({
            typeName: "Mutation",
            fieldName: "createDirectMessage",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(createDirectMessageRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultItem()
        });

        userConversationDS.createResolver({
            typeName: "Mutation",
            fieldName: "createUserConversation",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(createUserConversationRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultItem()
        });

        conversationDS.createResolver({
            typeName: "UserConversation",
            fieldName: "conversation",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(conversationUserConversationRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultItem()
        });

        directMessageDS.createResolver({
            typeName: "Query",
            fieldName: "allDirectMessagesConnection",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(allDirectMessagesConnectionRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.fromString(allDirectMessagesConnectionResponseStr)
        });

        directMessageDS.createResolver({
            typeName: "Query",
            fieldName: "allDirectMessages",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(allDirectMessagesRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultList()
        });

        directMessageDS.createResolver({
            typeName: "Query",
            fieldName: "allDirectMessagesFrom",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(allDirectMessagesFromRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultList()
        });

        directMessageConversationDS.createResolver({
            typeName: "Query",
            fieldName: "directMessageConversation",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(directMessageConversationRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultItem()
        });

        // Add Lambda resolver
        this.createLambdaResolver("Mutation", "createConversation", { source: "create_conversation" })

        new CDK.CfnOutput(this, "chat-api", {
            value: this.api.graphqlUrl,
            description: "Chat api endpoint",
            exportName: "chatApiEndpoint"
        });

        // new CDK.CfnOutput(this, "region", {
        //     value: process.env.CDK_DEFAULT_REGION || '',
        //     description: "Chat api region",
        //     exportName: "region"
        // });
    }
}
