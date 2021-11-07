const jwt = require('jsonwebtoken');
const {
    unauthErrorResposne, serverErrorResponse, corsResponseHeader
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
        // make sure user is a participant in the conversation
        let result = await db.query(`
            SELECT * FROM participant_table
            WHERE conversation_id = :conversationId
                AND user_id = :userId`,
            [
                { name: 'conversationId', value: conversationId, cast: 'uuid' },
                { name: 'userId', value: userId }
            ]
        );
        if (result.records.length === 0) {
            console.log('User is not participating in the conversation');
            return unauthErrorResposne;
        }

        result = await db.query(`
            SELECT user_id AS "participantId"
            FROM participant_table
            WHERE conversation_id = :conversationId`,
            [
                { name: 'conversationId', value: conversationId, cast: 'uuid' }
            ]
        );
        return {
            statusCode: 200,
            headers: corsResponseHeader,
            body: JSON.stringify(result.records.map(x => x.participantId))
        };
        
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }
};
