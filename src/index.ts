import { createBot } from './bot';
import { registerHandlers } from './handler';

const bot = createBot();
registerHandlers(bot);

process.once('SIGINT', () => {
  console.log('\n[Bot] Shutting down...');
  bot.stopPolling();
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('\n[Bot] Shutting down...');
  bot.stopPolling();
  process.exit(0);
});
