const { promisify } = require('util');
const redis = require('redis');
const { getPublicKeys, decodeVerifyJwt } = require('/opt/nodejs/decode-verify-jwt');
const AWS = require('aws-sdk');
const {
    authErrorResponse, unauthErrorResposne, serverErrorResponse,
    corsResponseHeader, missingBodyResponse
} = require('/opt/nodejs/utils');

const redisChatEndpoint = process.env.REDIS_HOST || 'host.docker.internal';
const redisChatPort = process.env.REDIS_PORT || 6379;
const redisChat = redis.createClient(redisChatPort, redisChatEndpoint);
const hget = promisify(redisChat.hget).bind(redisChat);
const hdel = promisify(redisChat.hdel).bind(redisChat);

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

let cacheKeys;

exports.handler = async function(event) {
    const eventData = JSON.parse(event.body);
    console.log('eventData', eventData);
    if (eventData.jwt === undefined || eventData.jwt === null) {
        return missingBodyResponse('jwt');
    }
    let userId;
    try {
        if (!cacheKeys) {
            cacheKeys = await getPublicKeys();
        }
        const decodedJwt = await decodeVerifyJwt(eventData.jwt, cacheKeys);
        if (!decodedJwt || !decodedJwt.isValid || decodedJwt.username === '') {
            return authErrorResponse;
        }
        userId = decodedJwt.username;
    } catch (error) {
        console.log(error);
        return authErrorResponse;
    }

    if (eventData.conversationId === undefined || eventData.conversationId === null) {
        return missingBodyResponse('conversationId');
    }
    const conversationId = eventData.conversationId;

    let participantIdArr = [];
    try {
        let result = await db.query(
            `SELECT * FROM participant_table WHERE conversation_id = :conversationId`,
            [ { name: 'conversationId', value: conversationId, cast: 'uuid' } ]
        );
        participantIdArr = result.records.map(x => x.user_id);
        if (!participantIdArr.includes(userId)) {
            console.log('Users not in conversation_table of conversation_id');
            return unauthErrorResposne;
        }

        result = await db.query(`
            UPDATE message_is_read_table AS r
            SET is_read = TRUE
            FROM (
                SELECT * FROM message_table
                WHERE conversation_id = :conversationId
            ) m
            WHERE m.message_id = r.message_id AND is_read = FALSE
                AND user_id = :userId`,
            [
                { name: 'conversationId', value: conversationId, cast: 'uuid' },
                { name: 'userId', value: userId }
            ]
        );
        console.log(result.numberOfRecordsUpdated);
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }

    // get connectionId for current user
    let connectionId;
    try {
        connectionId = await hget("chat_connection", userId);
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }
    console.log(connectionId);

    // post message to myself - for all tabs to accept the change (maybe to all connections later)
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
    });
    try {
        await apigwManagementApi.postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify({
                type: 'read-messages',
                conversationId: conversationId,
                userId: userId
            })
        }).promise();
    } catch (error) {
        console.log(error);
        if (error.statusCode === 410) {
            console.log(`Found stale connection, deleting ${connectionId}`);
            await hdel("chat_connection", connectionId).promise();
        } else {
            throw error;
        }
    }

    return {
        statusCode: 200,
        headers: corsResponseHeader,
        body: 'Data sent'
    };
};
