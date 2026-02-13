/**
 * URL validation guard — prevents SSRF attacks by blocking requests
 * to internal/private networks, loopback, link-local, and dangerous schemes.
 */

const BLOCKED_SCHEMES = new Set([
  "file:",
  "ftp:",
  "gopher:",
  "data:",
  "javascript:",
  "vbscript:",
]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "metadata.google",
  "metadata",
]);

/** IPv4 private/reserved CIDR ranges */
const PRIVATE_IPV4_RANGES: [number, number, number][] = [
  // 10.0.0.0/8
  [10, 0, 8],
  // 172.16.0.0/12
  [172, 16, 12],
  // 192.168.0.0/16
  [192, 168, 16],
  // 169.254.0.0/16 (link-local / AWS metadata)
  [169, 254, 16],
  // 127.0.0.0/8 (loopback)
  [127, 0, 8],
  // 0.0.0.0/8
  [0, 0, 8],
];

function ipToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return (nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3];
}

function isPrivateIPv4(ip: string): boolean {
  const num = ipToNumber(ip);
  if (num === null) return false;

  for (const [a, b, cidr] of PRIVATE_IPV4_RANGES) {
    const rangeStart = (a << 24) | (b << 16);
    const mask = ~((1 << (32 - cidr)) - 1);
    if ((num & mask) === (rangeStart & mask)) return true;
  }
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (clean === "::1" || clean === "::") return true;
  if (clean.startsWith("fe80:")) return true; // link-local
  if (clean.startsWith("fc") || clean.startsWith("fd")) return true; // ULA
  if (clean.startsWith("::ffff:")) {
    // IPv4-mapped IPv6
    const v4 = clean.slice(7);
    return isPrivateIPv4(v4);
  }
  return false;
}

export class SSRFError extends Error {
  constructor(url: string, reason: string) {
    super(`Blocked request to ${url}: ${reason}`);
    this.name = "SSRFError";
  }
}

/**
 * Validate a URL is safe to fetch — blocks private IPs, dangerous schemes,
 * and cloud metadata endpoints.
 *
 * @throws {SSRFError} if the URL targets an internal/private resource
 */
export function validateUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SSRFError(rawUrl, "Invalid URL");
  }

  // Block dangerous schemes
  if (BLOCKED_SCHEMES.has(parsed.protocol)) {
    throw new SSRFError(rawUrl, `Blocked scheme: ${parsed.protocol}`);
  }

  // Only allow http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SSRFError(rawUrl, `Only HTTP(S) URLs are allowed`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known dangerous hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SSRFError(rawUrl, `Blocked hostname: ${hostname}`);
  }

  // Block private IPv4 addresses
  if (isPrivateIPv4(hostname)) {
    throw new SSRFError(rawUrl, `Private IP address not allowed`);
  }

  // Block private IPv6 addresses
  if (isPrivateIPv6(hostname)) {
    throw new SSRFError(rawUrl, `Private IPv6 address not allowed`);
  }

  // Block URLs with authentication components (anti-redirect-to-internal)
  if (parsed.username || parsed.password) {
    throw new SSRFError(rawUrl, `URLs with credentials are not allowed`);
  }

  // Block common cloud metadata endpoints
  if (hostname.endsWith(".internal") || hostname.endsWith(".local")) {
    throw new SSRFError(rawUrl, `Internal hostname not allowed`);
  }

  return parsed;
}
