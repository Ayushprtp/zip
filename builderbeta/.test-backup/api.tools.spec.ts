import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExecuteTool,
  mockListRegisteredTools,
  mockListRuntimeEventsSnapshot,
  mockCreateSandboxSnapshot,
  mockFlushAutoSnapshot,
  mockListSandboxSnapshots,
  mockRestoreSandboxFromSnapshot,
  mockGetSnapshotMetadata,
  mockGetStoredSnapshotId,
  mockGetPreferredTemplate,
  mockSetPreferredTemplate,
  mockClearPreferredTemplate,
  mockTemplateExists,
  mockGetTemplateTags,
  mockAssignTemplateTags,
  mockRemoveTemplateTags,
  mockBuildTemplateFromSnapshot,
  mockSetE2BApiKeyOverride,
  mockSetPreferredTemplateOverride,
} = vi.hoisted(() => ({
  mockExecuteTool: vi.fn(),
  mockListRegisteredTools: vi.fn(),
  mockListRuntimeEventsSnapshot: vi.fn(),
  mockCreateSandboxSnapshot: vi.fn(),
  mockFlushAutoSnapshot: vi.fn(),
  mockListSandboxSnapshots: vi.fn(),
  mockRestoreSandboxFromSnapshot: vi.fn(),
  mockGetSnapshotMetadata: vi.fn(),
  mockGetStoredSnapshotId: vi.fn(),
  mockGetPreferredTemplate: vi.fn(),
  mockSetPreferredTemplate: vi.fn(),
  mockClearPreferredTemplate: vi.fn(),
  mockTemplateExists: vi.fn(),
  mockGetTemplateTags: vi.fn(),
  mockAssignTemplateTags: vi.fn(),
  mockRemoveTemplateTags: vi.fn(),
  mockBuildTemplateFromSnapshot: vi.fn(),
  mockSetE2BApiKeyOverride: vi.fn(),
  mockSetPreferredTemplateOverride: vi.fn(),
}));

vi.mock('@remix-run/cloudflare', () => ({
  json: (data: unknown, init?: number | ResponseInit) =>
    new Response(JSON.stringify(data), {
      status: typeof init === 'number' ? init : init?.status || 200,
      headers: { 'content-type': 'application/json' },
    }),
}));

vi.mock('~/lib/.server/agent-runtime/orchestrator', () => ({
  executeRuntimeTool: mockExecuteTool,
  listRegisteredTools: mockListRegisteredTools,
  listRuntimeEventsSnapshot: mockListRuntimeEventsSnapshot,
}));

vi.mock('~/lib/e2b/sandbox', () => ({
  createSandboxSnapshot: mockCreateSandboxSnapshot,
  flushAutoSnapshot: mockFlushAutoSnapshot,
  listSandboxSnapshots: mockListSandboxSnapshots,
  restoreSandboxFromSnapshot: mockRestoreSandboxFromSnapshot,
  getSnapshotMetadata: mockGetSnapshotMetadata,
  getStoredSnapshotId: mockGetStoredSnapshotId,
  getPreferredTemplate: mockGetPreferredTemplate,
  setPreferredTemplate: mockSetPreferredTemplate,
  clearPreferredTemplate: mockClearPreferredTemplate,
  templateExists: mockTemplateExists,
  getTemplateTags: mockGetTemplateTags,
  assignTemplateTags: mockAssignTemplateTags,
  removeTemplateTags: mockRemoveTemplateTags,
  buildTemplateFromSnapshot: mockBuildTemplateFromSnapshot,
  setE2BApiKeyOverride: mockSetE2BApiKeyOverride,
  setPreferredTemplateOverride: mockSetPreferredTemplateOverride,
}));

import { action, loader } from '~/routes/api.tools';

function createLoaderArgs(url: string, env: Record<string, unknown> = {}) {
  return {
    request: new Request(url),
    context: {
      cloudflare: {
        env,
      },
    },
    params: {},
  } as any;
}

function createActionArgs(body: unknown, method = 'POST', env: Record<string, unknown> = {}) {
  return {
    request: new Request('http://localhost/api/tools', {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    }),
    context: {
      cloudflare: {
        env,
      },
    },
    params: {},
  } as any;
}

async function parseJson(response: Response): Promise<any> {
  return response.json();
}

