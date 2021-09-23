CREATE TABLE conversation_table (
    conversation_id  uuid PRIMARY KEY,
    created_by       VARCHAR(50) NOT NULL,
    created_at       TIMESTAMP DEFAULT TIMEZONE('UTC', NOW()),
    title            VARCHAR(300),
    is_dm            BOOLEAN
);

CREATE TABLE participant_table (
    user_id          VARCHAR(50),
    conversation_id  uuid,

    PRIMARY KEY (user_id, conversation_id),
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversation_table (conversation_id)
);
CREATE INDEX user_idx ON participant_table (user_id);

CREATE TABLE message_table (
    message_id       uuid,
    conversation_id  uuid,
    sent_at          TIMESTAMP NOT NULL,
    sender_id        VARCHAR(50) NOT NULL,
    content          VARCHAR(1000) NOT NULL,

    PRIMARY KEY (message_id),
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversation_table (conversation_id)
);
CREATE INDEX message_date_sort_idx
ON message_table (conversation_id, sender_id, content, is_read, sent_at DESC NULLS LAST);

CREATE TABLE message_is_read_table (
    message_id  uuid,
    user_id     VARCHAR(50),
    is_read     BOOLEAN DEFAULT FALSE

    PRIMARY KEY (message_id, user_id),
    CONSTRAINT fk_message
        FOREIGN KEY (message_id)
        REFERENCES message_table (message_id)
    CONSTRAINT fk_participant
        FOREIGN KEY (user_id)
        REFERENCES participant_table (user_id)
);
