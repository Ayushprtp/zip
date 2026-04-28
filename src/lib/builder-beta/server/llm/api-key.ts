/**
 * API Key helpers for Builder Beta LLM integration.
 * Ported from builderbeta Cloudflare workers to Next.js server-side.
 * All keys are read from process.env (no Cloudflare context needed).
 */

export function getAnthropicAPIKey() {
  return process.env.ANTHROPIC_API_KEY;
}

export function getOpenAIAPIKey() {
  return process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
}

/**
 * Backwards-compatible helper for legacy call sites.
 * Prefer provider-specific helpers above.
 */
export function getAPIKey() {
  return getAnthropicAPIKey() || getOpenAIAPIKey();
}
