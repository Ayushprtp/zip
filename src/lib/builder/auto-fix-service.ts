/**
 * AutoFixService - Generates and applies automatic fixes for runtime errors
 * Builds error context, sends fix requests to AI, and applies the fixes
 */

import type { RuntimeError } from "@/types/builder";
import { AIService } from "./ai-service";
import { getErrorDetector } from "./error-detector";

// ============================================================================
// Types
// ============================================================================

export interface AutoFixOptions {
  error: RuntimeError;
  files: Record<string, string>;
  aiService: AIService;
  onFixGenerated?: (fixedFiles: Record<string, string>) => void;
  onFixApplied?: () => void;
  onError?: (error: Error) => void;
}

export interface FixResult {
  success: boolean;
  fixedFiles: Record<string, string>;
  message: string;
  error?: Error;
}

// ============================================================================
// AutoFixService Class
// ============================================================================

export class AutoFixService {
  private aiService: AIService;
  private isFixing: boolean = false;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Generate and apply a fix for the given error
   */
  async generateFix(options: AutoFixOptions): Promise<FixResult> {
    const { error, files, onFixGenerated, onFixApplied, onError } = options;

    // Prevent concurrent fix attempts
    if (this.isFixing) {
      return {
        success: false,
        fixedFiles: {},
        message: "A fix is already being generated",
      };
    }

    this.isFixing = true;

    try {
      // Build error context
      const errorContext = this.buildErrorContext(error, files);

      // Build fix prompt
      const fixPrompt = this.buildFixPrompt(error, errorContext);

      // Generate fix using AI
      const fixResponse = await this.aiService.generateCode({
        prompt: fixPrompt,
        context: [],
        systemPrompt: this.getFixSystemPrompt(),
        existingFiles: files,
      });

      // Parse the fix response to extract fixed files
      const fixedFiles = this.parseFixedFiles(fixResponse, error, files);

      // Notify about generated fix
      onFixGenerated?.(fixedFiles);

      // Apply the fix (caller will handle this)
      onFixApplied?.();

      this.isFixing = false;

      return {
        success: true,
        fixedFiles,
        message: "Fix generated successfully",
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      this.isFixing = false;

      return {
        success: false,
        fixedFiles: {},
        message: `Failed to generate fix: ${error.message}`,
        error,
      };
    }
  }

  /**
   * Build error context with relevant code
   */
  private buildErrorContext(
    error: RuntimeError,
    files: Record<string, string>,
  ): string {
    const contextParts: string[] = [];

    // Add error details
    contextParts.push("=== Error Details ===");
    contextParts.push(`Type: ${error.type}`);
    contextParts.push(`Message: ${error.message}`);

    if (error.file) {
      contextParts.push(`File: ${error.file}`);
      if (error.line) {
        contextParts.push(`Line: ${error.line}`);
      }
      if (error.column) {
        contextParts.push(`Column: ${error.column}`);
      }
    }

    contextParts.push("");

    // Add stack trace
    if (error.stack) {
      contextParts.push("=== Stack Trace ===");
      contextParts.push(error.stack);
      contextParts.push("");
    }

    // Add relevant file content
    if (error.file && files[error.file]) {
      contextParts.push("=== Relevant Code ===");
      contextParts.push(`File: ${error.file}`);
      contextParts.push("```");

      // If we have line number, show context around it
      if (error.line) {
        const lines = files[error.file].split("\n");
        const startLine = Math.max(0, error.line - 10);
        const endLine = Math.min(lines.length, error.line + 10);
        const relevantLines = lines.slice(startLine, endLine);

        relevantLines.forEach((line, index) => {
          const lineNumber = startLine + index + 1;
          const marker = lineNumber === error.line ? ">>> " : "    ";
          contextParts.push(`${marker}${lineNumber}: ${line}`);
        });
      } else {
        // Show entire file if no line number
        contextParts.push(files[error.file]);
      }

      contextParts.push("```");
      contextParts.push("");
    }

    // Add related files (imports, dependencies)
    const relatedFiles = this.findRelatedFiles(error, files);
    if (relatedFiles.length > 0) {
      contextParts.push("=== Related Files ===");
      for (const filePath of relatedFiles) {
        contextParts.push(`\nFile: ${filePath}`);
        contextParts.push("```");
        contextParts.push(files[filePath]);
        contextParts.push("```");
      }
      contextParts.push("");
    }

    return contextParts.join("\n");
  }

  /**
   * Build the fix prompt for the AI
   */
  private buildFixPrompt(error: RuntimeError, errorContext: string): string {
    const errorDetector = getErrorDetector();
    const category = errorDetector.getErrorCategory(error);

    let specificInstructions = "";

    switch (category) {
      case "syntax":
        specificInstructions =
          "Fix the syntax error by correcting the invalid syntax.";
        break;
      case "reference":
        specificInstructions =
          "Fix the reference error by defining the missing variable or importing it.";
        break;
      case "type":
        specificInstructions =
          "Fix the type error by ensuring the correct type is used or adding proper type checks.";
        break;
      case "import":
        specificInstructions =
          "Fix the import error by correcting the import path or ensuring the module exists.";
        break;
      default:
        specificInstructions =
          "Fix the runtime error by addressing the root cause.";
    }

    return `
The application crashed with the following error. Please analyze the error and provide a fix.

${errorContext}

Instructions:
- ${specificInstructions}
- Provide the complete fixed file content
- Ensure the fix doesn't break other parts of the code
- Keep the existing code structure and style
- Only fix what's necessary to resolve the error

Please respond with the fixed code in the following format:
\`\`\`filepath
[complete file content]
\`\`\`

If multiple files need to be fixed, provide each one in a separate code block.
    `.trim();
  }

  /**
   * Get system prompt for fix generation
   */
  private getFixSystemPrompt(): string {
    return `You are an expert debugging assistant. Your job is to analyze runtime errors and provide precise fixes.

Rules:
1. Analyze the error message and stack trace carefully
2. Identify the root cause of the error
3. Provide a minimal fix that resolves the error
4. Preserve existing code structure and style
5. Don't introduce new bugs or break existing functionality
6. Provide complete file content, not just snippets
7. Use the exact file path from the error when providing fixes`;
  }

  /**
   * Parse fixed files from AI response
   */
  private parseFixedFiles(
    response: string,
    error: RuntimeError,
    _originalFiles: Record<string, string>,
  ): Record<string, string> {
    const fixedFiles: Record<string, string> = {};

    // Parse code blocks with file paths
    // Format: ```filepath\n[content]\n```
    const codeBlockPattern = /```([^\n]+)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockPattern.exec(response)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();

      // Validate file path
      if (filePath && content) {
        // Normalize file path (remove language identifiers like 'typescript', 'javascript')
        let normalizedPath = filePath;
        if (!filePath.startsWith("/")) {
          // If it's a language identifier, try to use the error file path
          if (
            error.file &&
            ["typescript", "javascript", "tsx", "jsx", "ts", "js"].includes(
              filePath.toLowerCase(),
            )
          ) {
            normalizedPath = error.file;
          } else {
            // Try to construct a valid path
            normalizedPath = filePath.startsWith("/")
              ? filePath
              : `/${filePath}`;
          }
        }

        fixedFiles[normalizedPath] = content;
      }
    }

    // If no files were parsed, try to extract the main file
    if (Object.keys(fixedFiles).length === 0 && error.file) {
      // Look for any code block
      const simpleCodeBlockPattern = /```[\s\S]*?\n([\s\S]*?)```/;
      const simpleMatch = response.match(simpleCodeBlockPattern);

      if (simpleMatch) {
        fixedFiles[error.file] = simpleMatch[1].trim();
      }
    }

    return fixedFiles;
  }

  /**
   * Find related files that might be relevant to the error
   */
  private findRelatedFiles(
    error: RuntimeError,
    files: Record<string, string>,
  ): string[] {
    const relatedFiles: string[] = [];

    if (!error.file) {
      return relatedFiles;
    }

    const errorFile = files[error.file];
    if (!errorFile) {
      return relatedFiles;
    }

    // Extract import statements
    const importPattern = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    let match;

    while ((match = importPattern.exec(errorFile)) !== null) {
      const importPath = match[1];

      // Try to resolve the import path
      const possiblePaths = [
        importPath,
        `${importPath}.ts`,
        `${importPath}.tsx`,
        `${importPath}.js`,
        `${importPath}.jsx`,
        `${importPath}/index.ts`,
        `${importPath}/index.tsx`,
        `${importPath}/index.js`,
        `${importPath}/index.jsx`,
      ];

      for (const path of possiblePaths) {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        if (files[normalizedPath]) {
          relatedFiles.push(normalizedPath);
          break;
        }
      }
    }

    // Limit to 3 related files to avoid context overflow
    return relatedFiles.slice(0, 3);
  }

  /**
   * Check if currently fixing
   */
  isCurrentlyFixing(): boolean {
    return this.isFixing;
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createAutoFixService(aiService: AIService): AutoFixService {
  return new AutoFixService(aiService);
}
