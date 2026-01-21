/**
 * ErrorOverlay - Displays runtime errors over the preview window
 * Shows error message, stack trace, and "Fix Error" button for auto-fixable errors
 */

"use client";

import { useEffect, useState } from "react";
import type { RuntimeError } from "@/types/builder";
import { getErrorDetector } from "@/lib/builder/error-detector";
import { Button } from "@/components/ui/button";
import { X, AlertCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface ErrorOverlayProps {
  onFixError?: (error: RuntimeError) => void;
  onDismiss?: () => void;
  className?: string;
}

// ============================================================================
// ErrorOverlay Component
// ============================================================================

export function ErrorOverlay({
  onFixError,
  onDismiss,
  className,
}: ErrorOverlayProps) {
  const [error, setError] = useState<RuntimeError | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAutoFixable, setIsAutoFixable] = useState(false);

  useEffect(() => {
    const errorDetector = getErrorDetector();

    // Listen for errors
    const unsubscribe = errorDetector.addErrorListener((detectedError) => {
      setError(detectedError);
      setIsVisible(true);
      setIsAutoFixable(errorDetector.isAutoFixable(detectedError));
    });

    // Check if there's already an error
    const lastError = errorDetector.getLastError();
    if (lastError) {
      setError(lastError);
      setIsVisible(true);
      setIsAutoFixable(errorDetector.isAutoFixable(lastError));
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setError(null);
    onDismiss?.();

    // Clear the error from detector
    const errorDetector = getErrorDetector();
    errorDetector.clearLastError();
  };

  const handleFixError = () => {
    if (error && onFixError) {
      onFixError(error);
    }
  };

  if (!isVisible || !error) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm",
        className,
      )}
    >
      <div className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg border border-red-500/50 bg-red-950/90 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-500/30 bg-red-900/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <h3 className="font-semibold text-red-100">Runtime Error</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0 text-red-300 hover:bg-red-800/50 hover:text-red-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Error Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {/* Error Message */}
          <div className="mb-4">
            <h4 className="mb-2 text-sm font-medium text-red-200">
              Error Message:
            </h4>
            <div className="rounded bg-red-950/50 p-3 font-mono text-sm text-red-100">
              {error.message}
            </div>
          </div>

          {/* File Location */}
          {error.file && (
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-medium text-red-200">
                Location:
              </h4>
              <div className="rounded bg-red-950/50 p-3 font-mono text-sm text-red-100">
                {error.file}
                {error.line && `:${error.line}`}
                {error.column && `:${error.column}`}
              </div>
            </div>
          )}

          {/* Stack Trace */}
          {error.stack && (
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-medium text-red-200">
                Stack Trace:
              </h4>
              <div className="max-h-64 overflow-y-auto rounded bg-red-950/50 p-3 font-mono text-xs text-red-100">
                <pre className="whitespace-pre-wrap">{error.stack}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div className="flex items-center justify-between border-t border-red-500/30 bg-red-900/50 px-4 py-3">
          <div className="text-xs text-red-300">
            {isAutoFixable ? (
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                This error can be automatically fixed
              </span>
            ) : (
              <span>Manual fix required</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="border-red-500/50 bg-red-950/50 text-red-100 hover:bg-red-900/50"
            >
              Dismiss
            </Button>
            {isAutoFixable && (
              <Button
                size="sm"
                onClick={handleFixError}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                <Wrench className="mr-2 h-4 w-4" />
                Fix Error
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Compact Error Badge (for minimal display)
// ============================================================================

export interface ErrorBadgeProps {
  onClick?: () => void;
  className?: string;
}

export function ErrorBadge({ onClick, className }: ErrorBadgeProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const errorDetector = getErrorDetector();

    const unsubscribe = errorDetector.addErrorListener(() => {
      setHasError(true);
    });

    // Check if there's already an error
    if (errorDetector.getLastError()) {
      setHasError(true);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  if (!hasError) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md bg-red-500/20 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/30",
        className,
      )}
    >
      <AlertCircle className="h-4 w-4" />
      <span>Error detected</span>
    </button>
  );
}
