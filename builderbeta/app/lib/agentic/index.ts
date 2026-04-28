/**
 * Agentic System Initialization
 * Registers all built-in tools, agents, and skills on startup.
 * This is the single entry point for the agentic system.
 *
 * Includes all Claude Code tools + Kairos/unreleased features.
 */

import { agenticRegistry } from './registry';

// Tools — Core Filesystem
import { BashTool } from './tools/bash.tool';
import { FileReadTool } from './tools/file-read.tool';
import { FileWriteTool } from './tools/file-write.tool';
import { FileEditTool } from './tools/file-edit.tool';
import { GlobTool } from './tools/glob.tool';
import { GrepTool } from './tools/grep.tool';
import { ListFilesTool } from './tools/list-files.tool';
import { NotebookEditTool } from './tools/notebook-edit.tool';

// Tools — Web
import { WebFetchTool } from './tools/web-fetch.tool';
import { BrowserTool } from './tools/browser.tool';
import { WebSearchTool } from './tools/web-search.tool';

// Tools — Agentic
import { AgentTool } from './tools/agent.tool';
import { SkillTool } from './tools/skill.tool';
import { SendMessageTool } from './tools/send-message.tool';

// Tools — Task Management (Claude Code inspired)
import { TaskCreateTool } from './tools/task-create.tool';
import { TaskGetTool } from './tools/task-get.tool';
import { TaskListTool } from './tools/task-list.tool';
import { TaskOutputTool } from './tools/task-output.tool';
import { TaskUpdateTool } from './tools/task-update.tool';
import { TaskStopTool } from './tools/task-stop.tool';

// Tools — Team / Agent Swarms
import { TeamCreateTool, TeamDeleteTool } from './tools/team.tool';

// Tools — Planning / Approvals
import { TodoWriteTool } from './tools/todo.tool';
import { EnterPlanModeTool } from './tools/enter-plan-mode.tool';
import { ExitPlanModeTool } from './tools/exit-plan-mode.tool';
import { AskUserQuestionTool } from './tools/ask-user-question.tool';

// Tools — Kairos (Proactive Agent Features)
import { SleepTool } from './tools/sleep.tool';
import { CronCreateTool, CronDeleteTool, CronListTool } from './tools/cron.tool';
import { RemoteTriggerTool } from './tools/remote-trigger.tool';

// Tools — MCP Resources
import { ListMCPResourcesTool } from './tools/list-mcp-resources.tool';
import { ReadMCPResourceTool } from './tools/read-mcp-resource.tool';

// Tools — Worktree
import { EnterWorktreeTool } from './tools/enter-worktree.tool';
import { ExitWorktreeTool } from './tools/exit-worktree.tool';

// Tools — Utility
import { BriefTool } from './tools/brief.tool';
import { ToolSearchTool } from './tools/tool-search.tool';

// Agents
import { BUILT_IN_AGENTS } from './agents/built-in';

// Skills
import { BUILT_IN_SKILLS } from './skills/bundled';

// Stores
import { agentDefinitionsStore, skillDefinitionsStore, addTask, updateTask } from './stores';
import { taskManager, type TaskEvent } from './tasks/manager';

let initialized = false;
let taskStoreSyncInitialized = false;

function syncTaskEventToStore(event: TaskEvent): void {
  if (event.type === 'task:created') {
    addTask(event.task);
    return;
  }

  if (event.type === 'task:updated') {
    updateTask(event.task.id, event.task);
    return;
  }

  if (event.type === 'task:output') {
    const task = taskManager.getTask(event.taskId);
    if (task) {
      updateTask(task.id, task);
    }
  }
}

function initializeTaskStoreSync(): void {
  if (taskStoreSyncInitialized) return;

  for (const task of taskManager.getAllTasks()) {
    addTask(task);
  }

  taskManager.subscribe(syncTaskEventToStore);
  taskStoreSyncInitialized = true;
}

export function initializeAgenticSystem(): void {
  if (initialized) return;

  console.log('[Agentic] Initializing system...');

  // Register all tools
  agenticRegistry.registerTools([
    // ── Core Filesystem ──────────────────────────────
    BashTool,
    FileReadTool,
    FileWriteTool,
    FileEditTool,
    GlobTool,
    GrepTool,
    ListFilesTool,
    NotebookEditTool,

    // ── Web ──────────────────────────────────────────
    WebFetchTool,
    BrowserTool,
    WebSearchTool,

    // ── Agentic ──────────────────────────────────────
    AgentTool,
    SkillTool,
    SendMessageTool,

    // ── Task Management ──────────────────────────────
    TaskCreateTool,
    TaskGetTool,
    TaskListTool,
    TaskOutputTool,
    TaskUpdateTool,
    TaskStopTool,

    // ── Team / Swarms ────────────────────────────────
    TeamCreateTool,
    TeamDeleteTool,

    // ── Planning / Approvals ─────────────────────────
    TodoWriteTool,
    EnterPlanModeTool,
    ExitPlanModeTool,
    AskUserQuestionTool,

    // ── Kairos (Proactive) ───────────────────────────
    SleepTool,
    CronCreateTool,
    CronDeleteTool,
    CronListTool,
    RemoteTriggerTool,

    // ── MCP Resources ────────────────────────────────
    ListMCPResourcesTool,
    ReadMCPResourceTool,

    // ── Worktree ─────────────────────────────────────
    EnterWorktreeTool,
    ExitWorktreeTool,

    // ── Utility ──────────────────────────────────────
    BriefTool,
    ToolSearchTool,
  ]);

  console.log(`[Agentic] Registered ${agenticRegistry.getAllTools().length} tools`);

  // Register all built-in agents
  agenticRegistry.registerAgents(BUILT_IN_AGENTS);
  agentDefinitionsStore.set(BUILT_IN_AGENTS);

  console.log(`[Agentic] Registered ${agenticRegistry.getAllAgents().length} agents`);

  // Register all built-in skills
  agenticRegistry.registerSkills(BUILT_IN_SKILLS);
  skillDefinitionsStore.set(BUILT_IN_SKILLS);

  console.log(`[Agentic] Registered ${agenticRegistry.getAllSkills().length} skills`);

  // Keep task manager and nanostore task state in sync
  initializeTaskStoreSync();

  initialized = true;
  console.log('[Agentic] System initialized ✓');
}

