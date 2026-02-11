import * as python from "./python";
import * as go from "./go";
import * as js from "./js";
import type { FunctionLanguage, ValidationResult } from "../types";
// Individual imports for better tree-shaking
import { SiPython } from "react-icons/si";
import { SiGo } from "react-icons/si";
import { SiJavascript } from "react-icons/si";
import { SiRust } from "react-icons/si";
import { SiC } from "react-icons/si";
import { SiCplusplus } from "react-icons/si";
import type { IconType } from "react-icons";

// Re-export individual languages
export { python, go, js };

/**
 * Get the icon component for a language
 */
export function getLanguageIcon(language: FunctionLanguage): IconType {
  const iconMap: Record<FunctionLanguage, IconType> = {
    python: SiPython,
    go: SiGo,
    js: SiJavascript,
    rust: SiRust,
    c: SiC,
    cpp: SiCplusplus,
  };
  return iconMap[language];
}

/**
 * Language configuration
 */
export interface LanguageConfig {
  id: FunctionLanguage;
  monacoLanguage: string;
  displayName: string;
  isAvailable: boolean;
  importHeader: string;
  defaultTemplate: string;
  validate: (code: string) => ValidationResult;
  icon: IconType;
}

/**
 * All supported languages
 */
export const LANGUAGES: Record<FunctionLanguage, LanguageConfig> = {
  python: {
    id: "python",
    monacoLanguage: python.MONACO_LANGUAGE,
    displayName: python.DISPLAY_NAME,
    isAvailable: python.IS_AVAILABLE,
    importHeader: python.IMPORT_HEADER,
    defaultTemplate: python.DEFAULT_TEMPLATE,
    validate: python.validate,
    icon: SiPython,
  },
  go: {
    id: "go",
    monacoLanguage: go.MONACO_LANGUAGE,
    displayName: go.DISPLAY_NAME,
    isAvailable: go.IS_AVAILABLE,
    importHeader: go.IMPORT_HEADER,
    defaultTemplate: go.DEFAULT_TEMPLATE,
    validate: go.validate,
    icon: SiGo,
  },
  js: {
    id: "js",
    monacoLanguage: js.MONACO_LANGUAGE,
    displayName: js.DISPLAY_NAME,
    isAvailable: js.IS_AVAILABLE,
    importHeader: js.IMPORT_HEADER,
    defaultTemplate: js.DEFAULT_TEMPLATE,
    validate: js.validate,
    icon: SiJavascript,
  },
  rust: {
    id: "rust",
    monacoLanguage: "rust",
    displayName: "Rust",
    isAvailable: false,
    importHeader: "",
    defaultTemplate: "",
    validate: (code) => ({
      valid: !!code?.trim(),
      errorCode: code?.trim() ? "common.valid" : "common.empty_code",
    }),
    icon: SiRust,
  },
  c: {
    id: "c",
    monacoLanguage: "c",
    displayName: "C",
    isAvailable: false,
    importHeader: "",
    defaultTemplate: "",
    validate: (code) => ({
      valid: !!code?.trim(),
      errorCode: code?.trim() ? "common.valid" : "common.empty_code",
    }),
    icon: SiC,
  },
  cpp: {
    id: "cpp",
    monacoLanguage: "cpp",
    displayName: "C++",
    isAvailable: false,
    importHeader: "",
    defaultTemplate: "",
    validate: (code) => ({
      valid: !!code?.trim(),
      errorCode: code?.trim() ? "common.valid" : "common.empty_code",
    }),
    icon: SiCplusplus,
  },
};

export function getLanguageConfig(language: FunctionLanguage): LanguageConfig {
  return LANGUAGES[language];
}

export function validateCode(
  code: string,
  language: FunctionLanguage,
): ValidationResult {
  return LANGUAGES[language].validate(code);
}

export function getImportHeader(language: FunctionLanguage): string {
  return LANGUAGES[language].importHeader;
}

export function getDefaultTemplate(language: FunctionLanguage): string {
  return LANGUAGES[language].defaultTemplate;
}

export function getMonacoLanguage(language: FunctionLanguage): string {
  return LANGUAGES[language].monacoLanguage;
}

export function getAvailableLanguages(): LanguageConfig[] {
  return Object.values(LANGUAGES).filter((lang) => lang.isAvailable);
}

export function getAllLanguages(): LanguageConfig[] {
  return Object.values(LANGUAGES);
}
