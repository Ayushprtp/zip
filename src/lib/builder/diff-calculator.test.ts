/**
 * Property-based tests for diff calculator
 * Tests diff calculation completeness and correctness
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  calculateDiff,
  getDiffSummary,
  areFilesIdentical,
} from "./diff-calculator";

describe("Diff Calculator Property Tests", () => {
  // Feature: ai-builder-ide, Property 7: Diff Calculation Completeness
  describe("Property 7: Diff Calculation Completeness", () => {
    it("should identify all files that differ between states (added, modified, deleted)", () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.string()),
          fc.dictionary(fc.string(), fc.string()),
          (oldFiles, newFiles) => {
            const diffs = calculateDiff(oldFiles, newFiles);

            // Get all paths that should have diffs
            const allPaths = new Set([
              ...Object.keys(oldFiles),
              ...Object.keys(newFiles),
            ]);
            const changedPaths = new Set<string>();

            for (const path of allPaths) {
              const oldContent = oldFiles[path];
              const newContent = newFiles[path];

              if (!oldContent && newContent) {
                // Added
                changedPaths.add(path);
              } else if (oldContent && !newContent) {
                // Deleted
                changedPaths.add(path);
              } else if (oldContent !== newContent) {
                // Modified
                changedPaths.add(path);
              }
            }

            // Verify all changed files are in diffs
            expect(diffs.length).toBe(changedPaths.size);

            // Verify each diff corresponds to a changed file
            for (const diff of diffs) {
              expect(changedPaths.has(diff.path)).toBe(true);
            }

            // Verify no files are omitted
            const diffPaths = new Set(diffs.map((d) => d.path));
            for (const path of changedPaths) {
              expect(diffPaths.has(path)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should correctly classify file changes as added, modified, or deleted", () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.string()),
          fc.dictionary(fc.string(), fc.string()),
          (oldFiles, newFiles) => {
            const diffs = calculateDiff(oldFiles, newFiles);

            for (const diff of diffs) {
              const oldContent = oldFiles[diff.path];
              const newContent = newFiles[diff.path];

              if (!oldContent && newContent) {
                expect(diff.type).toBe("added");
                expect(diff.newContent).toBe(newContent);
              } else if (oldContent && !newContent) {
                expect(diff.type).toBe("deleted");
                expect(diff.oldContent).toBe(oldContent);
              } else if (oldContent !== newContent) {
                expect(diff.type).toBe("modified");
                expect(diff.oldContent).toBe(oldContent);
                expect(diff.newContent).toBe(newContent);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should return empty diff array when file states are identical", () => {
      fc.assert(
        fc.property(fc.dictionary(fc.string(), fc.string()), (files) => {
          const diffs = calculateDiff(files, files);
          expect(diffs).toHaveLength(0);
        }),
        { numRuns: 100 },
      );
    });

    it("should handle empty file states", () => {
      fc.assert(
        fc.property(fc.constant({}), fc.constant({}), (oldFiles, newFiles) => {
          const diffs = calculateDiff(oldFiles, newFiles);
          expect(diffs).toHaveLength(0);
        }),
        { numRuns: 100 },
      );
    });

    it("should detect all added files when old state is empty", () => {
      fc.assert(
        fc.property(fc.dictionary(fc.string(), fc.string()), (newFiles) => {
          const diffs = calculateDiff({}, newFiles);

          expect(diffs.length).toBe(Object.keys(newFiles).length);

          for (const diff of diffs) {
            expect(diff.type).toBe("added");
            expect(diff.newContent).toBeDefined();
          }
        }),
        { numRuns: 100 },
      );
    });

    it("should detect all deleted files when new state is empty", () => {
      fc.assert(
        fc.property(fc.dictionary(fc.string(), fc.string()), (oldFiles) => {
          const diffs = calculateDiff(oldFiles, {});

          expect(diffs.length).toBe(Object.keys(oldFiles).length);

          for (const diff of diffs) {
            expect(diff.type).toBe("deleted");
            expect(diff.oldContent).toBeDefined();
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // Additional property: Diff summary correctness
  describe("Diff Summary Correctness", () => {
    it("should correctly count added, modified, and deleted files", () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.string()),
          fc.dictionary(fc.string(), fc.string()),
          (oldFiles, newFiles) => {
            const diffs = calculateDiff(oldFiles, newFiles);
            const summary = getDiffSummary(diffs);

            let expectedAdded = 0;
            let expectedModified = 0;
            let expectedDeleted = 0;

            for (const diff of diffs) {
              if (diff.type === "added") expectedAdded++;
              if (diff.type === "modified") expectedModified++;
              if (diff.type === "deleted") expectedDeleted++;
            }

            expect(summary.filesAdded).toBe(expectedAdded);
            expect(summary.filesModified).toBe(expectedModified);
            expect(summary.filesDeleted).toBe(expectedDeleted);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Additional property: File identity check
  describe("File Identity Check", () => {
    it("should correctly identify identical file states", () => {
      fc.assert(
        fc.property(fc.dictionary(fc.string(), fc.string()), (files) => {
          expect(areFilesIdentical(files, files)).toBe(true);
          expect(areFilesIdentical(files, { ...files })).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("should correctly identify different file states", () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.string()),
          fc.string(),
          fc.string(),
          (files, newKey, newValue) => {
            // Skip if newKey already exists
            if (files[newKey] !== undefined) {
              return;
            }

            const modifiedFiles = { ...files, [newKey]: newValue };
            expect(areFilesIdentical(files, modifiedFiles)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Additional property: Diff hunks structure
  describe("Diff Hunks Structure", () => {
    it("should generate valid hunks for modified files", () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          (path, oldContent, newContent) => {
            // Skip if contents are identical
            if (oldContent === newContent) {
              return;
            }

            const diffs = calculateDiff(
              { [path]: oldContent },
              { [path]: newContent },
            );

            expect(diffs).toHaveLength(1);
            expect(diffs[0].type).toBe("modified");
            expect(diffs[0].hunks).toBeDefined();
            expect(Array.isArray(diffs[0].hunks)).toBe(true);

            // Verify each hunk has required properties
            for (const hunk of diffs[0].hunks) {
              expect(hunk.oldStart).toBeGreaterThanOrEqual(0);
              expect(hunk.oldLines).toBeGreaterThanOrEqual(0);
              expect(hunk.newStart).toBeGreaterThanOrEqual(0);
              expect(hunk.newLines).toBeGreaterThanOrEqual(0);
              expect(Array.isArray(hunk.lines)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
