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
