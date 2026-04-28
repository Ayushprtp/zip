/**
 * Browser-Based MCP Client
 * Connects to MCP servers via SSE/Streamable HTTP from the browser.
 * Inspired by Claude Code's services/mcp/client.ts.
 */

import type {
  MCPNormalizedError,
  MCPResourceDefinition,
  MCPResourceReadResult,
  MCPResult,
  MCPServerConfig,
  MCPServerState,
  MCPToolDefinition,
} from '../types';

const DEFAULT_CAPABILITIES = { tools: true, resources: false };

/**
 * Connect to an MCP server and fetch its capabilities.
 */
export async function connectMCPServer(config: MCPServerConfig): Promise<MCPServerState> {
  const state: MCPServerState = {
    config,
    status: 'connecting',
    tools: [],
    resources: [],
  };

  try {
    const capabilitiesResult = await fetchServerCapabilities(config);

    if (!capabilitiesResult.success) {
      state.status = 'error';
      state.error = capabilitiesResult.error?.message || 'Failed to fetch MCP capabilities';
      return state;
    }

    const capabilities = capabilitiesResult.data || DEFAULT_CAPABILITIES;

    if (capabilities.tools) {
      const toolsResult = await fetchServerTools(config);
      if (toolsResult.success && toolsResult.data) {
        state.tools = toolsResult.data;
      }
    }

    if (capabilities.resources) {
      const resourcesResult = await listMCPResources(config);
      if (resourcesResult.success && resourcesResult.data) {
        state.resources = resourcesResult.data;
      }
    }

    state.status = 'connected';
  } catch (error: unknown) {
    const normalizedError = normalizeUnknownError(error);
    state.status = 'error';
    state.error = normalizedError.message;
  }

  return state;
}

/**
 * Call an MCP tool on the server.
 */
export async function callMCPTool(
  config: MCPServerConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<MCPResult<unknown>> {
  const url = `${stripTrailingSlash(config.url)}/tools/${encodeURIComponent(toolName)}`;

  const responseResult = await mcpFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ arguments: args }),
  }, config);

  if (!responseResult.success || !responseResult.data) {
    return { success: false, data: null, error: responseResult.error };
  }

  const response = responseResult.data;

  if (!response.ok) {
    return {
      success: false,
      data: null,
      error: await normalizeErrorFromResponse(response, 'MCP tool invocation failed'),
    };
  }

  const jsonResult = await safeJson(response);
  if (!jsonResult.success) {
    return { success: false, data: null, error: jsonResult.error };
  }

  return { success: true, data: jsonResult.data };
}

/**
 * List MCP resources exposed by the server.
 */
export async function listMCPResources(config: MCPServerConfig): Promise<MCPResult<MCPResourceDefinition[]>> {
  const url = `${stripTrailingSlash(config.url)}/resources`;

  const responseResult = await mcpFetch(url, {}, config);
  if (!responseResult.success || !responseResult.data) {
    return { success: false, data: null, error: responseResult.error };
  }

  const response = responseResult.data;
  if (!response.ok) {
    return {
      success: false,
      data: null,
      error: await normalizeErrorFromResponse(response, 'MCP resource listing failed'),
    };
  }

  const jsonResult = await safeJson(response);
  if (!jsonResult.success) {
    return { success: false, data: null, error: jsonResult.error };
  }

  const resourcesPayload = jsonResult.data as any;
  const resources = Array.isArray(resourcesPayload)
    ? resourcesPayload
    : Array.isArray(resourcesPayload?.resources)
      ? resourcesPayload.resources
      : null;

  if (!resources) {
    return {
      success: false,
      data: null,
      error: {
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'MCP resource list response has invalid shape',
        retryable: false,
        details: resourcesPayload,
      },
    };
  }

  return {
    success: true,
    data: resources
      .filter((resource: any) => typeof resource?.uri === 'string')
      .map((resource: any) => ({
        serverName: config.name,
        uri: resource.uri,
        name: resource.name || resource.uri,
        description: resource.description,
        mimeType: resource.mimeType || resource.mime_type,
      })),
  };
}

/**
 * Read an MCP resource from the server.
 */
export async function readMCPResource(config: MCPServerConfig, uri: string): Promise<MCPResult<MCPResourceReadResult>> {
  const encodedUri = encodeURIComponent(uri);
  const slashUrl = `${stripTrailingSlash(config.url)}/resources/${encodedUri}`;

  let responseResult = await mcpFetch(slashUrl, {}, config);

  if (
    responseResult.success &&
    responseResult.data?.status === 404
  ) {
    const queryUrl = `${stripTrailingSlash(config.url)}/resources/read?uri=${encodeURIComponent(uri)}`;
    responseResult = await mcpFetch(queryUrl, {}, config);
  }

  if (!responseResult.success || !responseResult.data) {
    return { success: false, data: null, error: responseResult.error };
  }

  const response = responseResult.data;
  if (!response.ok) {
    return {
      success: false,
      data: null,
      error: await normalizeErrorFromResponse(response, `MCP resource read failed for '${uri}'`),
    };
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const jsonResult = await safeJson(response);
    if (!jsonResult.success) {
      return { success: false, data: null, error: jsonResult.error };
    }

    const payload = jsonResult.data as any;

    if (Array.isArray(payload?.contents) && payload.contents.length > 0) {
      const first = payload.contents[0] as any;
      return {
        success: true,
        data: {
          serverName: config.name,
          uri,
          mimeType: first?.mimeType || first?.mime_type,
          text: typeof first?.text === 'string' ? first.text : undefined,
          contents: payload.contents,
        },
      };
    }

    if (typeof payload?.text === 'string') {
      return {
        success: true,
        data: {
          serverName: config.name,
          uri,
          mimeType: payload?.mimeType || payload?.mime_type,
          text: payload.text,
          contents: payload,
        },
      };
    }

    return {
      success: false,
      data: null,
      error: {
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'MCP resource read response has invalid JSON shape',
        retryable: false,
        details: payload,
      },
    };
  }

  const text = await response.text();
  return {
    success: true,
    data: {
      serverName: config.name,
      uri,
      mimeType: contentType || undefined,
      text,
    },
  };
}

