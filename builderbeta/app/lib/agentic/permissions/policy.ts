import type {
  PermissionDecision,
  PermissionPolicyConfig,
  PermissionReasonCode,
  PermissionRule,
  PermissionRuleEffect,
  PermissionMode,
  Tool,
} from '../types';

interface PolicyEvalInput {
  toolName: string;
  args: unknown;
  tool: Pick<Tool, 'isReadOnly'>;
  policy?: PermissionPolicyConfig;
}

const VALID_MODES: ReadonlySet<PermissionMode> = new Set([
  'default',
  'plan',
  'acceptEdits',
  'dontAsk',
  'bypassPermissions',
]);

export function evaluatePermissionPolicy(input: PolicyEvalInput): PermissionDecision {
  const { toolName, args, tool, policy } = input;

  if (!policy) {
    return decision('allow', 'NO_POLICY_CONFIGURED', 'No policy configured; preserving legacy allow behavior.');
  }

  if (!VALID_MODES.has(policy.mode)) {
    return decision('deny', 'UNKNOWN_MODE', `Unknown permission mode "${String(policy.mode)}".`);
  }

  if (policy.mode === 'bypassPermissions') {
    return decision('allow', 'MODE_BYPASS_PERMISSIONS', 'Permission checks bypassed by mode.');
  }

  const ruleDecision = evaluateRules(policy.rules, toolName, args);

  if (ruleDecision) {
    return ruleDecision;
  }

  return evaluateModeFallback(policy.mode, tool.isReadOnly, toolName);
}

function evaluateRules(
  rules: PermissionRule[] | undefined,
  toolName: string,
  args: unknown,
): PermissionDecision | null {
  if (!rules?.length) {
    return null;
  }

  const serializedArgs = safeStringify(args);

  for (const rule of rules) {
    if (rule.enabled === false) {
      continue;
    }

    const nameMatch = matchToolName(rule.toolName, toolName);

    if (!nameMatch) {
      continue;
    }

    if (!rule.inputPattern) {
      return decisionFromRule(rule);
    }

    try {
      const pattern = new RegExp(rule.inputPattern);

      if (pattern.test(serializedArgs)) {
        return decisionFromRule(rule);
      }
    } catch {
      return decision(
        'deny',
        'RULE_PARSE_ERROR',
        `Invalid inputPattern in rule ${rule.id ?? '<unlabeled>'}; denying by safe default.`,
      );
    }
  }

  return null;
}

function decisionFromRule(rule: PermissionRule): PermissionDecision {
  const reasonMap: Record<PermissionRuleEffect, PermissionReasonCode> = {
    allow: 'RULE_MATCH_ALLOW',
    deny: 'RULE_MATCH_DENY',
    ask: 'RULE_MATCH_ASK',
  };

  return decision(
    rule.effect,
    reasonMap[rule.effect],
    `Matched rule ${rule.id ?? '<unlabeled>'} for tool pattern "${rule.toolName}".`,
    rule.id,
  );
}

function evaluateModeFallback(mode: PermissionMode, isReadOnly: boolean, toolName?: string): PermissionDecision {
  switch (mode) {
    case 'default':
      return isReadOnly
        ? decision('allow', 'MODE_DEFAULT_READONLY_ALLOW', 'Default mode allows read-only tools.')
        : decision('ask', 'MODE_DEFAULT_MUTATION_ASK', 'Default mode requires confirmation for mutating tools.');

    case 'plan': {
      if (isReadOnly) {
        return decision('allow', 'MODE_PLAN_READONLY_ALLOW', 'Plan mode allows read-only tools.');
      }

      if (toolName === 'exit_plan_mode') {
        return decision(
          'allow',
          'MODE_PLAN_SAFE_MUTATION_ALLOW',
          'Plan mode allows exit_plan_mode to leave planning mode explicitly.',
        );
      }

      return decision('deny', 'MODE_PLAN_MUTATION_DENY', 'Plan mode blocks mutating tools.');
    }

    case 'acceptEdits':
      return isReadOnly
        ? decision('allow', 'MODE_ACCEPT_EDITS_ALLOW', 'Accept-edits mode allows read-only tools.')
        : decision('ask', 'MODE_ACCEPT_EDITS_ASK', 'Accept-edits mode requires confirmation for mutating tools.');

    case 'dontAsk':
      return decision('allow', 'MODE_DONT_ASK_ALLOW', 'Dont-ask mode allows tool execution without prompts.');

    case 'bypassPermissions':
      return decision('allow', 'MODE_BYPASS_PERMISSIONS', 'Permission checks bypassed by mode.');

    default:
      return decision('deny', 'NO_MATCH_FALLBACK_DENY', 'No fallback decision matched; denying by safe default.');
  }
}

function matchToolName(rulePattern: string, toolName: string): boolean {
  if (rulePattern === '*') {
    return true;
  }

  if (!rulePattern.includes('*')) {
    return rulePattern === toolName;
  }

  const escaped = rulePattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(toolName);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '[unserializable-input]';
  }
}

function decision(
  value: PermissionRuleEffect,
  reasonCode: PermissionReasonCode,
  reason: string,
  matchedRuleId?: string,
): PermissionDecision {
  return {
    decision: value,
    allowed: value === 'allow',
    reasonCode,
    reason,
    matchedRuleId,
  };
}
