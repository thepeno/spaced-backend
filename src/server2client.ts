import { DB } from '@/db';
import * as schema from '@/db/schema';
import {
	CardContentOperation,
	CardDeletedOperation,
	CardOperation,
	DeckOperation,
	Operation,
	ServerToClient,
	UpdateDeckCardOperation,
} from '@/client2server';
import { and, gt, ne } from 'drizzle-orm';

async function getCardsFromSeqNo(db: DB, requestingClientId: string, seqNo: number): Promise<ServerToClient<CardOperation>[]> {
	const cards = await db.query.cards.findMany({
		where: and(gt(schema.cards.seqNo, seqNo), ne(schema.cards.lastModifiedClient, requestingClientId)),
		columns: {
			seqNo: true,
			lastModified: true,
			id: true,
		},
	});

	return cards.map((card) => ({
		type: 'card',
		seqNo: card.seqNo,
		timestamp: card.lastModified.getTime(),
		payload: {
			id: card.id,
		},
	}));
}

async function getCardContentFromSeqNo(db: DB, requestingClientId: string, seqNo: number): Promise<ServerToClient<CardContentOperation>[]> {
	const cardContents = await db.query.cardContents.findMany({
		where: and(gt(schema.cardContents.seqNo, seqNo), ne(schema.cardContents.lastModifiedClient, requestingClientId)),
		columns: {
			seqNo: true,
			lastModified: true,
			cardId: true,
			front: true,
			back: true,
		},
	});

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

async function getCardDeletedFromSeqNo(db: DB, requestingClientId: string, seqNo: number): Promise<ServerToClient<CardDeletedOperation>[]> {
	const cardDeleted = await db.query.cardDeleted.findMany({
		where: and(gt(schema.cardDeleted.seqNo, seqNo), ne(schema.cardDeleted.lastModifiedClient, requestingClientId)),
		columns: {
			seqNo: true,
			lastModified: true,
			cardId: true,
			deleted: true,
		},
	});

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

async function getDeckFromSeqNo(db: DB, requestingClientId: string, seqNo: number): Promise<ServerToClient<DeckOperation>[]> {
	const decks = await db.query.decks.findMany({
		where: and(gt(schema.decks.seqNo, seqNo), ne(schema.decks.lastModifiedClient, requestingClientId)),
		columns: {
			seqNo: true,
			lastModified: true,
			id: true,
			name: true,
			description: true,
			deleted: true,
		},
	});

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

async function getDeckCardFromSeqNo(db: DB, requestingClientId: string, seqNo: number): Promise<ServerToClient<UpdateDeckCardOperation>[]> {
	const deckCards = await db.query.cardDecks.findMany({
		where: and(gt(schema.cardDecks.seqNo, seqNo), ne(schema.cardDecks.lastModifiedClient, requestingClientId)),
		columns: {
			seqNo: true,
			lastModified: true,
			cardId: true,
			deckId: true,
			clCount: true,
		},
	});

	return deckCards.map((deckCard) => ({
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
export async function getAllOpsFromSeqNoExclClient(db: DB, requestingClientId: string, seqNo: number): Promise<ServerToClient<Operation>[]> {
	const operations = await Promise.all([
		getCardsFromSeqNo(db, requestingClientId, seqNo),
		getCardContentFromSeqNo(db, requestingClientId, seqNo),
		getCardDeletedFromSeqNo(db, requestingClientId, seqNo),
		getDeckFromSeqNo(db, requestingClientId, seqNo),
		getDeckCardFromSeqNo(db, requestingClientId, seqNo),
	]);

	return operations.flat().sort((a, b) => a.seqNo - b.seqNo);
}
