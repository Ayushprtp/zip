/**
 * Property-Based Tests for Shadcn Auto-Configuration
 * Tests Property 25
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isShadcnComponent,
  extractComponentName,
  getRadixDependenciesForComponent,
  getShadcnBaseDependencies,
  getShadcnDevDependencies,
  needsUtilsFile,
  getUtilsFileContent,
  autoConfigureShadcn,
  mergeDependenciesIntoPackageJson,
} from "./shadcn-auto-config";
import type { LibraryType } from "@/types/builder";

describe("Shadcn Auto-Configuration Properties", () => {
  // Feature: ai-builder-ide, Property 25: Shadcn Auto-Configuration
  it("should auto-configure Shadcn when components are generated", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "button",
          "dialog",
          "dropdown-menu",
          "select",
          "checkbox",
          "tooltip",
          "tabs",
        ),
        (componentName) => {
          const filePath = `/src/components/ui/${componentName}.tsx`;
          const existingFiles: Record<string, string> = {};
          const libraryPreference: LibraryType = "shadcn";

          // Auto-configure
          const result = autoConfigureShadcn(
            filePath,
            existingFiles,
            libraryPreference,
          );

          // Verify result exists
          expect(result).not.toBeNull();

          if (result) {
            // Verify base dependencies are included
            const baseDeps = getShadcnBaseDependencies();
            for (const [dep, version] of Object.entries(baseDeps)) {
              expect(result.dependenciesToAdd[dep]).toBe(version);
            }

            // Verify dev dependencies are included
            const devDeps = getShadcnDevDependencies();
            for (const [dep, version] of Object.entries(devDeps)) {
              expect(result.devDependenciesToAdd[dep]).toBe(version);
            }

            // Verify component-specific Radix dependencies are included
            const radixDeps = getRadixDependenciesForComponent(componentName);
            for (const [dep, version] of Object.entries(radixDeps)) {
              expect(result.dependenciesToAdd[dep]).toBe(version);
            }

            // Verify utils.ts is created when needed
            if (needsUtilsFile(existingFiles)) {
              expect(result.filesToCreate["/src/lib/utils.ts"]).toBeDefined();
              expect(result.filesToCreate["/src/lib/utils.ts"]).toContain("cn");
              expect(result.filesToCreate["/src/lib/utils.ts"]).toContain(
                "twMerge",
              );
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional test: Verify component detection
  it("should correctly identify Shadcn components", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "/src/components/ui/button.tsx",
          "/components/ui/dialog.tsx",
          "src/components/ui/select.tsx",
          "/app/components/ui/checkbox.tsx",
        ),
        (filePath) => {
          expect(isShadcnComponent(filePath)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional test: Verify non-Shadcn components are not detected
  it("should not identify non-Shadcn components", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "/src/components/Header.tsx",
          "/src/pages/index.tsx",
          "/src/lib/utils.ts",
          "/src/app/layout.tsx",
        ),
        (filePath) => {
          expect(isShadcnComponent(filePath)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional test: Verify component name extraction
  it("should correctly extract component names", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.constantFrom("button", "dialog", "select", "checkbox"),
          ext: fc.constantFrom(".tsx", ".ts", ".jsx", ".js"),
        }),
        ({ name, ext }) => {
          const filePath = `/src/components/ui/${name}${ext}`;
          const extracted = extractComponentName(filePath);
          expect(extracted).toBe(name);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional test: Verify utils.ts detection
  it("should detect when utils.ts is needed", () => {
    fc.assert(
      fc.property(fc.boolean(), (hasUtils) => {
        const files: Record<string, string> = hasUtils
          ? { "/src/lib/utils.ts": "content" }
          : {};

        const needed = needsUtilsFile(files);
        expect(needed).toBe(!hasUtils);
      }),
      { numRuns: 100 },
    );
  });

  // Additional test: Verify utils.ts content
  it("should generate valid utils.ts content", () => {
    const content = getUtilsFileContent();

    expect(content).toContain("cn");
    expect(content).toContain("clsx");
    expect(content).toContain("twMerge");
    expect(content).toContain("ClassValue");
  });

  // Additional test: Verify no auto-config for non-Shadcn libraries
  it("should not auto-configure for non-Shadcn libraries", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LibraryType>("daisyui", "material-ui", "tailwind"),
        (libraryType) => {
          const filePath = "/src/components/ui/button.tsx";
          const existingFiles: Record<string, string> = {};

          const result = autoConfigureShadcn(
            filePath,
            existingFiles,
            libraryType,
          );

          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional test: Verify package.json merging
  it("should correctly merge dependencies into package.json", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          version: fc.string(),
        }),
        ({ name, version }) => {
          const packageJson = JSON.stringify(
            {
              name: "test-project",
              version: "1.0.0",
              dependencies: {},
              devDependencies: {},
            },
            null,
            2,
          );

          const newDeps = { [name]: version };
          const newDevDeps = { [`dev-${name}`]: version };

          const merged = mergeDependenciesIntoPackageJson(
            packageJson,
            newDeps,
            newDevDeps,
          );
          const parsed = JSON.parse(merged);

          expect(parsed.dependencies[name]).toBe(version);
          expect(parsed.devDependencies[`dev-${name}`]).toBe(version);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional test: Verify Radix dependencies mapping
  it("should return correct Radix dependencies for known components", () => {
    const knownComponents = [
      "button",
      "dialog",
      "dropdown-menu",
      "select",
      "checkbox",
      "tooltip",
    ];

    for (const component of knownComponents) {
      const deps = getRadixDependenciesForComponent(component);
      expect(Object.keys(deps).length).toBeGreaterThan(0);

      // All dependencies should be Radix UI packages
      for (const dep of Object.keys(deps)) {
        expect(dep).toContain("@radix-ui/");
      }
    }
  });

  // Additional test: Verify base dependencies are complete
  it("should include all required base dependencies", () => {
    const baseDeps = getShadcnBaseDependencies();

    // Verify essential dependencies
    expect(baseDeps["class-variance-authority"]).toBeDefined();
    expect(baseDeps["clsx"]).toBeDefined();
    expect(baseDeps["tailwind-merge"]).toBeDefined();
    expect(baseDeps["lucide-react"]).toBeDefined();
  });

  // Additional test: Verify dev dependencies are complete
  it("should include all required dev dependencies", () => {
    const devDeps = getShadcnDevDependencies();

    // Verify essential dev dependencies
    expect(devDeps["tailwindcss"]).toBeDefined();
    expect(devDeps["autoprefixer"]).toBeDefined();
    expect(devDeps["postcss"]).toBeDefined();
  });
});
