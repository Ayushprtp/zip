/**
 * Library Configuration System
 * Defines UI library configurations with dependencies, file structures, and AI prompts
 */

import type { LibraryConfig, LibraryType } from "@/types/builder";

/**
 * Library configurations for different UI frameworks
 * Each configuration includes:
 * - dependencies: Runtime dependencies to install
 * - devDependencies: Development dependencies
 * - fileStructure: Template files to create
 * - systemPromptAddition: AI instructions for using the library
 */
export const LIBRARY_CONFIGS: Record<LibraryType, LibraryConfig> = {
  shadcn: {
    name: "Shadcn UI",
    dependencies: {
      "@radix-ui/react-dialog": "^1.0.5",
      "@radix-ui/react-dropdown-menu": "^2.0.6",
      "@radix-ui/react-slot": "^1.0.2",
      "@radix-ui/react-tooltip": "^1.0.7",
      "@radix-ui/react-select": "^2.0.0",
      "@radix-ui/react-checkbox": "^1.0.4",
      "@radix-ui/react-label": "^2.0.2",
      "@radix-ui/react-separator": "^1.0.3",
      "@radix-ui/react-tabs": "^1.0.4",
      "class-variance-authority": "^0.7.0",
      clsx: "^2.1.0",
      "tailwind-merge": "^2.2.1",
      "lucide-react": "^0.344.0",
    },
    devDependencies: {
      tailwindcss: "^3.4.1",
      "@tailwindcss/typography": "^0.5.10",
      autoprefixer: "^10.4.17",
      postcss: "^8.4.35",
    },
    fileStructure: [
      {
        path: "/src/lib/utils.ts",
        template: "shadcn-utils",
      },
      {
        path: "/src/components/ui/button.tsx",
        template: "shadcn-button",
      },
      {
        path: "/tailwind.config.js",
        template: "shadcn-tailwind-config",
      },
    ],
    systemPromptAddition: `You are building with Shadcn UI components. Follow these guidelines:
- Import components from @/components/ui (e.g., import { Button } from "@/components/ui/button")
- Use Tailwind CSS utility classes for styling
- Shadcn components are built on Radix UI primitives
- Use the cn() utility from @/lib/utils for conditional classes
- Follow Shadcn's design patterns: accessible, customizable, and composable
- When creating new components, place them in /src/components/ui/
- Use Tailwind's design tokens for consistency (colors, spacing, typography)
- Ensure all components are accessible with proper ARIA attributes`,
  },

  daisyui: {
    name: "DaisyUI",
    dependencies: {
      daisyui: "^4.7.2",
    },
    devDependencies: {
      tailwindcss: "^3.4.1",
      autoprefixer: "^10.4.17",
      postcss: "^8.4.35",
    },
    fileStructure: [
      {
        path: "/tailwind.config.js",
        template: "daisyui-tailwind-config",
      },
    ],
    systemPromptAddition: `You are building with DaisyUI components. Follow these guidelines:
- Use DaisyUI component classes (e.g., btn, card, modal, navbar)
- DaisyUI is a Tailwind CSS component library with semantic class names
- Use data-theme attribute for theme switching
- Common components: btn, btn-primary, card, card-body, modal, navbar, drawer
- Use Tailwind utilities alongside DaisyUI classes
- Follow DaisyUI naming conventions (e.g., btn-sm, btn-lg for sizes)
- Use DaisyUI's built-in themes or customize in tailwind.config.js
- Combine with Tailwind utilities for custom styling`,
  },

  "material-ui": {
    name: "Material UI",
    dependencies: {
      "@mui/material": "^5.15.10",
      "@mui/icons-material": "^5.15.10",
      "@emotion/react": "^11.11.3",
      "@emotion/styled": "^11.11.0",
    },
    devDependencies: {},
    fileStructure: [
      {
        path: "/src/theme.ts",
        template: "mui-theme",
      },
    ],
    systemPromptAddition: `You are building with Material UI (MUI) components. Follow these guidelines:
- Import components from @mui/material (e.g., import { Button } from '@mui/material')
- Import icons from @mui/icons-material
- Use MUI's sx prop for styling with theme-aware values
- Follow Material Design principles
- Use the theme system for consistent colors, spacing, and typography
- Common components: Button, TextField, Card, AppBar, Drawer, Dialog
- Use MUI's Grid or Stack for layouts
- Leverage MUI's built-in responsive utilities
- Use variant prop for component variations (contained, outlined, text)
- Ensure accessibility with proper labels and ARIA attributes`,
  },

  tailwind: {
    name: "Pure Tailwind CSS",
    dependencies: {},
    devDependencies: {
      tailwindcss: "^3.4.1",
      "@tailwindcss/typography": "^0.5.10",
      "@tailwindcss/forms": "^0.5.7",
      autoprefixer: "^10.4.17",
      postcss: "^8.4.35",
    },
    fileStructure: [
      {
        path: "/tailwind.config.js",
        template: "tailwind-config",
      },
      {
        path: "/src/styles/globals.css",
        template: "tailwind-globals",
      },
    ],
    systemPromptAddition: `You are building with pure Tailwind CSS. Follow these guidelines:
- Use Tailwind utility classes for all styling
- No component library - build custom components with Tailwind
- Use Tailwind's design system (colors, spacing, typography)
- Leverage responsive modifiers (sm:, md:, lg:, xl:, 2xl:)
- Use state modifiers (hover:, focus:, active:, disabled:)
- Use @apply in CSS files sparingly, prefer utility classes in JSX
- Use Tailwind plugins when needed (@tailwindcss/forms, @tailwindcss/typography)
- Follow mobile-first responsive design
- Use Tailwind's arbitrary values when needed (e.g., w-[137px])
- Ensure accessibility with proper semantic HTML and ARIA attributes`,
  },
};

/**
 * Get library configuration by type
 */
export function getLibraryConfig(libraryType: LibraryType): LibraryConfig {
  return LIBRARY_CONFIGS[libraryType];
}

/**
 * Get all available library types
 */
export function getAvailableLibraries(): LibraryType[] {
  return Object.keys(LIBRARY_CONFIGS) as LibraryType[];
}

/**
 * Get library display name
 */
export function getLibraryDisplayName(libraryType: LibraryType): string {
  return LIBRARY_CONFIGS[libraryType].name;
}

/**
 * Check if a library requires auto-configuration
 * (e.g., Shadcn needs automatic dependency installation)
 */
export function requiresAutoConfiguration(libraryType: LibraryType): boolean {
  return libraryType === "shadcn";
}
