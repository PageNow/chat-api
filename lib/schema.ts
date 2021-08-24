import * as AppSync from '@aws-cdk/aws-appsync';

/**
 * Defines a GraphQL Type from an intermediate type
 * 
 * @param intermediateType - the intermediate type this type derives from
 * @param options - possible values are 'isRequired', 'isList', 'isRequiredList'
 */
 const typeFromObject = (
    intermediateType: AppSync.IIntermediateType,
    options?: AppSync.GraphqlTypeOptions
): AppSync.GraphqlType => {
    return AppSync.GraphqlType.intermediate({ intermediateType, ...options });
};

export const ChatSchema = (): AppSync.Schema => {
    // Instantiate the schema
    const schema = new AppSync.Schema();

    const userId = AppSync.GraphqlType.id({ isRequired: true });
    const conversationId = AppSync.GraphqlType.id({ isRequired: true });
    const messageId = AppSync.GraphqlType.id( {isRequired: true });

    const directMessage = new AppSync.ObjectType("DirectMessage", {
        definition: {
            senderId: userId,
            recipientId: userId,
            content: AppSync.GraphqlType.string({ isRequired: true }),
            conversationid: conversationId, // partition key
            createdAt: AppSync.GraphqlType.string(), // sort key
            messageId: messageId,
            // flags denoting if the message has been accepted by the server or not
            isSent: AppSync.GraphqlType.boolean(),
            isRead: AppSync.GraphqlType.boolean()
        }
    });
    const directMessageGqlType = typeFromObject(directMessage);
    const directMessageArrGqlType = typeFromObject(directMessage, { isList: true });

    const directMessageConnection = new AppSync.ObjectType("DirectMessageConnection", {
        definition: {
            messages: directMessageArrGqlType,
            nextToken: AppSync.GraphqlType.string()
        }
    });
    const directMessageConnectionGqlType = typeFromObject(directMessageConnection);

    const conversation = new AppSync.ObjectType("Conversation", {
        definition: {
            conversationId: conversationId,
            name: AppSync.GraphqlType.string({ isRequired: true }),
            createdAt: AppSync.GraphqlType.string(),
            updatedAt: AppSync.GraphqlType.string(),
            latestMessage: AppSync.GraphqlType.string(),
            latestSenderId: AppSync.GraphqlType.string()
        }
    });
    const conversationGqlType = typeFromObject(conversation);
    const conversationArrGqlType = typeFromObject(conversation, { isList: true });

    const userConversation = new AppSync.ObjectType("UserConversation", {
        definition: {
            userId: userId,
            conversations: conversationArrGqlType,            
        }
    });
    const userConversationGqlType = typeFromObject(userConversation);

    // used to retrieve conversation id of dms between a pair of users
    const userPairId = AppSync.GraphqlType.id({ isRequired: true });
    const directMessageConversation = new AppSync.ObjectType("DirectMessageConversation", {
        definition: {
            userPairId,
            conversationId: AppSync.GraphqlType.string()
        }
    });
    const directMessageConversationGqlType = typeFromObject(directMessageConversation);

    schema.addType(conversation);
    schema.addType(directMessage);
    schema.addType(directMessageConnection);
    schema.addType(userConversation);
    schema.addType(directMessageConversation);

    /* Add queries to the schema */

    schema.addQuery("allUserConversations", new AppSync.Field({
        returnType: userConversationGqlType
    }));
    
    // Scan through all values of type 'Message'. Use the 'after' and 'before' arguments with the
    // 'nextToken' returned by the 'MessageConnection' result to fetch pages.
    schema.addQuery("allDirectMessages", new AppSync.Field({
        returnType: directMessageArrGqlType,
        args: {
            after: AppSync.GraphqlType.string(),
            conversationId: conversationId,
            first: AppSync.GraphqlType.int()
        }
    }));

    // Scan through all values of type 'MessageConnection'. Use the 'after' and 'before' arguments with the
    // 'nextToken' returned by the 'MessageConnectionConnection' result to fetch pages.
    schema.addQuery("allDirectMessagesConnection", new AppSync.Field({
        returnType: directMessageConnectionGqlType,
        args: {
            after: AppSync.GraphqlType.string(),
            conversationId: conversationId,
            first: AppSync.GraphqlType.int()
        }
    }));

    schema.addQuery("allDirectMessagesFrom", new AppSync.Field({
        returnType: directMessageArrGqlType,
        args: {
            after: AppSync.GraphqlType.string(),
            conversationId: conversationId,
            first: AppSync.GraphqlType.int(),
            senderId: AppSync.GraphqlType.string({ isRequired: true })
        }
    }));

    schema.addQuery("getDmConversation", new AppSync.Field({
        returnType: directMessageConversationGqlType,
        args: {
            userPairId
        }
    }));

    /* Add mutation to the schema */

    // Create a Conversation. Use some of the cooked in template functions for UUID and DateTime.
    schema.addMutation("createConversation", new AppSync.Field({
        returnType: conversationGqlType,
        args: {
            recipientId: userId,
            name: AppSync.GraphqlType.string({ isRequired: true })
        }
    }));

    // Create a message in a Conversation.
    schema.addMutation("createDirectMessage", new AppSync.Field({
        returnType: directMessageGqlType,
        args: {
            content: AppSync.GraphqlType.string(),
            conversationId: conversationId,
            createdAt: AppSync.GraphqlType.string({ isRequired: true }),
            messageId: messageId,
            recipientId: userId
        }
    }));

    /* Add subscription to schema */
    
    // Subscribes to all new messages in a given Conversation.
    schema.addSubscription("subscribeToNewMessage", new AppSync.Field({
        returnType: directMessageGqlType,
        args: { recipientId: userId },
        directives: [ AppSync.Directive.subscribe("createDirectMessage") ]
    }));

    return schema;
}