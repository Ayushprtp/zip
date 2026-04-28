"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ui/card";
import { Button } from "ui/button";
import { Badge } from "ui/badge";
import { Input } from "ui/input";
import { Label } from "ui/label";
import {
  Github,
  TriangleIcon as VercelIcon,
  Check,
  X,
  RefreshCw,
  Trash2,
  ExternalLink,
  Link2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

interface ConnectionsData {
  github: {
    connected: boolean;
    username: string | null;
    installationId: number | null;
  };
  vercel: {
    connected: boolean;
    tokenHint: string | null;
  };
}

export function UserConnectionsCard() {
  const [connections, setConnections] = useState<ConnectionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [vercelTokenInput, setVercelTokenInput] = useState("");
  const [showVercelInput, setShowVercelInput] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/user/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections);
      }
    } catch {
      console.warn("Failed to load connections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleConnectGitHub = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_APP_CLIENT_ID;
    if (!clientId) {
      toast.error("GitHub App is not configured");
      return;
    }
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,user:email`;
    const popup = window.open(authUrl, "github-auth", "width=600,height=700");

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "github-auth-success") {
        window.removeEventListener("message", handler);
        popup?.close();
        toast.success("GitHub connected successfully!");
        fetchConnections();
      }
    };
    window.addEventListener("message", handler);
  };

  const handleDisconnect = async (service: "github" | "vercel") => {
    setSaving(service);
    try {
      const res = await fetch(`/api/user/connections?service=${service}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(
          `${service === "github" ? "GitHub" : "Vercel"} disconnected`,
        );
        fetchConnections();
        if (service === "vercel") {
          setShowVercelInput(false);
          setVercelTokenInput("");
        }
      } else {
        toast.error("Failed to disconnect");
      }
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveVercelToken = async () => {
    if (!vercelTokenInput.trim()) {
      toast.error("Please enter a Vercel token");
      return;
    }
    setSaving("vercel");
    try {
      const res = await fetch("/api/vercel/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: vercelTokenInput.trim() }),
      });
      if (res.ok) {
        toast.success("Vercel token saved!");
        setVercelTokenInput("");
        setShowVercelInput(false);
        fetchConnections();
      } else {
        toast.error("Failed to save Vercel token");
      }
    } catch {
      toast.error("Failed to save Vercel token");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Connections
            </CardTitle>
            <CardDescription>
              Manage your connected services. Tokens are stored securely and
              persist across sessions.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchConnections}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* GitHub Connection */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 dark:bg-gray-100">
              <Github className="h-5 w-5 text-white dark:text-gray-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">GitHub</span>
                {connections?.github.connected ? (
                  <Badge
                    variant="default"
                    className="bg-green-500/15 text-green-600 border-green-500/30 text-xs"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-xs text-muted-foreground"
                  >
                    Not connected
                  </Badge>
                )}
              </div>
              {connections?.github.username && (
                <p className="text-sm text-muted-foreground">
                  @{connections.github.username}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connections?.github.connected ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://github.com/${connections.github.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Profile
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDisconnect("github")}
                  disabled={saving === "github"}
                  className="text-destructive hover:text-destructive"
                >
                  {saving === "github" ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5 mr-1" />
                  )}
                  Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleConnectGitHub}>
                <Github className="h-3.5 w-3.5 mr-1" />
                Connect GitHub
              </Button>
            )}
          </div>
        </div>

        {/* Vercel Connection */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black dark:bg-white">
                <VercelIcon className="h-5 w-5 text-white dark:text-black" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Vercel</span>
                  {connections?.vercel.connected ? (
                    <Badge
                      variant="default"
                      className="bg-green-500/15 text-green-600 border-green-500/30 text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-xs text-muted-foreground"
                    >
                      Not connected
                    </Badge>
                  )}
                </div>
                {connections?.vercel.tokenHint && (
                  <p className="text-sm text-muted-foreground font-mono">
                    Token: {connections.vercel.tokenHint}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connections?.vercel.connected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVercelInput(!showVercelInput)}
                  >
                    Update Token
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect("vercel")}
                    disabled={saving === "vercel"}
                    className="text-destructive hover:text-destructive"
                  >
                    {saving === "vercel" ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    Remove
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setShowVercelInput(!showVercelInput)}
                >
                  <VercelIcon className="h-3.5 w-3.5 mr-1" />
                  Connect Vercel
                </Button>
              )}
            </div>
          </div>

          {/* Vercel Token Input */}
          {showVercelInput && (
            <div className="px-4 pb-4 space-y-3 border-t pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="vercel-token" className="text-sm">
                  Vercel Personal Access Token
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="vercel-token"
                    type="password"
                    placeholder="Enter your Vercel token..."
                    value={vercelTokenInput}
                    onChange={(e) => setVercelTokenInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSaveVercelToken()
                    }
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveVercelToken}
                    disabled={saving === "vercel" || !vercelTokenInput.trim()}
                  >
                    {saving === "vercel" ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowVercelInput(false);
                      setVercelTokenInput("");
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your token from{" "}
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  vercel.com/account/tokens
                </a>
                . Your token is encrypted and stored securely.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
