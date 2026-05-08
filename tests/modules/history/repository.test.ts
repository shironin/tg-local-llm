import Database from 'better-sqlite3';

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

jest.mock('../../../src/db', () => ({ __esModule: true, default: db }));

import {
  getHistory,
  getRows,
  addMessage,
  clearHistory,
  performRollingSummarize,
} from '../../../src/modules/history/repository';

const USER_ID = 1;

beforeEach(() => {
  db.exec('DELETE FROM chat_history; DELETE FROM users;');
});

describe('addMessage / getHistory', () => {
  it('returns empty array when no messages exist', () => {
    expect(getHistory(USER_ID)).toEqual([]);
  });

  it('persists a message and returns it', () => {
    addMessage(USER_ID, 'user', 'hello');
    const history = getHistory(USER_ID);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ role: 'user', content: 'hello' });
  });

  it('maps summary rows to system role with isHistory=true', () => {
    db.prepare('INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)').run(USER_ID, 'summary', 'old stuff');
    const [msg] = getHistory(USER_ID);
    expect(msg.role).toBe('system');
    expect(msg.isHistory).toBe(true);
  });

  it('does not set isHistory on regular messages', () => {
    addMessage(USER_ID, 'user', 'hi');
    const [msg] = getHistory(USER_ID);
    expect(msg.isHistory).toBeUndefined();
  });

  it('returns messages in insertion order', () => {
    addMessage(USER_ID, 'user', 'first');
    addMessage(USER_ID, 'assistant', 'second');
    const history = getHistory(USER_ID);
    expect(history[0].content).toBe('first');
    expect(history[1].content).toBe('second');
  });

  it('isolates history per user', () => {
    addMessage(USER_ID, 'user', 'mine');
    addMessage(99, 'user', 'theirs');
    expect(getHistory(USER_ID)).toHaveLength(1);
    expect(getHistory(99)).toHaveLength(1);
  });
});

describe('getRows', () => {
  it('returns raw rows with id and original role', () => {
    db.prepare('INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)').run(USER_ID, 'summary', 'recap');
    addMessage(USER_ID, 'user', 'hi');
    const rows = getRows(USER_ID);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ role: 'summary', content: 'recap' });
    expect(rows[1]).toMatchObject({ role: 'user', content: 'hi' });
    expect(rows[0].id).toBeDefined();
  });
});

describe('clearHistory', () => {
  it('removes all messages for the user', () => {
    addMessage(USER_ID, 'user', 'a');
    addMessage(USER_ID, 'assistant', 'b');
    clearHistory(USER_ID);
    expect(getHistory(USER_ID)).toHaveLength(0);
  });

  it('does not affect other users', () => {
    addMessage(USER_ID, 'user', 'mine');
    addMessage(99, 'user', 'theirs');
    clearHistory(USER_ID);
    expect(getHistory(99)).toHaveLength(1);
  });
});

describe('performRollingSummarize', () => {
  it('replaces history with a summary row plus fresh messages', () => {
    addMessage(USER_ID, 'user', 'old1');
    addMessage(USER_ID, 'assistant', 'old2');

    const fresh = [{ role: 'user', content: 'new1' }];
    performRollingSummarize(USER_ID, fresh, 'the summary');

    const rows = getRows(USER_ID);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ role: 'summary', content: 'the summary' });
    expect(rows[1]).toMatchObject({ role: 'user', content: 'new1' });
  });

  it('works with no fresh messages', () => {
    addMessage(USER_ID, 'user', 'old');
    performRollingSummarize(USER_ID, [], 'summary only');
    const rows = getRows(USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('summary');
  });
});
