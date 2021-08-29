const jwt = require('jsonwebtoken');
const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const conversationId = event && event.arguments && event.arguments.conversationId;
    if (conversationId === undefined || conversationId === null) {
        throw new Error ("Missing argument 'conversationId'");
    }

    const senderId = event && event.arguments && event.arguments.senderId;
    if (senderId === undefined || senderId === null) {
        throw new Error ("Missing argument 'senderId'");
    }

    const recipientId = event && event.arguments && event.arguments.recipientId;
    if (recipientId === undefined || recipientId === null) {
        throw new Error ("Missing argument 'recipientId'");
    }
    
    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }
    const userId = decodedJwt.payload.sub;

    if (userId !== recipientId) {
        throw new Error("Not authorized to access recipientId");
    }

    try {
        const result = await db.query(`
            UPDATE direct_message_table
            SET is_read = TRUE
            WHERE conversation_id = :conversationId
                AND sender_id = :senderId
                AND recipient_id = :userId 
                AND is_read = FALSE`,
            [
                { name: 'conversationId', value: conversationId, cast: 'uuid' },
                { name: 'senderId', value: senderId },
                { name: 'userId', value: userId }
            ]
        );
        return result.numberOfRecordsUpdated;
    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
}