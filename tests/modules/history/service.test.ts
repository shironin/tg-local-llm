jest.mock('../../../src/modules/history/repository');

import * as repository from '../../../src/modules/history/repository';
import {
  getHistory,
  getRows,
  addMessage,
  clearHistory,
  performRollingSummarize,
} from '../../../src/modules/history';

const mockRepo = repository as jest.Mocked<typeof repository>;

const USER_ID = 1;

beforeEach(() => jest.clearAllMocks());

describe('getHistory', () => {
  it('delegates to repository.getHistory and returns its result', () => {
    const messages = [{ role: 'user' as const, content: 'hi' }];
    mockRepo.getHistory.mockReturnValue(messages);
    expect(getHistory(USER_ID)).toBe(messages);
    expect(mockRepo.getHistory).toHaveBeenCalledWith(USER_ID);
  });
});

describe('getRows', () => {
  it('delegates to repository.getRows and returns its result', () => {
    const rows = [{ id: 1, role: 'user', content: 'hi' }];
    mockRepo.getRows.mockReturnValue(rows);
    expect(getRows(USER_ID)).toBe(rows);
    expect(mockRepo.getRows).toHaveBeenCalledWith(USER_ID);
  });
});

describe('addMessage', () => {
  it('delegates to repository.addMessage', () => {
    addMessage(USER_ID, 'user', 'hello');
    expect(mockRepo.addMessage).toHaveBeenCalledWith(USER_ID, 'user', 'hello');
  });
});

describe('clearHistory', () => {
  it('delegates to repository.clearHistory', () => {
    clearHistory(USER_ID);
    expect(mockRepo.clearHistory).toHaveBeenCalledWith(USER_ID);
  });
});

describe('performRollingSummarize', () => {
  it('delegates to repository.performRollingSummarize', () => {
    const fresh = [{ role: 'user', content: 'new' }];
    performRollingSummarize(USER_ID, fresh, 'summary text');
    expect(mockRepo.performRollingSummarize).toHaveBeenCalledWith(USER_ID, fresh, 'summary text');
  });
});
