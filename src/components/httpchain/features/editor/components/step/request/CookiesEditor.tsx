import { useMemo } from "react";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";
import { KeyValueListEditor } from "../shared/KeyValueListEditor";

export function CookiesEditor() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const cookies = step?.request.request_cookies ?? null;
  const cookiesBuffer = step?.request._cookies_buffer ?? null;
  const availableVariables = useMemo(() => {
    return step?.depends_on_variables || [];
  }, [step?.depends_on_variables]);

  if (!step) return null;

  const handleUpdate = (
    newCookies: Record<string, string> | null,
    newBuffer: Record<string, string> | null,
  ) => {
    if (!selectedStepNodeId) return;
    updateStep(selectedStepNodeId, {
      request: {
        ...step.request,
        request_cookies: newCookies,
        _cookies_buffer: newBuffer,
      },
    });
  };

  return (
    <KeyValueListEditor
      data={cookies}
      buffer={cookiesBuffer}
      onUpdate={handleUpdate}
      disabled={isSaving}
      availableVariables={availableVariables}
      keyPlaceholder="Cookie name"
      valuePlaceholder="Cookie value"
    />
  );
}
