"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface VercelConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

export function VercelConnectModal({
  open,
  onOpenChange,
  onConnected,
}: VercelConnectModalProps) {
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

  const handleConnect = async () => {
    if (!token.trim()) return;
    setLoading(true);

    try {
      // Validate the token first
      const isValid = await validateToken(token.trim());

      if (!isValid) {
        toast.error("Invalid Vercel token", {
          description:
            "Please check your token and try again. Generate one from Vercel Account Settings → Tokens.",
        });
        setLoading(false);
        return;
      }

      // Save to cookie (30 days)
      const d = new Date();
      d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000);
      document.cookie = `vercel_token=${token.trim()};expires=${d.toUTCString()};path=/;SameSite=Strict;Secure`;

      toast.success("Vercel connected!", {
        description: `Signed in as ${userName}`,
        duration: 4000,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-black flex items-center justify-center">
              <span className="text-white text-xs font-bold">▲</span>
            </div>
            Connect Vercel
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Enter your Vercel Access Token to enable deployments. Your token is
            stored locally in a secure cookie and never sent to our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          {/* Token input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Access Token
            </label>
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

          {/* Validation feedback */}
          {validationStatus === "valid" && userName && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] text-emerald-500 font-medium">
                Verified as {userName}
              </span>
            </div>
          )}

          {validationStatus === "invalid" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[11px] text-destructive font-medium">
                Invalid token — please check and try again
              </span>
            </div>
          )}

          {/* Help link */}
          <a
            href="https://vercel.com/account/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Generate a token in Vercel Account Settings → Tokens
          </a>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              setToken("");
              setValidationStatus("idle");
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={
              loading || !token.trim() || validationStatus === "invalid"
            }
            className="gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {validationStatus === "valid" ? "Connect" : "Validate & Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
