import { DB } from '@/db';
import * as schema from '@/db/schema';
import {
	CardContentOperation,
	CardDeletedOperation,
	CardOperation,
	DeckOperation,
	Operation,
	UpdateDeckCardOperation,
} from '@/operation';
import { and, eq, gt, ne } from 'drizzle-orm';

/** Represents an operation sent from the server to the client */
export type ServerToClient<T extends Operation> = T & { seqNo: number };

async function getCardsFromSeqNo(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<CardOperation>[]> {
	const cards = await db.query.cards.findMany({
		where: and(
			eq(schema.cards.userId, userId),
			gt(schema.cards.seqNo, seqNo),
			ne(schema.cards.lastModifiedClient, requestingClientId)
		),
		columns: {
			seqNo: true,
			lastModified: true,
			id: true,
			// card variables
			due: true,
			stability: true,
			difficulty: true,
			elapsed_days: true,
			scheduled_days: true,
			reps: true,
			lapses: true,
			state: true,
			last_review: true,
		},
	});

	return cards.map((card) => ({
		type: 'card',
		seqNo: card.seqNo,
		timestamp: card.lastModified.getTime(),
		payload: {
			id: card.id,
			// card variables
			due: card.due,
			stability: card.stability,
			difficulty: card.difficulty,
			elapsed_days: card.elapsed_days,
			scheduled_days: card.scheduled_days,
			reps: card.reps,
			lapses: card.lapses,
			state: card.state,
			last_review: card.last_review,
		},
	}));
}

async function getCardContentFromSeqNo(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<CardContentOperation>[]> {
	const cardContents = await db
		.select({
			seqNo: schema.cardContents.seqNo,
			lastModified: schema.cardContents.lastModified,
			cardId: schema.cardContents.cardId,
			front: schema.cardContents.front,
			back: schema.cardContents.back,
		})
		.from(schema.cards)
		.where(eq(schema.cards.userId, userId))
		.innerJoin(
			schema.cardContents,
			and(
				eq(schema.cards.id, schema.cardContents.cardId),
				gt(schema.cardContents.seqNo, seqNo),
				ne(schema.cardContents.lastModifiedClient, requestingClientId)
			)
		);

	return cardContents.map((cardContent) => ({
		type: 'cardContent',
		seqNo: cardContent.seqNo,
		timestamp: cardContent.lastModified.getTime(),
		payload: {
			cardId: cardContent.cardId,
			front: cardContent.front,
			back: cardContent.back,
		},
	}));
}

async function getCardDeletedFromSeqNo(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<CardDeletedOperation>[]> {
	const cardDeleted = await db
		.select({
			seqNo: schema.cardDeleted.seqNo,
			lastModified: schema.cardDeleted.lastModified,
			cardId: schema.cardDeleted.cardId,
			deleted: schema.cardDeleted.deleted,
		})
		.from(schema.cards)
		.where(eq(schema.cards.userId, userId))
		.innerJoin(
			schema.cardDeleted,
			and(
				eq(schema.cards.id, schema.cardDeleted.cardId),
				gt(schema.cardDeleted.seqNo, seqNo),
				ne(schema.cardDeleted.lastModifiedClient, requestingClientId)
			)
		);

	return cardDeleted.map((cardDeleted) => ({
		type: 'cardDeleted',
		seqNo: cardDeleted.seqNo,
		timestamp: cardDeleted.lastModified.getTime(),
		payload: {
			cardId: cardDeleted.cardId,
			deleted: cardDeleted.deleted,
		},
	}));
}

async function getDeckFromSeqNo(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<DeckOperation>[]> {
	const decks = await db
		.select({
			id: schema.decks.id,
			seqNo: schema.decks.seqNo,
			lastModified: schema.decks.lastModified,
			name: schema.decks.name,
			description: schema.decks.description,
			deleted: schema.decks.deleted,
		})
		.from(schema.decks)
		.where(
			and(
				eq(schema.decks.userId, userId),
				gt(schema.decks.seqNo, seqNo),
				ne(schema.decks.lastModifiedClient, requestingClientId)
			)
		);

	return decks.map((deck) => ({
		type: 'deck',
		seqNo: deck.seqNo,
		timestamp: deck.lastModified.getTime(),
		payload: {
			id: deck.id,
			name: deck.name,
			description: deck.description,
			deleted: deck.deleted,
		},
	}));
}

async function getDeckCardFromSeqNo(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<UpdateDeckCardOperation>[]> {
	const cardDecks = await db
		.select({
			seqNo: schema.cardDecks.seqNo,
			lastModified: schema.cardDecks.lastModified,
			cardId: schema.cardDecks.cardId,
			deckId: schema.cardDecks.deckId,
			clCount: schema.cardDecks.clCount,
		})
		.from(schema.decks)
		.where(eq(schema.decks.userId, userId))
		.innerJoin(
			schema.cardDecks,
			and(
				eq(schema.decks.id, schema.cardDecks.deckId),
				gt(schema.cardDecks.seqNo, seqNo),
				ne(schema.cardDecks.lastModifiedClient, requestingClientId)
			)
		);

	return cardDecks.map((deckCard) => ({
		type: 'updateDeckCard',
		seqNo: deckCard.seqNo,
		timestamp: deckCard.lastModified.getTime(),
		payload: {
			cardId: deckCard.cardId,
			deckId: deckCard.deckId,
			clCount: deckCard.clCount,
		},
	}));
}

/**
 * Get all operations from a seqNo, excluding the client that made the request
 *
 * @param db
 * @param requestingClientId
 * @param seqNo
 * @returns
 */
export async function getAllOpsFromSeqNoExclClient(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<Operation>[]> {
	const operations = await Promise.all([
		getCardsFromSeqNo(db, userId, requestingClientId, seqNo),
		getCardContentFromSeqNo(db, userId, requestingClientId, seqNo),
		getCardDeletedFromSeqNo(db, userId, requestingClientId, seqNo),
		getDeckFromSeqNo(db, userId, requestingClientId, seqNo),
		getDeckCardFromSeqNo(db, userId, requestingClientId, seqNo),
	]);

	return operations.flat().sort((a, b) => a.seqNo - b.seqNo);
}
