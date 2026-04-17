import { readFileSync } from 'fs';
import { resolvePath } from './resolvePath';

export const fileInfoTool = {
  name: 'get_file_info',
  description: 'Lines+words count of local text file.',
  args: { filepath: 'path to file' },
  execute(args: Record<string, string>): string {
    const filepath = resolvePath(args['filepath'] ?? '');
    if (!filepath) return 'Error: filepath is required';
    try {
      const content = readFileSync(filepath, 'utf8');
      const lines = content.split('\n').length;
      const words = content.trim().split(/\s+/).filter(Boolean).length;
      return JSON.stringify({ filepath, lines, words });
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};
