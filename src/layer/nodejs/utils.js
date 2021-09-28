const corsResponseHeader = {
    "Access-Control-Allow-Origin": "*"
};

module.exports = {
    corsResponseHeader: corsResponseHeader,
    unauthErrorResponse: {
        status: 401,
        headers: corsResponseHeader,
        body: 'Unauthorized access error'
    },
    authErrorResponse: {
        statusCode: 403,
        headers: corsResponseHeader,
        body: 'Authentication error'
    },
    serverErrorResponse: {
        statusCode: 500,
        headers: corsResponseHeader,
        body: 'Internal server error'
    },
    missingBodyResponse: (body) => {
        return {
            statusCode: 400,
            headers: corsResponseHeader,
            body: `Missing '${body}' in event body`
        };
    },
    missingParameterResponse: (parameter) => {
        return {
            statusCode: 400,
            headers: corsResponseHeader,
            body: `Missing '${parameter}' in event parameter`
        };
    },
    invalidParameterResponse: (parameter) => {
        return {
            statusCode: 400,
            headers: corsResponseHeader,
            body: `Invalid parameter '${parameter}'`
        };
    },
    successResponse: {
        statusCode: 200,
        headers: corsResponseHeader,
        body: 'Success'
    }
}
