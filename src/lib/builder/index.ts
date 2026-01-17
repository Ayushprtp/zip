/**
 * AI Builder IDE - Core modules
 * Exports virtual file system and project context for the builder
 */

export { VirtualFileSystem } from "./virtual-file-system";
export {
  ProjectProvider,
  useProject,
  useProjectFiles,
  useActiveFile,
  useServerStatus,
  useHistoryStack,
  useConsoleOutput,
  useLibraryPreference,
  useTemplate,
  useProjectActions,
} from "./project-context";

// Error Handlers
export {
  errorHandler,
  RuntimeErrorHandler,
  NetworkErrorHandler,
  FileSystemErrorHandler,
  StateErrorHandler,
  GlobalErrorHandler,
} from "./error-handlers";

export type {
  APIError,
  FileSystemError,
  StateError,
  NetworkError,
} from "./error-handlers";

// Services
export { exportService } from "./export-service";
export { deploymentService } from "./deployment-service";
export { assetGenerator } from "./asset-generator";
export { errorDetector } from "./error-detector";
export { autoFixService } from "./auto-fix-service";
