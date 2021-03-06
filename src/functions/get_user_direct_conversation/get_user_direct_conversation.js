const jwt = require('jsonwebtoken');
const {
    serverErrorResponse, corsResponseHeader, missingParameterResponse
} = require('/opt/nodejs/utils');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

/**
 * Returns the id of the direct conversation (in which only the user and 
 * input user participates) if one exists.
 */
exports.handler = async function(event) {
    const jwtDecoded = jwt.decode(event.headers['Authorization']);
    const userId = jwtDecoded['cognito:username'];
    const targetUserId = event.pathParameters.userId;
    if (targetUserId === undefined || targetUserId === null) {
        return missingParameterResponse('targetUserId');
    }

    try {
        const result = await db.query(`
            WITH user_participant AS (
                    SELECT * FROM participant_table
                    WHERE user_id = :userId
                ), target_user_participant AS (
                    SELECT * FROM participant_table
                    WHERE user_id = :targetUserId
                ), pair_participant AS (
                    SELECT *
                    FROM user_participant AS u
                        INNER JOIN target_user_participant AS t
                        USING (conversation_id)
                )
            SELECT conversation_id AS "conversationId"
            FROM participant_table
            WHERE conversation_id IN (SELECT conversation_id FROM pair_participant)
            GROUP BY conversation_id
            HAVING COUNT(conversation_id) = 2`,
            { userId, targetUserId }
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
