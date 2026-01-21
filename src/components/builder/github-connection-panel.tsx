/**
 * GitHub Connection Panel Component
 */

"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGitHubIntegration } from "@/lib/builder/use-github-integration";
import { Github, Loader2, CheckCircle2, XCircle } from "lucide-react";

export function GitHubConnectionPanel() {
  const {
    isConnected,
    user,
    repos,
    loading,
    error,
    connectGitHub,
    disconnectGitHub,
    createRepo,
    loadRepos,
  } = useGitHubIntegration();

  const [token, setToken] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string>("");

  const handleConnect = async () => {
    if (!token) return;
    try {
      await connectGitHub(token);
      setToken("");
    } catch (err) {
      console.error("Connection failed:", err);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName) return;
    try {
      await createRepo(newRepoName, newRepoDesc, true);
      setNewRepoName("");
      setNewRepoDesc("");
    } catch (err) {
      console.error("Repo creation failed:", err);
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
          <div className="space-y-4">
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
            <Button onClick={handleConnect} disabled={loading || !token}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect GitHub"
              )}
            </Button>
          </div>
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
                onClick={disconnectGitHub}
                disabled={loading}
              >
                Disconnect
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Select Repository</Label>
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a repository" />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((repo) => (
                    <SelectItem key={repo.id} value={repo.full_name}>
                      {repo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadRepos}
                disabled={loading}
              >
                Refresh Repos
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Create New Repository</Label>
              <Input
                placeholder="Repository name"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={newRepoDesc}
                onChange={(e) => setNewRepoDesc(e.target.value)}
              />
              <Button
                onClick={handleCreateRepo}
                disabled={loading || !newRepoName}
                size="sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Repository"
                )}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
