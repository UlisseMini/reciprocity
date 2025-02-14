import { pgTable, text, timestamp, boolean, primaryKey, serial } from "drizzle-orm/pg-core";

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

export const guilds = pgTable('guilds', {
    // Match Discord guild fields
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    icon: text('icon'),

    // Additional helpful fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userGuilds = pgTable('user_guilds', {
    id: serial('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    guildId: text('guild_id')
        .notNull()
        .references(() => guilds.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const userRelations = pgTable('user_relations', {
    id: serial('id').primaryKey(),
    sourceUserId: text('source_user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: text('target_user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    would: text('would').notNull(), // "would date", "would hook up with "
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userOptOuts = pgTable('user_opt_outs', {
    id: serial('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    wouldCategory: text('would').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Export the type that represents a user row
export type User = typeof users.$inferSelect;
// Export the type for inserting a new user
export type NewUser = typeof users.$inferInsert;

// Export guild types
export type Guild = typeof guilds.$inferSelect;
export type NewGuild = typeof guilds.$inferInsert;

// Export user guild types
export type UserGuild = typeof userGuilds.$inferSelect;
export type NewUserGuild = typeof userGuilds.$inferInsert;

// Export user relation types
export type UserRelation = typeof userRelations.$inferSelect;
export type NewUserRelation = typeof userRelations.$inferInsert;

// Export opt-out types
export type UserOptOut = typeof userOptOuts.$inferSelect;
export type NewUserOptOut = typeof userOptOuts.$inferInsert; 