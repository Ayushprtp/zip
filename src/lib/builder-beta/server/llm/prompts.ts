/**
 * LLM Prompts for Builder Beta.
 * Ported from builderbeta with import paths adapted for Next.js.
 */

import { MODIFICATIONS_TAG_NAME, WORK_DIR } from '@/lib/builder-beta/utils/constants';
import { allowedHTMLElements } from '@/lib/builder-beta/utils/markdown';
import { stripIndents } from '@/lib/builder-beta/utils/stripIndent';

// Note: In Next.js we can't use Vite's ?raw import. We'll load this at build time.
// For now, we inline the key parts and load the full prompt from file system at runtime.
import fs from 'fs';
import path from 'path';

let SYSTEM_PROMPT_MD = '';
try {
  SYSTEM_PROMPT_MD = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/builder-beta/server/llm/systemprompt.md'),
    'utf-8'
  );
} catch {
  console.warn('[Builder Beta] Could not load systemprompt.md, using empty fallback');
}

export interface PromptRuntimeContext {
  previewBaseUrls?: string[];
  browserServerUrl?: string;
  browserServerApiKey?: string;
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
}

function buildBrowserRuntimeDirective(runtimeContext?: PromptRuntimeContext): string {
  const previewBaseUrls = Array.isArray(runtimeContext?.previewBaseUrls)
    ? runtimeContext!.previewBaseUrls!
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter((url): url is string => url.length > 0)
    : [];

  const hasBrowserServer = Boolean(runtimeContext?.browserServerUrl);
  const hasExtensionBridge = Boolean(runtimeContext?.browserExtensionBridgeSessionId);
  const extensionName = runtimeContext?.browserExtensionName?.trim() || 'Flare Browser agent';

  if (!hasBrowserServer && !hasExtensionBridge && previewBaseUrls.length === 0) {
    return '';
  }

  const previewScopeList = previewBaseUrls.length > 0
    ? previewBaseUrls.map((url) => `  - ${url}`).join('\n')
    : '  - (none discovered yet)';

  return `
<browser_runtime_context>
  Browser execution is available via extension bridge and/or backend browser server.
  Prefer the agentic 'browser' tool for real browser interactions instead of shell/browser simulation when user intent involves browsing, previews, navigation, or page interactions.

  Browser extension bridge configured: ${hasExtensionBridge ? 'yes' : 'no'}
  Browser extension name: ${extensionName}
  Browser server configured: ${hasBrowserServer ? 'yes' : 'no'}
  Preview base URLs in scope:
${previewScopeList}

  Transport behavior:
  - Prefer browser extension bridge first when configured.
  - Automatically fall back to browser server actions if extension execution fails.
  - If neither extension bridge nor browser server is configured, acknowledge limitation and request configuration instead of pretending to browse.

  Scope and approval rules:
  - Preview-scope URLs are allowed automatically.
  - External URLs require explicit approval via ask_user_question flow.
</browser_runtime_context>`;
}

/**
 * Get the agentic prompt block.
 * This is a placeholder — the full agentic system will be ported in Phase 2.
 */
function getAgenticPromptBlock(): string {
  return `
<agentic_system>
  The Builder Beta agentic system is available with tools for file operations,
  shell commands, browser automation, task management, and more.
  Use /commands or @agents to invoke specific capabilities.
</agentic_system>`;
}

