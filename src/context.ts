export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  role: MessageRole;
  content: string;
  isHistory?: boolean;
}

const store = new Map<number, Message[]>();

export function getHistory(chatId: number): Message[] {
  return store.get(chatId) ?? [];
}

export function addMessage(chatId: number, role: MessageRole, content: string, limit: number): void {
  const history = store.get(chatId) ?? [];
  history.push({ role, content });

  // Sliding window: drop the oldest message when over the limit
  while (history.length > limit) {
    history.shift();
  }

  store.set(chatId, history);
}

// Replaces messages from `fromIndex` to the end with a single summary message,
// preserving everything before `fromIndex` (e.g. a previous summary).
export function replaceMessagesWithSummary(chatId: number, fromIndex: number, summaryContent: string): void {
  const history = store.get(chatId) ?? [];
  store.set(chatId, [
    ...history.slice(0, fromIndex),
    { role: 'system', content: summaryContent, isHistory: true },
  ]);
}

export function clearHistory(chatId: number): void {
  store.delete(chatId);
}
