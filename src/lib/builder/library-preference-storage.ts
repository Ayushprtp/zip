/**
 * Library Preference Storage
 * Handles persistence of library preference to browser storage
 */

import type { LibraryType } from "@/types/builder";

const STORAGE_KEY = "ai-builder-library-preference";

/**
 * Save library preference to browser storage
 */
export function saveLibraryPreference(library: LibraryType): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, library);
    }
  } catch (error) {
    console.error("Failed to save library preference:", error);
  }
}

/**
 * Load library preference from browser storage
 * Returns null if not found or invalid
 */
export function loadLibraryPreference(): LibraryType | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidLibraryType(stored)) {
        return stored as LibraryType;
      }
    }
  } catch (error) {
    console.error("Failed to load library preference:", error);
  }
  return null;
}

/**
 * Clear library preference from browser storage
 */
export function clearLibraryPreference(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error("Failed to clear library preference:", error);
  }
}

/**
 * Validate library type
 */
function isValidLibraryType(value: string): boolean {
  const validTypes: LibraryType[] = [
    "shadcn",
    "daisyui",
    "material-ui",
    "tailwind",
  ];
  return validTypes.includes(value as LibraryType);
}
