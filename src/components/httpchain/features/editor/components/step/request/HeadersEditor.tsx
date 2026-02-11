import { useMemo } from "react";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";
import { KeyValueListEditor } from "../shared/KeyValueListEditor";

export function HeadersEditor() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const headers = step?.request.request_headers ?? null;
  const headersBuffer = step?.request._headers_buffer ?? null;
  const availableVariables = useMemo(() => {
    return step?.depends_on_variables || [];
  }, [step?.depends_on_variables]);

  if (!step) return null;

  const handleUpdate = (
    newHeaders: Record<string, string> | null,
    newBuffer: Record<string, string> | null,
  ) => {
    if (!selectedStepNodeId) return;
    updateStep(selectedStepNodeId, {
      request: {
        ...step.request,
        request_headers: newHeaders,
        _headers_buffer: newBuffer,
      },
    });
  };

  return (
    <KeyValueListEditor
      data={headers}
      buffer={headersBuffer}
      onUpdate={handleUpdate}
      disabled={isSaving}
      availableVariables={availableVariables}
      keyPlaceholder="Header name"
      valuePlaceholder="Header value"
    />
  );
}
