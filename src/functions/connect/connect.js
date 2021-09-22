const { promisify } = require('util');
const redis = require('redis');
const { getPublicKeys, decodeVerifyJwt } = require('/opt/nodejs/decode-verify-jwt');

const redisChatEndpoint = process.env.REDIS_HOST || 'host.docker.internal';
const redisChatPort = process.env.REDIS_PORT || 6379;
const redisChat = redis.createClient(redisChatPort, redisChatEndpoint);

let cacheKeys;

exports.handler = async function(event) {
    let userId;
    try {
        if (!cacheKeys) {
            cacheKeys = await getPublicKeys();
        }
        const decodedJwt = await decodeVerifyJwt(event.queryStringParameters.Authorization, cacheKeys);
        if (!decodedJwt || !decodedJwt.isValid || decodedJwt.username === '') {
            return { statusCode: 500, body: 'Authentication error' };
        }
        userId = decodedJwt.username;
    } catch (error) {
        return { statusCode: 500, body: 'JWT decode error: ' + JSON.stringify(error) };
    }

    // update connectId
    try {
        const commands = redisChat.multi();
        commands.hset("chat_user_connection", userId, event.requestContext.connectionId);
        commands.hset("chat_connection_user", event.requestContext.connectionId, userId);
        const execute = promisify(commands.exec).bind(commands);
        await execute();
    } catch (error) {
        console.log(error);
        return { statusCode: 500, body: 'Redis error: ' + JSON.stringify(error) };
    }
};
