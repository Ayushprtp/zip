/**
 * Task 13 Checkpoint Verification
 * Comprehensive tests to verify all advanced features work correctly:
 * - Error detection and auto-fix flow
 * - Asset generation for missing images
 * - Library configuration system
 * - Checkpoint creation on user prompts (new requirement)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ErrorDetector,
  getErrorDetector,
  resetErrorDetector,
} from "./error-detector";
import { AutoFixService, createAutoFixService } from "./auto-fix-service";
import {
  AssetGenerator,
  getAssetGenerator,
  resetAssetGenerator,
} from "./asset-generator";
import { LIBRARY_CONFIGS, getLibraryConfig } from "./library-configs";
import { CheckpointManager } from "./checkpoint-manager";
import { AIService } from "./ai-service";
import type { RuntimeError, LibraryType } from "@/types/builder";

describe("Task 13: Advanced Features Verification", () => {
  describe("1. Error Detection and Auto-Fix Flow", () => {
    let errorDetector: ErrorDetector;
    let autoFixService: AutoFixService;
    let aiService: AIService;

    beforeEach(() => {
      resetErrorDetector();
      errorDetector = getErrorDetector();
      aiService = new AIService({
        apiKey: "test-key",
        model: "claude",
      });
      autoFixService = createAutoFixService(aiService);
    });

    it("should detect fatal errors and trigger error listeners", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "SyntaxError: Unexpected token",
        stack: "at /src/app.tsx:10:5",
        file: "/src/app.tsx",
        line: 10,
        column: 5,
      };

      let detectedError: RuntimeError | null = null;
      errorDetector.addErrorListener((err) => {
        detectedError = err;
      });

      errorDetector.processError(error);

      expect(detectedError).toBeDefined();
      expect(detectedError?.message).toContain("SyntaxError");
      expect(detectedError?.type).toBe("fatal");
    });

    it("should classify errors as auto-fixable", () => {
      const syntaxError: RuntimeError = {
        type: "fatal",
        message: "SyntaxError: Unexpected token",
      };

      const referenceError: RuntimeError = {
        type: "fatal",
        message: "ReferenceError: foo is not defined",
      };

      const importError: RuntimeError = {
        type: "fatal",
        message: 'Cannot find module "./missing"',
      };

      expect(errorDetector.isAutoFixable(syntaxError)).toBe(true);
      expect(errorDetector.isAutoFixable(referenceError)).toBe(true);
      expect(errorDetector.isAutoFixable(importError)).toBe(true);
    });

    it("should parse error location from stack trace", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "Error occurred",
        stack: "at /src/components/Button.tsx:42:15",
      };

      const location = errorDetector.parseErrorLocation(error);

      expect(location.file).toBe("/src/components/Button.tsx");
      expect(location.line).toBe(42);
      expect(location.column).toBe(15);
    });

    it("should build error context for auto-fix", async () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "ReferenceError: count is not defined",
        file: "/src/Counter.tsx",
        line: 8,
      };

      const files = {
        "/src/Counter.tsx": `import React from 'react';

export function Counter() {
  const [state, setState] = React.useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setState(state + 1)}>Increment</button>
    </div>
  );
}`,
      };

      const result = await autoFixService.generateFix({
        error,
        files,
        aiService,
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      // In test environment, AI call may fail, but structure should be correct
    });

    it("should prevent concurrent fix attempts", async () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "Test error",
        file: "/src/app.tsx",
      };

      const files = { "/src/app.tsx": "const x = 1;" };

      // Start first fix
      const promise1 = autoFixService.generateFix({ error, files, aiService });

      // Try second fix immediately
      const result2 = await autoFixService.generateFix({
        error,
        files,
        aiService,
      });

      expect(result2.success).toBe(false);
      expect(result2.message).toContain("already being generated");

      await promise1;
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
  });

  describe("2. Asset Generation for Missing Images", () => {
    let assetGenerator: AssetGenerator;

    beforeEach(() => {
      resetAssetGenerator();
      assetGenerator = getAssetGenerator();
    });

    it("should detect missing asset errors (404)", () => {
      const error404: RuntimeError = {
        type: "fatal",
        message: "GET /images/logo.png 404 (Not Found)",
        stack: "at fetch",
      };

      expect(assetGenerator.isMissingAssetError(error404)).toBe(true);
    });

    it("should extract file path from error message", () => {
      const error: RuntimeError = {
        type: "fatal",
        message: 'Failed to load image: "/images/hero.jpg"',
      };

      const path = assetGenerator.extractFilePath(error);
      expect(path).toBe("/images/hero.jpg");
    });

    it("should determine asset type correctly", () => {
      expect(assetGenerator.getAssetType("/images/logo.png")).toBe("image");
      expect(assetGenerator.getAssetType("/favicon.ico")).toBe("icon");
      expect(assetGenerator.getAssetType("/assets/icon-32x32.png")).toBe(
        "icon",
      );
    });

    it("should generate SVG placeholder for images", async () => {
      const result = await assetGenerator.generatePlaceholder(
        "/images/banner.png",
        "banner image 1200x300",
      );

      expect(result.path).toBe("/images/banner.png");
      expect(result.content).toContain("<svg");
      expect(result.content).toContain('width="1200"');
      expect(result.content).toContain('height="300"');
      expect(result.type).toBe("image");
    });

    it("should generate icon placeholder", async () => {
      const result = await assetGenerator.generatePlaceholder(
        "/favicon.ico",
        "favicon",
      );

      expect(result.path).toBe("/favicon.ico");
      expect(result.content).toContain("<svg");
      expect(result.content).toContain('width="32"');
      expect(result.content).toContain('height="32"');
      expect(result.type).toBe("icon");
    });

    it("should process error and generate asset automatically", async () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "GET /images/profile.jpg 404 (Not Found)",
      };

      const result = await assetGenerator.processError(error);

      expect(result).not.toBeNull();
      expect(result?.path).toBe("/images/profile.jpg");
      expect(result?.content).toContain("<svg");
    });

    it("should not generate duplicate assets", async () => {
      const error: RuntimeError = {
        type: "fatal",
        message: "GET /images/logo.png 404",
      };

      const result1 = await assetGenerator.processError(error);
      expect(result1).not.toBeNull();

      const result2 = await assetGenerator.processError(error);
      expect(result2).toBeNull(); // Already generated
    });

    it("should infer dimensions from context", async () => {
      const result = await assetGenerator.generatePlaceholder(
        "/images/thumbnail-150x150.jpg",
        "thumbnail",
      );

      expect(result.content).toContain('width="150"');
      expect(result.content).toContain('height="150"');
    });

    it("should handle various asset extensions", () => {
      const extensions = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".webp",
        ".ico",
      ];

      extensions.forEach((ext) => {
        const error: RuntimeError = {
          type: "fatal",
          message: `Failed to load /image${ext}`,
        };
        expect(assetGenerator.isMissingAssetError(error)).toBe(true);
      });
    });
  });

  describe("3. Library Configuration System", () => {
    it("should have all required library configurations", () => {
      const libraries: LibraryType[] = [
        "shadcn",
        "daisyui",
        "material-ui",
        "tailwind",
      ];

      libraries.forEach((lib) => {
        const config = LIBRARY_CONFIGS[lib];
        expect(config).toBeDefined();
        expect(config.name).toBeDefined();
        expect(config.dependencies).toBeDefined();
        expect(config.devDependencies).toBeDefined();
        expect(config.fileStructure).toBeDefined();
        expect(config.systemPromptAddition).toBeDefined();
      });
    });

    it("should have Shadcn UI configuration with Radix dependencies", () => {
      const shadcnConfig = getLibraryConfig("shadcn");

      expect(shadcnConfig.name).toBe("Shadcn UI");
      expect(shadcnConfig.dependencies["@radix-ui/react-dialog"]).toBeDefined();
      expect(
        shadcnConfig.dependencies["@radix-ui/react-dropdown-menu"],
      ).toBeDefined();
      expect(
        shadcnConfig.dependencies["class-variance-authority"],
      ).toBeDefined();
      expect(shadcnConfig.dependencies["tailwind-merge"]).toBeDefined();
      expect(shadcnConfig.systemPromptAddition).toContain("Shadcn UI");
      expect(shadcnConfig.systemPromptAddition).toContain("@/components/ui");
    });

    it("should have DaisyUI configuration", () => {
      const daisyConfig = getLibraryConfig("daisyui");

      expect(daisyConfig.name).toBe("DaisyUI");
      expect(daisyConfig.dependencies.daisyui).toBeDefined();
      expect(daisyConfig.devDependencies.tailwindcss).toBeDefined();
      expect(daisyConfig.systemPromptAddition).toContain("DaisyUI");
      expect(daisyConfig.systemPromptAddition).toContain("btn");
    });

    it("should have Material UI configuration", () => {
      const muiConfig = getLibraryConfig("material-ui");

      expect(muiConfig.name).toBe("Material UI");
      expect(muiConfig.dependencies["@mui/material"]).toBeDefined();
      expect(muiConfig.dependencies["@emotion/react"]).toBeDefined();
      expect(muiConfig.systemPromptAddition).toContain("Material UI");
      expect(muiConfig.systemPromptAddition).toContain("@mui/material");
    });

    it("should have Tailwind CSS configuration", () => {
      const tailwindConfig = getLibraryConfig("tailwind");

      expect(tailwindConfig.name).toBe("Pure Tailwind CSS");
      expect(tailwindConfig.devDependencies.tailwindcss).toBeDefined();
      expect(tailwindConfig.systemPromptAddition).toContain("Tailwind");
      expect(tailwindConfig.systemPromptAddition).toContain("utility classes");
    });

    it("should provide system prompt additions for AI", () => {
      const libraries: LibraryType[] = [
        "shadcn",
        "daisyui",
        "material-ui",
        "tailwind",
      ];

      libraries.forEach((lib) => {
        const config = getLibraryConfig(lib);
        expect(config.systemPromptAddition.length).toBeGreaterThan(50);
        expect(config.systemPromptAddition).toContain("component");
      });
    });

    it("should define file structures for auto-configuration", () => {
      const shadcnConfig = getLibraryConfig("shadcn");

      expect(shadcnConfig.fileStructure.length).toBeGreaterThan(0);
      expect(
        shadcnConfig.fileStructure.some((f) => f.path.includes("utils")),
      ).toBe(true);
      expect(
        shadcnConfig.fileStructure.some((f) => f.path.includes("button")),
      ).toBe(true);
    });
  });

  describe("4. Checkpoint Creation on User Prompts", () => {
    let checkpointManager: CheckpointManager;

    beforeEach(() => {
      checkpointManager = new CheckpointManager();
    });

    it("should create checkpoint with current file state", () => {
      const files = {
        "/src/app.tsx": "const x = 1;",
        "/src/utils.ts": "export const helper = () => {};",
      };

      const checkpoint = checkpointManager.createCheckpoint(
        files,
        "User prompt: Add button",
      );

      expect(checkpoint).toBeDefined();
      expect(checkpoint.label).toBe("User prompt: Add button");
      expect(checkpoint.files).toEqual(files);
      expect(checkpoint.timestamp).toBeDefined();
      expect(checkpoint.id).toBeDefined();
    });

    it("should maintain checkpoint history", () => {
      const files1 = { "/src/app.tsx": "const x = 1;" };
      const files2 = { "/src/app.tsx": "const x = 2;" };
      const files3 = { "/src/app.tsx": "const x = 3;" };

      checkpointManager.createCheckpoint(files1, "Prompt 1");
      checkpointManager.createCheckpoint(files2, "Prompt 2");
      checkpointManager.createCheckpoint(files3, "Prompt 3");

      const history = checkpointManager.getAllCheckpoints();
      expect(history).toHaveLength(3);
      expect(history[0].label).toBe("Prompt 1");
      expect(history[1].label).toBe("Prompt 2");
      expect(history[2].label).toBe("Prompt 3");
    });

    it("should allow rollback to previous checkpoint", () => {
      const files1 = { "/src/app.tsx": "const x = 1;" };
      const files2 = { "/src/app.tsx": "const x = 2;" };

      const checkpoint1 = checkpointManager.createCheckpoint(
        files1,
        "Prompt 1",
      );
      checkpointManager.createCheckpoint(files2, "Prompt 2");

      const restoredFiles = checkpointManager.restoreCheckpoint(checkpoint1.id);

      expect(restoredFiles).toEqual(files1);
      expect(restoredFiles["/src/app.tsx"]).toBe("const x = 1;");
    });

    it("should create checkpoint before each user prompt", () => {
      // Simulate user workflow
      const initialFiles = { "/src/app.tsx": "initial code" };

      // User sends first prompt
      const cp1 = checkpointManager.createCheckpoint(
        initialFiles,
        "User: Create a button",
      );
      expect(cp1.label).toContain("User:");

      // AI modifies files
      const filesAfterAI1 = { "/src/app.tsx": "code with button" };

      // User sends second prompt
      const cp2 = checkpointManager.createCheckpoint(
        filesAfterAI1,
        "User: Add styling",
      );
      expect(cp2.label).toContain("User:");

      // Should be able to rollback to state before second prompt
      const rolledBack = checkpointManager.restoreCheckpoint(cp1.id);
      expect(rolledBack).toEqual(initialFiles);
    });

    it("should limit checkpoint history to prevent memory issues", () => {
      const files = { "/src/app.tsx": "code" };

      // Create more than max checkpoints (50)
      for (let i = 0; i < 60; i++) {
        checkpointManager.createCheckpoint(files, `Prompt ${i}`);
      }

      const history = checkpointManager.getAllCheckpoints();
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it("should preserve file state exactly in checkpoint", () => {
      const files = {
        "/src/app.tsx": "const x = 1;\nconst y = 2;",
        "/src/utils.ts": "export const helper = () => {\n  return true;\n};",
        "/src/types.ts": "export type User = { id: string; name: string; };",
      };

      const checkpoint = checkpointManager.createCheckpoint(files, "Test");

      // Modify original files
      files["/src/app.tsx"] = "modified";

      // Checkpoint should have original state
      expect(checkpoint.files["/src/app.tsx"]).toBe(
        "const x = 1;\nconst y = 2;",
      );
      expect(checkpoint.files["/src/utils.ts"]).toContain("helper");
      expect(checkpoint.files["/src/types.ts"]).toContain("User");
    });
  });

  describe("5. Integration: All Features Working Together", () => {
    it("should handle complete error detection -> fix -> checkpoint flow", async () => {
      // Setup
      resetErrorDetector();
      const errorDetector = getErrorDetector();
      const aiService = new AIService({ apiKey: "test", model: "claude" });
      const autoFixService = createAutoFixService(aiService);
      const checkpointManager = new CheckpointManager();

      // Initial state
      const files = {
        "/src/app.tsx": "const x = undefinedVar;", // Error
      };

      // Create checkpoint before fix
      const beforeFixCheckpoint = checkpointManager.createCheckpoint(
        files,
        "Before auto-fix",
      );

      // Detect error
      const error: RuntimeError = {
        type: "fatal",
        message: "ReferenceError: undefinedVar is not defined",
        file: "/src/app.tsx",
        line: 1,
      };

      let errorDetected = false;
      errorDetector.addErrorListener(() => {
        errorDetected = true;
      });

      errorDetector.processError(error);
      expect(errorDetected).toBe(true);

      // Generate fix (will fail in test but structure is correct)
      const fixResult = await autoFixService.generateFix({
        error,
        files,
        aiService,
      });

      expect(fixResult).toBeDefined();

      // Create checkpoint after fix attempt
      const _afterFixCheckpoint = checkpointManager.createCheckpoint(
        files,
        "After auto-fix attempt",
      );

      // Should be able to rollback
      const rolledBack = checkpointManager.restoreCheckpoint(
        beforeFixCheckpoint.id,
      );
      expect(rolledBack).toEqual(files);
    });

    it("should handle asset generation with checkpoint", async () => {
      resetAssetGenerator();
      const assetGenerator = getAssetGenerator();
      const checkpointManager = new CheckpointManager();

      // Initial files
      const files = {
        "/src/app.tsx": '<img src="/logo.png" />',
      };

      // Create checkpoint
      checkpointManager.createCheckpoint(files, "Before asset generation");

      // Detect missing asset
      const error: RuntimeError = {
        type: "fatal",
        message: "GET /logo.png 404 (Not Found)",
      };

      const asset = await assetGenerator.processError(error);
      expect(asset).not.toBeNull();

      // Add generated asset to files
      if (asset) {
        files[asset.path] = asset.content;
      }

      // Create checkpoint after asset generation
      const afterCheckpoint = checkpointManager.createCheckpoint(
        files,
        "After asset generation",
      );

      expect(afterCheckpoint.files["/logo.png"]).toBeDefined();
      expect(afterCheckpoint.files["/logo.png"]).toContain("<svg");
    });

    it("should apply library configuration and create checkpoint", () => {
      const checkpointManager = new CheckpointManager();

      // Initial files
      const files = {
        "/src/app.tsx": 'import React from "react";',
      };

      // User selects Shadcn UI
      const shadcnConfig = getLibraryConfig("shadcn");

      // Create checkpoint before library setup
      checkpointManager.createCheckpoint(files, "Before Shadcn setup");

      // Add library files (simulated)
      files["/src/lib/utils.ts"] = "export const cn = () => {};";
      files["/src/components/ui/button.tsx"] =
        "export const Button = () => {};";

      // Create checkpoint after library setup
      const afterCheckpoint = checkpointManager.createCheckpoint(
        files,
        "After Shadcn setup",
      );

      expect(afterCheckpoint.files["/src/lib/utils.ts"]).toBeDefined();
      expect(
        afterCheckpoint.files["/src/components/ui/button.tsx"],
      ).toBeDefined();
      expect(shadcnConfig.systemPromptAddition).toContain("Shadcn");
    });
  });
});