describe('api.tools route', () => {
  beforeEach(() => {
    mockExecuteTool.mockReset();
    mockListRegisteredTools.mockReset();
    mockListRuntimeEventsSnapshot.mockReset();
    mockCreateSandboxSnapshot.mockReset();
    mockFlushAutoSnapshot.mockReset();
    mockListSandboxSnapshots.mockReset();
    mockRestoreSandboxFromSnapshot.mockReset();
    mockGetSnapshotMetadata.mockReset();
    mockGetStoredSnapshotId.mockReset();
    mockGetPreferredTemplate.mockReset();
    mockSetPreferredTemplate.mockReset();
    mockClearPreferredTemplate.mockReset();
    mockTemplateExists.mockReset();
    mockGetTemplateTags.mockReset();
    mockAssignTemplateTags.mockReset();
    mockRemoveTemplateTags.mockReset();
    mockBuildTemplateFromSnapshot.mockReset();
    mockSetE2BApiKeyOverride.mockReset();
    mockSetPreferredTemplateOverride.mockReset();
  });

  it('applies E2B runtime overrides from env in loader', async () => {
    mockListRegisteredTools.mockReturnValue([]);

    const response = await loader(
      createLoaderArgs(
        'http://localhost/api/tools?action=list',
        {
          E2B_API_KEY: '  env-e2b-key  ',
          E2B_TEMPLATE_ID: '  env-template-id  ',
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mockSetE2BApiKeyOverride).toHaveBeenCalledWith('env-e2b-key');
    expect(mockSetPreferredTemplateOverride).toHaveBeenCalledWith('env-template-id');
  });

  it('applies E2B runtime overrides from env in action', async () => {
    mockExecuteTool.mockResolvedValue({
      sessionId: 'sess-tools-env',
      queued: false,
      task: {
        id: 'task-tools-env',
        sessionId: 'sess-tools-env',
        kind: 'tool',
        status: 'completed',
        output: [],
      },
      data: {
        success: true,
        data: {},
      },
    });

    const response = await action(
      createActionArgs(
        {
          action: 'execute',
          sessionId: 'sess-tools-env',
          toolName: 'browser',
          input: { action: 'navigate', url: 'https://preview.local' },
        },
        'POST',
        {
          E2B_API_KEY: 'action-e2b-key',
          E2B_TEMPLATE_ID: 'action-template-id',
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mockSetE2BApiKeyOverride).toHaveBeenCalledWith('action-e2b-key');
    expect(mockSetPreferredTemplateOverride).toHaveBeenCalledWith('action-template-id');
  });

  it('returns runtime events from loader action=events', async () => {
    mockListRuntimeEventsSnapshot.mockReturnValue([
      { id: 'evt-1', type: 'runtime:tool_started' },
      { id: 'evt-2', type: 'runtime:tool_progress', data: { progressType: 'browser_action_start' } },
    ]);

    const response = await loader(
      createLoaderArgs('http://localhost/api/tools?action=events&sessionId=sess-1&limit=5&afterEventId=evt-0'),
    );

    expect(response.status).toBe(200);

    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.sessionId).toBe('sess-1');
    expect(json.count).toBe(2);
    expect(json.events[1].type).toBe('runtime:tool_progress');

    expect(mockListRuntimeEventsSnapshot).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      afterEventId: 'evt-0',
      limit: 5,
    });
  });

  it('executes browser tool with server runtime overrides and returns envelope', async () => {
    mockExecuteTool.mockResolvedValue({
      sessionId: 'sess-tools-1',
      queued: false,
      task: {
        id: 'task-1',
        sessionId: 'sess-tools-1',
        kind: 'tool',
        status: 'completed',
        output: [],
      },
      data: {
        success: true,
        data: {
          action: 'navigate',
          requestedUrl: 'https://preview.local',
          normalizedUrl: 'https://preview.local/',
          normalizedOrigin: 'https://preview.local',
          finalUrl: 'https://preview.local/',
          status: 200,
          ok: true,
          content: 'ok',
          truncated: false,
          allowedBy: 'preview_scope',
        },
      },
    });

    const response = await action(
      createActionArgs({
        action: 'execute',
        sessionId: 'sess-tools-1',
        toolName: 'browser',
        browserServerUrl: 'https://browser.vps.local',
        browserServerApiKey: 'secret-token',
        previewBaseUrls: ['https://preview.local/app', 'https://preview.local/docs'],
        input: {
          action: 'navigate',
          url: 'https://preview.local',
        },
      }),
    );

    expect(response.status).toBe(200);

    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.sessionId).toBe('sess-tools-1');
    expect(json.task.id).toBe('task-1');

    expect(mockExecuteTool).toHaveBeenCalledTimes(1);
    expect(mockExecuteTool.mock.calls[0][0]).toMatchObject({
      sessionId: 'sess-tools-1',
      toolName: 'browser',
      input: {
        action: 'navigate',
        url: 'https://preview.local',
      },
    });

    expect(mockExecuteTool.mock.calls[0][1]).toMatchObject({
      browserServerUrl: 'https://browser.vps.local',
      browserServerApiKey: 'secret-token',
      previewBaseUrls: ['https://preview.local/app', 'https://preview.local/docs'],
    });
  });

  it('uses browser runtime env variables when body overrides are absent', async () => {
    mockExecuteTool.mockResolvedValue({
      sessionId: 'sess-tools-2',
      queued: false,
      task: {
        id: 'task-2',
        sessionId: 'sess-tools-2',
        kind: 'tool',
        status: 'completed',
        output: [],
      },
      data: {
        success: true,
        data: {
          action: 'navigate',
          requestedUrl: 'https://preview.env.local',
          normalizedUrl: 'https://preview.env.local/',
          normalizedOrigin: 'https://preview.env.local',
          finalUrl: 'https://preview.env.local/',
          status: 200,
          ok: true,
          content: 'ok',
          truncated: false,
          allowedBy: 'preview_scope',
        },
      },
    });

    const response = await action(
      createActionArgs(
        {
          action: 'execute',
          sessionId: 'sess-tools-2',
          toolName: 'browser',
          input: {
            action: 'navigate',
            url: 'https://preview.env.local',
          },
        },
        'POST',
        {
          BROWSER_SERVER_URL: 'https://browser.from.env',
          BROWSER_SERVER_API_KEY: 'env-key',
          BROWSER_PREVIEW_BASE_URLS: 'https://preview.env.local/app, https://preview.env.local/docs',
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mockExecuteTool).toHaveBeenCalledTimes(1);

    expect(mockExecuteTool.mock.calls[0][1]).toMatchObject({
      browserServerUrl: 'https://browser.from.env',
      browserServerApiKey: 'env-key',
      previewBaseUrls: ['https://preview.env.local/app', 'https://preview.env.local/docs'],
    });
  });

  it('returns events from action action=events', async () => {
    mockListRuntimeEventsSnapshot.mockReturnValue([
      {
        id: 'evt-progress',
        type: 'runtime:tool_progress',
        sessionId: 'sess-tools-3',
        taskId: 'task-progress',
        data: {
          toolName: 'browser',
          progressType: 'browser_approval_required',
          progress: { normalizedUrl: 'https://example.com/' },
        },
      },
    ]);

    const response = await action(
      createActionArgs({
        action: 'events',
        sessionId: 'sess-tools-3',
        limit: 10,
      }),
    );

    expect(response.status).toBe(200);

    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.count).toBe(1);
    expect(json.events[0].type).toBe('runtime:tool_progress');
    expect(json.events[0].data.progressType).toBe('browser_approval_required');
  });

  it('returns snapshot metadata from loader', async () => {
    mockGetSnapshotMetadata.mockReturnValue({
      sandboxId: 'sandbox-1',
      snapshotId: 'snapshot-1',
      lastSnapshotAt: 123,
    });
    mockGetPreferredTemplate.mockReturnValue('template-1');
    mockGetStoredSnapshotId.mockReturnValue('snapshot-1');

    const response = await loader(createLoaderArgs('http://localhost/api/tools?action=snapshot_metadata'));

    expect(response.status).toBe(200);

    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.metadata.snapshotId).toBe('snapshot-1');
    expect(json.preferredTemplate).toBe('template-1');
    expect(json.storedSnapshotId).toBe('snapshot-1');
  });

  it('creates snapshot via action snapshot_create', async () => {
    mockCreateSandboxSnapshot.mockResolvedValue({ snapshotId: 'snapshot-2' });

    const response = await action(
      createActionArgs({
        action: 'snapshot_create',
        reason: 'manual_test',
      }),
    );

    expect(response.status).toBe(200);

    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.snapshot.snapshotId).toBe('snapshot-2');
    expect(mockCreateSandboxSnapshot).toHaveBeenCalledWith('manual_test');
  });

  it('sets and clears preferred template', async () => {
    mockGetPreferredTemplate.mockReturnValue('template-new');

    const setResponse = await action(
      createActionArgs({
        action: 'template_set_preferred',
        templateId: 'template-new',
        resetSandbox: true,
      }),
    );

    expect(setResponse.status).toBe(200);
    expect(mockSetPreferredTemplate).toHaveBeenCalledWith('template-new', { resetSandbox: true });

    const clearResponse = await action(
      createActionArgs({
        action: 'template_clear_preferred',
        resetSandbox: false,
      }),
    );

    expect(clearResponse.status).toBe(200);
    expect(mockClearPreferredTemplate).toHaveBeenCalledWith({ resetSandbox: false });
  });

  it('builds template from snapshot with fallback stored snapshot', async () => {
    mockGetStoredSnapshotId.mockReturnValue('snapshot-fallback');
    mockBuildTemplateFromSnapshot.mockResolvedValue({
      templateName: 'my-template',
      templateId: 'tmpl-1',
      buildId: 'build-1',
    });

    const response = await action(
      createActionArgs({
        action: 'template_build_from_snapshot',
        templateName: 'my-template',
        tags: 'stable,prod',
      }),
    );

    expect(response.status).toBe(200);

    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.snapshotId).toBe('snapshot-fallback');
    expect(mockBuildTemplateFromSnapshot).toHaveBeenCalledWith('snapshot-fallback', 'my-template', ['stable', 'prod']);
  });

  it('returns 400 when template_build_from_snapshot has no snapshot available', async () => {
    mockGetStoredSnapshotId.mockReturnValue(null);

    const response = await action(
      createActionArgs({
        action: 'template_build_from_snapshot',
        templateName: 'my-template',
      }),
    );

    expect(response.status).toBe(400);

    const json = await parseJson(response);
    expect(json.success).toBe(false);
    expect(json.error).toContain('snapshotId');
  });
});
