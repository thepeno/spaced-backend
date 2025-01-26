import * as schema from '@/db/schema';
import { Card } from '@/db/schema';
import { z } from 'zod';

type StripMetadata<T> = Omit<T, 'seqNo' | 'lastModifiedClient' | 'userId' | 'lastModified'>;

export type CardOperation = {
	type: 'card';
	payload: StripMetadata<Card>;
	timestamp: number;
};

export const cardOperationSchema = z.object({
	type: z.literal('card'),
	payload: z.object({
		id: z.string(),
	}),
	timestamp: z.number(),
}) satisfies z.ZodType<CardOperation>;

export type CardContentOperation = {
	type: 'cardContent';
	payload: StripMetadata<schema.CardContent>;
	timestamp: number;
};

export const cardContentOperationSchema = z.object({
	type: z.literal('cardContent'),
	payload: z.object({
		cardId: z.string(),
		front: z.string(),
		back: z.string(),
	}),
	timestamp: z.number(),
}) satisfies z.ZodType<CardContentOperation>;

export type CardDeletedOperation = {
	type: 'cardDeleted';
	payload: StripMetadata<schema.CardDeleted>;
	timestamp: number;
};

export const cardDeletedOperationSchema = z.object({
	type: z.literal('cardDeleted'),
	payload: z.object({
		cardId: z.string(),
		deleted: z.boolean(),
	}),
	timestamp: z.number(),
}) satisfies z.ZodType<CardDeletedOperation>;

export type DeckOperation = {
	type: 'deck';
	payload: StripMetadata<schema.Deck>;
	timestamp: number;
};

export const deckOperationSchema = z.object({
	type: z.literal('deck'),
	payload: z.object({
		id: z.string(),
		name: z.string(),
		deleted: z.boolean(),
		description: z.string(),
	}),
	timestamp: z.number(),
}) satisfies z.ZodType<DeckOperation>;

export type UpdateDeckCardOperation = {
	type: 'updateDeckCard';
	payload: StripMetadata<schema.CardDeck>;
	timestamp: number;
};

export const updateDeckCardOperationSchema = z.object({
	type: z.literal('updateDeckCard'),
	payload: z.object({
		deckId: z.string(),
		cardId: z.string(),
		clCount: z.number(),
	}),
	timestamp: z.number(),
}) satisfies z.ZodType<UpdateDeckCardOperation>;

export type Operation = CardOperation | CardContentOperation | CardDeletedOperation | DeckOperation | UpdateDeckCardOperation;

export const operationSchema = z.union([cardOperationSchema, cardContentOperationSchema, cardDeletedOperationSchema, deckOperationSchema, updateDeckCardOperationSchema]);
