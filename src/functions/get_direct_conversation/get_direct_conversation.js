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

    try {
        const result = await db.query(
            "SELECT * FROM direct_conversation_table WHERE user_pair_id = :userPairId",
            { userPairId }
        );
        if (result.records.length === 0) {
            return null;
        } else {
            return result.records[0];
        }

    } catch (err) {
        console.log('Postgres error: ', err);
        throw new Error(err);
    }
}