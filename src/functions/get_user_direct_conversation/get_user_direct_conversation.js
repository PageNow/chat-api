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

/**
 * Returns the id of the direct conversation (in which only the user and 
 * input user participates) if one exists.
 */
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

    const targetUserId = event.pathParameters.userId;
    if (targetUserId === undefined || targetUserId === null) {
        return {
            statusCode: 400,
            headers: responseHeader,
            body: 'Missing path parameter'
        };
    }

    try {
        const result = await db.query(`
            WITH user_participant AS (
                    SELECT * FROM participant_table
                    WHERE user_id = :userId
                ), target_user_participant AS (
                    SELECT * FROM participant_table
                    WHERE user_id = :targetUserId
                ), pair_participant AS (
                    SELECT * 
                    FROM user_participant AS u
                        INNER JOIN target_user_participant AS t
                        USING conversation_id
                )
            SELECT conversation_id
            FROM conversation_table
            WHERE conversation_id IN (SELECT conversation_id FROM pair_participant)
            GROUP BY conversation_id
            HAVING COUNT(conversation_id) = 2`,
            { userId, targetUserId }
        );
        return {
            statusCode: 200,
            headers: responseHeader,
            body: JSON.stringify(result.records)
        };
    } catch (error) {
        console.log(error);
        return {
            statusCode: 500,
            headers: responseHeader,
            body: 'Internal server error'
        };
    }
};