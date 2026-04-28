/**
 * File Write Tool — Create/overwrite files in E2B sandbox
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { getE2BSandbox } from '~/lib/e2b/sandbox';

export interface FileWriteInput {
  file_path: string;
  content: string;
}

export const FileWriteTool: Tool<FileWriteInput, { filePath: string; bytesWritten: number }> = {
  name: 'file_write',
  displayName: 'Write File',
  description: 'Create or overwrite a file in the sandbox filesystem. Parent directories are created automatically.',

  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'The complete file content to write' },
    },
    required: ['file_path', 'content'],
  },

  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'filesystem',
  searchHint: 'write create file new',

  async execute(input: FileWriteInput, context: ToolUseContext): Promise<ToolResult<{ filePath: string; bytesWritten: number }>> {
    const resolvedPath = input.file_path.startsWith('/') ? input.file_path : `${context.workDir}/${input.file_path}`;
    try {
      const sandbox = await getE2BSandbox();
      const dir = resolvedPath.substring(0, resolvedPath.lastIndexOf('/'));
      if (dir) await sandbox.files.makeDir(dir).catch(() => {});
      await sandbox.files.write(resolvedPath, input.content);
      return { success: true, data: { filePath: resolvedPath, bytesWritten: new TextEncoder().encode(input.content).length } };
    } catch (error: any) {
      return { success: false, data: { filePath: resolvedPath, bytesWritten: 0 }, error: `Failed to write '${resolvedPath}': ${error.message}` };
    }
  },
};
