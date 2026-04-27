"use client";

import { useState } from "react";
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
}

export function VercelConnectModal({
  open,
  onOpenChange,
  onConnected,
  mode = "connect",
}: VercelConnectModalProps) {
  const [currentMode, setCurrentMode] = useState<"connect" | "install-app">(
    mode,
  );

  // Manual Token State
  const [showManualInput, setShowManualInput] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [userName, setUserName] = useState("");

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
              : "Deploy to Vercel"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            {currentMode === "install-app"
              ? "Vercel needs access to your GitHub repository to deploy automatically."
              : "Your GitHub is connected. To deploy on your own Vercel account, link your GitHub to Vercel — or we'll deploy on Flare-SH's Vercel account."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {currentMode === "install-app" ? (
            <div className="flex flex-col gap-4">
              {/* Step 1: Sign up / log in to Vercel */}
              <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 border border-border/50">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">1</span>
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-medium text-sm">Create a Vercel account</p>
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

              {/* Step 2: Install GitHub App */}
              <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 border border-border/50">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">2</span>
                </div>
                <div className="space-y-1 flex-1">
                  <p className="font-medium text-sm">
                    Install Vercel GitHub App
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Install the Vercel app on GitHub and grant access to your
                    repositories.
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

              {/* Step 3: Retry */}
              <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 border border-border/50">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">3</span>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-sm">Deploy again</p>
                  <p className="text-xs text-muted-foreground">
                    Once installed, close this dialog and click Deploy.
                  </p>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-center text-muted-foreground">
                  Or skip this and enter your personal Vercel token below
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setCurrentMode("connect")}
                >
                  <KeyRound className="h-3.5 w-3.5 mr-2" />
                  Enter Vercel Access Token
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Primary CTA: go to Vercel and connect GitHub */}
              <div className="bg-muted/40 rounded-lg border border-border/40 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Github className="h-5 w-5 text-foreground mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      Connect GitHub to Vercel
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Sign in to Vercel with GitHub. Once connected, your
                      projects will auto-deploy using your own Vercel account.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full gap-2 bg-black hover:bg-black/90 text-white"
                  onClick={() =>
                    window.open(
                      "https://vercel.com/signup?utm_source=flare-sh",
                      "_blank",
                    )
                  }
                >
                  <div className="w-4 h-4 rounded-sm bg-white flex items-center justify-center">
                    <span className="text-black text-[10px] font-bold">▲</span>
                  </div>
                  Sign up / Log in to Vercel
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
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
