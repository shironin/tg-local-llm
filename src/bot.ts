import TelegramBot from 'node-telegram-bot-api';
import { config } from './config';

export function createBot(): TelegramBot {
  const bot = new TelegramBot(config.telegramToken, { polling: true });
  console.log('[Bot] Polling started');
  return bot;
}
