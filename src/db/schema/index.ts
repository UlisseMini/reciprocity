import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
    // Match the Discord user fields from UserResponseSchema
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    discriminator: text('discriminator').notNull(),
    avatar: text('avatar'),

    // Additional helpful fields for user management
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastLogin: timestamp('last_login').defaultNow().notNull(),
});

// Export the type that represents a user row
export type User = typeof users.$inferSelect;
// Export the type for inserting a new user
export type NewUser = typeof users.$inferInsert; 