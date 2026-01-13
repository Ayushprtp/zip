"use client";

import { useState } from "react";
import { SandpackWrapper } from "./SandpackWrapper";
import { useBuilderEngine, type Template } from "@/hooks/useBuilderEngine";
import { ProjectProvider } from "./ProjectContext";
import { Download, MessageSquare, Code2, Smartphone, Monitor, Rocket, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function QRCodeModal({ url, onClose }: { url: string; onClose: () => void }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background p-6 rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Scan to Preview</h3>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
        <p className="text-xs text-muted-foreground mt-2 text-center max-w-[200px] truncate">{url}</p>
      </div>
    </div>
  );
}

function BuilderContent() {
  const { files, template, setTemplate, setFiles, downloadZip } = useBuilderEngine("react");
  const [mode, setMode] = useState<"chat" | "builder">("builder");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const handleTemplateChange = (newTemplate: Template) => {
    if (Object.keys(files).length > 0) {
      const confirmed = window.confirm("Switching templates will reset your files. Continue?");
      if (!confirmed) return;
    }
    setTemplate(newTemplate);
    setFiles({});
  };

  const handleNetlifyDeploy = async () => {
    setDeploying(true);
    try {
      // Export files as JSON for Netlify API upload
      const payload = { files, template, timestamp: Date.now() };
      console.log("Deploy payload ready:", payload);
      // TODO: POST to /api/deploy/netlify when backend is ready
      alert("Deploy payload exported to console. Connect Netlify API to complete.");
    } finally {
      setDeploying(false);
    }
  };

  const previewUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-lg">AI Builder</h1>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button size="sm" variant={mode === "chat" ? "secondary" : "ghost"} onClick={() => setMode("chat")}>
              <MessageSquare className="h-4 w-4 mr-1" />Chat
            </Button>
            <Button size="sm" variant={mode === "builder" ? "secondary" : "ghost"} onClick={() => setMode("builder")}>
              <Code2 className="h-4 w-4 mr-1" />Builder
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setShowQR(true)} title="QR Code">
            <QrCode className="h-4 w-4" />
          </Button>
          <Button size="icon" variant={mobilePreview ? "secondary" : "ghost"} onClick={() => setMobilePreview(!mobilePreview)}>
            {mobilePreview ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={downloadZip}>
            <Download className="h-4 w-4 mr-1" />Zip
          </Button>
          <Button size="sm" variant="default" onClick={handleNetlifyDeploy} disabled={deploying}>
            <Rocket className="h-4 w-4 mr-1" />{deploying ? "..." : "Deploy"}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        {mode === "builder" ? (
          <div className={mobilePreview ? "max-w-[375px] mx-auto h-full" : "h-full"}>
            <SandpackWrapper files={files} template={template} onTemplateChange={handleTemplateChange} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Chat interface placeholder - integrate with your AI chat component
          </div>
        )}
      </main>

      {showQR && <QRCodeModal url={previewUrl} onClose={() => setShowQR(false)} />}
    </div>
  );
}

export function BuilderPage() {
  return (
    <ProjectProvider>
      <BuilderContent />
    </ProjectProvider>
  );
}
