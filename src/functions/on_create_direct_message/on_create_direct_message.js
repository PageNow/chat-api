const jwt = require('jsonwebtoken');

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

    const decodedJwt = jwt.decode(event.request.headers.authorization, { complete: true });
    if (decodedJwt.payload.iss !== 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_014HGnyeu') {
        throw new Error("Authorization failed");
    }
    const userId = decodedJwt.payload['cognito:username'];

    if (userId !== recipientId) {
        throw new Error("Authorization failed");
    }

    return;
}
