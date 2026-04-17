import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { resolvePath } from './resolvePath';

export const listFilesTool = {
  name: 'list_files',
  description: 'List files in directory.',
  args: { dirpath: 'path to directory' },
  execute(args: Record<string, string>): string {
    const dirpath = resolvePath(args['dirpath'] ?? '');
    if (!dirpath) return 'Error: dirpath is required';
    try {
      const entries = readdirSync(dirpath).map((name) => {
        const full = join(dirpath, name);
        const isDir = statSync(full).isDirectory();
        return isDir ? `${name}/` : name;
      });
      return JSON.stringify({ dirpath, entries });
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};
