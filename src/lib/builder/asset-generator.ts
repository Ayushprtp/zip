/**
 * AssetGenerator - Generates placeholder assets for missing file references
 * Detects 404 errors from Sandpack and creates SVG placeholders
 */

import type { RuntimeError } from "@/types/builder";

// ============================================================================
// Types
// ============================================================================

export type AssetType = "image" | "icon" | "unknown";

export interface AssetGenerationResult {
  path: string;
  content: string;
  type: AssetType;
}

export interface AssetGeneratorOptions {
  onAssetGenerated?: (result: AssetGenerationResult) => void;
}

// ============================================================================
// AssetGenerator Class
// ============================================================================

export class AssetGenerator {
  private options: AssetGeneratorOptions;
  private generatedAssets: Set<string> = new Set();

  constructor(options: AssetGeneratorOptions = {}) {
    this.options = options;
  }

  /**
   * Detect if an error is a missing asset (404) error
   */
  isMissingAssetError(error: RuntimeError): boolean {
    const message = error.message.toLowerCase();
    const stack = (error.stack || "").toLowerCase();

    // Check for 404 patterns
    const has404 = message.includes("404") || stack.includes("404");

    // Check for "not found" patterns
    const hasNotFound =
      message.includes("not found") || stack.includes("not found");

    // Check for "failed to load" patterns
    const hasFailedToLoad =
      message.includes("failed to load") || stack.includes("failed to load");

    // Check for file extension patterns that indicate assets
    const hasAssetExtension =
      this.hasAssetExtension(message) || this.hasAssetExtension(stack);

    return (has404 || hasNotFound || hasFailedToLoad) && hasAssetExtension;
  }

