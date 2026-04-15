import { Message } from './context';

const ROLE_COL  = 11; // width of the role column (incl. [H] tag)
const CONTENT_COL = 72; // max content width before truncation

function truncate(text: string, max: number): string {
  const single = text.replace(/\n+/g, ' ');
  return single.length <= max ? single : single.slice(0, max - 1) + '…';
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

const DIVIDER = `${'─'.repeat(4)}┼${'─'.repeat(ROLE_COL + 2)}┼${'─'.repeat(CONTENT_COL + 2)}`;
const HEADER  = ` #  │ ${pad('role', ROLE_COL)} │ content`;

// Rough approximation: ~4 characters per token (standard heuristic)
function estimateTokens(messages: Message[]): number {
  return Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
}

export function logHistory(chatId: number, history: Message[], label: string): void {
  const tokens = estimateTokens(history);
  const msgs = history.length;
  console.log(`\n[Context] ${label} — chat ${chatId} (${msgs} message${msgs !== 1 ? 's' : ''}, ~${tokens} tokens)`);
  console.log(HEADER);
  console.log(DIVIDER);

  history.forEach((msg, i) => {
    const roleLabel = msg.isHistory ? `${msg.role} [H]` : msg.role;
    const index = String(i + 1).padStart(2);
    console.log(` ${index} │ ${pad(roleLabel, ROLE_COL)} │ ${truncate(msg.content, CONTENT_COL)}`);
  });

  console.log('');
}

export function logSummary(chatId: number, summary: string): void {
  const lines = summary.split('\n').filter(Boolean);
  console.log(`\n[Context] Summary produced for chat ${chatId}:`);
  console.log(`${'─'.repeat(ROLE_COL + CONTENT_COL + 10)}`);
  lines.forEach((line) => console.log(`  ${line}`));
  console.log(`${'─'.repeat(ROLE_COL + CONTENT_COL + 10)}\n`);
}
