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

  const handleOAuthConnect = () => {
    // Redirect to OAuth login route
    window.location.href = "/api/auth/vercel/login";
  };

  const handleManualConnect = async () => {
    if (!token.trim()) return;
    setLoading(true);

    try {
      // Validate the token first
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

      // Reset state
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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-black flex items-center justify-center">
              <span className="text-white text-xs font-bold">▲</span>
            </div>
            {currentMode === "install-app"
              ? "Install Vercel GitHub App"
              : "Connect Vercel"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            {currentMode === "install-app"
              ? "To deploy automatically, Vercel needs access to your GitHub repositories. Please install the Vercel app on your GitHub account."
              : "Connect your Vercel account to enable seamless deployments directly from the builder."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentMode === "install-app" ? (
            <div className="flex flex-col gap-4">
              <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 border border-border/50">
                <Github className="h-5 w-5 mt-0.5 text-foreground" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">Vercel for GitHub</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically deploys your PRs and commits. Required for
                    Git-based deployments.
                  </p>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={() =>
                  window.open("https://github.com/apps/vercel", "_blank")
                }
              >
                <ExternalLink className="h-4 w-4" />
                Install Vercel GitHub App
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-2">
                After installing, try deploying again.
              </p>
            </div>
          ) : (
            <>
              {/* Main OAuth Option */}
              <Button
                className="w-full gap-2 bg-black hover:bg-black/90 text-white"
                size="lg"
                onClick={handleOAuthConnect}
              >
                <div className="w-4 h-4 rounded-sm bg-white flex items-center justify-center">
                  <span className="text-black text-[10px] font-bold">▲</span>
                </div>
                Continue with Vercel
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or verify manually
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
                  Enter Access Token
                </Button>
              ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Access Token</label>
                    <div className="relative">
                      <Input
                        placeholder="Enter your Vercel Access Token"
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
