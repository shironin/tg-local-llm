import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-llm-db-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.DB_PATH;
});

describe('db module initialization', () => {
  it('creates users and chat_history tables', () => {
    process.env.DB_PATH = tmpDir;
    let db: any;
    jest.isolateModules(() => {
      db = require('../src/db').default;
    });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain('users');
    expect(tables).toContain('chat_history');
  });

  it('creates the database file at DB_PATH/history.db', () => {
    process.env.DB_PATH = tmpDir;
    jest.isolateModules(() => {
      require('../src/db');
    });
    expect(fs.existsSync(path.join(tmpDir, 'history.db'))).toBe(true);
  });

  it('uses DB_PATH env variable for the data directory', () => {
    const subDir = path.join(tmpDir, 'custom');
    process.env.DB_PATH = subDir;
    jest.isolateModules(() => {
      require('../src/db');
    });
    expect(fs.existsSync(path.join(subDir, 'history.db'))).toBe(true);
  });

  it('calls process.exit(1) when directory creation fails', () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => { throw new Error('process.exit'); });
    jest.isolateModules(() => {
      jest.doMock('fs', () => ({
        ...jest.requireActual('fs'),
        mkdirSync: () => { throw new Error('EACCES: permission denied'); },
      }));
      expect(() => require('../src/db')).toThrow('process.exit');
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('calls process.exit(1) when opening the database fails', () => {
    process.env.DB_PATH = tmpDir;
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => { throw new Error('process.exit'); });
    jest.isolateModules(() => {
      jest.doMock('better-sqlite3', () =>
        jest.fn(() => { throw new Error('database is locked'); })
      );
      expect(() => require('../src/db')).toThrow('process.exit');
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
