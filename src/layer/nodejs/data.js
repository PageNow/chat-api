const user1 = {
    user_id: "543449a2-9225-479e-bf0c-c50da6b16b7c",
    email: "ylee2@naver.com",
    first_name: "Daniel",
    last_name: "Lee",
    gender: "male",
    dob: "1996-03-02",
};

const user2 = {
    user_id: "f39fbebb-d4c0-4520-9eb3-2cf5fdb734e2",
    email: "d.choi@gmail.com",
    first_name: "Drew",
    last_name: "Choi",
    gender: "male",
    dob: "1996-09-11",
};

const user3 = {
    user_id: "google_337456865285275482928",
    email: "zzisu@gmail.com",
    first_name: "Jisoo",
    last_name: "Lee",
    gender: "female",
    dob: "1996-08-08",
};

const user4 = {
    user_id: "cc06ed68-5909-4802-bd0c-7cf0b0a1c313",
    email: "support@pagenow.io",
    first_name: "Changhun",
    last_name: "Lee",
    gender: "male",
    dob: "1996-03-15",
};

const user5 = {
    user_id: "9afb334e-a75a-444c-8250-9730f50fe031",
    email: "abcdef@gmail.com",
    first_name: "Brandon",
    last_name: "Quach",
    gender: "male",
    dob: "1996-04-01"
};

const user6 = {
    user_id: "8010af9d-5ae5-46b2-b35c-7c995b8ea243",
    email: "wxyz@gmail.com",
    first_name: "Alex",
    last_name: "Pan",
    gender: "male",
    dob: "2000-03-17"
};

const user7 = {
    user_id: "c7d9c2e3-e72a-4912-b607-dc85dd513be6",
    email: "example1234@gmail.com",
    first_name: "Patrick",
    last_name: "Yang",
    gender: "male",
    dob: "1996-08-05"
};

const user8 = {
    user_id: "google_214425862782267482928",
    email: "sample9876@gmail.com",
    first_name: "Evan",
    last_name: "Yeh",
    gender: "male",
    dob: "1998-05-24"
};

const user9 = {
    user_id: "7f7950f5-beee-4326-950b-7b3311bca55a",
    email: "pqmno@gmail.com",
    first_name: "Collin",
    last_name: "Kwon",
    gender: "male",
    dob: "1996-11-07"
};

const user10 = {
    user_id: "867a93c6-5d8b-4f61-9f36-70dd9c0947db",
    email: "test111@gmail.com",
    first_name: "Jeff",
    last_name: "Yang",
    gender: "male",
    dob: "1996-08-05"
};

// conversation1 - user1 & user2
const conversation1 = {
    conversation_id: "742a36e4-66ac-4a32-9561-a672a73d4de9",
    title: "",
    created_by: user1.user_id,
    is_group: false
}

// conversation2 - user1 & user2 & user5
const conversation2 = {
    conversation_id: "714b9acc-73b9-4924-a245-c0db6d95ed97",
    title: "Pagenow",
    created_by: user1.user_id,
    is_group: true
};

// conversation3 - user1 & user9
const conversation3 = {
    conversation_id: "44549047-5a90-4055-80a3-96eb8ff7644a",
    title: "",
    created_by: user3.user_id,
    is_group: false
};

// message1_n - messages in conversation1
const message1_1 = {
    message_id: "a0875522-6828-4d13-80be-43f29d08f895",
    conversation_id: conversation1.conversation_id,
    sent_at: "2021-09-26T10:33:11Z",
    sender_id: user1.user_id,
    content: "Conversation 1 - Message 1 sent by user1"
};

const message1_2 = {
    message_id: "6e2337ee-ebcf-4403-916c-dec3c277fefa",
    conversation_id: conversation1.conversation_id,
    sent_at: "2021-09-26T10:40:11Z",
    sender_id: user2.user_id,
    content: "Conversation 1 - Message 2 sent by user2"
};

const message1_3 = {
    message_id: "edf49fad-dc43-4660-a0c5-3d6ba4b1a4f1",
    conversation_id: conversation1.conversation_id,
    sent_at: "2021-09-26T10:41:11Z",
    sender_id: user2.user_id,
    content: "Conversation 1 - Message 3 sent by user2"
};

// message2_n - messages in conversation2
const message2_1 = {
    message_id: "d19a3c23-0fd2-4d99-a469-5e21c879cce9",
    conversation_id: conversation2.conversation_id,
    sent_at: "2021-09-26T10:34:11Z",
    sender_id: user3.user_id,
    content: "Conversation 2 - Message 1 sent by user3"
};

const message2_2 = {
    message_id: "325a7b22-dd3a-4593-bb59-eb75509e22bc",
    conversation_id: conversation2.conversation_id,
    sent_at: "2021-09-26T10:35:11Z",
    sender_id: user2.user_id,
    content: "Conversation 2 - Message 2 sent by user2"
};

const message2_3 = {
    message_id: "25f10d90-7a7f-4186-afdf-b6db7ffcd571",
    conversation_id: conversation2.conversation_id,
    sent_at: "2021-09-27T10:35:11Z",
    sender_id: user1.user_id,
    content: "Conversation 2 - Message 3 sent by user1"
};

module.exports = {
    user1: user1,
    user2: user2,
    user3: user3,
    user4: user4,
    user5: user5,
    user6: user6,
    user7: user7,
    user8: user8,
    user9: user9,
    user10: user10,
    conversation1: conversation1,
    conversation2: conversation2,
    conversation3: conversation3,
    message1_1: message1_1,
    message1_2: message1_2,
    message1_3: message1_3,
    message2_1: message2_1,
    message2_2: message2_2,
    message2_3: message2_3
};
