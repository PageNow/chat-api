const { serverErrorResponse, successResponse } = require('/opt/nodejs/utils');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const conversationId = event && event.conversationId;
    if (conversationId === undefined || conversationId === null) {
        throw new Error("Missing argument 'conversationId'");
    }
    const userId1 = event && event.userId1;
    if (userId1 === undefined || userId1 === null) {
        throw new Error("Missing argument 'userId1'");
    }
    const userId2 = event && event.userId2;
    if (userId2 === undefined || userId2 === null) {
        throw new Error("Missing argument 'userId2");
    }

    try {
        await db.transaction()
            .query(`
                INSERT INTO conversation_table (conversation_id, title, created_by, is_group)
                VALUES (:conversationId, :title, :userId, :isGroup)`,
                [
                    [
                        { name: 'conversationId', value: conversationId, cast: 'uuid' },
                        { name: 'title', value: '' },
                        { name: 'userId', value: userId1 },
                        { name: 'isGroup', value: false }
                    ]
                ]
            )
            .query(`
                INSERT INTO participant_table (user_id, conversation_id)
                VALUES (:userId, :conversationId)`,
                [
                    [
                        { name: 'userId', value: userId1 },
                        { name: 'conversationId', value: conversationId, cast: 'uuid' }
                    ],
                    [
                        { name: 'userId', value: userId2 },
                        { name: 'conversationId', value: conversationId, cast: 'uuid' }
                    ]
                ]
            )
            .rollback((e, status) => {
                console.log(e);
                return serverErrorResponse;
            }) // optional
            .commit(); // execute the queries
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }

    return successResponse;
};
