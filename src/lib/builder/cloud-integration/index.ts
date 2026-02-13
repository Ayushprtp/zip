/**
 * Cloud Integration Hub — Barrel Export
 */

export {
  SecretsManager,
  secretsManager,
  PROVIDER_KEY_DEFINITIONS,
} from "./secrets-manager";
export type {
  IntegrationProvider,
  SecretEntry,
  SecretsStore,
} from "./secrets-manager";

export { useSecretsManager } from "./use-secrets-manager";
export type { UseSecretsManagerReturn } from "./use-secrets-manager";

export { CloudService, cloudService } from "./cloud-service";
export type {
  DeploymentState,
  DeploymentStatus,
  VercelProjectInfo,
  PushResult,
  FrameworkPreset,
} from "./cloud-service";

export {
  injectFirebaseBackend,
  injectSupabaseBackend,
  injectBackend,
} from "./backend-templates";
export type { BackendInjectionResult } from "./backend-templates";
