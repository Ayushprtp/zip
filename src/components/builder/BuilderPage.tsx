"use client";

import { useState, useEffect } from "react";
import { SandpackWrapper } from "./SandpackWrapper";
import { useBuilderEngine, type Template } from "@/hooks/useBuilderEngine";
import { ProjectProvider } from "@/lib/builder/project-context";
import { ChatInterface } from "./chat-interface";
import { GitHubProjectSetup, type ProjectConfig } from "./github-project-setup";
import { TemplateSelectionDialog } from "./TemplateSelectionDialog";
import { X, Copy, Check, AlertTriangle, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { exportService } from "@/lib/builder/export-service";
import {
  deploymentService,
  type DeploymentStatus,
} from "@/lib/builder/deployment-service";
import { DeploymentProgress } from "./deployment-progress";
import type { TemplateType, DeploymentConfig } from "app-types/builder";

// Error Boundaries
import {
  ErrorBoundary,
  ChatErrorBoundary,
  PreviewErrorBoundary,
} from "./error-boundary";

// Loading States
import {
  FullPageLoading,
  TransitionWrapper,
  ExportProgress,
} from "./loading-states";

// Accessibility
import { SkipLinks, useKeyboardShortcuts } from "./accessibility";

// Error Handler
import { errorHandler } from "@/lib/builder/error-handlers";

// ─── Temp Workspace Banner ────────────────────────────────────────────────

function TempWorkspaceBanner({
  expiresAt,
  onUpgrade,
}: {
  expiresAt: string;
  onUpgrade: () => void;
}) {
  const [remaining, setRemaining] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        setIsUrgent(true);
        return;
      }
      const h = Math.floor(diff / (60 * 60 * 1000));
      const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      setRemaining(`${h}h ${m}m`);
      setIsUrgent(h < 2);
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 text-[11px] border-b shrink-0 transition-colors ${
        isUrgent
          ? "bg-red-500/10 border-red-500/20 text-red-400"
          : "bg-amber-500/8 border-amber-500/15 text-amber-400"
      }`}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">
        <strong>Temporary Workspace</strong> — auto-deletes in{" "}
        <strong>{remaining}</strong>. All code, deployments & history will be
        destroyed.
      </span>
      <button
        onClick={onUpgrade}
        className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-medium transition-colors whitespace-nowrap"
      >
        <Github className="h-3 w-3" />
        Connect GitHub to Keep
      </button>
    </div>
  );
}

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

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div
        className="bg-background p-6 rounded-lg shadow-lg max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="qr-modal-title" className="font-semibold">
            Scan to Preview on Mobile
          </h3>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close QR code modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* QR Code using local library */}
        <div
          className="flex justify-center mb-4 bg-white p-4 rounded"
          role="img"
          aria-label="QR code for mobile preview"
        >
          <QRCodeSVG value={url} size={200} level="M" includeMargin={true} />
        </div>

        {/* URL Display */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Preview URL:</p>
          <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs break-all">
            <span className="flex-1">{url}</span>
          </div>
        </div>

        {/* Copy URL Button */}
        <Button
          onClick={handleCopyUrl}
          className="w-full"
          variant="outline"
          aria-label={copied ? "URL copied" : "Copy URL to clipboard"}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
              Copy URL
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Scan this QR code with your mobile device to preview the application
        </p>
      </div>
    </div>
  );
}

function BuilderContent() {
  const { files, template, setTemplate } = useBuilderEngine("react");
  const [showQR, setShowQR] = useState(false);
  const [deploymentStatus, setDeploymentStatus] =
    useState<DeploymentStatus | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string | undefined>();
  const [deploymentError, setDeploymentError] = useState<string | undefined>();
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [showDeploymentProgress, setShowDeploymentProgress] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showGitHubSetup, setShowGitHubSetup] = useState(true);
  const [_projectConfig, setProjectConfig] = useState<ProjectConfig | null>(
    null,
  );
  const [isAskAIMode, setIsAskAIMode] = useState(false);
  const [recommendedTemplate, setRecommendedTemplate] = useState<
    Template | undefined
  >();
  const [templateSelected, setTemplateSelected] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const viewMode: "code" | "preview" | "split" = "split";
  const showConsole = false;

  // Temporary workspace state
  const [isTempWorkspace, setIsTempWorkspace] = useState(false);
  const [tempExpiresAt, setTempExpiresAt] = useState<string | null>(null);

  // Handle GitHub project setup completion
  const handleProjectReady = (config: ProjectConfig) => {
    setProjectConfig(config);
    setShowGitHubSetup(false);

    // Check if this is a temporary workspace
    if (config.type === "temporary" || config.isTemporary) {
      setIsTempWorkspace(true);
      setTempExpiresAt(config.expiresAt || null);
    }

    // If it's an existing repo, skip template selection — go directly to builder
    if (config.type === "existing") {
      const detectedTemplate = config.framework || "react";
      handleTemplateSelect(detectedTemplate, config);
    } else if (config.framework) {
      handleTemplateSelect(config.framework, config);
    } else {
      // New project, no framework — show template selection
      setShowTemplateDialog(true);
    }
  };

  const handleSkipGitHubSetup = () => {
    setShowGitHubSetup(false);
    setShowTemplateDialog(true);
  };

  const handleUpgradeFromTemp = () => {
    // Go back to GitHub setup to connect account
    setShowGitHubSetup(true);
    setIsTempWorkspace(false);
    setTempExpiresAt(null);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "s",
      ctrlKey: true,
      handler: () => {
        handleExportZip();
      },
      description: "Export project",
    },
    {
      key: "d",
      ctrlKey: true,
      shiftKey: true,
      handler: () => {
        handleDeploy();
      },
      description: "Deploy project",
    },
    {
      key: "q",
      ctrlKey: true,
      handler: () => {
        setShowQR(true);
      },
      description: "Show QR code",
    },
  ]);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Enhanced export function using ExportService
  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      // Convert Template to TemplateType
      const templateType = template as TemplateType;

      // Use ExportService for enhanced export with README and proper structure
      await exportService.exportZip(files, templateType, {
        projectName: "project",
        includeReadme: true,
        includePackageJson: true,
      });

      toast.success("Project exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      errorHandler.handleError(error);
      toast.error("Failed to export project");
    } finally {
      setIsExporting(false);
    }
  };

  const handleTemplateSelect = async (
    selectedTemplate: Template,
    configOverride?: ProjectConfig | null,
  ) => {
    // Use configOverride if provided (avoids React setState race condition)
    const projectCfg = configOverride ?? _projectConfig;
    try {
      // Use the project's actual name when available (e.g., existing repos)
      const projectTitle =
        projectCfg?.projectName || `New ${selectedTemplate} Project`;

      // Create a new thread in the database
      const response = await fetch("/api/builder/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedTemplate,
          title: projectTitle,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const { thread } = await response.json();

      // Persist GitHub repo config if available
      if (projectCfg) {
        const repoConfig = {
          owner: projectCfg.repo.owner,
          repo: projectCfg.repo.name,
          branch: projectCfg.branch,
        };
        localStorage.setItem(
          `flare_repo_config_${thread.id}`,
          JSON.stringify(repoConfig),
        );

        // Persist temp workspace metadata
        if (projectCfg.isTemporary || projectCfg.type === "temporary") {
          localStorage.setItem(
            `flare_temp_workspace_${thread.id}`,
            JSON.stringify({
              expiresAt: projectCfg.expiresAt,
              createdAt: new Date().toISOString(),
            }),
          );
        }
      }

      // Redirect to the new thread with initRepo flag if it's a new project
      const queryParams =
        projectCfg?.type === "new" || projectCfg?.type === "temporary"
          ? "?initRepo=true"
          : "";
      window.location.href = `/builder/${thread.id}${queryParams}`;
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");

      // Fallback to local state if API fails
      setTemplate(selectedTemplate);
      setTemplateSelected(true);
      setShowTemplateDialog(false);
      setIsAskAIMode(false);
    }
  };

  const handleAskAI = () => {
    setIsAskAIMode(true);
    setShowTemplateDialog(false);
    setTemplateSelected(false);
  };

  const handleDeploy = async () => {
    setShowDeploymentProgress(true);
    setDeploymentStatus(null);
    setDeploymentUrl(undefined);
    setDeploymentError(undefined);
    setDeploymentLogs([]);

    try {
      // Convert Template to TemplateType
      const templateType = template as TemplateType;

      // Create deployment configuration
      const config: DeploymentConfig = {
        platform: "vercel",
        projectName: "project",
        buildCommand: getBuildCommand(templateType),
        outputDirectory: getOutputDirectory(templateType),
      };

      // Validate configuration
      deploymentService.validateConfig(config);

      // Deploy using DeploymentService
      const result = await deploymentService.deploy(
        files,
        config,
        templateType,
        (status) => {
          setDeploymentStatus(status);
        },
        isTempWorkspace,
      );

      // Set deployment URL on success
      setDeploymentUrl(result.url);
      toast.success("Deployment successful!");
    } catch (error: any) {
      console.error("Deployment failed:", error);
      errorHandler.handleError(error);
      const errorMessage =
        error instanceof Error ? error.message : "Deployment failed";
      setDeploymentError(errorMessage);
      // Capture build logs from the error (attached by deployment-service)
      if (error.buildLogs && Array.isArray(error.buildLogs)) {
        setDeploymentLogs(error.buildLogs);
      }
      toast.error(errorMessage);
    }
  };

  // Helper function to get build command based on template
  const getBuildCommand = (template: TemplateType): string => {
    switch (template) {
      case "vite-react":
        return "npm run build";
      case "nextjs":
        return "npm run build";
      case "node":
        return "npm install";
      case "static":
        return 'echo "No build needed"';
      default:
        return "npm run build";
    }
  };

  // Helper function to get output directory based on template
  const getOutputDirectory = (template: TemplateType): string => {
    switch (template) {
      case "vite-react":
        return "dist";
      case "nextjs":
        return "out";
      case "node":
        return ".";
      case "static":
        return ".";
      default:
        return "dist";
    }
  };

  const handleSendMessage = (content: string, mentions?: any[]) => {
    const newMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content,
      mentions: mentions || [],
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);

    // AI Mode: Analyze user needs and recommend template
    if (isAskAIMode && !templateSelected) {
      setTimeout(() => {
        // Simple keyword-based recommendation (TODO: Replace with actual AI)
        let recommended: Template = "react";
        const lowerContent = content.toLowerCase();

        if (
          lowerContent.includes("ssr") ||
          lowerContent.includes("seo") ||
          lowerContent.includes("next")
        ) {
          recommended = "nextjs";
        } else if (
          lowerContent.includes("fast") ||
          lowerContent.includes("vite")
        ) {
          recommended = "vite-react";
        } else if (
          lowerContent.includes("simple") ||
          lowerContent.includes("static")
        ) {
          recommended = "static";
        } else if (
          lowerContent.includes("vanilla") ||
          lowerContent.includes("no framework")
        ) {
          recommended = "vanilla";
        }

        const aiResponse = {
          id: (Date.now() + 1).toString(),
          role: "assistant" as const,
          content: `Based on your requirements, I recommend using **${recommended.toUpperCase()}**. This framework is best suited for your needs. Click on the highlighted option in the popup to continue.`,
          mentions: [],
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiResponse]);
        setRecommendedTemplate(recommended);
        setShowTemplateDialog(true);
      }, 800);
    } else {
      // Normal chat mode
      setTimeout(() => {
        const aiResponse = {
          id: (Date.now() + 1).toString(),
          role: "assistant" as const,
          content:
            "AI response will be integrated here. This is a placeholder.",
          mentions: [],
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiResponse]);
      }, 500);
    }
  };

  // Update preview URL when component mounts or when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPreviewUrl(window.location.href);
    }
  }, []);

  // Show loading screen
  if (isLoading) {
    return <FullPageLoading />;
  }

  // Show GitHub Project Setup as the first step
  if (showGitHubSetup) {
    return (
      <ErrorBoundary>
        <GitHubProjectSetup
          onProjectReady={handleProjectReady}
          onSkip={handleSkipGitHubSetup}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SkipLinks />
      <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
        {/* Temporary workspace warning banner */}
        {isTempWorkspace && tempExpiresAt && (
          <TempWorkspaceBanner
            expiresAt={tempExpiresAt}
            onUpgrade={handleUpgradeFromTemp}
          />
        )}
        <div className="flex flex-1 w-full overflow-hidden">
          {/* Template Selection Dialog */}
          <TemplateSelectionDialog
            open={showTemplateDialog}
            onSelect={handleTemplateSelect}
            onAskAI={handleAskAI}
            recommendedTemplate={recommendedTemplate}
          />

          {/* Left Sidebar - Chat Interface */}
          <div
            id="chat-interface"
            className="w-80 lg:w-96 border-r flex flex-col bg-muted/20 shrink-0"
            role="complementary"
            aria-label="Builder AI Chat"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b bg-background/50 shrink-0">
              <h2 className="font-semibold text-sm">Builder AI</h2>
              <span className="text-xs text-muted-foreground">
                {messages.length} messages
              </span>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <ChatErrorBoundary>
                <ChatInterface
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  condensed
                />
              </ChatErrorBoundary>
            </div>
          </div>

          {/* Main Area - Sandpack Workspace (Takes all remaining space) */}
          {templateSelected && (
            <div
              id="main-content"
              className="flex-1 flex flex-col overflow-hidden min-w-0"
              role="main"
              aria-label="Code Editor and Preview"
            >
              <main className="flex-1 overflow-hidden min-h-0 w-full h-full relative">
                <div className="absolute inset-0">
                  <PreviewErrorBoundary>
                    <TransitionWrapper
                      loading={isExporting}
                      fallback={<ExportProgress />}
                    >
                      <SandpackWrapper
                        files={files}
                        template={template}
                        viewMode={viewMode}
                        showConsole={showConsole}
                      />
                    </TransitionWrapper>
                  </PreviewErrorBoundary>
                </div>
              </main>
            </div>
          )}
        </div>

        {/* Ask AI Mode - Show only chat */}
        {isAskAIMode && !templateSelected && (
          <div className="flex-1 flex items-center justify-center bg-muted/5">
            <div className="text-center max-w-md px-4">
              <h2 className="text-2xl font-semibold mb-2">
                Tell me about your project
              </h2>
              <p className="text-muted-foreground">
                Describe what you want to build, and I'll recommend the best
                framework for your needs.
              </p>
            </div>
          </div>
        )}

        {showQR && (
          <QRCodeModal url={previewUrl} onClose={() => setShowQR(false)} />
        )}

        {/* Deployment Progress Dialog */}
        <DeploymentProgress
          open={showDeploymentProgress}
          onClose={() => setShowDeploymentProgress(false)}
          status={deploymentStatus}
          deploymentUrl={deploymentUrl}
          error={deploymentError}
          buildLogs={deploymentLogs}
        />
      </div>
    </ErrorBoundary>
  );
}

export function BuilderPage() {
  return (
    <ProjectProvider>
      <BuilderContent />
    </ProjectProvider>
  );
}
