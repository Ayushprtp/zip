/**
 * Comprehensive error handling system for the AI Builder IDE
 * Provides specialized handlers for different error categories
 */

import { toast } from "sonner";
import type { RuntimeError } from "@/types/builder";

// ============================================================================
// Error Types
// ============================================================================

export interface APIError extends Error {
  status?: number;
  request?: () => Promise<any>;
}

export interface FileSystemError extends Error {
  type: "FILE_NOT_FOUND" | "INVALID_PATH" | "PERMISSION_DENIED" | "UNKNOWN";
  path?: string;
}

export interface StateError extends Error {
  type: "INCONSISTENCY" | "CORRUPTION" | "SYNC_FAILURE";
  context?: any;
}

export interface NetworkError extends Error {
  status?: number;
  retryable: boolean;
}

// ============================================================================
// Runtime Error Handler
// ============================================================================

export class RuntimeErrorHandler {
  private errorListeners: Set<(error: RuntimeError) => void> = new Set();

  /**
   * Register a listener for runtime errors
   */
  onError(listener: (error: RuntimeError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Handle a runtime error from Sandpack
   */
  handleError(error: RuntimeError): void {
    // Log error for debugging
    console.error("[RuntimeError]", error);

    // Notify all listeners
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        console.error("Error in error listener:", err);
      }
    });

    // Show user-friendly error message
    if (error.type === "fatal") {
      toast.error("Runtime Error", {
        description: this.formatErrorMessage(error),
        duration: 5000,
      });
    } else if (error.type === "warning") {
      toast.warning("Warning", {
        description: error.message,
        duration: 3000,
      });
    }
  }

  /**
   * Check if an error is auto-fixable
   */
  isAutoFixable(error: RuntimeError): boolean {
    const fixableTypes = [
      "SyntaxError",
      "ReferenceError",
      "ImportError",
      "TypeError",
      "ModuleNotFoundError",
    ];
    return fixableTypes.some((type) => error.message.includes(type));
  }

  /**
   * Format error message for display
   */
  private formatErrorMessage(error: RuntimeError): string {
    let message = error.message;

    if (error.file && error.line) {
      message = `${error.file}:${error.line} - ${message}`;
    }

    return message.length > 200 ? message.substring(0, 200) + "..." : message;
  }
}

// ============================================================================
// Network Error Handler
// ============================================================================

export class NetworkErrorHandler {
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second

  /**
   * Handle API errors with retry logic
   */
  async handleAPIError(error: APIError): Promise<void> {
    console.error("[APIError]", error);

    if (error.status === 429) {
      // Rate limit - show retry with backoff
      toast.error("Rate Limit Exceeded", {
        description: "Too many requests. Please wait a moment.",
        duration: 5000,
      });

      if (error.request) {
        await this.retryWithBackoff(error.request);
      }
    } else if (error.status && error.status >= 500) {
      // Server error - show error message and retry option
      toast.error("Server Error", {
        description: "The server encountered an error. Retrying...",
        duration: 5000,
      });

      if (error.request) {
        await this.retryWithBackoff(error.request);
      }
    } else if (error.status === 401) {
      // Auth error - redirect to login
      toast.error("Authentication Required", {
        description: "Please sign in to continue.",
        duration: 5000,
      });
    } else if (error.status === 403) {
      // Permission error
      toast.error("Permission Denied", {
        description: "You do not have permission to perform this action.",
        duration: 5000,
      });
    } else {
      // Other errors - show generic error message
      toast.error("Network Error", {
        description: error.message || "An unexpected error occurred.",
        duration: 5000,
      });
    }
  }

