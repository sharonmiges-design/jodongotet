import { and, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/netlify-db';

import { savedBots } from '../../db/schema.js';
import { RequestError, validateBot, verifyAccount } from './lib/deriv-account.js';

export default async (req: Request) => {
    const headers = {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
    };
    try {
        if (!['GET', 'POST', 'DELETE'].includes(req.method))
            return Response.json(
                { error: 'Method not allowed.' },
                { status: 405, headers: { ...headers, Allow: 'GET, POST, DELETE' } }
            );
        const accountId = await verifyAccount(req);
        const db = drizzle();
        if (req.method === 'GET') {
            const bots = await db
                .select()
                .from(savedBots)
                .where(eq(savedBots.accountId, accountId))
                .orderBy(desc(savedBots.createdAt))
                .limit(100);
            return Response.json(
                { bots: bots.map(bot => ({ id: bot.id, name: bot.name, xml: bot.xml, createdAt: bot.createdAt })) },
                { headers }
            );
        }
        if (req.method === 'DELETE') {
            const id = new URL(req.url).searchParams.get('id');
            if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new RequestError(400, 'Invalid bot ID.');
            const removed = await db
                .delete(savedBots)
                .where(and(eq(savedBots.id, id), eq(savedBots.accountId, accountId)))
                .returning({ id: savedBots.id });
            if (!removed.length) throw new RequestError(404, 'Bot not found in this account library.');
            return Response.json({ deleted: true }, { headers });
        }
        const raw = await req.text();
        if (raw.length > 1100000) throw new RequestError(413, 'The bot document is too large.');
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            throw new RequestError(400, 'Invalid JSON document.');
        }
        const bot = validateBot(parsed);
        // Serialize each account's quota check and insert in the database, across function instances.
        const inserted = await db.transaction(async tx => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${accountId}))`);
            const [{ count }] = await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(savedBots)
                .where(eq(savedBots.accountId, accountId));
            if (count >= 100)
                throw new RequestError(
                    409,
                    'This account library has reached its 100-bot limit. Export or remove a bot before adding another.'
                );
            const [created] = await tx
                .insert(savedBots)
                .values({ ...bot, accountId })
                .returning({
                    id: savedBots.id,
                    name: savedBots.name,
                    xml: savedBots.xml,
                    createdAt: savedBots.createdAt,
                });
            return created;
        });
        return Response.json({ bot: inserted }, { status: 201, headers });
    } catch (error) {
        // Do not expose upstream responses, authorization data, SQL, or database details.
        return Response.json(
            {
                error:
                    error instanceof RequestError
                        ? error.message
                        : 'Account library is temporarily unavailable. Your existing browser bots are unchanged.',
            },
            { status: error instanceof RequestError ? error.status : 503, headers }
        );
    }
};
