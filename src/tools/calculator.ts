const SAFE_EXPR = /^[\d\s+\-*/().^%,]+$/;

export const calculatorTool = {
  name: 'calculator',
  description: 'Eval math expression.',
  args: { expression: 'e.g. "2+2*10"' },
  execute(args: Record<string, string>): string {
    const expr = (args['expression'] ?? '').trim();
    if (!expr) return 'Error: empty expression';
    if (!SAFE_EXPR.test(expr)) return 'Error: expression contains unsafe characters';
    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr})`)();
      return String(result);
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};
