import { config } from './config';

interface OllamaResponse {
  response: string;
}

export async function askLLM(prompt: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt,
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

  const data = (await response.json()) as OllamaResponse;

  if (!data.response) {
    throw new Error('Ollama returned an empty response');
  }

  return data.response;
}
