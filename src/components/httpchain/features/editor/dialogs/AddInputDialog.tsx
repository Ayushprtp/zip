import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useAppStore } from "../../../store";

interface AddInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddInputDialog({ open, onOpenChange }: AddInputDialogProps) {
  const addInputVariable = useAppStore((s) => s.addInputVariable);
  const isSaving = useAppStore((s) => s.isSaving);

  const [inputVariableName, setInputVariableName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!inputVariableName.trim()) return;
    setIsAdding(true);
    try {
      await addInputVariable(inputVariableName.trim());
      setInputVariableName("");
      onOpenChange(false);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setInputVariableName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Input Variable</DialogTitle>
          <DialogDescription>
            Create a new input variable for your workflow chain.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="variable-name">Variable Name</Label>
            <Input
              id="variable-name"
              value={inputVariableName}
              onChange={(e) => setInputVariableName(e.target.value)}
              placeholder="e.g., user_id, api_key"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputVariableName.trim()) {
                  handleAdd();
                }
                if (e.key === "Escape") {
                  handleCancel();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Use lowercase with underscores for reliability.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isAdding}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!inputVariableName.trim() || isAdding || isSaving}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Variable
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
