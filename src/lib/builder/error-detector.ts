/**
 * ErrorDetector - Monitors Sandpack console for fatal errors
 * Parses error messages, extracts stack traces, and classifies error severity
 */

import type { RuntimeError } from "@/types/builder";

// ============================================================================
// Types
// ============================================================================

export type ErrorListener = (error: RuntimeError) => void;

export interface ErrorClassification {
  severity: "fatal" | "warning" | "info";
  isAutoFixable: boolean;
  category: "syntax" | "reference" | "type" | "import" | "runtime" | "unknown";
}

// ============================================================================
// ErrorDetector Class
// ============================================================================

export class ErrorDetector {
  private errorListeners: Set<ErrorListener> = new Set();
  private lastError: RuntimeError | null = null;

  /**
   * Register a listener for error events
   */
  addErrorListener(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Remove a specific error listener
   */
  removeErrorListener(listener: ErrorListener): void {
    this.errorListeners.delete(listener);
  }

  /**
   * Remove all error listeners
   */
  clearErrorListeners(): void {
    this.errorListeners.clear();
  }

  /**
   * Process an error from Sandpack console
   */
  processError(error: RuntimeError): void {
    // Classify the error
    const classification = this.classifyError(error);

    // Enhance error with classification
    const enhancedError: RuntimeError = {
      ...error,
      type: classification.severity,
    };

    // Store last error
    this.lastError = enhancedError;

    // Notify all listeners
    this.notifyListeners(enhancedError);
  }

  /**
   * Get the last detected error
   */
  getLastError(): RuntimeError | null {
    return this.lastError;
  }

  /**
   * Clear the last error
   */
  clearLastError(): void {
    this.lastError = null;
  }

  /**
   * Classify error severity and determine if auto-fixable
   */
  private classifyError(error: RuntimeError): ErrorClassification {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || "";

    // Check for syntax errors
    if (
      message.includes("syntaxerror") ||
      message.includes("unexpected token") ||
      message.includes("unexpected identifier")
    ) {
      return {
        severity: "fatal",
        isAutoFixable: true,
        category: "syntax",
      };
    }

    // Check for reference errors
    if (
      message.includes("referenceerror") ||
      message.includes("is not defined") ||
      message.includes("undefined")
    ) {
      return {
        severity: "fatal",
        isAutoFixable: true,
        category: "reference",
      };
    }

    // Check for type errors
    if (
      message.includes("typeerror") ||
      message.includes("is not a function") ||
      message.includes("cannot read property")
    ) {
      return {
        severity: "fatal",
        isAutoFixable: true,
        category: "type",
      };
    }

    // Check for import errors
    if (
      message.includes("cannot find module") ||
      message.includes("failed to resolve") ||
      message.includes("import") ||
      stack.includes("import")
    ) {
      return {
        severity: "fatal",
        isAutoFixable: true,
        category: "import",
      };
    }

    // Check for warnings
    if (message.includes("warning") || message.includes("deprecated")) {
      return {
        severity: "warning",
        isAutoFixable: false,
        category: "runtime",
      };
    }

    // Default to fatal runtime error
    return {
      severity: "fatal",
      isAutoFixable: false,
      category: "runtime",
    };
  }

  /**
   * Notify all registered listeners
   */
  private notifyListeners(error: RuntimeError): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        console.error("Error in error listener:", err);
      }
    });
  }

  /**
   * Parse error message to extract file location
   */
  parseErrorLocation(error: RuntimeError): {
    file: string | null;
    line: number | null;
    column: number | null;
  } {
    // If error already has location info, use it
    if (error.file) {
      return {
        file: error.file,
        line: error.line || null,
        column: error.column || null,
      };
    }

    // Try to extract from stack trace
    if (error.stack) {
      // Common patterns:
      // at file:///path/to/file.js:10:5
      // at /path/to/file.js:10:5
      // file.js:10:5
      const stackLineMatch = error.stack.match(/(?:at\s+)?([^:]+):(\d+):(\d+)/);
      if (stackLineMatch) {
        return {
          file: stackLineMatch[1].trim(),
          line: parseInt(stackLineMatch[2], 10),
          column: parseInt(stackLineMatch[3], 10),
        };
      }
    }

    // Try to extract from message
    const messageMatch = error.message.match(/([^:]+):(\d+):(\d+)/);
    if (messageMatch) {
      return {
        file: messageMatch[1].trim(),
        line: parseInt(messageMatch[2], 10),
        column: parseInt(messageMatch[3], 10),
      };
    }

    return {
      file: null,
      line: null,
      column: null,
    };
  }

  /**
   * Check if an error is auto-fixable
   */
  isAutoFixable(error: RuntimeError): boolean {
    const classification = this.classifyError(error);
    return classification.isAutoFixable;
  }

  /**
   * Get error category
   */
  getErrorCategory(error: RuntimeError): string {
    const classification = this.classifyError(error);
    return classification.category;
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let errorDetectorInstance: ErrorDetector | null = null;

export function getErrorDetector(): ErrorDetector {
  if (!errorDetectorInstance) {
    errorDetectorInstance = new ErrorDetector();
  }
  return errorDetectorInstance;
}

export function resetErrorDetector(): void {
  errorDetectorInstance = null;
}