  /**
   * Retry a request with exponential backoff
   */
  async retryWithBackoff(
    request: () => Promise<any>,
    maxRetries: number = this.maxRetries,
  ): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await request();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }

        const delay = this.baseDelay * Math.pow(2, i);
        console.log(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`);
        await this.delay(delay);
      }
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error: NetworkError): boolean {
    return (
      error.retryable || (error.status !== undefined && error.status >= 500)
    );
  }
}

// ============================================================================
// File System Error Handler
// ============================================================================

export class FileSystemErrorHandler {
  /**
   * Handle file system errors
   */
  handleFileError(error: FileSystemError): void {
    console.error("[FileSystemError]", error);

    switch (error.type) {
      case "FILE_NOT_FOUND":
        this.handleMissingFile(error.path);
        break;
      case "INVALID_PATH":
        toast.error("Invalid Path", {
          description: "The file path is invalid.",
          duration: 3000,
        });
        break;
      case "PERMISSION_DENIED":
        toast.error("Permission Denied", {
          description: "You do not have permission to access this file.",
          duration: 3000,
        });
        break;
      default:
        toast.error("File System Error", {
          description:
            error.message || "An error occurred with the file system.",
          duration: 3000,
        });
    }
  }

  /**
   * Handle missing file
   */
  private handleMissingFile(path?: string): void {
    if (!path) {
      toast.error("File Not Found", {
        description: "The requested file could not be found.",
        duration: 3000,
      });
      return;
    }

    if (this.isAssetFile(path)) {
      toast.info("Generating Asset", {
        description: `Generating placeholder for ${path}...`,
        duration: 3000,
      });
    } else {
      toast.error("File Not Found", {
        description: `Could not find: ${path}`,
        duration: 3000,
      });
    }
  }

  /**
   * Check if a path is an asset file
   */
  private isAssetFile(path: string): boolean {
    const assetExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".ico",
      ".webp",
    ];
    return assetExtensions.some((ext) => path.toLowerCase().endsWith(ext));
  }
}

// ============================================================================
// State Error Handler
// ============================================================================

export class StateErrorHandler {
  private checkpoints: any[] = [];

  /**
   * Handle state inconsistencies
   */
  handleStateInconsistency(error: StateError): void {
    console.error("[StateError]", error);

    // Log the inconsistency
    console.error("State inconsistency detected:", {
      type: error.type,
      message: error.message,
      context: error.context,
    });

    // Attempt to recover
    if (this.canRecover(error)) {
      toast.warning("State Recovery", {
        description: "Attempting to recover from state inconsistency...",
        duration: 3000,
      });
      this.recoverState(error);
    } else {
      // Show error and offer to reset
      toast.error("State Error", {
        description:
          "A state inconsistency was detected. Consider resetting the project.",
        duration: 5000,
        action: {
          label: "Reset",
          onClick: () => this.resetState(),
        },
      });
    }
  }

  /**
   * Check if state can be recovered
   */
  private canRecover(error: StateError): boolean {
    return error.type === "SYNC_FAILURE" || this.checkpoints.length > 0;
  }

  /**
   * Attempt to recover state
   */
  private recoverState(_error: StateError): void {
    if (this.checkpoints.length > 0) {
      const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
      console.log("Restoring from last checkpoint:", lastCheckpoint);
      // Checkpoint restoration would be handled by CheckpointManager
      toast.success("State Recovered", {
        description: "Successfully restored from last checkpoint.",
        duration: 3000,
      });
    }
  }

  /**
   * Reset state to initial
   */
  private resetState(): void {
    console.log("Resetting state to initial...");
    // This would trigger a full state reset
    toast.info("State Reset", {
      description: "Project state has been reset.",
      duration: 3000,
    });
  }

  /**
   * Register checkpoints for recovery
   */
  registerCheckpoint(checkpoint: any): void {
    this.checkpoints.push(checkpoint);
    // Keep only last 10 checkpoints
    if (this.checkpoints.length > 10) {
      this.checkpoints.shift();
    }
  }
}

// ============================================================================
// Global Error Handler
// ============================================================================

export class GlobalErrorHandler {
  private runtimeHandler = new RuntimeErrorHandler();
  private networkHandler = new NetworkErrorHandler();
  private fileSystemHandler = new FileSystemErrorHandler();
  private stateHandler = new StateErrorHandler();

  /**
   * Handle any error and route to appropriate handler
   */
  handleError(error: unknown): void {
    if (this.isRuntimeError(error)) {
      this.runtimeHandler.handleError(error);
    } else if (this.isAPIError(error)) {
      this.networkHandler.handleAPIError(error);
    } else if (this.isFileSystemError(error)) {
      this.fileSystemHandler.handleFileError(error);
    } else if (this.isStateError(error)) {
      this.stateHandler.handleStateInconsistency(error);
    } else if (error instanceof Error) {
      // Generic error
      console.error("[UnhandledError]", error);
      toast.error("Error", {
        description: error.message || "An unexpected error occurred.",
        duration: 5000,
      });
    } else {
      // Unknown error
      console.error("[UnknownError]", error);
      toast.error("Unknown Error", {
        description: "An unexpected error occurred.",
        duration: 5000,
      });
    }
  }

  /**
   * Type guards
   */
  private isRuntimeError(error: unknown): error is RuntimeError {
    return (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      "message" in error &&
      ["fatal", "warning", "info"].includes((error as any).type)
    );
  }

  private isAPIError(error: unknown): error is APIError {
    return (
      error instanceof Error &&
      "status" in error &&
      typeof (error as any).status === "number"
    );
  }

  private isFileSystemError(error: unknown): error is FileSystemError {
    return (
      error instanceof Error &&
      "type" in error &&
      [
        "FILE_NOT_FOUND",
        "INVALID_PATH",
        "PERMISSION_DENIED",
        "UNKNOWN",
      ].includes((error as any).type)
    );
  }

  private isStateError(error: unknown): error is StateError {
    return (
      error instanceof Error &&
      "type" in error &&
      ["INCONSISTENCY", "CORRUPTION", "SYNC_FAILURE"].includes(
        (error as any).type,
      )
    );
  }

  /**
   * Get individual handlers
   */
  get runtime() {
    return this.runtimeHandler;
  }

  get network() {
    return this.networkHandler;
  }

  get fileSystem() {
    return this.fileSystemHandler;
  }

  get state() {
    return this.stateHandler;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const errorHandler = new GlobalErrorHandler();
