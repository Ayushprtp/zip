/**
 * Secrets Manager — Encrypted Browser-Side Key Store
 *
 * Security model:
 *  - Secrets are AES-GCM encrypted before writing to localStorage.
 *  - The encryption key is derived once per session and stored in sessionStorage
 *    (so it's wiped when the tab closes).
 *  - Keys are NEVER sent to the server or stored in any database.
 *  - They are injected into project files / API calls only on demand.
 */

"use client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type IntegrationProvider = "firebase" | "supabase" | "vercel" | "github";

export interface SecretEntry {
  key: string; // e.g. "REACT_APP_SUPABASE_URL"
  value: string;
  provider: IntegrationProvider;
  label: string; // human-readable label
}

export interface SecretsStore {
  version: number;
  entries: SecretEntry[];
  updatedAt: number;
}

/** Map of provider ➜ required key definitions */
export const PROVIDER_KEY_DEFINITIONS: Record<
  IntegrationProvider,
  { key: string; label: string; placeholder: string }[]
> = {
  firebase: [
    {
      key: "NEXT_PUBLIC_FIREBASE_API_KEY",
      label: "API Key",
      placeholder: "AIzaSy...",
    },
    {
      key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      label: "Auth Domain",
      placeholder: "myapp.firebaseapp.com",
    },
    {
      key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      label: "Project ID",
      placeholder: "my-project-id",
    },
    {
      key: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      label: "Storage Bucket",
      placeholder: "my-project.appspot.com",
    },
    {
      key: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      label: "Messaging Sender ID",
      placeholder: "123456789",
    },
    {
      key: "NEXT_PUBLIC_FIREBASE_APP_ID",
      label: "App ID",
      placeholder: "1:123456789:web:abc123",
    },
  ],
  supabase: [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Project URL",
      placeholder: "https://abc.supabase.co",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Anon / Public Key",
      placeholder: "eyJhb...",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Service Role Key (optional)",
      placeholder: "eyJhb...",
    },
  ],
  vercel: [
    {
      key: "VERCEL_TOKEN",
      label: "Vercel Access Token",
      placeholder: "VrCl_...",
    },
    {
      key: "VERCEL_TEAM_ID",
      label: "Team ID (optional)",
      placeholder: "team_...",
    },
  ],
  github: [
    {
      key: "GITHUB_TOKEN",
      label: "Personal Access Token",
      placeholder: "ghp_xxxxxxxxxxxx",
    },
  ],
};

// ─── Encryption Helpers (AES-GCM via Web Crypto) ─────────────────────────────

const STORAGE_KEY = "flare_cloud_secrets_encrypted";
const SESSION_KEY = "flare_cloud_secrets_session_key";
const SALT = new TextEncoder().encode("FlareIDE-SecretsManager-v1");

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  // Store as base64:  iv (12 bytes) + ciphertext
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encoded: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

/** Get (or create) a per-session passphrase stored in sessionStorage */
function getSessionPassphrase(): string {
  if (typeof window === "undefined") return "server-side-noop";

  let passphrase = sessionStorage.getItem(SESSION_KEY);
  if (!passphrase) {
    passphrase = crypto.randomUUID() + crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, passphrase);
  }
  return passphrase;
}

// ─── SecretsManager Class ────────────────────────────────────────────────────

export class SecretsManager {
  private cache: SecretsStore | null = null;
  private keyPromise: Promise<CryptoKey> | null = null;

  private async getKey(): Promise<CryptoKey> {
    if (!this.keyPromise) {
      this.keyPromise = deriveKey(getSessionPassphrase());
    }
    return this.keyPromise;
  }

  /** Load and decrypt the store from localStorage */
  async load(): Promise<SecretsStore> {
    if (this.cache) return this.cache;

    if (typeof window === "undefined") {
      return { version: 1, entries: [], updatedAt: Date.now() };
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const empty: SecretsStore = {
        version: 1,
        entries: [],
        updatedAt: Date.now(),
      };
      this.cache = empty;
      return empty;
    }

    try {
      const key = await this.getKey();
      const json = await decrypt(raw, key);
      this.cache = JSON.parse(json) as SecretsStore;
      return this.cache;
    } catch {
      // If decryption fails (new session), return empty
      const empty: SecretsStore = {
        version: 1,
        entries: [],
        updatedAt: Date.now(),
      };
      this.cache = empty;
      return empty;
    }
  }