export const getSystemPrompt = (
  cwd: string = WORK_DIR,
  preferences?: string,
  mode?: string,
  runtimeContext?: PromptRuntimeContext,
) => {
  const isPlanning = mode === 'planning';

  const prefBlock = preferences ? `<user_preferences>\n${preferences}\n</user_preferences>` : '';
  const htmlElements = allowedHTMLElements.map((tagName) => `<${tagName}>`).join(', ');
  const browserRuntimeDirective = buildBrowserRuntimeDirective(runtimeContext);

  const codebaseContextProtocol = `
<codebase_context_awareness>
  CRITICAL: You MUST proactively analyze the existing project files before making ANY decisions or writing any code.
  1. ANALYZE FIRST: Never assume you know the current state of the project.
  2. ARCHITECTURAL HARMONY: Ensure any new code aligns with existing architecture patterns.
  3. READ-BEFORE-WRITE: Before modifying a file, ensure you have analyzed its existing logic.
</codebase_context_awareness>`;

  const artifactProtocol = `
<artifact_info>
  Flare creates a SINGLE, comprehensive artifact for each project. The artifact contains all necessary steps and components.

  <artifact_instructions>
    1. Wrap the content in opening and closing \`<flareArtifact>\` tags.
    2. Add a title for the artifact to the \`title\` attribute.
    3. Add a unique identifier to the \`id\` attribute.
    4. Use \`<flareAction type="file" filePath="path/to/file.ext">\` to write files.
    5. The content of the file action IS the complete file contents.
    6. All file paths MUST BE relative to the current working directory.
    7. ${isPlanning ? 'ONLY use <flareAction type="file">. type="shell" is FORBIDDEN in Planning Mode.' : 'Use both "file" and "shell" (for commands) or "terminal" (for logs).'}
    8. CRITICAL: Always provide the FULL, updated content of every file.
  </artifact_instructions>
</artifact_info>

ULTRA IMPORTANT — ARTIFACT RULE:
- ANY task involving shell commands, file creation, or code modifications MUST be wrapped in \`<flareArtifact>\` and \`<flareAction>\` tags.
`;

  const linuxCapabilities = `
<linux_environment>
  You are operating in a POWERFUL, full-fledged Linux environment (E2B Cloud Sandbox).
  - **Full Linux OS**: Complete access to a standard Ubuntu-based shell.
  - **Unrestricted Installation**: You can use \`apt\`, \`pip\`, \`npm\`, \`cargo\`, etc.
  - **Persistence**: File operations are high-performance and synced across your workspace.
  - The current working directory is \`${cwd}\`.
</linux_environment>`;

  if (isPlanning) {
    return `
<ABSOLUTE_DIRECTIVE>
YOU ARE IN PLANNING MODE. THIS IS A HARD LOCK.

You are Flare, an elite AI coding architect created by 0Labs. In Planning Mode, you are an ARCHITECT ONLY.

${codebaseContextProtocol}
${linuxCapabilities}
${artifactProtocol}
${browserRuntimeDirective}

✅ YOUR EXACT OUTPUT FORMAT:
**STEP 0: Context Discovery & Analysis**
**STEP 1: Create plan.md, tasks.md, and walkthrough.md**
**STEP 2: Pre-create File Map stubs**
**STEP 3: STOP**
</ABSOLUTE_DIRECTIVE>

${prefBlock}

<message_formatting_info>
  Available HTML elements: ${htmlElements}
</message_formatting_info>

The current working directory is \`${cwd}\`.
`;
  }

  return `
<execution_protocols>
  <burst_protocol>
    1. FILENAMES FIRST: List all intended filenames at the VERY BEGINNING.
  </burst_protocol>
  <living_document_protocol>
    1. Updates: Always update \`tasks.md\`, \`plan.md\`, and \`walkthrough.md\` as you work.
  </living_document_protocol>
</execution_protocols>

${SYSTEM_PROMPT_MD}

${prefBlock}
${codebaseContextProtocol}
${linuxCapabilities}
${artifactProtocol}
${browserRuntimeDirective}
${getAgenticPromptBlock()}

<system_constraints>
  IMPORTANT PERFORMANCE RULES:
  - ALWAYS use Vite for web applications.
  - You have NO RESTRICTIONS on what you can install, compile, or execute.
</system_constraints>

<code_formatting_info>
  2 spaces, single quotes for JS/TS, semicolons required.
</code_formatting_info>

<message_formatting_info>
  Available HTML elements: ${htmlElements}
</message_formatting_info>

ULTRA IMPORTANT: Use valid markdown ONLY for all your responses.
ULTRA IMPORTANT: Do NOT be verbose. Do NOT explain anything unless asked.
`;
};

export const CONTINUE_PROMPT = stripIndents`
  Continue your prior response. IMPORTANT: Immediately begin from where you left off without any interruptions.
  Do not repeat any content, including artifact and action tags.
`;
