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
  contextSystemPrompt: process.env.CONTEXT_SYSTEM_PROMPT ?? '',
  memThreshold: parseInt(process.env.MEM_THRESHOLD ?? '15', 10),
  memShortTermSize: parseInt(process.env.MEM_SHORT_TERM_SIZE ?? '5', 10),
};
