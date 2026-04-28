/**
 * Skills API Route
 * GET: List all registered skills from the agentic system
 */

import { type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { agenticRegistry } from '~/lib/agentic/registry';
import { initializeAgenticSystem } from '~/lib/agentic';

export async function loader({ request }: LoaderFunctionArgs) {
  initializeAgenticSystem();

  const skills = agenticRegistry.getUserInvocableSkills().map((s) => ({
    name: s.name,
    description: s.description,
    aliases: s.aliases || [],
    argumentHint: s.argumentHint || '',
    icon: s.icon || '⚡',
    agentType: s.agentType || 'coder',
    command: `/${s.name}`,
  }));

  return json({ skills, count: skills.length });
}
