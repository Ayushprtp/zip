import { useMemo } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { Label } from "@/components/httpchain/components/ui/label";
import { Badge } from "@/components/httpchain/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/httpchain/components/ui/dropdown-menu";
import { Checkbox } from "@/components/httpchain/components/ui/checkbox";
import { getAvailableDependencyVariables } from "@/components/httpchain/shared/utils/variables";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";

export function StepDependencies() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const workflow = useAppStore((s) => s.workflow);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const availableVariables = useMemo(() => {
    if (!workflow || !selectedStepNodeId) return [];
    return getAvailableDependencyVariables(workflow, selectedStepNodeId);
  }, [workflow, selectedStepNodeId]);

  const currentDependencies = step?.depends_on_variables || [];
  const availableToAdd = availableVariables.filter(
    (v) => !currentDependencies.includes(v),
  );
  const disabled = isSaving;

  const handleToggle = (variable: string) => {
    if (!selectedStepNodeId || !step) return;

    if (currentDependencies.includes(variable)) {
      const updated = currentDependencies.filter((v) => v !== variable);
      updateStep(selectedStepNodeId, {
        depends_on_variables: updated.length > 0 ? updated : null,
      });
    } else {
      updateStep(selectedStepNodeId, {
        depends_on_variables: [...currentDependencies, variable],
      });
    }
  };

  const handleRemove = (variable: string) => {
    if (!selectedStepNodeId || !step) return;
    const updated = currentDependencies.filter((v) => v !== variable);
    updateStep(selectedStepNodeId, {
      depends_on_variables: updated.length > 0 ? updated : null,
    });
  };

  if (!step) return null;

  return (
    <div className="space-y-4">
      {currentDependencies.length > 0 && (
        <div>
          <Label className="text-sm font-normal mb-2 block">
            Current Dependencies
          </Label>
          <div className="flex flex-wrap gap-2">
            {currentDependencies.map((variable) => (
              <Badge
                key={variable}
                variant="secondary"
                className="text-xs px-2 py-1 flex items-center gap-1"
              >
                {variable}
                {!disabled && (
                  <button
                    onClick={() => handleRemove(variable)}
                    className="ml-1 hover:bg-muted rounded-sm"
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {availableToAdd.length > 0 && (
        <div>
          <Label className="text-sm font-normal mb-2 block">
            Add Variable Dependency
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-9"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Select Variable
                {availableToAdd.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {availableToAdd.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Available Variables</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-72 overflow-auto">
                {availableToAdd.map((variable) => (
                  <DropdownMenuItem
                    key={variable}
                    className="cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleToggle(variable);
                    }}
                  >
                    <Checkbox
                      checked={currentDependencies.includes(variable)}
                      className="mr-2"
                      onCheckedChange={() => handleToggle(variable)}
                    />
                    <span className="flex-1">{variable}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-xs text-muted-foreground mt-2">
            This step will only execute after the specified variables are
            available from previous steps or chain variables
          </p>
        </div>
      )}
    </div>
  );
}
