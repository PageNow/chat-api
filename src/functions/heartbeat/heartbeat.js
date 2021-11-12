// the purpose of chat api heartbeat function is to prevent the websocket
// from disconnecting due to idle timeout

exports.handler = async function(event) {
    const contextId = event.requestContext.connectionId;
    console.log('heartbeat sent by contextId: ', contextId);
    return { statusCode: 200 }
}