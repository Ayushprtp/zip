/**
 * Cloud Integration Hub — Main "Project Integrations" Panel
 *
 * This is the top-level component that brings together:
 *   1. Secrets & Config Manager (per-provider secret forms)
 *   2. GitHub Sync (push with .env generation)
 *   3. Vercel Deployment Pipeline ("Ship It")
 *   4. Backend Template Injection (One-Click Firebase/Supabase setup)
 *
 * Designed as a tabbed settings panel accessible from the IDE sidebar.
 */

"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Key,
  Rocket,
  FileCode,
  Cloud,
  Flame,
  Database,
  Github,
  Triangle,
  Shield,
} from "lucide-react";
import { useSecretsManager } from "@/lib/builder/cloud-integration/use-secrets-manager";
import { SecretsForm } from "./secrets-form";
import { BackendSetupPanel } from "./backend-setup-panel";
import { DeployPipelinePanel } from "./deploy-pipeline-panel";
import { EnvOutputPanel } from "./env-output-panel";

// ─── Component ───────────────────────────────────────────────────────────────

export function CloudIntegrationHub() {
  const secretsManager = useSecretsManager();

  const firebaseConfigured = secretsManager.isProviderConfigured("firebase");
  const supabaseConfigured = secretsManager.isProviderConfigured("supabase");
  const vercelConfigured = secretsManager.isProviderConfigured("vercel");
  const githubConfigured = secretsManager.isProviderConfigured("github");

  const totalConfigured = [
    firebaseConfigured,
    supabaseConfigured,
    vercelConfigured,
    githubConfigured,
  ].filter(Boolean).length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20">
              <Cloud className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Project Integrations
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Connect, configure, and deploy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            >
              <Shield className="mr-0.5 h-2.5 w-2.5" />
              {totalConfigured}/4 Connected
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="secrets" className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border/50 px-1">
          <TabsList className="w-full h-9 bg-transparent gap-0">
            <TabsTrigger
              value="secrets"
              className="flex-1 text-[11px] data-[state=active]:bg-muted/50 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Key className="mr-1 h-3 w-3" />
              Secrets
            </TabsTrigger>
            <TabsTrigger
              value="backend"
              className="flex-1 text-[11px] data-[state=active]:bg-muted/50 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <FileCode className="mr-1 h-3 w-3" />
              Backend
            </TabsTrigger>
            <TabsTrigger
              value="deploy"
              className="flex-1 text-[11px] data-[state=active]:bg-muted/50 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Rocket className="mr-1 h-3 w-3" />
              Deploy
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Secrets Tab ─────────────────────────────────────────────── */}
        <TabsContent value="secrets" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-5">
              {/* Provider Status Overview */}
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: "firebase",
                      label: "Firebase",
                      icon: <Flame className="h-3 w-3" />,
                      configured: firebaseConfigured,
                      color: "from-amber-500/20 to-orange-500/20",
                    },
                    {
                      id: "supabase",
                      label: "Supabase",
                      icon: <Database className="h-3 w-3" />,
                      configured: supabaseConfigured,
                      color: "from-emerald-500/20 to-green-500/20",
                    },
                    {
                      id: "github",
                      label: "GitHub",
                      icon: <Github className="h-3 w-3" />,
                      configured: githubConfigured,
                      color: "from-gray-500/20 to-gray-600/20",
                    },
                    {
                      id: "vercel",
                      label: "Vercel",
                      icon: <Triangle className="h-3 w-3" />,
                      configured: vercelConfigured,
                      color: "from-white/10 to-gray-500/10",
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                      item.configured
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-border/30 bg-muted/20"
                    }`}
                  >
                    <div
                      className={`p-1 rounded bg-gradient-to-br ${item.color}`}
                    >
                      {item.icon}
                    </div>
                    <span className="text-[10px] font-medium flex-1">
                      {item.label}
                    </span>
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.configured
                          ? "bg-emerald-400"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                  </div>
                ))}
              </div>

              <Separator className="bg-border/30" />

              {/* Firebase Secrets */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1 rounded bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <h3 className="text-xs font-semibold">Firebase</h3>
                </div>
                <SecretsForm
                  provider="firebase"
                  secretsManager={secretsManager}
                />
              </div>

              <Separator className="bg-border/30" />

              {/* Supabase Secrets */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1 rounded bg-gradient-to-br from-emerald-500/20 to-green-500/20">
                    <Database className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <h3 className="text-xs font-semibold">Supabase</h3>
                </div>
                <SecretsForm
                  provider="supabase"
                  secretsManager={secretsManager}
                />
              </div>

              <Separator className="bg-border/30" />

              {/* GitHub Token */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1 rounded bg-gradient-to-br from-gray-500/20 to-gray-600/20">
                    <Github className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold">GitHub</h3>
                </div>
                <SecretsForm
                  provider="github"
                  secretsManager={secretsManager}
                />
              </div>

              <Separator className="bg-border/30" />

              {/* Vercel Token */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1 rounded bg-gradient-to-br from-white/10 to-gray-500/10">
                    <Triangle className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold">Vercel</h3>
                </div>
                <SecretsForm
                  provider="vercel"
                  secretsManager={secretsManager}
                />
              </div>

              <Separator className="bg-border/30" />

              {/* Env Output */}
              <EnvOutputPanel secretsManager={secretsManager} />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Backend Tab ─────────────────────────────────────────────── */}
        <TabsContent value="backend" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <BackendSetupPanel secretsManager={secretsManager} />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Deploy Tab ──────────────────────────────────────────────── */}
        <TabsContent value="deploy" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <DeployPipelinePanel secretsManager={secretsManager} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
