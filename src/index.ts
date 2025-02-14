import express from 'express';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';
import fetch from 'node-fetch';
import { z } from 'zod';
import { Request, Response } from 'express';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Discord OAuth configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI!;

// Discord API endpoints
const DISCORD_API = 'https://discord.com/api/v10';
const OAUTH_SCOPE = 'identify email';

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
    email: z.string().email(),
    avatar: z.string().nullable(),
});

type TokenResponse = z.infer<typeof TokenResponseSchema>;
type UserResponse = z.infer<typeof UserResponseSchema>;

app.get('/auth/discord/callback', async (req: Request, res: Response) => {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
        return res.status(400).send('No code provided');
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

        const tokenDataRaw = await tokenResponse.json();
        const tokenData = TokenResponseSchema.parse(tokenDataRaw);

        // Get user information
        const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        const userDataRaw = await userResponse.json();
        const userData = UserResponseSchema.parse(userDataRaw);

        res.send(`
      <h1>Logged in successfully!</h1>
      <p>Welcome ${userData.username}#${userData.discriminator}</p>
      <p>Email: ${userData.email}</p>
      ${userData.avatar
                ? `<img src="https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png" alt="Avatar" />`
                : '<p>No avatar available</p>'
            }
    `);
    } catch (error) {
        console.error('Error during authentication:', error);
        res.status(500).send('Authentication failed');
    }
}); 