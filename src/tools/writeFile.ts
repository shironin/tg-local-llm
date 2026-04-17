import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { resolvePath } from './resolvePath';

export const writeFileTool = {
  name: 'write_file',
  description: 'Write text content to a file. Creates the file and any missing parent directories.',
  args: {
    filepath: 'Absolute or relative path to the file to write',
    content: 'Text content to write into the file',
  },
  execute(args: Record<string, string>): string {
    const filepath = resolvePath(args['filepath'] ?? '');
    const content = args['content'] ?? '';
    if (!filepath) return 'Error: filepath is required';

    try {
      mkdirSync(dirname(filepath), { recursive: true });
      writeFileSync(filepath, content, 'utf8');
      return `OK: written ${Buffer.byteLength(content, 'utf8')} bytes to ${filepath}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};
