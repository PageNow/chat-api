const jwt = require('jsonwebtoken');
const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const userPairId = event && event.arguments && event.arguments.userPairId;
    if (userPairId === undefined || userPairId === null) {
        throw new Error("Missing argument 'userPairId'");
    }

    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }

    try {
        const result = await db.query(
            "SELECT * FROM direct_conversation_table WHERE user_pair_id = :userPairId",
            { userPairId }
        );
        console.log(result);
        if (result.records.length === 0) {
            return null;
        } else {
            return {
                userPairId: result.records[0].user_pair_id,
                conversationId: result.records[0].conversation_id
            };
        }

    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
}
