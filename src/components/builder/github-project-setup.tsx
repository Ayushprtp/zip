/**
 * GitHub Project Setup Flow — Redesigned
 *
 * This component appears when a user first navigates to the /builder page.
 * It guides them through:
 *   1. Linking their GitHub account via GitHub App OAuth (with popup + manual token option)
 *   2. Creating a new project (name, framework, visibility) — repo is created by the Flare-SH App
 *   3. OR opening an existing repo (list repos, create branch, connect)
 *   4. OR starting a Temporary Workspace (private repo under Flare-SH org, auto-deletes in 16h)
 *
 * After setup, the project is linked to a GitHub repo and the Builder AI
 * can directly write, commit, and push code.
 */

"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Github,
  Plus,
  FolderGit2,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  GitBranch,
  Search,
  Star,
  Lock,
  Globe,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  Layout,
  BarChart3,
  ShoppingCart,
  MessageSquare,
  Palette,
  FileCode,
  LogOut,
  Settings,
  AlertTriangle,
  Timer,
  Trash2,
  Shield,
  Key,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { Template } from "@/hooks/useBuilderEngine";

// ─── Types ─────────────────────────────────────────────────────────────────

interface GitHubProjectSetupProps {
  onProjectReady: (config: ProjectConfig) => void;
  onSkip: () => void;
  userGitHubConnected?: boolean;
  userGitHubLogin?: string;
  userGitHubAvatar?: string;
}

export interface ProjectConfig {
  type: "new" | "existing" | "temporary";
  repo: {
    owner: string;
    name: string;
    fullName: string;
    isPrivate: boolean;
    defaultBranch: string;
  };
  branch: string; // Working branch
  framework?: Template;
  projectName: string;
  isTemporary?: boolean;
  expiresAt?: string;
}

type SetupStep =
  | "connect"
  | "choose"
  | "new-project"
  | "existing-project"
  | "temp-workspace";

// ─── Framework Options ─────────────────────────────────────────────────────

interface FrameworkOption {
  id: Template;
  name: string;
  description: string;
  icon: string;
  popular?: boolean;
}

