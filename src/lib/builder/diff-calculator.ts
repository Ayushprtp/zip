/**
 * Diff Calculator - Calculates differences between file states
 * Uses diff-match-patch library for line-level diff generation
 */

import DiffMatchPatch from "diff-match-patch";
import type { FileDiff, DiffHunk, DiffLine } from "@/types/builder";

const dmp = new DiffMatchPatch();

/**
 * Calculates the diff between two file system states
 * @param oldFiles - The previous file system state
 * @param newFiles - The new file system state
 * @returns Array of FileDiff objects with hunks and line-level changes
 */
export function calculateDiff(
  oldFiles: Record<string, string>,
  newFiles: Record<string, string>,
): FileDiff[] {
  const diffs: FileDiff[] = [];
  const allPaths = new Set([
    ...Object.keys(oldFiles),
    ...Object.keys(newFiles),
  ]);

  for (const path of allPaths) {
    const oldContent = oldFiles[path];
    const newContent = newFiles[path];

    if (!oldContent && newContent) {
      // File was added
      diffs.push(createAddedFileDiff(path, newContent));
    } else if (oldContent && !newContent) {
      // File was deleted
      diffs.push(createDeletedFileDiff(path, oldContent));
    } else if (oldContent !== newContent) {
      // File was modified
      diffs.push(createModifiedFileDiff(path, oldContent, newContent));
    }
  }

  return diffs;
}

/**
 * Creates a FileDiff for an added file
 */
function createAddedFileDiff(path: string, content: string): FileDiff {
  const lines = content.split("\n");
  const diffLines: DiffLine[] = lines.map((line, index) => ({
    type: "add",
    content: line,
    lineNumber: index + 1,
  }));

  const hunk: DiffHunk = {
    oldStart: 0,
    oldLines: 0,
    newStart: 1,
    newLines: lines.length,
    lines: diffLines,
  };

  return {
    path,
    type: "added",
    newContent: content,
    hunks: [hunk],
  };
}

/**
 * Creates a FileDiff for a deleted file
 */
function createDeletedFileDiff(path: string, content: string): FileDiff {
  const lines = content.split("\n");
  const diffLines: DiffLine[] = lines.map((line, index) => ({
    type: "delete",
    content: line,
    lineNumber: index + 1,
  }));

  const hunk: DiffHunk = {
    oldStart: 1,
    oldLines: lines.length,
    newStart: 0,
    newLines: 0,
    lines: diffLines,
  };

  return {
    path,
    type: "deleted",
    oldContent: content,
    hunks: [hunk],
  };
}

/**
 * Creates a FileDiff for a modified file
 */
function createModifiedFileDiff(
  path: string,
  oldContent: string,
  newContent: string,
): FileDiff {
  const hunks = calculateHunks(oldContent, newContent);

  return {
    path,
    type: "modified",
    oldContent,
    newContent,
    hunks,
  };
}

/**
 * Calculates diff hunks for modified content
 */
function calculateHunks(oldContent: string, newContent: string): DiffHunk[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  // Use diff-match-patch to calculate line-level diffs
  const diffs = dmp.diff_main(oldContent, newContent);
  dmp.diff_cleanupSemantic(diffs);

  // Convert diffs to line-based hunks
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const [operation, text] of diffs) {
    const lines = text.split("\n");
    // Remove empty last line if text ends with newline
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (operation === DiffMatchPatch.DIFF_EQUAL) {
        // Context line
        if (currentHunk) {
          currentHunk.lines.push({
            type: "context",
            content: line,
            lineNumber: oldLineNum,
          });
          currentHunk.oldLines++;
          currentHunk.newLines++;
        }
        oldLineNum++;
        newLineNum++;
      } else if (operation === DiffMatchPatch.DIFF_DELETE) {
        // Deleted line
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldLineNum,
            oldLines: 0,
            newStart: newLineNum,
            newLines: 0,
            lines: [],
          };
        }
        currentHunk.lines.push({
          type: "delete",
          content: line,
          lineNumber: oldLineNum,
        });
        currentHunk.oldLines++;
        oldLineNum++;
      } else if (operation === DiffMatchPatch.DIFF_INSERT) {
        // Added line
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldLineNum,
            oldLines: 0,
            newStart: newLineNum,
            newLines: 0,
            lines: [],
          };
        }
        currentHunk.lines.push({
          type: "add",
          content: line,
          lineNumber: newLineNum,
        });
        currentHunk.newLines++;
        newLineNum++;
      }
    }

    // Close current hunk if we have context after changes
    if (
      currentHunk &&
      operation === DiffMatchPatch.DIFF_EQUAL &&
      lines.length > 3
    ) {
      hunks.push(currentHunk);
      currentHunk = null;
    }
  }

  // Add final hunk if exists
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  // If no hunks were created but content differs, create a single hunk
  if (hunks.length === 0 && oldContent !== newContent) {
    const allLines: DiffLine[] = [];

    // Add all old lines as deletions
    oldLines.forEach((line, index) => {
      allLines.push({
        type: "delete",
        content: line,
        lineNumber: index + 1,
      });
    });

    // Add all new lines as additions
    newLines.forEach((line, index) => {
      allLines.push({
        type: "add",
        content: line,
        lineNumber: index + 1,
      });
    });

    hunks.push({
      oldStart: 1,
      oldLines: oldLines.length,
      newStart: 1,
      newLines: newLines.length,
      lines: allLines,
    });
  }

  return hunks;
}

/**
 * Gets a summary of changes from a FileDiff array
 */
export function getDiffSummary(diffs: FileDiff[]): {
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  linesAdded: number;
  linesDeleted: number;
} {
  let filesAdded = 0;
  let filesModified = 0;
  let filesDeleted = 0;
  let linesAdded = 0;
  let linesDeleted = 0;

  for (const diff of diffs) {
    if (diff.type === "added") {
      filesAdded++;
      linesAdded += diff.newContent?.split("\n").length || 0;
    } else if (diff.type === "deleted") {
      filesDeleted++;
      linesDeleted += diff.oldContent?.split("\n").length || 0;
    } else if (diff.type === "modified") {
      filesModified++;
      for (const hunk of diff.hunks) {
        for (const line of hunk.lines) {
          if (line.type === "add") {
            linesAdded++;
          } else if (line.type === "delete") {
            linesDeleted++;
          }
        }
      }
    }
  }

  return {
    filesAdded,
    filesModified,
    filesDeleted,
    linesAdded,
    linesDeleted,
  };
}

/**
 * Checks if two file states are identical
 */
export function areFilesIdentical(
  files1: Record<string, string>,
  files2: Record<string, string>,
): boolean {
  const keys1 = Object.keys(files1).sort();
  const keys2 = Object.keys(files2).sort();

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let i = 0; i < keys1.length; i++) {
    if (keys1[i] !== keys2[i]) {
      return false;
    }
    if (files1[keys1[i]] !== files2[keys2[i]]) {
      return false;
    }
  }

  return true;
}
