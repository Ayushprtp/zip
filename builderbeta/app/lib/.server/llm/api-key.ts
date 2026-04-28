function getNodeEnv() {
  return typeof process !== 'undefined' ? process.env : {};
}

export function getAnthropicAPIKey(cloudflareEnv: any) {
  const env = getNodeEnv();

  return cloudflareEnv?.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
}

export function getOpenAIAPIKey(cloudflareEnv: any) {
  const env = getNodeEnv();

  return cloudflareEnv?.OPENAI_API_KEY || env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY;
}

/**
 * Backwards-compatible helper for legacy call sites.
 * Prefer provider-specific helpers above.
 */
export function getAPIKey(cloudflareEnv: any) {
  return getAnthropicAPIKey(cloudflareEnv) || getOpenAIAPIKey(cloudflareEnv);
}
