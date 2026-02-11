import { useMemo } from "react";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";
import { SimpleJSONEditor } from "../shared/SimpleJSONEditor";

export function JSONBodyEditor() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const json = step?.request.request_json ?? null;
  const availableVariables = useMemo(() => {
    return step?.depends_on_variables || [];
  }, [step?.depends_on_variables]);

  if (!step) return null;

  const handleUpdate = (newJson: Record<string, any> | null) => {
    if (!selectedStepNodeId) return;
    updateStep(selectedStepNodeId, {
      request: {
        ...step.request,
        request_json: newJson,
      },
    });
  };

  return (
    <SimpleJSONEditor
      data={json}
      onUpdate={handleUpdate}
      disabled={isSaving}
      availableVariables={availableVariables}
    />
  );
}
