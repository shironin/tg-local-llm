import { readFileSync } from 'fs';
import { join } from 'path';
import TelegramBot from 'node-telegram-bot-api';
import { askLLM } from './llm';
import { addMessage, clearHistory, getHistory, getRows, Message, MessageRole, performRollingSummarize } from './context';
import { config } from './config';
import { logHistory, logSummary } from './logger';

const SUMMARIZE_PROMPT = readFileSync(join(__dirname, '..', 'prompts', 'summarize.md'), 'utf8').trim();

const TYPING_INTERVAL_MS = 4000;

async function summarizeIfNeeded(chatId: number): Promise<void> {
  const rows = getRows(chatId);
  if (rows.length <= config.memThreshold) return;

  const summaryRow = rows.find((r) => r.role === 'summary');
  const messageRows = rows.filter((r) => r.role !== 'summary');

  // Segment A: older messages to archive; Segment B: recent messages to keep raw
  const segmentA = messageRows.slice(0, messageRows.length - config.memShortTermSize);
  const segmentB = messageRows.slice(-config.memShortTermSize);

  // Build summarization context: existing summary (if any) + segment A + prompt
  const context: Message[] = [];
  if (summaryRow) context.push({ role: 'system', content: summaryRow.content, isHistory: true });
  context.push(...segmentA.map((r) => ({ role: r.role as MessageRole, content: r.content })));

  logHistory(chatId, context, `Summarizing ${segmentA.length} messages`);
  const newSummary = await askLLM([...context, { role: 'user', content: SUMMARIZE_PROMPT }]);
  logSummary(chatId, newSummary);

  performRollingSummarize(chatId, segmentB, newSummary);
}

async function handleHistory(bot: TelegramBot, chatId: number): Promise<void> {
  const history = getHistory(chatId);
  if (history.length === 0) {
    await bot.sendMessage(chatId, 'No conversation history yet.');
    return;
  }

  const lines: string[] = [];
  let messageCount = 0;

  for (const msg of history) {
    if (msg.isHistory) {
      lines.push('--- Summary ---', msg.content, '--- End of summary ---', '');
    } else {
      messageCount++;
      const label = msg.role === 'user' ? 'You' : 'Bot';
      lines.push(`[${label}] ${msg.content}`);
    }
  }

  const header = `Context: ${messageCount} message(s)${history.some((m) => m.isHistory) ? ' + summary' : ''}`;
  await bot.sendMessage(chatId, [header, '', ...lines].join('\n'), { parse_mode: undefined });
}

async function handleForceSummarize(bot: TelegramBot, chatId: number): Promise<void> {
  const rows = getRows(chatId);
  const summaryRow = rows.find((r) => r.role === 'summary');
  const messageRows = rows.filter((r) => r.role !== 'summary');

  if (messageRows.length === 0) {
    await bot.sendMessage(chatId, 'Nothing to summarize yet.');
    return;
  }

  // Apply the same split; if not enough messages to split, archive everything
  const segmentA = messageRows.length > config.memShortTermSize
    ? messageRows.slice(0, messageRows.length - config.memShortTermSize)
    : messageRows;
  const segmentB = messageRows.length > config.memShortTermSize
    ? messageRows.slice(-config.memShortTermSize)
    : [];

  await bot.sendChatAction(chatId, 'typing');

  const context: Message[] = [];
  if (summaryRow) context.push({ role: 'system', content: summaryRow.content, isHistory: true });
  context.push(...segmentA.map((r) => ({ role: r.role as MessageRole, content: r.content })));

  logHistory(chatId, context, `Force-summarizing ${segmentA.length} messages`);
  const newSummary = await askLLM([...context, { role: 'user', content: SUMMARIZE_PROMPT }]);
  logSummary(chatId, newSummary);

  performRollingSummarize(chatId, segmentB, newSummary);
  await bot.sendMessage(chatId, `Done. Summarized ${segmentA.length} message(s).`);
}

export function registerHandlers(bot: TelegramBot): void {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (!text) return;

    console.log(`[Handler] Message from ${chatId}: ${text.slice(0, 80)}`);

    if (text === '/history') {
      await handleHistory(bot, chatId).catch((err) => {
        console.error(`[Handler] /history error for ${chatId}:`, err);
      });
      return;
    }

    if (text === '/summarize') {
      await handleForceSummarize(bot, chatId).catch((err) => {
        console.error(`[Handler] /summarize error for ${chatId}:`, err);
      });
      return;
    }

    if (text === '/clear') {
      clearHistory(chatId);
      await bot.sendMessage(chatId, 'Conversation history cleared.');
      return;
    }

    const typingInterval = setInterval(() => {
      bot.sendChatAction(chatId, 'typing').catch(() => {});
    }, TYPING_INTERVAL_MS);

    try {
      await bot.sendChatAction(chatId, 'typing');

      addMessage(chatId, 'user', text);
      await summarizeIfNeeded(chatId);

      const history = getHistory(chatId);
      logHistory(chatId, history, 'Sending to LLM');

      const messages = config.contextSystemPrompt
        ? [{ role: 'system' as const, content: config.contextSystemPrompt }, ...history]
        : history;

      const reply = await askLLM(messages);

      addMessage(chatId, 'assistant', reply);
      await summarizeIfNeeded(chatId);

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
