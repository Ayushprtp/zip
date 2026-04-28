/**
 * List Files Tool — List directory contents in E2B sandbox
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { getE2BSandbox } from '~/lib/e2b/sandbox';

export interface ListFilesInput {
  path?: string;
  recursive?: boolean;
}

export const ListFilesTool: Tool<ListFilesInput, { entries: string[]; count: number }> = {
  name: 'list_files',
  displayName: 'List Directory',
  description: 'List files and directories in the sandbox filesystem.',

  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list (default: /home/project)' },
      recursive: { type: 'boolean', description: 'Recursive listing (default: false)' },
    },
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'filesystem',
  searchHint: 'list directory ls tree files folders',

  async execute(input: ListFilesInput, context: ToolUseContext): Promise<ToolResult<{ entries: string[]; count: number }>> {
    const dirPath = input.path?.startsWith('/') ? input.path : `${context.workDir}/${input.path || ''}`;
    try {
      const sandbox = await getE2BSandbox();
      const cmd = input.recursive
        ? `find ${dirPath} -maxdepth 3 2>/dev/null | head -500`
        : `ls -la ${dirPath} 2>/dev/null`;
      const result = await sandbox.commands.run(cmd, { timeoutMs: 10_000 });
      const entries = ((result as any)?.stdout || '').trim().split('\n').filter(Boolean);
      return { success: true, data: { entries, count: entries.length } };
    } catch (error: any) {
      return { success: false, data: { entries: [], count: 0 }, error: `Failed to list '${dirPath}': ${error.message}` };
    }
  },
};
