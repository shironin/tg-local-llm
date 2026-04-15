import { config } from './config';
import { Message } from './context';

interface OllamaChatResponse {
  message: Message;
}

export async function askLLM(history: Message[]): Promise<string> {
  let response: Response;

  try {
    response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        // Strip internal-only fields (e.g. isHistory) before sending to Ollama
        messages: history.map(({ role, content }) => ({ role, content })),
        stream: false,
      }),
    });
  } catch (err) {
    throw new Error(
      `Cannot reach Ollama at ${config.ollamaUrl}. Is it running?`
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
