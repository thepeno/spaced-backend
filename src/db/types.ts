// User related types
export interface User {
  id: string;
  last_modified: Date;
  username: string;
  email: string;
  password_hash: string;
  next_seq_no: number;
}

export type NewUser = Omit<User, 'id' | 'last_modified' | 'next_seq_no'>

// Client types
export interface Client {
  id: string;
  last_modified: Date;
  user_id: string;
}

// Card types
export interface Card {
  id: string;
  last_modified: Date;
  seq_no: number;
  user_id: string;
  last_modified_client: string;
}

// Card content types
export interface CardContent {
  card_id: string;
  front: string;
  back: string;
  last_modified: Date;
  seq_no: number;
  last_modified_client: string;
}

// Card deletion tracking
export interface CardDeleted {
  card_id: string;
  last_modified: Date;
  seq_no: number;
  last_modified_client: string;
}

// Deck types
export interface Deck {
  id: string;
  last_modified: Date;
  seq_no: number;
  deleted: boolean;
  user_id: string;
  last_modified_client: string;
}

// Card to deck mapping
export interface CardDeck {
  card_id: string;
  deck_id: string;
  last_modified: Date;
  seq_no: number;
  cl_count: number;
  user_id: string;
}

