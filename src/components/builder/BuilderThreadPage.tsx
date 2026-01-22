"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBuilderStore } from "@/stores/builder-store";
import { SandpackWrapper } from "./SandpackWrapper";
import { ChatInterface } from "./chat-interface";
import { ProjectProvider, useProject } from "@/lib/builder/project-context";
import { useProjectSync } from "@/lib/builder/use-project-sync";
import { toast } from "sonner";
import { exportService } from "@/lib/builder/export-service";
import type { TemplateType } from "@/types/builder";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { X, Copy, Check, Cloud, CloudOff } from "lucide-react";

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

// Auto-save status indicator component
function AutoSaveStatus({
  isSaving,
  hasPendingSaves,
  isConnected,
}: {
  isSaving: boolean;
  hasPendingSaves: boolean;
  isConnected: boolean;
}) {
  if (!isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CloudOff className="h-3.5 w-3.5" />
        <span>Offline</span>
      </div>
    );
  }

  if (isSaving) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-600">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <span>Saving...</span>
      </div>
    );
  }

  if (hasPendingSaves) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600">
        <Cloud className="h-3.5 w-3.5" />
        <span>Pending...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-green-600">
      <Check className="h-3.5 w-3.5" />
      <span>Saved</span>
    </div>
  );
}

// Inner component that uses ProjectContext
function BuilderThreadPageContent({ threadId }: BuilderThreadPageProps) {
  const router = useRouter();
  const {
    currentThread,
    messages,
    files,
    loadThread,
    addMessage,
    updateThreadTitle,
  } = useBuilderStore();

  const { state, actions } = useProject();

  // Auto-save integration
  const { isSaving, hasPendingSaves, saveNow, isConnected } = useProjectSync({
    autoSaveEnabled: true,
    debounceMs: 1000,
  });

  const [mobilePreview, setMobilePreview] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filesReady, setFilesReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  }>({
    provider: "groq",
    model: "llama-3.3-70b-versatile",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]); // Only reload when threadId changes

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

  // Force save before export or deploy
  const handleExportZip = async () => {
    if (!currentThread) return;

    try {
      // Save any pending changes first
      await saveNow();

      const templateType = currentThread.template as TemplateType;
      await exportService.exportZip(files, templateType, {
        projectName: currentThread.title,
        includeReadme: true,
        includePackageJson: true,
      });
      toast.success("Project exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export project");
    }
  };

  const handleNetlifyDeploy = async () => {
    setDeploying(true);
    try {
      // Save any pending changes first
      await saveNow();

      const payload = {
        files,
        template: currentThread?.template,
        timestamp: Date.now(),
      };
      console.log("Deploy payload ready:", payload);
      alert(
        "Deploy payload exported to console. Connect Netlify API to complete.",
      );
    } finally {
      setDeploying(false);
    }
  };

  const handleSendMessage = async (content: string, mentions: any[]) => {
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
  };

  // Parse AI response for file operations
  const parseAIResponse = (
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
  };

  const handleProjectNameClick = async () => {
    if (!currentThread) return;

    const newName = prompt("Enter project name:", currentThread.title);
    if (newName && newName !== currentThread.title) {
      try {
        await updateThreadTitle(threadId, newName);
        toast.success("Project renamed");
      } catch (_error) {
        toast.error("Failed to rename project");
      }
    }
  };

  const handleCreateCheckpoint = async () => {
    try {
      // Save any pending changes first
      await saveNow();

      // Create checkpoint
      const label = prompt(
        "Enter checkpoint name:",
        `Checkpoint ${new Date().toLocaleString()}`,
      );
      if (label) {
        actions.createCheckpoint(label);
        toast.success("Checkpoint created");
      }
    } catch (error) {
      console.error("Failed to create checkpoint:", error);
      toast.error("Failed to create checkpoint");
    }
  };

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
      <div className="flex flex-1 w-full overflow-hidden">
        {/* Left Sidebar - Chat Interface */}
        <div className="w-64 md:w-80 lg:w-96 border-r flex flex-col bg-muted/20 shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 shrink-0">
            <h2 className="font-semibold text-sm">AI Assistant</h2>
            <select
              value={`${selectedModel.provider}/${selectedModel.model}`}
              onChange={(e) => {
                const [provider, ...modelParts] = e.target.value.split("/");
                const model = modelParts.join("/");
                setSelectedModel({ provider, model });
                toast.success(`Switched to ${model}`);
              }}
              className="text-xs px-2 py-1 rounded border bg-background"
            >
              <optgroup label="Groq (Fast)">
                <option value="groq/llama-3.3-70b-versatile">
                  Llama 3.3 70B
                </option>
                <option value="groq/llama-4-scout">Llama 4 Scout (Code)</option>
                <option value="groq/llama-4-maverick">Llama 4 Maverick</option>
                <option value="groq/llama-3.1-8b-instant">
                  Llama 3.1 8B (Fast)
                </option>
                <option value="groq/qwen3-32b">Qwen3 32B</option>
              </optgroup>
              <optgroup label="Google Gemini">
                <option value="google/gemini-pro">Gemini Pro</option>
                <option value="google/gemini-3-pro">Gemini 3 Pro</option>
                <option value="google/gemini-advanced">Gemini Advanced</option>
                <option value="google/gemini-2.5-flash-lite">
                  Gemini 2.5 Flash
                </option>
              </optgroup>
            </select>
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <ChatInterface
              messages={messages.map((m) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                mentions: (m.mentions as any[]) || [],
                timestamp: new Date(m.createdAt).getTime(),
              }))}
              onSendMessage={handleSendMessage}
              condensed
            />
          </div>
        </div>

        {/* Main Area - Sandpack Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <main className="flex-1 overflow-hidden min-h-0 w-full h-full relative">
            {filesReady ? (
              <div
                className={
                  mobilePreview
                    ? "absolute inset-0 flex items-center justify-center"
                    : "absolute inset-0"
                }
              >
                {mobilePreview && (
                  <div className="w-[375px] h-full border-x">
                    <SandpackWrapper
                      files={state.files}
                      template={currentThread.template}
                    />
                  </div>
                )}
                {!mobilePreview && (
                  <SandpackWrapper
                    files={state.files}
                    template={currentThread.template}
                  />
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
