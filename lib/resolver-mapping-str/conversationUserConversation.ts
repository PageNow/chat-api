export const conversationUserConversationRequestStr = `
    {
        "version" : "2017-02-28",
        "operation" : "GetItem",
        "key" : {
            "conversationId" : { "S" : "\${context.source.conversationId}" }
        }
    }
`;
