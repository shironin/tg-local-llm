import db from '../../db';
import { User } from './types';

type UserRow = { id: number; telegram_id: number; created_at: string };

function toUser(row: UserRow): User {
  return { id: row.id, telegramId: row.telegram_id, createdAt: row.created_at };
}

export function findByTelegramId(telegramId: number): User | undefined {
  const row = db
    .prepare('SELECT id, telegram_id, created_at FROM users WHERE telegram_id = ?')
    .get(telegramId) as UserRow | undefined;
  return row ? toUser(row) : undefined;
}

export function insert(telegramId: number): User {
  const result = db
    .prepare('INSERT INTO users (telegram_id) VALUES (?)')
    .run(telegramId);
  return { id: result.lastInsertRowid as number, telegramId, createdAt: new Date().toISOString() };
}
