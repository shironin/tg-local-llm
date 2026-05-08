import { logHistory, logSummary } from '../src/logger';
import type { Message } from '../src/modules/history';

const CONTENT_COL = 72;

describe('logHistory', () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => {
      lines.push(args.join(' '));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('prints a header line with user id, message count, and token estimate', () => {
    const msgs: Message[] = [{ role: 'user', content: 'hello' }];
    logHistory(42, msgs, 'before');
    const header = lines.find((l) => l.includes('[Context]'))!;
    expect(header).toContain('user 42');
    expect(header).toContain('1 message');
    expect(header).toContain('~2 tokens');
  });

  it('uses plural "messages" when count is not 1', () => {
    const msgs: Message[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    logHistory(1, msgs, 'test');
    const header = lines.find((l) => l.includes('[Context]'))!;
    expect(header).toContain('2 messages');
  });

  it('renders a row for each message with its role', () => {
    const msgs: Message[] = [
      { role: 'user', content: 'ping' },
      { role: 'assistant', content: 'pong' },
    ];
    logHistory(1, msgs, 'test');
    const rows = lines.filter((l) => /^\s+\d+\s│/.test(l));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('user');
    expect(rows[1]).toContain('assistant');
  });

  it('appends [H] tag for history messages', () => {
    const msgs: Message[] = [{ role: 'user', content: 'old', isHistory: true }];
    logHistory(1, msgs, 'test');
    const row = lines.find((l) => /^\s+\d+\s│/.test(l))!;
    expect(row).toContain('[H]');
  });

  it('does not append [H] tag for non-history messages', () => {
    const msgs: Message[] = [{ role: 'user', content: 'new' }];
    logHistory(1, msgs, 'test');
    const row = lines.find((l) => /^\s+\d+\s│/.test(l))!;
    expect(row).not.toContain('[H]');
  });

  it('truncates content longer than CONTENT_COL characters', () => {
    const long = 'a'.repeat(CONTENT_COL + 20);
    const msgs: Message[] = [{ role: 'user', content: long }];
    logHistory(1, msgs, 'test');
    const row = lines.find((l) => /^\s+\d+\s│/.test(l))!;
    expect(row).toContain('…');
    const contentPart = row.split('│')[2];
    expect(contentPart.trim().length).toBeLessThanOrEqual(CONTENT_COL + 1); // +1 for the ellipsis char
  });

  it('collapses newlines in content into spaces', () => {
    const msgs: Message[] = [{ role: 'user', content: 'line1\nline2\nline3' }];
    logHistory(1, msgs, 'test');
    const row = lines.find((l) => /^\s+\d+\s│/.test(l))!;
    expect(row).not.toContain('\n');
    expect(row).toContain('line1 line2 line3');
  });

  it('passes the label through to the header', () => {
    logHistory(1, [], 'my-label');
    const header = lines.find((l) => l.includes('[Context]'))!;
    expect(header).toContain('my-label');
  });

  it('handles an empty history without throwing', () => {
    expect(() => logHistory(1, [], 'empty')).not.toThrow();
  });

  it('estimates tokens as ceil(total_chars / 4)', () => {
    // 8 chars total → 2 tokens
    const msgs: Message[] = [{ role: 'user', content: '12345678' }];
    logHistory(1, msgs, 'test');
    const header = lines.find((l) => l.includes('[Context]'))!;
    expect(header).toContain('~2 tokens');
  });
});

describe('logSummary', () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => {
      lines.push(args.join(' '));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('prints a header line with the user id', () => {
    logSummary(7, 'some summary');
    const header = lines.find((l) => l.includes('[Context]'))!;
    expect(header).toContain('user 7');
  });

  it('prints each non-empty line of the summary indented', () => {
    logSummary(1, 'line one\nline two\nline three');
    const summaryLines = lines.filter((l) => l.startsWith('  '));
    expect(summaryLines).toHaveLength(3);
    expect(summaryLines[0]).toBe('  line one');
    expect(summaryLines[1]).toBe('  line two');
  });

  it('ignores blank lines in the summary', () => {
    logSummary(1, 'a\n\nb');
    const summaryLines = lines.filter((l) => l.startsWith('  '));
    expect(summaryLines).toHaveLength(2);
  });

  it('handles an empty summary without throwing', () => {
    expect(() => logSummary(1, '')).not.toThrow();
  });

  it('prints two divider lines (one before summary, one after)', () => {
    logSummary(1, 'x');
    const dividers = lines.filter((l) => /^─+/.test(l.trim()));
    expect(dividers).toHaveLength(2);
  });
});
