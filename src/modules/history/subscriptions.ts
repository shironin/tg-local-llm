import { eventBus } from '../../events';
import * as repository from './repository';

export function registerHistorySubscriptions(): void {
  eventBus.on('MessageReceived', ({ userId, role, content }) => {
    console.log(`[History] MessageReceived — userId=${userId} role=${role}`);
  });

  eventBus.on('ResponseGenerated', ({ userId, content }) => {
    console.log(`[History] ResponseGenerated — userId=${userId}`);
  });

  eventBus.on('UserCreated', ({ userId, telegramId }) => {
    console.log(`[History] UserCreated — userId=${userId} telegramId=${telegramId}`);
  });
}
