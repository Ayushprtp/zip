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
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Manual Token State
  const [showManualInput, setShowManualInput] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [userName, setUserName] = useState("");

  // Cleanup popup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // ── OAuth Popup Flow ────────────────────────────────────────────────

  const handleOAuthConnect = useCallback(async () => {
    setOauthLoading(true);
    try {
      // Get the auth URL from our API
      const resp = await fetch("/api/auth/vercel/login?popup=true");
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (err.error?.includes("VERCEL_CLIENT_ID")) {
          toast.error("Vercel OAuth not configured on server", {
            description:
              "Use the manual token option below, or ask your admin to set VERCEL_CLIENT_ID.",
          });
          setShowManualInput(true);
          setOauthLoading(false);
          return;
        }
        throw new Error(err.error || "Failed to start Vercel OAuth");
      }

      const { authUrl } = await resp.json();

      // Open OAuth in a popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      popupRef.current = window.open(
        authUrl,
        "vercel-oauth",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`,
      );

      // Listen for postMessage from the callback page
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
          toast.success("Vercel account connected!");
          onConnected?.();
          onOpenChange(false);
        } else {
          toast.error(event.data.error || "Vercel authorization failed");
        }
        setOauthLoading(false);
      };

      window.addEventListener("message", handleMessage);

      // Poll as fallback (popup closed manually)
      pollTimerRef.current = setInterval(async () => {
        if (popupRef.current?.closed) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          window.removeEventListener("message", handleMessage);
          popupRef.current = null;

          // Check if token was set (popup might have closed after success)
          const cookies = document.cookie.split(";").map((c) => c.trim());
          const hasToken = cookies.some((c) => c.startsWith("vercel_token="));
          if (hasToken) {
            toast.success("Vercel account connected!");
            onConnected?.();
            onOpenChange(false);
          }
          setOauthLoading(false);
        }
      }, 1000);
    } catch (err) {
      console.error("Vercel OAuth error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to start Vercel OAuth",
      );
      setOauthLoading(false);
    }
  }, [onConnected, onOpenChange]);

  // ── Manual Token Flow ───────────────────────────────────────────────

  const validateToken = async (tokenValue: string): Promise<boolean> => {
    setValidationStatus("validating");
    try {
      const response = await fetch("https://api.vercel.com/v2/user", {
        headers: {
          Authorization: `Bearer ${tokenValue}`,
        },
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

  const handleManualConnect = async () => {
    if (!token.trim()) return;
    setLoading(true);

    try {
      const isValid = await validateToken(token.trim());

      if (!isValid) {
        toast.error("Invalid Vercel token");
        setLoading(false);
        return;
      }

      // Save to cookie (30 days)
      const d = new Date();
      d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000);
      document.cookie = `vercel_token=${token.trim()};expires=${d.toUTCString()};path=/;SameSite=Strict;Secure`;

      toast.success("Vercel connected!", {
        description: `Signed in as ${userName}`,
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

  // If prop mode changes, update internal mode
  if (mode !== currentMode && mode === "install-app") {
    setCurrentMode("install-app");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-black flex items-center justify-center">
              <span className="text-white text-xs font-bold">▲</span>
            </div>
            {currentMode === "install-app"
              ? "Install Vercel GitHub App"
              : "Connect Vercel Account"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            {currentMode === "install-app"
              ? "Vercel needs access to your GitHub repository to deploy automatically."
              : "Link your Vercel account so your projects deploy using your own account with full control."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {currentMode === "install-app" ? (
            <div className="flex flex-col gap-4">
              {/* Temp workspace: server-side issue notice */}
              {isTemporary && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-amber-400">
                      Temporary Workspace — Server Configuration
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      You&apos;re using a temporary workspace. The Vercel GitHub
                      App needs to be installed on the Flare-SH hosting account.
                      This is a server-side setup step — try deploying again
                      shortly, or connect your own accounts for full control.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 1: Sign up / log in to Vercel */}
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
                      Sign up or log in to Vercel with your GitHub account.
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
                    {isTemporary
                      ? "The Vercel app must be installed on the GitHub account hosting temporary repos."
                      : "Install the Vercel app on GitHub and grant access to your repositories."}
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

              {/* Step 3: Connect Vercel Account */}
              <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 border border-border/50">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">
                    {isTemporary ? "2" : "3"}
                  </span>
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-medium text-sm">
                    Connect Vercel &amp; Deploy
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Link your Vercel account, then try deploying again.
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
              {/* Primary CTA: OAuth popup */}
              <div className="bg-muted/40 rounded-lg border border-border/40 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-bold">▲</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">Connect with Vercel</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Authorize Flare to deploy on your Vercel account. Your
                      Vercel account must have the GitHub App installed to
                      access your repositories.
                    </p>
                  </div>
                </div>
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
                    : "Connect Vercel Account"}
                  {!oauthLoading && (
                    <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                  )}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or use an access token
                  </span>
                </div>
              </div>

              {/* Manual Token Option */}
              {!showManualInput ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => setShowManualInput(true)}
                >
                  <KeyRound className="h-3.5 w-3.5 mr-2" />
                  Enter Vercel Access Token manually
                </Button>
              ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      Vercel Access Token
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Get it from{" "}
                      <a
                        href="https://vercel.com/account/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        vercel.com/account/tokens
                      </a>
                    </p>
                    <div className="relative">
                      <Input
                        placeholder="vcp_..."
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
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowManualInput(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleManualConnect}
                      disabled={
                        loading ||
                        !token.trim() ||
                        validationStatus === "invalid"
                      }
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : null}
                      Connect Token
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
