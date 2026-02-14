// Core Components
export { SandpackWrapper } from "./SandpackWrapper";
export { BuilderPage } from "./BuilderPage";
export { BuilderThreadPage } from "./BuilderThreadPage";
export { ProjectProvider, useProject } from "@/lib/builder/project-context";
export { BuilderErrorBoundary } from "./BuilderErrorBoundary";
export { TemplateSelectionDialog } from "./TemplateSelectionDialog";
export { VSCodeFileExplorer } from "./VSCodeFileExplorer";
export { BuilderHeader } from "./BuilderHeader";

export { ChatInterface } from "./chat-interface";
export { MonacoEditor } from "./monaco-editor";
export { FileTree } from "./file-tree";
export { TabBar } from "./tab-bar";
export { TimelineSidebar } from "./timeline-sidebar";
export { DiffViewer } from "./diff-viewer";

// GitHub & Vercel Integration
export { GitHubConnectionPanel } from "./github-connection-panel";
export { VercelConnectionPanel } from "./vercel-connection-panel";
export { GitHistorySidebar } from "./git-history-sidebar";
export { DeploymentDashboard } from "./deployment-dashboard";
export { GitHubVercelIntegration } from "./github-vercel-integration";
export { GitHubVercelButton } from "./github-vercel-button";
export { GitHubAppConnectionPanel } from "./github-app-connection-panel";
export { GitHubProjectSetup } from "./github-project-setup";
export type { ProjectConfig } from "./github-project-setup";
export { CheckpointHistory } from "./checkpoint-history";

// Cloud Integration Hub
export {
  CloudIntegrationHub,
  SecretsForm,
  BackendSetupPanel,
  DeployPipelinePanel,
  EnvOutputPanel,
} from "./cloud-integration";

// Error Handling
export {
  ErrorBoundary,
  ChatErrorBoundary,
  EditorErrorBoundary,
  PreviewErrorBoundary,
  TimelineErrorBoundary,
} from "./error-boundary";

// Loading States
export {
  LoadingSpinner,
  FullPageLoading,
  ChatLoadingIndicator,
  CodeGenerationLoading,
  FileOperationLoading,
  ChatMessageSkeleton,
  FileTreeSkeleton,
  EditorSkeleton,
  PreviewSkeleton,
  TimelineSkeleton,
  ProgressIndicator,
  IndeterminateProgress,
  DeploymentProgressSteps,
  ExportProgress,
  TransitionWrapper,
} from "./loading-states";

// Accessibility
export {
  SkipLinks,
  useKeyboardShortcuts,
  useFocusTrap,
  useFocusRestore,
  LiveRegion,
  AccessibleButton,
  AccessibleIconButton,
  AccessibleFormField,
  AccessibleTabs,
  AccessibleDialog,
  ScreenReaderOnly,
  AccessibleStatusBadge,
  KeyboardShortcutsHelp,
} from "./accessibility";
