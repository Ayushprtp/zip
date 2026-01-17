/**
 * Property-based tests for CheckpointManager
 * Tests universal properties that should hold for all inputs
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { CheckpointManager } from "./checkpoint-manager";

describe("CheckpointManager Property Tests", () => {
  let manager: CheckpointManager;

  beforeEach(() => {
    manager = new CheckpointManager();
  });

  // Feature: ai-builder-ide, Property 3: Checkpoint Creation on File Batch Completion
  describe("Property 3: Checkpoint Creation on File Batch Completion", () => {
    it("should create a checkpoint that contains a complete snapshot of all files", () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.string()),
          fc.string(),
          (files, label) => {
            const initialCount = manager.getCheckpointCount();

            const checkpoint = manager.createCheckpoint(files, label);

            // Verify checkpoint was created
            expect(checkpoint).toBeDefined();
            expect(checkpoint.id).toBeDefined();
            expect(checkpoint.timestamp).toBeGreaterThan(0);
            expect(checkpoint.label).toBe(label);

            // Verify history stack increased by one
            expect(manager.getCheckpointCount()).toBe(initialCount + 1);

            // Verify checkpoint contains all files
            expect(Object.keys(checkpoint.files)).toHaveLength(
              Object.keys(files).length,
            );
            for (const [path, content] of Object.entries(files)) {
              expect(checkpoint.files[path]).toBe(content);
            }

            // Verify deep clone (mutations don't affect checkpoint)
            const originalFiles = { ...files };
            files["new-file.ts"] = "new content";
            expect(checkpoint.files).toEqual(originalFiles);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should enforce 50-checkpoint limit by removing oldest checkpoints", () => {
      fc.assert(
        fc.property(fc.integer({ min: 51, max: 100 }), (numCheckpoints) => {
          // Create more than 50 checkpoints
          for (let i = 0; i < numCheckpoints; i++) {
            manager.createCheckpoint(
              { [`file${i}.ts`]: `content ${i}` },
              `checkpoint ${i}`,
            );
          }

          // Verify limit is enforced
          expect(manager.getCheckpointCount()).toBe(50);

          // Verify oldest checkpoints were removed (first ones should be gone)
          const allCheckpoints = manager.getAllCheckpoints();
          const firstCheckpoint = allCheckpoints[0];
          expect(firstCheckpoint.label).toBe(
            `checkpoint ${numCheckpoints - 50}`,
          );
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: ai-builder-ide, Property 6: Timeline Update on Checkpoint Creation
  describe("Property 6: Timeline Update on Checkpoint Creation", () => {
    it("should update timeline to include new checkpoint with timestamp and label", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              files: fc.dictionary(fc.string(), fc.string()),
              label: fc.string(),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          (checkpointData) => {
            const createdCheckpoints = [];

            // Create multiple checkpoints
            for (const data of checkpointData) {
              const checkpoint = manager.createCheckpoint(
                data.files,
                data.label,
              );
              createdCheckpoints.push(checkpoint);
            }

            // Get all checkpoints from timeline
            const timeline = manager.getAllCheckpoints();

            // Verify all checkpoints are in timeline
            expect(timeline).toHaveLength(createdCheckpoints.length);

            // Verify each checkpoint has timestamp and label
            for (let i = 0; i < timeline.length; i++) {
              expect(timeline[i].id).toBe(createdCheckpoints[i].id);
              expect(timeline[i].timestamp).toBe(
                createdCheckpoints[i].timestamp,
              );
              expect(timeline[i].label).toBe(createdCheckpoints[i].label);
              expect(timeline[i].timestamp).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should maintain checkpoint metadata (id, timestamp, label, description)", () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.string()),
          fc.string(),
          fc.option(fc.string()),
          (files, label, description) => {
            const beforeTime = Date.now();
            const checkpoint = manager.createCheckpoint(
              files,
              label,
              description,
            );
            const afterTime = Date.now();

            // Verify all metadata is present
            expect(checkpoint.id).toBeDefined();
            expect(typeof checkpoint.id).toBe("string");
            expect(checkpoint.id.length).toBeGreaterThan(0);

            expect(checkpoint.timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(checkpoint.timestamp).toBeLessThanOrEqual(afterTime);

            expect(checkpoint.label).toBe(label);

            if (description) {
              expect(checkpoint.description).toBe(description);
            } else {
              expect(checkpoint.description).toBeDefined();
              expect(typeof checkpoint.description).toBe("string");
            }

            expect(checkpoint.files).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Additional property: Checkpoint isolation (mutations don't affect stored checkpoints)
  describe("Checkpoint Isolation Property", () => {
    it("should isolate checkpoint data from external mutations", () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.string()),
          fc.string(),
          (files, label) => {
            const checkpoint = manager.createCheckpoint(files, label);
            const originalFiles = { ...checkpoint.files };

            // Mutate the original files object
            for (const key of Object.keys(files)) {
              files[key] = "MUTATED";
            }
            files["new-file.ts"] = "NEW FILE";

            // Verify checkpoint is unchanged
            expect(checkpoint.files).toEqual(originalFiles);

            // Verify restored files are unchanged
            const restored = manager.restoreCheckpoint(checkpoint.id);
            expect(restored).toEqual(originalFiles);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Additional property: Checkpoint uniqueness
  describe("Checkpoint Uniqueness Property", () => {
    it("should generate unique IDs for all checkpoints", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              files: fc.dictionary(fc.string(), fc.string()),
              label: fc.string(),
            }),
            { minLength: 2, maxLength: 50 },
          ),
          (checkpointData) => {
            const ids = new Set<string>();

            for (const data of checkpointData) {
              const checkpoint = manager.createCheckpoint(
                data.files,
                data.label,
              );
              expect(ids.has(checkpoint.id)).toBe(false);
              ids.add(checkpoint.id);
            }

            expect(ids.size).toBe(checkpointData.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: ai-builder-ide, Property 5: Checkpoint Restoration Round-Trip
  describe("Property 5: Checkpoint Restoration Round-Trip", () => {
    it("should restore exact file state from checkpoint", () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string(), fc.string()),
          fc.string(),
          (files, label) => {
            // Create a fresh manager for each test
            const testManager = new CheckpointManager();

            // Create checkpoint
            const checkpoint = testManager.createCheckpoint(files, label);

            // Restore checkpoint
            const restoredFiles = testManager.restoreCheckpoint(checkpoint.id);

            // Verify exact match
            expect(restoredFiles).not.toBeNull();
            expect(restoredFiles).toEqual(files);

            // Verify all keys match
            expect(Object.keys(restoredFiles!)).toHaveLength(
              Object.keys(files).length,
            );

            // Verify all values match
            for (const [path, content] of Object.entries(files)) {
              expect(restoredFiles![path]).toBe(content);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should handle restoration of non-existent checkpoint", () => {
      fc.assert(
        fc.property(fc.string(), (fakeId) => {
          const testManager = new CheckpointManager();
          const result = testManager.restoreCheckpoint(fakeId);
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it("should restore correct checkpoint from multiple checkpoints", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              files: fc.dictionary(fc.string(), fc.string()),
              label: fc.string(),
            }),
            { minLength: 2, maxLength: 10 },
          ),
          fc.integer({ min: 0, max: 9 }),
          (checkpointData, targetIndex) => {
            const testManager = new CheckpointManager();
            const checkpoints = [];

            // Create multiple checkpoints
            for (const data of checkpointData) {
              const checkpoint = testManager.createCheckpoint(
                data.files,
                data.label,
              );
              checkpoints.push({ checkpoint, files: data.files });
            }

            // Select a valid target index
            const actualIndex = targetIndex % checkpoints.length;
            const target = checkpoints[actualIndex];

            // Restore the target checkpoint
            const restoredFiles = testManager.restoreCheckpoint(
              target.checkpoint.id,
            );

            // Verify we got the correct checkpoint's files
            expect(restoredFiles).toEqual(target.files);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
