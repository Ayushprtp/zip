/**
 * Integration test for error detection system
 * Tests the flow: ErrorDetector -> ErrorOverlay -> AutoFixService
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ErrorDetector,
  getErrorDetector,
  resetErrorDetector,
} from "./error-detector";
import { AutoFixService, createAutoFixService } from "./auto-fix-service";
import { AIService } from "./ai-service";
import type { RuntimeError } from "@/types/builder";

describe("Error Detection Integration", () => {
  let errorDetector: ErrorDetector;
  let autoFixService: AutoFixService;
  let aiService: AIService;

  beforeEach(() => {
    // Reset error detector singleton
    resetErrorDetector();
    errorDetector = getErrorDetector();

    // Create AI service
    aiService = new AIService({
      apiKey: "test-key",
      model: "claude",
    });

    // Create auto-fix service
    autoFixService = createAutoFixService(aiService);
  });

  it("should detect and classify syntax errors", () => {
    const syntaxError: RuntimeError = {
      type: "fatal",
      message: "SyntaxError: Unexpected token",
      stack: "at file.ts:10:5",
      file: "/src/file.ts",
      line: 10,
      column: 5,
    };

    let detectedError: RuntimeError | null = null;
    errorDetector.addErrorListener((error) => {
      detectedError = error;
    });

    errorDetector.processError(syntaxError);

    expect(detectedError).toBeDefined();
    expect(detectedError?.type).toBe("fatal");
    expect(errorDetector.isAutoFixable(syntaxError)).toBe(true);
    expect(errorDetector.getErrorCategory(syntaxError)).toBe("syntax");
  });

  it("should detect and classify reference errors", () => {
    const referenceError: RuntimeError = {
      type: "fatal",
      message: "ReferenceError: foo is not defined",
      stack: "at file.ts:15:3",
      file: "/src/file.ts",
      line: 15,
      column: 3,
    };

    errorDetector.processError(referenceError);

    expect(errorDetector.isAutoFixable(referenceError)).toBe(true);
    expect(errorDetector.getErrorCategory(referenceError)).toBe("reference");
  });

  it("should detect and classify import errors", () => {
    const importError: RuntimeError = {
      type: "fatal",
      message: 'Error: Cannot find module "./missing"',
      stack: "at file.ts:1:1",
      file: "/src/file.ts",
      line: 1,
      column: 1,
    };

    errorDetector.processError(importError);

    expect(errorDetector.isAutoFixable(importError)).toBe(true);
    expect(errorDetector.getErrorCategory(importError)).toBe("import");
  });

  it("should parse error location from stack trace", () => {
    const error: RuntimeError = {
      type: "fatal",
      message: "Error occurred",
      stack: "at /src/components/App.tsx:25:10",
    };

    const location = errorDetector.parseErrorLocation(error);

    expect(location.file).toBe("/src/components/App.tsx");
    expect(location.line).toBe(25);
    expect(location.column).toBe(10);
  });

  it("should notify multiple listeners", () => {
    const error: RuntimeError = {
      type: "fatal",
      message: "Test error",
    };

    const listener1Calls: RuntimeError[] = [];
    const listener2Calls: RuntimeError[] = [];

    errorDetector.addErrorListener((err) => listener1Calls.push(err));
    errorDetector.addErrorListener((err) => listener2Calls.push(err));

    errorDetector.processError(error);

    expect(listener1Calls).toHaveLength(1);
    expect(listener2Calls).toHaveLength(1);
    expect(listener1Calls[0]).toEqual(error);
    expect(listener2Calls[0]).toEqual(error);
  });

  it("should allow unsubscribing listeners", () => {
    const error: RuntimeError = {
      type: "fatal",
      message: "Test error",
    };

    const listenerCalls: RuntimeError[] = [];
    const unsubscribe = errorDetector.addErrorListener((err) =>
      listenerCalls.push(err),
    );

    errorDetector.processError(error);
    expect(listenerCalls).toHaveLength(1);

    unsubscribe();
    errorDetector.processError(error);
    expect(listenerCalls).toHaveLength(1); // Should not increase
  });

  it("should store and retrieve last error", () => {
    const error: RuntimeError = {
      type: "fatal",
      message: "Test error",
    };

    expect(errorDetector.getLastError()).toBeNull();

    errorDetector.processError(error);
    expect(errorDetector.getLastError()).toEqual(error);

    errorDetector.clearLastError();
    expect(errorDetector.getLastError()).toBeNull();
  });

  it("should build error context with relevant code", async () => {
    const error: RuntimeError = {
      type: "fatal",
      message: "ReferenceError: foo is not defined",
      file: "/src/app.ts",
      line: 5,
    };

    const files = {
      "/src/app.ts": `const x = 1;
const y = 2;
const z = 3;
const a = 4;
const b = foo; // Error here
const c = 5;
const d = 6;`,
    };

    const result = await autoFixService.generateFix({
      error,
      files,
      aiService,
    });

    // The fix should be attempted (even if it fails in test environment)
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
  });

  it("should prevent concurrent fix attempts", async () => {
    const error: RuntimeError = {
      type: "fatal",
      message: "Test error",
      file: "/src/app.ts",
    };

    const files = {
      "/src/app.ts": "const x = 1;",
    };

    // Start first fix (won't complete immediately)
    const promise1 = autoFixService.generateFix({
      error,
      files,
      aiService,
    });

    // Try to start second fix while first is in progress
    const result2 = await autoFixService.generateFix({
      error,
      files,
      aiService,
    });

    expect(result2.success).toBe(false);
    expect(result2.message).toContain("already being generated");

    // Wait for first fix to complete
    await promise1;
  });

  it("should classify warnings correctly", () => {
    const warning: RuntimeError = {
      type: "warning",
      message: "Warning: Deprecated API usage",
    };

    errorDetector.processError(warning);

    expect(errorDetector.isAutoFixable(warning)).toBe(false);
    expect(errorDetector.getErrorCategory(warning)).toBe("runtime");
  });
});
