/**
 * DiffViewer - Displays side-by-side file comparison
 * Shows additions in green and deletions in red with confirm/cancel buttons
 */

"use client";

import type { FileDiff } from "@/types/builder";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface DiffViewerProps {
  diffs: FileDiff[];
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function DiffViewer({
  diffs,
  onConfirm,
  onCancel,
  className = "",
}: DiffViewerProps) {
  if (diffs.length === 0) {
    return (
      <div className={`flex flex-col h-full p-4 ${className}`}>
        <h2 className="text-lg font-semibold mb-4">No Changes</h2>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">
            No differences found between the selected checkpoint and current
            state.
          </p>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const summary = getDiffSummary(diffs);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Review Changes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {summary.filesAdded > 0 && (
            <span className="text-green-600">+{summary.filesAdded} added </span>
          )}
          {summary.filesModified > 0 && (
            <span className="text-blue-600">
              {summary.filesModified} modified{" "}
            </span>
          )}
          {summary.filesDeleted > 0 && (
            <span className="text-red-600">
              -{summary.filesDeleted} deleted
            </span>
          )}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {diffs.map((diff) => (
            <FileDiffCard key={diff.path} diff={diff} />
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>Confirm Rollback</Button>
      </div>
    </div>
  );
}

interface FileDiffCardProps {
  diff: FileDiff;
}

function FileDiffCard({ diff }: FileDiffCardProps) {
  const typeColor = {
    added: "text-green-600",
    modified: "text-blue-600",
    deleted: "text-red-600",
  };

  const typeBadge = {
    added: "Added",
    modified: "Modified",
    deleted: "Deleted",
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-semibold ${typeColor[diff.type]}`}>
          {typeBadge[diff.type]}
        </span>
        <span className="text-sm font-mono">{diff.path}</span>
      </div>

      <Separator className="mb-3" />

      {diff.type === "added" && (
        <div className="space-y-1">
          {diff.newContent?.split("\n").map((line, index) => (
            <DiffLine
              key={index}
              type="add"
              content={line}
              lineNumber={index + 1}
            />
          ))}
        </div>
      )}

      {diff.type === "deleted" && (
        <div className="space-y-1">
          {diff.oldContent?.split("\n").map((line, index) => (
            <DiffLine
              key={index}
              type="delete"
              content={line}
              lineNumber={index + 1}
            />
          ))}
        </div>
      )}

      {diff.type === "modified" && (
        <div className="space-y-3">
          {diff.hunks.map((hunk, hunkIndex) => (
            <div key={hunkIndex} className="space-y-1">
              <div className="text-xs text-muted-foreground font-mono mb-1">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},
                {hunk.newLines} @@
              </div>
              {hunk.lines.map((line, lineIndex) => (
                <DiffLine
                  key={lineIndex}
                  type={line.type}
                  content={line.content}
                  lineNumber={line.lineNumber}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

interface DiffLineProps {
  type: "add" | "delete" | "context";
  content: string;
  lineNumber: number;
}

function DiffLine({ type, content, lineNumber }: DiffLineProps) {
  const bgColor = {
    add: "bg-green-50 dark:bg-green-950/20",
    delete: "bg-red-50 dark:bg-red-950/20",
    context: "bg-transparent",
  };

  const textColor = {
    add: "text-green-700 dark:text-green-400",
    delete: "text-red-700 dark:text-red-400",
    context: "text-foreground",
  };

  const prefix = {
    add: "+",
    delete: "-",
    context: " ",
  };

  return (
    <div
      className={`flex items-start gap-2 px-2 py-1 font-mono text-xs ${bgColor[type]}`}
    >
      <span className="text-muted-foreground w-8 text-right flex-shrink-0">
        {lineNumber}
      </span>
      <span className={`${textColor[type]} flex-shrink-0`}>{prefix[type]}</span>
      <span
        className={`${textColor[type]} flex-1 whitespace-pre-wrap break-all`}
      >
        {content}
      </span>
    </div>
  );
}

/**
 * Gets a summary of changes from a FileDiff array
 */
function getDiffSummary(diffs: FileDiff[]): {
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
} {
  let filesAdded = 0;
  let filesModified = 0;
  let filesDeleted = 0;

  for (const diff of diffs) {
    if (diff.type === "added") filesAdded++;
    if (diff.type === "modified") filesModified++;
    if (diff.type === "deleted") filesDeleted++;
  }

  return {
    filesAdded,
    filesModified,
    filesDeleted,
  };
}
