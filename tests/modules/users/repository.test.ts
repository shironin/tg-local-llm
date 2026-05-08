import Database from 'better-sqlite3';

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

jest.mock('../../../src/db', () => ({ __esModule: true, default: db }));

import { findByTelegramId, insert } from '../../../src/modules/users/repository';

beforeEach(() => {
  db.exec('DELETE FROM users;');
});

describe('findByTelegramId', () => {
  it('returns undefined when the user does not exist', () => {
    expect(findByTelegramId(999)).toBeUndefined();
  });

  it('returns the user when they exist', () => {
    db.prepare('INSERT INTO users (telegram_id) VALUES (?)').run(42);
    const user = findByTelegramId(42);
    expect(user).toBeDefined();
    expect(user!.telegramId).toBe(42);
    expect(user!.id).toBeGreaterThan(0);
    expect(user!.createdAt).toBeDefined();
  });
});

describe('insert', () => {
  it('inserts a new user and returns it with an id', () => {
    const user = insert(100);
    expect(user.telegramId).toBe(100);
    expect(user.id).toBeGreaterThan(0);
  });

  it('the inserted user can be found afterwards', () => {
    insert(200);
    expect(findByTelegramId(200)).toBeDefined();
  });

  it('assigns unique ids to different users', () => {
    const a = insert(300);
    const b = insert(301);
    expect(a.id).not.toBe(b.id);
  });
});
