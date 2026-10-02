import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function resetTables() {
  console.log('Connecting to Aiven Cloud MySQL...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('Cleaning up old table definitions...');

    // Drop old tables safely
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('DROP TABLE IF EXISTS track;');
    await connection.query('DROP TABLE IF EXISTS playlists;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('Creating fresh tables with correct columns...');

    // 1. Create playlists table
    await connection.query(`
      CREATE TABLE playlists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        youtube_playlist_id VARCHAR(255) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create track table with explicit youtube_id column
    await connection.query(`
      CREATE TABLE track (
        id INT AUTO_INCREMENT PRIMARY KEY,
        playlist_id INT NOT NULL,
        youtube_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        channel_title VARCHAR(255),
        position INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      );
    `);

    console.log('🎉 Fixed! Tables recreated with the correct "youtube_id" column.');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await connection.end();
  }
}

resetTables();