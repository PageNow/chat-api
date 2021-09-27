const data = require('/opt/nodejs/data');
const { serverErrorResponse, successResponse } = require('/opt/nodejs/utils');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const messageData = [
        data.message1_1, data.message1_2, data.message1_3,
        data.message2_1, data.message2_2, data.message2_3
    ];
    const messageValues = messageData.map(x => [
        { name: 'messageId', value: x.message_id, cast: 'uuid' },
        { name: 'conversationId', value: x.conversation_id, cast: 'uuid' },
        { name: 'senderId', value: x.sender_id },
        { name: 'sentAt', value: x.sent_at, cast: 'timestamp' },
        { name: 'content', value: x.content }
    ]);
    const isReadValues = messageData.map(x => [
        { name: 'messageId', value: x.message_id, cast: 'uuid' },
        { name: 'userId', value: x.sender_id }
    ]);
    try {
        await db.transaction()
            .query(`
                INSERT INTO message_table (message_id, conversation_id, sender_id, sent_at, content)
                VALUES (:messageId, :conversationId, :senderId, :sentAt, :content)`,
                messageValues
            )
            .query(`
                INSERT INTO message_is_read_table (message_id, user_id)
                VALUES (:messageId, :userId)`,
                isReadValues
            )
            .rollback((e, status) => {
                console.log(e);
                return serverErrorResponse;
            })
            .commit();
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }

    return successResponse;
};
