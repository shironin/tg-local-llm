import { mkdirSync } from 'fs';
import { resolvePath } from './resolvePath';

export const createDirTool = {
  name: 'create_dir',
  description: 'Create a directory (and any missing parent directories).',
  args: { dirpath: 'path to the directory to create' },
  execute(args: Record<string, string>): string {
    const dirpath = resolvePath(args['dirpath'] ?? '');
    if (!dirpath) return 'Error: dirpath is required';
    try {
      mkdirSync(dirpath, { recursive: true });
      return `OK: directory created at ${dirpath}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};
