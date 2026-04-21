import { addMessage } from '../history';
import { eventBus } from '../../events';
import { runAgent } from './agent';
import { summarizeIfNeeded, forceSummarize } from './summarizer';

export async function processMessage(userId: number, text: string): Promise<string> {
  // Save user message directly — agent needs it in history before running
  addMessage(userId, 'user', text);
  eventBus.emit('MessageReceived', { userId, role: 'user', content: text });
  await summarizeIfNeeded(userId);

  const reply = await runAgent(text, userId);

  addMessage(userId, 'assistant', reply);
  eventBus.emit('ResponseGenerated', { userId, content: reply });
  await summarizeIfNeeded(userId);

  return reply;
}

export { forceSummarize } from './summarizer';
