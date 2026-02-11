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
        <header className="border-b border-border bg-card/80 backdrop-blur-sm supports-[backdrop-filter]:bg-card/60 shrink-0 shadow-sm">
          <div className="flex items-center justify-between px-6 h-14">
            <button
              className="flex items-center gap-3 group transition-all hover:opacity-80"
              onClick={() => window.location.reload()}
              type="button"
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Link className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base font-bold tracking-tight">
                  HTTPChain
                </h1>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Builder
                </p>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowBackendDialog(true)}
                    className={
                      backendUrl
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground"
                    }
                  >
                    <Server className="h-[18px] w-[18px]" />
                    <span className="sr-only">Backend connection</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {backendUrl
                    ? `Connected: ${backendUrl}`
                    : "No backend configured"}
                </TooltipContent>
              </Tooltip>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
        <Toaster position="bottom-right" richColors />

        <BackendUrlDialog
          open={showBackendDialog}
          onClose={() => setShowBackendDialog(false)}
        />
      </div>
    </TooltipProvider>
  );
}
