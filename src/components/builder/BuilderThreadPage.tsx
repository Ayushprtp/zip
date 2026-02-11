"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useBuilderStore } from "@/stores/builder-store";
import { useBuilderUIStore } from "@/stores/builder-ui-store";
import { SandpackWrapper } from "./SandpackWrapper";
import { HttpChainWrapper } from "./HttpChainWrapper";
import { ChatInterface } from "./chat-interface";
import { VOID_MODELS } from "@/lib/ai/void-models";
import { ProjectProvider, useProject } from "@/lib/builder/project-context";
import { useProjectSync } from "@/lib/builder/use-project-sync";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { X, Copy, Check } from "lucide-react";
import { BuilderHeader } from "./BuilderHeader";
import { exportService } from "@/lib/builder/export-service";
import {
  deploymentService,
  type DeploymentStatus,
} from "@/lib/builder/deployment-service";
import { DeploymentProgress } from "./deployment-progress";
import { errorHandler } from "@/lib/builder/error-handlers";
import type { TemplateType, DeploymentConfig } from "app-types/builder";

function QRCodeModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background p-6 rounded-lg shadow-lg max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Scan to Preview on Mobile</h3>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex justify-center mb-4 bg-white p-4 rounded">
          <QRCodeSVG value={url} size={200} level="M" />
        </div>

        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Preview URL:</p>
          <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs break-all">
            <span className="flex-1">{url}</span>
          </div>
        </div>

        <Button onClick={handleCopyUrl} className="w-full" variant="outline">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy URL
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface BuilderThreadPageProps {
  threadId: string;
}

