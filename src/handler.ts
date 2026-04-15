import TelegramBot from 'node-telegram-bot-api';
import { askLLM } from './llm';
import { addMessage, getHistory, replaceMessagesWithSummary } from './context';
import { config } from './config';
import { logHistory, logSummary } from './logger';

const TYPING_INTERVAL_MS = 4000;

async function summarizeIfNeeded(chatId: number): Promise<void> {
  const history = getHistory(chatId);

  // Find where the last summary ends (start of the unsummarized tail)
  let tailStart = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].isHistory) {
      tailStart = i + 1;
      break;
    }
  }

  const tail = history.slice(tailStart);

  if (tail.length < config.contextMessagesBeforeSummarize) return;

  logHistory(chatId, tail, `Summarizing ${tail.length} messages`);

  const summary = await askLLM([
    ...tail,
    { role: 'user', content: config.contextSummarizePrompt },
  ]);

  logSummary(chatId, summary);
  replaceMessagesWithSummary(chatId, tailStart, summary);
}

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

      // Summarize accumulated history before appending the new message,
      // so the user's question is never swallowed into the summary batch.
      await summarizeIfNeeded(chatId);

      // Store the incoming user message
      addMessage(chatId, 'user', text, config.contextLastXMessages);

      const history = getHistory(chatId);
      logHistory(chatId, history, 'Sending to LLM');

      const messages = config.contextSystemPrompt
        ? [{ role: 'system' as const, content: config.contextSystemPrompt }, ...history]
        : history;

      const reply = await askLLM(messages);

      // Store the assistant's reply in context
      addMessage(chatId, 'assistant', reply, config.contextLastXMessages);

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
