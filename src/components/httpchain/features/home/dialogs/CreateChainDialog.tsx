import { Link, Plus } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../../components/ui/dialog";
import { Label } from "../../../components/ui/label";

interface CreateChainDialogProps {
  open: boolean;
  name: string;
  onNameChange: (name: string) => void;
  onCreate: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function CreateChainDialog({
  open,
  name,
  onNameChange,
  onCreate,
  onCancel,
  isPending,
}: CreateChainDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Link className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">New Workflow Chain</DialogTitle>
              <DialogDescription className="mt-1">
                Create a new chain to start building your request workflow.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chain-name" className="text-sm font-medium">
              Chain Name
            </Label>
            <Input
              id="chain-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
              placeholder="e.g., User Registration Flow"
              className="h-10"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Give your chain a descriptive name to identify it easily.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 bg-muted/20">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={!name.trim() || isPending}>
            {isPending ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Chain
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
