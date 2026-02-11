import { useState } from "react";
import { Boxes, Variable, X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { useAppStore } from "@/components/httpchain/store";
import { AddInputDialog } from "../../dialogs/AddInputDialog";
import { getStepFaviconUrl } from "@/components/httpchain/shared/utils/favicon";
import type { Step } from "@/components/httpchain/types/schema";

function StepItem({
  step,
  faviconUrl,
  onSelect,
  onRemove,
  isSaving,
}: {
  step: Step;
  faviconUrl: string | null;
  onSelect: () => void;
  onRemove: () => void;
  isSaving: boolean;
}) {
  const [faviconError, setFaviconError] = useState(false);

  return (
    <div
      className="group grid w-full grid-cols-[auto_1fr_auto] cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm hover:border-primary/50 hover:shadow-md transition-all duration-200"
      onClick={onSelect}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
        {faviconUrl && !faviconError ? (
          <img
            src={faviconUrl}
            alt=""
            className="h-4 w-4"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <Boxes className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{step.name}</p>
        <p className="text-[11px] text-muted-foreground truncate font-mono">
          <span className="font-semibold">{step.request.request_method}</span>{" "}
          <span className="opacity-70">
            {step.request.request_url || "(no url)"}
          </span>
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={isSaving}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function NodeList() {
  const workflow = useAppStore((s) => s.workflow);
  const removeStep = useAppStore((s) => s.removeStep);
  const removeInputVariable = useAppStore((s) => s.removeInputVariable);
  const setSelectedStepNodeId = useAppStore((s) => s.setSelectedStepNodeId);
  const addStep = useAppStore((s) => s.addStep);
  const isSaving = useAppStore((s) => s.isSaving);

  const [showInputDialog, setShowInputDialog] = useState(false);
  const [isAddingStep, setIsAddingStep] = useState(false);

  const handleAddStep = async () => {
    setIsAddingStep(true);
    try {
      await addStep();
    } finally {
      setIsAddingStep(false);
    }
  };

  if (!workflow) return null;

  const hasVariables = workflow.chain_variables.length > 0;
  const hasSteps = workflow.steps.length > 0;

  return (
    <>
      <div className="space-y-6">
        {/* Variables Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Variable className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">
                Variables
              </h4>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs font-medium hover:bg-primary/10"
              onClick={() => setShowInputDialog(true)}
              disabled={isSaving}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>

          {hasVariables ? (
            <div className="space-y-2">
              {workflow.chain_variables.map((variable) => (
                <div
                  key={`input-${variable}`}
                  className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm hover:border-primary/50 transition-all duration-200"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
                    <Variable className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate font-mono">
                      {variable}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Global Input
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeInputVariable(variable)}
                    disabled={isSaving}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-lg bg-muted/30">
              <div className="p-2 rounded-full bg-primary/10 mb-2">
                <Variable className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                No variables defined
              </p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-[11px] mt-1"
                onClick={() => setShowInputDialog(true)}
              >
                Add your first variable
              </Button>
            </div>
          )}
        </div>

        {/* Steps Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Steps</h4>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs font-medium hover:bg-primary/10"
              onClick={handleAddStep}
              disabled={isSaving || isAddingStep}
            >
              {isAddingStep ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1" />
              )}
              Add
            </Button>
          </div>

          {hasSteps ? (
            <div className="space-y-2">
              {workflow.steps.map((step) => {
                const faviconUrl = getStepFaviconUrl(step.request.request_url);
                return (
                  <StepItem
                    key={`step-${step.node_id}`}
                    step={step}
                    faviconUrl={faviconUrl}
                    onSelect={() => setSelectedStepNodeId(step.node_id)}
                    onRemove={() => removeStep(step.node_id)}
                    isSaving={isSaving}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-lg bg-muted/30">
              <div className="p-2 rounded-full bg-primary/10 mb-2">
                <Boxes className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                No steps defined
              </p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-[11px] mt-1"
                onClick={handleAddStep}
              >
                Add your first step
              </Button>
            </div>
          )}
        </div>
      </div>

      <AddInputDialog
        open={showInputDialog}
        onOpenChange={setShowInputDialog}
      />
    </>
  );
}
