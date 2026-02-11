import { FlowCanvas } from "./canvas/FlowCanvas";
import { Sidebar } from "./canvas/Sidebar";
import { StepDetailOverlay } from "./step/StepDetailOverlay";
import { useAppStore } from "../../../store";

interface EditorLayoutProps {
  onBack: () => void;
}

export function EditorLayout({ onBack }: EditorLayoutProps) {
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const setSelectedStepNodeId = useAppStore((s) => s.setSelectedStepNodeId);
  const setSelectedStepTab = useAppStore((s) => s.setSelectedStepTab);

  const handleClose = () => {
    setSelectedStepNodeId(null);
    setSelectedStepTab(null);
  };

  return (
    <div className="h-full w-full flex bg-canvas">
      {/* Sidebar with shadow for depth */}
      <div
        className="w-[320px] shrink-0 h-full relative z-10"
        style={{ boxShadow: "var(--sidebar-shadow)" }}
      >
        <Sidebar onBack={onBack} />
      </div>

      {/* Canvas area */}
      <div className="flex-1 min-w-0 h-full relative">
        <FlowCanvas />
      </div>

      <StepDetailOverlay open={!!selectedStepNodeId} onClose={handleClose} />
    </div>
  );
}
