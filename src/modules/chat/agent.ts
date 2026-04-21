import { readFileSync } from 'fs';
import { join } from 'path';
import { askLLM } from './llm';
import { getHistory } from '../history';
import { buildToolsDescription, getToolByName, getToolNames } from '../../tools/registry';
import { config } from '../../config';
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
  args: Record<string, string>;
}

interface FinalAnswer {
  final_answer: string;
}

type AgentStep = ToolCall | FinalAnswer;

function parseResponse(raw: string): AgentStep {
  const cleaned = stripCodeFences(raw);
  return JSON.parse(cleaned) as AgentStep;
}

function logStep(step: number, thought: string, action: string, args: Record<string, string>, observation: string): void {
  const border = '─'.repeat(60);
  console.log(`\n[Agent] Step ${step + 1}`);
  console.log(border);
  console.log(`Thought    : ${thought ?? '(none)'}`);
  console.log(`Action     : ${action}(${JSON.stringify(args)})`);
  console.log(`Observation: ${observation}`);
  console.log(border);
}

function logFinalAnswer(step: number, answer: string): void {
  const border = '─'.repeat(60);
  console.log(`\n[Agent] Step ${step + 1} — Final Answer`);
  console.log(border);
  console.log(answer);
  console.log(border);
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
      console.warn('[Agent] Invalid JSON from LLM, requesting fix...');
      agentMessages.push({ role: 'assistant', content: raw });
      agentMessages.push({
        role: 'user',
        content: 'Fix your JSON format. Your last response was not valid JSON. Respond ONLY with a valid JSON object.',
      });
      raw = await askLLM(agentMessages, `Agent step ${step + 1} retry`);
      try {
        parsed = parseResponse(raw);
      } catch (e) {
        console.error('[Agent] Still invalid JSON after retry:', e);
        return 'I had trouble formatting my response. Please try again.';
      }
    }

    if ('final_answer' in parsed) {
      logFinalAnswer(step, parsed.final_answer);
      return parsed.final_answer;
    }

    const { thought, action, args } = parsed as ToolCall;

    if (action === 'final_answer') {
      const answer = args['answer'] ?? args['final_answer'] ?? JSON.stringify(args);
      logFinalAnswer(step, answer);
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

    logStep(step, thought, action, args, observation);

    agentMessages.push({ role: 'assistant', content: raw });
    agentMessages.push({ role: 'user', content: `Observation: ${observation}` });
  }

  console.warn('[Agent] Max steps reached');
  return "I've reached the maximum reasoning steps without a final answer. Please try rephrasing your question.";
}
