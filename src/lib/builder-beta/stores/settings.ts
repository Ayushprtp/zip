/**
 * Builder Beta Settings Store
 * Ported from builderbeta — adapted for Next.js.
 */

import { atom, map } from 'nanostores';

export type PermissionMode = 'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions';

export interface PermissionRule {
  tool: string;
  allow: boolean;
}

export interface PermissionPolicyConfig {
  mode: PermissionMode;
  rules: PermissionRule[];
}

export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlOrMetaKey?: boolean;
  action: () => void;
}

export interface Shortcuts {
  toggleTerminal: Shortcut;
}

export interface Settings {
  shortcuts: Shortcuts;
  selectedModel: string;
}

export const shortcutsStore = map<Shortcuts>({
  toggleTerminal: {
    key: 'j',
    ctrlOrMetaKey: true,
    action: () => {
      // Logic handled via shortcutEventEmitter
    },
  },
});

export const settingsStore = map<Settings>({
  shortcuts: shortcutsStore.get(),
  selectedModel: 'gpt-4o',
});

shortcutsStore.subscribe((shortcuts) => {
  settingsStore.set({
    ...settingsStore.get(),
    shortcuts,
  });
});

export interface PermissionPolicyState {
  mode: PermissionMode;
  rules: PermissionRule[];
  configured: boolean;
}

const DEFAULT_PERMISSION_MODE: PermissionMode = 'default';

export const permissionPolicyStore = atom<PermissionPolicyState>({
  mode: DEFAULT_PERMISSION_MODE,
  rules: [],
  configured: false,
});

export function getPermissionMode(): PermissionMode {
  return permissionPolicyStore.get().mode;
}

export function setPermissionMode(mode: PermissionMode): void {
  permissionPolicyStore.set({
    ...permissionPolicyStore.get(),
    mode,
    configured: true,
  });
}

export function getPermissionPolicyConfig(): PermissionPolicyConfig | undefined {
  const state = permissionPolicyStore.get();

  if (!state.configured) {
    return undefined;
  }

  return {
    mode: state.mode,
    rules: state.rules,
  };
}

export function setPermissionPolicyRules(rules: PermissionRule[]): void {
  permissionPolicyStore.set({
    ...permissionPolicyStore.get(),
    rules,
    configured: true,
  });
}

export function clearPermissionPolicyConfig(): void {
  permissionPolicyStore.set({
    mode: DEFAULT_PERMISSION_MODE,
    rules: [],
    configured: false,
  });
}
