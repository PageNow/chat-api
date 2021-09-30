const { promisify } = require('util');
const redis = require('redis');
const { getPublicKeys, decodeVerifyJwt } = require('/opt/nodejs/decode-verify-jwt');

const redisChatEndpoint = process.env.REDIS_HOST || 'host.docker.internal';
const redisChatPort = process.env.REDIS_PORT || 6379;
const redisChat = redis.createClient(redisChatPort, redisChatEndpoint);
const hset = promisify(redisChat.hset).bind(redisChat);

let cacheKeys;

exports.handler = async function(event) {
    let userId;
    try {
        if (!cacheKeys) {
            cacheKeys = await getPublicKeys();
        }
        const decodedJwt = await decodeVerifyJwt(event.queryStringParameters.Authorization, cacheKeys);
        if (!decodedJwt || !decodedJwt.isValid || decodedJwt.username === '') {
            console.log('Authentication error');
            return { statusCode: 500, body: 'Authentication error' };
        }
        userId = decodedJwt.username;
    } catch (error) {
        console.log(error);
        return { statusCode: 500, body: 'JWT decode error: ' + JSON.stringify(error) };
    }
    console.log('userId', userId);

    // update connectId
    try {
        await hset("chat_connection", userId, event.requestContext.connectionId);
        console.log('updated connectId');
    } catch (error) {
        console.log(error);
        return { statusCode: 500, body: 'Redis error: ' + JSON.stringify(error) };
    }
    
    return { 
        statusCode: 200, 
        body: JSON.stringify({ connectionId: event.requestContext.connectionId })
    };
};
