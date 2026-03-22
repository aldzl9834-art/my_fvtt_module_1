-- 1. 사용자 표 (프로필 이미지 URL 칸이 추가되었습니다)
CREATE TABLE Contacts (
    id VARCHAR(50) PRIMARY KEY,       -- 고유 연락처 아이디 (예: user_001)
    actor_id VARCHAR(50),             -- FVTT 내부 액터 ID
    name VARCHAR(100) NOT NULL,       -- 스마트폰에 표시될 이름
    is_npc BOOLEAN DEFAULT FALSE,     -- NPC 여부 (0: 플레이어, 1: NPC)
    profile_image_url VARCHAR(255)    -- 프로필 이미지 링크 주소
);

-- 2. 주소록 표
CREATE TABLE AddressBook (
    owner_id VARCHAR(50),             -- 내 연락처 아이디
    contact_id VARCHAR(50),           -- 추가한 상대방 아이디
    PRIMARY KEY (owner_id, contact_id)
);

-- 3. 채팅방 표
CREATE TABLE ChatRooms (
    room_id VARCHAR(50) PRIMARY KEY,  -- 채팅방 고유 아이디
    room_name VARCHAR(100),           -- 채팅방 이름 (그룹방일 경우)
    is_group BOOLEAN DEFAULT FALSE    -- 그룹 채팅방 여부
);

-- 4. 채팅방 참여자 표
CREATE TABLE RoomMembers (
    room_id VARCHAR(50),              -- 참여 중인 채팅방 아이디
    contact_id VARCHAR(50),           -- 참여자 아이디
    PRIMARY KEY (room_id, contact_id)
);

-- 5. 메시지 표
CREATE TABLE Messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY, -- 메시지 고유 번호 (자동으로 1씩 늘어남)
    room_id VARCHAR(50),                       -- 채팅방 아이디
    sender_id VARCHAR(50),                     -- 보낸 사람 아이디
    message_type VARCHAR(20) DEFAULT 'text',   -- 'text' (글자) 또는 'image' (이미지)
    content TEXT,                              -- 대화 내용이나 이미지 링크 주소
    send_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 보낸 시간 (자동 기록됨)
);