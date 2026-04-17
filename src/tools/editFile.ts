import { readFileSync, writeFileSync } from 'fs';
import { resolvePath } from './resolvePath';

export const editFileTool = {
  name: 'edit_file',
  description: 'Modify an existing file. mode=replace: replaces first occurrence of old_text with new_text. mode=append: adds text to end of file.',
  args: {
    filepath: 'path to the file',
    mode: '"replace" or "append"',
    old_text: '(replace mode) exact text to find',
    new_text: '(replace mode) replacement text; or the text to append in append mode',
  },
  execute(args: Record<string, string>): string {
    const filepath = resolvePath(args['filepath'] ?? '');
    const mode = (args['mode'] ?? 'replace').trim();

    let content: string;
    try {
      content = readFileSync(filepath, 'utf8');
    } catch (e) {
      return `Error: cannot read file — ${e instanceof Error ? e.message : String(e)}`;
    }

    let updated: string;

    if (mode === 'append') {
      const text = args['new_text'] ?? '';
      updated = content.endsWith('\n') ? content + text : content + '\n' + text;
    } else if (mode === 'replace') {
      const oldText = args['old_text'] ?? '';
      const newText = args['new_text'] ?? '';
      if (!oldText) return 'Error: old_text is required for replace mode';
      if (!content.includes(oldText)) return `Error: old_text not found in file — make sure it matches exactly`;
      updated = content.replace(oldText, newText);
    } else {
      return `Error: unknown mode "${mode}". Use "replace" or "append"`;
    }

    try {
      writeFileSync(filepath, updated, 'utf8');
      return `OK: file updated (${updated.length} chars)`;
    } catch (e) {
      return `Error: cannot write file — ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};
