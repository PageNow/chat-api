module.exports = {
    corsResponseHeader: {
        "Access-Control-Allow-Origin": "*"
    },
    unauthErrorResponse: {
        status: 401,
        headers: this.corsResponseHeader,
        body: 'Unauthorized access error'
    },
    authErrorResponse: {
        statusCode: 403,
        headers: this.corsResponseHeader,
        body: 'Authentication error'
    },
    serverErrorResponse: {
        statusCode: 500,
        headers: this.corsResponseHeader,
        body: 'Internal server error'
    },
    missingBodyResponse: (body) => {
        return {
            statusCode: 400,
            headers: this.corsResponseHeader,
            body: `Missing '${body}' in event body`
        };
    },
    missingParameterResponse: (parameter) => {
        return {
            statusCode: 400,
            headers: this.corsResponseHeader,
            body: `Missing '${parameter}' in event parameter`
        };
    },
    successResponse: {
        statusCode: 200,
        headers: this.corsResponseHeader,
        body: 'Success'
    }
}
