/**
 * Extracts the domain from a URL string
 */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const urlWithProtocol =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;

    const urlObj = new URL(urlWithProtocol);
    return urlObj.hostname;
  } catch {
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
    return match ? match[1] : null;
  }
}

export function getFaviconUrl(
  domain: string | null,
  size: number = 32,
): string | null {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

export function getStepFaviconUrl(
  requestUrl: string | null | undefined,
  size: number = 32,
): string | null {
  const domain = extractDomain(requestUrl);
  return getFaviconUrl(domain, size);
}
