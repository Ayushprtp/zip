import type { ValidationResult, ForbiddenPattern } from "../types";

// ============================================================================
// Constants
// ============================================================================

export const LANGUAGE_ID = "python";
export const MONACO_LANGUAGE = "python";
export const DISPLAY_NAME = "Python Script";
export const IS_AVAILABLE = true;

// This header is displayed in the UI to inform the user of the environment
export const IMPORT_HEADER = `# ⚡ HTTPCHAIN RUNTIME ENVIRONMENT
# The following libraries are PRE-IMPORTED and available in the global scope:
# -------------------------------------------------------------------------
# [Standard]:   math, json, re, random, datetime, base64, hashlib
# [Type Utils]: str, int, float, list, dict, set, len, range, enumerate
# [Url Utils]:  urlparse, parse_qs, urlencode (from urllib.parse)
# [Context]:    print (logs to debug console)
# -------------------------------------------------------------------------
# NO IMPORTS ALLOWED. Use the libraries above directly.

`;

export const DEFAULT_TEMPLATE = `def extract(response, variables):
    """
    Extract data from the HTTP response.
    Supports both sync ('def') and async ('async def') signatures.
    
    Args:
        response: HTTPResponse object (properties: json_body, text_body, status_code, etc)
        variables: Dict of all accumulated variables from the chain
    
    Returns:
        The value to be stored in the 'extractor_key' variable.
    """
    # Example: Check if JSON contains a specific user field
    # data = response.json_body
    # if data.get("user"):
    #     return data["user"]["id"]
    
    return None
`;

// ============================================================================
// Validation Logic Constants
// ============================================================================

// Matches: "def extract(response, variables):" OR "async def extract(response, variables):"
// Allows flexibility in whitespace.
const REQUIRED_SIGNATURE =
  /(?:async\s+)?def\s+extract\s*\(\s*response\s*,\s*variables\s*\)\s*:/;

const RETURN_PATTERN = /\breturn\b/;

// ============================================================================
// LINTING PATTERNS (UX Guardrails)
// These prevent users from writing code that will fail on the backend.
// ============================================================================

const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  // 1. IMPORTS (Backend handles dependencies)
  [
    /\bimport\b/,
    "python.redundant_import",
    "Imports are not allowed. Common libraries (json, re, math, etc.) are pre-imported.",
    "auto-imports",
  ],
  [
    /\bfrom\b.*\bimport\b/,
    "python.redundant_import",
    "Imports are not allowed. Common libraries are pre-imported.",
    "auto-imports",
  ],
  [
    /\b__import__\b/,
    "python.redundant_import",
    "Dynamic imports are not allowed.",
    "forbidden-dunder-import",
  ],

  // 2. DANGEROUS EXECUTION (Discouraged practices)
  [
    /\beval\b/,
    "python.unsafe_function",
    "Usage of 'eval' is blocked for safety.",
    "avoid-eval",
  ],
  [
    /\bexec\b/,
    "python.unsafe_function",
    "Usage of 'exec' is blocked for safety.",
    "avoid-exec",
  ],
  [
    /\bcompile\b/,
    "python.unsafe_function",
    "Usage of 'compile' is blocked.",
    "forbidden-compile",
  ],

  // 3. FILE SYSTEM (Not available in sandbox)
  [
    /\bopen\b/,
    "python.io_blocked",
    "File I/O is not available. Use network requests or variables.",
    "no-file-io",
  ],

  // 4. GLOBAL SCOPE MANIPULATION (Protects the runner integrity)
  [
    /\bglobals\b/,
    "python.scope_error",
    "Accessing 'globals' is not allowed.",
    "no-globals",
  ],
  [
    /\blocals\b/,
    "python.scope_error",
    "Accessing 'locals' is not allowed.",
    "no-locals",
  ],

  // 5. INTERNAL ATTRIBUTES (Basic guardrails, not exhaustive security)
  [
    /\b__builtins__\b/,
    "python.forbidden_builtin",
    "Accessing '__builtins__' is not allowed.",
    "forbidden-builtins",
  ],
];

// ============================================================================
// Helper Functions
// ============================================================================

function findPatternLine(code: string, pattern: RegExp): number | undefined {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return undefined;
}

function checkBasicSyntax(
  code: string,
): { message: string; line: number } | null {
  const lines = code.split("\n");
  const stack: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const closers: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  let inString: string | null = null;
  let escapeNext = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      // Handle Escape Characters
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      // Handle Strings (Single, Double, Triple)
      if ((char === '"' || char === "'") && !inString) {
        if (line.slice(i, i + 3) === '"""' || line.slice(i, i + 3) === "'''") {
          const tripleQuote = line.slice(i, i + 3);
          if (inString === tripleQuote) {
            inString = null;
          } else if (!inString) {
            inString = tripleQuote;
          }
          i += 2;
          continue;
        }
        inString = char;
        continue;
      }

      if (inString && char === inString[0] && inString.length === 1) {
        inString = null;
        continue;
      }

      if (inString) continue;
      if (char === "#") break; // Comment, skip rest of line

      // Stack Check
      if (pairs[char]) {
        stack.push({ char, line: lineIdx + 1 });
      } else if (closers[char]) {
        const last = stack.pop();
        if (!last || last.char !== closers[char]) {
          return { message: `Unmatched '${char}'`, line: lineIdx + 1 };
        }
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return { message: `Unclosed '${unclosed.char}'`, line: unclosed.line };
  }

  return null;
}

// ============================================================================
// Main Validation Function
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

  // 1. Check Function Signature (Sync or Async)
  if (!REQUIRED_SIGNATURE.test(code)) {
    return {
      valid: false,
      errorCode: "python.invalid_signature",
      errorMessage:
        "Missing required function signature: 'def extract(response, variables):' or 'async def...'",
      helpArticleId: "invalid-signature",
      line: 1,
    };
  }

  // 2. Check Forbidden Patterns (Linting)
  for (const [
    pattern,
    errorCode,
    message,
    helpArticleId,
  ] of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      const line = findPatternLine(code, pattern);
      return {
        valid: false,
        errorCode,
        errorMessage: message,
        helpArticleId,
        line,
      };
    }
  }

  // 3. Ensure Return Statement Exists
  if (!RETURN_PATTERN.test(code)) {
    return {
      valid: false,
      errorCode: "python.missing_return",
      errorMessage: "Function must have at least one 'return' statement",
      helpArticleId: "missing-return",
    };
  }

  // 4. Basic Syntax Check (Brackets/Parens)
  const syntaxError = checkBasicSyntax(code);
  if (syntaxError) {
    return {
      valid: false,
      errorCode: "common.syntax_error",
      errorMessage: syntaxError.message,
      line: syntaxError.line,
      helpArticleId: "syntax-error",
    };
  }

  return {
    valid: true,
    errorCode: "common.valid",
  };
}
