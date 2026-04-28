/**
 * Cron Scheduling Tools — Schedule recurring/one-shot tasks (Kairos feature)
 * Inspired by Claude Code's CronCreate/CronDelete/CronList tools
 *
 * These tools allow agents to schedule prompts to run at future times,
 * either recurring (cron schedule) or one-shot.
 */

import type { Tool, ToolResult, ToolUseContext } from "../types";
import { generateId } from "../executor";
import { runAgent } from "../agents/runner";
import { agenticRegistry } from "../registry";

// ─── In-memory cron store ────────────────────────────────────────────

interface CronJob {
  id: string;
  cron: string;
  prompt: string;
  recurring: boolean;
  createdAt: number;
  nextRun?: number;
  lastRun?: number;
  runCount: number;
  status: "active" | "paused" | "completed";
  running?: boolean;
  lastError?: string;
}

const cronJobs = new Map<string, CronJob>();
let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
const schedulerRunning = new Set<string>();
const SCHEDULER_TICK_MS = 15_000;
const MAX_RECURRING_JOB_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseCronField(
  field: string,
  min: number,
  max: number,
): Set<number> | null {
  const result = new Set<number>();

  const addRange = (start: number, end: number, step: number) => {
    for (let value = start; value <= end; value += step) {
      if (value >= min && value <= max) {
        result.add(value);
      }
    }
  };

  const parts = field
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part === "*") {
      addRange(min, max, 1);
      continue;
    }

    if (part.includes("/")) {
      const [base, stepRaw] = part.split("/");
      const step = Number.parseInt(stepRaw, 10);

      if (!Number.isFinite(step) || step <= 0) {
        return null;
      }

      if (!base || base === "*") {
        addRange(min, max, step);
        continue;
      }

      if (base.includes("-")) {
        const [startRaw, endRaw] = base.split("-");
        const start = Number.parseInt(startRaw, 10);
        const end = Number.parseInt(endRaw, 10);

        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
          return null;
        }

        addRange(start, end, step);
        continue;
      }

      const start = Number.parseInt(base, 10);
      if (!Number.isFinite(start)) {
        return null;
      }

      addRange(start, max, step);
      continue;
    }

    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);

      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        return null;
      }

      addRange(start, end, 1);
      continue;
    }

    const value = Number.parseInt(part, 10);
    if (!Number.isFinite(value) || value < min || value > max) {
      return null;
    }

    result.add(value);
  }

  return result;
}

function cronMatchesAt(cron: string, date: Date): boolean {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return false;
  }

  const [mField, hField, domField, monField, dowField] = fields;
  const mins = parseCronField(mField, 0, 59);
  const hours = parseCronField(hField, 0, 23);
  const days = parseCronField(domField, 1, 31);
  const months = parseCronField(monField, 1, 12);
  const weekdays = parseCronField(dowField, 0, 6);

  if (!mins || !hours || !days || !months || !weekdays) {
    return false;
  }

  return (
    mins.has(date.getMinutes()) &&
    hours.has(date.getHours()) &&
    days.has(date.getDate()) &&
    months.has(date.getMonth() + 1) &&
    weekdays.has(date.getDay())
  );
}

