import { Client, GatewayIntentBits } from 'discord.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users, guilds, userGuilds } from '../db/schema';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Debug environment variables
console.log('Environment check:');
console.log('- DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not set');
console.log('- DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID ? 'Set' : 'Not set');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
console.log('- RAILWAY_DATABASE_URL:', process.env.RAILWAY_DATABASE_URL ? 'Set' : 'Not set');

// Database connection
const db = drizzle(process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL!);

async function importDiscordMembers() {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!botToken) {
        console.error('Error: DISCORD_BOT_TOKEN environment variable is required');
        process.exit(1);
    }

    if (!guildId) {
        console.error('Error: DISCORD_GUILD_ID environment variable is required');
        process.exit(1);
    }

    // Create Discord client with necessary intents
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
        ],
    });

    try {
        console.log('Logging in to Discord...');
        await client.login(botToken);
        console.log('Successfully logged in to Discord');

        // Wait for the client to be ready
        await new Promise<void>((resolve) => {
            client.once('ready', () => {
                console.log(`Bot logged in as ${client.user?.tag}`);
                resolve();
            });
        });

        // Get the guild
        console.log(`Attempting to fetch guild with ID: ${guildId}`);
        const guild = await client.guilds.fetch(guildId).catch(error => {
            console.error(`Failed to fetch guild ${guildId}:`, error.message);
            return null;
        });
        
        if (!guild) {
            console.error(`Guild with ID ${guildId} not found or bot doesn't have access`);
            console.error('Make sure the bot is added to the server and has proper permissions');
            process.exit(1);
        }

        console.log(`Found guild: "${guild.name}" (ID: ${guild.id})`);
        console.log(`Guild member count: ${guild.memberCount}`);

        // Insert or update guild information
        await db.insert(guilds).values({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            updatedAt: new Date(),
        }).onConflictDoUpdate({
            target: guilds.id,
            set: {
                name: guild.name,
                icon: guild.icon,
                updatedAt: new Date(),
            },
        });

        console.log('Guild information saved to database');

        // Fetch all members
        console.log('Fetching guild members...');
        const members = await guild.members.fetch();
        console.log(`Found ${members.size} members`);

        let imported = 0;
        let updated = 0;

        for (const [memberId, member] of members) {
            // Skip bots
            if (member.user.bot) {
                continue;
            }

            try {
                // Insert or update user
                const userResult = await db.insert(users).values({
                    id: member.user.id,
                    username: member.user.username,
                    discriminator: member.user.discriminator || '0', // New Discord usernames don't have discriminators
                    avatar: member.user.avatar,
                    displayName: member.displayName || member.nickname || null, // Guild-specific display name/nickname
                    createdAt: new Date(),
                    lastLogin: new Date(),
                }).onConflictDoUpdate({
                    target: users.id,
                    set: {
                        username: member.user.username,
                        discriminator: member.user.discriminator || '0',
                        avatar: member.user.avatar,
                        displayName: member.displayName || member.nickname || null,
                    },
                });

                // Insert user-guild relationship if it doesn't exist
                await db.insert(userGuilds).values({
                    userId: member.user.id,
                    guildId: guild.id,
                    joinedAt: member.joinedAt || new Date(),
                }).onConflictDoNothing();

                imported++;
                const displayInfo = member.displayName || member.nickname ? 
                    ` [${member.displayName || member.nickname}]` : '';
                console.log(`Imported user: ${member.user.username}${displayInfo} (${member.user.id})`);
            } catch (error) {
                console.error(`Error importing user ${member.user.username}:`, error);
            }
        }

        console.log(`\\nImport completed!`);
        console.log(`- Guild: ${guild.name}`);
        console.log(`- Total members processed: ${imported}`);
        console.log(`- Bots skipped: ${members.size - imported}`);

    } catch (error) {
        console.error('Error during import:', error);
        process.exit(1);
    } finally {
        // Close Discord connection
        client.destroy();
        console.log('Discord connection closed');
        process.exit(0);
    }
}

// Run the import
if (require.main === module) {
    importDiscordMembers().catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export { importDiscordMembers };