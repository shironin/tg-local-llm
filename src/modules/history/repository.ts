import db from '../../db';
import { HistoryRow, Message, MessageRole } from './types';

export function getHistory(userId: number): Message[] {
  const rows = db
    .prepare('SELECT role, content FROM chat_history WHERE user_id = ? ORDER BY id')
    .all(userId) as { role: string; content: string }[];
  return rows.map((row) => ({
    role: (row.role === 'summary' ? 'system' : row.role) as MessageRole,
    content: row.content,
    ...(row.role === 'summary' ? { isHistory: true } : {}),
  }));
}

export function getRows(userId: number): HistoryRow[] {
  return db
    .prepare('SELECT id, role, content FROM chat_history WHERE user_id = ? ORDER BY id')
    .all(userId) as HistoryRow[];
}

export function addMessage(userId: number, role: MessageRole, content: string): void {
  db.prepare('INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)').run(userId, role, content);
}

export function performRollingSummarize(
  userId: number,
  freshMessages: { role: string; content: string }[],
  newSummary: string,
): void {
  db.transaction(() => {
    db.prepare('DELETE FROM chat_history WHERE user_id = ?').run(userId);
    db.prepare('INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)').run(userId, 'summary', newSummary);
    for (const msg of freshMessages) {
      db.prepare('INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)').run(userId, msg.role, msg.content);
    }
  })();
}

export function clearHistory(userId: number): void {
  db.prepare('DELETE FROM chat_history WHERE user_id = ?').run(userId);
}
