"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { Template } from "@/hooks/useBuilderEngine";

interface TemplateOption {
  id: Template;
  name: string;
  description: string;
  icon: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "react",
    name: "React",
    description: "Build interactive UIs with React",
    icon: "⚛️",
  },
  {
    id: "nextjs",
    name: "Next.js",
    description: "Full-stack React framework with SSR",
    icon: "▲",
  },
  {
    id: "vite-react",
    name: "Vite + React",
    description: "Lightning fast React with Vite",
    icon: "⚡",
  },
  {
    id: "vanilla",
    name: "Vanilla JS",
    description: "Pure JavaScript without frameworks",
    icon: "🟨",
  },
  {
    id: "static",
    name: "Static HTML",
    description: "Simple HTML/CSS/JS website",
    icon: "📄",
  },
];

interface TemplateSelectionDialogProps {
  open: boolean;
  onSelect: (template: Template) => void;
  onAskAI: () => void;
  recommendedTemplate?: Template;
}

export function TemplateSelectionDialog({
  open,
  onSelect,
  onAskAI,
  recommendedTemplate,
}: TemplateSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-bold">
            Choose Your Framework
          </DialogTitle>
          <DialogDescription className="text-sm">
            Select a framework to start building, or let AI help you decide
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 py-4 overflow-y-auto min-h-0">
          {/* Ask AI Option */}
          <Button
            variant="outline"
            className="w-full h-auto p-4 border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all shrink-0"
            onClick={onAskAI}
          >
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-base mb-0.5">
                  Ask AI to Recommend
                </h3>
                <p className="text-xs text-muted-foreground">
                  Describe your project and let AI suggest the best framework
                </p>
              </div>
            </div>
          </Button>

          {/* Template Grid */}
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((template) => {
              const isRecommended = recommendedTemplate === template.id;

              return (
                <Button
                  key={template.id}
                  variant="outline"
                  className={`h-auto p-4 flex flex-col items-start gap-2 transition-all ${
                    isRecommended
                      ? "border-2 border-primary bg-primary/10 ring-2 ring-primary/20 shadow-lg"
                      : "hover:border-primary/50 hover:shadow-md"
                  }`}
                  onClick={() => onSelect(template.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-2xl shrink-0">{template.icon}</span>
                    <span className="font-semibold text-sm">
                      {template.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground text-left leading-snug">
                    {template.description}
                  </p>
                  {isRecommended && (
                    <div className="w-full pt-1.5 border-t border-primary/20">
                      <span className="text-xs font-semibold text-primary flex items-center gap-1">
                        <span>✨</span> AI Recommended
                      </span>
                    </div>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
