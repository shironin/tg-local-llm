jest.mock('node-telegram-bot-api');

import TelegramBot from 'node-telegram-bot-api';
import { createBot } from '../src/bot';

const MockTelegramBot = TelegramBot as jest.MockedClass<typeof TelegramBot>;

describe('createBot', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('creates TelegramBot with the configured token and polling enabled', () => {
    createBot();
    expect(MockTelegramBot).toHaveBeenCalledWith('test-token', { polling: true });
  });

  it('logs startup message', () => {
    createBot();
    expect(console.log).toHaveBeenCalledWith('[Bot] Polling started');
  });

  it('returns the created bot instance', () => {
    const mockInstance = {};
    MockTelegramBot.mockImplementationOnce(() => mockInstance as any);
    const result = createBot();
    expect(result).toBe(mockInstance);
  });
});
