import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { resolvePath } from './resolvePath';

const MAX_RESULTS = 50;

function walk(dir: string, pattern: RegExp, results: string[]): void {
  if (results.length >= MAX_RESULTS) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (results.length >= MAX_RESULTS) return;
    const full = join(dir, name);
    const isDir = statSync(full).isDirectory();
    if (pattern.test(name)) results.push(isDir ? `${full}/` : full);
    if (isDir) walk(full, pattern, results);
  }
}

export const findFilesTool = {
  name: 'find_files',
  description: 'Recursively search for files/folders matching a name pattern inside a directory.',
  args: {
    dirpath: 'Root directory to search in',
    pattern: 'Search string (matched as case-insensitive substring against file/folder names)',
  },
  execute(args: Record<string, string>): string {
    const dirpath = resolvePath(args['dirpath'] ?? '');
    const pattern = (args['pattern'] ?? '').trim();
    if (!dirpath) return 'Error: dirpath is required';
    if (!pattern) return 'Error: pattern is required';

    const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const results: string[] = [];
    walk(dirpath, re, results);

    if (results.length === 0) return 'No matches found.';
    const rel = results.map((p) => relative(dirpath, p) || p);
    return JSON.stringify({ dirpath, matches: rel, truncated: results.length >= MAX_RESULTS });
  },
};
