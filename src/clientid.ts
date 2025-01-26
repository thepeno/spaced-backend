import { DB } from "@/db";
import * as schema from "@/db/schema";
import { nanoid } from "nanoid";

export async function createClientId(db: DB, userId: string): Promise<string> {
	const clientId = nanoid(16);

	const [result] = await db.insert(schema.clients).values({
		id: clientId,
		userId,
	}).returning();

	return clientId;
}
