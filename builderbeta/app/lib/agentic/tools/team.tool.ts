/**
 * Team Management Tools — Agent Swarm Coordination
 * Inspired by Claude Code's TeamCreateTool/TeamDeleteTool
 *
 * Allows creating and managing teams of agents that coordinate
 * via shared task lists and messaging.
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { generateId } from '../executor';

// ─── In-memory team store ────────────────────────────────────────────

export interface TeamMember {
  agentId: string;
  name: string;
  agentType: string;
  joinedAt: number;
  status: 'active' | 'idle' | 'stopped';
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  leadAgentId: string;
  members: TeamMember[];
  createdAt: number;
  status: 'active' | 'completed' | 'disbanded';
}

const teams = new Map<string, Team>();

// ─── TeamCreate ──────────────────────────────────────────────────────

export interface TeamCreateInput {
  /** Name for the new team */
  team_name: string;
  /** Team description/purpose */
  description?: string;
}

export const TeamCreateTool: Tool<TeamCreateInput, Team> = {
  name: 'team_create',
  displayName: 'Create Team',
  description: `Create a new team to coordinate multiple agents working on a project.

## When to Use
- Complex tasks that benefit from parallel work by multiple agents
- Multi-step projects with research, planning, and coding phases
- Full-stack features needing frontend and backend work simultaneously

## Team Workflow
1. **Create a team** with TeamCreate
2. **Create tasks** using task_create for the team's work items
3. **Spawn agents** using the agent tool — they become team members
4. **Coordinate** using send_message between team members
5. **Complete** when all tasks are done`,

  inputSchema: {
    type: 'object',
    properties: {
      team_name: { type: 'string', description: 'Name for the new team' },
      description: { type: 'string', description: 'Team description/purpose' },
    },
    required: ['team_name'],
  },

  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'team',
  searchHint: 'create team swarm agents coordinate',

  async execute(input: TeamCreateInput, context: ToolUseContext): Promise<ToolResult<Team>> {
    const { team_name, description } = input;

    // Check for existing team with same name
    for (const team of teams.values()) {
      if (team.name === team_name && team.status === 'active') {
        return {
          success: false,
          data: team,
          error: `Team "${team_name}" already exists and is active.`,
        };
      }
    }

    const leadAgentId = context.agentId || `lead-${generateId()}`;

    const team: Team = {
      id: `team-${generateId()}`,
      name: team_name,
      description,
      leadAgentId,
      members: [
        {
          agentId: leadAgentId,
          name: 'team-lead',
          agentType: 'coordinator',
          joinedAt: Date.now(),
          status: 'active',
        },
      ],
      createdAt: Date.now(),
      status: 'active',
    };

    teams.set(team.id, team);

    return { success: true, data: team };
  },
};

// ─── TeamDelete ──────────────────────────────────────────────────────

export interface TeamDeleteInput {
  /** Team ID or team name to disband */
  team_id: string;
}

export const TeamDeleteTool: Tool<TeamDeleteInput, { teamId: string; disbanded: boolean }> = {
  name: 'team_delete',
  displayName: 'Delete Team',
  description: 'Disband a team, stopping all member agents and cleaning up resources.',

  inputSchema: {
    type: 'object',
    properties: {
      team_id: { type: 'string', description: 'Team ID or team name to disband' },
    },
    required: ['team_id'],
  },

  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'team',
  searchHint: 'delete disband team stop agents',

  async execute(input: TeamDeleteInput, _context: ToolUseContext): Promise<ToolResult<{ teamId: string; disbanded: boolean }>> {
    // Try by ID first, then by name
    let team = teams.get(input.team_id);
    if (!team) {
      for (const t of teams.values()) {
        if (t.name === input.team_id) {
          team = t;
          break;
        }
      }
    }

    if (!team) {
      return {
        success: false,
        data: { teamId: input.team_id, disbanded: false },
        error: `Team '${input.team_id}' not found`,
      };
    }

    team.status = 'disbanded';
    team.members.forEach(m => { m.status = 'stopped'; });

    return { success: true, data: { teamId: team.id, disbanded: true } };
  },
};

/** Get all active teams */
export function getActiveTeams(): Team[] {
  return Array.from(teams.values()).filter(t => t.status === 'active');
}

/** Add a member to a team */
export function addTeamMember(teamId: string, member: TeamMember): boolean {
  const team = teams.get(teamId);
  if (!team || team.status !== 'active') return false;
  team.members.push(member);
  return true;
}
