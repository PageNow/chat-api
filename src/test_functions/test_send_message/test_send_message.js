const { v4: uuidv4 } = require('uuid');
const {
    unauthErrorResposne, serverErrorResponse,
} = require('/opt/nodejs/utils');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const conversationId = event && event.conversationId;
    if (conversationId === undefined || conversationId === null) {
        throw new Error("Missing 'conversationId' in event");
    }
    const senderId = event && event.senderId;
    if (senderId === undefined || senderId === null) {
        throw new Error("Missing 'senderId' in event");
    }
    const content = event && event.content;
    if (content === undefined || content === null || content === '') {
        throw new Error("Missing 'content' in event");
    }

    const sentAt = new Date(Date.now()).toISOString();
    const messageId = uuidv4();
    let participantIdArr = [];
    try {
        const result = await db.query(
            `SELECT * FROM participant_table WHERE conversation_id = :conversationId`,
            [ { name: 'conversationId', value: conversationId, cast: 'uuid' } ]
        );
        participantIdArr = result.records.map(x => x.user_id);
        if (!participantIdArr.includes(senderId)) {
            console.log('Users not in conversation_table of conversation_id');
            return unauthErrorResposne;
        }
        const isReadValues = [];
        for (const participantId of participantIdArr) {
            isReadValues.push([
                { name: 'messageId', value: messageId, cast: 'uuid' },
                { name: 'userId', value: participantId },
                { name: 'isRead', value: participantId === senderId }
            ]);
        }
        await db.transaction()
            .query(`
                INSERT INTO message_table (message_id, conversation_id, sender_id, content, sent_at)
                VALUES (:messageId, :conversationId, :senderId, :content, :sentAt)`,
                [
                    { name: 'messageId', value: messageId, cast: 'uuid' },
                    { name: 'conversationId', value: conversationId, cast: 'uuid' },
                    { name: 'senderId', value: senderId },
                    { name: 'content', value: content },
                    { name: 'sentAt', value: sentAt }
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
};
