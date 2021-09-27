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
SELECT c.conversation_id AS "conversationId", c.title AS title, c.is_group AS "isGroup",
    m.sent_at AS "sentAt", m.content AS content, m.sender_id AS "senderId",
    m.is_read AS "isRead"
FROM (
    SELECT conversation_id, title, is_group FROM conversation_table
    NATURAL JOIN (
        SELECT * FROM participant_table WHERE user_id = '543449a2-9225-479e-bf0c-c50da6b16b7c'
    ) p
) c
CROSS JOIN LATERAL (
    SELECT m.sent_at, m.content, m.sender_id, is_read
    FROM message_table AS m
  		INNER JOIN message_is_read_table USING (message_id)
    WHERE m.conversation_id = c.conversation_id
    ORDER BY m.sent_at DESC NULLS LAST
    LIMIT 1
) m

-- SQL query for get_user_conversations for user1 where isRead = false
SELECT c.conversation_id AS "conversationId", c.title AS title, c.is_group AS "isGroup",
    m.sent_at AS "sentAt", m.content AS content, m.sender_id AS "senderId",
    m.is_read AS "isRead"
FROM (
    SELECT conversation_id, title, is_group FROM conversation_table
    NATURAL JOIN (
        SELECT * FROM participant_table WHERE user_id = '543449a2-9225-479e-bf0c-c50da6b16b7c'
    ) p
) c
CROSS JOIN LATERAL (
    SELECT m.sent_at, m.content, m.sender_id, is_read
    FROM message_table AS m
  		INNER JOIN message_is_read_table USING (message_id)
    WHERE m.conversation_id = c.conversation_id AND is_read = false
    ORDER BY m.sent_at DESC NULLS LAST
    LIMIT 1
) m

-- SQL query for adding message
INSERT INTO message_table (message_id, conversation_id, sender_id, sent_at, content)
VALUES
    ('a0875522-6828-4d13-80be-43f29d08f895', '742a36e4-66ac-4a32-9561-a672a73d4de9', '543449a2-9225-479e-bf0c-c50da6b16b7c', '2021-09-26T10:33:11Z', 'test')