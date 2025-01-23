CREATE TABLE users (
    id TEXT PRIMARY KEY,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    next_seq_no INTEGER NOT NULL DEFAULT 1
    -- Other user fields
);

CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id TEXT NOT NULL,
    UNIQUE(user_id, id)
    -- Other metadata about client
);

CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    seq_no INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    last_modified_client TEXT NOT NULL,
    -- Other card fields
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (last_modified_client) REFERENCES clients(id)
);

CREATE TABLE card_contents (
    card_id TEXT PRIMARY KEY,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    seq_no INTEGER NOT NULL,
    last_modified_client TEXT NOT NULL,
    -- Other card content fields
    FOREIGN KEY (card_id) REFERENCES cards(id),
    FOREIGN KEY (last_modified_client) REFERENCES clients(id)
);

CREATE TABLE card_deleted (
    card_id TEXT PRIMARY KEY,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    seq_no INTEGER NOT NULL,
    last_modified_client TEXT NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id),
    FOREIGN KEY (last_modified_client) REFERENCES clients(id)
);

CREATE TABLE decks (
    id TEXT PRIMARY KEY,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    seq_no INTEGER NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    user_id TEXT NOT NULL,
    last_modified_client TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (last_modified_client) REFERENCES clients(id)
);

CREATE TABLE card_decks (
    card_id TEXT NOT NULL,
    deck_id TEXT NOT NULL,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    seq_no INTEGER NOT NULL,
    cl_count INTEGER NOT NULL DEFAULT 0,
    user_id TEXT NOT NULL,
    PRIMARY KEY (card_id, deck_id),
    FOREIGN KEY (card_id) REFERENCES cards(id),
    FOREIGN KEY (deck_id) REFERENCES decks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
