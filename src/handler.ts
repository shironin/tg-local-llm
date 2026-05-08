import { randomUUID } from 'crypto';
import TelegramBot from 'node-telegram-bot-api';
import { getOrCreateUser } from './modules/users';
import { getHistory, clearHistory } from './modules/history';
import { processMessage, forceSummarize } from './modules/chat';
import { logHistory, logger, runWithTrace } from './logger';
import { setSentryContext, captureException } from './sentry';

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
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (!text) return;

    const traceId = randomUUID();

    return runWithTrace(traceId, async () => {
      const user = getOrCreateUser(chatId);
      setSentryContext(traceId, user.id);

      logger.info('Incoming message', { chat_id: chatId, user_id: user.id, text: text.slice(0, 200) });

      if (text === '/history') {
        await handleHistory(bot, user.id, chatId).catch((err) => {
          logger.error('/history command failed', { chat_id: chatId, error: err instanceof Error ? err.message : String(err) });
        });
        return;
      }

      if (text === '/summarize') {
        await handleForceSummarize(bot, user.id, chatId).catch((err) => {
          logger.error('/summarize command failed', { chat_id: chatId, error: err instanceof Error ? err.message : String(err) });
        });
        return;
      }

      if (text === '/clear') {
        clearHistory(user.id);
        logger.info('History cleared', { user_id: user.id });
        await bot.sendMessage(chatId, 'Conversation history cleared.');
        return;
      }

      // /debug_async intentionally throws outside try/catch to exercise uncaughtException handler
      if (text === '/debug_async') {
        setTimeout(() => {
          throw new Error('Async test error — escaped async context');
        }, 100);
        await bot.sendMessage(chatId, 'Async error triggered — check logs in ~100ms.');
        return;
      }

      if (text === '/debug_external') {
        try {
          await fetch('http://localhost:19999/nonexistent', { signal: AbortSignal.timeout(2000) });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.error('External service unavailable', { url: 'http://localhost:19999/nonexistent', error: error.message });
          captureException(error);
          await bot.sendMessage(chatId, `External error captured: ${error.message}`);
        }
        return;
      }

      if (text === '/debug_json') {
        try {
          JSON.parse('{ invalid json }');
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.error('JSON parse failed', { error: error.message });
          captureException(error);
          await bot.sendMessage(chatId, `JSON error captured: ${error.message}`);
        }
        return;
      }

      const typingInterval = setInterval(() => {
        bot.sendChatAction(chatId, 'typing').catch(() => {});
      }, TYPING_INTERVAL_MS);

      try {
        // /debug_error is inside try/catch to exercise the normal error handling + Sentry capture path
        if (text === '/debug_error') {
          throw new Error('Manual test error');
        }

        await bot.sendChatAction(chatId, 'typing');

        const history = getHistory(user.id);
        logHistory(user.id, history, 'Running agent');

        const agentStart = Date.now();
        const reply = await processMessage(user.id, text);
        const elapsed = ((Date.now() - agentStart) / 1000).toFixed(1);

        await bot.sendMessage(chatId, reply);
        logger.info('Reply sent', { chat_id: chatId, elapsed_s: parseFloat(elapsed) });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Message processing failed', { chat_id: chatId, user_id: user.id, error: error.message });
        captureException(error);
        await bot.sendMessage(chatId, `Something went wrong:\n${error.message}`).catch(() => {});
      } finally {
        clearInterval(typingInterval);
      }
    });
  });

  bot.on('polling_error', (err) => {
    logger.error('Polling error', { error: err.message });
    captureException(err);
  });
}
