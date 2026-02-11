import { useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useAppStore } from "@/components/httpchain/store";
import { EditorLayout } from "./EditorLayout";

export default function Editor() {
  const selectedId = useAppStore((s) => s.selectedChainId);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const workflow = useAppStore((s) => s.workflow);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadWorkflow = useAppStore((s) => s.loadWorkflow);
  const clearWorkflow = useAppStore((s) => s.clearWorkflow);

  // Load workflow when selectedId changes
  useEffect(() => {
    if (selectedId) {
      loadWorkflow(selectedId);
    }
  }, [selectedId, loadWorkflow]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      clearWorkflow();
    };
  }, [clearWorkflow]);

  const handleBack = () => {
    clearWorkflow();
    clearSelection();
  };

  if (!selectedId) return null;

  return (
    <div className="h-full overflow-hidden">
      {isLoading && (
        <div className="h-full flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Loading chain...</p>
          </div>
        </div>
      )}

      {!isLoading && !workflow && (
        <div className="h-full flex items-center justify-center">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">Failed to load chain</p>
          </div>
        </div>
      )}

      {workflow && !isLoading && <EditorLayout onBack={handleBack} />}
    </div>
  );
}
