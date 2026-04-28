import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolUseContext } from '../types';

const {
  mockFetch,
  mockEvaluateBrowserUrlScope,
  mockListPreviewBaseUrls,
  mockAskUserQuestionExecute,
  mockAddBrowserAllowedOnceUrl,
  mockAddSessionApprovedBrowserOrigin,
  mockConsumeBrowserAllowedOnceUrl,
  mockEnqueueBrowserExtensionCommand,
} = vi.hoisted(() => ({
  mockFetch: vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(),
  mockEvaluateBrowserUrlScope: vi.fn(),
  mockListPreviewBaseUrls: vi.fn(),
  mockAskUserQuestionExecute: vi.fn(),
  mockAddBrowserAllowedOnceUrl: vi.fn(),
  mockAddSessionApprovedBrowserOrigin: vi.fn(),
  mockConsumeBrowserAllowedOnceUrl: vi.fn(),
  mockEnqueueBrowserExtensionCommand: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

vi.mock('../browser-url-scope', () => ({
  evaluateBrowserUrlScope: mockEvaluateBrowserUrlScope,
  listPreviewBaseUrls: mockListPreviewBaseUrls,
}));

vi.mock('../stores', () => ({
  addBrowserAllowedOnceUrl: mockAddBrowserAllowedOnceUrl,
  addSessionApprovedBrowserOrigin: mockAddSessionApprovedBrowserOrigin,
  consumeBrowserAllowedOnceUrl: mockConsumeBrowserAllowedOnceUrl,
}));

vi.mock('../browser-extension-bridge', () => ({
  enqueueBrowserExtensionCommand: mockEnqueueBrowserExtensionCommand,
}));

vi.mock('./ask-user-question.tool', () => ({
  AskUserQuestionTool: {
    execute: mockAskUserQuestionExecute,
  },
}));

import { BrowserTool } from './browser.tool';

const baseContext: ToolUseContext = {
  sessionId: 'session-1',
  taskId: 'task-1',
  workDir: '/home/project',
  browserServerUrl: 'https://browser.local',
};

describe('BrowserTool', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockEvaluateBrowserUrlScope.mockReset();
    mockListPreviewBaseUrls.mockReset();
    mockAskUserQuestionExecute.mockReset();
    mockAddBrowserAllowedOnceUrl.mockReset();
    mockAddSessionApprovedBrowserOrigin.mockReset();
    mockConsumeBrowserAllowedOnceUrl.mockReset();
    mockEnqueueBrowserExtensionCommand.mockReset();

    mockListPreviewBaseUrls.mockResolvedValue(['https://preview.local']);
  });

  function mockAllowedScope(inPreviewScope = true) {
    mockEvaluateBrowserUrlScope.mockImplementation((url: string) => {
      const parsed = new URL(url);

      return {
        normalizedUrl: parsed.href,
        normalizedOrigin: parsed.origin,
        isValidUrl: true,
        inPreviewScope,
        hasSessionApproval: false,
        hasAllowOnceApproval: false,
        allowed: true,
      };
    });
  }

  function mockSuccessResponse(data: Record<string, unknown>) {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
  }

  function getPostedPayload() {
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [endpoint, init] = mockFetch.mock.calls[0] as [string, RequestInit];

    return {
      endpoint,
      init,
      payload: JSON.parse(init.body as string),
    };
  }

  it('allows preview-scope URL without asking approval', async () => {
    mockAllowedScope(true);

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      title: 'Preview',
      content: 'Hello preview',
    });

    const result = await BrowserTool.execute(
      {
        action: 'extract_text',
        url: 'https://preview.local/app',
      },
      baseContext,
    );

    expect(result.success).toBe(true);
    expect(mockAskUserQuestionExecute).not.toHaveBeenCalled();
    expect(result.data.allowedBy).toBe('preview_scope');
    expect(result.data.title).toBe('Preview');
    expect(result.data.content).toContain('Hello preview');
  });

  it('prefers extension bridge when bridge session is configured', async () => {
    mockAllowedScope(true);

    mockEnqueueBrowserExtensionCommand.mockResolvedValue({
      success: true,
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      title: 'Extension Preview',
      content: 'From extension',
    });

    const result = await BrowserTool.execute(
      {
        action: 'extract_text',
        url: 'https://preview.local/app',
      },
      {
        ...baseContext,
        browserExtensionBridgeSessionId: 'bridge-1',
        browserExtensionName: 'Flare Browser agent',
      },
    );

    expect(result.success).toBe(true);
    expect(mockEnqueueBrowserExtensionCommand).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();

    expect(mockEnqueueBrowserExtensionCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        bridgeSessionId: 'bridge-1',
        action: 'extract_text',
        url: 'https://preview.local/app',
      }),
    );

    expect(result.data.title).toBe('Extension Preview');
    expect(result.data.content).toContain('From extension');
  });

  it('falls back to browser server when extension bridge execution fails', async () => {
    mockAllowedScope(true);

    mockEnqueueBrowserExtensionCommand.mockRejectedValue(new Error('Flare Browser agent timeout'));

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      content: 'Fallback server response',
    });

    const onProgress = vi.fn();

    const result = await BrowserTool.execute(
      {
        action: 'navigate',
        url: 'https://preview.local/app',
      },
      {
        ...baseContext,
        browserExtensionBridgeSessionId: 'bridge-1',
      },
      onProgress,
    );

    expect(result.success).toBe(true);
    expect(mockEnqueueBrowserExtensionCommand).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_extension_fallback',
        data: expect.objectContaining({
          action: 'navigate',
          reason: 'Flare Browser agent timeout',
        }),
      }),
    );

    expect(result.data.content).toContain('Fallback server response');
  });

  it('emits browser progress events for a successful preview flow', async () => {
    mockAllowedScope(true);

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      title: 'Preview',
      content: 'Hello preview',
    });

    const onProgress = vi.fn();

    const result = await BrowserTool.execute(
      {
        action: 'extract_text',
        url: 'https://preview.local/app',
      },
      baseContext,
      onProgress,
    );

    expect(result.success).toBe(true);

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_scope_check_start',
        data: expect.objectContaining({ phase: 'initial', url: 'https://preview.local/app' }),
      }),
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_scope_check_complete',
        data: expect.objectContaining({ phase: 'initial', allowedBy: 'preview_scope' }),
      }),
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_action_start',
      }),
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_server_request_start',
      }),
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_server_response_received',
        data: expect.objectContaining({ status: 200 }),
      }),
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_response_received',
        data: expect.objectContaining({ status: 200 }),
      }),
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_extract_complete',
      }),
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_action_complete',
      }),
    );
  });

  it('emits extension progress events for a successful extension flow', async () => {
    mockAllowedScope(true);

    mockEnqueueBrowserExtensionCommand.mockResolvedValue({
      success: true,
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      title: 'Extension Preview',
      content: 'From extension',
    });

    const onProgress = vi.fn();

    const result = await BrowserTool.execute(
      {
        action: 'extract_text',
        url: 'https://preview.local/app',
      },
      {
        ...baseContext,
        browserExtensionBridgeSessionId: 'bridge-1',
      },
      onProgress,
    );

    expect(result.success).toBe(true);

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_extension_request_start',
        data: expect.objectContaining({ action: 'extract_text', bridgeSessionId: 'bridge-1' }),
      }),
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_extension_response_received',
        data: expect.objectContaining({ action: 'extract_text', bridgeSessionId: 'bridge-1', status: 200 }),
      }),
    );
  });

  it('requests approval and persists allow-once decision', async () => {
    mockEvaluateBrowserUrlScope
      .mockReturnValueOnce({
        normalizedUrl: 'https://example.com/',
        normalizedOrigin: 'https://example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: false,
        allowed: false,
      })
      .mockReturnValueOnce({
        normalizedUrl: 'https://example.com/',
        normalizedOrigin: 'https://example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: true,
        allowed: true,
      })
      .mockReturnValueOnce({
        normalizedUrl: 'https://example.com/',
        normalizedOrigin: 'https://example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: true,
        allowed: true,
      });

    mockAskUserQuestionExecute.mockResolvedValue({
      success: true,
      data: {
        requestId: 'q1',
        status: 'answered',
        answers: [{ questionId: 'browser_url_approval', selectedOption: 'Allow once' }],
        message: 'ok',
      },
    });

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://example.com/',
      content: 'External page',
    });

    const result = await BrowserTool.execute(
      {
        action: 'extract_text',
        url: 'https://example.com/',
      },
      baseContext,
    );

    expect(result.success).toBe(true);
    expect(mockAskUserQuestionExecute).toHaveBeenCalledTimes(1);
    expect(mockAddBrowserAllowedOnceUrl).toHaveBeenCalledWith('session-1', 'https://example.com/');
    expect(mockConsumeBrowserAllowedOnceUrl).toHaveBeenCalledWith('session-1', 'https://example.com/');
    expect(result.data.allowedBy).toBe('allow_once');
  });

  it('persists allow-origin decision for session', async () => {
    mockEvaluateBrowserUrlScope
      .mockReturnValueOnce({
        normalizedUrl: 'https://docs.example.com/page',
        normalizedOrigin: 'https://docs.example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: false,
        allowed: false,
      })
      .mockReturnValueOnce({
        normalizedUrl: 'https://docs.example.com/page',
        normalizedOrigin: 'https://docs.example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: true,
        hasAllowOnceApproval: false,
        allowed: true,
      })
      .mockReturnValueOnce({
        normalizedUrl: 'https://docs.example.com/page',
        normalizedOrigin: 'https://docs.example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: true,
        hasAllowOnceApproval: false,
        allowed: true,
      });

    mockAskUserQuestionExecute.mockResolvedValue({
      success: true,
      data: {
        requestId: 'q2',
        status: 'answered',
        answers: [{ questionId: 'browser_url_approval', selectedOption: 'Allow this origin for this session' }],
        message: 'ok',
      },
    });

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://docs.example.com/page',
      content: 'docs',
    });

    const result = await BrowserTool.execute(
      {
        action: 'extract_text',
        url: 'https://docs.example.com/page',
      },
      baseContext,
    );

    expect(result.success).toBe(true);
    expect(mockAddSessionApprovedBrowserOrigin).toHaveBeenCalledWith('session-1', 'https://docs.example.com');
    expect(mockAddBrowserAllowedOnceUrl).not.toHaveBeenCalled();
    expect(result.data.allowedBy).toBe('session_origin');
  });

  it('emits approval-related progress events when approval is required', async () => {
    mockEvaluateBrowserUrlScope
      .mockReturnValueOnce({
        normalizedUrl: 'https://example.com/',
        normalizedOrigin: 'https://example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: false,
        allowed: false,
      })
      .mockReturnValueOnce({
        normalizedUrl: 'https://example.com/',
        normalizedOrigin: 'https://example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: true,
        allowed: true,
      })
      .mockReturnValueOnce({
        normalizedUrl: 'https://example.com/',
        normalizedOrigin: 'https://example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: true,
        allowed: true,
      });

    mockAskUserQuestionExecute.mockResolvedValue({
      success: true,
      data: {
        requestId: 'q-approval',
        status: 'answered',
        answers: [{ questionId: 'browser_url_approval', selectedOption: 'Allow once' }],
        message: 'ok',
      },
    });

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://example.com/',
      content: 'External page',
    });

    const onProgress = vi.fn();

    const result = await BrowserTool.execute(
      {
        action: 'navigate',
        url: 'https://example.com/',
      },
      baseContext,
      onProgress,
    );

    expect(result.success).toBe(true);

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_approval_required',
        data: expect.objectContaining({ normalizedUrl: 'https://example.com/' }),
      }),
    );

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_approval_resolved',
        data: expect.objectContaining({ decision: 'allow_once' }),
      }),
    );
  });

  it('sends click payload to browser server /actions', async () => {
    mockAllowedScope();

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      content: 'clicked',
    });

    const result = await BrowserTool.execute(
      {
        action: 'click',
        url: 'https://preview.local/app',
        selector: '#submit',
      },
      baseContext,
    );

    expect(result.success).toBe(true);

    const { endpoint, init, payload } = getPostedPayload();
    expect(endpoint).toBe('https://browser.local/actions');
    expect(init.method).toBe('POST');
    expect(payload).toMatchObject({
      action: 'click',
      url: 'https://preview.local/app',
      selector: '#submit',
    });
  });

  it('sends tap payload to browser server /actions', async () => {
    mockAllowedScope();

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      content: 'tapped',
    });

    const result = await BrowserTool.execute(
      {
        action: 'tap',
        url: 'https://preview.local/app',
        selector: '.card',
      },
      baseContext,
    );

    expect(result.success).toBe(true);

    const { payload } = getPostedPayload();
    expect(payload).toMatchObject({
      action: 'tap',
      url: 'https://preview.local/app',
      selector: '.card',
    });
  });

  it('sends type payload to browser server /actions', async () => {
    mockAllowedScope();

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      content: 'typed',
    });

    const result = await BrowserTool.execute(
      {
        action: 'type',
        url: 'https://preview.local/app',
        selector: 'input[name="email"]',
        text: 'user@example.com',
      },
      baseContext,
    );

    expect(result.success).toBe(true);

    const { payload } = getPostedPayload();
    expect(payload).toMatchObject({
      action: 'type',
      url: 'https://preview.local/app',
      selector: 'input[name="email"]',
      text: 'user@example.com',
    });
  });

  it('sends scroll payload to browser server /actions', async () => {
    mockAllowedScope();

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      content: 'scrolled',
    });

    const result = await BrowserTool.execute(
      {
        action: 'scroll',
        url: 'https://preview.local/app',
        selector: '.list',
        x: 10,
        y: 20,
        delta_x: 30,
        delta_y: 40,
      },
      baseContext,
    );

    expect(result.success).toBe(true);

    const { payload } = getPostedPayload();
    expect(payload).toMatchObject({
      action: 'scroll',
      url: 'https://preview.local/app',
      selector: '.list',
      x: 10,
      y: 20,
      deltaX: 30,
      deltaY: 40,
    });
  });

  it('sends wait_for payload to browser server /actions', async () => {
    mockAllowedScope();

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      content: 'ready',
    });

    const result = await BrowserTool.execute(
      {
        action: 'wait_for',
        url: 'https://preview.local/app',
        selector: '#ready',
      },
      baseContext,
    );

    expect(result.success).toBe(true);

    const { payload } = getPostedPayload();
    expect(payload).toMatchObject({
      action: 'wait_for',
      url: 'https://preview.local/app',
      selector: '#ready',
      waitFor: 'selector',
    });
  });

  it('sends capture_console payload with clamped limit', async () => {
    mockAllowedScope();

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      logs: [{ level: 'info', message: 'hello' }],
    });

    const result = await BrowserTool.execute(
      {
        action: 'capture_console',
        url: 'https://preview.local/app',
        limit: 9999,
      },
      baseContext,
    );

    expect(result.success).toBe(true);
    expect(result.data.content).toContain('hello');

    const { payload } = getPostedPayload();
    expect(payload).toMatchObject({
      action: 'capture_console',
      url: 'https://preview.local/app',
      limit: 500,
    });
  });

  it('sends capture_network payload with clamped limit', async () => {
    mockAllowedScope();

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://preview.local/app',
      entries: [{ url: 'https://api.local/data' }],
    });

    const result = await BrowserTool.execute(
      {
        action: 'capture_network',
        url: 'https://preview.local/app',
        limit: 0,
      },
      baseContext,
    );

    expect(result.success).toBe(true);
    expect(result.data.content).toContain('https://api.local/data');

    const { payload } = getPostedPayload();
    expect(payload).toMatchObject({
      action: 'capture_network',
      url: 'https://preview.local/app',
      limit: 1,
    });
  });

  it('fails when click selector is missing', async () => {
    mockAllowedScope();

    const result = await BrowserTool.execute(
      {
        action: 'click',
        url: 'https://preview.local/app',
      },
      baseContext,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('requires a non-empty selector');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockEnqueueBrowserExtensionCommand).not.toHaveBeenCalled();
  });

  it('fails when type text is missing', async () => {
    mockAllowedScope();

    const result = await BrowserTool.execute(
      {
        action: 'type',
        url: 'https://preview.local/app',
        selector: '#field',
      },
      baseContext,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('requires text');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockEnqueueBrowserExtensionCommand).not.toHaveBeenCalled();
  });

  it('does not fail when question UI consumer is unavailable', async () => {
    mockEvaluateBrowserUrlScope
      .mockReturnValueOnce({
        normalizedUrl: 'https://example.com/',
        normalizedOrigin: 'https://example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: false,
        allowed: false,
      })
      .mockReturnValueOnce({
        normalizedUrl: 'https://example.com/',
        normalizedOrigin: 'https://example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: true,
        allowed: true,
      })
      .mockReturnValueOnce({
        normalizedUrl: 'https://example.com/',
        normalizedOrigin: 'https://example.com',
        isValidUrl: true,
        inPreviewScope: false,
        hasSessionApproval: false,
        hasAllowOnceApproval: true,
        allowed: true,
      });

    mockAskUserQuestionExecute.mockResolvedValue({
      success: true,
      data: {
        requestId: 'q-ui-off',
        status: 'answered',
        answers: [{ questionId: 'browser_url_approval', selectedOption: 'Allow once' }],
        message: 'ok',
      },
    });

    mockSuccessResponse({
      status: 200,
      ok: true,
      finalUrl: 'https://example.com/',
      content: 'External page',
    });

    const result = await BrowserTool.execute(
      {
        action: 'navigate',
        url: 'https://example.com/',
      },
      baseContext,
    );

    expect(result.success).toBe(true);
    expect(mockAskUserQuestionExecute).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.data.allowedBy).toBe('allow_once');
  });

  it('emits browser_error progress when approval is denied', async () => {
    mockEvaluateBrowserUrlScope.mockReturnValue({
      normalizedUrl: 'https://blocked.example/',
      normalizedOrigin: 'https://blocked.example',
      isValidUrl: true,
      inPreviewScope: false,
      hasSessionApproval: false,
      hasAllowOnceApproval: false,
      allowed: false,
    });

    mockAskUserQuestionExecute.mockResolvedValue({
      success: true,
      data: {
        requestId: 'q4',
        status: 'answered',
        answers: [{ questionId: 'browser_url_approval', selectedOption: 'Deny' }],
        message: 'no',
      },
    });

    const onProgress = vi.fn();

    const result = await BrowserTool.execute(
      {
        action: 'navigate',
        url: 'https://blocked.example/',
      },
      baseContext,
      onProgress,
    );

    expect(result.success).toBe(false);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'browser_error',
        data: expect.objectContaining({ phase: 'initial_approval' }),
      }),
    );
  });

  it('rejects invalid URL from scope evaluator', async () => {
    mockEvaluateBrowserUrlScope.mockReturnValue({
      isValidUrl: false,
      inPreviewScope: false,
      hasSessionApproval: false,
      hasAllowOnceApproval: false,
      allowed: false,
    });

    const result = await BrowserTool.execute(
      {
        action: 'navigate',
        url: 'not-a-url',
      },
      baseContext,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid URL');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockEnqueueBrowserExtensionCommand).not.toHaveBeenCalled();
  });
});
