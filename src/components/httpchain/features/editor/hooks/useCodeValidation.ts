import { useMemo } from "react";
import { validateCode } from "../components/step/extractors/function/languages";
import type {
  ValidationResult,
  FunctionLanguage,
} from "../components/step/extractors/function/types";

/**
 * Hook to validate function extractor code.
 * Uses language-specific validation from the languages module.
 *
 * @param code - The code to validate
 * @param language - The programming language of the code
 * @returns ValidationResult with error details if invalid
 */
export function useCodeValidation(
  code: string,
  language: FunctionLanguage,
): ValidationResult {
  return useMemo(() => {
    return validateCode(code, language);
  }, [code, language]);
}
