const jwt = require('jsonwebtoken');

const db = require('data-api-client')({
    secretArn: process.env.DB_SECRET_ARN,
    resourceArn: process.env.DB_CLUSTER_ARN,
    database: process.env.DB_NAME
});

exports.handler = async function(event) {
    const conversationId = event && event.arguments && event.arguments.conversationId;
    if (conversationId === undefined || conversationId === null) {
        throw new Error("Missing argument 'conversationid'");
    }

    const senderId = event && event.arguments && event.arguments.senderId;
    if (senderid === undefined || senderId === null) {
        throw new Error("Missing argument 'senderId'");
    }

    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }
    const userId = decodedJwt.payload['cognito:username'];

    if (userId !== senderId) {
        throw new Error("Authorization failed");
    }

    return;
}
