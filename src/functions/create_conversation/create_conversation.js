const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const conversationTableName = process.env.CONVERSATION_TABLE_NAME;
const userConversationTableName = process.env.USER_CONVERSATION_TABLE_NAME;
const directMessageConversationTable = process.env.DIRECT_MESSAGE_CONVERSATION_TABLE_NAME;

const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

exports.handler = async function(event) {
    const recipientId = event && event.arguments && event.arguments.recipientId;
    if (recipientId === undefined || recipientId === null) {
        throw new Error("Missing argument 'recipientId'");
    }

    const name = event && event.arguments && event.arguments.name;
    if (name === undefined || name === null) {
        throw new Error("Missing argument 'name'");
    }

    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }
    const userId = decodedJwt.payload['cognito:username'];

    const createdAt = new Date().toISOString();
    const conversationId = uuidv4();
    const userPairId = userId < recipientId ?
            userId + ' ' + recipientId : recipientId + ' ' + userId;
    console.log(createdAt);
    console.log(conversationId);
    console.log(userPairId);

    try {
        await dynamoDB.transactWrite({
            TransactItems: [{
                Put: {
                    TableName: conversationTableName,
                    Item: {
                        conversationId: conversationId,
                        name: name,
                        createdAt: createdAt,
                        createdBy: userId,
                        updatedAt: createdAt,
                        latestMessage: null,
                        latestSenderId: userId,
                    }
                }
            }, {
                Put: {
                    TableName: userConversationTableName,
                    Item: {
                        conversationId: conversationId,
                        userId: userId
                    }
                }
            }, {
                Put: {
                    TableName: userConversationTableName,
                    Item: {
                        conversationId: conversationId,
                        userId: recipientId
                    }
                }
            }, {
                Put: {
                    TableName: directMessageConversationTable,
                    Item: {
                        userPairId: userPairId,
                        conversationId: conversationId
                    }
                }
            }]
        }).promise();
        console.log({ conversationId });
        return { conversationId }
    } catch (error) {
        console.log(error);
        return error;
    }
}
