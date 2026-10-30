import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
/** Account ownership is verified with Deriv by the server, never taken on trust from the browser. */
export const savedBots = pgTable(
    'saved_bots',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        name: text('name').notNull(),
        xml: text('xml').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    table => [index('saved_bots_account_created_idx').on(table.accountId, table.createdAt)]
);
