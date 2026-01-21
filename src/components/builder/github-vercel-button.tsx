/**
 * GitHub & Vercel Quick Action Button
 * Simple button to open integration panel
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GitHubVercelIntegration } from "./github-vercel-integration";
import { Github, Triangle, Zap } from "lucide-react";

export function GitHubVercelButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Zap className="mr-2 h-4 w-4" />
          Pro Features
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            <Triangle className="h-5 w-5" />
            GitHub & Vercel Integration
          </DialogTitle>
          <DialogDescription>
            Connect your GitHub and Vercel accounts for version control and
            automated deployments
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <GitHubVercelIntegration />
        </div>
      </DialogContent>
    </Dialog>
  );
}
