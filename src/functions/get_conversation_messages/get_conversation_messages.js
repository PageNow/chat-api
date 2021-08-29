const jwt = require('jsonwebtoken');
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

    const offset = event && event.arguments && event.arguments.offset;
    if (offset === undefined || offset === null) {
        throw new Error("Missing argument 'offset'");
    }

    const limit = event && event.arguments && event.arguments.limit;
    if (limit === undefined || limit === null) {
        throw new Error("Missing argument 'limit'");
    }

    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }
    console.log(decodedJwt);
    const userId = decodedJwt.payload.sub;
    console.log(userId);

    try {
        // make sure user is a participant in the conversation
        let result = await db.query(`
            SELECT * FROM participant_table
            WHERE conversation_id = :conversationId
                AND user_id = :userId`,
            [
                { name: 'conversationId', value: conversationId, cast: 'uuid' },
                { name: 'userId', value: userId }
            ]
        );
        if (result.records.length === 0) {
            console.log('User is not participating in the conversation');
            throw new Error('User is not participating in the conversation');
        }

        result = await db.query(`
            SELECT message_id AS "messageId", conversation_id AS "conversationId",
                sent_at AS "sentAt", sender_id AS "senderId", recipient_id AS "recipientId",
                is_read AS "isRead", content
            FROM direct_message_table
            WHERE conversation_id = :conversationId
            ORDER BY sent_at DESC NULLS LAST
            LIMIT :limit
            OFFSET :offset`,
            [
                { name: 'conversationId', value: conversationId, cast: 'uuid' },
                { name: 'limit', value: limit },
                { name: 'offset', value: offset }
            ]
        );
        return result.records;        

    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
}