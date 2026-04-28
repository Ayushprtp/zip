/**
 * File Read Tool — Read files from E2B sandbox filesystem
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { getE2BSandbox } from '~/lib/e2b/sandbox';

export interface FileReadInput {
  file_path: string;
  start_line?: number;
  end_line?: number;
}

export interface FileReadOutput {
  content: string;
  filePath: string;
  totalLines: number;
}

export const FileReadTool: Tool<FileReadInput, FileReadOutput> = {
  name: 'file_read',
  displayName: 'Read File',
  description: 'Read the contents of a file from the sandbox filesystem. Supports line ranges.',

  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to the file to read' },
      start_line: { type: 'number', description: 'Start line (1-indexed, inclusive)' },
      end_line: { type: 'number', description: 'End line (1-indexed, inclusive)' },
    },
    required: ['file_path'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'filesystem',
  searchHint: 'read view cat file contents',

  async execute(input: FileReadInput, context: ToolUseContext): Promise<ToolResult<FileReadOutput>> {
    const resolvedPath = input.file_path.startsWith('/') ? input.file_path : `${context.workDir}/${input.file_path}`;
    try {
      const sandbox = await getE2BSandbox();
      const content = await sandbox.files.read(resolvedPath);
      const lines = content.split('\n');
      const startIdx = (input.start_line ?? 1) - 1;
      const endIdx = input.end_line ?? lines.length;
      const selected = lines.slice(Math.max(0, startIdx), Math.min(endIdx, lines.length));

      return { success: true, data: { content: selected.join('\n'), filePath: resolvedPath, totalLines: lines.length } };
    } catch (error: any) {
      return { success: false, data: { content: '', filePath: resolvedPath, totalLines: 0 }, error: `Failed to read '${resolvedPath}': ${error.message}` };
    }
  },
};
