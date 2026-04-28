/**
 * Built-in Skills — Slash commands available to users and the LLM
 * Includes both GA and upcoming/unreleased features from Claude Code:
 * - Core: commit, test, deploy, refactor, debug, review, install
 * - Kairos: loop, monitor
 * - Advanced: simplify, verify, remember, batch, init
 */

import type { SkillDefinition } from '../types';

// ─── Core Skills ─────────────────────────────────────────────────────

const CommitSkill: SkillDefinition = {
  name: 'commit',
  description: 'Stage and commit changes with AI-generated commit message',
  aliases: ['ci', 'save'],
  argumentHint: '[files]',
  icon: '📝',
  agentType: 'coder',
  userInvocable: true,
  prompt: `# /commit — Auto-commit

Stage changed files and create a descriptive commit message.

## Steps
1. Run \`git status\` to see what's changed
2. If specific files were mentioned, stage only those; otherwise stage all changes
3. Run \`git diff --staged --stat\` to see the staged changes
4. Generate a clear, conventional commit message (type: description)
5. Run \`git commit -m "<message>"\`
6. Report success with the commit hash`,
};

const TestSkill: SkillDefinition = {
  name: 'test',
  description: 'Run the project test suite and report results',
  aliases: ['t'],
  argumentHint: '[pattern]',
  icon: '🧪',
  agentType: 'reviewer',
  userInvocable: true,
  prompt: `# /test — Run Tests

Run the project's test suite and report results.

## Steps
1. Detect the test framework (check package.json scripts, test config files)
2. Run tests: \`npm test\`, \`bun test\`, \`pytest\`, etc.
3. If a pattern argument is given, run only matching tests
4. Parse the output for pass/fail counts
5. Report: total, passed, failed, skipped
6. If tests fail, show the first 3 failure details`,
};

const DeploySkill: SkillDefinition = {
  name: 'deploy',
  description: 'Build and deploy the project',
  aliases: ['ship'],
  icon: '🚀',
  agentType: 'coder',
  userInvocable: true,
  prompt: `# /deploy — Build and Deploy

Build the project and prepare for deployment.

## Steps
1. Run \`npm run build\` (or equivalent)
2. Check for build errors
3. If a deploy script exists, run it
4. Report success/failure with relevant output`,
};

const RefactorSkill: SkillDefinition = {
  name: 'refactor',
  description: 'Refactor code for better quality and maintainability',
  aliases: ['rf'],
  argumentHint: '<file or pattern>',
  icon: '♻️',
  agentType: 'coder',
  userInvocable: true,
  prompt: `# /refactor — Code Refactoring

Refactor the specified code for better quality and maintainability.

## Steps
1. Read the target file(s)
2. Identify refactoring opportunities:
   - Extract repeated patterns into functions
   - Improve naming
   - Simplify complex logic
   - Add proper typing
3. Apply changes
4. Run tests to verify nothing broke
5. Report what was changed and why`,
};

const DebugSkill: SkillDefinition = {
  name: 'debug',
  description: 'Diagnose and fix errors in the project',
  aliases: ['fix', 'bug'],
  argumentHint: '[error description]',
  icon: '🐛',
  agentType: 'debugger',
  userInvocable: true,
  prompt: `# /debug — Diagnose Errors

Investigate and fix errors.

## Steps
1. Read error output / logs
2. Find the root cause file(s) using grep
3. Trace the cause
4. Apply a targeted fix
5. Run tests to verify
6. Report what was wrong and how it was fixed`,
};

const ReviewSkill: SkillDefinition = {
  name: 'review',
  description: 'Code review with security, quality, and performance checks',
  aliases: ['cr'],
  argumentHint: '[files]',
  icon: '👀',
  agentType: 'reviewer',
  userInvocable: true,
  prompt: `# /review — Code Review

Run a thorough code review on recent changes.

## Steps
1. Run \`git diff\` to see changes (or read specified files)
2. Check each change for:
   - Security vulnerabilities (injection, XSS, auth bypass)
   - Bug risks (null checks, edge cases, error handling)
   - Quality issues (naming, structure, duplication)
   - Performance concerns (N+1, unnecessary work)
3. Report findings by severity: CRITICAL → WARNING → INFO
4. Give an overall verdict: APPROVE, REQUEST CHANGES, or NEEDS INVESTIGATION`,
};

const InstallSkill: SkillDefinition = {
  name: 'install',
  description: 'Install project dependencies',
  aliases: ['i', 'setup'],
  icon: '📦',
  agentType: 'coder',
  userInvocable: true,
  prompt: `# /install — Install Dependencies

Install project dependencies and set up the development environment.

## Steps
1. Detect package manager (check for lockfiles: bun.lockb, pnpm-lock.yaml, yarn.lock, package-lock.json)
2. Run the appropriate install command
3. Check for errors
4. Report success with installed package count`,
};

