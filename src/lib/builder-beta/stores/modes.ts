/**
 * Builder Beta Modes Store
 * Ported from builderbeta — adapted for Next.js.
 */

import { atom } from 'nanostores';
import type { PermissionMode } from './settings';
import { getPermissionMode, setPermissionMode } from './settings';

export type NativeMode = 'planning' | 'auto';

export interface RuntimeModeState {
  nativeMode: NativeMode;
  permissionMode: PermissionMode;
  isPlanning: boolean;
}

export interface PlanModePermissionMetadata {
  allowedPromptPermissions: string[];
  recordedAt: number;
  source?: string;
  note?: string;
}

export const activeMode = atom<NativeMode>('auto');
export const lastPlanModePermissionMetadata = atom<PlanModePermissionMetadata | null>(null);

export function getMode(): NativeMode {
  return activeMode.get();
}

export function isPlanningMode(): boolean {
  return getMode() === 'planning';
}

export function setMode(mode: NativeMode) {
  activeMode.set(mode);
}

export function getRuntimeModeState(): RuntimeModeState {
  const nativeMode = getMode();

  return {
    nativeMode,
    permissionMode: getCurrentPermissionMode(),
    isPlanning: nativeMode === 'planning',
  };
}

export function enterPlanningMode(): RuntimeModeState {
  setMode('planning');
  setCurrentPermissionMode('plan');
  return getRuntimeModeState();
}

export function exitPlanningMode(metadata?: Omit<PlanModePermissionMetadata, 'recordedAt'>): RuntimeModeState {
  setMode('auto');
  setCurrentPermissionMode('default');

  if (metadata) {
    lastPlanModePermissionMetadata.set({
      ...metadata,
      recordedAt: Date.now(),
    });
  }

  return getRuntimeModeState();
}

export function getLastPlanModePermissionMetadata(): PlanModePermissionMetadata | null {
  return lastPlanModePermissionMetadata.get();
}

export const MODES: Record<NativeMode, { label: string; icon: string; description: string }> = {
  planning: {
    label: 'Planning Mode',
    icon: 'i-ph:notebook-bold',
    description: 'Expert brainstorming & architecture. The AI will output step-by-step implementation plans before any code.',
  },
  auto: {
    label: 'Autonomous Mode',
    icon: 'i-ph:magic-wand-bold',
    description: 'Full autonomy. The AI will architect, build, and test your project with minimal input.',
  },
};

export const PERMISSION_MODES: readonly PermissionMode[] = [
  'default',
  'plan',
  'acceptEdits',
  'dontAsk',
  'bypassPermissions',
] as const;

export function getCurrentPermissionMode(): PermissionMode {
  return getPermissionMode();
}

export function setCurrentPermissionMode(mode: PermissionMode): void {
  setPermissionMode(mode);
}
