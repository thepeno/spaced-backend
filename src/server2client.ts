import { DB } from '@/db';
import * as schema from '@/db/schema';
import {
	CardBookmarkedOperation,
	CardContentOperation,
	CardDeletedOperation,
	CardOperation,
	CardSuspendedOperation,
	DeckOperation,
	Operation,
	ReviewLogDeletedOperation,
	ReviewLogOperation,
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

async function getReviewLogsFromSeqNo(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<ReviewLogOperation>[]> {
	const reviewLogs = await db
		.select({
			id: schema.reviewLogs.id,
			cardId: schema.reviewLogs.cardId,
			seqNo: schema.reviewLogs.seqNo,

			grade: schema.reviewLogs.grade,
			state: schema.reviewLogs.state,

			due: schema.reviewLogs.due,
			stability: schema.reviewLogs.stability,
			difficulty: schema.reviewLogs.difficulty,
			elapsed_days: schema.reviewLogs.elapsed_days,
			last_elapsed_days: schema.reviewLogs.last_elapsed_days,
			scheduled_days: schema.reviewLogs.scheduled_days,
			review: schema.reviewLogs.review,
			duration: schema.reviewLogs.duration,

			createdAt: schema.reviewLogs.createdAt,
		})
		.from(schema.cards)
		.where(eq(schema.cards.userId, userId))
		.innerJoin(
			schema.reviewLogs,
			and(
				eq(schema.cards.id, schema.reviewLogs.cardId),
				gt(schema.reviewLogs.seqNo, seqNo),
				ne(schema.reviewLogs.lastModifiedClient, requestingClientId)
			)
		);

	return reviewLogs.map((reviewLog) => ({
		type: 'reviewLog',
		seqNo: reviewLog.seqNo,
		timestamp: reviewLog.createdAt.getTime(),
		payload: {
			id: reviewLog.id,
			cardId: reviewLog.cardId,

			grade: reviewLog.grade,
			state: reviewLog.state,

			due: reviewLog.due,
			stability: reviewLog.stability,
			difficulty: reviewLog.difficulty,
			elapsed_days: reviewLog.elapsed_days,
			last_elapsed_days: reviewLog.last_elapsed_days,
			scheduled_days: reviewLog.scheduled_days,
			review: reviewLog.review,
			duration: reviewLog.duration,

			createdAt: reviewLog.createdAt,
		},
	}));
}

async function getReviewLogDeletedFromSeqNo(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<ReviewLogDeletedOperation>[]> {
	const reviewLogDeleted = await db
		.select({
			seqNo: schema.reviewLogDeleted.seqNo,
			lastModified: schema.reviewLogDeleted.lastModified,
			reviewLogId: schema.reviewLogDeleted.reviewLogId,
			deleted: schema.reviewLogDeleted.deleted,
		})
		.from(schema.cards)
		.where(eq(schema.cards.userId, userId))
		.innerJoin(schema.reviewLogs, eq(schema.cards.id, schema.reviewLogs.cardId))
		.innerJoin(
			schema.reviewLogDeleted,
			and(
				eq(schema.reviewLogs.id, schema.reviewLogDeleted.reviewLogId),
				gt(schema.reviewLogDeleted.seqNo, seqNo),
				ne(schema.reviewLogDeleted.lastModifiedClient, requestingClientId)
			)
		);

	return reviewLogDeleted.map((reviewLogDeleted) => ({
		type: 'reviewLogDeleted',
		seqNo: reviewLogDeleted.seqNo,
		timestamp: reviewLogDeleted.lastModified.getTime(),
		payload: {
			reviewLogId: reviewLogDeleted.reviewLogId,
			deleted: reviewLogDeleted.deleted,
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

async function getCardBookmarkedFromSeqNo(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<CardBookmarkedOperation>[]> {
	const cardBookmarked = await db
		.select({
			seqNo: schema.cardBookmarked.seqNo,
			lastModified: schema.cardBookmarked.lastModified,
			cardId: schema.cardBookmarked.cardId,
			bookmarked: schema.cardBookmarked.bookmarked,
		})
		.from(schema.cards)
		.where(eq(schema.cards.userId, userId))
		.innerJoin(
			schema.cardBookmarked,
			and(
				eq(schema.cards.id, schema.cardBookmarked.cardId),
				gt(schema.cardBookmarked.seqNo, seqNo),
				ne(schema.cardBookmarked.lastModifiedClient, requestingClientId)
			)
		);

	return cardBookmarked.map((cardBookmarked) => ({
		type: 'cardBookmarked',
		seqNo: cardBookmarked.seqNo,
		timestamp: cardBookmarked.lastModified.getTime(),
		payload: {
			cardId: cardBookmarked.cardId,
			bookmarked: cardBookmarked.bookmarked,
		},
	}));
}

async function getCardSuspendedFromSeqNo(
	db: DB,
	userId: string,
	requestingClientId: string,
	seqNo: number
): Promise<ServerToClient<CardSuspendedOperation>[]> {
	const cardSuspended = await db
		.select({
			seqNo: schema.cardSuspended.seqNo,
			lastModified: schema.cardSuspended.lastModified,
			cardId: schema.cardSuspended.cardId,
			suspended: schema.cardSuspended.suspended,
		})
		.from(schema.cards)
		.where(eq(schema.cards.userId, userId))
		.innerJoin(
			schema.cardSuspended,
			and(
				eq(schema.cards.id, schema.cardSuspended.cardId),
				gt(schema.cardSuspended.seqNo, seqNo),
				ne(schema.cardSuspended.lastModifiedClient, requestingClientId)
			)
		);

	return cardSuspended.map((cardSuspended) => ({
		type: 'cardSuspended',
		seqNo: cardSuspended.seqNo,
		timestamp: cardSuspended.lastModified.getTime(),
		payload: {
			cardId: cardSuspended.cardId,
			suspended: cardSuspended.suspended,
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
		getReviewLogsFromSeqNo(db, userId, requestingClientId, seqNo),
		getReviewLogDeletedFromSeqNo(db, userId, requestingClientId, seqNo),
		getCardContentFromSeqNo(db, userId, requestingClientId, seqNo),
		getCardDeletedFromSeqNo(db, userId, requestingClientId, seqNo),
		getCardBookmarkedFromSeqNo(db, userId, requestingClientId, seqNo),
		getCardSuspendedFromSeqNo(db, userId, requestingClientId, seqNo),
		getDeckFromSeqNo(db, userId, requestingClientId, seqNo),
		getDeckCardFromSeqNo(db, userId, requestingClientId, seqNo),
	]);

	return operations.flat().sort((a, b) => a.seqNo - b.seqNo);
}