  /**
   * Extract the file path from an error message
   */
  extractFilePath(error: RuntimeError): string | null {
    const message = error.message;
    const stack = error.stack || "";
    const combined = `${message} ${stack}`;

    // Try to extract path from error.file first
    if (error.file) {
      return error.file;
    }

    // Common patterns for file paths in error messages
    const patterns = [
      // Match quoted paths: "path/to/file.png"
      /"([^"]+\.(png|jpg|jpeg|gif|svg|webp|ico))"/i,
      // Match single-quoted paths: 'path/to/file.png'
      /'([^']+\.(png|jpg|jpeg|gif|svg|webp|ico))'/i,
      // Match paths after "GET" or "POST": GET /path/to/file.png
      /(?:GET|POST)\s+([^\s]+\.(png|jpg|jpeg|gif|svg|webp|ico))/i,
      // Match paths in URLs: http://localhost:3000/path/to/file.png
      /https?:\/\/[^\/]+(\/.+\.(png|jpg|jpeg|gif|svg|webp|ico))/i,
      // Match paths with src= or href=: src="/path/to/file.png"
      /(?:src|href)=["']([^"']+\.(png|jpg|jpeg|gif|svg|webp|ico))["']/i,
    ];

    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match) {
        let path = match[1];

        // Normalize path to start with /
        if (!path.startsWith("/")) {
          path = "/" + path;
        }

        return path;
      }
    }

    return null;
  }

  /**
   * Check if a string contains asset file extensions
   */
  private hasAssetExtension(text: string): boolean {
    const assetExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".webp",
      ".ico",
    ];
    return assetExtensions.some((ext) => text.includes(ext));
  }

  /**
   * Determine the asset type from the file path
   */
  getAssetType(path: string): AssetType {
    const ext = path.toLowerCase().split(".").pop() || "";

    // Icon types
    if (ext === "ico" || path.includes("icon") || path.includes("favicon")) {
      return "icon";
    }

    // Image types
    const imageExtensions = ["png", "jpg", "jpeg", "gif", "svg", "webp"];
    if (imageExtensions.includes(ext)) {
      return "image";
    }

    return "unknown";
  }

  /**
   * Infer dimensions from context (file path, error message)
   */
  private inferDimensions(
    path: string,
    context: string,
  ): { width: number; height: number } {
    const combined = `${path} ${context}`.toLowerCase();

    // Check for dimension hints in path or context
    const dimensionPatterns = [
      // Match patterns like "400x300" or "400-300"
      /(\d{2,4})[x\-](\d{2,4})/,
      // Match patterns like "w400h300"
      /w(\d{2,4})h(\d{2,4})/,
    ];

    for (const pattern of dimensionPatterns) {
      const match = combined.match(pattern);
      if (match) {
        return {
          width: parseInt(match[1], 10),
          height: parseInt(match[2], 10),
        };
      }
    }

    // Default dimensions based on asset type
    const assetType = this.getAssetType(path);

    if (assetType === "icon") {
      return { width: 32, height: 32 };
    }

    // Check for common size keywords
    if (combined.includes("thumbnail") || combined.includes("thumb")) {
      return { width: 150, height: 150 };
    }

    if (combined.includes("banner") || combined.includes("header")) {
      return { width: 1200, height: 300 };
    }

    if (combined.includes("avatar") || combined.includes("profile")) {
      return { width: 200, height: 200 };
    }

    if (combined.includes("logo")) {
      return { width: 200, height: 80 };
    }

    // Default image size
    return { width: 400, height: 300 };
  }

  /**
   * Infer a label for the placeholder from the file path
   */
  private inferLabel(path: string): string {
    // Extract filename without extension
    const filename = path.split("/").pop() || "image";
    const nameWithoutExt = filename.split(".")[0];

    // Convert kebab-case or snake_case to Title Case
    const label = nameWithoutExt
      .replace(/[-_]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return label || "Image";
  }

  /**
   * Generate a placeholder SVG for an image
   */
  private generatePlaceholderSVG(path: string, context: string): string {
    const dimensions = this.inferDimensions(path, context);
    const label = this.inferLabel(path);
    const assetType = this.getAssetType(path);

    // Calculate font size based on dimensions
    const fontSize = Math.min(dimensions.width, dimensions.height) / 10;

    // Different styles for different asset types
    if (assetType === "icon") {
      // Simple icon placeholder
      return `<svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#e0e0e0"/>
  <circle cx="50%" cy="50%" r="40%" fill="#999"/>
</svg>`;
    }

    // Standard image placeholder
    return `<svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#e0e0e0"/>
  <text 
    x="50%" 
    y="50%" 
    text-anchor="middle" 
    dominant-baseline="middle"
    fill="#666" 
    font-family="Arial, sans-serif" 
    font-size="${fontSize}px"
  >${label}</text>
  <text 
    x="50%" 
    y="60%" 
    text-anchor="middle" 
    dominant-baseline="middle"
    fill="#999" 
    font-family="Arial, sans-serif" 
    font-size="${fontSize * 0.6}px"
  >${dimensions.width}×${dimensions.height}</text>
</svg>`;
  }

  /**
   * Generate a placeholder asset for a missing file
   */
  async generatePlaceholder(
    path: string,
    context: string = "",
  ): Promise<AssetGenerationResult> {
    const assetType = this.getAssetType(path);

    // Generate SVG content
    const content = this.generatePlaceholderSVG(path, context);

    // Mark as generated
    this.generatedAssets.add(path);

    const result: AssetGenerationResult = {
      path,
      content,
      type: assetType,
    };

    // Notify callback
    this.options.onAssetGenerated?.(result);

    return result;
  }

  /**
   * Check if an asset has already been generated
   */
  hasGenerated(path: string): boolean {
    return this.generatedAssets.has(path);
  }

  /**
   * Clear the generated assets cache
   */
  clearCache(): void {
    this.generatedAssets.clear();
  }

  /**
   * Process an error and generate asset if needed
   * Returns the generated asset or null if not applicable
   */
  async processError(
    error: RuntimeError,
  ): Promise<AssetGenerationResult | null> {
    // Check if this is a missing asset error
    if (!this.isMissingAssetError(error)) {
      return null;
    }

    // Extract file path
    const path = this.extractFilePath(error);
    if (!path) {
      console.warn("Could not extract file path from error:", error);
      return null;
    }

    // Check if already generated
    if (this.hasGenerated(path)) {
      console.log("Asset already generated:", path);
      return null;
    }

    // Generate placeholder
    console.log("Generating placeholder for missing asset:", path);
    const context = `${error.message} ${error.stack || ""}`;
    return await this.generatePlaceholder(path, context);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let assetGeneratorInstance: AssetGenerator | null = null;

/**
 * Get or create the singleton AssetGenerator instance
 */
export function getAssetGenerator(
  options?: AssetGeneratorOptions,
): AssetGenerator {
  if (!assetGeneratorInstance) {
    assetGeneratorInstance = new AssetGenerator(options);
  }
  return assetGeneratorInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetAssetGenerator(): void {
  assetGeneratorInstance = null;
}
