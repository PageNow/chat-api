CREATE TABLE conversation_table (
    conversation_id uuid PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT TIMEZONE('UTC', NOW())
);

CREATE TABLE participant_table (
    user_id VARCHAR(50),
    conversation_id uuid,

    PRIMARY KEY (user_id, conversation_id),
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversation_table (conversation_id)
);
CREATE INDEX user_idx ON participant_table (user_id);

CREATE TABLE direct_conversation_table (
    user_pair_id VARCHAR(100) PRIMARY KEY,
    conversation_id uuid,
    title VARCHAR(300) NOT NULL,

    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversation_table (conversation_id)
);

CREATE TABLE direct_message_table (
    message_id uuid,
    conversation_id uuid,
    sent_at TIMESTAMP DEFAULT TIMEZONE('UTC', NOW()),
    sender_id VARCHAR(50) NOT NULL,
    recipient_id VARCHAR(50) NOT NULL,
    content VARCHAR(1000) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (message_id),
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversation_table (conversation_id)
);
CREATE INDEX message_date_sort_idx
ON direct_message_table (conversation_id, sender_id, recipient_id, content, is_read, sent_at DESC NULLS LAST);
