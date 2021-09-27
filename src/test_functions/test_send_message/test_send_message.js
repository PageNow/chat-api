const { v4: uuidv4 } = require('uuid');
const {
    authErrorResponse, unauthErrorResposne, serverErrorResponse,
    corsResponseHeader, missingBodyResponse
} = require('/opt/nodejs/utils');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
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
        await db.transaction()
            .query(`
                INSERT INTO message_table (message_id, conversation_id, sender_id, content, sent_at)
                VALUES (:messageId, :conversationId, :userId, :content, :sentAt)`,
                [
                    { name: 'messageId', value: messageId, cast: 'uuid' },
                    { name: 'conversationId', value: conversationId, cast: 'uuid' },
                    { name: 'userId', value: userId },
                    { name: 'recipientId', value: recipientId },
                    { name: 'content', value: content },
                    { name: 'sentAt', value: sentAt }
                ]
            )
            .query(`
                INSERT INTO message_is_read_table (message_id, user_id)
                VALUES (:messageId, :userId)`,
                [
                    { name: 'messageId', value: messageId, cast: 'uuid' },
                    { name: 'userId', value: userId }
                ]
            )
            .rollback((e, status) => { console.log(e) })
            .commit();
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }
}