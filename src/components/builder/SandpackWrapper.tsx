"use client";

import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { atomDark } from "@codesandbox/sandpack-themes";
import { useState } from "react";
import { Play, Square, RotateCcw, Code, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";

type Template = "react" | "nextjs" | "vite-react" | "vanilla" | "static";

interface SandpackWrapperProps {
  files: Record<string, string>;
  template: Template;
  onTemplateChange?: (template: Template) => void;
}

const DEFAULT_FILES: Record<Template, Record<string, string>> = {
  react: {
    "/App.js": `export default function App() {
  return <h1 className="text-2xl font-bold p-4">Hello React</h1>;
}`,
  },
  nextjs: {
    "/app/page.tsx": `export default function Home() {
  return <h1 className="text-2xl font-bold p-4">Hello Next.js (App Router)</h1>;
}`,
    "/app/layout.tsx": `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
  },
  "vite-react": {
    "/App.jsx": `export default function App() {
  return <h1 className="text-2xl font-bold p-4">Hello Vite + React</h1>;
}`,
  },
  vanilla: {
    "/index.js": `document.getElementById("app").innerHTML = "<h1>Hello Vanilla</h1>";`,
  },
  static: {
    "/index.html": `<!DOCTYPE html>
<html><body><h1>Hello Static</h1></body></html>`,
  },
};

function ServerControls() {
  const { sandpack } = useSandpack();
  const [status, setStatus] = useState<"idle" | "running" | "booting">("running");

  const handleRestart = () => {
    setStatus("booting");
    sandpack.runSandpack();
    setTimeout(() => setStatus("running"), 1000);
  };

  const handleStop = () => {
    sandpack.resetAllFiles();
    setStatus("idle");
  };

  const handleStart = () => {
    setStatus("booting");
    sandpack.runSandpack();
    setTimeout(() => setStatus("running"), 1000);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground capitalize">{status}</span>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" onClick={handleStart} disabled={status === "running"}>
          <Play className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleStop} disabled={status === "idle"}>
          <Square className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleRestart}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SandpackWrapper({ files, template, onTemplateChange }: SandpackWrapperProps) {
  const [showEditor, setShowEditor] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const mergedFiles = { ...DEFAULT_FILES[template], ...files };

  return (
    <SandpackProvider
      template={template === "vite-react" ? "vite-react" : template}
      theme={atomDark}
      files={mergedFiles}
      options={{
        externalResources: ["https://cdn.tailwindcss.com"],
        recompileMode: "delayed",
        recompileDelay: 500,
      }}
    >
      <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <select
              value={template}
              onChange={(e) => onTemplateChange?.(e.target.value as Template)}
              className="text-sm bg-background border rounded px-2 py-1"
            >
              <option value="react">React</option>
              <option value="nextjs">Next.js</option>
              <option value="vite-react">Vite + React</option>
              <option value="vanilla">Vanilla JS</option>
              <option value="static">Static HTML</option>
            </select>
            <ServerControls />
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant={showEditor ? "secondary" : "ghost"} onClick={() => setShowEditor(!showEditor)}>
              <Code className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={showConsole ? "secondary" : "ghost"} onClick={() => setShowConsole(!showConsole)}>
              <Terminal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <BuilderErrorBoundary onError={() => setShowConsole(true)}>
            <SandpackLayout className="flex-1 !rounded-none !border-0">
              {showEditor && <SandpackCodeEditor showTabs showLineNumbers className="min-w-[300px]" />}
              <SandpackPreview showNavigator showRefreshButton className="flex-1" />
            </SandpackLayout>
          </BuilderErrorBoundary>
          {showConsole && (
            <div className="h-40 border-t">
              <SandpackConsole className="h-full" />
            </div>
          )}
        </div>
      </div>
    </SandpackProvider>
  );
}