const FRAMEWORKS: FrameworkOption[] = [
  {
    id: "nextjs",
    name: "Next.js",
    description: "Full-stack React with SSR & API routes",
    icon: "▲",
    popular: true,
  },
  {
    id: "react",
    name: "React",
    description: "Client-side React with Vite",
    icon: "⚛️",
    popular: true,
  },
  {
    id: "vite-react",
    name: "Vite + React",
    description: "Lightning fast dev with HMR",
    icon: "⚡",
  },
  {
    id: "vanilla",
    name: "Vanilla JS",
    description: "No framework, pure HTML/CSS/JS",
    icon: "🟨",
  },
  {
    id: "static",
    name: "Static HTML",
    description: "Simple static website",
    icon: "📄",
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function GitHubProjectSetup({
  onProjectReady,
  onSkip,
  userGitHubConnected = false,
  userGitHubLogin,
  userGitHubAvatar,
}: GitHubProjectSetupProps) {
  const [step, setStep] = useState<SetupStep>(
    userGitHubConnected ? "choose" : "connect",
  );
  const [loading, setLoading] = useState(false);
  const [ghLogin, setGhLogin] = useState(userGitHubLogin || "");
  const [_ghAvatar, setGhAvatar] = useState(userGitHubAvatar || "");
  const [isConnected, setIsConnected] = useState(userGitHubConnected);

  // New project state
  const [projectName, setProjectName] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedFramework, setSelectedFramework] = useState<Template | null>(
    null,
  );

  // Existing project state
  const [repos, setRepos] = useState<any[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [branchName, setBranchName] = useState("flare-dev");

  // Manual token state
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualToken, setManualToken] = useState("");

  // Temp workspace state
  const [tempProjectName, setTempProjectName] = useState("");
  const [tempFramework, setTempFramework] = useState<Template | null>(null);

  // OAuth popup ref
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check GitHub connection on mount
  useEffect(() => {
    if (!userGitHubConnected) {
      checkGitHubConnection();
    }
  }, [userGitHubConnected]);

  // Cleanup popup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const checkGitHubConnection = async () => {
    try {
      const res = await fetch("/api/github/user");
      if (res.ok) {
        const data = await res.json();
        setGhLogin(data.login || "");
        setGhAvatar(data.avatar_url || "");
        setIsConnected(true);
        setStep("choose");
      } else if (res.status === 401) {
        setIsConnected(false);
        setStep("connect");
      } else {
        console.warn("[GitHubSetup] Connection check failed:", res.status);
        setStep("connect");
      }
    } catch (err) {
      console.warn("[GitHubSetup] Connection check error:", err);
      setStep("connect");
    }
  };

  const handleConnectGitHub = useCallback(async () => {
    setLoading(true);
    try {
      const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "flare-sh";
      const clientId = process.env.NEXT_PUBLIC_GITHUB_APP_CLIENT_ID;

      if (clientId) {
        // Open OAuth in a popup instead of redirect
        const redirectUri = `${window.location.origin}/api/github/app/callback`;
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}`;

        // Open popup
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;

        popupRef.current = window.open(
          authUrl,
          "github-oauth",
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
        );

        // Listen for postMessage from the popup callback page
        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === "github-auth-success") {
            window.removeEventListener("message", handleMessage);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            // Popup auto-closes, but force-close if still open
            try { popupRef.current?.close(); } catch {}
            popupRef.current = null;
            toast.success("GitHub connected successfully!");
            await checkGitHubConnection();
            setLoading(false);
          }
        };
        window.addEventListener("message", handleMessage);

        // Also poll as fallback (user might close popup manually)
        pollTimerRef.current = setInterval(async () => {
          if (popupRef.current?.closed) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            window.removeEventListener("message", handleMessage);
            popupRef.current = null;
            await checkGitHubConnection();
            setLoading(false);
          }
        }, 1000);
      } else {
        // Fallback: install GitHub App
        window.open(
          `https://github.com/apps/${appName}/installations/new`,
          "_blank",
        );
        toast.info(
          "After installing the GitHub App, refresh this page to connect.",
        );
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const handleManualTokenConnect = useCallback(async () => {
    if (!manualToken.trim()) {
      toast.error("Please enter a token");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/github/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: manualToken.trim() }),
      });

      if (res.ok) {
        toast.success("Connected to GitHub!");
        setManualToken("");
        setShowManualToken(false);
        await checkGitHubConnection();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Invalid token");
      }
    } catch {
      toast.error("Failed to connect with token");
    } finally {
      setLoading(false);
    }
  }, [manualToken]);

  const handleDisconnect = useCallback(async () => {
    try {
      await fetch("/api/github/auth", { method: "DELETE" });
      setIsConnected(false);
      setGhLogin("");
      setGhAvatar("");
      setStep("connect");
      toast.success("Disconnected from GitHub");
    } catch {
      toast.error("Failed to disconnect");
    }
  }, []);

  const handleLoadRepos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/github/repos");
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos || []);
      }
    } catch {
      toast.error("Failed to load repositories");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateNewProject = useCallback(async () => {
    if (!projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }

    const sanitizedName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!sanitizedName) {
      toast.error("Invalid project name — use letters, numbers, and hyphens");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sanitizedName,
          description: `Created with Flare Builder${selectedFramework ? ` — ${selectedFramework}` : ""}`,
          private: isPrivate,
          auto_init: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 422) {
          throw new Error(
            `Repository "${sanitizedName}" already exists. Please choose a different name.`,
          );
        } else if (res.status === 401 || res.status === 403) {
          throw new Error(
            "GitHub authentication expired. Please reconnect your GitHub account.",
          );
        }
        throw new Error(err.error || "Failed to create repository");
      }

      const { repo } = await res.json();

      onProjectReady({
        type: "new",
        repo: {
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          isPrivate: repo.private,
          defaultBranch: repo.default_branch || "main",
        },
        branch: repo.default_branch || "main",
        framework: selectedFramework || undefined,
        projectName: projectName,
      });

      toast.success(`Repository "${repo.full_name}" created!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }, [projectName, isPrivate, selectedFramework, ghLogin, onProjectReady]);

  const handleSelectExistingRepo = useCallback(async (repo: any) => {
    setSelectedRepo(repo);
  }, []);

  const handleConnectExistingRepo = useCallback(async () => {
    if (!selectedRepo) return;

    setLoading(true);
    try {
      const res = await fetch("/api/github/app/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          branchName: branchName,
          baseBranch: selectedRepo.default_branch || "main",
        }),
      });

      let useBranch = branchName;

      if (res.ok) {
        toast.success(`Branch "${branchName}" created`);
      } else if (res.status === 422) {
        toast.info(`Branch "${branchName}" already exists — using it`);
      } else if (res.status === 401 || res.status === 403) {
        throw new Error(
          "GitHub authentication expired. Please reconnect your account.",
        );
      } else {
        console.warn(
          "[GitHubSetup] Branch creation failed, using default branch",
        );
        useBranch = selectedRepo.default_branch || "main";
        toast.warning(`Could not create branch — using "${useBranch}" instead`);
      }

      onProjectReady({
        type: "existing",
        repo: {
          owner: selectedRepo.owner.login,
          name: selectedRepo.name,
          fullName: selectedRepo.full_name,
          isPrivate: selectedRepo.private,
          defaultBranch: selectedRepo.default_branch || "main",
        },
        branch: useBranch,
        projectName: selectedRepo.name,
      });

      toast.success(
        `Connected to "${selectedRepo.full_name}" on branch "${useBranch}"`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to connect repository");
    } finally {
      setLoading(false);
    }
  }, [selectedRepo, branchName, onProjectReady]);

  const handleCreateTempWorkspace = useCallback(async () => {
    if (!tempProjectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/github/temp-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: tempProjectName.trim(),
          framework: tempFramework,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create temporary workspace");
      }

      const result = await res.json();

      onProjectReady({
        type: "temporary",
        repo: {
          owner: result.repoOwner,
          name: result.repoName,
          fullName: result.repoFullName,
          isPrivate: true,
          defaultBranch: result.defaultBranch,
        },
        branch: result.defaultBranch,
        framework: tempFramework || undefined,
        projectName: tempProjectName,
        isTemporary: true,
        expiresAt: result.expiresAt,
      });

      toast.success("Temporary workspace created!", {
        description: "This workspace will be automatically deleted in 16 hours.",
        duration: 6000,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to create temporary workspace");
    } finally {
      setLoading(false);
    }
  }, [tempProjectName, tempFramework, onProjectReady]);

  const filteredRepos = repos.filter((r) =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase()),
  );

  // ─── Render Steps ──────────────────────────────────────────────────────

  // ─── Builder Suggestion Cards ────────────────────────────────────────
  const BUILDER_SUGGESTIONS = useMemo(() => [
    {
      icon: Layout,
      title: "Landing Page",
      description: "Modern, responsive landing",
      gradient: "from-violet-500/20 to-purple-600/20",
      iconColor: "text-violet-400",
    },
    {
      icon: BarChart3,
      title: "Dashboard",
      description: "Data visualization & analytics",
      gradient: "from-blue-500/20 to-cyan-600/20",
      iconColor: "text-blue-400",
    },
    {
      icon: ShoppingCart,
      title: "E-commerce",
      description: "Online store with cart",
      gradient: "from-emerald-500/20 to-green-600/20",
      iconColor: "text-emerald-400",
    },
    {
      icon: MessageSquare,
      title: "Chat App",
      description: "Real-time messaging UI",
      gradient: "from-pink-500/20 to-rose-600/20",
      iconColor: "text-pink-400",
    },
    {
      icon: Palette,
      title: "Portfolio",
      description: "Showcase your work beautifully",
      gradient: "from-amber-500/20 to-yellow-600/20",
      iconColor: "text-amber-400",
    },
    {
      icon: FileCode,
      title: "API Docs",
      description: "Document & test your API",
      gradient: "from-orange-500/20 to-red-600/20",
      iconColor: "text-orange-400",
    },
  ], []);

  const suggestionSliderRef = useRef<HTMLDivElement>(null);
  const [canSlideLeft, setCanSlideLeft] = useState(false);
  const [canSlideRight, setCanSlideRight] = useState(true);

  const checkSliderScroll = useCallback(() => {
    const el = suggestionSliderRef.current;
    if (!el) return;
    setCanSlideLeft(el.scrollLeft > 4);
    setCanSlideRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = suggestionSliderRef.current;
    if (!el) return;
    checkSliderScroll();
    el.addEventListener("scroll", checkSliderScroll, { passive: true });
    window.addEventListener("resize", checkSliderScroll);
    return () => {
      el.removeEventListener("scroll", checkSliderScroll);
      window.removeEventListener("resize", checkSliderScroll);
    };
  }, [checkSliderScroll]);

  const slideScroll = useCallback((direction: "left" | "right") => {
    const el = suggestionSliderRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -240 : 240,
      behavior: "smooth",
    });
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen bg-background overflow-y-auto">
      <div className="flex-1 flex items-center justify-center p-4 w-full min-h-0">
        <div className="w-full max-w-lg">
        {/* ── Step 1: Connect GitHub ────────────────────────────────── */}
        {step === "connect" && (
          <div className="text-center space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="space-y-3">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center shadow-2xl">
                <Github className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                Connect GitHub
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Link your GitHub account so Flare can create repos, commit code,
                and deploy directly from the builder.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleConnectGitHub}
                disabled={loading}
                className="w-full h-12 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white"
                size="lg"
                id="connect-github-btn"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Github className="mr-2 h-4 w-4" />
                )}
                Connect with GitHub
              </Button>

              {/* Manual Token Option */}
              <button
                onClick={() => setShowManualToken(!showManualToken)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mx-auto"
              >
                <Key className="h-3 w-3" />
                {showManualToken ? "Hide" : "Or enter token manually"}
              </button>

              {showManualToken && (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-300 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-[10px] text-muted-foreground text-left">
                    Generate a personal access token from{" "}
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      GitHub Settings <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="ghp_xxxxx or github_pat_xxxxx"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                    <Button
                      onClick={handleManualTokenConnect}
                      disabled={loading || !manualToken.trim()}
                      size="sm"
                      className="h-9 px-3"
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* Temporary Workspace Option */}
              <button
                onClick={() => setStep("temp-workspace")}
                className="group w-full flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all text-left"
                id="temp-workspace-btn"
              >
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 group-hover:from-amber-500/30 group-hover:to-orange-500/30 transition-colors">
                  <Timer className="h-4 w-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold flex items-center gap-1.5">
                    Try Without GitHub
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[8px] px-1.5 py-0"
                    >
                      16h
                    </Badge>
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    Creates a temporary private repo — auto-deletes in 16 hours.
                    Full features included.
                  </p>
                </div>
              </button>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                {
                  icon: <GitBranch className="h-4 w-4" />,
                  label: "Auto-commit",
                },
                {
                  icon: <Zap className="h-4 w-4" />,
                  label: "One-click deploy",
                },
                {
                  icon: <Clock className="h-4 w-4" />,
                  label: "Version history",
                },
              ].map((b) => (
                <div
                  key={b.label}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/30 border border-border/30"
                >
                  <div className="text-muted-foreground">{b.icon}</div>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step: Temporary Workspace ─────────────────────────────── */}
        {step === "temp-workspace" && (
          <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("connect")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
            </div>

            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
                  <Timer className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Temporary Workspace</h2>
                  <p className="text-[10px] text-muted-foreground">
                    No GitHub account needed — get started instantly
                  </p>
                </div>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/8 border border-red-500/20 animate-in fade-in-0 duration-300">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-red-400">
                  ⚠️ Temporary — Destroyed After 16 Hours
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  This workspace and all its data (code, deployments, history,
                  checkpoints) will be <strong className="text-red-300">permanently deleted</strong> after
                  16 hours. To keep your project permanently, connect your own
                  GitHub account instead.
                </p>
              </div>
            </div>

            {/* What's Included */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: <GitBranch className="h-3.5 w-3.5" />, label: "Full source control" },
                { icon: <Zap className="h-3.5 w-3.5" />, label: "Vercel deployment" },
                { icon: <Clock className="h-3.5 w-3.5" />, label: "Version history" },
                { icon: <Shield className="h-3.5 w-3.5" />, label: "AI code assistant" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/20 text-[10px] text-muted-foreground"
                >
                  <span className="text-emerald-400">{item.icon}</span>
                  <span>{item.label}</span>
                  <CheckCircle2 className="h-3 w-3 text-emerald-400/50 ml-auto" />
                </div>
              ))}
            </div>

            {/* Project Name */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Project Name</Label>
              <Input
                placeholder="my-quick-project"
                value={tempProjectName}
                onChange={(e) => setTempProjectName(e.target.value)}
                className="h-10"
                id="temp-project-name"
              />
            </div>

            {/* Framework Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Framework{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {FRAMEWORKS.map((fw) => (
                  <button
                    key={fw.id}
                    onClick={() =>
                      setTempFramework(
                        tempFramework === fw.id ? null : fw.id,
                      )
                    }
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left transition-all ${
                      tempFramework === fw.id
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-border/40 bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <span className="text-lg">{fw.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-1">
                        {fw.name}
                        {fw.popular && (
                          <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {fw.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Create Button */}
            <Button
              onClick={handleCreateTempWorkspace}
              disabled={loading || !tempProjectName.trim()}
              className="w-full h-11 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0"
              id="create-temp-workspace-btn"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Timer className="mr-2 h-4 w-4" />
              )}
              Create Temporary Workspace
            </Button>

            {/* Timer footer */}
            <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/20">
              <Trash2 className="h-3 w-3 text-red-400" />
              <span className="text-[10px] text-muted-foreground">
                Auto-deletes in <strong className="text-foreground">16 hours</strong> — including all deployments, commits & history
              </span>
            </div>

            {/* Upgrade prompt */}
            <button
              onClick={() => setStep("connect")}
              className="w-full text-center text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              Want to keep your project? → Connect GitHub for permanent storage
            </button>
          </div>
        )}

        {/* ── Step 2: Choose Action ────────────────────────────────── */}
        {step === "choose" && (
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            {/* Connected badge */}
            {isConnected && (
              <div className="flex items-center justify-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1"
                >
                  <CheckCircle2 className="mr-1.5 h-3 w-3" />
                  Connected as @{ghLogin || "User"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  title="Disconnect GitHub"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Start Building
              </h1>
              <p className="text-sm text-muted-foreground">
                Create a new project or open an existing repository
              </p>
            </div>

            <div className="grid gap-3">
              {/* New Project */}
              <button
                onClick={() => setStep("new-project")}
                className="group flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-violet-500/30 transition-all text-left"
                id="choose-new-project-btn"
              >
                <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 group-hover:from-violet-500/30 group-hover:to-indigo-500/30 transition-colors">
                  <Plus className="h-5 w-5 text-violet-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    New Project
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create a new GitHub repo with your chosen framework
                  </p>
                </div>
              </button>

              {/* Existing Repo */}
              <button
                onClick={() => {
                  setStep("existing-project");
                  handleLoadRepos();
                }}
                className="group flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-blue-500/30 transition-all text-left"
                id="choose-existing-repo-btn"
              >
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-colors">
                  <FolderGit2 className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    Open Existing Repo
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Connect a repo and edit it in the IDE
                  </p>
                </div>
              </button>

              {/* Ask AI */}
              <button
                onClick={onSkip}
                className="group flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-amber-500/30 transition-all text-left"
              >
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 group-hover:from-amber-500/30 group-hover:to-orange-500/30 transition-colors">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    Just Start Chatting
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tell the AI what you want — it&apos;ll suggest a framework
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3a: New Project ──────────────────────────────────── */}
        {step === "new-project" && (
          <div className="space-y-5 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("choose")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold">Create New Project</h2>
              <p className="text-xs text-muted-foreground">
                A new repository will be created under @{ghLogin}. Initial commit by{" "}
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-gray-800/50 border-gray-700">
                  <Github className="h-2.5 w-2.5 mr-1" />
                  Flare-SH App
                </Badge>
              </p>
            </div>

            {/* Project Name */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Project Name</Label>
              <Input
                placeholder="my-awesome-app"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="h-10"
                id="new-project-name"
              />
              <p className="text-[10px] text-muted-foreground">
                {ghLogin}/
                {projectName
                  ? projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                  : "..."}
              </p>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Visibility</Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPrivate(true)}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-lg border text-xs transition-all ${
                    isPrivate
                      ? "border-violet-500/40 bg-violet-500/10 text-foreground"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span className="font-medium">Private</span>
                </button>
                <button
                  onClick={() => setIsPrivate(false)}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-lg border text-xs transition-all ${
                    !isPrivate
                      ? "border-violet-500/40 bg-violet-500/10 text-foreground"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span className="font-medium">Public</span>
                </button>
              </div>
            </div>

            {/* Framework Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Framework{" "}
                <span className="text-muted-foreground font-normal">
                  (choose one)
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {FRAMEWORKS.map((fw) => (
                  <button
                    key={fw.id}
                    onClick={() =>
                      setSelectedFramework(
                        selectedFramework === fw.id ? null : fw.id,
                      )
                    }
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left transition-all ${
                      selectedFramework === fw.id
                        ? "border-violet-500/40 bg-violet-500/10"
                        : "border-border/40 bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <span className="text-lg">{fw.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-1">
                        {fw.name}
                        {fw.popular && (
                          <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {fw.description}
                      </p>
                    </div>
                  </button>
                ))}

                {/* Decide Later */}
                <button
                  onClick={() => setSelectedFramework(null)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left transition-all ${
                    selectedFramework === null
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-border/40 bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <span className="text-lg">🤔</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Decide Later</div>
                    <p className="text-[9px] text-muted-foreground">
                      AI will suggest after chatting
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Info: how commits work */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/20">
              <Shield className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                The initial commit and AI-generated changes are committed by the{" "}
                <strong className="text-foreground">Flare-SH GitHub App</strong>, not
                your personal account. You can also commit manually at any time.
              </p>
            </div>

            {/* Create Button */}
            <Button
              onClick={handleCreateNewProject}
              disabled={loading || !projectName.trim()}
              className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0"
              id="create-new-project-btn"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Create Project
            </Button>
          </div>
        )}

        {/* ── Step 3b: Existing Repo ────────────────────────────────── */}
        {step === "existing-project" && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("choose")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold">Open Existing Repo</h2>
              <p className="text-xs text-muted-foreground">
                A new branch will be created for your Flare IDE changes
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                className="h-9 pl-9 text-xs"
                id="repo-search-input"
              />
            </div>

            {/* Repos List */}
            <div className="border border-border/40 rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                  <div className="text-xs text-muted-foreground">
                    No repositories found matching your search.
                  </div>
                  {repos.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground max-w-[200px] mx-auto">
                        If you don't see your repositories, you might need to
                        grant access to the Flare Builder App.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() =>
                          window.open(
                            `https://github.com/apps/${
                              process.env.NEXT_PUBLIC_GITHUB_APP_NAME ||
                              "flare-sh"
                            }/installations/new`,
                            "_blank",
                          )
                        }
                      >
                        <Settings className="h-3 w-3" />
                        Configure GitHub App Access
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => handleSelectExistingRepo(repo)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs border-b border-border/20 last:border-0 transition-colors ${
                      selectedRepo?.id === repo.id
                        ? "bg-violet-500/10"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <FolderGit2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{repo.name}</div>
                      {repo.description && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {repo.private ? (
                        <Lock className="h-3 w-3 text-amber-400" />
                      ) : (
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      )}
                      {repo.language && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0"
                        >
                          {repo.language}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Branch Name */}
            {selectedRepo && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/30 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-xs font-medium">
                    {selectedRepo.full_name}
                  </span>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    New branch name
                  </Label>
                  <Input
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="flare-dev"
                  />
                  <p className="text-[9px] text-muted-foreground">
                    Based on: {selectedRepo.default_branch || "main"}
                  </p>
                </div>
              </div>
            )}

            {/* Connect Button */}
            <Button
              onClick={handleConnectExistingRepo}
              disabled={loading || !selectedRepo}
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white border-0"
              id="connect-existing-repo-btn"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Connect Repository
            </Button>
          </div>
        )}
      </div>
      </div>

      {/* ── Builder Suggestion Slider ─────────────────────────────── */}
      <div className="w-full max-w-2xl relative group shrink-0 px-4 pb-6 pt-2">
        <p className="text-xs text-muted-foreground text-center mb-3 font-medium">
          <Sparkles className="inline h-3 w-3 mr-1 text-violet-400" />
          Popular project ideas
        </p>

        {/* Left arrow */}
        {canSlideLeft && (
          <button
            onClick={() => slideScroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-full px-1.5 flex items-center
                       bg-gradient-to-r from-background via-background/80 to-transparent
                       transition-opacity duration-200"
            aria-label="Scroll left"
          >
            <div className="rounded-full p-1.5 bg-muted/80 backdrop-blur border border-border/50 hover:bg-muted transition-colors shadow-sm">
              <ChevronLeft className="size-4 text-foreground/70" />
            </div>
          </button>
        )}

        {/* Cards container */}
        <div
          ref={suggestionSliderRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-none px-1 py-1 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {BUILDER_SUGGESTIONS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                className={`
                  group/card flex-shrink-0 snap-start rounded-xl
                  bg-gradient-to-br ${card.gradient}
                  border border-border/30 hover:border-primary/30
                  backdrop-blur-sm cursor-pointer
                  transition-all duration-300 ease-out
                  hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/5
                  text-left
                `}
                style={{ width: "210px", aspectRatio: "3 / 1" }}
              >
                <div className="flex items-center gap-3 h-full px-4">
                  <div
                    className={`size-9 rounded-lg bg-background/40 flex items-center justify-center shrink-0 ${card.iconColor}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground/90 group-hover/card:text-foreground transition-colors truncate">
                      {card.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 leading-snug line-clamp-2">
                      {card.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right arrow */}
        {canSlideRight && (
          <button
            onClick={() => slideScroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-full px-1.5 flex items-center
                       bg-gradient-to-l from-background via-background/80 to-transparent
                       transition-opacity duration-200"
            aria-label="Scroll right"
          >
            <div className="rounded-full p-1.5 bg-muted/80 backdrop-blur border border-border/50 hover:bg-muted transition-colors shadow-sm">
              <ChevronRight className="size-4 text-foreground/70" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
