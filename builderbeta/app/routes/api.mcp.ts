/**
 * MCP Servers API Route
 * Supports MCP server lifecycle and resource operations.
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import {
  callMCPTool,
  connectMCPServer,
  listMCPResources,
  readMCPResource,
} from '~/lib/agentic/mcp/client';
import type {
  MCPNormalizedError,
  MCPResourceReadResult,
  MCPResult,
  MCPServerConfig,
  MCPServerState,
  MCPToolDefinition,
  MCPResourceDefinition,
} from '~/lib/agentic/types';

const serverRegistry = new Map<string, MCPServerState>();

type MCPRouteAction =
  | 'list'
  | 'get'
  | 'connect'
  | 'disconnect'
  | 'resource_list'
  | 'resource_read'
  | 'tool_call';

interface MCPActionPayload {
  action?: MCPRouteAction;
  serverName?: string;
  config?: MCPServerConfig;
  toolName?: string;
  args?: Record<string, unknown>;
  uri?: string;
  refresh?: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = (url.searchParams.get('action') || 'list') as MCPRouteAction;

  if (action === 'list') {
    return json({ success: true, data: { servers: serializeServers() } });
  }

  if (action === 'get') {
    const serverName = url.searchParams.get('serverName') || undefined;
    if (!serverName) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required query parameter: serverName',
        retryable: false,
      }, 400);
    }

    return getServerResponse(serverName);
  }

  if (action === 'resource_list') {
    const serverName = url.searchParams.get('serverName') || undefined;
    const refresh = url.searchParams.get('refresh') === 'true';

    if (!serverName) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required query parameter: serverName',
        retryable: false,
      }, 400);
    }

    return listResourcesResponse(serverName, refresh);
  }

  if (action === 'resource_read') {
    const serverName = url.searchParams.get('serverName') || undefined;
    const uri = url.searchParams.get('uri') || undefined;

    if (!serverName || !uri) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required query parameters: serverName, uri',
        retryable: false,
      }, 400);
    }

    return readResourceResponse(serverName, uri);
  }

  return errorResponse({
    code: 'MCP_SCHEMA_ERROR',
    kind: 'schema',
    message: `Unsupported action: ${action}`,
    retryable: false,
  }, 400);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return errorResponse({
      code: 'MCP_SCHEMA_ERROR',
      kind: 'schema',
      message: 'Method not allowed',
      retryable: false,
    }, 405);
  }

  if (request.method === 'DELETE') {
    let body: MCPActionPayload;

    try {
      body = await request.json();
    } catch {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Invalid JSON body',
        retryable: false,
      }, 400);
    }

    const serverName = body.serverName;
    if (!serverName) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required field: serverName',
        retryable: false,
      }, 400);
    }

    serverRegistry.delete(serverName);
    return json({
      success: true,
      data: {
        serverName,
        disconnected: true,
      },
    });
  }

  let payload: MCPActionPayload;

  try {
    payload = await request.json();
  } catch {
    return errorResponse({
      code: 'MCP_SCHEMA_ERROR',
      kind: 'schema',
      message: 'Invalid JSON body',
      retryable: false,
    }, 400);
  }

  const actionType = payload.action || 'list';

  if (actionType === 'list') {
    return json({ success: true, data: { servers: serializeServers() } });
  }

  if (actionType === 'get') {
    if (!payload.serverName) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required field: serverName',
        retryable: false,
      }, 400);
    }

    return getServerResponse(payload.serverName);
  }

  if (actionType === 'connect') {
    const config = payload.config;

    if (!config?.name || !config?.url) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required config fields: name, url',
        retryable: false,
      }, 400);
    }

    const state = await connectMCPServer(config);
    serverRegistry.set(config.name, state);

    if (state.status !== 'connected') {
      return errorResponse({
        code: 'MCP_UPSTREAM_ERROR',
        kind: 'upstream',
        message: state.error || `Failed to connect MCP server '${config.name}'`,
        retryable: true,
        details: { serverName: config.name },
      }, 502);
    }

    return json({
      success: true,
      data: {
        server: sanitizeServerState(state),
      },
    });
  }

  if (actionType === 'disconnect') {
    const serverName = payload.serverName;

    if (!serverName) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required field: serverName',
        retryable: false,
      }, 400);
    }

    const existed = serverRegistry.delete(serverName);

    return json({
      success: true,
      data: {
        serverName,
        disconnected: existed,
      },
    });
  }

  if (actionType === 'resource_list') {
    if (!payload.serverName) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required field: serverName',
        retryable: false,
      }, 400);
    }

    return listResourcesResponse(payload.serverName, Boolean(payload.refresh));
  }

  if (actionType === 'resource_read') {
    const serverName = payload.serverName;
    const uri = payload.uri;

    if (!serverName || !uri) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required fields: serverName, uri',
        retryable: false,
      }, 400);
    }

    return readResourceResponse(serverName, uri);
  }

  if (actionType === 'tool_call') {
    const serverName = payload.serverName;
    const toolName = payload.toolName;

    if (!serverName || !toolName) {
      return errorResponse({
        code: 'MCP_SCHEMA_ERROR',
        kind: 'schema',
        message: 'Missing required fields: serverName, toolName',
        retryable: false,
      }, 400);
    }

    const state = serverRegistry.get(serverName);
    if (!state) {
      return errorResponse({
        code: 'MCP_NOT_FOUND',
        kind: 'upstream',
        message: `MCP server '${serverName}' is not connected`,
        retryable: false,
      }, 404);
    }

    const result = await callMCPTool(state.config, toolName, payload.args || {});
    if (!result.success) {
      return errorResponse(result.error || {
        code: 'MCP_UNKNOWN_ERROR',
        kind: 'unknown',
        message: 'Unknown MCP tool call failure',
        retryable: false,
      }, resolveStatusFromError(result.error));
    }

    return json({
      success: true,
      data: {
        serverName,
        toolName,
        result: result.data,
      },
    });
  }

  return errorResponse({
    code: 'MCP_SCHEMA_ERROR',
    kind: 'schema',
    message: `Unsupported action: ${actionType}`,
    retryable: false,
  }, 400);
}

async function listResourcesResponse(serverName: string, refresh: boolean) {
  const state = serverRegistry.get(serverName);

  if (!state) {
    return errorResponse({
      code: 'MCP_NOT_FOUND',
      kind: 'upstream',
      message: `MCP server '${serverName}' is not connected`,
      retryable: false,
    }, 404);
  }

  if (!refresh && state.resources.length > 0) {
    return json({
      success: true,
      data: {
        serverName,
        resources: state.resources,
        count: state.resources.length,
        cached: true,
      },
    });
  }

  const result = await listMCPResources(state.config);
  if (!result.success) {
    return errorResponse(result.error || {
      code: 'MCP_UNKNOWN_ERROR',
      kind: 'unknown',
      message: 'Unknown MCP resource listing failure',
      retryable: false,
    }, resolveStatusFromError(result.error));
  }

  const resources = result.data || [];
  serverRegistry.set(serverName, {
    ...state,
    resources,
    status: 'connected',
    error: undefined,
  });

  return json({
    success: true,
    data: {
      serverName,
      resources,
      count: resources.length,
      cached: false,
    },
  });
}

async function readResourceResponse(serverName: string, uri: string) {
  const state = serverRegistry.get(serverName);

  if (!state) {
    return errorResponse({
      code: 'MCP_NOT_FOUND',
      kind: 'upstream',
      message: `MCP server '${serverName}' is not connected`,
      retryable: false,
    }, 404);
  }

  const result = await readMCPResource(state.config, uri);
  if (!result.success) {
    return errorResponse(result.error || {
      code: 'MCP_UNKNOWN_ERROR',
      kind: 'unknown',
      message: 'Unknown MCP resource read failure',
      retryable: false,
    }, resolveStatusFromError(result.error));
  }

  const resource = result.data as MCPResourceReadResult;
  return json({
    success: true,
    data: {
      serverName,
      resource,
    },
  });
}

function getServerResponse(serverName: string) {
  const state = serverRegistry.get(serverName);

  if (!state) {
    return errorResponse({
      code: 'MCP_NOT_FOUND',
      kind: 'upstream',
      message: `MCP server '${serverName}' not found`,
      retryable: false,
    }, 404);
  }

  return json({
    success: true,
    data: {
      server: sanitizeServerState(state),
    },
  });
}

function sanitizeServerState(state: MCPServerState) {
  const sanitizedConfig: MCPServerConfig = {
    ...state.config,
    apiKey: state.config.apiKey ? '***' : undefined,
  };

  return {
    config: sanitizedConfig,
    status: state.status,
    error: state.error,
    tools: state.tools,
    resources: state.resources,
  };
}

function serializeServers() {
  return Array.from(serverRegistry.values()).map((state) => sanitizeServerState(state));
}

function errorResponse(error: MCPNormalizedError, status = resolveStatusFromError(error)) {
  return json({ success: false, error }, { status });
}

function resolveStatusFromError(error?: MCPNormalizedError): number {
  if (!error) return 500;
  if (typeof error.status === 'number') return error.status;

  switch (error.code) {
    case 'MCP_SCHEMA_ERROR':
      return 400;
    case 'MCP_AUTH_ERROR':
      return 401;
    case 'MCP_NOT_FOUND':
      return 404;
    case 'MCP_TRANSPORT_ERROR':
      return 502;
    case 'MCP_UPSTREAM_ERROR':
      return 502;
    default:
      return 500;
  }
}
