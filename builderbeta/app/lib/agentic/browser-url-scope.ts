import { getBrowserUrlApprovalState } from './stores';

export interface BrowserUrlScopeContext {
  sessionId?: string;
  previewBaseUrls?: string[];
}

export interface BrowserUrlScopeEvaluation {
  normalizedUrl?: string;
  normalizedOrigin?: string;
  isValidUrl: boolean;
  inPreviewScope: boolean;
  hasSessionApproval: boolean;
  hasAllowOnceApproval: boolean;
  allowed: boolean;
}

function normalizeUrl(value: string): string | undefined {
  try {
    return new URL(value).href;
  } catch {
    return undefined;
  }
}

function normalizeOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function normalizePreviewBaseUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value);

    if (!parsed.pathname || parsed.pathname === '/') {
      return `${parsed.origin}/`;
    }

    return parsed.href;
  } catch {
    return undefined;
  }
}

function isSameOrDescendantPath(target: URL, base: URL): boolean {
  if (target.origin !== base.origin) {
    return false;
  }

  if (target.href === base.href) {
    return true;
  }

  if (!target.pathname.startsWith(base.pathname)) {
    return false;
  }

  const nextChar = target.pathname.charAt(base.pathname.length);
  return nextChar === '' || nextChar === '/' || target.search.length > 0 || target.hash.length > 0;
}

function isWithinPreviewScopes(targetUrl: URL, previewBaseUrls: string[]): boolean {
  for (const base of previewBaseUrls) {
    try {
      const baseUrl = new URL(base);

      if (isSameOrDescendantPath(targetUrl, baseUrl)) {
        return true;
      }
    } catch {
      // Ignore malformed preview URLs
    }
  }

  return false;
}

export async function listPreviewBaseUrls(context?: {
  previewBaseUrls?: string[];
}): Promise<string[]> {
  const seen = new Set<string>();
  const values = context?.previewBaseUrls ?? [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizePreviewBaseUrl(value.trim());

    if (normalized) {
      seen.add(normalized);
    }
  }

  return [...seen.values()];
}

export function evaluateBrowserUrlScope(target: string, context: BrowserUrlScopeContext): BrowserUrlScopeEvaluation {
  const normalizedUrl = normalizeUrl(target);

  if (!normalizedUrl) {
    return {
      isValidUrl: false,
      inPreviewScope: false,
      hasSessionApproval: false,
      hasAllowOnceApproval: false,
      allowed: false,
    };
  }

  const normalizedOrigin = normalizeOrigin(normalizedUrl);

  if (!normalizedOrigin) {
    return {
      normalizedUrl,
      isValidUrl: false,
      inPreviewScope: false,
      hasSessionApproval: false,
      hasAllowOnceApproval: false,
      allowed: false,
    };
  }

  const previewBaseUrls = context.previewBaseUrls ?? [];
  const inPreviewScope = isWithinPreviewScopes(new URL(normalizedUrl), previewBaseUrls);

  const approvals = context.sessionId ? getBrowserUrlApprovalState(context.sessionId) : undefined;
  const hasSessionApproval = Boolean(approvals?.sessionApprovedOrigins.includes(normalizedOrigin));
  const hasAllowOnceApproval = Boolean(approvals?.allowedOnceUrls.includes(normalizedUrl));

  return {
    normalizedUrl,
    normalizedOrigin,
    isValidUrl: true,
    inPreviewScope,
    hasSessionApproval,
    hasAllowOnceApproval,
    allowed: inPreviewScope || hasSessionApproval || hasAllowOnceApproval,
  };
}
