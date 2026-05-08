const mockAddMessage = jest.fn();
const mockEmit = jest.fn();
const mockSummarizeIfNeeded = jest.fn().mockResolvedValue(undefined);
const mockRunAgent = jest.fn();

jest.mock('../../../src/modules/history', () => ({ addMessage: mockAddMessage }));
jest.mock('../../../src/events', () => ({ eventBus: { emit: mockEmit, on: jest.fn(), off: jest.fn() } }));
jest.mock('../../../src/modules/chat/agent', () => ({ runAgent: mockRunAgent }));
jest.mock('../../../src/modules/chat/summarizer', () => ({
  summarizeIfNeeded: mockSummarizeIfNeeded,
  forceSummarize: jest.fn(),
}));

import { processMessage } from '../../../src/modules/chat';

const USER_ID = 1;

beforeEach(() => jest.clearAllMocks());

describe('processMessage', () => {
  it('saves the user message before running the agent', async () => {
    mockRunAgent.mockResolvedValue('reply');
    await processMessage(USER_ID, 'hello');
    expect(mockAddMessage).toHaveBeenCalledWith(USER_ID, 'user', 'hello');
    expect(mockAddMessage.mock.calls[0]).toEqual([USER_ID, 'user', 'hello']);
  });

  it('emits MessageReceived event', async () => {
    mockRunAgent.mockResolvedValue('reply');
    await processMessage(USER_ID, 'hello');
    expect(mockEmit).toHaveBeenCalledWith('MessageReceived', {
      userId: USER_ID,
      role: 'user',
      content: 'hello',
    });
  });

  it('runs summarizeIfNeeded before and after the agent', async () => {
    mockRunAgent.mockResolvedValue('reply');
    await processMessage(USER_ID, 'hello');
    expect(mockSummarizeIfNeeded).toHaveBeenCalledTimes(2);
    expect(mockSummarizeIfNeeded).toHaveBeenCalledWith(USER_ID);
  });

  it('runs the agent with the user message and userId', async () => {
    mockRunAgent.mockResolvedValue('agent reply');
    await processMessage(USER_ID, 'what time is it?');
    expect(mockRunAgent).toHaveBeenCalledWith('what time is it?', USER_ID);
  });

  it('saves the assistant reply', async () => {
    mockRunAgent.mockResolvedValue('agent reply');
    await processMessage(USER_ID, 'hi');
    expect(mockAddMessage).toHaveBeenCalledWith(USER_ID, 'assistant', 'agent reply');
  });

  it('emits ResponseGenerated event with the reply', async () => {
    mockRunAgent.mockResolvedValue('agent reply');
    await processMessage(USER_ID, 'hi');
    expect(mockEmit).toHaveBeenCalledWith('ResponseGenerated', {
      userId: USER_ID,
      content: 'agent reply',
    });
  });

  it('returns the agent reply', async () => {
    mockRunAgent.mockResolvedValue('final answer');
    expect(await processMessage(USER_ID, 'test')).toBe('final answer');
  });
});
