export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  role: MessageRole;
  content: string;
  isHistory?: boolean;
}

export interface HistoryRow {
  id: number;
  role: string;
  content: string;
}
