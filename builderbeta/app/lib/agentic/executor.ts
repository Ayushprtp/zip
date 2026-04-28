/**
 * Agentic Tool Executor
 * Runs tools against their registered implementations.
 */

import { getPermissionPolicyConfig } from '~/lib/stores/settings';
import { evaluatePermissionPolicy } from './permissions/policy';
import { agenticRegistry } from './registry';
import { addActiveToolCall, completeActiveToolCall } from './stores';
import type { ToolCallProgress, ToolUseContext } from './types';

const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_APPROVAL_INPUT_PREVIEW_CHARS = 600;

function previewArgsForApproval(args: unknown): string {
  let serialized = '';

  try {
    serialized = JSON.stringify(args, null, 2) || '';
  } catch {
    serialized = '[unserializable-input]';
  }

  if (serialized.length <= MAX_APPROVAL_INPUT_PREVIEW_CHARS) {
    return serialized;
  }

  return `${serialized.slice(0, MAX_APPROVAL_INPUT_PREVIEW_CHARS)}…`;
}

function isApprovalGrantedFromResult(resultData: unknown): boolean {
  const answers = (resultData as any)?.answers;

  if (!Array.isArray(answers) || answers.length === 0) {
    return false;
  }

  const firstAnswer = answers[0] as { selectedOption?: unknown; freeText?: unknown };
  const decisionText = `${
    typeof firstAnswer?.selectedOption === 'string' ? firstAnswer.selectedOption : ''
  } ${
    typeof firstAnswer?.freeText === 'string' ? firstAnswer.freeText : ''
  }`
    .trim()
    .toLowerCase();

  if (!decisionText) {
    return false;
  }

  if (decisionText.includes('deny') || decisionText === 'no') {
    return false;
  }

  return decisionText.includes('allow') || decisionText.includes('approve') || decisionText === 'yes';
}

async function requestToolApproval(
  toolName: string,
  args: unknown,
  reason: string,
  context: ToolUseContext,
  onProgress?: ToolCallProgress,
): Promise<{ approved: boolean; error?: string }> {
  const askTool = agenticRegistry.getTool('ask_user_question');

  if (!askTool) {
    return {
      approved: false,
      error: 'ask_user_question tool is not registered in the agentic registry.',
    };
  }

  const approvalResult = await askTool.execute(
    {
      title: 'Tool approval required',
      instructions:
        `Policy requires explicit approval before running tool "${toolName}".\n\n` +
        `Reason: ${reason}\n\n` +
        `Input preview:\n${previewArgsForApproval(args)}`,
      questions: [
        {
          id: 'tool_approval',
          prompt: `Allow execution of tool "${toolName}" for this request?`,
          options: ['Allow', 'Deny'],
        },
      ],
      timeout_ms: APPROVAL_TIMEOUT_MS,
    },
    context,
    onProgress,
  );

  if (!approvalResult.success) {
    return {
      approved: false,
      error: approvalResult.error || 'Approval request failed.',
    };
  }

  return {
    approved: isApprovalGrantedFromResult(approvalResult.data),
  };
}

/**
 * Execute a single tool.
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: ToolUseContext,
  onProgress?: ToolCallProgress,
): Promise<any> {
  const tool = agenticRegistry.getTool(toolName);
  const toolCallId = generateId();

  if (!tool) {
    throw new Error(`Tool "${toolName}" not found in registry.`);
  }

  const activePolicy = context.permissionPolicy ?? getPermissionPolicyConfig();
  const permissionDecision = evaluatePermissionPolicy({
    toolName,
    args,
    tool,
    policy: activePolicy,
  });

  if (permissionDecision.decision === 'deny') {
    throw new Error(
      `Tool "${toolName}" is denied by policy (${permissionDecision.reasonCode}): ${permissionDecision.reason}`,
    );
  }

  if (permissionDecision.decision === 'ask' && toolName !== 'ask_user_question') {
    const approval = await requestToolApproval(toolName, args, permissionDecision.reason, context, onProgress);

    if (!approval.approved) {
      const suffix = approval.error ? ` Approval flow error: ${approval.error}` : '';
      throw new Error(
        `Tool "${toolName}" requires approval by policy (${permissionDecision.reasonCode}) and was not approved.${suffix}`,
      );
    }
  }

  console.log(`[Agentic] Executing tool ${toolName} with args:`, args);
  addActiveToolCall(toolCallId, toolName, args);

  try {
    const result = await tool.execute(args, context, onProgress);
    console.log(`[Agentic] Tool ${toolName} execution successful`);
    completeActiveToolCall(toolCallId, result, true);
    return result;
  } catch (error: any) {
    console.error(`[Agentic] Tool ${toolName} execution failed:`, error);
    completeActiveToolCall(toolCallId, error.message, false);
    throw error;
  }
}

/**
 * Execute multiple tools in parallel (if possible) or sequence.
 */
export async function executeToolBatch(
  toolUses: { toolName: string; args: any }[],
  context: ToolUseContext,
  onProgress?: ToolCallProgress,
): Promise<any[]> {
  const results = await Promise.allSettled(toolUses.map((use) => executeTool(use.toolName, use.args, context, onProgress)));

  return results.map((r) => (r.status === 'fulfilled' ? r.value : r.reason));
}

/** Generate a unique base36 ID for tools/agents */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4);
}
