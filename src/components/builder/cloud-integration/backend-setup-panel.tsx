/**
 * Backend Setup Panel — "One-Click Backend Setup" UI
 *
 * Lets the user click "Add Firebase" or "Add Supabase" to inject
 * initialization code + dependencies into their project.
 */

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Flame,
  Database,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Package,
} from "lucide-react";
import { useProject } from "@/lib/builder/project-context";
import type { UseSecretsManagerReturn } from "@/lib/builder/cloud-integration/use-secrets-manager";
import {
  injectFirebaseBackend,
  injectSupabaseBackend,
} from "@/lib/builder/cloud-integration/backend-templates";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BackendSetupPanelProps {
  secretsManager: UseSecretsManagerReturn;
}

interface BackendOption {
  id: "firebase" | "supabase";
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  docsUrl: string;
}

const BACKEND_OPTIONS: BackendOption[] = [
  {
    id: "firebase",
    name: "Firebase",
    description:
      "Add authentication, Firestore database, and cloud storage to your project",
    icon: <Flame className="h-5 w-5" />,
    color: "from-amber-500 to-orange-600",
    docsUrl: "https://firebase.google.com/docs",
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Add a Postgres database, auth, and real-time subscriptions",
    icon: <Database className="h-5 w-5" />,
    color: "from-emerald-500 to-green-600",
    docsUrl: "https://supabase.com/docs",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function BackendSetupPanel({ secretsManager }: BackendSetupPanelProps) {
  const { state, actions } = useProject();
  const [injecting, setInjecting] = useState<string | null>(null);
  const [injectedBackends, setInjectedBackends] = useState<Set<string>>(
    new Set(),
  );

  const handleInject = useCallback(
    async (backend: "firebase" | "supabase") => {
      setInjecting(backend);

      try {
        // Check if secrets are configured
        const isConfigured = secretsManager.isProviderConfigured(backend);

        if (!isConfigured) {
          toast.warning(
            `Please configure your ${backend === "firebase" ? "Firebase" : "Supabase"} keys first in the Secrets tab`,
          );
          setInjecting(null);
          return;
        }

        // Get the current secrets
        const secrets = secretsManager.getProviderSecrets(backend);

        // Run the injection
        const result =
          backend === "firebase"
            ? injectFirebaseBackend(state.files, secrets)
            : injectSupabaseBackend(state.files, secrets);

        // Apply the file changes to the project
        for (const [path, content] of Object.entries(result.files)) {
          if (state.files[path]) {
            actions.updateFile(path, content);
          } else {
            actions.createFile(path, content);
          }
        }

        setInjectedBackends((prev) => new Set([...prev, backend]));
        toast.success(result.summary);
      } catch (err: any) {
        toast.error(
          `Failed to add ${backend}: ${err.message || "Unknown error"}`,
        );
      } finally {
        setInjecting(null);
      }
    },
    [state.files, actions, secretsManager],
  );

  // Check what's already in the project
  const hasFirebase = Object.keys(state.files).some(
    (f) => f.includes("firebase.js") || f.includes("firebase.ts"),
  );
  const hasSupabase = Object.keys(state.files).some(
    (f) => f.includes("supabaseClient.js") || f.includes("supabaseClient.ts"),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <FileCode className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">One-Click Backend Setup</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Add a fully configured backend to your project with a single click. The
        initialization code will use your saved API keys.
      </p>

      <div className="grid gap-3">
        {BACKEND_OPTIONS.map((option) => {
          const isAlreadyAdded =
            injectedBackends.has(option.id) ||
            (option.id === "firebase" && hasFirebase) ||
            (option.id === "supabase" && hasSupabase);
          const isConfigured = secretsManager.isProviderConfigured(option.id);
          const isCurrentlyInjecting = injecting === option.id;

          return (
            <Card
              key={option.id}
              className={`overflow-hidden transition-all duration-200 border-border/50 ${
                isAlreadyAdded
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "hover:border-primary/30 hover:bg-muted/30"
              }`}
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div
                      className={`p-1.5 rounded-md bg-gradient-to-br ${option.color} text-white`}
                    >
                      {option.icon}
                    </div>
                    {option.name}
                  </CardTitle>
                  {isAlreadyAdded && (
                    <Badge
                      variant="default"
                      className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]"
                    >
                      <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                      Added
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-[11px] leading-relaxed">
                  {option.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isAlreadyAdded ? "outline" : "default"}
                    onClick={() => handleInject(option.id)}
                    disabled={isCurrentlyInjecting}
                    className="flex-1 text-xs h-8"
                  >
                    {isCurrentlyInjecting ? (
                      <>
                        <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
                        Adding...
                      </>
                    ) : isAlreadyAdded ? (
                      <>
                        <Package className="mr-1.5 h-3 w-3" />
                        Regenerate Files
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3 w-3" />
                        Add {option.name}
                      </>
                    )}
                  </Button>
                </div>

                {!isConfigured && !isAlreadyAdded && (
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-400/80">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    Configure your {option.name} keys first in the Secrets tab
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