// ─── Kairos / Upcoming Skills ────────────────────────────────────────

const LoopSkill: SkillDefinition = {
  name: 'loop',
  description: 'Run a prompt or slash command on a recurring interval',
  aliases: [],
  argumentHint: '[interval] <prompt>',
  icon: '🔄',
  agentType: 'worker',
  userInvocable: true,
  prompt: `# /loop — Schedule a Recurring Prompt

Parse the input into \`[interval] <prompt>\` and schedule it with the cron_create tool.

## Parsing (priority order)
1. **Leading token**: if first token matches \`\\d+[smhd]\` (e.g. 5m, 2h), that's the interval
2. **Trailing "every" clause**: if input ends with "every <N><unit>", extract that
3. **Default**: interval is 10m, entire input is the prompt

## Interval → Cron
| Interval | Cron | Notes |
|----------|------|-------|
| Nm (≤59) | */N * * * * | every N minutes |
| Nh | 0 */N * * * | every N hours |
| Nd | 0 0 */N * * | every N days |
| Ns | ceil(N/60)m | min granularity is 1 minute |

## Action
1. Call cron_create with the cron expression and prompt, recurring: true
2. Confirm what's scheduled
3. **Execute the prompt immediately** — don't wait for first cron fire

## Examples
- \`/loop 5m /test\` → every 5 min, run /test
- \`/loop check deploy every 20m\` → every 20 min, check the deploy
- \`/loop check deploy\` → every 10 min (default), check the deploy`,
};

const SimplifySkill: SkillDefinition = {
  name: 'simplify',
  description: 'Review changed code for reuse, quality, and efficiency, then fix issues',
  aliases: ['clean', 'cleanup'],
  icon: '✨',
  agentType: 'reviewer',
  userInvocable: true,
  prompt: `# /simplify — Code Review and Cleanup

Review all changed files for reuse, quality, and efficiency. Fix any issues found.

## Phase 1: Identify Changes
Run \`git diff\` (or \`git diff HEAD\` if there are staged changes) to see what changed.

## Phase 2: Three-Pass Review

### Pass 1: Code Reuse
- Search for existing utilities that could replace new code
- Flag duplicated functionality
- Flag inline logic that could use existing utilities

### Pass 2: Code Quality
- Redundant state or derived values
- Parameter sprawl
- Copy-paste patterns
- Leaky abstractions
- Unnecessary comments (keep only non-obvious WHY)

### Pass 3: Efficiency
- Unnecessary work (redundant computations, duplicate API calls, N+1)
- Missed concurrency (sequential operations that could be parallel)
- Hot-path bloat
- Memory leaks, unbounded data structures

## Phase 3: Fix Issues
Apply fixes for each issue found. Skip false positives.
Summarize what was fixed.`,
};

const VerifySkill: SkillDefinition = {
  name: 'verify',
  description: 'Verify a code change does what it should by running the app',
  aliases: ['check'],
  icon: '✅',
  agentType: 'reviewer',
  userInvocable: true,
  prompt: `# /verify — Verify Code Changes

Verify that the most recent changes work correctly.

## Steps
1. Check \`git diff\` for recent changes
2. Identify what the changes are supposed to do
3. Start the dev server or run the relevant commands
4. Test the changed functionality
5. Check for regressions in related features
6. Report: what works, what doesn't, and confidence level`,
};

const RememberSkill: SkillDefinition = {
  name: 'remember',
  description: 'Persist and retrieve project notes in a local memory file',
  aliases: ['memo'],
  argumentHint: '<note>|list',
  icon: '🧠',
  agentType: 'coder',
  userInvocable: true,
  getPrompt: (args: string) => {
    const trimmed = args.trim();

    if (!trimmed || trimmed.toLowerCase() === 'list') {
      return `# /remember — Show Project Memory

Read \.bolt/agent-memory.md if it exists and summarize the most relevant recent notes.
If it does not exist, explain that there are no saved notes yet.`;
    }

    return `# /remember — Save Project Memory

Save the following note to \`.bolt/agent-memory.md\`.

## Rules
1. If the file doesn't exist, create it with a heading \`# Agent Memory\`.
2. Append a new bullet entry with an ISO timestamp and the note text.
3. Keep existing notes intact.
4. Return the saved entry and total note count.

## Note
${trimmed}`;
  },
};

