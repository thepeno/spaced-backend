// This script is used to transform the data from the old version of spaced
// into the new version.
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { writeFile } from 'fs/promises';
import {
	CardContentOperation,
	CardDeletedOperation,
	CardSuspendedOperation,
	DeckOperation,
	Operation,
	ReviewLogDeletedOperation,
	ReviewLogOperation,
	UpdateDeckCardOperation,
	type CardOperation,
} from '../src/operation';
import * as oldSchema from './schema-old';

dotenv.config({ path: './scripts/.env.old' });
const oldDb = drizzle(`file:${process.env.DB_PATH}`, {
	schema: oldSchema,
});

const now = new Date();

async function main() {
	const user = await oldDb.query.users.findFirst({
		where: eq(oldSchema.users.email, process.env.EMAIL!),
	});

	if (!user) {
		throw new Error('User not found');
	}

	const cardWithContents = await oldDb
		.select()
		.from(oldSchema.cards)
		.innerJoin(oldSchema.cardContents, eq(oldSchema.cards.id, oldSchema.cardContents.cardId))
		.where(eq(oldSchema.cards.userId, user.id));

	const cardOperations = cardWithContents.map(({ cards }) => ({
		type: 'card',
		payload: {
			id: cards.id,
			due: new Date(cards.due),
			stability: cards.stability,
			difficulty: cards.difficulty,
			elapsed_days: cards.elapsed_days,
			scheduled_days: cards.scheduled_days,
			reps: cards.reps,
			lapses: cards.lapses,
			state: cards.state,
			last_review: cards.last_review ? new Date(cards.last_review) : null,
		},
		timestamp: now.getTime(),
	})) satisfies CardOperation[];

	const cardContentOperations = cardWithContents.map(({ cards, card_contents }) => ({
		type: 'cardContent',
		payload: {
			cardId: cards.id,
			front: card_contents.question,
			back: card_contents.answer,
		},
		timestamp: now.getTime(),
	})) satisfies CardContentOperation[];

	const cardDeletedOperations = cardWithContents.map(({ cards }) => ({
		type: 'cardDeleted',
		payload: {
			cardId: cards.id,
			deleted: cards.deleted,
		},
		timestamp: now.getTime(),
	})) satisfies CardDeletedOperation[];

	const cardSuspendedOperations = cardWithContents.map(({ cards }) => ({
		type: 'cardSuspended',
		payload: {
			cardId: cards.id,
			suspended: cards.suspended,
		},
		timestamp: now.getTime(),
	})) satisfies CardSuspendedOperation[];

	const decks = await oldDb.query.decks.findMany({
		where: eq(oldSchema.decks.userId, user.id),
	});

	const deckOperations = decks.map((deck) => ({
		type: 'deck',
		payload: {
			id: deck.id,
			name: deck.name,
			deleted: deck.deleted,
			description: deck.description,
		},
		timestamp: now.getTime(),
	})) satisfies DeckOperation[];

	const cardDecks = await oldDb
		.select()
		.from(oldSchema.cardsToDecks)
		.innerJoin(oldSchema.cards, eq(oldSchema.cardsToDecks.cardId, oldSchema.cards.id))
		.where(eq(oldSchema.cards.userId, user.id));

	const updateDeckCardOperations = cardDecks.map(({ cards, cards_to_decks }) => ({
		type: 'updateDeckCard',
		payload: {
			deckId: cards_to_decks.deckId,
			cardId: cards.id,
			clCount: 1,
		},
		timestamp: now.getTime(),
	})) satisfies UpdateDeckCardOperation[];

	const reviewLogs = await oldDb
		.select({
			id: oldSchema.reviewLogs.id,
			cardId: oldSchema.reviewLogs.cardId,
			grade: oldSchema.reviewLogs.grade,
			state: oldSchema.reviewLogs.state,
			due: oldSchema.reviewLogs.due,
			stability: oldSchema.reviewLogs.stability,
			difficulty: oldSchema.reviewLogs.difficulty,
			elapsed_days: oldSchema.reviewLogs.elapsed_days,
			scheduled_days: oldSchema.reviewLogs.scheduled_days,
			review: oldSchema.reviewLogs.review,
			duration: oldSchema.reviewLogs.duration,
			createdAt: oldSchema.reviewLogs.createdAt,
			deleted: oldSchema.reviewLogs.deleted,
		})
		.from(oldSchema.cards)
		.innerJoin(oldSchema.reviewLogs, eq(oldSchema.cards.id, oldSchema.reviewLogs.cardId))
		.where(eq(oldSchema.cards.userId, user.id));

	const reviewLogOperations = reviewLogs.map((reviewLog) => ({
		type: 'reviewLog',
		payload: {
			id: reviewLog.id,
			cardId: reviewLog.cardId,

			grade: reviewLog.grade,
			state: reviewLog.state,

			due: reviewLog.due,
			stability: reviewLog.stability,
			difficulty: reviewLog.difficulty,
			elapsed_days: reviewLog.elapsed_days,
			last_elapsed_days: reviewLog.elapsed_days,
			scheduled_days: reviewLog.scheduled_days,
			review: reviewLog.review,
			duration: reviewLog.duration,

			createdAt: reviewLog.createdAt,
		},
		timestamp: now.getTime(),
	})) satisfies ReviewLogOperation[];

	const reviewLogDeletedOperations = reviewLogs
		.filter((reviewLog) => reviewLog.deleted)
		.map((reviewLog) => ({
			type: 'reviewLogDeleted',
			payload: {
				reviewLogId: reviewLog.id,
				deleted: true,
			},
			timestamp: now.getTime(),
		})) satisfies ReviewLogDeletedOperation[];

	const allOperations: Operation[] = [
		...cardOperations,
		...cardContentOperations,
		...cardDeletedOperations,
		...cardSuspendedOperations,
		...deckOperations,
		...updateDeckCardOperations,
		...reviewLogOperations,
		...reviewLogDeletedOperations,
	];

	await writeFile(process.env.OUTPUT_PATH!, JSON.stringify(allOperations, null, 2));
}

main();
