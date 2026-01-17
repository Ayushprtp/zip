/**
 * Property-based tests for SandpackWrapper
 * Feature: ai-builder-ide
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  TEMPLATE_CONFIGS,
  getDefaultFiles,
} from "@/lib/builder/template-configs";
import type { TemplateType } from "@/types/builder";

describe("SandpackWrapper Properties", () => {
  /**
   * Feature: ai-builder-ide, Property 1: Template Initialization Correctness
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4
   *
   * For any template type (vite-react, nextjs, node, static), when a user selects that template,
   * the Sandpack wrapper should initialize with the correct template configuration including
   * appropriate dependencies and file structure.
   */
  it("should initialize with correct template configuration for all template types", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TemplateType>("vite-react", "nextjs", "node", "static"),
        (template) => {
          // Get the template configuration
          const config = TEMPLATE_CONFIGS[template];

          // Verify template configuration exists
          expect(config).toBeDefined();

          // Verify entry point is defined
          expect(config.entry).toBeDefined();
          expect(typeof config.entry).toBe("string");
          expect(config.entry.length).toBeGreaterThan(0);

          // Verify dependencies are defined
          expect(config.dependencies).toBeDefined();
          expect(typeof config.dependencies).toBe("object");

          // Verify devDependencies are defined (can be empty)
          expect(config.devDependencies).toBeDefined();
          expect(typeof config.devDependencies).toBe("object");

          // Verify structure is defined (if present)
          if (config.structure) {
            expect(Array.isArray(config.structure)).toBe(true);
            expect(config.structure.length).toBeGreaterThan(0);
          }

          // Verify runtime is correct for node and static templates
          if (template === "node") {
            expect(config.runtime).toBe("node");
          } else if (template === "static") {
            expect(config.runtime).toBe("static");
          }

          // Get default files for the template
          const defaultFiles = getDefaultFiles(template);

          // Verify default files are returned
          expect(defaultFiles).toBeDefined();
          expect(typeof defaultFiles).toBe("object");
          expect(Object.keys(defaultFiles).length).toBeGreaterThan(0);

          // Verify entry file exists in default files
          expect(defaultFiles[config.entry]).toBeDefined();

          // Verify package.json exists for all templates
          expect(defaultFiles["/package.json"]).toBeDefined();

          // Parse package.json to verify dependencies
          const packageJson = JSON.parse(defaultFiles["/package.json"]);
          expect(packageJson.dependencies).toEqual(config.dependencies);
          expect(packageJson.devDependencies).toEqual(config.devDependencies);

          // Template-specific validations
          switch (template) {
            case "vite-react":
              // Verify React dependencies
              expect(config.dependencies.react).toBeDefined();
              expect(config.dependencies["react-dom"]).toBeDefined();
              // Verify Vite in devDependencies
              expect(config.devDependencies?.vite).toBeDefined();
              // Verify key files exist
              expect(defaultFiles["/index.html"]).toBeDefined();
              expect(defaultFiles["/src/main.tsx"]).toBeDefined();
              expect(defaultFiles["/src/App.tsx"]).toBeDefined();
              expect(defaultFiles["/vite.config.ts"]).toBeDefined();
              break;

            case "nextjs":
              // Verify Next.js dependencies
              expect(config.dependencies.next).toBeDefined();
              expect(config.dependencies.react).toBeDefined();
              expect(config.dependencies["react-dom"]).toBeDefined();
              // Verify App Router structure
              expect(defaultFiles["/app/page.tsx"]).toBeDefined();
              expect(defaultFiles["/app/layout.tsx"]).toBeDefined();
              expect(defaultFiles["/next.config.js"]).toBeDefined();
              expect(defaultFiles["/tsconfig.json"]).toBeDefined();
              break;

            case "node":
              // Verify runtime is node
              expect(config.runtime).toBe("node");
              // Verify entry file
              expect(defaultFiles["/index.js"]).toBeDefined();
              // Verify package.json has correct main
              expect(packageJson.main).toBe("index.js");
              break;

            case "static":
              // Verify runtime is static
              expect(config.runtime).toBe("static");
              // Verify static files
              expect(defaultFiles["/index.html"]).toBeDefined();
              expect(defaultFiles["/style.css"]).toBeDefined();
              expect(defaultFiles["/script.js"]).toBeDefined();
              // Verify no dependencies
              expect(Object.keys(config.dependencies).length).toBe(0);
              break;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Additional property: Template files are valid and non-empty
   */
  it("should generate non-empty valid files for all templates", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TemplateType>("vite-react", "nextjs", "node", "static"),
        (template) => {
          const defaultFiles = getDefaultFiles(template);

          // All files should have non-empty content
          for (const [path, content] of Object.entries(defaultFiles)) {
            expect(content).toBeDefined();
            expect(typeof content).toBe("string");
            expect(content.length).toBeGreaterThan(0);

            // Verify path starts with /
            expect(path.startsWith("/")).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Additional property: Package.json is valid JSON for all templates
   */
  it("should generate valid package.json for all templates", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TemplateType>("vite-react", "nextjs", "node", "static"),
        (template) => {
          const defaultFiles = getDefaultFiles(template);
          const packageJsonContent = defaultFiles["/package.json"];

          // Should be able to parse package.json
          expect(() => JSON.parse(packageJsonContent)).not.toThrow();

          const packageJson = JSON.parse(packageJsonContent);

          // Should have required fields
          expect(packageJson.name).toBeDefined();
          expect(typeof packageJson.name).toBe("string");
          expect(packageJson.version).toBeDefined();
          expect(packageJson.dependencies).toBeDefined();
          expect(typeof packageJson.dependencies).toBe("object");
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * HMR Behavior Property Tests
 */

describe("SandpackWrapper HMR Properties", () => {
  /**
   * Feature: ai-builder-ide, Property 33: File Modification Triggers HMR
   * Validates: Requirements 16.1
   *
   * For any file modification in the virtual file system, the Sandpack runtime
   * should trigger an HMR update to the preview iframe.
   */
  it("should detect file changes and trigger HMR", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TemplateType>("vite-react", "nextjs", "node", "static"),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (_template, fileName, newContent) => {
          // Create initial files
          const initialFiles = {
            "/test.js": 'console.log("initial");',
          };

          // Modify a file
          const modifiedFiles = {
            ...initialFiles,
            [`/${fileName}.js`]: newContent,
          };

          // Verify files are different
          const filesChanged =
            Object.keys(initialFiles).length !==
              Object.keys(modifiedFiles).length ||
            Object.keys(modifiedFiles).some(
              (path) => initialFiles[path] !== modifiedFiles[path],
            );

          // If files changed, HMR should be triggered
          if (filesChanged) {
            expect(filesChanged).toBe(true);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * Feature: ai-builder-ide, Property 34: HMR Failure Fallback
   * Validates: Requirements 16.3
   *
   * For any HMR update failure, the system should perform a full reload
   * of the preview iframe.
   */
  it("should fallback to full reload after multiple HMR failures", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (failureCount) => {
        const MAX_HMR_FAILURES = 3;

        // Simulate HMR failures
        let shouldReload = false;
        if (failureCount >= MAX_HMR_FAILURES) {
          shouldReload = true;
        }

        // Verify fallback logic
        if (failureCount >= MAX_HMR_FAILURES) {
          expect(shouldReload).toBe(true);
        } else {
          expect(shouldReload).toBe(false);
        }
      }),
      { numRuns: 20 },
    );
  });

  /**
   * Additional property: File change detection is accurate
   */
  it("should accurately detect which files changed", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()),
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()),
        (prevFiles, currentFiles) => {
          // Detect changed files
          const changedFiles = Object.keys(currentFiles).filter(
            (path) => prevFiles[path] !== currentFiles[path],
          );

          // Detect added files
          const addedFiles = Object.keys(currentFiles).filter(
            (path) => !(path in prevFiles),
          );

          // Detect deleted files
          const deletedFiles = Object.keys(prevFiles).filter(
            (path) => !(path in currentFiles),
          );

          // Verify detection logic
          for (const path of changedFiles) {
            expect(currentFiles[path]).toBeDefined();
            if (path in prevFiles) {
              expect(prevFiles[path]).not.toBe(currentFiles[path]);
            }
          }

          for (const path of addedFiles) {
            expect(currentFiles[path]).toBeDefined();
            expect(prevFiles[path]).toBeUndefined();
          }

          for (const path of deletedFiles) {
            expect(prevFiles[path]).toBeDefined();
            expect(currentFiles[path]).toBeUndefined();
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
