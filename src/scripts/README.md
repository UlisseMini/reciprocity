# Discord Member Import Script

This script connects to a Discord server using a bot token and imports all members into the reciprocity database.

## Setup

1. **Create a Discord Bot:**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to the "Bot" section
   - Create a bot and copy the token
   - Under "Privileged Gateway Intents", enable "Server Members Intent"

2. **Add Bot to Server:**
   - Go to the "OAuth2" → "URL Generator" section
   - Select "bot" scope
   - Select "Read Messages/View Channels" and "View Server Members" permissions
   - Copy the generated URL and add the bot to your server

3. **Environment Variables:**
   Set the following environment variables:
   ```bash
   DISCORD_BOT_TOKEN=your_bot_token_here
   DISCORD_GUILD_ID=your_server_id_here
   RAILWAY_DATABASE_URL=your_railway_postgres_url_here
   # OR use DATABASE_URL if not using Railway
   ```

4. **Get Guild ID:**
   - Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
   - Right-click your server name and "Copy Server ID"

## Usage

Run the import script:

```bash
npm run import-discord
```

## What it does

1. Connects to Discord using the bot token
2. Fetches all members from the specified guild
3. Imports user data into the `users` table
4. Creates guild record in the `guilds` table
5. Links users to guilds in the `user_guilds` table
6. Skips bot accounts automatically

## Notes

- The script requires the bot to have "Server Members Intent" enabled
- It will update existing users if they're already in the database
- Bot accounts are automatically skipped during import
- The script handles both old Discord usernames (with discriminators) and new ones