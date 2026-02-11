import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../../components/ui/dialog";

interface DeleteAllChainsDialogProps {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function DeleteAllChainsDialog({
  open,
  count,
  onConfirm,
  onCancel,
  isPending,
}: DeleteAllChainsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-xl">Delete All Chains</DialogTitle>
              <DialogDescription className="mt-1">
                This action is extremely destructive.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pt-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            You are about to delete{" "}
            <span className="font-semibold text-foreground">
              {count} chains
            </span>
            .
          </p>
          <div className="text-sm bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20">
            <p className="font-semibold">Warning:</p>
            <p>
              This action cannot be undone. All workflow chains will be
              permanently lost.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 bg-muted/20">
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
