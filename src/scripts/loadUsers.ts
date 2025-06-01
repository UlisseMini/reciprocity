import { z } from 'zod';
import { users } from '../db/schema';
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

const InputSchema = z.array(z.object({
    id: z.string(),
    avatar: z.string().nullable(),
    nickname: z.string()
}));

function extractAvatarId(avatarUrl: string | null): string | null {
    if (!avatarUrl) return null;
    const match = avatarUrl.match(/avatars\/\d+\/([a-f0-9]+)\./i);
    return match ? match[1] : null;
}

async function loadUsers() {
    try {
        // Read the JSON file
        const rawData = readFileSync('./coolstuff.json', 'utf-8');
        const jsonData = JSON.parse(rawData);

        // Validate the input data
        const validatedInput = InputSchema.parse(jsonData);

        // Transform the data to match users table format
        const transformedUsers = validatedInput.map(user => ({
            id: user.id,
            username: user.nickname,
            discriminator: "0000",
            avatar: extractAvatarId(user.avatar)
        }));

        // Insert the users into the database
        const result = await db.insert(users)
            .values(transformedUsers)
            .onConflictDoNothing();
        console.log("result", result);

        console.log(`Successfully loaded ${transformedUsers.length} users into the database`);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Run the script
loadUsers().then(() => process.exit(0)); 