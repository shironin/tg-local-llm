import { config } from './config';
import { Message } from './context';

interface OllamaChatResponse {
  message: Message;
}

const RETRY_DELAYS_MS = [3000, 8000];

async function attemptLLM(history: Message[], timeoutMs: number, model = config.ollamaModel, label = 'LLM'): Promise<string> {
  console.log(`[${label}] Using model: ${model}`);
  let response: Response;

  try {
    response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        messages: history.map(({ role, content }) => ({ role, content })),
        stream: false,
      }),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    throw new Error(
      isTimeout
        ? `Ollama timed out after ${timeoutMs / 1000}s (${config.ollamaUrl})`
        : `Cannot reach Ollama at ${config.ollamaUrl}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Ollama returned ${response.status}: ${body || response.statusText}`);
  }

  const data = (await response.json()) as OllamaChatResponse;

  if (!data.message?.content) {
    throw new Error('Ollama returned an empty response');
  }

  return data.message.content;
}

async function callLLM(history: Message[], timeoutMs: number, model = config.ollamaModel, label = 'LLM'): Promise<string> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await attemptLLM(history, timeoutMs, model, label);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) {
        console.warn(`[LLM] Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

export function askLLM(history: Message[], label = 'LLM'): Promise<string> {
  return callLLM(history, config.llmTimeoutMs, config.ollamaModel, label);
}

export function askLLMShort(history: Message[]): Promise<string> {
  return callLLM(history, config.llmSummarizeTimeoutMs, config.ollamaModelSummary, 'Summarize');
}
