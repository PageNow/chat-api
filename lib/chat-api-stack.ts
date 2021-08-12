import * as CDK from '@aws-cdk/core';
import * as DDB from '@aws-cdk/aws-dynamodb';
import * as AppSync from '@aws-cdk/aws-appsync';
import * as Cognito from '@aws-cdk/aws-cognito';

import { ChatSchema } from './schema';

export class ChatApiStack extends CDK.Stack {

    readonly api: AppSync.GraphqlApi;

    constructor(scope: CDK.Construct, id: string, props?: CDK.StackProps) {
        super(scope, id, props);

        const conversationsTable = new DDB.Table(this, 'ConversationsTable', {
            billingMode: DDB.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: "id",
                type: DDB.AttributeType.STRING
            }
        });

        const messagesTable = new DDB.Table(this, 'MessagesTable', {
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

        const userConversationsTable = new DDB.Table(this, 'UserConversationsTable', {
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
        userConversationsTable.addGlobalSecondaryIndex({
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
        const conversationsDS = this.api.addDynamoDbDataSource("conversationsDS", conversationsTable);
        const messagesDS = this.api.addDynamoDbDataSource("messagesDS", messagesTable);
        const userConversationsDS = this.api.addDynamoDbDataSource("userConversationsDS", userConversationsTable);

        conversationsDS.createResolver({
            typeName: "Mutation",
            fieldName: "createConversation",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(`
                {
                    "version" : "2017-02-28",
                    "operation" : "PutItem",
                    "key": {
                        "id": { "S" : "\${context.arguments.id}"}
                    },
                    "attributeValues" : {
                    "id": {  "S": "\${context.arguments.id}" },
                    "name": {  "S": "\${context.arguments.name}" }
                    #if(\${context.arguments.createdAt}) ,"createdAt": { "S": "\${context.arguments.createdAt}"} #end
                    }
                }
            `),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultItem()
        });

        conversationsDS.createResolver({
            typeName: "Query",
            fieldName: "allMessages",
            requestMappingTemplate: AppSync.MappingTemplate.fromString(`
                {
                    "version" : "2017-02-28",
                    "operation" : "Query",
                    "query" : {
                        "expression": "conversationId = :id",
                        "expressionValues" : {
                            ":id" : {
                                "S" : "\${context.arguments.conversationId}"
                            }
                        }
                    },
                    "limit": #if(\${context.arguments.first}) \${context.arguments.first} #else 20 #end,
                    "nextToken": #if(\${context.arguments.after}) "\${context.arguments.after}" #else null #end
                }
            `),
            responseMappingTemplate: AppSync.MappingTemplate.dynamoDbResultList()
        });

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
