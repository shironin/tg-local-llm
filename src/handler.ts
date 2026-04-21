import TelegramBot from 'node-telegram-bot-api';
import { getOrCreateUser } from './modules/users';
import { getHistory, clearHistory } from './modules/history';
import { processMessage, forceSummarize } from './modules/chat';
import { logHistory } from './logger';

const TYPING_INTERVAL_MS = 4000;

async function handleHistory(bot: TelegramBot, userId: number, chatId: number): Promise<void> {
  const history = getHistory(userId);
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

async function handleForceSummarize(bot: TelegramBot, userId: number, chatId: number): Promise<void> {
  const history = getHistory(userId);
  if (history.filter((m) => !m.isHistory).length === 0) {
    await bot.sendMessage(chatId, 'Nothing to summarize yet.');
    return;
  }

  await bot.sendChatAction(chatId, 'typing');

  try {
    const { summarized } = await forceSummarize(userId);
    await bot.sendMessage(chatId, `Done. Summarized ${summarized} message(s).`);
  } catch (err) {
    await bot.sendMessage(chatId, `Summarization failed: ${err instanceof Error ? err.message : err}`);
  }
}

export function registerHandlers(bot: TelegramBot): void {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (!text) return;

    const user = getOrCreateUser(chatId);

    console.log(`[Handler] Message from chatId=${chatId} userId=${user.id}: ${text.slice(0, 80)}`);

    if (text === '/history') {
      await handleHistory(bot, user.id, chatId).catch((err) => {
        console.error(`[Handler] /history error for ${chatId}:`, err);
      });
      return;
    }

    if (text === '/summarize') {
      await handleForceSummarize(bot, user.id, chatId).catch((err) => {
        console.error(`[Handler] /summarize error for ${chatId}:`, err);
      });
      return;
    }

    if (text === '/clear') {
      clearHistory(user.id);
      await bot.sendMessage(chatId, 'Conversation history cleared.');
      return;
    }

    const typingInterval = setInterval(() => {
      bot.sendChatAction(chatId, 'typing').catch(() => {});
    }, TYPING_INTERVAL_MS);

    try {
      await bot.sendChatAction(chatId, 'typing');

      const history = getHistory(user.id);
      logHistory(user.id, history, 'Running agent');

      const agentStart = Date.now();
      const reply = await processMessage(user.id, text);
      const elapsed = ((Date.now() - agentStart) / 1000).toFixed(1);

      await bot.sendMessage(chatId, reply);
      console.log(`[Handler] Reply sent to chatId=${chatId} (${elapsed}s)`);
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
