import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAbortRuntimeExecution,
  mockGetRuntimeTaskOutput,
  mockGetRuntimeTaskSnapshot,
  mockListRuntimeTasksSnapshot,
  mockFetch,
} = vi.hoisted(() => ({
  mockAbortRuntimeExecution: vi.fn(),
  mockGetRuntimeTaskOutput: vi.fn(),
  mockGetRuntimeTaskSnapshot: vi.fn(),
  mockListRuntimeTasksSnapshot: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

vi.mock('@remix-run/cloudflare', () => ({
  json: (data: unknown, init?: number | ResponseInit) =>
    new Response(JSON.stringify(data), {
      status: typeof init === 'number' ? init : init?.status || 200,
      headers: { 'content-type': 'application/json' },
    }),
}));

vi.mock('~/lib/.server/agent-runtime/orchestrator', () => ({
  abortRuntimeExecution: mockAbortRuntimeExecution,
  getRuntimeTaskOutput: mockGetRuntimeTaskOutput,
  getRuntimeTaskSnapshot: mockGetRuntimeTaskSnapshot,
  listRuntimeTasksSnapshot: mockListRuntimeTasksSnapshot,
}));

import { action, loader } from '~/routes/api.tasks';

function createLoaderArgs(url: string, cloudflareEnv: Record<string, unknown> = {}) {
  return {
    request: new Request(url),
    context: {
      cloudflare: {
        env: cloudflareEnv,
      },
    },
    params: {},
  } as any;
}

function createActionArgs(body: unknown, cloudflareEnv: Record<string, unknown> = {}, method = 'POST') {
  return {
    request: new Request('http://localhost/api/tasks', {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    }),
    context: {
      cloudflare: {
        env: cloudflareEnv,
      },
    },
    params: {},
  } as any;
}

async function parseJson(response: Response): Promise<any> {
  return response.json();
}

describe('api.tasks route', () => {
  beforeEach(() => {
    mockAbortRuntimeExecution.mockReset();
    mockGetRuntimeTaskOutput.mockReset();
    mockGetRuntimeTaskSnapshot.mockReset();
    mockListRuntimeTasksSnapshot.mockReset();
    mockFetch.mockReset();
  });

  it('proxies remote trigger list via loader action=remote_trigger', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 'trigger-1', name: 'Nightly run' },
            { id: 'trigger-2', name: 'Daily digest' },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await loader(
      createLoaderArgs(
        'http://localhost/api/tasks?action=remote_trigger&remote_action=list',
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-1' },
      ),
    );

    expect(response.status).toBe(200);
    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.data)).toBe(true);
    expect(json.data.data).toHaveLength(2);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.claude.ai/v1/code/triggers',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      }),
    );
  });

  it('proxies remote trigger run via action action=remote_trigger', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'run-1',
          status: 'queued',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await action(
      createActionArgs(
        {
          action: 'remote_trigger',
          remoteTrigger: {
            action: 'run',
            trigger_id: 'trigger-123',
          },
        },
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-2' },
      ),
    );

    expect(response.status).toBe(200);
    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('run-1');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.claude.ai/v1/code/triggers/trigger-123/run',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-2' }),
      }),
    );
  });

  it('proxies remote trigger get via action action=remote_trigger', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'trigger-123',
          name: 'Nightly run',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await action(
      createActionArgs(
        {
          action: 'remote_trigger',
          remoteTrigger: {
            action: 'get',
            trigger_id: 'trigger-123',
          },
        },
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-get' },
      ),
    );

    expect(response.status).toBe(200);
    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('trigger-123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.claude.ai/v1/code/triggers/trigger-123',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-get' }),
      }),
    );
  });

  it('proxies remote trigger create via action action=remote_trigger', async () => {
    const createBody = {
      name: 'Nightly run',
      cron: '0 2 * * *',
      prompt: 'Run smoke tests',
    };

    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'trigger-new',
          ...createBody,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await action(
      createActionArgs(
        {
          action: 'remote_trigger',
          remoteTrigger: {
            action: 'create',
            body: createBody,
          },
        },
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-create' },
      ),
    );

    expect(response.status).toBe(200);
    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('trigger-new');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.claude.ai/v1/code/triggers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-create' }),
        body: JSON.stringify(createBody),
      }),
    );
  });

  it('proxies remote trigger update via action action=remote_trigger', async () => {
    const updateBody = {
      name: 'Nightly run updated',
    };

    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'trigger-123',
          ...updateBody,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await action(
      createActionArgs(
        {
          action: 'remote_trigger',
          remoteTrigger: {
            action: 'update',
            trigger_id: 'trigger-123',
            body: updateBody,
          },
        },
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-update' },
      ),
    );

    expect(response.status).toBe(200);
    const json = await parseJson(response);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('trigger-123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.claude.ai/v1/code/triggers/trigger-123',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-update' }),
        body: JSON.stringify(updateBody),
      }),
    );
  });

  it('returns upstream non-2xx error for remote trigger get', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'trigger not found',
        }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await action(
      createActionArgs(
        {
          action: 'remote_trigger',
          remoteTrigger: {
            action: 'get',
            trigger_id: 'missing-trigger',
          },
        },
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-get-fail' },
      ),
    );

    expect(response.status).toBe(404);
    const json = await parseJson(response);
    expect(json.success).toBe(false);
    expect(String(json.error)).toContain('trigger not found');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.claude.ai/v1/code/triggers/missing-trigger',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-get-fail' }),
      }),
    );
  });

  it('returns upstream non-2xx error for remote trigger create', async () => {
    const createBody = {
      name: 'Invalid schedule',
      cron: 'bad-cron',
    };

    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'invalid cron expression',
        }),
        {
          status: 422,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await action(
      createActionArgs(
        {
          action: 'remote_trigger',
          remoteTrigger: {
            action: 'create',
            body: createBody,
          },
        },
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-create-fail' },
      ),
    );

    expect(response.status).toBe(422);
    const json = await parseJson(response);
    expect(json.success).toBe(false);
    expect(String(json.error)).toContain('invalid cron expression');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.claude.ai/v1/code/triggers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-create-fail' }),
        body: JSON.stringify(createBody),
      }),
    );
  });

  it('returns upstream non-2xx error for remote trigger update', async () => {
    const updateBody = {
      name: 'Locked trigger',
    };

    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'trigger is locked',
        }),
        {
          status: 409,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await action(
      createActionArgs(
        {
          action: 'remote_trigger',
          remoteTrigger: {
            action: 'update',
            trigger_id: 'trigger-locked',
            body: updateBody,
          },
        },
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-update-fail' },
      ),
    );

    expect(response.status).toBe(409);
    const json = await parseJson(response);
    expect(json.success).toBe(false);
    expect(String(json.error)).toContain('trigger is locked');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.claude.ai/v1/code/triggers/trigger-locked',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-update-fail' }),
        body: JSON.stringify(updateBody),
      }),
    );
  });

  it('returns upstream non-2xx error for remote trigger run', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'trigger execution disabled',
        }),
        {
          status: 403,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await action(
      createActionArgs(
        {
          action: 'remote_trigger',
          remoteTrigger: {
            action: 'run',
            trigger_id: 'trigger-disabled',
          },
        },
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-run-fail' },
      ),
    );

    expect(response.status).toBe(403);
    const json = await parseJson(response);
    expect(json.success).toBe(false);
    expect(String(json.error)).toContain('trigger execution disabled');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.claude.ai/v1/code/triggers/trigger-disabled/run',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-run-fail' }),
      }),
    );
  });

  it('returns 401 when remote trigger auth token is missing', async () => {
    const response = await action(
      createActionArgs({
        action: 'remote_trigger',
        remoteTrigger: {
          action: 'list',
        },
      }),
    );

    expect(response.status).toBe(401);
    const json = await parseJson(response);
    expect(json.success).toBe(false);
    expect(String(json.error)).toContain('auth token is missing');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid remote trigger payload', async () => {
    const response = await action(
      createActionArgs(
        {
          action: 'remote_trigger',
          remoteTrigger: {
            action: 'run',
          },
        },
        { CLAUDE_CODE_OAUTH_TOKEN: 'token-3' },
      ),
    );

    expect(response.status).toBe(400);
    const json = await parseJson(response);
    expect(json.success).toBe(false);
    expect(String(json.error)).toContain('trigger_id is required');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
