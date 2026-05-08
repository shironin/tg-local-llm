import * as Sentry from '@sentry/node';
import { config } from './config';

if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    sendDefaultPii: true,
  });
}

export function setSentryContext(traceId: string, userId?: number): void {
  Sentry.setTag('trace_id', traceId);
  if (userId !== undefined) {
    Sentry.setUser({ id: String(userId) });
  }
}

export function captureException(err: unknown): void {
  Sentry.captureException(err);
}
