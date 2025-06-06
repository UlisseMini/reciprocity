import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';
import { z } from 'zod';
import path from 'path';
import { loggerMiddleware } from './middleware/logger';
import cookieParser from 'cookie-parser';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users, guilds, userGuilds, userRelations } from './db/schema';
import { eq, and, exists } from 'drizzle-orm';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Add cookie parser middleware
app.use(cookieParser());

// Add logger middleware before other middleware
app.use(loggerMiddleware);

// Discord OAuth configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI!;

// Discord API endpoints
const DISCORD_API = 'https://discord.com/api';
const OAUTH_SCOPE = 'identify';

// Connect to PostgreSQL
const db = drizzle(process.env.DATABASE_URL!);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Add the type declaration before any code that uses it
declare global {
    namespace Express {
        interface Request {
            user?: UserResponse;
        }
    }
}

// Simple cache for Discord API responses
interface CacheEntry {
    data: any;
    expiresAt: number;
}

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const apiCache = new Map<string, CacheEntry>();

async function fetchDiscordAPI<T>(
    endpoint: string,
    authHeader: string,
    schema: z.ZodType<T>
): Promise<T> {
    const cacheKey = `${authHeader}:${endpoint}`;
    const cached = apiCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
        return cached.data as T;
    }

    const response = await fetch(`${DISCORD_API}${endpoint}`, {
        headers: { Authorization: authHeader },
    });

    if (!response.ok) {
        // Clear this user's cached data on any API error
        for (const [key] of apiCache) {
            if (key.startsWith(authHeader)) {
                apiCache.delete(key);
            }
        }
        throw new Error(`Discord API error: ${response.status}`);
    }

    const data = schema.parse(await response.json());
    apiCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS
    });

    return data;
}

// Update the auth middleware to use cookies
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authToken = req.cookies.auth_token;

    if (!authToken) {
        return next();
    }

    try {
        req.user = await fetchDiscordAPI('/users/@me', authToken, UserResponseSchema);
        next();
    } catch (error) {
        console.error('Auth validation error:', error);
        res.clearCookie('auth_token');
        next();
    }
}

app.use(authMiddleware);

// Main route handler
app.get('/', (req: Request, res: Response) => {
    if (req.user) {
        res.sendFile(path.join(__dirname, '../public/app.html'));
    } else {
        res.sendFile(path.join(__dirname, '../public/login.html'));
    }
});

// Initialize Discord OAuth
app.get('/auth/discord', (_req: Request, res: Response) => {
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: OAUTH_SCOPE,
    });

    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Zod schemas for Discord API responses
const TokenResponseSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
    expires_in: z.number(),
    refresh_token: z.string(),
    scope: z.string(),
});

const UserResponseSchema = z.object({
    id: z.string(),
    username: z.string(),
    discriminator: z.string().optional().nullable(),
    avatar: z.string().optional().nullable(),
});

const GuildResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
});

type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
type GuildResponse = z.infer<typeof GuildResponseSchema>;

async function syncUserData(authHeader: string, userData: UserResponse) {
    try {
        // 1. Update or insert user
        await db.insert(users).values({
            id: userData.id,
            username: userData.username,
            discriminator: userData.discriminator || '0',
            avatar: userData.avatar,
            lastLogin: new Date(),
        }).onConflictDoUpdate({
            target: users.id,
            set: {
                username: userData.username,
                discriminator: userData.discriminator || '0',
                avatar: userData.avatar,
                lastLogin: new Date(),
            },
        });

        // 2. Fetch user's guilds from Discord
        // TODO: Do this and us it to make our app work for arbitrary servers or smthn.
        // const discordGuilds = await fetchDiscordAPI<GuildResponse[]>(
        //     '/users/@me/guilds',
        //     authHeader,
        //     z.array(GuildResponseSchema)
        // );

        // // 3. Update or insert guilds
        // for (const guild of discordGuilds) {
        //     await db.insert(guilds).values({
        //         id: guild.id,
        //         name: guild.name,
        //         icon: guild.icon,
        //         updatedAt: new Date(),
        //     }).onConflictDoUpdate({
        //         target: guilds.id,
        //         set: {
        //             name: guild.name,
        //             icon: guild.icon,
        //             updatedAt: new Date(),
        //         },
        //     });

        //     // 4. Update or insert user guild relationships
        //     await db.insert(userGuilds).values({
        //         userId: userData.id,
        //         guildId: guild.id,
        //     }).onConflictDoNothing();
        // }
    } catch (error) {
        console.error('Error syncing user data:', error);
        throw error;
    }
}

