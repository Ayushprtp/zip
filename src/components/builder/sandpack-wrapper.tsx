/**
 * SandpackWrapper - Manages Sandpack runtime and provides template-specific configuration
 * Handles file synchronization, console output capture, and server control
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
  type SandpackFiles,
  type SandpackPredefinedTemplate,
} from "@codesandbox/sandpack-react";
import type {
  TemplateType,
  ServerStatus,
  ConsoleLog,
  RuntimeError,
} from "@/types/builder";
import { getDefaultFiles } from "@/lib/builder/template-configs";
import {
  createServerController,
  type ServerControl,
} from "@/lib/builder/sandpack-controller";
import { getErrorDetector } from "@/lib/builder/error-detector";
import { getAssetGenerator } from "@/lib/builder/asset-generator";
import { ErrorOverlay } from "@/components/builder/error-overlay";
import { nanoid } from "nanoid";

// ============================================================================
// Types
// ============================================================================

export interface SandpackWrapperProps {
  template: TemplateType;
  files: Record<string, string>;
  onConsoleOutput?: (log: ConsoleLog) => void;
  onError?: (error: RuntimeError) => void;
  onServerStatusChange?: (status: ServerStatus) => void;
  onFixError?: (error: RuntimeError) => void;
  onAssetGenerated?: (path: string, content: string) => void;
  showErrorOverlay?: boolean;
}

// ============================================================================
// Internal Component (needs to be inside SandpackProvider)
// ============================================================================

interface SandpackInternalProps {
  onConsoleOutput?: (log: ConsoleLog) => void;
  onError?: (error: RuntimeError) => void;
  onServerStatusChange?: (status: ServerStatus) => void;
  onServerControl: (control: ServerControl) => void;
  onFixError?: (error: RuntimeError) => void;
  onAssetGenerated?: (path: string, content: string) => void;
  showErrorOverlay?: boolean;
}

function SandpackInternal({
  onConsoleOutput,
  onError,
  onServerStatusChange,
  onServerControl,
  onFixError,
  onAssetGenerated,
  showErrorOverlay = true,
}: SandpackInternalProps) {
  const { sandpack, listen } = useSandpack();
  const listenerUnsubscribeRef = useRef<(() => void) | null>(null);
  const serverControlRef = useRef<ServerControl | null>(null);

  // Get error detector instance
  const errorDetector = getErrorDetector();

  // Get asset generator instance with callback
  const assetGenerator = getAssetGenerator({
    onAssetGenerated: (result) => {
      console.log("Asset generated:", result.path);
      onAssetGenerated?.(result.path, result.content);
    },
  });

  // Update server status and notify parent
  const updateServerStatus = useCallback(
    (status: ServerStatus) => {
      onServerStatusChange?.(status);
    },
    [onServerStatusChange],
  );

  // Create server control on mount
  useEffect(() => {
    const control = createServerController(
      {
        resetAllFiles: () => sandpack.resetAllFiles(),
      },
      {
        onStatusChange: updateServerStatus,
        onError: (error) => {
          const runtimeError: RuntimeError = {
            type: "fatal",
            message: error.message,
            stack: error.stack,
          };
          onError?.(runtimeError);
        },
      },
    );

    serverControlRef.current = control;
    onServerControl(control);

    // Auto-start server
    control.start();
  }, [sandpack, updateServerStatus, onError, onServerControl]);

  // Listen to Sandpack events
  useEffect(() => {
    // Clean up previous listener
    if (listenerUnsubscribeRef.current) {
      listenerUnsubscribeRef.current();
    }

    // Set up new listener
    const unsubscribe = listen((message: any) => {
      // Handle console messages
      if (message.type === "console") {
        const consoleLog: ConsoleLog = {
          id: nanoid(),
          level: (message.log?.[0]?.method || "log") as
            | "log"
            | "warn"
            | "error"
            | "info",
          message: message.log?.[0]?.data?.join(" ") || "",
          timestamp: Date.now(),
          args: message.log?.[0]?.data,
        };
        onConsoleOutput?.(consoleLog);
      }

      // Handle errors - Sandpack uses 'action' type with 'show-error' action
      if (message.type === "action" && message.action === "show-error") {
        const error: RuntimeError = {
          type: "fatal",
          message: message.title || "Unknown error",
          stack: message.message,
          file: message.path,
          line: message.line,
          column: message.column,
        };

        // Check if this is a missing asset error and generate placeholder
        // This is async but we don't await it to avoid blocking error handling
        assetGenerator.processError(error).catch((err) => {
          console.error("Failed to generate asset:", err);
        });

        // Process error through ErrorDetector (only if not a missing asset)
        if (!assetGenerator.isMissingAssetError(error)) {
          errorDetector.processError(error);
        }

        // Also call the onError callback
        onError?.(error);

        // Only update status to error if not a missing asset (those are handled gracefully)
        if (!assetGenerator.isMissingAssetError(error)) {
          updateServerStatus("error");
        }
      }

      // Handle status changes
      if (message.type === "status") {
        if (message.status === "idle") {
          updateServerStatus("running");
        } else if (message.status === "evaluating") {
          updateServerStatus("booting");
        }
      }
    });

    listenerUnsubscribeRef.current = unsubscribe;

    return () => {
      if (listenerUnsubscribeRef.current) {
        listenerUnsubscribeRef.current();
      }
    };
  }, [listen, onConsoleOutput, onError, updateServerStatus, errorDetector]);

  // Handle fix error callback
  const handleFixError = useCallback(
    (error: RuntimeError) => {
      // Clear the error from detector
      errorDetector.clearLastError();

      // Call the parent's fix handler
      onFixError?.(error);
    },
    [errorDetector, onFixError],
  );

  return (
    <div className="sandpack-wrapper h-full w-full relative">
      <SandpackPreview
        showOpenInCodeSandbox={false}
        showRefreshButton={true}
        showRestartButton={true}
        className="h-full w-full"
      />

      {/* Error Overlay */}
      {showErrorOverlay && (
        <ErrorOverlay
          onFixError={handleFixError}
          onDismiss={() => errorDetector.clearLastError()}
        />
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SandpackWrapper({
  template,
  files,
  onConsoleOutput,
  onError,
  onServerStatusChange,
  onFixError,
  onAssetGenerated,
  showErrorOverlay = true,
}: SandpackWrapperProps) {
  const [serverControl, setServerControl] = useState<ServerControl | null>(
    null,
  );
  const prevFilesRef = useRef<Record<string, string>>(files);
  const hmrFailureCountRef = useRef<number>(0);
  const MAX_HMR_FAILURES = 3;

  // Convert template type to Sandpack template
  const getSandpackTemplate = (
    template: TemplateType,
  ): SandpackPredefinedTemplate => {
    switch (template) {
      case "vite-react":
        return "vite-react";
      case "nextjs":
        return "nextjs";
      case "node":
        return "node";
      case "static":
        return "static";
      default:
        return "vite-react";
    }
  };

  // Merge default files with provided files
  const defaultFiles = getDefaultFiles(template);
  const mergedFiles: SandpackFiles = {
    ...defaultFiles,
    ...files,
  };

  // Detect file changes and trigger HMR
  useEffect(() => {
    const prevFiles = prevFilesRef.current;
    const currentFiles = files;

    // Check if files have changed
    const filesChanged =
      Object.keys(prevFiles).length !== Object.keys(currentFiles).length ||
      Object.keys(currentFiles).some(
        (path) => prevFiles[path] !== currentFiles[path],
      );

    if (filesChanged && serverControl) {
      // Files changed, HMR will be triggered automatically by Sandpack
      // Track which files changed for logging
      const changedFiles = Object.keys(currentFiles).filter(
        (path) => prevFiles[path] !== currentFiles[path],
      );
      const addedFiles = Object.keys(currentFiles).filter(
        (path) => !(path in prevFiles),
      );
      const deletedFiles = Object.keys(prevFiles).filter(
        (path) => !(path in currentFiles),
      );

      console.log("File changes detected:", {
        changed: changedFiles,
        added: addedFiles,
        deleted: deletedFiles,
      });

      // Update the ref
      prevFilesRef.current = currentFiles;

      // Reset HMR failure count on successful file change
      hmrFailureCountRef.current = 0;
    }
  }, [files, serverControl]);

  // Handle HMR failures
  const handleHMRFailure = useCallback(async () => {
    hmrFailureCountRef.current += 1;

    if (hmrFailureCountRef.current >= MAX_HMR_FAILURES) {
      console.warn("HMR failed multiple times, performing full reload");

      // Fallback to full reload
      if (serverControl) {
        try {
          await serverControl.restart();
          hmrFailureCountRef.current = 0; // Reset counter after successful restart
        } catch (error) {
          console.error("Failed to restart server:", error);
          onError?.({
            type: "fatal",
            message: "Failed to restart server after HMR failures",
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }
    }
  }, [serverControl, onError]);

  // Expose server control methods
  const handleServerControl = useCallback((control: ServerControl) => {
    setServerControl(control);
  }, []);

  return (
    <SandpackProvider
      template={getSandpackTemplate(template)}
      files={mergedFiles}
      theme="dark"
      options={{
        externalResources: [],
        bundlerURL: undefined,
        autorun: true,
        autoReload: true,
        recompileMode: "immediate",
        recompileDelay: 300,
      }}
    >
      <SandpackInternal
        onConsoleOutput={onConsoleOutput}
        onError={(error) => {
          onError?.(error);
          // Check if this is an HMR-related error
          if (
            error.message.includes("HMR") ||
            error.message.includes("hot update")
          ) {
            handleHMRFailure();
          }
        }}
        onServerStatusChange={onServerStatusChange}
        onServerControl={handleServerControl}
        onFixError={onFixError}
        onAssetGenerated={onAssetGenerated}
        showErrorOverlay={showErrorOverlay}
      />
    </SandpackProvider>
  );
}

// ============================================================================
// Hook to access server control from outside
// ============================================================================

export function useSandpackControl() {
  const [control, setControl] = useState<ServerControl | null>(null);

  return {
    control,
    setControl,
  };
}
