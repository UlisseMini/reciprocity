import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';
import fetch from 'node-fetch';
import { z } from 'zod';
import path from 'path';
import { loggerMiddleware } from './middleware/logger';
import cookieParser from 'cookie-parser';

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
const OAUTH_SCOPE = 'identify guilds';

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
    discriminator: z.string(),
    avatar: z.string().nullable(),
});

type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;

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

        // Set auth cookie and redirect
        res.cookie('auth_token', authHeader, {
            httpOnly: true, // Prevents JavaScript access
            secure: process.env.NODE_ENV === 'production', // Requires HTTPS in production
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
