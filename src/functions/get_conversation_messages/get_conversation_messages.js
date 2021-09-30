const { getPublicKeys, decodeVerifyJwt } = require('/opt/nodejs/decode-verify-jwt');
const {
    authErrorResponse, unauthErrorResposne, serverErrorResponse,
    corsResponseHeader, missingParameterResponse, invalidParameterResponse
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

    const conversationId = event.pathParameters.conversationId;
    let offset = event.queryStringParameters.offset;
    if (offset === undefined || offset === null) {
        return missingParameterResponse('offset');
    }
    try {
        offset = parseInt(offset, 10);
    } catch (error) {
        console.log(error);
        return invalidParameterResponse('offset');
    }
    let limit = event.queryStringParameters.limit;
    if (limit === undefined || limit === null) {
        return missingParameterResponse('limit');
    }
    try {
        limit = parseInt(limit, 10);
    } catch (error) {
        console.log(error);
        return invalidParameterResponse('offset');
    }
    let isReverse = false;
    if (event.queryStringParameters.order === 'asc') { // old to new
        isReverse = true;
    }
    

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
            return unauthErrorResposne;
        }

        result = await db.query(`
            SELECT message_id AS "messageId", conversation_id AS "conversationId",
                sent_at AS "sentAt", sender_id AS "senderId", content
            FROM message_table
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
        let records = result.records;
        if (isReverse) {
            records.reverse();
        }
        return {
            statusCode: 200,
            headers: corsResponseHeader,
            body: JSON.stringify(records)
        };

    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }
};
