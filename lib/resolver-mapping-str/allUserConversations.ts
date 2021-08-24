export const allUserConversationsRequestStr = `
    {
        "version" : "2017-02-28",
        "operation" : "Query",
        "query": {
            "expression": "userId = :userId",
            "expressionValues": {
                ":userId": {
                    "S": "\${context.identity.sub}"
                }
            }
        }
    }
`;

// export const allUserConversationsResponseStr = `
//     {
//         "conversations": $utils.toJson($context.result.items)
//     }
// `;

export const allUserConversationsResponseStr = `
    $utils.toJson($context.result.items)
`;
