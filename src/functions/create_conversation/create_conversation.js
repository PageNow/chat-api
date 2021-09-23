const { promisify } = require('util');
const redis = require('redis');
const { getPublicKeys, decodeVerifyJwt } = require('/opt/nodejs/decode-verify-jwt');
const {
    authErrorResponse, unauthErrorResposne, serverErrorResponse,
    corsResponseHeader, missingBodyResponse
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
        const decodedJwt = await decodeVerifyJwt(eventData.jwt, cacheKeys);
        if (!decodedJwt || !decodedJwt.isValid || decodedJwt.username === '') {
            return authErrorResponse;
        }
        userId = decodedJwt.username;
    } catch (error) {
        console.log(error);
        return authErrorResponse;
    }

    if (event.body.recipientId === undefined || event.body.recipientId === null) {
        return missingBodyResponse('recipientId');
    }

    if (event.body.title === undefined || event.body.title === null) {
        return missingBodyResponse('title');
    }

    if (event.body.isGroup === undefined || event.body.isGroup === null) {
        return missingBodyResponse('isGroup');
    }

    const conversationId = uuidv4();
    const isGroup = event.body.isGroup;
    let title = event.body.title;
    if (isGroup && title === '') {
        return missingBodyResponse('title');
    }
    if (!isGroup) {
        title = '';
    }
    
    // check if conversation already exists
    try {
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
                        USING conversation_id
                )
            SELECT conversation_id
            FROM conversation_table
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
            }
        }
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }

    try {
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
            .rollback((e, status) => {
                console.log(e);
                return serverErrorResponse;
            }) // optional
            .commit() // execute the queries
    } catch (error) {
        console.log(error);
        return serverErrorResponse;
    }
    
    return {
        statusCode: 200,
        headers: corsResponseHeader,
        body: JSON.stringify({ conversationId })
    };
}
