import { JSONSchema7 } from "json-schema";
import { tool as createTool } from "ai";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";
import globalLogger from "logger";
import { validateUrl } from "../url-guard";

const logger = globalLogger.withDefaults({
  message: "[WebAgent] ",
});

// ---------------------------------------------------------------------------
// Schema: Deep web page reading / scraping
// ---------------------------------------------------------------------------
export const webPageReaderSchema: JSONSchema7 = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "The URL of the web page to read and extract content from",
    },
    maxLength: {
      type: "number",
      description: "Maximum number of characters to return from the page",
      default: 15000,
      minimum: 500,
      maximum: 50000,
    },
    includeLinks: {
      type: "boolean",
      description: "Whether to include links found on the page in the result",
      default: false,
    },
    includeImages: {
      type: "boolean",
      description:
        "Whether to include image URLs and alt text found on the page",
      default: false,
    },
  },
  required: ["url"],
};

// ---------------------------------------------------------------------------
// Schema: Multi-step web research
// ---------------------------------------------------------------------------
export const webResearchSchema: JSONSchema7 = {
  type: "object",
  properties: {
    topic: {
      type: "string",
      description:
        "The topic or question to research across the internet. Be specific and include key terms.",
    },
    depth: {
      type: "string",
      enum: ["quick", "standard", "deep"],
      description:
        "Research depth: 'quick' searches once, 'standard' does 2-3 searches, 'deep' does 5+ searches and cross-references",
      default: "standard",
    },
    sources: {
      type: "number",
      description: "Number of sources to consult (3-20)",
      default: 5,
      minimum: 3,
      maximum: 20,
    },
    focusDomains: {
      type: "array",
      items: { type: "string" },
      description:
        "Optional list of domains to focus research on (e.g., ['arxiv.org', 'github.com'])",
    },
  },
  required: ["topic"],
};

// ---------------------------------------------------------------------------
// Schema: Screenshot / visual capture of a URL
// ---------------------------------------------------------------------------
export const webScreenshotSchema: JSONSchema7 = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "The URL to capture a screenshot of",
    },
    fullPage: {
      type: "boolean",
      description: "Capture full scrollable page or just the viewport",
      default: false,
    },
  },
  required: ["url"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags and normalise whitespace */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract links from HTML */
function extractLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = match[1];
      if (href.startsWith("#") || href.startsWith("javascript:")) continue;
      const absoluteUrl = new URL(href, baseUrl).toString();
      links.push(absoluteUrl);
    } catch {
      // skip invalid URLs
    }
  }
  return [...new Set(links)].slice(0, 50);
}

/** Extract images from HTML */
function extractImages(
  html: string,
  baseUrl: string,
): { url: string; alt: string }[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const altRegex = /alt=["']([^"']*)["']/i;
  const images: { url: string; alt: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    try {
      const src = match[1];
      if (src.startsWith("data:")) continue;
      const absoluteUrl = new URL(src, baseUrl).toString();
      const altMatch = altRegex.exec(match[0]);
      images.push({ url: absoluteUrl, alt: altMatch?.[1] || "" });
    } catch {
      // skip invalid URLs
    }
  }
  return images.slice(0, 30);
}

/** Extract page title */
function extractTitle(html: string): string {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return titleMatch ? stripHtml(titleMatch[1]).trim() : "";
}

/** Extract meta description */
function extractDescription(html: string): string {
  const metaMatch =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(
      html,
    );
  return metaMatch ? metaMatch[1].trim() : "";
}

