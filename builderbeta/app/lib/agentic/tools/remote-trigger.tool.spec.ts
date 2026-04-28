import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolUseContext } from '../types';
import { RemoteTriggerTool } from './remote-trigger.tool';

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

const baseContext: ToolUseContext = {
  sessionId: 'session-1',
  workDir: '/home/project',
};

describe('RemoteTriggerTool', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns validation error for run action without trigger_id', async () => {
    const result = await RemoteTriggerTool.execute(
      {
        action: 'run',
      },
      baseContext,
    );

    expect(result.success).toBe(false);
    expect(result.data.status).toBe(400);
    expect(String(result.error)).toContain('trigger_id is required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns parse error when route response is not valid JSON', async () => {
    mockFetch.mockResolvedValue(
      new Response('not-json', {
        status: 502,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    const result = await RemoteTriggerTool.execute(
      {
        action: 'list',
      },
      baseContext,
    );

    expect(result.success).toBe(false);
    expect(result.data.status).toBe(502);
    expect(String(result.error)).toContain('Failed to parse /api/tasks remote_trigger response');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns network error when route request throws', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await RemoteTriggerTool.execute(
      {
        action: 'list',
      },
      baseContext,
    );

    expect(result.success).toBe(false);
    expect(result.data.status).toBe(0);
    expect(result.error).toBe('network down');
  });

  it('returns successful data from route response', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'trigger-1',
            name: 'Nightly run',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const result = await RemoteTriggerTool.execute(
      {
        action: 'get',
        trigger_id: 'trigger-1',
      },
      baseContext,
    );

    expect(result.success).toBe(true);
    expect(result.data.status).toBe(200);
    expect(result.data.data).toEqual({
      id: 'trigger-1',
      name: 'Nightly run',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
