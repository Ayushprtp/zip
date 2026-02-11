import type { ValidationResult } from "../types";

// ============================================================================
// Constants
// ============================================================================

export const LANGUAGE_ID = "go";
export const MONACO_LANGUAGE = "go";
export const DISPLAY_NAME = "Go";
export const IS_AVAILABLE = false;

export const IMPORT_HEADER = `// Available imports (auto-imported)
import (
    "encoding/json"
    "regexp"
    "strings"
    "strconv"
    "net/url"
    "crypto/md5"
    "crypto/sha256"
    "encoding/base64"
)
// ─────────────────────────────────────────────────────────────────

`;

export const DEFAULT_TEMPLATE = `func Extract(response Response, variables map[string]interface{}) interface{} {
    // response.JSONBody - parsed JSON (map[string]interface{})
    // response.TextBody - raw text content
    // response.StatusCode - HTTP status code
    // variables - all accumulated variables
    
    // Your extraction logic here
    return nil
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

  if (!code.includes("func Extract(") && !code.includes("func extract(")) {
    return {
      valid: false,
      errorCode: "go.invalid_signature",
      errorMessage:
        "Function must be named 'Extract' with signature: func Extract(response Response, variables map[string]interface{}) interface{}",
      helpArticleId: "go-invalid-signature",
    };
  }

  return {
    valid: true,
    errorCode: "common.valid",
  };
}
