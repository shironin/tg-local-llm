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
  ollamaModelSummary: process.env.OLLAMA_MODEL_SUMMARY ?? process.env.OLLAMA_MODEL ?? 'qwen2.5:7b',
  searxngUrl: process.env.SEARXNG_URL ?? 'http://localhost:8080',
  memThreshold: parseInt(process.env.MEM_THRESHOLD ?? '15', 10),
  memShortTermSize: parseInt(process.env.MEM_SHORT_TERM_SIZE ?? '5', 10),
  agentMaxSteps: parseInt(process.env.AGENT_MAX_STEPS ?? '6', 10),
  llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS ?? String(5 * 60 * 1000), 10),
  llmSummarizeTimeoutMs: parseInt(process.env.LLM_SUMMARIZE_TIMEOUT_MS ?? String(2 * 60 * 1000), 10),
  agentWorkdir: process.env.AGENT_WORKDIR ?? '/',
  sentryDsn: process.env.SENTRY_DSN,
};
