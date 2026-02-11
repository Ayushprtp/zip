import { Label } from "@/components/httpchain/components/ui/label";
import { Checkbox } from "@/components/httpchain/components/ui/checkbox";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";

export function RequestOptions() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  if (!step || !selectedStepNodeId) return null;

  const request = step.request;
  const disabled = isSaving;

  const handleUpdateFollowRedirects = (checked: boolean) => {
    updateStep(selectedStepNodeId, {
      request: {
        ...request,
        request_follow_redirects: checked,
      },
    });
  };

  const handleUpdateRandomizeHeaders = (checked: boolean) => {
    updateStep(selectedStepNodeId, {
      request: {
        ...request,
        randomize_headers: checked,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="follow-redirects"
          checked={request.request_follow_redirects !== false}
          onCheckedChange={handleUpdateFollowRedirects}
          disabled={disabled}
        />
        <Label
          htmlFor="follow-redirects"
          className="text-sm font-normal cursor-pointer"
        >
          Follow Redirects
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="randomize-headers"
          checked={request.randomize_headers || false}
          onCheckedChange={handleUpdateRandomizeHeaders}
          disabled={disabled}
        />
        <Label
          htmlFor="randomize-headers"
          className="text-sm font-normal cursor-pointer"
        >
          Randomize Headers
        </Label>
      </div>
    </div>
  );
}
