/**
 * Tool, Agent, and Skill Registry
 * Central registry for all tools, agents, and skills in the agentic system.
 */

import type { Tool, AgentDefinition, SkillDefinition } from './types';

class AgenticRegistry {
  private tools = new Map<string, Tool>();
  private agents = new Map<string, AgentDefinition>();
  private skills = new Map<string, SkillDefinition>();

  // ─── Tools ──────────────────────────────────────────────────────────

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  registerTools(tools: Tool[]) {
    tools.forEach(t => this.registerTool(t));
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: string): Tool[] {
    return this.getAllTools().filter(t => t.category === category);
  }

  // ─── Agents ─────────────────────────────────────────────────────────

  registerAgent(agent: AgentDefinition) {
    this.agents.set(agent.agentType, agent);
  }

  registerAgents(agents: AgentDefinition[]) {
    agents.forEach(a => this.registerAgent(a));
  }

  getAgent(type: string): AgentDefinition | undefined {
    return this.agents.get(type);
  }

  getAllAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  // ─── Skills ──────────────────────────────────────────────────────────

  registerSkill(skill: SkillDefinition) {
    this.skills.set(skill.name, skill);
    // Also register aliases
    if (skill.aliases) {
      for (const alias of skill.aliases) {
        this.skills.set(alias, skill);
      }
    }
  }

  registerSkills(skills: SkillDefinition[]) {
    skills.forEach(s => this.registerSkill(s));
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): SkillDefinition[] {
    // Deduplicate (aliases point to same skill)
    const seen = new Set<string>();
    const result: SkillDefinition[] = [];

    for (const skill of this.skills.values()) {
      if (!seen.has(skill.name)) {
        seen.add(skill.name);
        result.push(skill);
      }
    }

    return result;
  }

  getUserInvocableSkills(): SkillDefinition[] {
    return this.getAllSkills().filter(s => s.userInvocable !== false);
  }
}

export const agenticRegistry = new AgenticRegistry();
