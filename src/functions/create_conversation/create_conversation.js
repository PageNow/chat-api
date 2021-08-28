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
    
    // check if conversation already exists
    let result;
    try {
        result = await db.query(`
            SELECT conversation_id AS "conversationId", title
            FROM direct_conversation_table WHERE user_pair_id = :userPairId`,
            { userPairId }
        );
        if (result.records.length > 0) {
            return result.records;
        }
    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
  
    result = await db.transaction()
        .query(`
            INSERT INTO conversation_table (conversation_id, title, created_by)
            VALUES (:conversationId, :title, :userId)`,
            [
                { name: 'conversationId', value: conversationId, cast: 'uuid' },
                { name: 'title', value: title },
                { name: 'userId', value: userId }
            ]
        )
        .query(`
            INSERT INTO direct_conversation_table (user_pair_id, conversation_id)
            VALUES (:userPairId, :conversationId )`,
            [
                { name: 'userPairId', value: userPairId },
                { name: 'conversationId', value: conversationId, cast: 'uuid' }
            ]
        )
        .query(`
            INSERT INTO participant_table (user_id, conversation_id)
            VALUES (:userId, :conversationId)`,
            [
                [
                    { name: 'userId', value: userId },
                    { name: 'conversationId', value: conversationId, cast: 'uuid' }
                ],
                [
                    { name: 'userId', value: recipientId },
                    { name: 'conversationId', value: conversationId, cast: 'uuid' }
                ]
            ]
        )
        .rollback((err, status) => {
            console.log(status);
            throw new Error(`Postgres Error: ${err}`)
        }) // optional
        .commit() // execute the queries
    
    return { conversationId, title };
}
