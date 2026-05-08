const mockFindByTelegramId = jest.fn();
const mockInsert = jest.fn();
const mockEmit = jest.fn();

jest.mock('../../../src/modules/users/repository', () => ({
  findByTelegramId: mockFindByTelegramId,
  insert: mockInsert,
}));
jest.mock('../../../src/events', () => ({
  eventBus: { emit: mockEmit, on: jest.fn(), off: jest.fn() },
}));

import { getOrCreateUser } from '../../../src/modules/users';

const EXISTING_USER = { id: 1, telegramId: 123, createdAt: '2024-01-01' };
const NEW_USER = { id: 2, telegramId: 456, createdAt: '2024-01-02' };

beforeEach(() => jest.clearAllMocks());

describe('getOrCreateUser', () => {
  it('returns the existing user without inserting', () => {
    mockFindByTelegramId.mockReturnValue(EXISTING_USER);
    const result = getOrCreateUser(123);
    expect(result).toBe(EXISTING_USER);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('does not emit an event for an existing user', () => {
    mockFindByTelegramId.mockReturnValue(EXISTING_USER);
    getOrCreateUser(123);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('inserts a new user when not found', () => {
    mockFindByTelegramId.mockReturnValue(undefined);
    mockInsert.mockReturnValue(NEW_USER);
    const result = getOrCreateUser(456);
    expect(mockInsert).toHaveBeenCalledWith(456);
    expect(result).toBe(NEW_USER);
  });

  it('emits UserCreated event when a new user is created', () => {
    mockFindByTelegramId.mockReturnValue(undefined);
    mockInsert.mockReturnValue(NEW_USER);
    getOrCreateUser(456);
    expect(mockEmit).toHaveBeenCalledWith('UserCreated', {
      userId: NEW_USER.id,
      telegramId: NEW_USER.telegramId,
    });
  });
});
