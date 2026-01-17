/**
 * Property-based tests for ErrorDetector
 * Feature: ai-builder-ide, Property 18: Error Capture Completeness
 * Validates: Requirements 8.1
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  ErrorDetector,
  getErrorDetector,
  resetErrorDetector,
} from "./error-detector";
import type { RuntimeError } from "@/types/builder";

describe("ErrorDetector Properties", () => {
  let errorDetector: ErrorDetector;

  beforeEach(() => {
    resetErrorDetector();
    errorDetector = getErrorDetector();
  });

  /**
   * Feature: ai-builder-ide, Property 18: Error Capture Completeness
   * Validates: Requirements 8.1
   *
   * For any fatal error in the Sandpack console, the system should capture
   * both the error message and the complete stack trace.
   */
  it("should capture complete error message and stack trace for all errors", () => {
    fc.assert(
      fc.property(
        // Generate random error messages
        fc.string({ minLength: 1, maxLength: 200 }),
        // Generate random stack traces
        fc.option(fc.string({ minLength: 10, maxLength: 500 }), {
          nil: undefined,
        }),
        // Generate random file paths
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
          nil: undefined,
        }),
        // Generate random line numbers
        fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
        // Generate random column numbers
        fc.option(fc.integer({ min: 1, max: 200 }), { nil: undefined }),
        (message, stack, file, line, column) => {
          const error: RuntimeError = {
            type: "fatal",
            message,
            stack,
            file,
            line,
            column,
          };

          let capturedError: RuntimeError | null = null;
          errorDetector.addErrorListener((err) => {
            capturedError = err;
          });

          // Process the error
          errorDetector.processError(error);

          // Verify error was captured
          expect(capturedError).not.toBeNull();
          if (!capturedError) return; // Type guard

          // Verify message is captured completely
          expect(capturedError.message).toBe(message);

          // Verify stack trace is captured completely (if present)
          if (stack !== undefined) {
            expect(capturedError.stack).toBe(stack);
          }

          // Verify file location is captured (if present)
          if (file !== undefined) {
            expect(capturedError.file).toBe(file);
          }

          if (line !== undefined) {
            expect(capturedError.line).toBe(line);
          }

          if (column !== undefined) {
            expect(capturedError.column).toBe(column);
          }

          // Verify error is stored as last error
          const lastError = errorDetector.getLastError();
          expect(lastError).not.toBeNull();
          if (!lastError) return; // Type guard
          expect(lastError.message).toBe(message);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Additional property: Error classification consistency
   * For any error, classification should be deterministic and consistent
   */
  it("should classify errors consistently across multiple calls", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "SyntaxError: Unexpected token",
          "ReferenceError: foo is not defined",
          "TypeError: x is not a function",
          "Error: Cannot find module",
          "Warning: Deprecated API",
          "Unknown runtime error",
        ),
        (message) => {
          const error: RuntimeError = {
            type: "fatal",
            message,
          };

          // Classify multiple times
          const category1 = errorDetector.getErrorCategory(error);
          const category2 = errorDetector.getErrorCategory(error);
          const category3 = errorDetector.getErrorCategory(error);

          const isAutoFixable1 = errorDetector.isAutoFixable(error);
          const isAutoFixable2 = errorDetector.isAutoFixable(error);
          const isAutoFixable3 = errorDetector.isAutoFixable(error);

          // Verify consistency
          expect(category1).toBe(category2);
          expect(category2).toBe(category3);
          expect(isAutoFixable1).toBe(isAutoFixable2);
          expect(isAutoFixable2).toBe(isAutoFixable3);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Additional property: Stack trace parsing correctness
   * For any valid stack trace format, parsing should extract correct location
   */
  it("should correctly parse file location from various stack trace formats", () => {
    fc.assert(
      fc.property(
        // Generate file paths
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => !s.includes(":")),
        // Generate line numbers
        fc.integer({ min: 1, max: 10000 }),
        // Generate column numbers
        fc.integer({ min: 1, max: 200 }),
        (filePath, line, column) => {
          // Test various stack trace formats
          const formats = [
            `at ${filePath}:${line}:${column}`,
            `at file:///${filePath}:${line}:${column}`,
            `${filePath}:${line}:${column}`,
          ];

          for (const stackTrace of formats) {
            const error: RuntimeError = {
              type: "fatal",
              message: "Test error",
              stack: stackTrace,
            };

            const location = errorDetector.parseErrorLocation(error);

            // Verify location was parsed
            expect(location.line).toBe(line);
            expect(location.column).toBe(column);
            // File path should be present (may have been normalized)
            expect(location.file).toBeTruthy();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Additional property: Listener notification completeness
   * For any number of listeners, all should be notified of errors
   */
  it("should notify all registered listeners for every error", () => {
    fc.assert(
      fc.property(
        // Generate number of listeners (1-10)
        fc.integer({ min: 1, max: 10 }),
        // Generate error message
        fc.string({ minLength: 1, maxLength: 100 }),
        (listenerCount, message) => {
          const error: RuntimeError = {
            type: "fatal",
            message,
          };

          // Register multiple listeners
          const capturedErrors: RuntimeError[][] = [];
          const unsubscribers: (() => void)[] = [];

          for (let i = 0; i < listenerCount; i++) {
            const errors: RuntimeError[] = [];
            capturedErrors.push(errors);
            const unsubscribe = errorDetector.addErrorListener((err) => {
              errors.push(err);
            });
            unsubscribers.push(unsubscribe);
          }

          // Process error
          errorDetector.processError(error);

          // Verify all listeners were notified
          for (let i = 0; i < listenerCount; i++) {
            expect(capturedErrors[i]).toHaveLength(1);
            expect(capturedErrors[i][0].message).toBe(message);
          }

          // Clean up
          unsubscribers.forEach((unsub) => unsub());
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Additional property: Error type preservation
   * For any error type, it should be preserved or correctly classified
   */
  it("should preserve or correctly classify error types", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<"fatal" | "warning" | "info">(
          "fatal",
          "warning",
          "info",
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
        (errorType, message) => {
          const error: RuntimeError = {
            type: errorType,
            message,
          };

          let capturedError: RuntimeError | null = null;
          errorDetector.addErrorListener((err) => {
            capturedError = err;
          });

          errorDetector.processError(error);

          // Verify error type is preserved or classified correctly
          expect(capturedError).not.toBeNull();
          if (!capturedError) return; // Type guard
          expect(capturedError.type).toBeDefined();
          expect(["fatal", "warning", "info"]).toContain(capturedError.type);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Additional property: Listener unsubscription correctness
   * For any listener, unsubscribing should prevent future notifications
   */
  it("should not notify unsubscribed listeners", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (message1, message2) => {
          const error1: RuntimeError = { type: "fatal", message: message1 };
          const error2: RuntimeError = { type: "fatal", message: message2 };

          const capturedErrors: RuntimeError[] = [];
          const unsubscribe = errorDetector.addErrorListener((err) => {
            capturedErrors.push(err);
          });

          // Process first error
          errorDetector.processError(error1);
          expect(capturedErrors).toHaveLength(1);

          // Unsubscribe
          unsubscribe();

          // Process second error
          errorDetector.processError(error2);

          // Verify listener was not notified of second error
          expect(capturedErrors).toHaveLength(1);
          expect(capturedErrors[0].message).toBe(message1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
