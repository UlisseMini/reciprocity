import { pgTable, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export async function up(db: any) {
    await db.execute(sql`
    ALTER TABLE users 
    ADD COLUMN last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;
  `);
}

export async function down(db: any) {
    await db.execute(sql`
    ALTER TABLE users 
    DROP COLUMN last_login;
  `);
} 