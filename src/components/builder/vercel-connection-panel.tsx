/**
 * Vercel Connection Panel Component
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
import { useVercelIntegration } from "@/lib/builder/use-vercel-integration";
import { Triangle, Loader2, CheckCircle2, XCircle } from "lucide-react";

export function VercelConnectionPanel() {
  const {
    isConnected,
    projects,
    loading,
    error,
    connectVercel,
    disconnectVercel,
    createProject,
    loadProjects,
  } = useVercelIntegration();

  const [token, setToken] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("");

  const handleConnect = async () => {
    if (!token) return;
    try {
      await connectVercel(token);
      setToken("");
    } catch (err) {
      console.error("Connection failed:", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Triangle className="h-5 w-5" />
          Vercel Integration
        </CardTitle>
        <CardDescription>
          Connect Vercel for automated deployments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vercel-token">Vercel Token</Label>
              <Input
                id="vercel-token"
                type="password"
                placeholder="Your Vercel token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Create a token at{" "}
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  vercel.com/account/tokens
                </a>
              </p>
            </div>
            <Button onClick={handleConnect} disabled={loading || !token}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Vercel"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p className="font-medium">Connected to Vercel</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectVercel}
                disabled={loading}
              >
                Disconnect
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Select Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadProjects}
                disabled={loading}
              >
                Refresh Projects
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
