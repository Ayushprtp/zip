/**
 * useSecretsManager — React hook for the Secrets Manager
 *
 * Provides a reactive interface over the encrypted SecretsManager singleton.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  secretsManager,
  PROVIDER_KEY_DEFINITIONS,
  type IntegrationProvider,
  type SecretEntry,
  type SecretsStore,
} from "./secrets-manager";

export interface UseSecretsManagerReturn {
  /** Current store, refreshed automatically */
  store: SecretsStore;
  /** Loading state */
  loading: boolean;
  /** Error (if any) */
  error: string | null;
  /** Set a single secret */
  setSecret: (entry: SecretEntry) => Promise<void>;
  /** Remove a single secret */
  removeSecret: (key: string, provider: IntegrationProvider) => Promise<void>;
  /** Get all secrets for a provider */
  getProviderSecrets: (provider: IntegrationProvider) => SecretEntry[];
  /** Build the full env-vars JSON */
  buildEnvVarsJson: () => Promise<Record<string, string>>;
  /** Build .env file content */
  buildEnvFileContent: (providers?: IntegrationProvider[]) => Promise<string>;
  /** Check if a provider is configured */
  isProviderConfigured: (provider: IntegrationProvider) => boolean;
  /** Clear all secrets for a provider */
  clearProvider: (provider: IntegrationProvider) => Promise<void>;
  /** Clear all secrets */
  clearAll: () => Promise<void>;
  /** Reload from storage */
  reload: () => Promise<void>;
  /** Provider key definitions (for building forms) */
  providerKeyDefs: typeof PROVIDER_KEY_DEFINITIONS;
}

export function useSecretsManager(): UseSecretsManagerReturn {
  const [store, setStore] = useState<SecretsStore>({
    version: 1,
    entries: [],
    updatedAt: Date.now(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loaded = await secretsManager.load();
      setStore({ ...loaded });
    } catch (err: any) {
      setError(err.message || "Failed to load secrets");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      reload();
    }
  }, [reload]);

  const setSecret = useCallback(
    async (entry: SecretEntry) => {
      try {
        setError(null);
        await secretsManager.setSecret(entry);
        await reload();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [reload],
  );

  const removeSecret = useCallback(
    async (key: string, provider: IntegrationProvider) => {
      try {
        setError(null);
        await secretsManager.removeSecret(key, provider);
        await reload();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [reload],
  );

  const getProviderSecrets = useCallback(
    (provider: IntegrationProvider): SecretEntry[] => {
      return store.entries.filter((e) => e.provider === provider);
    },
    [store.entries],
  );

  const isProviderConfigured = useCallback(
    (provider: IntegrationProvider): boolean => {
      return store.entries.some(
        (e) => e.provider === provider && e.value && e.value.length > 0,
      );
    },
    [store.entries],
  );

  const clearProvider = useCallback(
    async (provider: IntegrationProvider) => {
      try {
        setError(null);
        await secretsManager.clearProvider(provider);
        await reload();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [reload],
  );

  const clearAll = useCallback(async () => {
    try {
      setError(null);
      await secretsManager.clearAll();
      await reload();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [reload]);

  const buildEnvVarsJson = useCallback(async () => {
    return secretsManager.buildEnvVarsJson();
  }, []);

  const buildEnvFileContent = useCallback(
    async (providers?: IntegrationProvider[]) => {
      return secretsManager.buildEnvFileContent(providers);
    },
    [],
  );

  return {
    store,
    loading,
    error,
    setSecret,
    removeSecret,
    getProviderSecrets,
    buildEnvVarsJson,
    buildEnvFileContent,
    isProviderConfigured,
    clearProvider,
    clearAll,
    reload,
    providerKeyDefs: PROVIDER_KEY_DEFINITIONS,
  };
}
