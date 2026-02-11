import { useState, type PropsWithChildren } from "react";
import { Link, Server } from "lucide-react";
import { Toaster } from "../../../components/ui/sonner";
import { ThemeToggle } from "./ThemeToggle";
import { BackendUrlDialog } from "../BackendUrlDialog";
import { Button } from "../../../components/ui/button";
import { useAppStore } from "../../../store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";

export function Shell({ children }: PropsWithChildren) {
  const [showBackendDialog, setShowBackendDialog] = useState(false);
  const backendUrl = useAppStore((s) => s.backendUrl);

  return (
    <TooltipProvider>
      <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
          {children}
          {/* Floating controls for backend URL and theme (replacing the header) */}
          <div className="absolute top-2 right-2 flex items-center gap-1 p-1 bg-card/80 backdrop-blur-sm border rounded-lg shadow-sm z-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowBackendDialog(true)}
                  className={
                    backendUrl
                      ? "text-green-600 dark:text-green-400 h-8 w-8"
                      : "text-muted-foreground h-8 w-8"
                  }
                >
                  <Server className="h-4 w-4" />
                  <span className="sr-only">Backend connection</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {backendUrl
                  ? `Connected: ${backendUrl}`
                  : "No backend configured"}
              </TooltipContent>
            </Tooltip>
            {/* ThemeToggle not really needed if global theme handles it, but keeping for completeness */}
            <div className="scale-90">
              <ThemeToggle />
            </div>
          </div>
        </main>
        <Toaster position="bottom-right" richColors />

        <BackendUrlDialog
          open={showBackendDialog}
          onClose={() => setShowBackendDialog(false)}
        />
      </div>
    </TooltipProvider>
  );
}
