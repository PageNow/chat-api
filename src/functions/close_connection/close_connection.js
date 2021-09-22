const { promisify } = require('util');
const redis = require('redis');

const redisChatEndpoint = process.env.REDIS_HOST || 'host.docker.internal';
const redisChatPort = process.env.REDIS_PORT || 6379;
const redisChat = redis.createClient(redisChatPort, redisChatEndpoint);
const hdel = promisify(redisChat.hdel).bind(redisChat);
const hget = promisify(redisChat.hget).bind(redisChat);

exports.handler = async function(event) {
    try {
        const userId = await hget("chat_connection_user", event.requestContext.connectionId);
        await hdel("chat_user_connection", userId);
        await hdel("chat_connection_user", event.requestContext.connectionId)
    } catch (error) {
        console.log(error);
        return { statusCode: 500, body: 'Redis error: ' + JSON.stringify(error) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ connectionId: event.requestContext.connectionId })
    }
};
