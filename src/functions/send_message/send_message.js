const { promisify } = require('util');
const redis = require('redis');
const { getPublicKeys, decodeVerifyJwt } = require('/opt/nodejs/decode-verify-jwt');
const {
    authErrorResponse, unauthErrorResposne, serverErrorResponse,
    corsResponseHeader, missingBodyResponse
} = require('/opt/nodejs/utils');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const redisChatEndpoint = process.env.REDIS_HOST || 'host.docker.internal';
const redisChatPort = process.env.REDIS_PORT || 6379;
const redisChat = redis.createClient(redisChatPort, redisChatEndpoint);
const hmget = promisify(redisChat.hmget).bind(redisChat);
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
    console.log(userId);

    if (eventData.tempMessageId === undefined || eventData.tempMessageId === null) {
        return missingBodyResponse('tempMessageId');
    }
    if (eventData.conversationId === undefined || eventData.conversationId === null) {
        return missingBodyResponse('conversationId');
    }
    if (eventData.content === undefined || eventData.content === null || eventData.content === '') {
        return missingBodyResponse('content');
    }
    const tempMessageId = eventData.tempMessageId;
    const conversationId = eventData.conversationId;
    const content = eventData.content;

    const sentAt = new Date(Date.now()).toISOString();
    const messageId = uuidv4();
    let participantIdArr = [];
    try {
        const result = await db.query(
            `SELECT * FROM participant_table WHERE conversation_id = :conversationId`,
            [ { name: 'conversationId', value: conversationId, cast: 'uuid' } ]
        );
        participantIdArr = result.records.map(x => x.user_id);
        if (!participantIdArr.includes(userId)) {
            console.log('Users not in conversation_table of conversation_id');
            return unauthErrorResposne;
        }
        const isReadValues = [];
        participantIdArr.forEach(participantId => {
            isReadValues.push([
                { name: 'messageId', value: messageId, cast: 'uuid' },
                { name: 'userId', value: participantId },
                { name: 'isRead', value: userId === participantId }
            ]);
        });
        await db.transaction()
            .query(`
                INSERT INTO message_table (message_id, conversation_id, sender_id, content, sent_at)
                VALUES (:messageId, :conversationId, :userId, :content, :sentAt)`,
                [
                    { name: 'messageId', value: messageId, cast: 'uuid' },
                    { name: 'conversationId', value: conversationId, cast: 'uuid' },
                    { name: 'userId', value: userId },
                    { name: 'content', value: content },
                    { name: 'sentAt', value: sentAt, cast: 'timestamp' }
                ]
            )
            .query(`
                INSERT INTO message_is_read_table (message_id, user_id, is_read)
                VALUES (:messageId, :userId, :isRead)`,
                isReadValues
            )
            .rollback((e, status) => { console.log(e) })
            .commit();
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
                    type: 'new-message',
                    messageId: messageId,
                    tempMessageId: tempMessageId,
                    conversationId: conversationId,
                    senderId: userId,
                    content: content,
                    sentAt: sentAt
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
};
