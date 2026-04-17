import { readFileSync } from 'fs';
import { resolvePath } from './resolvePath';

const MAX_CHARS = 5000;

export const readFileTool = {
  name: 'read_file',
  description: 'Read and return the text content of a file.',
  args: { filepath: 'path to the file' },
  execute(args: Record<string, string>): string {
    const filepath = resolvePath(args['filepath'] ?? '');
    if (!filepath) return 'Error: filepath is required';
    try {
      const content = readFileSync(filepath, 'utf8');
      return content.length > MAX_CHARS
        ? content.slice(0, MAX_CHARS) + `\n... [truncated, ${content.length - MAX_CHARS} chars remaining]`
        : content;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};