// ---------------------------------------------------------------------------
// Tool: Web Page Reader — deep content extraction from any URL
// ---------------------------------------------------------------------------
export const webPageReaderTool = createTool({
  description: `Read and extract content from any web page URL. Returns the page's text content, title, metadata, and optionally links and images. Use this to read articles, documentation, blog posts, product pages, research papers, and any other web content. Supports any publicly accessible URL.`,
  inputSchema: jsonSchemaToZod(webPageReaderSchema),
  execute: async ({
    url,
    maxLength = 15000,
    includeLinks = false,
    includeImages = false,
  }) => {
    logger.info(`📖 webPageReader: fetching ${url}`);
    const startTime = Date.now();
    return safe(async () => {
      // SSRF protection — block internal/private network requests
      validateUrl(url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; FlareBot/1.0; +https://flare-sh.tech)",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "";

        // Handle non-HTML content
        if (contentType.includes("application/json")) {
          const json = await response.json();
          return {
            title: "JSON Response",
            url,
            content: JSON.stringify(json, null, 2).slice(0, maxLength),
            contentType: "json",
          };
        }

        if (
          contentType.includes("text/plain") ||
          contentType.includes("text/csv")
        ) {
          const text = await response.text();
          return {
            title: "Plain Text",
            url,
            content: text.slice(0, maxLength),
            contentType: "text",
          };
        }

        const html = await response.text();
        logger.info(
          `📖 webPageReader: received ${html.length} bytes from ${url}`,
        );
        const title = extractTitle(html);
        const description = extractDescription(html);
        const textContent = stripHtml(html).slice(0, maxLength);

        const result: Record<string, any> = {
          title: title || "Untitled",
          description,
          url,
          content: textContent,
          contentType: "html",
          wordCount: textContent.split(/\s+/).length,
        };

        if (includeLinks) {
          result.links = extractLinks(html, url);
          logger.info(
            `📖 webPageReader: extracted ${result.links.length} links`,
          );
        }
        if (includeImages) {
          result.images = extractImages(html, url);
          logger.info(
            `📖 webPageReader: extracted ${result.images.length} images`,
          );
        }

        logger.info(
          `✅ webPageReader: done in ${Date.now() - startTime}ms — "${title}" (${result.wordCount} words)`,
        );
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        logger.error(`❌ webPageReader: failed for ${url} — ${error}`);
        throw error;
      }
    })
      .ifFail((err) => ({
        isError: true,
        error: err.message,
        url,
        solution: `Failed to read the web page. Possible causes: the site blocks automated access, CORS restrictions, timeout, or the URL is invalid. Try the HTTP tool as an alternative, or search for the content using web search.`,
      }))
      .unwrap();
  },
});

// ---------------------------------------------------------------------------
// Tool: Web Research — multi-step topic research via TheAgenticBrowser
// ---------------------------------------------------------------------------
const BROWSER_BASE_URL =
  process.env.AGENTIC_BROWSER_URL || "http://127.0.0.1:8000";
const BROWSER_API_KEY = process.env.AGENTIC_BROWSER_API_KEY || "";

/**
 * Helper: execute a single browser task and parse SSE stream.
 */
