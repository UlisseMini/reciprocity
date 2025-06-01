import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const db = drizzle(process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL!);

async function addDisplayNameColumn() {
    try {
        console.log('Adding display_name column to users table...');
        
        // Add the column manually
        await db.execute(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;`);
        
        console.log('Successfully added display_name column');
    } catch (error) {
        console.error('Error adding column:', error);
        process.exit(1);
    }
}

addDisplayNameColumn().then(() => {
    console.log('Migration completed');
    process.exit(0);
}).catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});