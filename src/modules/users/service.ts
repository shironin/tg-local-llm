import * as repository from './repository';
import { eventBus } from '../../events';
import { User } from './types';

export function getOrCreateUser(telegramId: number): User {
  const existing = repository.findByTelegramId(telegramId);
  if (existing) return existing;

  const user = repository.insert(telegramId);
  eventBus.emit('UserCreated', { userId: user.id, telegramId });
  return user;
}