/**
 * Subscribe to MCP server events via SSE.
 */
export function subscribeMCPEvents(
  config: MCPServerConfig,
  onEvent: (event: { type: string; data: unknown }) => void,
): () => void {
  const url = `${stripTrailingSlash(config.url)}/events`;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch {
      // Ignore parse errors
    }
  };

  eventSource.onerror = () => {
    onEvent({ type: 'error', data: { message: 'SSE connection error' } });
  };

  return () => eventSource.close();
}

// ─── Internal Helpers ────────────────────────────────────────────────

async function fetchServerCapabilities(
  config: MCPServerConfig,
): Promise<MCPResult<{ tools?: boolean; resources?: boolean }>> {
  const responseResult = await mcpFetch(`${stripTrailingSlash(config.url)}/capabilities`, {}, config);

  if (!responseResult.success || !responseResult.data) {
    return {
      success: true,
      data: DEFAULT_CAPABILITIES,
    };
  }

  const response = responseResult.data;

  if (!response.ok) {
    return {
      success: true,
      data: DEFAULT_CAPABILITIES,
    };
  }

  const jsonResult = await safeJson(response);
  if (!jsonResult.success || !jsonResult.data || typeof jsonResult.data !== 'object') {
    return {
      success: true,
      data: DEFAULT_CAPABILITIES,
    };
  }

  return {
    success: true,
    data: {
      tools: Boolean((jsonResult.data as any).tools),
      resources: Boolean((jsonResult.data as any).resources),
    },
  };
}

async function fetchServerTools(config: MCPServerConfig): Promise<MCPResult<MCPToolDefinition[]>> {
  const responseResult = await mcpFetch(`${stripTrailingSlash(config.url)}/tools`, {}, config);

  if (!responseResult.success || !responseResult.data) {
    return { success: false, data: null, error: responseResult.error };
  }

  const response = responseResult.data;
  if (!response.ok) {
    return {
      success: false,
      data: null,
      error: await normalizeErrorFromResponse(response, 'MCP tool listing failed'),
    };
  }

  const jsonResult = await safeJson(response);
  if (!jsonResult.success) {
    return { success: false, data: null, error: jsonResult.error };
  }

  const toolsPayload = jsonResult.data as any;
  const tools = Array.isArray(toolsPayload)
    ? toolsPayload
    : Array.isArray(toolsPayload?.tools)
      ? toolsPayload.tools
      : null;

  if (!tools) {
    return {
      success: false,
      data: null,
      error: {
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'MCP tool list response has invalid shape',
        retryable: false,
        details: toolsPayload,
      },
    };
  }

  return {
    success: true,
    data: tools
      .filter((tool: any) => typeof tool?.name === 'string')
      .map((tool: any) => ({
        serverName: config.name,
        name: `mcp__${config.name}__${tool.name}`,
        originalName: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || tool.input_schema || { type: 'object', properties: {} },
      })),
  };
}

async function mcpFetch(
  url: string,
  init: RequestInit,
  config: MCPServerConfig,
): Promise<MCPResult<Response>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...config.headers,
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        ...(init.headers || {}),
      },
    });

    return { success: true, data: response };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: normalizeUnknownError(error),
    };
  }
}

async function safeJson(response: Response): Promise<MCPResult<unknown>> {
  try {
    const data = await response.json();
    return { success: true, data };
  } catch (error: unknown) {
    return {
      success: false,
      data: null,
      error: {
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Failed to parse MCP JSON response',
        status: response.status,
        retryable: false,
        details: normalizeUnknownError(error).message,
      },
    };
  }
}

async function normalizeErrorFromResponse(response: Response, fallbackMessage: string): Promise<MCPNormalizedError> {
  const status = response.status;
  const bodyText = await safeResponseText(response);

  const code =
    status === 401 || status === 403
      ? 'MCP_AUTH_ERROR'
      : status === 404
        ? 'MCP_NOT_FOUND'
        : 'MCP_UPSTREAM_ERROR';

  const kind =
    status === 401 || status === 403
      ? 'auth'
      : 'upstream';

  const message = bodyText || `${fallbackMessage} (status ${status})`;

  return {
    code,
    kind,
    status,
    message,
    retryable: status >= 500,
    details: bodyText || undefined,
  };
}

function normalizeUnknownError(error: unknown): MCPNormalizedError {
  const message = error instanceof Error ? error.message : 'Unknown MCP error';
  const isTransport =
    /fetch|network|timeout|abort|failed to fetch|econnrefused|enotfound/i.test(message);

  return {
    code: isTransport ? 'MCP_TRANSPORT_ERROR' : 'MCP_UNKNOWN_ERROR',
    kind: isTransport ? 'transport' : 'unknown',
    message,
    retryable: isTransport,
    details: error,
  };
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

function stripTrailingSlash(input: string): string {
  return input.endsWith('/') ? input.slice(0, -1) : input;
}
