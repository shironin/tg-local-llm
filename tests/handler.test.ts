jest.mock('node-telegram-bot-api');
jest.mock('../src/modules/users', () => ({ getOrCreateUser: jest.fn() }));
jest.mock('../src/modules/history', () => ({
  getHistory: jest.fn(),
  clearHistory: jest.fn(),
}));
jest.mock('../src/modules/chat', () => ({
  processMessage: jest.fn(),
  forceSummarize: jest.fn(),
}));
jest.mock('../src/logger', () => ({ logHistory: jest.fn() }));

import { registerHandlers } from '../src/handler';
import { getOrCreateUser } from '../src/modules/users';
import { getHistory, clearHistory } from '../src/modules/history';
import { processMessage, forceSummarize } from '../src/modules/chat';

const mockGetOrCreateUser = getOrCreateUser as jest.Mock;
const mockGetHistory = getHistory as jest.Mock;
const mockClearHistory = clearHistory as jest.Mock;
const mockProcessMessage = processMessage as jest.Mock;
const mockForceSummarize = forceSummarize as jest.Mock;

const handlers: Record<string, Function> = {};
const mockBot = {
  on: jest.fn((event: string, handler: Function) => {
    handlers[event] = handler;
  }),
  sendMessage: jest.fn().mockResolvedValue({}),
  sendChatAction: jest.fn().mockResolvedValue({}),
};

const USER = { id: 10, telegramId: 123, createdAt: '' };
const CHAT_ID = 123;

beforeAll(() => {
  registerHandlers(mockBot as any);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOrCreateUser.mockReturnValue(USER);
  mockBot.sendMessage.mockResolvedValue({});
  mockBot.sendChatAction.mockResolvedValue({});
});

afterAll(() => jest.restoreAllMocks());

async function sendMessage(text: string) {
  await handlers['message']({ chat: { id: CHAT_ID }, text });
}

describe('/history command', () => {
  it('sends "No conversation history yet." when history is empty', async () => {
    mockGetHistory.mockReturnValue([]);
    await sendMessage('/history');
    expect(mockBot.sendMessage).toHaveBeenCalledWith(CHAT_ID, 'No conversation history yet.');
  });

  it('sends formatted history when messages exist', async () => {
    mockGetHistory.mockReturnValue([
      { role: 'user', content: 'hello', isHistory: false },
      { role: 'assistant', content: 'hi', isHistory: false },
    ]);
    await sendMessage('/history');
    const [, text] = mockBot.sendMessage.mock.calls[0];
    expect(text).toContain('[You] hello');
    expect(text).toContain('[Bot] hi');
    expect(text).toContain('Context: 2 message(s)');
  });

  it('includes summary markers for isHistory messages', async () => {
    mockGetHistory.mockReturnValue([
      { role: 'system', content: 'old stuff', isHistory: true },
      { role: 'user', content: 'new', isHistory: false },
    ]);
    await sendMessage('/history');
    const [, text] = mockBot.sendMessage.mock.calls[0];
    expect(text).toContain('--- Summary ---');
    expect(text).toContain('+ summary');
  });
});

describe('/summarize command', () => {
  it('sends "Nothing to summarize yet." when no real messages exist', async () => {
    mockGetHistory.mockReturnValue([]);
    await sendMessage('/summarize');
    expect(mockBot.sendMessage).toHaveBeenCalledWith(CHAT_ID, 'Nothing to summarize yet.');
  });

  it('sends summarized count on success', async () => {
    mockGetHistory.mockReturnValue([{ role: 'user', content: 'hi', isHistory: false }]);
    mockForceSummarize.mockResolvedValue({ summarized: 3 });
    await sendMessage('/summarize');
    expect(mockBot.sendMessage).toHaveBeenCalledWith(CHAT_ID, 'Done. Summarized 3 message(s).');
  });

  it('sends error message when forceSummarize throws', async () => {
    mockGetHistory.mockReturnValue([{ role: 'user', content: 'hi', isHistory: false }]);
    mockForceSummarize.mockRejectedValue(new Error('LLM down'));
    await sendMessage('/summarize');
    expect(mockBot.sendMessage).toHaveBeenCalledWith(CHAT_ID, 'Summarization failed: LLM down');
  });
});

describe('/clear command', () => {
  it('clears history and sends confirmation', async () => {
    await sendMessage('/clear');
    expect(mockClearHistory).toHaveBeenCalledWith(USER.id);
    expect(mockBot.sendMessage).toHaveBeenCalledWith(CHAT_ID, 'Conversation history cleared.');
  });
});

describe('normal message', () => {
  it('calls processMessage and sends the reply', async () => {
    mockGetHistory.mockReturnValue([]);
    mockProcessMessage.mockResolvedValue('great answer');
    await sendMessage('what is 2+2?');
    expect(mockProcessMessage).toHaveBeenCalledWith(USER.id, 'what is 2+2?');
    expect(mockBot.sendMessage).toHaveBeenCalledWith(CHAT_ID, 'great answer');
  });

  it('sends error message when processMessage throws', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetHistory.mockReturnValue([]);
    mockProcessMessage.mockRejectedValue(new Error('model crash'));
    await sendMessage('hello');
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      CHAT_ID,
      'Something went wrong:\nmodel crash'
    );
    errSpy.mockRestore();
  });

  it('ignores messages with no text', async () => {
    await handlers['message']({ chat: { id: CHAT_ID }, text: undefined });
    expect(mockProcessMessage).not.toHaveBeenCalled();
    expect(mockBot.sendMessage).not.toHaveBeenCalled();
  });
});

describe('polling_error', () => {
  it('logs the error', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    handlers['polling_error'](new Error('connection reset'));
    expect(errSpy).toHaveBeenCalledWith('[Polling] Error:', 'connection reset');
    errSpy.mockRestore();
  });
});
