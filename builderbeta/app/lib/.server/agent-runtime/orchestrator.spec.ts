import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockInitializeAgenticSystem,
  mockExecuteTool,
  mockGetTool,
  mockRunAgent,
  mockResumeAgentWithMessage,
  mockHasAgentContinuation,
  mockGetAgentContinuation,
  mockAgentsStoreGet,
  mockPublishRuntimeEvent,
  mockListRuntimeEvents,
  mockGenerateId,
} = vi.hoisted(() => {
  let idCounter = 0;

  return {
    mockInitializeAgenticSystem: vi.fn(),
    mockExecuteTool: vi.fn(),
    mockGetTool: vi.fn(),
    mockRunAgent: vi.fn(),
    mockResumeAgentWithMessage: vi.fn(),
    mockHasAgentContinuation: vi.fn(),
    mockGetAgentContinuation: vi.fn(),
    mockAgentsStoreGet: vi.fn(),
    mockPublishRuntimeEvent: vi.fn(),
    mockListRuntimeEvents: vi.fn(),
    mockGenerateId: vi.fn(() => `id-${++idCounter}`),
  };
});

vi.mock('~/lib/agentic', () => ({
  initializeAgenticSystem: mockInitializeAgenticSystem,
}));

vi.mock('~/lib/agentic/executor', () => ({
  executeTool: mockExecuteTool,
  generateId: mockGenerateId,
}));

vi.mock('~/lib/agentic/registry', () => ({
  agenticRegistry: {
    getTool: mockGetTool,
    getAllTools: vi.fn(() => []),
    getAllAgents: vi.fn(() => []),
    getAgent: vi.fn(),
  },
}));

vi.mock('~/lib/agentic/agents/runner', () => ({
  runAgent: mockRunAgent,
  resumeAgentWithMessage: mockResumeAgentWithMessage,
  hasAgentContinuation: mockHasAgentContinuation,
  getAgentContinuation: mockGetAgentContinuation,
}));

vi.mock('~/lib/agentic/stores', () => ({
  agentsStore: {
    get: mockAgentsStoreGet,
  },
}));

vi.mock('./event-stream', () => ({
  publishRuntimeEvent: mockPublishRuntimeEvent,
  listRuntimeEvents: mockListRuntimeEvents,
}));

import { executeRuntimeTool } from './orchestrator';

describe('executeRuntimeTool state persistence', () => {
  beforeEach(() => {
    mockInitializeAgenticSystem.mockReset();
    mockExecuteTool.mockReset();
    mockGetTool.mockReset();
    mockRunAgent.mockReset();
    mockResumeAgentWithMessage.mockReset();
    mockHasAgentContinuation.mockReset();
    mockGetAgentContinuation.mockReset();
    mockAgentsStoreGet.mockReset();
    mockPublishRuntimeEvent.mockReset();
    mockListRuntimeEvents.mockReset();

    mockInitializeAgenticSystem.mockImplementation(() => undefined);
    mockAgentsStoreGet.mockReturnValue({});
    mockListRuntimeEvents.mockReturnValue([]);
    mockGetTool.mockImplementation((toolName: string) => ({
      name: toolName,
      description: `Tool ${toolName}`,
      category: 'test',
    }));
  });

  it('persists tool state across executions in the same runtime session', async () => {
    mockExecuteTool.mockImplementation(async (toolName: string, _input: Record<string, unknown>, context: any) => {
      if (toolName === 'state_writer') {
        expect(context.loadState?.('worktree')).toBeUndefined();
        context.persistState?.('worktree', { branch: 'feature/persisted' });

        return {
          success: true,
          data: { persisted: true },
        };
      }

      if (toolName === 'state_reader') {
        return {
          success: true,
          data: {
            value: context.loadState?.('worktree'),
          },
        };
      }

      throw new Error(`Unexpected toolName: ${toolName}`);
    });

    const sessionId = `session-shared-${Date.now()}`;

    const writerResult = await executeRuntimeTool({
      sessionId,
      toolName: 'state_writer',
      input: {},
    });

    expect(writerResult.task.status).toBe('completed');

    const readerResult = await executeRuntimeTool({
      sessionId,
      toolName: 'state_reader',
      input: {},
    });

    expect(readerResult.task.status).toBe('completed');
    expect((readerResult.data as any)?.data?.value).toEqual({ branch: 'feature/persisted' });

    const firstCallContext = mockExecuteTool.mock.calls[0][2] as { persistState?: unknown; loadState?: unknown };
    expect(typeof firstCallContext.persistState).toBe('function');
    expect(typeof firstCallContext.loadState).toBe('function');
  });

  it('isolates persisted tool state between runtime sessions', async () => {
    mockExecuteTool.mockImplementation(async (toolName: string, input: Record<string, unknown>, context: any) => {
      const key = String(input.key || 'worktree');

      if (toolName === 'state_writer') {
        context.persistState?.(key, input.value);

        return {
          success: true,
          data: { key },
        };
      }

      if (toolName === 'state_reader') {
        return {
          success: true,
          data: {
            value: context.loadState?.(key),
          },
        };
      }

      throw new Error(`Unexpected toolName: ${toolName}`);
    });

    const sessionA = `session-a-${Date.now()}`;
    const sessionB = `session-b-${Date.now()}`;

    await executeRuntimeTool({
      sessionId: sessionA,
      toolName: 'state_writer',
      input: {
        key: 'worktree',
        value: { branch: 'feature/session-a' },
      },
    });

    const readFromSessionB = await executeRuntimeTool({
      sessionId: sessionB,
      toolName: 'state_reader',
      input: {
        key: 'worktree',
      },
    });

    expect((readFromSessionB.data as any)?.data?.value).toBeUndefined();

    const readFromSessionA = await executeRuntimeTool({
      sessionId: sessionA,
      toolName: 'state_reader',
      input: {
        key: 'worktree',
      },
    });

    expect((readFromSessionA.data as any)?.data?.value).toEqual({ branch: 'feature/session-a' });
  });

  it('passes browser runtime configuration into tool context for browser-enabled tools', async () => {
    let observedContext: any;

    mockExecuteTool.mockImplementation(async (_toolName: string, _input: Record<string, unknown>, context: any) => {
      observedContext = context;

      return {
        success: true,
        data: {
          browserServerUrl: context.browserServerUrl,
          browserServerApiKey: context.browserServerApiKey,
          previewBaseUrls: context.previewBaseUrls,
        },
      };
    });

    const result = await executeRuntimeTool(
      {
        sessionId: `session-browser-${Date.now()}`,
        toolName: 'browser',
        input: {
          action: 'navigate',
          url: 'https://example.com',
        },
      },
      {
        browserServerUrl: 'https://browser.example',
        browserServerApiKey: 'secret-key',
        previewBaseUrls: ['https://preview.one', 'https://preview.two/path'],
      },
    );

    expect(result.task.status).toBe('completed');
    expect((result.data as any)?.data).toEqual({
      browserServerUrl: 'https://browser.example',
      browserServerApiKey: 'secret-key',
      previewBaseUrls: ['https://preview.one', 'https://preview.two/path'],
    });

    expect(observedContext).toBeTruthy();
    expect(observedContext.browserServerUrl).toBe('https://browser.example');
    expect(observedContext.browserServerApiKey).toBe('secret-key');
    expect(observedContext.previewBaseUrls).toEqual(['https://preview.one', 'https://preview.two/path']);
  });
});
