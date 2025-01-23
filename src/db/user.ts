import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core"

export const users = sqliteTable('users', {
  id: integer().primaryKey(),
  username: text(),
  email: text(),
  password_hash: text(),
});
