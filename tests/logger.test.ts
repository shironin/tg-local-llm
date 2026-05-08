import { logger, runWithTrace, getTraceId, logHistory, logSummary } from '../src/logger';
import type { Message } from '../src/modules/history';

function parseLastEntry(lines: string[]): Record<string, unknown> {
  return JSON.parse(lines[lines.length - 1]);
}

describe('logger', () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));
  });

  afterEach(() => jest.restoreAllMocks());

  it('outputs valid JSON', () => {
    logger.info('test');
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it('includes all required fields', () => {
    logger.info('hello');
    const entry = parseLastEntry(lines);
    expect(entry.timestamp).toBeDefined();
    expect(entry.level).toBe('INFO');
    expect(entry.service).toBe('tg-local-llm');
    expect(entry.trace_id).toBeDefined();
    expect(entry.message).toBe('hello');
  });

  it('logger.info emits level INFO', () => {
    logger.info('msg');
    expect(parseLastEntry(lines).level).toBe('INFO');
  });

  it('logger.warn emits level WARN', () => {
    logger.warn('msg');
    expect(parseLastEntry(lines).level).toBe('WARN');
  });

  it('logger.error emits level ERROR', () => {
    logger.error('msg');
    expect(parseLastEntry(lines).level).toBe('ERROR');
  });

  it('logger.debug emits level DEBUG', () => {
    logger.debug('msg');
    expect(parseLastEntry(lines).level).toBe('DEBUG');
  });

  it('merges extra context fields into the log entry', () => {
    logger.info('ctx test', { user_id: 42, chat_id: 99 });
    const entry = parseLastEntry(lines);
    expect(entry.user_id).toBe(42);
    expect(entry.chat_id).toBe(99);
  });

  it('uses "no-trace" when outside runWithTrace', () => {
    logger.info('no trace');
    expect(parseLastEntry(lines).trace_id).toBe('no-trace');
  });

  it('propagates trace_id inside runWithTrace', () => {
    runWithTrace('abc-123', () => {
      logger.info('traced');
    });
    expect(parseLastEntry(lines).trace_id).toBe('abc-123');
  });

  it('restores "no-trace" after runWithTrace exits', () => {
    runWithTrace('inner', () => {});
    logger.info('after');
    expect(parseLastEntry(lines).trace_id).toBe('no-trace');
  });
});

describe('getTraceId', () => {
  it('returns "no-trace" outside any context', () => {
    expect(getTraceId()).toBe('no-trace');
  });

  it('returns the active trace_id inside runWithTrace', () => {
    runWithTrace('xyz-789', () => {
      expect(getTraceId()).toBe('xyz-789');
    });
  });
});

describe('logHistory', () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));
  });

  afterEach(() => jest.restoreAllMocks());

  it('emits a DEBUG log', () => {
    logHistory(1, [], 'test');
    expect(parseLastEntry(lines).level).toBe('DEBUG');
  });

  it('includes user_id, label, message_count, estimated_tokens, and messages array', () => {
    const msgs: Message[] = [{ role: 'user', content: '12345678' }];
    logHistory(42, msgs, 'before');
    const entry = parseLastEntry(lines);
    expect(entry.user_id).toBe(42);
    expect(entry.label).toBe('before');
    expect(entry.message_count).toBe(1);
    expect(entry.estimated_tokens).toBe(2); // ceil(8/4)
    expect(Array.isArray(entry.messages)).toBe(true);
  });

  it('marks history messages with [H] suffix on role', () => {
    const msgs: Message[] = [{ role: 'user', content: 'old', isHistory: true }];
    logHistory(1, msgs, 'test');
    const messages = parseLastEntry(lines).messages as Array<{ role: string }>;
    expect(messages[0].role).toBe('user[H]');
  });

  it('does not add [H] suffix for non-history messages', () => {
    const msgs: Message[] = [{ role: 'assistant', content: 'hi' }];
    logHistory(1, msgs, 'test');
    const messages = parseLastEntry(lines).messages as Array<{ role: string }>;
    expect(messages[0].role).toBe('assistant');
  });

  it('truncates content longer than 200 characters', () => {
    const msgs: Message[] = [{ role: 'user', content: 'a'.repeat(300) }];
    logHistory(1, msgs, 'test');
    const messages = parseLastEntry(lines).messages as Array<{ content: string }>;
    expect(messages[0].content).toHaveLength(200); // 199 chars + '…'
    expect(messages[0].content.endsWith('…')).toBe(true);
  });

  it('does not truncate content within 200 characters', () => {
    const msgs: Message[] = [{ role: 'user', content: 'short' }];
    logHistory(1, msgs, 'test');
    const messages = parseLastEntry(lines).messages as Array<{ content: string }>;
    expect(messages[0].content).toBe('short');
  });

  it('handles empty history without throwing', () => {
    expect(() => logHistory(1, [], 'empty')).not.toThrow();
  });

  it('estimates tokens as ceil(total_chars / 4)', () => {
    const msgs: Message[] = [{ role: 'user', content: '1234567890' }]; // 10 chars → ceil(10/4) = 3
    logHistory(1, msgs, 'test');
    expect(parseLastEntry(lines).estimated_tokens).toBe(3);
  });
});

describe('logSummary', () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));
  });

  afterEach(() => jest.restoreAllMocks());

  it('emits a DEBUG log', () => {
    logSummary(1, 'summary text');
    expect(parseLastEntry(lines).level).toBe('DEBUG');
  });

  it('includes user_id and the full summary text', () => {
    logSummary(7, 'my summary');
    const entry = parseLastEntry(lines);
    expect(entry.user_id).toBe(7);
    expect(entry.summary).toBe('my summary');
  });

  it('handles an empty summary without throwing', () => {
    expect(() => logSummary(1, '')).not.toThrow();
  });
});
