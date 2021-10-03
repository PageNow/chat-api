-- SQL query for get_user_direct_converastion between user1 and user2
WITH user_participant AS (
        SELECT * FROM participant_table
        WHERE user_id = '543449a2-9225-479e-bf0c-c50da6b16b7c'
    ), target_user_participant AS (
        SELECT * FROM participant_table
        WHERE user_id = 'f39fbebb-d4c0-4520-9eb3-2cf5fdb734e2'
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
HAVING COUNT(conversation_id) = 2

-- SQL query for get_user_conversations for user1 where isRead = null
SELECT DISTINCT ON (c.conversation_id, m.sent_at) c.conversation_id AS "conversationId",
    c.title AS title, c.is_group AS "isGroup",
    m.sent_at AS "sentAt", m.content AS latestContent, m.sender_id AS "senderId",
    r.is_read AS "isRead", c.participant_id AS "participantId"
FROM (
    SELECT conversation_id, title, is_group, p2.user_id AS "participant_id"
    FROM conversation_table
    INNER JOIN (
        SELECT * FROM participant_table WHERE user_id = '543449a2-9225-479e-bf0c-c50da6b16b7c'
    ) p USING (conversation_id)
    INNER JOIN (
        SELECT * FROM participant_table WHERE user_id != '543449a2-9225-479e-bf0c-c50da6b16b7c'
    ) p2 USING (conversation_id)
) c
CROSS JOIN LATERAL (
    SELECT m.message_id, m.sent_at, m.content, m.sender_id
    FROM message_table AS m
    WHERE m.conversation_id = c.conversation_id
    ORDER BY m.sent_at DESC NULLS LAST
    LIMIT 1
) m
INNER JOIN (
    SELECT * FROM message_is_read_table
    WHERE user_id = '543449a2-9225-479e-bf0c-c50da6b16b7c'
) r USING (message_id)
ORDER BY m.sent_at DESC

-- SQL query for get_user_conversations for user1 where isRead = false
SELECT DISTINCT ON (c.conversation_id, m.sent_at) c.conversation_id AS "conversationId",
    c.title AS title, c.is_group AS "isGroup",
    m.sent_at AS "sentAt", m.content AS latestContent, m.sender_id AS "senderId",
    r.is_read AS "isRead", c.participant_id AS "participantId"
FROM (
    SELECT conversation_id, title, is_group, p2.user_id AS "participant_id"
    FROM conversation_table
    INNER JOIN (
        SELECT * FROM participant_table WHERE user_id = '543449a2-9225-479e-bf0c-c50da6b16b7c'
    ) p USING (conversation_id)
    INNER JOIN (
        SELECT * FROM participant_table WHERE user_id != '543449a2-9225-479e-bf0c-c50da6b16b7c'
    ) p2 USING (conversation_id)
) c
CROSS JOIN LATERAL (
    SELECT m.message_id, m.sent_at, m.content, m.sender_id
    FROM message_table AS m
    WHERE m.conversation_id = c.conversation_id
    ORDER BY m.sent_at DESC NULLS LAST
    LIMIT 1
) m
INNER JOIN (
    SELECT * FROM message_is_read_table
    WHERE user_id = '543449a2-9225-479e-bf0c-c50da6b16b7c'
) r USING (message_id)
WHERE r.is_read = false
ORDER BY m.sent_at DESC

-- SQL query for adding message
INSERT INTO message_table (message_id, conversation_id, sender_id, sent_at, content)
VALUES
    ('a0875522-6828-4d13-80be-43f29d08f895', '742a36e4-66ac-4a32-9561-a672a73d4de9', '543449a2-9225-479e-bf0c-c50da6b16b7c', '2021-09-26T10:33:11Z', 'test')

-- SQL query for getting messages in a conversation
SELECT message_id AS "messageId", conversation_id AS "conversationId",
    sent_at AS "sentAt", sender_id AS "senderId",
    content
FROM message_table
WHERE conversation_id = '742a36e4-66ac-4a32-9561-a672a73d4de9'
ORDER BY sent_at DESC NULLS LAST
LIMIT 10
OFFSET 0

-- SQL query for getting is_read messsages for conversation
SELECT * FROM message_is_read_table
INNER JOIN message_table USING (message_id)
WHERE conversation_id = '742a36e4-66ac-4a32-9561-a672a73d4de9'

-- SQL query for updating is_read
UPDATE message_is_read_table AS r
SET is_read = TRUE
FROM (
    SELECT * FROM message_table
    WHERE conversation_id = '742a36e4-66ac-4a32-9561-a672a73d4de9'
) m
WHERE m.message_id = r.message_id AND is_read = FALSE
    AND user_id = '543449a2-9225-479e-bf0c-c50da6b16b7c'

-- SQL query for getting participants in a conversation
SELECT user_id FROM participant_table WHERE conversation_id = '742a36e4-66ac-4a32-9561-a672a73d4de9'