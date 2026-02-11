/**
 * Validation error codes are string-based for flexibility.
 * Format: "{language}.{error_type}" or "common.{error_type}"
 * Examples:
 * - "python.forbidden_import"
 * - "js.missing_return"
 * - "common.empty_code"
 * - "common.syntax_error"
 */

/**
 * Result of code validation containing error details and metadata.
 */
export interface ValidationResult {
  /** Whether the code passed all validation checks */
  valid: boolean;
  /** Specific error code string (e.g., "python.forbidden_import", "js.missing_return") */
  errorCode: string;
  /** Human-readable error message */
  errorMessage?: string;
  /** Line number where the error was detected (1-indexed) */
  line?: number;
  /** Column number where the error was detected (1-indexed) */
  column?: number;
  /** ID for linking to help documentation */
  helpArticleId?: string;
  /** The specific pattern or value that caused the error */
  matchedPattern?: string;
}

/**
 * Supported languages for function extractors
 */
export type FunctionLanguage = "python" | "go" | "js" | "rust" | "c" | "cpp";

/**
 * Mode for function extractor - either use a registered function or inline code
 */
export type FunctionExtractorMode = "registered" | "inline";

/**
 * Defines a forbidden pattern to check in user code.
 * Used for security validation to prevent dangerous operations.
 *
 * @property pattern - Regular expression to match forbidden code
 * @property errorCode - Error code string (e.g., "python.forbidden_import")
 * @property message - Human-readable error message
 * @property helpArticleId - ID for linking to help documentation
 */
export type ForbiddenPattern = [
  pattern: RegExp,
  errorCode: string,
  message: string,
  helpArticleId: string,
];
