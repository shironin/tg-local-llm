import * as repository from './repository';
import { HistoryRow, Message, MessageRole } from './types';

export function getHistory(userId: number): Message[] {
  return repository.getHistory(userId);
}

export function getRows(userId: number): HistoryRow[] {
  return repository.getRows(userId);
}

export function addMessage(userId: number, role: MessageRole, content: string): void {
  repository.addMessage(userId, role, content);
}

export function performRollingSummarize(
  userId: number,
  freshMessages: { role: string; content: string }[],
  newSummary: string,
): void {
  repository.performRollingSummarize(userId, freshMessages, newSummary);
}

export function clearHistory(userId: number): void {
  repository.clearHistory(userId);
}
