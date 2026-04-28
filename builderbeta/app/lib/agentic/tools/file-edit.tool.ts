/**
 * File Edit Tool — Surgical text replacements in E2B sandbox files
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { getE2BSandbox } from '~/lib/e2b/sandbox';

export interface FileEditInput {
  file_path: string;
  old_string: string;
  new_string: string;
}

export const FileEditTool: Tool<FileEditInput, { filePath: string; replacements: number }> = {
  name: 'file_edit',
  displayName: 'Edit File',
  description: 'Make targeted edits to a file by replacing exact text. More precise than file_write for modifications.',

  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to the file to edit' },
      old_string: { type: 'string', description: 'The exact text to find (must match exactly)' },
      new_string: { type: 'string', description: 'The replacement text' },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },

  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'filesystem',
  searchHint: 'edit modify patch replace change update',

  async execute(input: FileEditInput, context: ToolUseContext): Promise<ToolResult<{ filePath: string; replacements: number }>> {
    const resolvedPath = input.file_path.startsWith('/') ? input.file_path : `${context.workDir}/${input.file_path}`;
    try {
      const sandbox = await getE2BSandbox();
      let content: string;
      try { content = await sandbox.files.read(resolvedPath); } catch {
        return { success: false, data: { filePath: resolvedPath, replacements: 0 }, error: `File '${resolvedPath}' does not exist.` };
      }
      const idx = content.indexOf(input.old_string);
      if (idx === -1) {
        return { success: false, data: { filePath: resolvedPath, replacements: 0 }, error: `Could not find the specified text in '${resolvedPath}'.` };
      }
      const newContent = content.substring(0, idx) + input.new_string + content.substring(idx + input.old_string.length);
      await sandbox.files.write(resolvedPath, newContent);
      return { success: true, data: { filePath: resolvedPath, replacements: 1 } };
    } catch (error: any) {
      return { success: false, data: { filePath: resolvedPath, replacements: 0 }, error: `Failed to edit '${resolvedPath}': ${error.message}` };
    }
  },
};
