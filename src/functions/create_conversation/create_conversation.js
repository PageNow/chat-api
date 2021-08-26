const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const recipientId = event && event.arguments && event.arguments.recipientId;
    if (recipientId === undefined || recipientId === null) {
        throw new Error("Missing argument 'recipientId'");
    }

    const title = event && event.arguments && event.arguments.title;
    if (title === undefined || title === null) {
        throw new Error("Missing argument 'title'");
    }

    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }
    const userId = decodedJwt.payload['cognito:username'];

    const conversationId = uuidv4();
    const userPairId = userId < recipientId ?
            userId + ' ' + recipientId : recipientId + ' ' + userId;
    console.log(conversationId);
    console.log(userPairId);

    try {
        await db.query("BEGIN");

        try {
            await db.query(
                "INSERT INTO conversation_table (conversation_id, title, created_by) \
                VALUES (:conversationId, :title, :createdBy)",
                { conversationId, title, createdBy }
            );
            
            try {
                await db.query(
                    "INSERT INTO direct_conversation_table (user_pair_id, conversation_id) \
                    VALUES (:userPairId, :conversationId )",
                    { userPairId, conversationId }
                );

                try {
                    await db.query(
                        "INSERT INTO participant_table (user_id, conversation_id) \
                        VALUES (:userId, :conversationId)",
                        [
                            [{ userId: userId, conversationId: conversationId }],
                            [{ userId: recipientId, conversationId: conversationId }]
                        ]
                    );

                    try {
                        await db.query("COMMIT");
                    } catch (err) {
                        await db.query("ROLLBACK");
                        console.log('Postgres error: ', err);
                        return err;
                    }
                } catch (err) {
                    await db.query("ROLLBACK");
                    console.log('Postgres error: ', err);
                    return err;
                }
            } catch (err) {
                await db.query("ROLLBACK");
                console.log('Postgres error: ', err);
                return err;
            }
        } catch (err) {
            await db.query("ROLLBACK");
            console.log('Postgres error: ', err);
            return err;
        }

    } catch (err) {
        console.log('Postgres error: ', err);
        return err;
    }
    
    return { conversationId };
}
