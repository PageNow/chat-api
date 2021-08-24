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
