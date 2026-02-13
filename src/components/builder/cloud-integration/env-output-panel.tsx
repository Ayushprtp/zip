/**
 * Env Output Panel — Shows the generated environment variables JSON
 *
 * Displays the output of the Secrets Manager as a formatted
 * JSON object or .env file content that the user can copy.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileText, Copy, Check, Code2, FileCode, Download } from "lucide-react";
import type { UseSecretsManagerReturn } from "@/lib/builder/cloud-integration/use-secrets-manager";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnvOutputPanelProps {
  secretsManager: UseSecretsManagerReturn;
}

type OutputFormat = "json" | "env";

// ─── Component ───────────────────────────────────────────────────────────────

export function EnvOutputPanel({ secretsManager }: EnvOutputPanelProps) {
  const [format, setFormat] = useState<OutputFormat>("json");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [varCount, setVarCount] = useState(0);

  // Generate output whenever store changes or format changes
  useEffect(() => {
    const generate = async () => {
      if (format === "json") {
        const envVars = await secretsManager.buildEnvVarsJson();
        const filtered = Object.fromEntries(
          Object.entries(envVars).filter(([, v]) => v && v.length > 0),
        );
        setVarCount(Object.keys(filtered).length);
        setOutput(JSON.stringify(filtered, null, 2));
      } else {
        const envContent = await secretsManager.buildEnvFileContent();
        const lines = envContent
          .split("\n")
          .filter((l) => l && !l.startsWith("#") && l.includes("="));
        setVarCount(lines.length);
        setOutput(envContent);
      }
    };
    generate();
  }, [secretsManager, format, secretsManager.store.updatedAt]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleDownload = useCallback(() => {
    const filename = format === "json" ? "env-vars.json" : ".env.local";
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, format]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Environment Output</h3>
          <Badge variant="secondary" className="text-[10px]">
            {varCount} var{varCount !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setFormat("json")}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              format === "json"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="inline h-3 w-3 mr-0.5" />
            JSON
          </button>
          <button
            type="button"
            onClick={() => setFormat("env")}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              format === "env"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileCode className="inline h-3 w-3 mr-0.5" />
            .env
          </button>
        </div>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <div className="relative">
          <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-auto max-h-[200px] bg-black/20 text-emerald-400/90">
            {output || "// No environment variables configured yet"}
          </pre>
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 px-2 text-[10px] bg-black/50 hover:bg-black/70 text-muted-foreground"
              disabled={!output}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-0.5 text-green-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-0.5" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-6 px-2 text-[10px] bg-black/50 hover:bg-black/70 text-muted-foreground"
              disabled={!output}
            >
              <Download className="h-3 w-3 mr-0.5" />
              Save
            </Button>
          </div>
        </div>
      </Card>

      <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
        {format === "json"
          ? "This JSON object is automatically injected when deploying."
          : "This .env.local file is auto-generated when pushing to GitHub."}
      </p>
    </div>
  );
}
