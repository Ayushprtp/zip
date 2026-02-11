import { useMemo } from "react";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";
import { KeyValueListEditor } from "../shared/KeyValueListEditor";

export function ParamsEditor() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const params = step?.request.request_params ?? null;
  const paramsBuffer = step?.request._params_buffer ?? null;
  const availableVariables = useMemo(() => {
    return step?.depends_on_variables || [];
  }, [step?.depends_on_variables]);

  if (!step) return null;

  const handleUpdate = (
    newParams: Record<string, string> | null,
    newBuffer: Record<string, string> | null,
  ) => {
    if (!selectedStepNodeId) return;
    updateStep(selectedStepNodeId, {
      request: {
        ...step.request,
        request_params: newParams,
        _params_buffer: newBuffer,
      },
    });
  };

  return (
    <KeyValueListEditor
      data={params}
      buffer={paramsBuffer}
      onUpdate={handleUpdate}
      disabled={isSaving}
      availableVariables={availableVariables}
      keyPlaceholder="Parameter name"
      valuePlaceholder="Parameter value"
    />
  );
}
