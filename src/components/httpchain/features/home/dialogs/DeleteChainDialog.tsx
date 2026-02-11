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

interface DeleteChainDialogProps {
  chainId: string | null;
  onConfirm: (id: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function DeleteChainDialog({
  chainId,
  onConfirm,
  onCancel,
  isPending,
}: DeleteChainDialogProps) {
  return (
    <Dialog
      open={chainId !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-xl">Delete Chain</DialogTitle>
              <DialogDescription className="mt-1">
                This action is destructive and cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pt-2">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete this workflow chain? All
            configuration, steps, and history associated with this chain will be
            removed immediately.
          </p>
        </div>

        <DialogFooter className="p-6 pt-2 bg-muted/20">
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => chainId !== null && onConfirm(chainId)}
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
                Delete Chain
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