// Inner component that uses ProjectContext
function BuilderThreadPageContent({ threadId }: BuilderThreadPageProps) {
  const router = useRouter();
  const { currentThread, messages, files, loadThread, addMessage } =
    useBuilderStore();

  const { state, actions } = useProject();

  // Auto-save integration
  const { isSaving, hasPendingSaves } = useProjectSync({
    autoSaveEnabled: true,
    debounceMs: 1000,
  });

  // Use shared UI store for builder controls
  const mobilePreview = useBuilderUIStore((state) => state.mobilePreview);
  const viewMode = useBuilderUIStore((state) => state.viewMode);
  const showConsole = useBuilderUIStore((state) => state.showConsole);
  const setIsSynced = useBuilderUIStore((state) => state.setIsSynced);

  // Sync save status to UI store
  useEffect(() => {
    const syncStatus = !isSaving && !hasPendingSaves;
    setIsSynced(syncStatus);
  }, [isSaving, hasPendingSaves]); // setIsSynced is stable from zustand

  const [showQR, setShowQR] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filesReady, setFilesReady] = useState(false);
  // Header State
  const [builderMode, setBuilderMode] = useState<"default" | "httpchain">(
    "default",
  );
  const [isExporting, setIsExporting] = useState(false);
  const [deploymentStatus, setDeploymentStatus] =
    useState<DeploymentStatus | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string | undefined>();
  const [deploymentError, setDeploymentError] = useState<string | undefined>();
  const [showDeploymentProgress, setShowDeploymentProgress] = useState(false);
  const { toggleMobilePreview } = useBuilderUIStore();

  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  }>({
    provider: "openai",
    model: "gpt-4.1-mini",
  });

  // Load thread data (only once on mount)
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setFilesReady(false);
        await loadThread(threadId);
      } catch (error) {
        console.error("Failed to load thread:", error);
        toast.error("Failed to load project");
        router.push("/builder");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [threadId]); // Only reload when threadId changes

  // Memoize the builder mode change handler
  const handleBuilderModeChange = useCallback(
    (mode: "default" | "httpchain") => {
      setBuilderMode(mode);
    },
    [],
  );

  // Update builder mode when thread loads - use template value directly to avoid reference issues
  const currentTemplate = currentThread?.template;
  useEffect(() => {
    if (currentTemplate === "httpchain") {
      setBuilderMode("httpchain");
    } else {
      setBuilderMode("default");
    }
  }, [currentTemplate]);

  // Wait for files to be synced to ProjectContext before showing preview
  useEffect(() => {
    if (!isLoading && Object.keys(state.files).length > 0) {
      console.log(
        "[BuilderThreadPage] Files ready:",
        Object.keys(state.files).length,
      );
      setFilesReady(true);
    } else if (!isLoading && Object.keys(files).length === 0) {
      // No files in project - ready to show empty state
      setFilesReady(true);
    }
  }, [isLoading, state.files, files]);

  // Update preview URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPreviewUrl(window.location.href);
    }
  }, []);

  const handleExportZip = useCallback(async () => {
    if (!currentThread) return;
    setIsExporting(true);
    try {
      await exportService.exportZip(
        state.files,
        currentThread.template as TemplateType,
        {
          projectName: currentThread.title,
          includeReadme: true,
          includePackageJson: true,
        },
      );
      toast.success("Project exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      errorHandler.handleError(error);
      toast.error("Failed to export project");
    } finally {
      setIsExporting(false);
    }
  }, [currentThread, state.files]);

  const handleDeploy = useCallback(async () => {
    if (!currentThread) return;
    setShowDeploymentProgress(true);
    setDeploymentStatus(null);
    setDeploymentUrl(undefined);
    setDeploymentError(undefined);

    try {
      const config: DeploymentConfig = {
        platform: "netlify",
        projectName: currentThread.title,
        buildCommand: "npm run build", // TODO: Determine based on template
        outputDirectory: "dist", // TODO: Determine based on template
      };

      deploymentService.validateConfig(config);

      const result = await deploymentService.deploy(
        state.files,
        config,
        currentThread.template as TemplateType,
        (status) => setDeploymentStatus(status),
      );

      setDeploymentUrl(result.url);
      toast.success("Deployment successful!");
    } catch (error) {
      console.error("Deployment failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Deployment failed";
      setDeploymentError(errorMessage);
      toast.error(errorMessage);
    }
  }, [currentThread, state.files]);

  const handleShowQR = useCallback(() => {
    setShowQR(true);
  }, []);

  // Memoize messages transformation to prevent infinite re-renders
  const transformedMessages = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        mentions: (m.mentions as any[]) || [],
        timestamp: new Date(m.createdAt).getTime(),
      })),
    [messages],
  );

  const handleSendMessage = useCallback(
    async (content: string, mentions: any[]) => {
      if (!threadId) return;

      try {
        // Add user message
        await addMessage(threadId, "user", content, mentions);

        // Create AI service with Groq (client-safe version)
        const { createBuilderAIService } = await import(
          "@/lib/builder/ai-service-client"
        );
        const aiService = createBuilderAIService({
          provider: selectedModel.provider,
          modelName: selectedModel.model,
        });

        // Track streaming content
        let _streamingContent = "";

        // Generate AI response with file modifications
        await aiService.generateCode({
          prompt: content,
          context: mentions,
          existingFiles: state.files,
          onToken: (token: string) => {
            _streamingContent += token;
            // Just accumulate, don't add message yet
          },
          onComplete: async (fullResponse: string) => {
            console.log("[AI] Response complete:", fullResponse);

            // Add the complete AI response as a message
            await addMessage(threadId, "assistant", fullResponse, []);

            // Parse AI response for file operations
            const fileOperations = parseAIResponse(fullResponse);

            if (fileOperations.length > 0) {
              // Apply file operations
              for (const op of fileOperations) {
                if (op.type === "create" || op.type === "update") {
                  console.log(
                    `[AI] ${op.type === "create" ? "Creating" : "Updating"} file:`,
                    op.path,
                  );
                  actions.updateFile(op.path, op.content);
                } else if (op.type === "delete") {
                  console.log("[AI] Deleting file:", op.path);
                  actions.deleteFile(op.path);
                }
              }
              toast.success("AI changes applied successfully!");
            }
          },
          onError: (error: Error) => {
            console.error("AI generation failed:", error);
            toast.error(`AI error: ${error.message}`);
            // Add error message
            addMessage(threadId, "assistant", `Error: ${error.message}`, []);
          },
        });
      } catch (error) {
        console.error("Failed to send message:", error);
        toast.error("Failed to send message");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [threadId, selectedModel],
  );

  // Parse AI response for file operations
  const parseAIResponse = useCallback(
    (
      response: string,
    ): Array<{
      type: "create" | "update" | "delete";
      path: string;
      content: string;
    }> => {
      const operations: Array<{
        type: "create" | "update" | "delete";
        path: string;
        content: string;
      }> = [];

      // Look for code blocks with file paths
      // Format: ```filepath:/path/to/file.js
      const fileBlockRegex = /```(?:filepath:)?([^\n]+)\n([\s\S]*?)```/g;
      let match;

      while ((match = fileBlockRegex.exec(response)) !== null) {
        const path = match[1].trim();
        const content = match[2].trim();

        // Determine if it's a new file or update
        const type = state.files[path] ? "update" : "create";

        operations.push({ type, path, content });
      }

      return operations;
    },
    [state.files],
  );

  if (isLoading || !currentThread || !filesReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isLoading ? "Loading project..." : "Preparing files..."}
          </p>
          {!isLoading && !filesReady && (
            <p className="text-xs text-muted-foreground mt-2">
              Syncing {Object.keys(files).length} files
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      <BuilderHeader
        projectName={currentThread?.title || "Untitled Project"}
        onDownloadZip={handleExportZip}
        onDeploy={handleDeploy}
        onShowQR={handleShowQR}
        onToggleMobilePreview={toggleMobilePreview}
        mobilePreview={mobilePreview}
        deploying={showDeploymentProgress}
        isExporting={isExporting}
        fileCount={Object.keys(state.files).length}
        isSynced={!isSaving && !hasPendingSaves}
        builderMode={builderMode}
        onBuilderModeChange={handleBuilderModeChange}
      />
      <div className="flex flex-1 w-full overflow-hidden min-h-0">
        {/* Left Sidebar - Chat Interface */}
        <div className="w-56 md:w-64 lg:w-80 border-r flex flex-col bg-muted/20 shrink-0">
          <div className="flex items-center justify-between px-2 py-1.5 border-b bg-muted/50 shrink-0">
            <h2 className="font-semibold text-xs">AI Assistant</h2>
            <select
              value={`${selectedModel.provider}/${selectedModel.model}`}
              onChange={(e) => {
                const [provider, ...modelParts] = e.target.value.split("/");
                const model = modelParts.join("/");
                setSelectedModel({ provider, model });
                toast.success(`Switched to ${model}`);
              }}
              className="text-[10px] px-1.5 py-0.5 rounded border bg-background max-w-[150px]"
            >
              <optgroup label="Void Models">
                {Object.keys(VOID_MODELS).map((modelKey) => (
                  <option key={modelKey} value={`void/${modelKey}`}>
                    {modelKey}
                  </option>
                ))}
              </optgroup>
              <optgroup label="OpenAI">
                <option value="openai/gpt-4.1-mini">GPT-4.1 Mini</option>
                <option value="openai/gpt-5.2">GPT-5.2</option>
              </optgroup>
              <optgroup label="Anthropic">
                <option value="anthropic/claude-sonnet-4.5">
                  Claude Sonnet 4.5
                </option>
                <option value="anthropic/claude-haiku-4.5">
                  Claude Haiku 4.5
                </option>
                <option value="anthropic/claude-opus-4.5">
                  Claude Opus 4.5
                </option>
              </optgroup>
              <optgroup label="Google">
                <option value="google/gemini-2.5-flash-lite">
                  Gemini 2.5 Flash Lite
                </option>
                <option value="google/gemini-3-pro">Gemini 3 Pro</option>
              </optgroup>
              <optgroup label="Reasoning">
                <option value="reasoning/claude-3.7-sonnet">
                  Claude 3.7 Sonnet (Reasoning)
                </option>
                <option value="reasoning/grok-code-fast">
                  Grok Code Fast (Reasoning)
                </option>
              </optgroup>
              <optgroup label="xAI">
                <option value="xai/grok-4.1-fast">Grok 4.1 Fast</option>
              </optgroup>
              <optgroup label="GLM">
                <option value="glm/glm-4.5">GLM 4.5</option>
                <option value="glm/glm-4.5-air">GLM 4.5 Air</option>
                <option value="glm/glm-4.5v">GLM 4.5v</option>
                <option value="glm/glm-4.6">GLM 4.6</option>
                <option value="glm/glm-4.6v">GLM 4.6v</option>
                <option value="glm/glm-4.7">GLM 4.7</option>
                <option value="glm/glm-4-32b">GLM 4 32B</option>
                <option value="glm/glm-4.1v-9b-thinking">
                  GLM 4.1 9B Thinking
                </option>
                <option value="glm/chatglm">ChatGLM</option>
              </optgroup>
              <optgroup label="Custom">
                <option value="custom/z1-32b">Z1 32B</option>
                <option value="custom/z1-rumination">Z1 Rumination</option>
                <option value="custom/0808-360b-dr">0808 360B DR</option>
              </optgroup>
            </select>
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <ChatInterface
              messages={transformedMessages}
              onSendMessage={handleSendMessage}
              condensed
            />
          </div>
        </div>

        {/* Main Area - Sandpack Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          <main className="flex-1 overflow-hidden min-h-0 w-full relative">
            {filesReady ? (
              <div
                className={
                  mobilePreview
                    ? "absolute inset-0 flex items-center justify-center overflow-hidden"
                    : "absolute inset-0 overflow-hidden"
                }
              >
                {builderMode === "httpchain" ? (
                  <div className="w-full h-full relative">
                    <HttpChainWrapper />
                  </div>
                ) : (
                  <>
                    {mobilePreview && (
                      <div className="w-[375px] h-full border-x overflow-hidden">
                        <SandpackWrapper
                          files={state.files}
                          template={currentThread.template}
                          viewMode={viewMode}
                          showConsole={showConsole}
                        />
                      </div>
                    )}
                    {!mobilePreview && (
                      <SandpackWrapper
                        files={state.files}
                        template={currentThread.template}
                        viewMode={viewMode}
                        showConsole={showConsole}
                      />
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    Loading preview...
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {showQR && (
        <QRCodeModal url={previewUrl} onClose={() => setShowQR(false)} />
      )}

      {showDeploymentProgress && (
        <DeploymentProgress
          open={true}
          status={deploymentStatus}
          onClose={() => setShowDeploymentProgress(false)}
          deploymentUrl={deploymentUrl}
          error={deploymentError}
        />
      )}
    </div>
  );
}

// Main component with ProjectProvider wrapper
export function BuilderThreadPage({ threadId }: BuilderThreadPageProps) {
  // Don't initialize with store files - let the sync handle it after load
  return (
    <ProjectProvider>
      <BuilderThreadPageContent threadId={threadId} />
    </ProjectProvider>
  );
}
