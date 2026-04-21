import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.DB_PATH ?? join(process.cwd(), 'data', 'chats_history');

try {
  mkdirSync(DATA_DIR, { recursive: true });
} catch (err) {
  console.error(`[DB] Failed to create directory ${DATA_DIR}:`, err);
  process.exit(1);
}

const dbPath = join(DATA_DIR, 'history.db');
console.log(`[DB] Opening database at ${dbPath}`);

let db: ReturnType<typeof Database>;
try {
  db = new Database(dbPath);
} catch (err) {
  console.error(`[DB] Failed to open database at ${dbPath}:`, err);
  process.exit(1);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    role      TEXT    NOT NULL,
    content   TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_user ON chat_history (user_id);
`);

export default db;
