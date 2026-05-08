import { AsyncLocalStorage } from 'async_hooks';
import * as Sentry from '@sentry/node';
import { Message } from './modules/history';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Sentry uses 'warning' where we use 'WARN', and 'log' doesn't map — use 'debug' as fallback
const SENTRY_LEVEL: Record<LogLevel, Sentry.SeverityLevel> = {
  DEBUG: 'debug',
  INFO:  'info',
  WARN:  'warning',
  ERROR: 'error',
};

interface TraceStore {
  traceId: string;
}

const storage = new AsyncLocalStorage<TraceStore>();

function log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
  const traceId = storage.getStore()?.traceId ?? 'no-trace';
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'tg-local-llm',
    trace_id: traceId,
    message,
    ...context,
  };
  console.log(JSON.stringify(entry));
  Sentry.addBreadcrumb({
    level: SENTRY_LEVEL[level],
    message,
    data: { ...context, trace_id: traceId },
    timestamp: Date.now() / 1000,
  });
  if (level === 'INFO' || level === 'WARN') {
    Sentry.captureMessage(message, {
      level: SENTRY_LEVEL[level],
      extra: { ...context, trace_id: traceId },
    });
  }
}

export const logger = {
  info:  (message: string, context?: Record<string, unknown>) => log('INFO',  message, context),
  warn:  (message: string, context?: Record<string, unknown>) => log('WARN',  message, context),
  error: (message: string, context?: Record<string, unknown>) => log('ERROR', message, context),
  debug: (message: string, context?: Record<string, unknown>) => log('DEBUG', message, context),
};

export function runWithTrace<T>(traceId: string, fn: () => T): T {
  return storage.run({ traceId }, fn);
}

export function getTraceId(): string {
  return storage.getStore()?.traceId ?? 'no-trace';
}

function estimateTokens(messages: Message[]): number {
  return Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
}

export function logHistory(userId: number, history: Message[], label: string): void {
  logger.debug('Context snapshot', {
    label,
    user_id: userId,
    message_count: history.length,
    estimated_tokens: estimateTokens(history),
    messages: history.map((m, i) => ({
      index: i + 1,
      role: m.isHistory ? `${m.role}[H]` : m.role,
      content: m.content.length > 200 ? m.content.slice(0, 199) + '…' : m.content,
    })),
  });
}

export function logSummary(userId: number, summary: string): void {
  logger.debug('Summary produced', {
    user_id: userId,
    summary,
  });
}
