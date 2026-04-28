/**
 * Bash Tool — Execute shell commands in E2B sandbox
 */

import type { Tool, ToolResult, ToolUseContext, ToolCallProgress } from '../types';
import { getE2BSandbox } from '~/lib/e2b/sandbox';

export interface BashInput {
  command: string;
  timeout?: number;
  background?: boolean;
  cwd?: string;
}

export interface BashOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
}

export const BashTool: Tool<BashInput, BashOutput> = {
  name: 'bash',
  displayName: 'Bash',
  description: 'Execute bash commands in the cloud sandbox environment. Use for npm, git, python, builds, etc.',

  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The bash command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 120000)' },
      background: { type: 'boolean', description: 'Run the command in the background' },
      cwd: { type: 'string', description: 'Working directory override' },
    },
    required: ['command'],
  },

  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'shell',
  searchHint: 'terminal command shell npm git python run',

  async execute(input: BashInput, context: ToolUseContext, onProgress?: ToolCallProgress): Promise<ToolResult<BashOutput>> {
    const { command, timeout, background, cwd } = input;
    const timeoutMs = Math.min(timeout ?? 120_000, 600_000);

    try {
      const sandbox = await getE2BSandbox();
      const workDir = cwd || context.workDir || '/home/project';
      const fullCmd = `cd ${workDir} && export PATH=$PATH:/home/project/.npm-global/bin && ${command}`;

      let stdout = '';
      let stderr = '';

      const result = await sandbox.commands.run(fullCmd, {
        background: background ?? false,
        timeoutMs: background ? 0 : timeoutMs,
        onStdout: (data: string) => {
          stdout += data;
          onProgress?.({ toolUseId: '', type: 'bash_output', data: { stream: 'stdout', content: data } });
        },
        onStderr: (data: string) => {
          stderr += data;
          onProgress?.({ toolUseId: '', type: 'bash_output', data: { stream: 'stderr', content: data } });
        },
      });

      const output: BashOutput = {
        stdout: stdout || (result as any)?.stdout || '',
        stderr: stderr || (result as any)?.stderr || '',
        exitCode: (result as any)?.exitCode ?? 0,
        command,
      };

      return { success: output.exitCode === 0, data: output, error: output.exitCode !== 0 ? `Command exited with code ${output.exitCode}` : undefined };
    } catch (error: any) {
      return { success: false, data: { stdout: '', stderr: error.message, exitCode: 1, command }, error: `Bash execution failed: ${error.message}` };
    }
  },
};
