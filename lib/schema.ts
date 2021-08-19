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

    const message = new AppSync.ObjectType("Message", {
        definition: {
            authorId: AppSync.GraphqlType.string(),
            content: AppSync.GraphqlType.string({ isRequired: true }),
            conversationid: conversationId, // partition key
            createdAt: AppSync.GraphqlType.string(), // sort key
            id: messageId,
            // flags denoting if the message has been accepted by the server or not
            isSent: AppSync.GraphqlType.boolean(),
            recipientId: AppSync.GraphqlType.string(),
            sender: AppSync.GraphqlType.string()
        }
    });
    const messageGqlType = typeFromObject(message);
    const messageArrGqlType = typeFromObject(message, { isList: true });

    const messageConnection = new AppSync.ObjectType("MessageConnection", {
        definition: {
            messages: messageArrGqlType,
            nextToken: AppSync.GraphqlType.string()
        }
    });
    const messageConnectionGqlType = typeFromObject(messageConnection);

    const conversation = new AppSync.ObjectType("Conversation", {
        definition: {
            id: conversationId,
            name: AppSync.GraphqlType.string({ isRequired: true }),
            createdAt: AppSync.GraphqlType.string(),
            // messages(after: String, first: Int): MessageConnection
            messages: new AppSync.Field({
                returnType: messageConnectionGqlType,
                args: {
                    after: AppSync.GraphqlType.string(),
                    first: AppSync.GraphqlType.int()
                }
            })
        }
    });
    const conversationGqlType = typeFromObject(conversation);

    const userConversation = new AppSync.ObjectType("UserConversation", {
        definition: {
            // associated: [UserConversations]
            conversation: conversationGqlType,
            conversationId: conversationId,
            userId: userId
        }
    });
    const userConversationGqlType = typeFromObject(userConversation);
    const userConversationArrGqlType = typeFromObject(userConversation, { isList: true });

    const userConversationConnection = new AppSync.ObjectType("UserConversationConnection", {
        definition: {
            nextToken: AppSync.GraphqlType.string(),
            userConversation: userConversationArrGqlType
        }
    });

    // used to retrieve conversation id of dms between a pair of users
    const userPairId = AppSync.GraphqlType.id({ isRequired: true });
    const userPairConversation = new AppSync.ObjectType("UserPairConversation", {
        definition: {
            userPairId,
            conversationId: AppSync.GraphqlType.string()
        }
    });
    const userPairConversationGqlType = typeFromObject(userPairConversation);

    schema.addType(conversation);
    schema.addType(message);
    schema.addType(messageConnection);
    schema.addType(userConversation);
    schema.addType(userConversationConnection);
    schema.addType(userPairConversation);

    /* Add queries to the schema */
    
    // Scan through all values of type 'Message'. Use the 'after' and 'before' arguments with the
    // 'nextToken' returned by the 'MessageConnection' result to fetch pages.
    schema.addQuery("allMessages", new AppSync.Field({
        returnType: messageArrGqlType,
        args: {
            after: AppSync.GraphqlType.string(),
            conversationId: conversationId,
            first: AppSync.GraphqlType.int()
        }
    }));

    // Scan through all values of type 'MessageConnection'. Use the 'after' and 'before' arguments with the
    // 'nextToken' returned by the 'MessageConnectionConnection' result to fetch pages.
    schema.addQuery("allMessagesConnection", new AppSync.Field({
        returnType: messageConnectionGqlType,
        args: {
            after: AppSync.GraphqlType.string(),
            conversationId: conversationId,
            first: AppSync.GraphqlType.int()
        }
    }));

    schema.addQuery("allMessagesFrom", new AppSync.Field({
        returnType: messageArrGqlType,
        args: {
            after: AppSync.GraphqlType.string(),
            conversationId: conversationId,
            first: AppSync.GraphqlType.int(),
            sender: AppSync.GraphqlType.string({ isRequired: true })
        }
    }));

    schema.addQuery("userPairConversation", new AppSync.Field({
        returnType: userPairConversationGqlType,
        args: {
            userPairId
        }
    }));

    /* Add mutation to the schema */

    // Create a Conversation. Use some of the cooked in template functions for UUID and DateTime.
    schema.addMutation("createConversation", new AppSync.Field({
        returnType: conversationGqlType,
        args: {
            createdAt: AppSync.GraphqlType.string(),
            id: conversationId,
            name: AppSync.GraphqlType.string({ isRequired: true })
        }
    }));

    // Create a message in a Conversation.
    schema.addMutation("createMessage", new AppSync.Field({
        returnType: messageGqlType,
        args: {
            content: AppSync.GraphqlType.string(),
            conversationId: conversationId,
            createdAt: AppSync.GraphqlType.string({ isRequired: true }),
            id: messageId
        }
    }));

    // Put a single value of type 'UserConversations'. If an item does not exist with the same key the item will be created.
    // If there exists an item at that key already, it will be updated.
    schema.addMutation("createUserConversation", new AppSync.Field({
        returnType: userConversationGqlType,
        args: {
            conversationId: conversationId,
            userId: userId
        }
    }));

    /* Add subscription to schema */
    
    // Subscribes to all new messages in a given Conversation.
    schema.addSubscription("subscribeToNewMessage", new AppSync.Field({
        returnType: messageGqlType,
        args: { conversationId: conversationId },
        directives: [ AppSync.Directive.subscribe("createMessage") ]
    }));

    schema.addSubscription("subscribeToNewUserConversation", new AppSync.Field({
        returnType: userConversationGqlType,
        args: { userId: userId },
        directives: [ AppSync.Directive.subscribe("createUserConversation") ]
    }));

    return schema;
}