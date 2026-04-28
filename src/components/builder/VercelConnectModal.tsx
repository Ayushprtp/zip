"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Github,
  KeyRound,
  ArrowRight,
} from "lucide-react";

interface VercelConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
  mode?: "connect" | "install-app";
  isTemporary?: boolean;
}

export function VercelConnectModal({
  open,
  onOpenChange,
  onConnected,
  mode = "connect",
  isTemporary = false,
}: VercelConnectModalProps) {
  const [currentMode, setCurrentMode] = useState<"connect" | "install-app">(
    mode,
  );

  // OAuth state
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthVerified, setOauthVerified] = useState(false);
  const [vercelUsername, setVercelUsername] = useState("");
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Token state
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [userName, setUserName] = useState("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Sync mode prop
  useEffect(() => {
    if (open) {
      setCurrentMode(mode);
      // Check if user already has a valid vercel_token cookie
      checkExistingToken();
    }
  }, [mode, open]);

  const checkExistingToken = async () => {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const tokenCookie = cookies.find((c) => c.startsWith("vercel_token="));
    if (tokenCookie) {
      const val = tokenCookie.split("=")[1];
      if (val) {
        try {
          const resp = await fetch("https://api.vercel.com/v2/user", {
            headers: { Authorization: `Bearer ${val}` },
          });
          if (resp.ok) {
            const data = await resp.json();
            setOauthVerified(true);
            setVercelUsername(
              data.user?.username || data.user?.name || "Connected",
            );
            return;
          }
        } catch {}
      }
    }
    // Check for vercel_username cookie from OAuth
    const usernameCookie = cookies.find((c) =>
      c.startsWith("vercel_username="),
    );
    if (usernameCookie) {
      setOauthVerified(true);
      setVercelUsername(decodeURIComponent(usernameCookie.split("=")[1] || ""));
    }
  };

  // ── OAuth Flow (identity verification only) ─────────────────────────

  const handleOAuthConnect = useCallback(async () => {
    setOauthLoading(true);
    try {
      const resp = await fetch("/api/auth/vercel/login?popup=true");
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (err.error?.includes("VERCEL_CLIENT_ID")) {
          toast.info("OAuth not configured — enter a token directly");
          setOauthLoading(false);
          return;
        }
        throw new Error(err.error || "Failed to start Vercel OAuth");
      }

      const { authUrl } = await resp.json();
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      popupRef.current = window.open(
        authUrl,
        "vercel-oauth",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
      );

      const handleMessage = (event: MessageEvent) => {
        if (
          event.origin !== window.location.origin ||
          !event.data?.type?.startsWith("vercel-auth-")
        )
          return;

        window.removeEventListener("message", handleMessage);
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        try {
          popupRef.current?.close();
        } catch {}
        popupRef.current = null;

        if (event.data.type === "vercel-auth-success") {
          setOauthVerified(true);
          setVercelUsername(event.data.username || "");
          toast.success("Vercel identity verified!", {
            description: event.data.username
              ? `Signed in as @${event.data.username}`
              : "Now enter your Personal Access Token below",
          });
        } else {
          toast.error(event.data.error || "Vercel authorization failed");
        }
        setOauthLoading(false);
      };

      window.addEventListener("message", handleMessage);

      pollTimerRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          window.removeEventListener("message", handleMessage);
          popupRef.current = null;
          setOauthLoading(false);
        }
      }, 1000);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start Vercel OAuth",
      );
      setOauthLoading(false);
    }
  }, []);

  // ── Personal Access Token Flow ──────────────────────────────────────

  const validateToken = async (tokenValue: string): Promise<boolean> => {
    setValidationStatus("validating");
    try {
      const response = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${tokenValue}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.user?.username || data.user?.name || "Connected");
        setValidationStatus("valid");
        return true;
      } else {
        setValidationStatus("invalid");
        return false;
      }
    } catch {
      setValidationStatus("invalid");
      return false;
    }
  };

  const handleTokenConnect = async () => {
    if (!token.trim()) return;
    setLoading(true);

    try {
      const isValid = await validateToken(token.trim());
      if (!isValid) {
        toast.error("Invalid Vercel token");
        setLoading(false);
        return;
      }

      // Save the PAT as vercel_token cookie (30 days)
      const d = new Date();
      d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000);
      document.cookie = `vercel_token=${token.trim()};expires=${d.toUTCString()};path=/;SameSite=Strict;Secure`;

      toast.success("Vercel connected!", {
        description: `Deploying as @${userName}`,
      });
      onConnected?.();
      onOpenChange(false);

      setToken("");
      setValidationStatus("idle");
      setUserName("");
    } catch (_e) {
      toast.error("Failed to save token");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-black flex items-center justify-center">
              <span className="text-white text-xs font-bold">▲</span>
            </div>
            {currentMode === "install-app"
              ? "Install Vercel GitHub App"
              : "Connect Vercel for Deployment"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            {currentMode === "install-app"
              ? "Vercel needs access to your GitHub repository to deploy automatically."
              : "Link your Vercel account to deploy projects under your own account."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {currentMode === "install-app" ? (
            <div className="flex flex-col gap-4">
              {/* Temp workspace notice */}
              {isTemporary && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-amber-400">
                      Temporary Workspace
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      The Vercel GitHub App needs to be installed on the hosting
                      account. Try deploying again shortly, or connect your own
                      accounts.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 1: Create Vercel account */}
              {!isTemporary && (
                <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 border border-border/50">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-primary text-xs font-bold">1</span>
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="font-medium text-sm">
                      Create a Vercel account
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sign up on Vercel using your GitHub account.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 gap-2 h-7 text-xs"
                      onClick={() =>
                        window.open("https://vercel.com/signup", "_blank")
                      }
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open Vercel
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Install GitHub App */}
              <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 border border-border/50">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">
                    {isTemporary ? "1" : "2"}
                  </span>
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-medium text-sm">
                    Install Vercel GitHub App
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Grant Vercel access to your GitHub repositories.
                  </p>
                  <Button
                    size="sm"
                    className="mt-2 gap-2 h-7 text-xs"
                    onClick={() =>
                      window.open("https://github.com/apps/vercel", "_blank")
                    }
                  >
                    <Github className="h-3 w-3" />
                    Install Vercel App
                  </Button>
                </div>
              </div>

              {/* Step 3: Connect & Deploy */}
              <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 border border-border/50">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">
                    {isTemporary ? "2" : "3"}
                  </span>
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-medium text-sm">Connect &amp; Deploy</p>
                  <p className="text-xs text-muted-foreground">
                    Link your Vercel account, then deploy.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 gap-2 h-7 text-xs"
                    onClick={() => setCurrentMode("connect")}
                  >
                    <ArrowRight className="h-3 w-3" />
                    Connect Vercel Account
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ── Step 1: Verify identity via OAuth ────────────── */}
              <div className="bg-muted/40 rounded-lg border border-border/40 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-xs font-bold">1</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Verify Vercel Account</p>
                    <p className="text-xs text-muted-foreground">
                      Sign in with Vercel to confirm your identity.
                    </p>
                  </div>
                  {oauthVerified && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  )}
                </div>

                {!oauthVerified ? (
                  <Button
                    className="w-full gap-2 bg-black hover:bg-black/90 text-white"
                    onClick={handleOAuthConnect}
                    disabled={oauthLoading}
                  >
                    {oauthLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-sm bg-white flex items-center justify-center">
                        <span className="text-black text-[10px] font-bold">
                          ▲
                        </span>
                      </div>
                    )}
                    {oauthLoading
                      ? "Waiting for authorization..."
                      : "Sign in with Vercel"}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs text-emerald-400">
                      Verified as @{vercelUsername || "user"}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Step 2: Personal Access Token ────────────────── */}
              <div
                className={`bg-muted/40 rounded-lg border border-border/40 p-4 space-y-3 transition-opacity ${
                  oauthVerified
                    ? "opacity-100"
                    : "opacity-50 pointer-events-none"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-xs font-bold">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      Enter Personal Access Token
                    </p>
                    <p className="text-xs text-muted-foreground">
                      A token with full API access for deploying projects.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() =>
                        window.open(
                          "https://vercel.com/account/tokens",
                          "_blank",
                        )
                      }
                    >
                      <ExternalLink className="h-3 w-3" />
                      Create token at vercel.com/account/tokens
                    </Button>
                  </div>

                  <div className="relative">
                    <Input
                      placeholder="Paste your token here..."
                      type="password"
                      value={token}
                      onChange={(e) => {
                        setToken(e.target.value);
                        setValidationStatus("idle");
                      }}
                      onBlur={() => {
                        if (token.trim().length > 10) {
                          validateToken(token.trim());
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleTokenConnect();
                      }}
                      className="pr-8 text-xs font-mono"
                    />
                    {validationStatus === "validating" && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                    {validationStatus === "valid" && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />
                    )}
                    {validationStatus === "invalid" && (
                      <AlertTriangle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>

                  {validationStatus === "valid" && userName && (
                    <p className="text-xs text-emerald-500">
                      ✓ Connected as @{userName}
                    </p>
                  )}

                  <Button
                    className="w-full gap-2"
                    onClick={handleTokenConnect}
                    disabled={
                      loading || !token.trim() || validationStatus === "invalid"
                    }
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    Connect &amp; Deploy
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  Your token is stored locally and never shared. It&apos;s used
                  only for deploying your projects to Vercel.
                </p>
              </div>

              {/* Skip OAuth shortcut */}
              {!oauthVerified && (
                <button
                  onClick={() => setOauthVerified(true)}
                  className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  I already have a Vercel account — skip to token entry
                </button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
