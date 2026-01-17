"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { File, Folder } from "lucide-react";

interface FilePickerDialogProps {
  open: boolean;
  onClose: () => void;
  files: Record<string, string>;
  onSelect: (selectedFiles: string[]) => void;
}

export function FilePickerDialog({
  open,
  onClose,
  files,
  onSelect,
}: FilePickerDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const filePaths = Object.keys(files).sort();

  const toggleFile = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedFiles(newSelected);
  };

  const handleConfirm = () => {
    onSelect(Array.from(selectedFiles));
    setSelectedFiles(new Set());
    onClose();
  };

  const handleCancel = () => {
    setSelectedFiles(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Files</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {filePaths.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No files in project
              </div>
            ) : (
              filePaths.map((path) => (
                <FileItem
                  key={path}
                  path={path}
                  selected={selectedFiles.has(path)}
                  onToggle={() => toggleFile(path)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedFiles.size === 0}>
            Select {selectedFiles.size > 0 && `(${selectedFiles.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FileItemProps {
  path: string;
  selected: boolean;
  onToggle: () => void;
}

function FileItem({ path, selected, onToggle }: FileItemProps) {
  const _fileName = path.split("/").pop() || path;
  const isDirectory = path.endsWith("/");

  return (
    <div
      className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
      onClick={onToggle}
      data-testid={`file-item-${path}`}
    >
      <Checkbox checked={selected} onCheckedChange={onToggle} />
      {isDirectory ? (
        <Folder className="h-4 w-4 text-blue-500" />
      ) : (
        <File className="h-4 w-4 text-gray-500" />
      )}
      <span className="text-sm font-mono">{path}</span>
    </div>
  );
}
