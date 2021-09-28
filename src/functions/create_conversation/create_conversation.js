const { getPublicKeys, decodeVerifyJwt } = require('/opt/nodejs/decode-verify-jwt');
const {
    authErrorResponse, serverErrorResponse,
    corsResponseHeader, missingBodyResponse, invalidParameterResponse
} = require('/opt/nodejs/utils');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

let cacheKeys;

exports.handler = async function(event) {
    let userId;
    try {
        if (!cacheKeys) {
            cacheKeys = await getPublicKeys();
        }
        const decodedJwt = await decodeVerifyJwt(event.headers.Authorization, cacheKeys);
        if (!decodedJwt || !decodedJwt.isValid || decodedJwt.username === '') {
            return authErrorResponse;
        }
        userId = decodedJwt.username;
    } catch (error) {
        console.log(error);
        return authErrorResponse;
    }
    
    let eventBody = {};
    if (event.body) {
        eventBody = JSON.parse(event.body);
    }
    if (eventBody.recipientIdArr === undefined || eventBody.recipientIdArr === null) {
        return missingBodyResponse('recipientIdArr');
    }
    if (eventBody.title === undefined || eventBody.title === null) {
        return missingBodyResponse('title');
    }
    if (eventBody.isGroup === undefined || eventBody.isGroup === null) {
        return missingBodyResponse('isGroup');
    }
    
    const conversationId = uuidv4();
    const recipientIdArr = eventBody.recipientIdArr;
    const isGroup = eventBody.isGroup;
    // if the conversation is direct, recipientIdArr must have length 1
    if (recipientIdArr.length === 0 || (!isGroup && recipientIdArr.length !== 1) ||
        (isGroup && recipientIdArr.length <= 1)) {
        return invalidParameterResponse('recipientIdArr');
    }
    
    let title = event.body.title;
    if (isGroup && title === '') {
        return invalidParameterResponse('title');
    }
    if (!isGroup) {
        title = '';
    }
    
    // check if conversation already exists if it is a direct conversation
    if (!isGroup) {
        try {
            const recipientId = recipientIdArr[0];
            const result = await db.query(`
                WITH user_participant AS (
                        SELECT * FROM participant_table
                        WHERE user_id = :userId
                    ), target_user_participant AS (
                        SELECT * FROM participant_table
                        WHERE user_id = :recipientId
                    ), pair_participant AS (
                        SELECT *
                        FROM user_participant AS u
                            INNER JOIN target_user_participant AS t
                            USING (conversation_id)
                    )
                SELECT conversation_id
                FROM participant_table
                WHERE conversation_id IN (SELECT conversation_id FROM pair_participant)
                GROUP BY conversation_id
                HAVING COUNT(conversation_id) = 2`,
                { userId, recipientId }
            );
            console.log(result.records);
            if (result.records.length > 0) {
                return {
                    statusCode: 200,
                    headers: corsResponseHeader,
                    body: JSON.stringify({ conversationId: result.records[0].conversation_id })
                };
            }
        } catch (error) {
            console.log(error);
            return serverErrorResponse;
        }
    }

    try {
        const participantData = [
            [
                { name: 'userId', value: userId },
                { name: 'conversationId', value: conversationId, cast: 'uuid' }
            ]    
        ];
        recipientIdArr.forEach(recipientId => {
            participantData.push([
                { name: 'userId', value: recipientId },
                { name: 'conversationId', value: conversationId, cast: 'uuid' }  
            ]);
        });
        await db.transaction()
            .query(`
                INSERT INTO conversation_table (conversation_id, title, created_by, is_group)
                VALUES (:conversationId, :title, :userId, :isGroup)`,
                [
                    { name: 'conversationId', value: conversationId, cast: 'uuid' },
                    { name: 'title', value: title },
                    { name: 'userId', value: userId },
                    { name: 'isGroup', value: isGroup }
                ]
            )
            .query(`
                INSERT INTO participant_table (user_id, conversation_id)
                VALUES (:userId, :conversationId)`,
                participantData
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
    
    return {
        statusCode: 200,
        headers: corsResponseHeader,
        body: JSON.stringify({ conversationId })
    };
};
