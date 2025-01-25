import { DB } from '@/db';
import * as schema from '@/db/schema';
import { Card } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

type StripMetadata<T> = Omit<T, 'seqNo' | 'lastModifiedClient' | 'userId' | 'lastModified'>;

export type CardOperation = {
	type: 'card';
	payload: StripMetadata<Card>;
	timestamp: number;
};

export type CardContentOperation = {
	type: 'cardContent';
	payload: StripMetadata<schema.CardContent>;
	timestamp: number;
};

export type CardDeletedOperation = {
	type: 'cardDeleted';
	payload: StripMetadata<schema.CardDeleted>;
	timestamp: number;
};

export type DeckOperation = {
	type: 'deck';
	payload: StripMetadata<schema.Deck>;
	timestamp: number;
};

export type UpdateDeckCardOperation = {
	type: 'updateDeckCard';
	payload: StripMetadata<schema.CardDeck>;
	timestamp: number;
}

export type Operation = CardOperation | CardContentOperation | CardDeletedOperation | DeckOperation | UpdateDeckCardOperation;
