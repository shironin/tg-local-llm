import { readFileSync } from 'fs';
import { join } from 'path';
import { askLLM } from './llm';
import { getHistory } from '../history';
import { buildToolsDescription, getToolByName, getToolNames } from '../../tools/registry';
import { config } from '../../config';
import { logger } from '../../logger';
import { Message } from '../history';

const RAW_SYSTEM_PROMPT = readFileSync(join(__dirname, '..', '..', '..', 'prompts', 'system-prompt-simplified.md'), 'utf8').trim();

function buildSystemPrompt(): string {
  return RAW_SYSTEM_PROMPT.replace('{{TOOLS_DESCRIPTION}}', buildToolsDescription());
}

function stripCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

interface ToolCall {
  thought: string;
  action: string;
  args: Record<string, string> | string;
}

interface FinalAnswer {
  final_answer: string;
}

type AgentStep = ToolCall | FinalAnswer;

function parseResponse(raw: string): AgentStep {
  const cleaned = stripCodeFences(raw);
  return JSON.parse(cleaned) as AgentStep;
}

export async function runAgent(userMessage: string, userId: number): Promise<string> {
  const systemPrompt = buildSystemPrompt();
  const history = getHistory(userId);

  const agentMessages: Message[] = [{ role: 'system', content: systemPrompt }, ...history];

  for (let step = 0; step < config.agentMaxSteps; step++) {
    let raw = await askLLM(agentMessages, `Agent step ${step + 1}`);

    let parsed: AgentStep;
    try {
      parsed = parseResponse(raw);
    } catch {
      logger.warn('Invalid JSON from LLM, requesting fix', { step: step + 1 });
      agentMessages.push({ role: 'assistant', content: raw });
      agentMessages.push({
        role: 'user',
        content: 'Fix your JSON format. Your last response was not valid JSON. Respond ONLY with a valid JSON object.',
      });
      raw = await askLLM(agentMessages, `Agent step ${step + 1} retry`);
      try {
        parsed = parseResponse(raw);
      } catch (e) {
        logger.error('Still invalid JSON after retry', { step: step + 1, error: e instanceof Error ? e.message : String(e) });
        return 'I had trouble formatting my response. Please try again.';
      }
    }

    if ('final_answer' in parsed) {
      logger.debug('Agent final answer', { step: step + 1, answer: parsed.final_answer.slice(0, 200) });
      return parsed.final_answer;
    }

    const { thought, action, args } = parsed as ToolCall;

    if (action === 'final_answer') {
      const answer = typeof args === 'string' ? args : (args['answer'] ?? args['final_answer'] ?? JSON.stringify(args));
      logger.debug('Agent final answer', { step: step + 1, answer: answer.slice(0, 200) });
      return answer;
    }

    if (!action || action === 'null') {
      agentMessages.push({ role: 'assistant', content: raw });
      agentMessages.push({
        role: 'user',
        content: 'You set "action" to null. If you have the answer, respond with {"final_answer": "..."}. Do not use the action/thought format.',
      });
      continue;
    }

    const tool = getToolByName(action);
    let observation: string;
    if (!tool) {
      observation = `Error: unknown tool "${action}". Available tools: ${getToolNames()}`;
    } else {
      observation = await tool.execute(args);
    }

    logger.debug('Agent step', {
      step: step + 1,
      thought: thought ?? '(none)',
      action,
      args: JSON.stringify(args),
      observation: observation.slice(0, 300),
    });

    agentMessages.push({ role: 'assistant', content: raw });
    agentMessages.push({ role: 'user', content: `Observation: ${observation}` });
  }

  logger.warn('Agent max steps reached', { max_steps: config.agentMaxSteps });
  return "I've reached the maximum reasoning steps without a final answer. Please try rephrasing your question.";
}
