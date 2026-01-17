"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBuilderStore } from "@/stores/builder-store";
import { SandpackWrapper } from "./SandpackWrapper";
import { ChatInterface } from "./chat-interface";
import { BuilderHeader } from "./BuilderHeader";
import { ProjectProvider } from "./ProjectContext";
import { toast } from "sonner";
import { exportService } from "@/lib/builder/export-service";
import type { TemplateType } from "@/types/builder";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { X, Copy, Check } from "lucide-react";
import { debounce } from "lodash";

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

export function BuilderThreadPage({ threadId }: BuilderThreadPageProps) {
  const router = useRouter();
  const {
    currentThread,
    messages,
    files,
    loadThread,
    addMessage,
    saveFile,
    updateThreadTitle,
  } = useBuilderStore();

  const [mobilePreview, setMobilePreview] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Load thread data
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
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
  }, [threadId, loadThread, router]);

  // Update preview URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPreviewUrl(window.location.href);
    }
  }, []);

  // Debounced file save
  const debouncedSaveFile = useCallback(
    debounce((path: string, content: string) => {
      if (threadId) {
        saveFile(threadId, path, content);
      }
    }, 1000),
    [threadId, saveFile],
  );

  const handleExportZip = async () => {
    if (!currentThread) return;

    try {
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

      // TODO: Integrate with AI service
      setTimeout(async () => {
        await addMessage(
          threadId,
          "assistant",
          "AI response will be integrated here. This is a placeholder.",
          [],
        );
      }, 500);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
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

  if (isLoading || !currentThread) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectProvider>
      <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
        {/* Builder Header */}
        <BuilderHeader
          projectName={currentThread.title}
          onDownloadZip={handleExportZip}
          onDeploy={handleNetlifyDeploy}
          onShowQR={() => setShowQR(true)}
          onToggleMobilePreview={() => setMobilePreview(!mobilePreview)}
          mobilePreview={mobilePreview}
          deploying={deploying}
          onProjectNameClick={handleProjectNameClick}
        />

        <div className="flex flex-1 w-full overflow-hidden">
          {/* Left Sidebar - Chat Interface */}
          <div className="w-64 md:w-80 lg:w-96 border-r flex flex-col bg-muted/20 shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 shrink-0">
              <h2 className="font-semibold text-sm">AI Assistant</h2>
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
                      files={files}
                      template={currentThread.template}
                      onFileChange={debouncedSaveFile}
                    />
                  </div>
                )}
                {!mobilePreview && (
                  <SandpackWrapper
                    files={files}
                    template={currentThread.template}
                    onFileChange={debouncedSaveFile}
                  />
                )}
              </div>
            </main>
          </div>
        </div>

        {showQR && (
          <QRCodeModal url={previewUrl} onClose={() => setShowQR(false)} />
        )}
      </div>
    </ProjectProvider>
  );
}
