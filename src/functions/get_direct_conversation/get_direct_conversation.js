const jwt = require('jsonwebtoken');
const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const userPairId = event && event.arguments && event.arguments.userPairId;
    const conversationId = event && event.arguments && event.arguments.conversationId;
    
    if ((userPairId === undefined || userPairId === null) &&
        (conversationId === undefined || conversationId === null)) {
        throw new Error("Missing argument 'userPairId' or 'conversationId'");
    }

    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }

    try {
        let result;
        if (userPairId && conversationId) {
            result = await db.query(`
                SELECT user_pair_id AS "userPairId", conversation_id AS "conversationId", title
                FROM direct_conversation_table
                WHERE user_pair_id = :userPairId AND conversation_id = :conversationId`,
                [
                    { name: 'userPairId', value: userPairId },
                    { name: 'conversationId', value: conversationId, cast: 'uuid' }
                ]
            );
        } else if (userPairId) {
            result = await db.query(`
                SELECT user_pair_id AS "userPairId", conversation_id AS "conversationId", title
                FROM direct_conversation_table
                WHERE user_pair_id = :userPairId`,
                { userPairId }
            );
        } else if (conversationId) {
            result = await db.query(`
                SELECT user_pair_id AS "userPairId", conversation_id AS "conversationId", title
                FROM direct_conversation_table
                WHERE conversation_id = :conversationId`,
                [
                    { name: 'conversationId', value: conversationId, cast: 'uuid' }
                ]
            );
        } else {
            throw new Error("Missing argument 'userPairId' or 'conversationId'");
        }
        console.log(result);
        if (result.records.length === 0) {
            return null;
        } else {
            return result.records[0];
        }

    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
}
