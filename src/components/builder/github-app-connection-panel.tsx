/**
 * GitHub App Connection Panel
 * Supports both Personal Access Tokens and GitHub App OAuth
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Github, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const GITHUB_APP_NAME = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "flare-sh";
const GITHUB_APP_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_APP_CLIENT_ID;

export function GitHubAppConnectionPanel() {
  const [authMethod, setAuthMethod] = useState<"app" | "token">("app");
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [installations, setInstallations] = useState<any[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<string>("");
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const res = await fetch("/api/github/user");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setIsConnected(true);
        await loadInstallations();
      }
    } catch (err) {
      console.error("Connection check failed:", err);
    }
  };

  const loadInstallations = async () => {
    try {
      const res = await fetch("/api/github/app/installations");
      if (res.ok) {
        const data = await res.json();
        setInstallations(data.installations);
      }
    } catch (err) {
      console.error("Failed to load installations:", err);
    }
  };

  const loadRepos = async (installationId: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/github/repos?installation_id=${installationId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos);
      }
    } catch (_err) {
      toast.error("Failed to load repositories");
    } finally {
      setLoading(false);
    }
  };

  const connectWithGitHubApp = () => {
    if (!GITHUB_APP_CLIENT_ID) {
      toast.error("GitHub App not configured");
      return;
    }

    const redirectUri = `${window.location.origin}/api/github/app/callback`;
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_CLIENT_ID}&redirect_uri=${redirectUri}`;

    window.location.href = authUrl;
  };

  const installGitHubApp = () => {
    const installUrl = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`;
    window.open(installUrl, "_blank");
  };

  const connectWithToken = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch("/api/github/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        await checkConnection();
        setToken("");
        toast.success("Connected to GitHub!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Connection failed");
      }
    } catch (_err) {
      toast.error("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      await fetch("/api/github/auth", { method: "DELETE" });
      setIsConnected(false);
      setUser(null);
      setInstallations([]);
      setRepos([]);
      toast.success("Disconnected from GitHub");
    } catch (_err) {
      toast.error("Disconnect failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          GitHub Integration
        </CardTitle>
        <CardDescription>
          Connect your GitHub account to sync your projects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <Tabs
            value={authMethod}
            onValueChange={(v) => setAuthMethod(v as any)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="app">GitHub App (Recommended)</TabsTrigger>
              <TabsTrigger value="token">Personal Token</TabsTrigger>
            </TabsList>

            <TabsContent value="app" className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Use our GitHub App for secure, fine-grained access to your
                  repositories.
                </p>
                <div className="flex gap-2">
                  <Button onClick={connectWithGitHubApp} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Github className="mr-2 h-4 w-4" />
                        Connect with GitHub App
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={installGitHubApp}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Install App
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="token" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="github-token">Personal Access Token</Label>
                <Input
                  id="github-token"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Create a token at{" "}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    github.com/settings/tokens
                  </a>{" "}
                  with <code>repo</code> scope
                </p>
              </div>
              <Button onClick={connectWithToken} disabled={loading || !token}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect with Token"
                )}
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">{user?.name || user?.login}</p>
                  <p className="text-sm text-muted-foreground">
                    @{user?.login}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                disabled={loading}
              >
                Disconnect
              </Button>
            </div>

            {installations.length > 0 && (
              <div className="space-y-2">
                <Label>Select Installation</Label>
                <Select
                  value={selectedInstallation}
                  onValueChange={(value) => {
                    setSelectedInstallation(value);
                    loadRepos(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an installation" />
                  </SelectTrigger>
                  <SelectContent>
                    {installations.map((installation) => (
                      <SelectItem
                        key={installation.id}
                        value={installation.id.toString()}
                      >
                        {installation.account.login} (
                        {installation.account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {repos.length > 0 && (
              <div className="space-y-2">
                <Label>Repositories</Label>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {repos.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-muted"
                    >
                      <span className="text-sm">{repo.name}</span>
                      <Button variant="ghost" size="sm">
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
