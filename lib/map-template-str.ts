export const createConversationRequestStr = `
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
`;

export const createDirectMessageRequestStr = `
    {
        "version" : "2017-02-28",
        "operation" : "PutItem",
        "key" : {
            "conversationId" : { "S" : "\${context.arguments.conversationId}" }
        },
        "attributeValues" : {
            "senderId": { "S": "\${context.identity.sub}" },
            "recipientId": { "S": "\${context.arguments.recipientId}" }
            "conversationId": { "S": "\${context.arguments.conversationId}" },
            "content": { "S": "\${context.arguments.content}" },
            "createdAt": { "S": "\${context.arguments.createdAt}" },
            "id": { "S": "\${context.arguments.id}" },
            "isSent": { "BOOL": true }
            "isRead": { "BOOL": false }
        }
    }
`;

export const createUserConversationRequestStr = `
    {
        "version" : "2017-02-28",
        "operation" : "PutItem",
        "key": {
            "userId": { "S" : "\${context.arguments.userId}"},
            "conversationId": { "S" : "\${context.arguments.conversationId}"}
        },
        "attributeValues" : {
            "userId": {  "S": "\${context.arguments.userId}" },
            "conversationId": {  "S": "\${context.arguments.conversationId}" }
        }
    }
`;

export const conversationUserConversationRequestStr = `
    {
        "version" : "2017-02-28",
        "operation" : "GetItem",
        "key" : {
            "id" : { "S" : "\${context.source.conversationId}" }
        }
    }
`;

export const allDirectMessagesConnectionRequestStr = `
    {
        "version" : "2017-02-28",
        "operation" : "Query",
        "query" : {
            "expression": "conversationId = :conversationId",
            "expressionValues" : {
                ":conversationId" : {
                    "S" : "\${context.arguments.conversationId}"
                }
            }
        },
        "scanIndexForward": false,
        "limit": #if(\${context.arguments.first}) \${context.arguments.first} #else 20 #end,
        "nextToken": #if(\${context.arguments.after}) "\${context.arguments.after}" #else null #end
    }
`;

export const allDirectMessagesConnectionResponseStr = `
    {
        "messages": $utils.toJson($context.result.items),
        "nextToken": #if(\${context.result.nextToken}) "\${context.result.nextToken}" #else null #end
    }
`;

export const allDirectMessagesRequestStr = `
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
`;

export const allDirectMessagesFromRequestStr = `
    {
        "version" : "2017-02-28",
        "operation" : "Query",
        "query" : {
            "expression": "conversationId = :id and senderId = :senderId",
            "expressionValues" : {
                ":id" : {
                    "S" : "\${context.arguments.conversationId}"
                },
                ":senderId" : {
                    "S" : "\${context.arguments.senderId}"
                }
            }
        },
        "limit": #if(\${context.arguments.first}) \${context.arguments.first} #else 20 #end,
        "nextToken": #if(\${context.arguments.after}) "\${context.arguments.after}" #else null #end
    }
`;

export const directMessageConversationRequestStr = `
    {
        "version" : "2017-02-28",
        "operation" : "GetItem",
        "key" : {
            "userPairId" : { "S" : "\${context.arguments.userPairId}" }
        }
    }
`;
