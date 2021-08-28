const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const conversationId = event && event.arguments && event.arguments.conversationId;
    if (conversationId === undefined || conversationId === null) {
        throw new Error("Missing argument 'conversationId'");
    }

    const recipientId = event && event.arguments && event.arguments.recipientId;
    if (recipientId === undefined || recipientId === null) {
        throw new Error("Missing argument 'recipientId'");
    }

    const content = event && event.arguments && event.arguments.content;
    if (content === undefined || content === null) {
        throw new Error("Missing argument 'content'");
    }

    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }
    const userId = decodedJwt.payload['cognito:username'];

    const messageId = uuidv4();

    try {
        let result = await db.query(
            `SELECT * FROM participant_table WHERE conversation_id = :conversationId`,
            [ { name: 'conversationId', value: conversationId, cast: 'uuid' } ]
        );
        const participant_arr = result.records.map(x => x.user_id);
        if (participant_arr.length !== 2 || !participant_arr.includes(userId)
            || !participant_arr.includes(recipientId)) {
            console.log('Users not in conversation_table of conversation_id');
            throw new Error('Users not in conversation_table of conversation_id');
        }
        result = await db.query(`
            INSERT INTO direct_message_table (message_id, conversation_id, sender_id, recipient_id, content)
            VALUES (:messageId, :conversationId, :userId, :recipientId, :content)`,
            [
                { name: 'messageId', value: messageId, cast: 'uuid' },
                { name: 'conversationId', value: conversationId, cast: 'uuid' },
                { name: 'userId', value: userId },
                { name: 'recipientId', value: recipientId },
                { name: 'content', value: content }
            ]
        );
        const utcnow = new Date().toISOString();
        return {
            messageId: messageId, conversationId: conversationId, senderId: userId,
            recipientId: recipientId, content: content, isRead: false,
            sentAt: utcnow
        };
    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
}