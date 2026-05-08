import { eventBus } from '../../../src/events';
import { registerHistorySubscriptions } from '../../../src/modules/history/subscriptions';

let logSpy: jest.SpyInstance;

beforeAll(() => {
  registerHistorySubscriptions();
});

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('registerHistorySubscriptions', () => {
  it('logs on MessageReceived event', () => {
    eventBus.emit('MessageReceived', { userId: 1, role: 'user', content: 'hi' });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('MessageReceived')
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('userId=1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('role=user'));
  });

  it('logs on ResponseGenerated event', () => {
    eventBus.emit('ResponseGenerated', { userId: 2, content: 'reply' });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('ResponseGenerated')
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('userId=2'));
  });

  it('logs on UserCreated event', () => {
    eventBus.emit('UserCreated', { userId: 5, telegramId: 999 });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('UserCreated')
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('userId=5'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('telegramId=999'));
  });
});
