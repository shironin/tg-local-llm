import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  telegramToken: requireEnv('TELEGRAM_API_TOKEN'),
  ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'qwen2.5:7b',
  contextLastXMessages: parseInt(process.env.CONTEXT_LAST_X_MESSAGES ?? '10', 10),
  contextMessagesBeforeSummarize: parseInt(process.env.CONTEXT_MESSAGES_BEFORE_SUMMARIZE ?? '10', 10),
  contextSummarizePrompt: process.env.CONTEXT_SUMMARIZE_PROMPT ?? 'Summarize the conversation so far into key bullet points.',
  contextSystemPrompt: process.env.CONTEXT_SYSTEM_PROMPT ?? '',
};
