const { getPublicKeys, decodeVerifyJwt } = require('/opt/nodejs/decode-verify-jwt');
const {
    authErrorResponse, corsResponseHeader, invalidParameterResponse
} = require('/opt/nodejs/utils');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

let cacheKeys;

exports.handler = async function(event) {
    let userId;
    try {
        if (!cacheKeys) {
            cacheKeys = await getPublicKeys();
        }
        const decodedJwt = await decodeVerifyJwt(event.headers.Authorization, cacheKeys);
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
                SELECT DISTINCT ON (c.conversation_id, m.sent_at) c.conversation_id AS "conversationId",
                    c.title AS title, c.is_group AS "isGroup",
                    m.sent_at AS "sentAt", m.content AS latestContent, m.sender_id AS "senderId",
                    r.is_read AS "isRead", c.participant_id AS "participantId"
                FROM (
                    SELECT conversation_id, title, is_group, p2.user_id AS "participant_id"
                    FROM conversation_table
                    INNER JOIN (
                        SELECT * FROM participant_table WHERE user_id = :userId
                    ) p USING (conversation_id)
                    INNER JOIN (
                        SELECT * FROM participant_table WHERE user_id != :userId
                    ) p2 USING (conversation_id)
                ) c
                CROSS JOIN LATERAL (
                    SELECT m.message_id, m.sent_at, m.content, m.sender_id
                    FROM message_table AS m
                    WHERE m.conversation_id = c.conversation_id
                    ORDER BY m.sent_at DESC NULLS LAST
                    LIMIT 1
                ) m
                INNER JOIN (
                    SELECT * FROM message_is_read_table
                    WHERE user_id = :userId
                ) r USING (message_id)
                ORDER BY m.sent_at DESC`,
                { userId }
            );
        } else {
            if (isRead !== 'true' && isRead !== 'false') {
                return invalidParameterResponse('isRead');
            }
            result = await db.query(`
                SELECT DISTINCT ON (c.conversation_id, m.sent_at) c.conversation_id AS "conversationId",
                    c.title AS title, c.is_group AS "isGroup",
                    m.sent_at AS "sentAt", m.content AS latestContent, m.sender_id AS "senderId",
                    r.is_read AS "isRead", c.participant_id AS "participantId"
                FROM (
                    SELECT conversation_id, title, is_group, p2.user_id AS "participant_id"
                    FROM conversation_table
                    INNER JOIN (
                        SELECT * FROM participant_table WHERE user_id = :userId
                    ) p USING (conversation_id)
                    INNER JOIN (
                        SELECT * FROM participant_table WHERE user_id != :userId
                    ) p2 USING (conversation_id)
                ) c
                CROSS JOIN LATERAL (
                    SELECT m.message_id, m.sent_at, m.content, m.sender_id
                    FROM message_table AS m
                    WHERE m.conversation_id = c.conversation_id
                    ORDER BY m.sent_at DESC NULLS LAST
                    LIMIT 1
                ) m
                INNER JOIN (
                    SELECT * FROM message_is_read_table
                    WHERE user_id = :userId
                ) r USING (message_id)
                WHERE r.is_read = :isRead
                ORDER BY m.sent_at DESC`,
                { userId: userId, isRead: isRead === 'true' }
            );
        }
        return {
            statusCode: 200,
            headers: corsResponseHeader,
            body: JSON.stringify(result.records)
        };
    } catch (error) {
        console.log(error);
        return {
            statusCode: 500,
            headers: corsResponseHeader,
            body: 'Internal server error'
        };
    }
};
