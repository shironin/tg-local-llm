import { execSync } from 'child_process';

// Each entry is a pattern tested against the full command string.
// Reason is returned to the LLM so it understands why the command was blocked.
const BLACKLIST: Array<{ pattern: RegExp; reason: string }> = [
  // Environment inspection
  { pattern: /\benv\b/,          reason: 'reading environment variables is not allowed' },
  { pattern: /\bprintenv\b/,     reason: 'reading environment variables is not allowed' },
  { pattern: /\bset\b/,          reason: 'reading environment variables is not allowed' },
  { pattern: /\$(?:ENV|env)\b/,  reason: 'reading environment variables is not allowed' },
  { pattern: /\bexport\b/,       reason: 'reading environment variables is not allowed' },
  // Process / secrets inspection
  { pattern: /\/proc\/\d+\/environ/, reason: 'reading process environment is not allowed' },
  { pattern: /\bps\b.*-(e|ef|aux)/, reason: 'listing all processes is not allowed' },
  // Network exfiltration
  { pattern: /\bcurl\b/,         reason: 'outbound network requests are not allowed' },
  { pattern: /\bwget\b/,         reason: 'outbound network requests are not allowed' },
  { pattern: /\bnc\b|\bnetcat\b/, reason: 'outbound network requests are not allowed' },
  // Privilege escalation
  { pattern: /\bsudo\b/,         reason: 'privilege escalation is not allowed' },
  { pattern: /\bsu\b\s/,         reason: 'privilege escalation is not allowed' },
  { pattern: /\bchmod\b/,        reason: 'changing file permissions is not allowed' },
  { pattern: /\bchown\b/,        reason: 'changing file ownership is not allowed' },
  // Destructive operations
  { pattern: /\brm\b.*-[a-z]*r/, reason: 'recursive deletion is not allowed' },
  { pattern: /\bdd\b/,           reason: 'low-level disk operations are not allowed' },
  { pattern: /\bmkfs\b/,         reason: 'filesystem formatting is not allowed' },
];

function checkBlacklist(command: string): string | null {
  for (const { pattern, reason } of BLACKLIST) {
    if (pattern.test(command)) {
      return `Error: command blocked — ${reason}`;
    }
  }
  return null;
}

export const bashExecTool = {
  name: 'bash_exec',
  description: 'Execute a bash command and return its stdout/stderr output. Use for running scripts, system commands, or anything that requires a shell.',
  args: {
    command: 'The bash command to execute',
    timeout_ms: 'Optional timeout in milliseconds (default: 10000)',
  },
  execute(args: Record<string, string> | string): string {
    const command = typeof args === 'string' ? args : (args['command'] ?? '');
    if (!command) return 'Error: command is required';

    const blocked = checkBlacklist(command);
    if (blocked) {
      console.warn(`[bashExec] Blocked command: ${command}`);
      return blocked;
    }

    const timeout = parseInt((typeof args === 'string' ? undefined : args['timeout_ms']) ?? '10000', 10);

    try {
      const output = execSync(command, {
        timeout,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return output.trim() || '(no output)';
    } catch (e: any) {
      const stdout = e.stdout ? String(e.stdout).trim() : '';
      const stderr = e.stderr ? String(e.stderr).trim() : '';
      const parts = [`Exit code: ${e.status ?? 'unknown'}`];
      if (stdout) parts.push(`stdout: ${stdout}`);
      if (stderr) parts.push(`stderr: ${stderr}`);
      return parts.join('\n');
    }
  },
};
