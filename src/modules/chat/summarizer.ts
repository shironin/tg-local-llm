import { readFileSync } from 'fs';
import { join } from 'path';
import { askLLMShort } from './llm';
import { getRows, performRollingSummarize } from '../history';
import { logSummary } from '../../logger';
import { config } from '../../config';
import { Message } from '../history';

const SUMMARIZE_PROMPT = readFileSync(join(__dirname, '..', '..', '..', 'prompts', 'summarize.md'), 'utf8').trim();

function buildSummarizeMessages(rows: { role: string; content: string }[], existingSummary?: string): Message[] {
  const contextLines = rows.map((r) => `${r.role}: ${r.content}`).join('\n');
  const prior = existingSummary ? `prior summary: ${existingSummary}\n` : '';
  return [{ role: 'user', content: `task: ${SUMMARIZE_PROMPT}\n${prior}context:\n${contextLines}` }];
}

export async function summarizeIfNeeded(userId: number): Promise<void> {
  const rows = getRows(userId);
  if (rows.length <= config.memThreshold) return;

  const summaryRow = rows.find((r) => r.role === 'summary');
  const messageRows = rows.filter((r) => r.role !== 'summary');

  const segmentA = messageRows.slice(0, messageRows.length - config.memShortTermSize);
  const segmentB = messageRows.slice(-config.memShortTermSize);

  const messages = buildSummarizeMessages(segmentA, summaryRow?.content);
  console.log(`[Summarize] chat ${userId}: ${segmentA.length} messages → summarize`);
  console.log(`[Summarize] payload:\n${messages[0].content}`);

  let newSummary: string;
  try {
    newSummary = await askLLMShort(messages);
  } catch (err) {
    console.warn(`[Summarize] Skipped for chat ${userId}: ${err instanceof Error ? err.message : err}`);
    return;
  }

  logSummary(userId, newSummary);
  performRollingSummarize(userId, segmentB, newSummary);
}

export async function forceSummarize(userId: number): Promise<{ summarized: number }> {
  const rows = getRows(userId);
  const summaryRow = rows.find((r) => r.role === 'summary');
  const messageRows = rows.filter((r) => r.role !== 'summary');

  const segmentA = messageRows.length > config.memShortTermSize
    ? messageRows.slice(0, messageRows.length - config.memShortTermSize)
    : messageRows;
  const segmentB = messageRows.length > config.memShortTermSize
    ? messageRows.slice(-config.memShortTermSize)
    : [];

  const messages = buildSummarizeMessages(segmentA, summaryRow?.content);
  console.log(`[Summarize] force chat ${userId}: ${segmentA.length} messages → summarize`);
  console.log(`[Summarize] payload:\n${messages[0].content}`);

  const newSummary = await askLLMShort(messages);
  logSummary(userId, newSummary);
  performRollingSummarize(userId, segmentB, newSummary);

  return { summarized: segmentA.length };
}
