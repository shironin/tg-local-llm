import TelegramBot from 'node-telegram-bot-api';
import { askLLM } from './llm';

const TYPING_INTERVAL_MS = 4000;

export function registerHandlers(bot: TelegramBot): void {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (!text) return;

    console.log(`[Handler] Message from ${chatId}: ${text.slice(0, 80)}`);

    // Keep the "typing..." indicator alive while waiting for the LLM
    const typingInterval = setInterval(() => {
      bot.sendChatAction(chatId, 'typing').catch(() => {});
    }, TYPING_INTERVAL_MS);

    try {
      await bot.sendChatAction(chatId, 'typing');
      const reply = await askLLM(text);
      await bot.sendMessage(chatId, reply);
      console.log(`[Handler] Reply sent to ${chatId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error(`[Handler] Error for chat ${chatId}:`, message);
      await bot.sendMessage(chatId, `Something went wrong:\n${message}`).catch(() => {});
    } finally {
      clearInterval(typingInterval);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[Polling] Error:', err.message);
  });
}