  /** Encrypt and persist the store to localStorage */
  async save(store: SecretsStore): Promise<void> {
    if (typeof window === "undefined") return;

    const key = await this.getKey();
    const json = JSON.stringify(store);
    const encrypted = await encrypt(json, key);
    localStorage.setItem(STORAGE_KEY, encrypted);
    this.cache = store;
  }

  /** Set a single secret entry */
  async setSecret(entry: SecretEntry): Promise<void> {
    const store = await this.load();
    const idx = store.entries.findIndex(
      (e) => e.key === entry.key && e.provider === entry.provider,
    );
    if (idx >= 0) {
      store.entries[idx] = entry;
    } else {
      store.entries.push(entry);
    }
    store.updatedAt = Date.now();
    await this.save(store);
  }

  /** Remove a secret by key + provider */
  async removeSecret(
    key: string,
    provider: IntegrationProvider,
  ): Promise<void> {
    const store = await this.load();
    store.entries = store.entries.filter(
      (e) => !(e.key === key && e.provider === provider),
    );
    store.updatedAt = Date.now();
    await this.save(store);
  }

  /** Get secrets for a specific provider */
  async getProviderSecrets(
    provider: IntegrationProvider,
  ): Promise<SecretEntry[]> {
    const store = await this.load();
    return store.entries.filter((e) => e.provider === provider);
  }

  /** Get a single secret value */
  async getSecretValue(
    key: string,
    provider: IntegrationProvider,
  ): Promise<string | undefined> {
    const store = await this.load();
    return store.entries.find((e) => e.key === key && e.provider === provider)
      ?.value;
  }

  /**
   * Build a flat env-vars JSON object from all stored secrets.
   * Output format: { "NEXT_PUBLIC_FIREBASE_API_KEY": "...", ... }
   */
  async buildEnvVarsJson(): Promise<Record<string, string>> {
    const store = await this.load();
    const envVars: Record<string, string> = {};
    for (const entry of store.entries) {
      if (entry.value) {
        envVars[entry.key] = entry.value;
      }
    }
    return envVars;
  }

  /**
   * Build env file content (KEY=VALUE per line)
   * Suitable for .env.local / .env files
   */
  async buildEnvFileContent(
    providers?: IntegrationProvider[],
  ): Promise<string> {
    const store = await this.load();
    const lines: string[] = [
      "# Auto-generated by Flare IDE Cloud Integration Hub",
      `# Generated at: ${new Date().toISOString()}`,
      "",
    ];

    const entries = providers
      ? store.entries.filter((e) => providers.includes(e.provider))
      : store.entries;

    // Group by provider
    const groups = new Map<IntegrationProvider, SecretEntry[]>();
    for (const entry of entries) {
      if (!entry.value) continue;
      const arr = groups.get(entry.provider) || [];
      arr.push(entry);
      groups.set(entry.provider, arr);
    }

    for (const [provider, providerEntries] of groups) {
      lines.push(`# ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
      for (const entry of providerEntries) {
        lines.push(`${entry.key}=${entry.value}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /** Check if a provider has any configured secrets */
  async isProviderConfigured(provider: IntegrationProvider): Promise<boolean> {
    const secrets = await this.getProviderSecrets(provider);
    return secrets.some((s) => s.value && s.value.length > 0);
  }

  /** Clear all secrets for a provider */
  async clearProvider(provider: IntegrationProvider): Promise<void> {
    const store = await this.load();
    store.entries = store.entries.filter((e) => e.provider !== provider);
    store.updatedAt = Date.now();
    await this.save(store);
  }

  /** Clear all secrets */
  async clearAll(): Promise<void> {
    const empty: SecretsStore = {
      version: 1,
      entries: [],
      updatedAt: Date.now(),
    };
    await this.save(empty);
  }
}

// Singleton instance
export const secretsManager = new SecretsManager();