const InitSkill: SkillDefinition = {
  name: 'init',
  description: 'Initialize a new project with best-practice structure',
  aliases: ['new', 'create'],
  argumentHint: '<project-type>',
  icon: '🏗️',
  agentType: 'coder',
  userInvocable: true,
  prompt: `# /init — Initialize New Project

Set up a new project with best-practice structure.

## Steps
1. Determine project type from arguments or ask
2. Create project structure:
   - package.json with proper scripts
   - tsconfig.json / vite.config
   - .gitignore
   - README.md
   - Source directory structure
3. Install dependencies
4. Initialize git
5. Report what was created`,
};

const MonitorSkill: SkillDefinition = {
  name: 'monitor',
  description: 'Monitor a process, URL, or log file for changes',
  aliases: ['watch'],
  argumentHint: '<target>',
  icon: '📡',
  agentType: 'worker',
  userInvocable: true,
  prompt: `# /monitor — Watch for Changes

Monitor a process, URL, or log file and report on changes.

## Steps
1. Identify what to monitor (URL endpoint, log file, process)
2. Set up polling with appropriate interval
3. Use cron_create for recurring checks
4. Report any changes, errors, or anomalies
5. Clean up when monitoring is complete`,
};

const BatchSkill: SkillDefinition = {
  name: 'batch',
  description: 'Run a prompt against multiple files or directories',
  aliases: [],
  argumentHint: '<glob> <prompt>',
  icon: '📋',
  agentType: 'worker',
  userInvocable: true,
  prompt: `# /batch — Batch Operations

Apply a prompt to multiple files matching a pattern.

## Parsing
Input format: \`<glob_pattern> <prompt_to_apply>\`

Example: \`/batch src/**/*.ts add JSDoc comments to all exported functions\`

## Steps
1. Parse the glob pattern and prompt
2. Find all matching files using glob tool
3. For each file, apply the prompt (use agents for parallelism on large batches)
4. Report: files processed, changes made, errors encountered`,
};

const PrReviewSkill: SkillDefinition = {
  name: 'pr-review',
  description: 'Review a pull request for code quality and correctness',
  aliases: ['pr'],
  argumentHint: '[PR number or branch]',
  icon: '🔍',
  agentType: 'reviewer',
  userInvocable: true,
  prompt: `# /pr-review — Pull Request Review

Review a pull request for quality, correctness, and best practices.

## Steps
1. Get the PR diff: \`git diff main...HEAD\` or specified branch
2. List all changed files
3. For each file:
   - Check for bugs, security issues, type safety
   - Verify error handling and edge cases
   - Check naming and code style consistency
4. Look at the full picture:
   - Are all related files updated?
   - Are tests covering the changes?
   - Any missing migrations or config changes?
5. Report with severity-ranked findings
6. Give final verdict: APPROVE, REQUEST CHANGES, or NEEDS DISCUSSION`,
};

const DiagnoseSkill: SkillDefinition = {
  name: 'diagnose',
  description: 'Diagnose performance or stability issues in the project',
  aliases: ['perf', 'slow'],
  argumentHint: '[symptom]',
  icon: '🩺',
  agentType: 'debugger',
  userInvocable: true,
  prompt: `# /diagnose — Performance & Stability Diagnosis

Investigate performance or stability issues.

## Steps
1. Gather system info and process stats
2. Check logs for errors or warnings
3. Run profiling if applicable (\`time\`, CPU/memory measurement)
4. Identify bottlenecks:
   - Slow startup? Check dependency tree
   - Memory leak? Check for unbounded growth
   - Slow requests? Check I/O, network, DB queries
5. Suggest and optionally apply fixes
6. Report findings and recommendations`,
};

const MigrateSkill: SkillDefinition = {
  name: 'migrate',
  description: 'Migrate code to a new version, framework, or pattern',
  aliases: ['upgrade'],
  argumentHint: '<from> <to>',
  icon: '🔄',
  agentType: 'coder',
  userInvocable: true,
  prompt: `# /migrate — Code Migration

Migrate code from one version/framework/pattern to another.

## Steps
1. Identify the migration scope from arguments
2. Research breaking changes and migration guides
3. Create a migration plan
4. Apply changes systematically:
   - Update dependencies
   - Update imports and API calls
   - Fix deprecated patterns
   - Update config files
5. Run tests after each major change
6. Report: what changed, what's left, any manual steps needed`,
};

// ─── Export ──────────────────────────────────────────────────────────

export const BUILT_IN_SKILLS: SkillDefinition[] = [
  // Core (GA)
  CommitSkill,
  TestSkill,
  DeploySkill,
  RefactorSkill,
  DebugSkill,
  ReviewSkill,
  InstallSkill,

  // Kairos / Proactive
  LoopSkill,
  MonitorSkill,

  // Advanced
  SimplifySkill,
  VerifySkill,
  RememberSkill,
  InitSkill,
  BatchSkill,
  PrReviewSkill,
  DiagnoseSkill,
  MigrateSkill,
];
