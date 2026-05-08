const mockAskLLMShort = jest.fn();
const mockGetRows = jest.fn();
const mockPerformRollingSummarize = jest.fn();
const mockLogSummary = jest.fn();

jest.mock('../../../src/modules/chat/llm', () => ({ askLLMShort: mockAskLLMShort }));
jest.mock('../../../src/modules/history', () => ({
  getRows: mockGetRows,
  performRollingSummarize: mockPerformRollingSummarize,
}));
jest.mock('../../../src/logger', () => ({
  logSummary: mockLogSummary,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { summarizeIfNeeded, forceSummarize } from '../../../src/modules/chat/summarizer';

const USER_ID = 1;

// MEM_THRESHOLD=15, MEM_SHORT_TERM_SIZE=5 (set in tests/setup.ts)

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    role: 'user',
    content: `msg ${i}`,
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => jest.restoreAllMocks());

describe('summarizeIfNeeded', () => {
  it('does nothing when row count is at or below the threshold', async () => {
    mockGetRows.mockReturnValue(makeRows(15));
    await summarizeIfNeeded(USER_ID);
    expect(mockAskLLMShort).not.toHaveBeenCalled();
  });

  it('summarizes when row count exceeds the threshold', async () => {
    mockGetRows.mockReturnValue(makeRows(16));
    mockAskLLMShort.mockResolvedValue('the summary');
    await summarizeIfNeeded(USER_ID);
    expect(mockAskLLMShort).toHaveBeenCalledTimes(1);
    expect(mockPerformRollingSummarize).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Array),
      'the summary'
    );
  });

  it('includes existing summary row content in the prompt as prior summary', async () => {
    const rows = [
      { id: 1, role: 'summary', content: 'old recap' },
      ...makeRows(16),
    ];
    mockGetRows.mockReturnValue(rows);
    mockAskLLMShort.mockResolvedValue('updated summary');
    await summarizeIfNeeded(USER_ID);
    const payload = mockAskLLMShort.mock.calls[0][0][0].content as string;
    expect(payload).toContain('old recap');
  });

  it('keeps the short-term messages out of the summarized segment', async () => {
    mockGetRows.mockReturnValue(makeRows(16)); // 16 messages, last 5 are short-term
    mockAskLLMShort.mockResolvedValue('new summary');
    await summarizeIfNeeded(USER_ID);
    const [, freshMessages] = mockPerformRollingSummarize.mock.calls[0];
    expect(freshMessages).toHaveLength(5);
  });

  it('skips gracefully when the LLM throws', async () => {
    mockGetRows.mockReturnValue(makeRows(20));
    mockAskLLMShort.mockRejectedValue(new Error('LLM down'));
    await expect(summarizeIfNeeded(USER_ID)).resolves.toBeUndefined();
    expect(mockPerformRollingSummarize).not.toHaveBeenCalled();
  });
});

describe('forceSummarize', () => {
  it('returns the count of summarized messages', async () => {
    mockGetRows.mockReturnValue(makeRows(10)); // 10 messages, short-term=5 → summarize 5
    mockAskLLMShort.mockResolvedValue('force summary');
    const result = await forceSummarize(USER_ID);
    expect(result.summarized).toBe(5);
  });

  it('summarizes all messages when count <= short-term size', async () => {
    mockGetRows.mockReturnValue(makeRows(3));
    mockAskLLMShort.mockResolvedValue('summary');
    const result = await forceSummarize(USER_ID);
    expect(result.summarized).toBe(3);
  });

  it('calls performRollingSummarize with the summary and fresh segment', async () => {
    mockGetRows.mockReturnValue(makeRows(10));
    mockAskLLMShort.mockResolvedValue('force summary');
    await forceSummarize(USER_ID);
    expect(mockPerformRollingSummarize).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Array),
      'force summary'
    );
  });

  it('calls logSummary with the new summary', async () => {
    mockGetRows.mockReturnValue(makeRows(6));
    mockAskLLMShort.mockResolvedValue('the summary text');
    await forceSummarize(USER_ID);
    expect(mockLogSummary).toHaveBeenCalledWith(USER_ID, 'the summary text');
  });
});
