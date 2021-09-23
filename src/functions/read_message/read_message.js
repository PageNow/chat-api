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
const hmget = promisify(redisChat.hmget).bind(redisChat);

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
            UPDATE message_is_read_table
            SET is_read = TRUE
            FROM (
                SELECT * FROM message_is_read_table
                WHERE conversation_id = :conversationId
            ) AS m INNER JOIN conversation_table USING conversation_id
            WHERE is_read = FALSE
            `
        )
        console.log(result.numberOfRecordsUpdated);
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }

    // get connectionId for all the participants
    let connectionDataArr = [];
    try {
        const connectionIdArr = await hmget("chat_connection", participantIdArr);
        connectionDataArr = connectionIdArr.map((x, i) => {
            return { participantId: participantIdArr[i], connectionId: x };
        }).filter(x => x.connectionId);
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }
    console.log(connectionDataArr);

    // post message to all connections in the conversation
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
    });
    const postCalls = connectionDataArr.map(async ({ participantId, connectionId }) => {
        try {
            await apigwManagementApi.postToConnection({
                ConnectionId: connectionId,
                Data: JSON.stringify({
                    type: 'read-message',
                    conversationId: conversationId,
                    userId: userId
                })
            }).promise();
        } catch (error) {
            console.log(error);
            if (error.statusCode === 410) {
                console.log(`Found stale connection, deleting ${connectionId}`);
                await hdel("chat_connection", participantId).promise();
            } else {
                throw error;
            }
        }
    });

    try {
        await Promise.all(postCalls);
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }

    return {
        statusCode: 200,
        headers: corsResponseHeader,
        body: 'Data sent'
    };
}