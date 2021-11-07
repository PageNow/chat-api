const jwt = require('jsonwebtoken');
const {
    serverErrorResponse, corsResponseHeader
} = require('/opt/nodejs/utils');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const jwtDecoded = jwt.decode(event.headers['Authorization']);
    const userId = jwtDecoded['cognito:username'];
    const conversationId = event.pathParameters.conversationId;

    try {
        const result = await db.query(`
            WITH conversation AS (
                SELECT * FROM conversation_table
                WHERE conversation_id = :conversationId
            )
            SELECT conversation_id, title, is_group AS "isGroup", p.user_id AS "participantId"
            FROM conversation
            INNER JOIN (
                SELECT * FROM participant_table WHERE user_id != :userId
            ) p USING (conversation_id)
            `,
            [
                { name: "userId", value: userId },
                { name: "conversationId", value: conversationId, cast: 'uuid' }
            ]
        );
        return {
            statusCode: 200,
            headers: corsResponseHeader,
            body: JSON.stringify(result.records[0])
        };
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }
};
