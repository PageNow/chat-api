const data = require('/opt/nodejs/data');
const { serverErrorResponse, successResponse } = require('/opt/nodejs/utils');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    try {
        await db.transaction()
            .query(`
                INSERT INTO conversation_table (conversation_id, title, created_by, is_group)
                VALUES (:conversationId, :title, :userId, :isGroup)`,
                [
                    [
                        { name: 'conversationId', value: data.conversation1.conversation_id, cast: 'uuid' },
                        { name: 'title', value: data.conversation1.title },
                        { name: 'userId', value: data.conversation1.created_by },
                        { name: 'isGroup', value: data.conversation1.is_group }
                    ],
                    [
                        { name: 'conversationId', value: data.conversation2.conversation_id, cast: 'uuid' },
                        { name: 'title', value: data.conversation2.title },
                        { name: 'userId', value: data.conversation2.created_by },
                        { name: 'isGroup', value: data.conversation2.is_group }
                    ],
                    [
                        { name: 'conversationId', value: data.conversation3.conversation_id, cast: 'uuid' },
                        { name: 'title', value: data.conversation3.title },
                        { name: 'userId', value: data.conversation3.created_by },
                        { name: 'isGroup', value: data.conversation3.is_group }
                    ]
                ]
            )
            .query(`
                INSERT INTO participant_table (user_id, conversation_id)
                VALUES (:userId, :conversationId)`,
                [
                    [
                        { name: 'userId', value: data.user1.user_id },
                        { name: 'conversationId', value: data.conversation1.conversation_id, cast: 'uuid' }
                    ],
                    [
                        { name: 'userId', value: data.user2.user_id },
                        { name: 'conversationId', value: data.conversation1.conversation_id, cast: 'uuid' }
                    ],
                    [
                        { name: 'userId', value: data.user1.user_id },
                        { name: 'conversationId', value: data.conversation2.conversation_id, cast: 'uuid' }
                    ],
                    [
                        { name: 'userId', value: data.user2.user_id },
                        { name: 'conversationId', value: data.conversation2.conversation_id, cast: 'uuid' }
                    ],
                    [
                        { name: 'userId', value: data.user3.user_id },
                        { name: 'conversationId', value: data.conversation2.conversation_id, cast: 'uuid' }
                    ],
                    [
                        { name: 'userId', value: data.user1.user_id },
                        { name: 'conversationId', value: data.conversation3.conversation_id, cast: 'uuid' }
                    ],
                    [
                        { name: 'userId', value: data.user3.user_id },
                        { name: 'conversationId', value: data.conversation3.conversation_id, cast: 'uuid' }
                    ],
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
