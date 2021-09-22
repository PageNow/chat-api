const { getPublicKeys, decodeVerifyJwt } = require('/opt/nodejs/decode-verify-jwt');
const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

let cacheKeys;
const responseHeader = {
    "Access-Control-Allow-Origin": "*",
};
const authErrorResponse = {
    statusCode: 403,
    headers: responseHeader,
    body: 'Authentication error'
};

exports.handler = async function(event) {
    let userId;
    try {
        if (!cacheKeys) {
            cacheKeys = await getPublicKeys();
        }
        const decodedJwt = await decodeVerifyJwt(event.queryStringParameters.Authorization, cacheKeys);
        if (!decodedJwt || !decodedJwt.isValid || decodedJwt.username === '') {
            return authErrorResponse;
        }
        userId = decodedJwt.username;
    } catch (error) {
        console.log(error);
        return authErrorResponse;
    }
    const isRead = event && event.queryStringParameters && event.queryStringParameters.isRead;

    try {
        let result;
        if (isRead === undefined || isRead === null) {
            result = await db.query(`
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
        } else {
            result = await db.query(`
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
                        AND m.is_read = :isRead
                    ORDER BY m.sent_at DESC NULLS LAST
                    LIMIT 1
                ) m`,
                { userId, isRead }
            );
        }
        return {
            statusCode: 200,
            headers: responseHeader,
            body: JSON.stringify(result.records)
        };
    } catch (error) {
        console.log(err);
        return {
            statusCode: 500,
            headers: responseHeader,
            body: 'Internal server error'
        };
    }
}
