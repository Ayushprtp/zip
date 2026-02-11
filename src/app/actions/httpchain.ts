"use server";

import { toJsonString } from "curlconverter";
import {
  DEFAULT_REQUEST_HEADERS,
  type HTTPMethod,
  type HTTPRequest,
} from "@/components/httpchain/types/schema";

export interface CurlParseResult {
  success: boolean;
  request?: Partial<HTTPRequest>;
  error?: string;
}

/**
 * Parses a cURL command and returns an HTTPRequest-compatible object
 * This runs on the server to avoid browser-side fs/wasm issues with curlconverter
 */
export async function parseCurl(curlCommand: string): Promise<CurlParseResult> {
  try {
    // Parse cURL to JSON using curlconverter
    const jsonStr = toJsonString(curlCommand);
    const parsed = JSON.parse(jsonStr);

    // Parse URL to extract query params
    let requestUrl = parsed.url || "";
    let requestParams: Record<string, string> | null = null;

    try {
      const urlObj = new URL(requestUrl);
      if (urlObj.search) {
        requestParams = {};
        urlObj.searchParams.forEach((value, key) => {
          if (requestParams) requestParams[key] = value;
        });
        // Remove query string from URL
        requestUrl = urlObj.origin + urlObj.pathname;
      }
    } catch {
      // If URL parsing fails, keep the original URL
    }

    // Determine HTTP method
    const method = (parsed.method?.toUpperCase() || "GET") as HTTPMethod;

    // Process headers - merge with defaults but override with cURL values
    let requestHeaders: Record<string, string> = { ...DEFAULT_REQUEST_HEADERS };
    if (parsed.headers) {
      // cURL headers override defaults
      requestHeaders = { ...requestHeaders, ...parsed.headers };
    }

    // Process cookies
    let requestCookies: Record<string, string> | null = null;
    if (parsed.cookies && Object.keys(parsed.cookies).length > 0) {
      requestCookies = parsed.cookies;
    }

    // Process body - determine if JSON or form data
    let requestJson: Record<string, any> | null = null;
    let requestData: Record<string, any> | string | null = null;

    if (parsed.data) {
      const contentType =
        requestHeaders["Content-Type"] || requestHeaders["content-type"] || "";

      if (contentType.includes("application/json")) {
        // Try to parse as JSON
        if (typeof parsed.data === "object") {
          requestJson = parsed.data;
        } else if (typeof parsed.data === "string") {
          try {
            requestJson = JSON.parse(parsed.data);
          } catch {
            requestData = parsed.data;
          }
        }
      } else {
        // Treat as form data or raw data
        requestData = parsed.data;
      }
    }

    // Handle raw_data for multipart or other formats
    if (parsed.raw_data && !requestData && !requestJson) {
      requestData = parsed.raw_data;
    }

    const request: Partial<HTTPRequest> = {
      request_method: method,
      request_url: requestUrl,
      request_headers: requestHeaders,
      request_cookies: requestCookies,
      request_params: requestParams,
      request_json: requestJson,
      request_data: requestData,
    };

    return {
      success: true,
      request,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to parse cURL command",
    };
  }
}
