const { promisify } = require('util');
const redis = require('redis');
const data = require('/opt/nodejs/data');

const redisChatEndpoint = process.env.REDIS_HOST || 'host.docker.internal';
const redisChatPort = process.env.REDIS_PORT || 6379;
const redisChat = redis.createClient(redisChatPort, redisChatEndpoint);
const hmget = promisify(redisChat.hmget).bind(redisChat);

exports.handler = async function(event) {
    let userConnectionIdArr = [];
    const userIdArr = [
        data.user1.user_id, data.user2.user_id, data.user3.user_id, data.user4.user_id,
        data.user5.user_id, data.user6.user_id, data.user7.user_id, data.user8.user_id,
        data.user9.user_id, data.user10.user_id, 'google_117429865182265482928'
    ];
    try {
        userConnectionIdArr = await hmget("chat_user_connection", userIdArr);
    } catch (error) {
        console.log(error);
        return { statusCode: 500, body: 'Redis error: ' + JSON.stringify(error) };
    }

    return { statusCode: 200, body: { userConnectionIdArr } };
};
