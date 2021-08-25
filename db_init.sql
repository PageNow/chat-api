CREATE TABLE conversation_table (
    conversation_id uuid PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    created_at TIMESTAMP DEFAULT TIMEZONE('UTC', NOW()),
    created_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP DEFAULT TIMEZONE('UTC', NOW()),
);

CREATE TABLE participant_table (
    user_id VARCHAR(50),
    conversation_id uuid,

    PRIMARY KEY (user_id, conversation_id),
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversation_table(conversation_id)
);
CREATE INDEX user_idx ON user_conversation_table(user_id);

CREATE TABLE user_pair_table (
    user_pair_id VARCHAR(100) PRIMARY KEY,
    conversation_id uuid,
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversation_table(conversation_id)
);

CREATE TABLE direct_message_table (
    message_id uuid DEFAULT uuid_generate_v4(),
    conversation_id uuid,
    created_at TIMESTAMP DEFAULT TIMEZONE('UTC', NOW()),
    sender_id VARCHAR(50) NOT NULL,
    recipient_id VARCHAR(50) NOT NULL,
    content VARCHAR(1000) NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (message_id),
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversation_table(conversation_id)
);
