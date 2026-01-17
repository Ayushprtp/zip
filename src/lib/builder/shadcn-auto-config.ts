/**
 * Shadcn Auto-Configuration Service
 * Automatically configures Shadcn UI when components are generated
 */

import { getLibraryConfig } from "./library-configs";
import type { LibraryType } from "@/types/builder";

/**
 * Check if a file path is a Shadcn component
 */
export function isShadcnComponent(filePath: string): boolean {
  return (
    filePath.includes("/components/ui/") ||
    filePath.includes("\\components\\ui\\")
  );
}

/**
 * Extract component name from file path
 * e.g., /src/components/ui/button.tsx -> button
 */
export function extractComponentName(filePath: string): string {
  const parts = filePath.split("/");
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.(tsx?|jsx?)$/, "");
}

/**
 * Get required Radix UI dependencies for a Shadcn component
 * This is a mapping of common Shadcn components to their Radix dependencies
 */
export function getRadixDependenciesForComponent(
  componentName: string,
): Record<string, string> {
  const componentDependencies: Record<string, Record<string, string>> = {
    button: {
      "@radix-ui/react-slot": "^1.0.2",
    },
    dialog: {
      "@radix-ui/react-dialog": "^1.0.5",
    },
    "dropdown-menu": {
      "@radix-ui/react-dropdown-menu": "^2.0.6",
    },
    select: {
      "@radix-ui/react-select": "^2.0.0",
    },
    checkbox: {
      "@radix-ui/react-checkbox": "^1.0.4",
    },
    label: {
      "@radix-ui/react-label": "^2.0.2",
    },
    tooltip: {
      "@radix-ui/react-tooltip": "^1.0.7",
    },
    separator: {
      "@radix-ui/react-separator": "^1.0.3",
    },
    tabs: {
      "@radix-ui/react-tabs": "^1.0.4",
    },
    accordion: {
      "@radix-ui/react-accordion": "^1.1.2",
    },
    alert: {
      "@radix-ui/react-alert-dialog": "^1.0.5",
    },
    "alert-dialog": {
      "@radix-ui/react-alert-dialog": "^1.0.5",
    },
    "context-menu": {
      "@radix-ui/react-context-menu": "^2.1.5",
    },
    "hover-card": {
      "@radix-ui/react-hover-card": "^1.0.7",
    },
    menubar: {
      "@radix-ui/react-menubar": "^1.0.4",
    },
    "navigation-menu": {
      "@radix-ui/react-navigation-menu": "^1.1.4",
    },
    popover: {
      "@radix-ui/react-popover": "^1.0.7",
    },
    progress: {
      "@radix-ui/react-progress": "^1.0.3",
    },
    "radio-group": {
      "@radix-ui/react-radio-group": "^1.1.3",
    },
    "scroll-area": {
      "@radix-ui/react-scroll-area": "^1.0.5",
    },
    slider: {
      "@radix-ui/react-slider": "^1.1.2",
    },
    switch: {
      "@radix-ui/react-switch": "^1.0.3",
    },
    toast: {
      "@radix-ui/react-toast": "^1.1.5",
    },
    toggle: {
      "@radix-ui/react-toggle": "^1.0.3",
    },
    "toggle-group": {
      "@radix-ui/react-toggle-group": "^1.0.4",
    },
  };

  return componentDependencies[componentName] || {};
}

/**
 * Get all Shadcn base dependencies (always needed)
 */
export function getShadcnBaseDependencies(): Record<string, string> {
  return {
    "class-variance-authority": "^0.7.0",
    clsx: "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "lucide-react": "^0.344.0",
  };
}

/**
 * Get Shadcn dev dependencies
 */
export function getShadcnDevDependencies(): Record<string, string> {
  return {
    tailwindcss: "^3.4.1",
    "@tailwindcss/typography": "^0.5.10",
    autoprefixer: "^10.4.17",
    postcss: "^8.4.35",
  };
}

/**
 * Check if utils.ts file needs to be created
 */
export function needsUtilsFile(files: Record<string, string>): boolean {
  return !files["/src/lib/utils.ts"] && !files["src/lib/utils.ts"];
}

/**
 * Get the utils.ts file content
 */
export function getUtilsFileContent(): string {
  return `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`;
}

/**
 * Check if components/ui directory structure needs to be created
 */
export function needsComponentsUiDirectory(
  files: Record<string, string>,
): boolean {
  // Check if any file exists in /src/components/ui/ or /components/ui/
  const hasUiComponents = Object.keys(files).some(
    (path) =>
      path.includes("/components/ui/") || path.includes("\\components\\ui\\"),
  );
  return !hasUiComponents;
}

/**
 * Auto-configure Shadcn when a component is detected
 * Returns the files that need to be created and dependencies to add
 */
export interface ShadcnAutoConfigResult {
  filesToCreate: Record<string, string>;
  dependenciesToAdd: Record<string, string>;
  devDependenciesToAdd: Record<string, string>;
}

export function autoConfigureShadcn(
  newFilePath: string,
  existingFiles: Record<string, string>,
  libraryPreference: LibraryType,
): ShadcnAutoConfigResult | null {
  // Only auto-configure if Shadcn is selected
  if (libraryPreference !== "shadcn") {
    return null;
  }

  // Only auto-configure if this is a Shadcn component
  if (!isShadcnComponent(newFilePath)) {
    return null;
  }

  const result: ShadcnAutoConfigResult = {
    filesToCreate: {},
    dependenciesToAdd: {},
    devDependenciesToAdd: {},
  };

  // Add base dependencies
  result.dependenciesToAdd = { ...getShadcnBaseDependencies() };
  result.devDependenciesToAdd = { ...getShadcnDevDependencies() };

  // Add component-specific Radix dependencies
  const componentName = extractComponentName(newFilePath);
  const radixDeps = getRadixDependenciesForComponent(componentName);
  result.dependenciesToAdd = { ...result.dependenciesToAdd, ...radixDeps };

  // Create utils.ts if needed
  if (needsUtilsFile(existingFiles)) {
    result.filesToCreate["/src/lib/utils.ts"] = getUtilsFileContent();
  }

  return result;
}

/**
 * Merge dependencies into existing package.json content
 */
export function mergeDependenciesIntoPackageJson(
  packageJsonContent: string,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
): string {
  try {
    const packageJson = JSON.parse(packageJsonContent);

    // Merge dependencies
    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...dependencies,
    };

    // Merge devDependencies
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      ...devDependencies,
    };

    return JSON.stringify(packageJson, null, 2);
  } catch (error) {
    console.error("Failed to merge dependencies into package.json:", error);
    return packageJsonContent;
  }
}
