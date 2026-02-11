/**
 * localStorage-based storage for chains
 *
 * Structure: { [chain_id]: ChainFull, [chain_id]: ChainFull, ... }
 */

import type { ChainFull, ChainMeta } from "../types/chain";

const STORAGE_KEY = "httpchain_chains";

type ChainsMap = Record<string, ChainFull>;

function generateUUID(): string {
  return crypto.randomUUID();
}

function getChains(): ChainsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ChainsMap;
  } catch {
    return {};
  }
}

function saveChains(chains: ChainsMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chains));
}

// Get all chains metadata
export async function getChainsMeta(): Promise<ChainMeta[]> {
  const chains = getChains();
  return Object.values(chains).map(
    ({ id, name, tags, created_at, updated_at }) => ({
      id,
      name,
      tags,
      created_at,
      updated_at,
    }),
  );
}

// Get a single chain by ID - O(1)
export async function getChain(id: string): Promise<ChainFull> {
  const chains = getChains();
  const chain = chains[id];
  if (!chain) {
    throw new Error(`Chain ${id} not found`);
  }
  return chain;
}

// Create a new chain
export async function createChain(name: string): Promise<ChainFull> {
  const chains = getChains();
  const now = new Date().toISOString();
  const id = generateUUID();

  const newChain: ChainFull = {
    id,
    name,
    version: 1,
    steps: [],
    chain_variables: [],
    tags: [],
    created_at: now,
    updated_at: now,
  };

  chains[id] = newChain;
  saveChains(chains);

  return newChain;
}

// Delete a chain by ID - O(1)
export async function deleteChain(
  id: string,
): Promise<{ deleted: number; id?: string }> {
  const chains = getChains();
  if (!chains[id]) {
    return { deleted: 0 };
  }

  delete chains[id];
  saveChains(chains);

  return { deleted: 1, id };
}

// Delete all chains
export async function deleteAllChains(): Promise<{ deleted: number }> {
  const chains = getChains();
  const count = Object.keys(chains).length;
  saveChains({});
  return { deleted: count };
}

// Update a chain - O(1)
export async function updateChain(
  id: string,
  data: {
    name?: string;
    steps?: any[];
    chain_variables?: string[];
    tags?: string[];
  },
): Promise<ChainFull> {
  const chains = getChains();
  const chain = chains[id];
  if (!chain) {
    throw new Error(`Chain ${id} not found`);
  }

  const updated: ChainFull = {
    ...chain,
    ...data,
    updated_at: new Date().toISOString(),
  };

  chains[id] = updated;
  saveChains(chains);

  return updated;
}

// Export all chains as JSON
export function exportAllChains(): string {
  const chains = getChains();
  return JSON.stringify(chains, null, 2);
}

// Import chains from JSON (merges with existing)
export async function importChains(
  jsonString: string,
): Promise<{ imported: number }> {
  const importedChains = JSON.parse(jsonString) as ChainsMap;
  const existingChains = getChains();

  // Merge imported chains (imported overwrites existing if same ID)
  const merged = { ...existingChains, ...importedChains };
  saveChains(merged);

  return { imported: Object.keys(importedChains).length };
}
