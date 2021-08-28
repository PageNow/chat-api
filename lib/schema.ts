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
    const messageId = AppSync.GraphqlType.id({ isRequired: true });

    // Direct message object
    const directMessage = new AppSync.ObjectType("DirectMessage", {
        definition: {
            messageId: messageId,
            conversationId: conversationId,
            sentAt: AppSync.GraphqlType.string(),
            senderId: userId,
            recipientId: userId,
            content: AppSync.GraphqlType.string({ isRequired: true }),
            isRead: AppSync.GraphqlType.boolean()
        }
    });
    const directMessageGqlType = typeFromObject(directMessage);
    const directMessageArrGqlType = typeFromObject(directMessage, { isList: true });

    // Conversation object
    const conversation = new AppSync.ObjectType("Conversation", {
        definition: {
            conversationId: conversationId,
            title: AppSync.GraphqlType.string({ isRequired: true }),
            createdBy: AppSync.GraphqlType.string(),
            createdAt: AppSync.GraphqlType.string(),
        }
    });
    const conversationGqlType = typeFromObject(conversation);

    // Object that represents conversation users participate in
    const userConversation = new AppSync.ObjectType("UserConversation", {
        definition: {
            conversationId: conversationId,
            title: AppSync.GraphqlType.string({ isRequired: true }),
            sentAt: AppSync.GraphqlType.string({ isRequired: true }),
            content: AppSync.GraphqlType.string({ isRequired: true }),
            senderId: userId,
            recipientId: userId,
            isRead: AppSync.GraphqlType.boolean({ isRequired: true })
        }
    });
    const userConversationGqlType = typeFromObject(userConversation);
    const userConversationArrGqlType = typeFromObject(userConversation, { isList: true });

    // used to retrieve conversation id of dms between a pair of users
    const userPairId = AppSync.GraphqlType.id({ isRequired: true });
    const directMessageConversation = new AppSync.ObjectType("DirectMessageConversation", {
        definition: {
            userPairId: userPairId,
            conversationId: AppSync.GraphqlType.string(),
            title: AppSync.GraphqlType.string()
        }
    });
    const directMessageConversationGqlType = typeFromObject(directMessageConversation);

    // Add objects to schema
    schema.addType(conversation);
    schema.addType(directMessage);
    schema.addType(userConversation);
    schema.addType(directMessageConversation);

    /**
     * Add queries to the schema
     */

    // Used to check if direct conversation exists between two users
    schema.addQuery("getDirectConversation", new AppSync.Field({
        returnType: directMessageConversationGqlType,
        args: {
            userPairId: AppSync.GraphqlType.id(), // can be null
            conversationId: AppSync.GraphqlType.id(), // can be null
        },
        directives: [ AppSync.Directive.custom('@aws_cognito_user_pools') ]
    }));

    // Used to retrieve all conversations a user participates in
    schema.addQuery("getUserConversations", new AppSync.Field({
        returnType: userConversationArrGqlType,
        directives: [ AppSync.Directive.custom('@aws_cognito_user_pools') ]
    }));

    schema.addQuery("getConversationMessages", new AppSync.Field({
        returnType: directMessageArrGqlType,
        args: {
            conversationId: conversationId,
            offset: AppSync.GraphqlType.int({ isRequired: true }),
            limit: AppSync.GraphqlType.int({ isRequired: true })
        },
        directives: [ AppSync.Directive.custom('@aws_cognito_user_pools') ]
    }));

    /**
     * Add mutation to the schema
     */

    // Create a conversation
    schema.addMutation("createConversation", new AppSync.Field({
        returnType: conversationGqlType,
        args: {
            recipientId: userId,
            senderName: AppSync.GraphqlType.string({ isRequired: true }),
            recipientName: AppSync.GraphqlType.string( { isRequired: true })
        },
        directives: [ AppSync.Directive.custom('@aws_cognito_user_pools') ]
    }));

    // Create a message in a Conversation.
    schema.addMutation("createDirectMessage", new AppSync.Field({
        returnType: directMessageGqlType,
        args: {
            conversationId: conversationId,
            content: AppSync.GraphqlType.string({ isRequired: true }),
            recipientId: userId
        },
        directives: [ AppSync.Directive.custom('@aws_cognito_user_pools') ]
    }));

    // Mark the message as read in a Conversation
    schema.addMutation("setMessageIsRead", new AppSync.Field({
        returnType: AppSync.GraphqlType.int(), // number of rows updated
        args: {
            conversationId: conversationId,
            senderId: userId, // needed for subscription
            recipientId: userId // needed for subscription
        },
        directives: [ AppSync.Directive.custom('@aws_cognito_user_pools') ]
    }));

    /**
     * Add subscription to schema
     */

    // Subscribes to all new messages to an user
    schema.addSubscription("onCreateDirectMessage", new AppSync.Field({
        returnType: directMessageGqlType,
        args: {
            recipientId: userId
        },
        directives: [ 
            AppSync.Directive.custom('@aws_cognito_user_pools'),
            AppSync.Directive.subscribe('createDirectMessage')
        ]
    }));

    // TODO: doesn't seem to be working
    // Subscribes to set is_read of message
    schema.addSubscription("onSetMessageIsRead", new AppSync.Field({
        returnType: AppSync.GraphqlType.int(),
        args: {
            conversationId: conversationId,
            senderId: userId
        },
        directives: [
            AppSync.Directive.custom('@aws_cognito_user_pools'),
            AppSync.Directive.subscribe('setMessageIsRead')
        ]
    }));

    return schema;
}