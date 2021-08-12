import * as CDK from '@aws-cdk/core';
import * as DDB from '@aws-cdk/aws-dynamodb';
import * as AppSync from '@aws-cdk/aws-appsync';
import * as Cognito from '@aws-cdk/aws-cognito';

import { ChatSchema } from './schema';
import {
    createConversationRequestStr, createMessageRequestStr, createUserConversationRequestStr,
    conversationUserConversationRequestStr, allMessagesConnectionRequestStr,
    allMessagesConnectionResponseStr, allMessagesRequestStr, allMessagesFromRequestStr
} from './map-template-str';

export class ChatApiStack extends CDK.Stack {

    readonly api: AppSync.GraphqlApi;

    constructor(scope: CDK.Construct, id: string, props?: CDK.StackProps) {
        super(scope, id, props);

        const conversationTable = new DDB.Table(this, 'ConversationTable', {
            billingMode: DDB.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: "id",
                type: DDB.AttributeType.STRING
            }
        });

        const messageTable = new DDB.Table(this, 'MessageTable', {
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

        /*
         * Add resolvers
         */
        const conversationDS = this.api.addDynamoDbDataSource("conversationDS", conversationTable);
        const messageDS = this.api.addDynamoDbDataSource("messageDS", messageTable);
        const userConversationDS = this.api.addDynamoDbDataSource("userConversationDS", userConversationTable);

        conversationDS.createResolver({
            typeName: "Mutation",
            fieldName: "createConversation",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(createConversationRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultItem()
        });

        messageDS.createResolver({
            typeName: "Mutation",
            fieldName: "createMessage",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(createMessageRequestStr),
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

        messageDS.createResolver({
            typeName: "Query",
            fieldName: "allMessagesConnection",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(allMessagesConnectionRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.fromString(allMessagesConnectionResponseStr)
        });

        messageDS.createResolver({
            typeName: "Query",
            fieldName: "allMessages",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(allMessagesRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultList()
        });

        messageDS.createResolver({
            typeName: "Query",
            fieldName: "allMessagesFrom",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(allMessagesFromRequestStr),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultList()
        })


        new CDK.CfnOutput(this, "chat-api", {
            value: this.api.graphqlUrl,
            description: "Chat api endpoint",
            exportName: "chatApiEndpoint"
        });

        new CDK.CfnOutput(this, "region", {
            value: process.env.CDK_DEFAULT_REGION || '',
            description: "Chat api region",
            exportName: "region"
        });
    }
}