app.get('/auth/discord/callback', async (req: Request, res: Response): Promise<void> => {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
        res.status(400).send('No code provided');
        return;
    }

    try {
        // Exchange code for access token
        const tokenParams = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: DISCORD_REDIRECT_URI,
            scope: OAUTH_SCOPE,
        });

        const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
            method: 'POST',
            body: tokenParams,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const tokenData = TokenResponseSchema.parse(await tokenResponse.json());
        const authHeader = `${tokenData.token_type} ${tokenData.access_token}`;

        // Fetch user data
        const userData = await fetchDiscordAPI('/users/@me', authHeader, UserResponseSchema);

        // Replace the existing db.insert with this:
        await syncUserData(authHeader, userData);

        // Set auth cookie and redirect
        res.cookie('auth_token', authHeader, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.redirect('/');
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).send('OAuth callback failed');
    }
});

// Add a logout route
app.get('/logout', (req: Request, res: Response) => {
    res.clearCookie('auth_token');
    res.redirect('/');
});

// API endpoint to get current user data
app.get('/api/me', async (req: Request, res: Response) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    res.json(req.user);
});

// Add new endpoint to fetch all users
app.get('/api/users', async (req: Request, res: Response) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const allUsers = await db.select().from(users).orderBy(users.lastLogin);
        res.json(allUsers);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

const ModifyRelationSchema = z.object({
    targetUserId: z.string(),
    would: z.string(),
    delete: z.boolean().optional(),
});

app.post('/api/relations', express.json(), async (req: Request, res: Response) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const body = ModifyRelationSchema.parse(req.body);
        
        if (body.delete) {
            // Delete the relation
            await db.delete(userRelations)
                .where(
                    and(
                        eq(userRelations.sourceUserId, req.user.id),
                        eq(userRelations.targetUserId, body.targetUserId),
                        eq(userRelations.would, body.would)
                    )
                );
        } else {
            // Insert or update the relation
            await db.insert(userRelations).values({
                sourceUserId: req.user.id,
                targetUserId: body.targetUserId,
                would: body.would,
            }).onConflictDoNothing();
        }

        // Check for mutual relation
        const mutualRelation = await db.select()
            .from(userRelations)
            .where(
                and(
                    eq(userRelations.sourceUserId, body.targetUserId),
                    eq(userRelations.targetUserId, req.user.id),
                    eq(userRelations.would, body.would)
                )
            )
            .limit(1);

        res.json({
            success: true,
            isMatched: mutualRelation.length > 0
        });

    } catch (error) {
        console.error('Error modifying relation:', error);
        res.status(500).json({ error: 'Failed to modify relation' });
    }
});

const RelationResponseSchema = z.object({
    sourceUserId: z.string(),
    targetUserId: z.string(),
    would: z.string(),
});

// Read endpoint for relations
app.get("/api/relations", async (req: Request, res: Response) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const relations = await db.select().from(userRelations).where(eq(userRelations.sourceUserId, req.user.id));
    res.json(relations.map(relation => RelationResponseSchema.parse(relation)));
});

// Read endpoint for matches
app.get("/api/matches", async (req: Request, res: Response) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const myRelations = await db
        .select({
            targetUserId: userRelations.targetUserId,
            would: userRelations.would
        })
        .from(userRelations)
        .where(eq(userRelations.sourceUserId, req.user.id));

    const othersRelations = await db
        .select({
            sourceUserId: userRelations.sourceUserId,
            would: userRelations.would
        })
        .from(userRelations)
        .where(eq(userRelations.targetUserId, req.user.id));

    const matches = othersRelations.filter(other =>
        myRelations.some(my =>
            my.targetUserId === other.sourceUserId &&
            my.would === other.would
        )
    );

    const mutualRelations = matches.map(match => ({
        otherUserId: match.sourceUserId,
        would: match.would
    }));

    res.json(mutualRelations);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
