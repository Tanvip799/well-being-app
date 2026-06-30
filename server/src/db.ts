import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // set { rejectUnauthorized: false } for cloud-hosted DBs
});

export async function initDB() {
  const client = await pool.connect();
  try {
    // Users table — core auth + stats
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        xp            INT DEFAULT 1000,
        wins          INT DEFAULT 0,
        losses        INT DEFAULT 0,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Match history table — one row per match per player
    await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id              SERIAL PRIMARY KEY,
        user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opponent_name   VARCHAR(50) NOT NULL,
        my_score        INT NOT NULL,
        opp_score       INT NOT NULL,
        won             BOOLEAN NOT NULL,
        xp_change       INT NOT NULL DEFAULT 0,
        played_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Database initialized — users + matches tables ready.');
  } finally {
    client.release();
  }
}
