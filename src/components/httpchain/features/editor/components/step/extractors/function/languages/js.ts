import type { ValidationResult } from "../types";

// ============================================================================
// Constants
// ============================================================================

export const LANGUAGE_ID = "js";
export const MONACO_LANGUAGE = "javascript";
export const DISPLAY_NAME = "JavaScript";
export const IS_AVAILABLE = false;

export const IMPORT_HEADER = `// Available globals (auto-provided)
// JSON, RegExp, URL, URLSearchParams, btoa, atob, crypto, Math, Date
// ─────────────────────────────────────────────────────────────────

`;

export const DEFAULT_TEMPLATE = `function extract(response, variables) {
    // response.jsonBody - parsed JSON object
    // response.textBody - raw text content
    // response.statusCode - HTTP status code
    // variables - all accumulated variables (object)
    
    // Your extraction logic here
    return null;
}
`;

// ============================================================================
// Validation Logic
// ============================================================================

export function validate(code: string): ValidationResult {
  if (!code || !code.trim()) {
    return {
      valid: false,
      errorCode: "common.empty_code",
      errorMessage: "Code cannot be empty",
      helpArticleId: "empty-code",
    };
  }

  if (
    !code.includes("function extract(") &&
    !code.includes("const extract =") &&
    !code.includes("let extract =")
  ) {
    return {
      valid: false,
      errorCode: "js.invalid_signature",
      errorMessage:
        "Function must be named 'extract' with signature: function extract(response, variables)",
      helpArticleId: "js-invalid-signature",
    };
  }

  if (!code.includes("return ")) {
    return {
      valid: false,
      errorCode: "js.missing_return",
      errorMessage: "Function must have at least one return statement",
      helpArticleId: "missing-return",
    };
  }

  return {
    valid: true,
    errorCode: "common.valid",
  };
}