/**
 * Get the agentic system prompt block.
 * Injects into the main system prompt to inform the LLM of available capabilities.
 */
export function getAgenticPromptBlock(): string {
  if (!initialized) {
    initializeAgenticSystem();
  }

  return `
<agentic_system>
## Agentic Capabilities

You have access to a powerful agentic system with ${agenticRegistry.getAllTools().length} tools, ${agenticRegistry.getAllAgents().length} agent types, and ${agenticRegistry.getAllSkills().length} skills.

### Available Agent Types (use the \`agent\` tool)
${agenticRegistry.getAllAgents().map(a =>
  `- **${a.agentType}** (${a.icon || '🤖'}): ${a.whenToUse}`
).join('\n')}

### Available Skills (use the \`skill\` tool or detect / commands from user)
${agenticRegistry.getUserInvocableSkills().map(s =>
  `- **/${s.name}**${s.argumentHint ? ` ${s.argumentHint}` : ''}: ${s.description}`
).join('\n')}

### Core Tools
- **bash**: Execute shell commands in E2B sandbox
- **file_read/write/edit**: Full filesystem access
- **glob/grep**: Search files and content
- **list_files**: List directory contents
- **notebook_edit**: Edit Jupyter notebook cells
- **web_fetch**: Fetch URL content
- **browser**: Navigate URLs with preview/external approval boundaries
- **web_search**: Search the web for current information

### Task Management
- **task_create/get/list/output/update/stop**: Track background tasks and read task output logs
- **todo_write**: Structured todo list (create/update/delete/list with priority)

### Planning / Approval
- **enter_plan_mode / exit_plan_mode**: Enter or leave planning mode with permissions metadata capture
- **ask_user_question**: Request explicit user input/approval before continuing

### Scheduling (Kairos)
- **cron_create**: Schedule recurring or one-shot prompts (5-field cron)
- **cron_delete**: Cancel a scheduled job
- **cron_list**: List all scheduled jobs
- **remote_trigger**: Call the remote trigger API (list/get/create/update/run)
- **sleep**: Pause execution for a duration (prefer over bash sleep)

### MCP
- **list_mcp_resources / read_mcp_resource**: Discover and read MCP resources

### Worktree
- **enter_worktree / exit_worktree**: Managed worktree lifecycle with keep/remove/discard semantics

### Team / Swarm Coordination
- **team_create**: Create a multi-agent team
- **team_delete**: Disband a team
- **send_message**: Send follow-up messages to agents

### Utility
- **brief**: Toggle brief/verbose output mode
- **tool_search**: Find the right tool by keyword

### When to Use Agents
- **Simple tasks** (single file edit, quick question) → handle directly
- **Complex tasks** (multi-file implementation, debugging, research) → spawn an agent
- **Parallel work** → spawn multiple agents or create a team
- **User types /command** → invoke the matching skill

### Agent Spawning Rules
1. Agents start with ZERO project context — always include file paths in the prompt
2. Write agent prompts like briefing a smart colleague who just walked in
3. State what "done" looks like clearly
4. For parallel tasks, ensure agents work on different files

### Coordinator Mode
When coordinator mode is active, you orchestrate multiple worker agents:
1. **Research** — spawn workers to investigate in parallel
2. **Synthesis** — YOU read findings, understand the problem, craft implementation specs
3. **Implementation** — spawn workers to make targeted changes
4. **Verification** — spawn workers to test changes
Never write "based on your findings" — synthesize the findings yourself.

### Team Workflow
For complex multi-step projects:
1. **Create a team** with team_create
2. **Plan tasks** using todo_write to create structured work items
3. **Spawn agents** as team members with the agent tool
4. **Coordinate** with send_message between members
5. **Track progress** with task_list and todo_write action=list
6. **Clean up** with team_delete when done

### Proactive Agent Mode (Kairos)
- Schedule recurring checks with **cron_create**
- Wait between actions with **sleep** (don't waste API calls)
- Monitor progress with **task_list**
- Clean up completed schedules with **cron_delete**

### Skill Detection
When the user's message starts with a / command (e.g., "/commit", "/test"), automatically invoke the matching skill.
</agentic_system>
`;
}

// Re-export everything for convenience
export { agenticRegistry } from './registry';
export { executeTool, executeToolBatch, generateId } from './executor';
export { runAgent } from './agents/runner';
export { spawnParallelWorkers, getCoordinatorSystemPrompt, formatWorkerNotification } from './agents/coordinator';
export { taskManager } from './tasks/manager';
export { connectMCPServer, callMCPTool, readMCPResource } from './mcp/client';
export * from './stores';
export type * from './types';
