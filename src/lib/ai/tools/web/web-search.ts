import { tool as createTool } from "ai";
import { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";
import { safe } from "ts-safe";
import globalLogger from "logger";

const logger = globalLogger.withDefaults({
  message: "[WebSearch] ",
});

// ---------------------------------------------------------------------------
//  TheAgenticBrowser helper — shared by search & content tools
// ---------------------------------------------------------------------------
const AGENTIC_BROWSER_BASE_URL =
  process.env.AGENTIC_BROWSER_URL || "http://127.0.0.1:8000";
const AGENTIC_BROWSER_API_KEY = process.env.AGENTIC_BROWSER_API_KEY || "";

interface BrowserTaskResult {
  result: string | null;
  plan?: string;
  steps: string[];
  events: any[];
}

/**
 * Send a natural-language command to TheAgenticBrowser and parse the SSE
 * response into structured data.
 */
async function executeAgenticBrowserTask(
  command: string,
  timeoutSec = 120,
): Promise<BrowserTaskResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (AGENTIC_BROWSER_API_KEY) {
      headers["Authorization"] = `Bearer ${AGENTIC_BROWSER_API_KEY}`;
      headers["x-api-key"] = AGENTIC_BROWSER_API_KEY;
    }

    const response = await fetch(`${AGENTIC_BROWSER_BASE_URL}/execute_task`, {
      method: "POST",
      headers,
      body: JSON.stringify({ command }),
      signal: controller.signal,
    });

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

    if (errors.length && !finalResult) {
      throw new Error(errors.join("\n"));
    }

    return {
      result: finalResult || steps[steps.length - 1] || "Task completed",
      plan: plans.length > 0 ? plans.join("\n") : undefined,
      steps,
      events,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(
        `Browser automation timed out after ${timeoutSec} seconds.`,
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
//  Schemas
// ---------------------------------------------------------------------------
export const webSearchSchema: JSONSchema7 = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query",
    },
    numResults: {
      type: "number",
      description: "Number of search results to return",
      default: 5,
      minimum: 1,
      maximum: 20,
    },
  },
  required: ["query"],
};

export const webContentsSchema: JSONSchema7 = {
  type: "object",
  properties: {
    urls: {
      type: "array",
      items: { type: "string" },
      description: "List of URLs to extract content from",
    },
    maxCharacters: {
      type: "number",
      description: "Maximum characters to extract from each URL",
      default: 3000,
      minimum: 100,
      maximum: 10000,
    },
  },
  required: ["urls"],
};

// ---------------------------------------------------------------------------
//  Workflow versions (direct execute, no safe wrapper)
// ---------------------------------------------------------------------------
export const webSearchToolForWorkflow = createTool({
  description:
    "Search the web for information using a real browser agent. Returns relevant search results with titles, URLs, and content. Use this to find current information or answer questions requiring web knowledge.",
  inputSchema: jsonSchemaToZod(webSearchSchema),
  execute: async (params) => {
    const numResults = params.numResults || 5;
    logger.info(
      `🔍 webSearch(workflow): "${params.query}" (${numResults} results)`,
    );

    const command = `Go to Google and search for "${params.query}". Extract the top ${numResults} search results. For each result, extract the title, URL, and a brief snippet/description. Return the results as structured data.`;
    const browserResult = await executeAgenticBrowserTask(command, 90);

    return {
      query: params.query,
      result: browserResult.result,
      steps: browserResult.steps,
    };
  },
});

export const webContentsToolForWorkflow = createTool({
  description:
    "Extract detailed content from specific URLs using a real browser agent. Retrieves full text content and metadata from web pages, handling JavaScript-rendered content.",
  inputSchema: jsonSchemaToZod(webContentsSchema),
  execute: async (params) => {
    const maxChars = params.maxCharacters || 3000;
    logger.info(
      `📖 webContent(workflow): extracting from ${params.urls.length} URLs`,
    );

    const urlList = params.urls.join(", ");
    const command = `Visit each of these URLs and extract the main text content from each page (up to ${maxChars} characters per page): ${urlList}. Return the extracted text content for each URL separately.`;
    const browserResult = await executeAgenticBrowserTask(command, 120);

    return {
      urls: params.urls,
      result: browserResult.result,
      steps: browserResult.steps,
    };
  },
});

// ---------------------------------------------------------------------------
//  Chat versions (safe-wrapped, user-friendly error handling)
// ---------------------------------------------------------------------------
export const webSearchTool = createTool({
  description:
    "Search the web for information using a real browser agent. Performs live web searches by navigating a real browser. Returns relevant search results with content extraction. Use this to find current information, websites, or answer questions requiring up-to-date web knowledge.",
  inputSchema: jsonSchemaToZod(webSearchSchema),
  execute: (params) => {
    return safe(async () => {
      const numResults = params.numResults || 5;
      logger.info(`🔍 webSearch: "${params.query}" (${numResults} results)`);

      const command = `Go to Google and search for "${params.query}". Extract the top ${numResults} search results. For each result, extract the title, URL, and a brief snippet/description. Return the results as structured data.`;
      const startTime = Date.now();
      const browserResult = await executeAgenticBrowserTask(command, 90);
      const elapsed = Date.now() - startTime;

      logger.info(`✅ webSearch: done in ${elapsed}ms`);

      return {
        query: params.query,
        result: browserResult.result,
        steps: browserResult.steps,
        durationMs: elapsed,
        guide: `Use the search results to answer the user's question. Summarize the content and ask if they have any additional questions about the topic.`,
      };
    })
      .ifFail((e) => {
        logger.error(`❌ webSearch failed: ${e.message}`);
        return {
          isError: true,
          error: e.message,
          solution:
            "A web search error occurred. Ensure TheAgenticBrowser service is running. As a fallback, try using webPageReader or http tools to access specific URLs directly.",
        };
      })
      .unwrap();
  },
});

export const webContentsTool = createTool({
  description:
    "Extract detailed content from specific URLs using a real browser agent. Navigates a real browser to retrieve full text content, metadata, and structured information from web pages — including JavaScript-rendered content that simple HTTP fetches cannot access.",
  inputSchema: jsonSchemaToZod(webContentsSchema),
  execute: async (params) => {
    return safe(async () => {
      const maxChars = params.maxCharacters || 3000;
      logger.info(`📖 webContent: extracting from ${params.urls.length} URLs`);

      const startTime = Date.now();

      // Process URLs individually for better results
      const results: {
        url: string;
        content?: string | null;
        error?: string;
      }[] = [];
      for (const url of params.urls) {
        try {
          const command = `Navigate to ${url} and extract the main text content of the page. Focus on the article/main content, ignore navigation, ads, and footers. Return up to ${maxChars} characters of the main content along with the page title.`;
          const browserResult = await executeAgenticBrowserTask(command, 60);
          results.push({
            url,
            content: browserResult.result,
          });
        } catch (err: any) {
          results.push({
            url,
            error: err.message,
          });
        }
      }

      const elapsed = Date.now() - startTime;
      logger.info(
        `✅ webContent: done in ${elapsed}ms — ${results.length} pages`,
      );

      return {
        results,
        durationMs: elapsed,
      };
    })
      .ifFail((e) => {
        logger.error(`❌ webContent failed: ${e.message}`);
        return {
          isError: true,
          error: e.message,
          solution:
            "Web content extraction failed. Ensure TheAgenticBrowser service is running. Try using webPageReader or http tools as alternatives.",
        };
      })
      .unwrap();
  },
});
