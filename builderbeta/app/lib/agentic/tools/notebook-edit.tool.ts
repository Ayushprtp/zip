/**
 * Notebook Edit Tool — Edit Jupyter/IPython notebooks
 * Inspired by Claude Code's NotebookEditTool
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { getE2BSandbox } from '~/lib/e2b/sandbox';

export interface NotebookEditInput {
  /** Path to the notebook file */
  notebook_path: string;
  /** Which cell to edit (0-indexed) */
  cell_index: number;
  /** New cell content */
  new_source: string;
  /** Cell type */
  cell_type?: 'code' | 'markdown';
}

export const NotebookEditTool: Tool<NotebookEditInput, { notebook_path: string; cell_index: number; success: boolean }> = {
  name: 'notebook_edit',
  displayName: 'Edit Notebook',
  description: 'Edit a cell in a Jupyter/IPython notebook (.ipynb). Can update cell content and change cell types.',

  inputSchema: {
    type: 'object',
    properties: {
      notebook_path: { type: 'string', description: 'Path to the .ipynb file' },
      cell_index: { type: 'number', description: 'Cell index to edit (0-indexed)' },
      new_source: { type: 'string', description: 'New cell content' },
      cell_type: { type: 'string', description: 'Cell type: code or markdown', enum: ['code', 'markdown'] },
    },
    required: ['notebook_path', 'cell_index', 'new_source'],
  },

  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'filesystem',
  searchHint: 'notebook jupyter ipynb cell edit python',

  async execute(input: NotebookEditInput, context: ToolUseContext): Promise<ToolResult<{ notebook_path: string; cell_index: number; success: boolean }>> {
    const resolvedPath = input.notebook_path.startsWith('/') ? input.notebook_path : `${context.workDir}/${input.notebook_path}`;

    try {
      const sandbox = await getE2BSandbox();
      const content = await sandbox.files.read(resolvedPath);
      const notebook = JSON.parse(content);

      if (!notebook.cells || input.cell_index >= notebook.cells.length) {
        return {
          success: false,
          data: { notebook_path: resolvedPath, cell_index: input.cell_index, success: false },
          error: `Cell index ${input.cell_index} out of range (notebook has ${notebook.cells?.length || 0} cells)`,
        };
      }

      const cell = notebook.cells[input.cell_index];
      cell.source = input.new_source.split('\n').map((line: string, i: number, arr: string[]) =>
        i < arr.length - 1 ? line + '\n' : line
      );

      if (input.cell_type) {
        cell.cell_type = input.cell_type;
      }

      await sandbox.files.write(resolvedPath, JSON.stringify(notebook, null, 1));

      return {
        success: true,
        data: { notebook_path: resolvedPath, cell_index: input.cell_index, success: true },
      };
    } catch (error: any) {
      return {
        success: false,
        data: { notebook_path: resolvedPath, cell_index: input.cell_index, success: false },
        error: `Notebook edit failed: ${error.message}`,
      };
    }
  },
};
