import './sentry'; // must be first — Sentry instruments Node internals at load time
import { createBot } from './bot';
import { registerHandlers } from './handler';
import { registerHistorySubscriptions } from './modules/history/subscriptions';
import { logger } from './logger';
import { captureException } from './sentry';

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  captureException(err);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled rejection', { error: err.message, stack: err.stack });
  captureException(err);
});

registerHistorySubscriptions();

const bot = createBot();
registerHandlers(bot);

process.once('SIGINT', () => {
  logger.info('Bot shutting down', { signal: 'SIGINT' });
  bot.stopPolling();
  process.exit(0);
});

process.once('SIGTERM', () => {
  logger.info('Bot shutting down', { signal: 'SIGTERM' });
  bot.stopPolling();
  process.exit(0);
});
