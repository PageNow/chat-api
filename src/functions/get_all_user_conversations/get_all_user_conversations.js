const jwt = require('jsonwebtoken');
const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }
    const userId = decodedJwt.payload['cognito:username'];

    try {
        const result = await db.query(`
            SELECT c.conversation_id AS "conversationId", c.title AS title,
                m.sent_at AS "sentAt", m.content AS content, m.sender_id AS "senderId",
                m.recipient_id AS "recipientId", m.is_read AS "isRead"
            FROM (
                SELECT conversation_id, title FROM conversation_table
                NATURAL JOIN (
                    SELECT * FROM participant_table WHERE user_id = :userId
                ) p
            ) c
            CROSS JOIN LATERAL (
                SELECT m.sent_at, m.content, m.sender_id, m.recipient_id, m.is_read
                FROM direct_message_table m
                WHERE m.conversation_id = c.conversation_id
                ORDER BY m.sent_at DESC NULLS LAST
                LIMIT 1
            ) m`,
            { userId }
        );
        console.log(result.records);
        return result.records;
    } catch (err) {
        console.log('Postgres error: ', err);
        throw new Error(err);
    }
}
