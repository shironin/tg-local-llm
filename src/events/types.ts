export interface UserCreatedPayload {
  userId: number;
  telegramId: number;
}

export interface MessageReceivedPayload {
  userId: number;
  role: 'user' | 'assistant';
  content: string;
}

export interface ResponseGeneratedPayload {
  userId: number;
  content: string;
}

export interface AppEventMap {
  UserCreated: UserCreatedPayload;
  MessageReceived: MessageReceivedPayload;
  ResponseGenerated: ResponseGeneratedPayload;
}

export type AppEventType = keyof AppEventMap;
