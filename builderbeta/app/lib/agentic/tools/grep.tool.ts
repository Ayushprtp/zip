/**
 * Grep Tool — Search file contents in E2B sandbox
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { getE2BSandbox } from '~/lib/e2b/sandbox';

export interface GrepInput {
  pattern: string;
  path?: string;
  include?: string;
  case_insensitive?: boolean;
}

export interface GrepMatch { file: string; line: number; content: string; }

export const GrepTool: Tool<GrepInput, { matches: GrepMatch[]; count: number }> = {
  name: 'grep',
  displayName: 'Search Content',
  description: 'Search file contents for a pattern (regex supported). Returns up to 100 matches.',

  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex supported)' },
      path: { type: 'string', description: 'Directory or file to search (default: /home/project)' },
      include: { type: 'string', description: 'File pattern to include (e.g., *.ts)' },
      case_insensitive: { type: 'boolean', description: 'Case-insensitive search' },
    },
    required: ['pattern'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'search',
  searchHint: 'grep search content text regex find code',

  async execute(input: GrepInput, context: ToolUseContext): Promise<ToolResult<{ matches: GrepMatch[]; count: number }>> {
    const searchPath = input.path?.startsWith('/') ? input.path : `${context.workDir}/${input.path || ''}`;
    try {
      const sandbox = await getE2BSandbox();
      let cmd = 'grep -rnI';
      if (input.case_insensitive) cmd += ' -i';
      if (input.include) cmd += ` --include='${input.include}'`;
      cmd += ` '${input.pattern.replace(/'/g, "'\\''")}' ${searchPath} 2>/dev/null | head -100`;

      const result = await sandbox.commands.run(cmd, { timeoutMs: 30_000 });
      const lines = ((result as any)?.stdout || '').trim().split('\n').filter(Boolean);
      const matches: GrepMatch[] = lines.map((line: string) => {
        const c1 = line.indexOf(':');
        const c2 = line.indexOf(':', c1 + 1);
        if (c1 === -1 || c2 === -1) return { file: '', line: 0, content: line };
        return { file: line.substring(0, c1), line: parseInt(line.substring(c1 + 1, c2), 10) || 0, content: line.substring(c2 + 1) };
      }).filter((m: GrepMatch) => m.file);

      return { success: true, data: { matches, count: matches.length } };
    } catch (error: any) {
      return { success: false, data: { matches: [], count: 0 }, error: `Grep failed: ${error.message}` };
    }
  },
};
