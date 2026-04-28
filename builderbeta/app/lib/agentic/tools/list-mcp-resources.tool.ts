/**
 * List MCP Resources Tool — list resources from a connected MCP server.
 */

import type { Tool, ToolResult, ToolUseContext, MCPResourceDefinition, MCPNormalizedError } from '../types';

export interface ListMCPResourcesInput {
  serverName: string;
  refresh?: boolean;
  endpoint?: string;
}

export interface ListMCPResourcesOutput {
  serverName: string;
  resources: MCPResourceDefinition[];
  count: number;
  cached: boolean;
}

interface MCPRouteSuccess<T> {
  success: true;
  data: T;
}

interface MCPRouteFailure {
  success: false;
  error: MCPNormalizedError;
}

export const ListMCPResourcesTool: Tool<ListMCPResourcesInput, ListMCPResourcesOutput> = {
  name: 'list_mcp_resources',
  displayName: 'List MCP Resources',
  description: 'List available MCP resources from a connected MCP server via /api/mcp.',

  inputSchema: {
    type: 'object',
    properties: {
      serverName: { type: 'string', description: 'Connected MCP server name' },
      refresh: { type: 'boolean', description: 'Force a fresh resource fetch from upstream server' },
      endpoint: { type: 'string', description: 'MCP API route endpoint (default: /api/mcp)' },
    },
    required: ['serverName'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'mcp',
  searchHint: 'mcp resources list server uri',

  async execute(input: ListMCPResourcesInput, context: ToolUseContext): Promise<ToolResult<ListMCPResourcesOutput>> {
    const endpoint = input.endpoint || '/api/mcp';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resource_list',
          serverName: input.serverName,
          refresh: input.refresh ?? false,
        }),
        signal: context.abortSignal,
      });

      const payload = (await response.json()) as MCPRouteSuccess<ListMCPResourcesOutput> | MCPRouteFailure;

      if (!response.ok || payload.success === false) {
        const routeError = payload && 'error' in payload ? payload.error : undefined;
        return {
          success: false,
          data: {
            serverName: input.serverName,
            resources: [],
            count: 0,
            cached: false,
          },
          error: routeError?.message || `Failed to list MCP resources (status ${response.status})`,
        };
      }

      return {
        success: true,
        data: payload.data,
      };
    } catch (error: unknown) {
      return {
        success: false,
        data: {
          serverName: input.serverName,
          resources: [],
          count: 0,
          cached: false,
        },
        error: error instanceof Error ? error.message : 'Unknown MCP resource listing error',
      };
    }
  },
};
