import { resolve, isAbsolute } from 'path';
import { config } from '../config';

// Returns resolved path or throws if it escapes AGENT_WORKDIR
export function resolvePath(p: string): string {
  const trimmed = p.trim();
  const workdir = resolve(config.agentWorkdir);
  const full = isAbsolute(trimmed) ? resolve(trimmed) : resolve(workdir, trimmed);

  if (workdir !== '/' && !full.startsWith(workdir + '/') && full !== workdir) {
    throw new Error(`Access denied: path "${full}" is outside the allowed directory "${workdir}"`);
  }

  return full;
}