function nextRunAfter(cron: string, fromTimeMs: number): number | undefined {
  const candidate = new Date(fromTimeMs);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const maxMinutesToScan = 60 * 24 * 31;

  for (let i = 0; i < maxMinutesToScan; i++) {
    if (cronMatchesAt(cron, candidate)) {
      return candidate.getTime();
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return undefined;
}

function makeExecutionContext(base: ToolUseContext): ToolUseContext {
  const state = new Map<string, unknown>();

  return {
    ...base,
    persistState: (key: string, value: unknown) => {
      state.set(key, value);
    },
    loadState: <T = unknown>(key: string) => state.get(key) as T | undefined,
  };
}

async function executeScheduledPrompt(job: CronJob): Promise<void> {
  const runnerId = `cron-run-${job.id}`;
  if (schedulerRunning.has(runnerId)) {
    return;
  }

  schedulerRunning.add(runnerId);
  job.running = true;

  try {
    const worker =
      agenticRegistry.getAgent("worker") || agenticRegistry.getAgent("coder");
    if (!worker) {
      job.lastError = "No worker or coder agent available for cron execution";
      return;
    }

    const model =
      (typeof process !== "undefined" ? process.env.OPENAI_MODEL : undefined) ||
      "claude-sonnet-4-20250514";
    const env = typeof process !== "undefined" ? process.env : {};
    const apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || "";
    const apiBaseUrl =
      env.OPENAI_API_BASE_URL || "https://api.flare-sh.tech/v1";

    if (!apiKey) {
      job.lastError = "No API key configured for scheduled execution";
      return;
    }

    const schedulerPrompt = `# Scheduled Cron Job\n\nJob ID: ${job.id}\nCron: ${job.cron}\nRecurring: ${job.recurring ? "yes" : "no"}\nRun count before this run: ${job.runCount}\n\n## Task\n${job.prompt}`;

    const result = await runAgent({
      agentDefinition: worker,
      prompt: schedulerPrompt,
      description: `Scheduled cron job ${job.id}`,
      model,
      sandboxContext: makeExecutionContext({
        workDir: "/home/project",
        model,
        apiKey,
        apiBaseUrl,
      }),
      apiKey,
      apiBaseUrl,
      isBackground: true,
    });

    job.lastError =
      result.status === "failed"
        ? result.error || "Scheduled run failed"
        : undefined;
  } catch (error: any) {
    job.lastError = error?.message || "Scheduled run failed";
  } finally {
    job.lastRun = Date.now();
    job.runCount += 1;
    job.running = false;

    if (!job.recurring) {
      job.status = "completed";
      cronJobs.delete(job.id);
    } else if (Date.now() - job.createdAt >= MAX_RECURRING_JOB_AGE_MS) {
      job.status = "completed";
      cronJobs.delete(job.id);
    } else {
      job.nextRun = nextRunAfter(job.cron, Date.now());
      if (!job.nextRun) {
        job.status = "paused";
        job.lastError = "Could not compute next run for cron expression";
      }
    }

    schedulerRunning.delete(runnerId);
  }
}

function startSchedulerLoop() {
  if (schedulerTimer) {
    return;
  }

  const tick = async () => {
    const now = Date.now();

    const dueJobs = Array.from(cronJobs.values()).filter((job) => {
      if (job.status !== "active") {
        return false;
      }

      if (job.running) {
        return false;
      }

      if (job.nextRun === undefined) {
        job.nextRun = nextRunAfter(job.cron, now - 60_000);
      }

      return typeof job.nextRun === "number" && job.nextRun <= now;
    });

    if (dueJobs.length > 0) {
      await Promise.all(dueJobs.map((job) => executeScheduledPrompt(job)));
    }

    schedulerTimer = setTimeout(tick, SCHEDULER_TICK_MS);
  };

  schedulerTimer = setTimeout(tick, SCHEDULER_TICK_MS);
}

startSchedulerLoop();

// ─── CronCreate ──────────────────────────────────────────────────────

export interface CronCreateInput {
  /** 5-field cron expression: M H DoM Mon DoW */
  cron: string;
  /** Prompt to execute at each fire time */
  prompt: string;
  /** true = recurring, false = one-shot (default: true) */
  recurring?: boolean;
}

export const CronCreateTool: Tool<CronCreateInput, CronJob> = {
  name: "cron_create",
  displayName: "Schedule Task",
  description: `Schedule a prompt to run at a future time — either recurring on a cron schedule, or once at a specific time.

Uses standard 5-field cron in local timezone: minute hour day-of-month month day-of-week.

Examples:
- "*/5 * * * *" = every 5 minutes
- "0 9 * * 1-5" = weekdays at 9am
- "30 14 28 2 *" = Feb 28 at 2:30pm (one-shot)

For one-shot "remind me at X" requests, set recurring: false.`,

  inputSchema: {
    type: "object",
    properties: {
      cron: {
        type: "string",
        description: 'Standard 5-field cron expression: "M H DoM Mon DoW"',
      },
      prompt: {
        type: "string",
        description: "The prompt to execute at each fire time",
      },
      recurring: {
        type: "boolean",
        description:
          "true = recurring (default), false = fire once then delete",
      },
    },
    required: ["cron", "prompt"],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: "scheduling",
  searchHint: "schedule cron recurring timer reminder kairos",

  async execute(
    input: CronCreateInput,
    _context: ToolUseContext,
  ): Promise<ToolResult<CronJob>> {
    const { cron, prompt, recurring = true } = input;

    // Basic cron validation (5 fields)
    const fields = cron.trim().split(/\s+/);
    if (fields.length !== 5) {
      return {
        success: false,
        data: {
          id: "",
          cron,
          prompt,
          recurring,
          createdAt: 0,
          runCount: 0,
          status: "active",
        },
        error: `Invalid cron expression "${cron}". Expected 5 fields: minute hour day-of-month month day-of-week.`,
      };
    }

    if (cronJobs.size >= 50) {
      return {
        success: false,
        data: {
          id: "",
          cron,
          prompt,
          recurring,
          createdAt: 0,
          runCount: 0,
          status: "active",
        },
        error: "Too many scheduled jobs (max 50). Cancel one first.",
      };
    }

    const nextRun = nextRunAfter(cron, Date.now());
    if (!nextRun) {
      return {
        success: false,
        data: {
          id: "",
          cron,
          prompt,
          recurring,
          createdAt: 0,
          runCount: 0,
          status: "active",
        },
        error: `Unable to compute next run for cron expression "${cron}".`,
      };
    }

    const job: CronJob = {
      id: `cron-${generateId()}`,
      cron,
      prompt,
      recurring,
      createdAt: Date.now(),
      runCount: 0,
      status: "active",
      nextRun,
      running: false,
    };

    cronJobs.set(job.id, job);

    return {
      success: true,
      data: job,
    };
  },
};

// ─── CronDelete ──────────────────────────────────────────────────────

export interface CronDeleteInput {
  job_id: string;
}

export const CronDeleteTool: Tool<
  CronDeleteInput,
  { deleted: boolean; jobId: string }
> = {
  name: "cron_delete",
  displayName: "Cancel Scheduled Task",
  description: "Cancel a scheduled cron job by ID.",

  inputSchema: {
    type: "object",
    properties: {
      job_id: { type: "string", description: "The cron job ID to cancel" },
    },
    required: ["job_id"],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: "scheduling",
  searchHint: "cancel delete cron schedule",

  async execute(
    input: CronDeleteInput,
    _context: ToolUseContext,
  ): Promise<ToolResult<{ deleted: boolean; jobId: string }>> {
    const deleted = cronJobs.delete(input.job_id);
    if (!deleted) {
      return {
        success: false,
        data: { deleted: false, jobId: input.job_id },
        error: `Cron job '${input.job_id}' not found`,
      };
    }
    return { success: true, data: { deleted: true, jobId: input.job_id } };
  },
};

// ─── CronList ────────────────────────────────────────────────────────

export const CronListTool: Tool<
  Record<string, never>,
  { jobs: CronJob[]; count: number }
> = {
  name: "cron_list",
  displayName: "List Scheduled Tasks",
  description: "List all scheduled cron jobs.",

  inputSchema: {
    type: "object",
    properties: {},
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: "scheduling",
  searchHint: "list cron schedule jobs",

  async execute(
    _input: Record<string, never>,
    _context: ToolUseContext,
  ): Promise<ToolResult<{ jobs: CronJob[]; count: number }>> {
    const jobs = Array.from(cronJobs.values());
    return { success: true, data: { jobs, count: jobs.length } };
  },
};
