/**
 * Glob Tool — Find files by pattern in E2B sandbox
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { getE2BSandbox } from '~/lib/e2b/sandbox';

export interface GlobInput {
  pattern: string;
  path?: string;
}

export const GlobTool: Tool<GlobInput, { files: string[]; count: number }> = {
  name: 'glob',
  displayName: 'Find Files',
  description: 'Find files by glob pattern in the sandbox filesystem. Returns up to 200 results.',

  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g., **/*.ts, src/**/*.tsx)' },
      path: { type: 'string', description: 'Directory to search in (default: /home/project)' },
    },
    required: ['pattern'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'search',
  searchHint: 'find files glob pattern search',

  async execute(input: GlobInput, context: ToolUseContext): Promise<ToolResult<{ files: string[]; count: number }>> {
    const searchDir = input.path?.startsWith('/') ? input.path : `${context.workDir}/${input.path || ''}`;
    try {
      const sandbox = await getE2BSandbox();
      const cmd = input.pattern.includes('/')
        ? `find ${searchDir} -path '${input.pattern}' -type f 2>/dev/null | head -200`
        : `find ${searchDir} -name '${input.pattern}' -type f 2>/dev/null | head -200`;
      const result = await sandbox.commands.run(cmd, { timeoutMs: 30_000 });
      const files = ((result as any)?.stdout || '').trim().split('\n').filter(Boolean);
      return { success: true, data: { files, count: files.length } };
    } catch (error: any) {
      return { success: false, data: { files: [], count: 0 }, error: `Glob failed: ${error.message}` };
    }
  },
};