async function executeBrowserSearch(
  command: string,
  timeoutSec = 90,
): Promise<{ result: string | null; steps: string[] }> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (BROWSER_API_KEY) {
      headers["Authorization"] = `Bearer ${BROWSER_API_KEY}`;
      headers["x-api-key"] = BROWSER_API_KEY;
    }

    const response = await fetch(`${BROWSER_BASE_URL}/execute_task`, {
      method: "POST",
      headers,
      body: JSON.stringify({ command }),
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!response.ok) {
      throw new Error(`Browser returned HTTP ${response.status}`);
    }

    const text = await response.text();
    const events = text
      .split("\n\n")
      .filter((b) => b.startsWith("data: "))
      .map((b) => {
        try {
          return JSON.parse(b.replace(/^data: /, ""));
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const steps: string[] = [];
    const errors: string[] = [];
    let finalResult: string | null = null;

    for (const ev of events) {
      const msg = ev.message || "";
      const type = (ev.type || "").toLowerCase();
      if (type === "final" || type === "complete") finalResult = msg;
      else if (type === "error") errors.push(msg);
      else if (type === "step" || type === "info") steps.push(msg);
    }

    if (errors.length && !finalResult) throw new Error(errors.join("\n"));
    return {
      result: finalResult || steps[steps.length - 1] || "No results",
      steps,
    };
  } catch (err: any) {
    clearTimeout(tid);
    if (err.name === "AbortError")
      throw new Error(`Browser task timed out after ${timeoutSec}s`);
    throw err;
  }
}

export const webResearchTool = createTool({
  description: `Perform in-depth web research on any topic using a real browser agent. This tool executes multiple search queries via TheAgenticBrowser, gathers content from multiple sources, and synthesises findings into a comprehensive research report. Use this for questions requiring thorough investigation, fact-checking across sources, or gathering comprehensive information on a subject.`,
  inputSchema: jsonSchemaToZod(webResearchSchema),
  execute: async ({ topic, depth = "standard", sources = 5, focusDomains }) => {
    logger.info(
      `🔬 webResearch: starting research on "${topic}" (depth: ${depth}, sources: ${sources})`,
    );
    const startTime = Date.now();
    return safe(async () => {
      // Generate search queries based on depth
      const queries = generateResearchQueries(topic, depth);
      const allResults: any[] = [];

      for (const query of queries) {
        logger.info(`🔬 webResearch: searching "${query}"`);
        try {
          const domainHint = focusDomains?.length
            ? ` Focus on these domains: ${focusDomains.join(", ")}.`
            : "";
          const command = `Go to Google and search for "${query}".${domainHint} Extract the top ${Math.min(sources, 10)} results. For each result, extract the title, URL, and a detailed snippet (up to 2000 characters of content from each page). Return structured data.`;

          const browserResult = await executeBrowserSearch(command, 90);
          allResults.push({
            query,
            result: browserResult.result,
            steps: browserResult.steps,
          });
        } catch {
          // Continue with other queries if one fails
        }
      }

      logger.info(
        `✅ webResearch: done in ${Date.now() - startTime}ms — ${allResults.length} queries completed`,
      );
      return {
        topic,
        depth,
        queriesUsed: queries,
        sourcesReturned: allResults.length,
        sources: allResults,
        guide:
          "Synthesise the information from all sources into a comprehensive answer. Cite sources by including the URL. If sources conflict, note the discrepancy and present the most reliable/recent information.",
      };
    })
      .ifFail((err) => ({
        isError: true,
        error: err.message,
        topic,
        solution:
          "Web research failed. Ensure TheAgenticBrowser is running. Try using the webSearch tool for a simpler search, or the webPageReader tool to read specific URLs directly.",
      }))
      .unwrap();
  },
});

function generateResearchQueries(topic: string, depth: string): string[] {
  const queries = [topic];

  if (depth === "quick") return queries;

  // Standard: add a few variations
  queries.push(`${topic} explained`);
  queries.push(`${topic} latest developments 2025 2026`);

  if (depth === "deep") {
    queries.push(`${topic} research findings`);
    queries.push(`${topic} expert analysis opinions`);
    queries.push(`${topic} pros cons comparison`);
    queries.push(`${topic} case studies examples`);
  }

  return queries;
}

// ---------------------------------------------------------------------------
// Tool: Web Screenshot — capture visual snapshot of pages
// ---------------------------------------------------------------------------
export const webScreenshotTool = createTool({
  description: `Capture a screenshot of any web page. Returns a visual snapshot of how the page looks. Useful for seeing page layouts, visual content, charts, or any visual information that's hard to capture as text.`,
  inputSchema: jsonSchemaToZod(webScreenshotSchema),
  execute: async ({ url, fullPage = false }) => {
    logger.info(`📸 webScreenshot: capturing ${url} (fullPage: ${fullPage})`);
    const startTime = Date.now();
    return safe(async () => {
      // SSRF protection — block internal/private network requests
      validateUrl(url);

      // Use Microlink API for screenshots
      const apiUrl = new URL("https://api.microlink.io/");
      apiUrl.searchParams.set("url", url);
      apiUrl.searchParams.set("screenshot", "true");
      if (fullPage) {
        apiUrl.searchParams.set("screenshot.fullPage", "true");
      }
      apiUrl.searchParams.set("meta", "false");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(apiUrl.toString(), {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Screenshot service returned ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== "success") {
          throw new Error(
            data.message || "Screenshot service returned an error",
          );
        }

        const imageUrl = data?.data?.screenshot?.url;

        if (!imageUrl) {
          throw new Error("Screenshot service did not return an image");
        }

        logger.info(
          `✅ webScreenshot: done in ${Date.now() - startTime}ms — ${data.data.screenshot.width}x${data.data.screenshot.height}`,
        );
        return {
          url,
          screenshotUrl: imageUrl,
          width: data.data.screenshot.width,
          height: data.data.screenshot.height,
          guide: `Screenshot captured successfully. The image shows the visual appearance of ${url}. You can show the screenshot to the user using markdown: ![Screenshot](${imageUrl})`,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        logger.error(`❌ webScreenshot: failed for ${url} — ${error}`);
        throw error;
      }
    })
      .ifFail((err) => ({
        isError: true,
        error: err.message,
        url,
        solution:
          "Screenshot capture failed. The page may be blocking automated access or the service is temporarily unavailable. Try using the webPageReader tool to get the page content as text instead.",
      }))
      .unwrap();
  },
});

// ---------------------------------------------------------------------------
// Schema: Browser Automation via TheAgenticBrowser
// ---------------------------------------------------------------------------
export const browserAutomationSchema: JSONSchema7 = {
  type: "object",
  properties: {
    command: {
      type: "string",
      description:
        "A natural-language command describing the browser task to perform. Be specific and include all relevant details. Examples: 'Find the price of RTX 4090 on amazon.com', 'Fill out the contact form on example.com with name John Doe and email john@test.com', 'Navigate to github.com/TheAgenticAI and list all public repositories'.",
    },
    timeout: {
      type: "number",
      description:
        "Maximum time in seconds to wait for the task to complete. Default is 120 seconds.",
      default: 120,
      minimum: 10,
      maximum: 600,
    },
  },
  required: ["command"],
};

// ---------------------------------------------------------------------------
// Tool: Browser Automation — full browser control via TheAgenticBrowser
// ---------------------------------------------------------------------------
const AGENTIC_BROWSER_BASE_URL =
  process.env.AGENTIC_BROWSER_URL || "http://127.0.0.1:8000";
const AGENTIC_BROWSER_API_KEY = process.env.AGENTIC_BROWSER_API_KEY || "";

export const browserAutomationTool = createTool({
  description: `Automate real browser interactions using a headless browser agent. This tool can navigate websites, click buttons, fill forms, extract data, handle authentication flows, interact with dynamic JavaScript-heavy pages, and perform any task a human user would do in a browser. It uses an AI-powered multi-agent system (Planner → Browser → Critique) for reliable execution. Use this when simple HTTP fetch or page reading won't work — for example, pages requiring JavaScript rendering, login flows, multi-step form submissions, or complex UI interactions.`,
  inputSchema: jsonSchemaToZod(browserAutomationSchema),
  execute: async ({ command, timeout = 120 }) => {
    logger.info(
      `🤖 browserAutomation: starting task — "${command}" (timeout: ${timeout}s)`,
    );
    const startTime = Date.now();

    return safe(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (AGENTIC_BROWSER_API_KEY) {
          headers["Authorization"] = `Bearer ${AGENTIC_BROWSER_API_KEY}`;
          headers["x-api-key"] = AGENTIC_BROWSER_API_KEY;
        }

        const response = await fetch(
          `${AGENTIC_BROWSER_BASE_URL}/execute_task`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ command }),
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Agentic Browser returned HTTP ${response.status}: ${response.statusText}`,
          );
        }

        // Parse Server-Sent Events stream
        const text = await response.text();
        const events = text
          .split("\n\n")
          .filter((block) => block.startsWith("data: "))
          .map((block) => {
            try {
              return JSON.parse(block.replace(/^data: /, ""));
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        // Categorise events
        const steps: string[] = [];
        const plans: string[] = [];
        const errors: string[] = [];
        let finalResult: string | null = null;

        for (const event of events) {
          const msg = event.message || "";
          const type = (event.type || "").toLowerCase();

          if (type === "final" || type === "complete") {
            finalResult = msg;
          } else if (type === "error") {
            errors.push(msg);
          } else if (type === "plan") {
            plans.push(msg);
          } else if (type === "step" || type === "info") {
            steps.push(msg);
          }
        }

        const elapsed = Date.now() - startTime;

        if (errors.length && !finalResult) {
          logger.error(
            `❌ browserAutomation: failed in ${elapsed}ms — ${errors[errors.length - 1]}`,
          );
          throw new Error(errors.join("\n"));
        }

        logger.info(
          `✅ browserAutomation: done in ${elapsed}ms — ${steps.length} steps, plan: "${plans[0]?.slice(0, 80)}..."`,
        );

        return {
          command,
          result: finalResult || steps[steps.length - 1] || "Task completed",
          plan: plans.length > 0 ? plans.join("\n") : undefined,
          steps,
          totalSteps: steps.length,
          durationMs: elapsed,
          events,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          logger.error(
            `❌ browserAutomation: timeout after ${timeout}s — "${command}"`,
          );
          throw new Error(
            `Browser automation timed out after ${timeout} seconds. The task may be too complex. Try breaking it into smaller steps.`,
          );
        }
        logger.error(`❌ browserAutomation: failed — ${error}`);
        throw error;
      }
    })
      .ifFail((err) => ({
        isError: true,
        error: err.message,
        command,
        solution:
          "Browser automation failed. Ensure TheAgenticBrowser service is running at " +
          AGENTIC_BROWSER_BASE_URL +
          ". You can start it with: uvicorn core.server.api_routes:app --loop asyncio. As a fallback, try using webPageReader or HTTP tools instead.",
      }))
      .unwrap();
  },
});
