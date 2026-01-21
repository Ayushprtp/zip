/**
 * Loading states and indicators for the AI Builder IDE
 */

import { Loader2, Code2, FileCode, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// Generic Loading Spinner
// ============================================================================

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
}

// ============================================================================
// Full Page Loading
// ============================================================================

export function FullPageLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4 text-primary" />
        <p className="text-sm text-muted-foreground">Loading Builder IDE...</p>
      </div>
    </div>
  );
}

// ============================================================================
// Chat Loading Indicator
// ============================================================================

export function ChatLoadingIndicator() {
  return (
    <div className="flex items-start gap-3 p-4">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span className="text-sm text-muted-foreground">
            AI is thinking...
          </span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Code Generation Loading
// ============================================================================

export function CodeGenerationLoading() {
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <Code2 className="h-5 w-5 text-primary animate-pulse" />
      <div className="flex-1">
        <p className="text-sm font-medium">Generating code...</p>
        <p className="text-xs text-muted-foreground">This may take a moment</p>
      </div>
      <LoadingSpinner size="sm" />
    </div>
  );
}

// ============================================================================
// File Operation Loading
// ============================================================================

interface FileOperationLoadingProps {
  operation: "creating" | "updating" | "deleting";
  fileName?: string;
}

export function FileOperationLoading({
  operation,
  fileName,
}: FileOperationLoadingProps) {
  const operationText = {
    creating: "Creating",
    updating: "Updating",
    deleting: "Deleting",
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded">
      <FileCode className="h-4 w-4 text-primary animate-pulse" />
      <span className="text-sm text-muted-foreground">
        {operationText[operation]} {fileName || "file"}...
      </span>
      <LoadingSpinner size="sm" className="ml-auto" />
    </div>
  );
}

// ============================================================================
// Skeleton Loaders
// ============================================================================

/**
 * Skeleton loader for chat messages
 */
export function ChatMessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for file tree
 */
export function FileTreeSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for code editor
 */
export function EditorSkeleton() {
  return (
    <div className="h-full w-full bg-muted/20 p-4 space-y-2">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Skeleton
          key={i}
          className="h-4 w-full"
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton loader for preview
 */
export function PreviewSkeleton() {
  return (
    <div className="h-full w-full bg-background flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4 text-primary" />
        <p className="text-sm text-muted-foreground">Loading preview...</p>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for timeline
 */
export function TimelineSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Progress Indicators
// ============================================================================

interface ProgressIndicatorProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
}

export function ProgressIndicator({
  progress,
  label,
  showPercentage = true,
}: ProgressIndicatorProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          {showPercentage && (
            <span className="font-medium">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Indeterminate progress bar
 */
export function IndeterminateProgress({ label }: { label?: string }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary animate-pulse"
          style={{ width: "40%" }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Deployment Progress
// ============================================================================

interface DeploymentProgressStepsProps {
  currentStep: number;
  steps: string[];
}

export function DeploymentProgressSteps({
  currentStep,
  steps,
}: DeploymentProgressStepsProps) {
  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isComplete = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={index} className="flex items-center gap-3">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                isComplete
                  ? "bg-primary text-primary-foreground"
                  : isCurrent
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isComplete ? (
                <span className="text-xs">✓</span>
              ) : isCurrent ? (
                <LoadingSpinner size="sm" />
              ) : (
                <span className="text-xs">{index + 1}</span>
              )}
            </div>
            <span
              className={`text-sm ${
                isComplete || isCurrent
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Export Progress
// ============================================================================

export function ExportProgress() {
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <FileCode className="h-5 w-5 text-primary animate-pulse" />
      <div className="flex-1">
        <p className="text-sm font-medium">Preparing export...</p>
        <p className="text-xs text-muted-foreground">Bundling files</p>
      </div>
      <LoadingSpinner size="sm" />
    </div>
  );
}

// ============================================================================
// Smooth Transition Wrapper
// ============================================================================

interface TransitionWrapperProps {
  loading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function TransitionWrapper({
  loading,
  children,
  fallback,
}: TransitionWrapperProps) {
  return (
    <div className="relative">
      <div
        className={`transition-opacity duration-300 ${
          loading ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {children}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          {fallback || <LoadingSpinner size="lg" />}
        </div>
      )}
    </div>
  );
}
