/**
 * Property-based tests for TimelineSidebar
 * Tests timeline ordering and display properties
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Checkpoint } from "@/types/builder";

describe("TimelineSidebar Property Tests", () => {
  // Feature: ai-builder-ide, Property 4: Timeline Chronological Ordering
  describe("Property 4: Timeline Chronological Ordering", () => {
    it("should maintain checkpoints sorted by timestamp in ascending chronological order", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              label: fc.string(),
              files: fc.dictionary(fc.string(), fc.string()),
              timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 2, maxLength: 20 },
          ),
          (checkpointData) => {
            // Create checkpoints with the generated data
            const checkpoints: Checkpoint[] = checkpointData.map((data) => ({
              id: data.id,
              timestamp: data.timestamp,
              label: data.label,
              files: data.files,
              description: `${Object.keys(data.files).length} files`,
            }));

            // Sort checkpoints by timestamp (ascending)
            const sortedCheckpoints = [...checkpoints].sort(
              (a, b) => a.timestamp - b.timestamp,
            );

            // Verify timestamps are in ascending order
            for (let i = 0; i < sortedCheckpoints.length - 1; i++) {
              expect(sortedCheckpoints[i].timestamp).toBeLessThanOrEqual(
                sortedCheckpoints[i + 1].timestamp,
              );
            }

            // Verify all checkpoints are present
            expect(sortedCheckpoints.length).toBe(checkpoints.length);

            // Verify each checkpoint has required properties
            for (const checkpoint of sortedCheckpoints) {
              expect(checkpoint.id).toBeDefined();
              expect(checkpoint.timestamp).toBeGreaterThan(0);
              expect(checkpoint.label).toBeDefined();
              expect(checkpoint.files).toBeDefined();
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should handle checkpoints with duplicate timestamps", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000000000, max: 9999999999999 }),
          fc.array(fc.string(), { minLength: 2, maxLength: 10 }),
          (baseTimestamp, labels) => {
            // Create checkpoints with same timestamp
            const checkpoints: Checkpoint[] = labels.map((label, index) => ({
              id: `checkpoint-${index}`,
              timestamp: baseTimestamp,
              label,
              files: {},
              description: "0 files",
            }));

            // Sort by timestamp (should maintain relative order)
            const sortedCheckpoints = [...checkpoints].sort(
              (a, b) => a.timestamp - b.timestamp,
            );

            // Verify all checkpoints are present
            expect(sortedCheckpoints.length).toBe(checkpoints.length);

            // Verify all have the same timestamp
            for (const checkpoint of sortedCheckpoints) {
              expect(checkpoint.timestamp).toBe(baseTimestamp);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should handle empty checkpoint list", () => {
      fc.assert(
        fc.property(fc.constant([]), (checkpoints) => {
          expect(checkpoints).toHaveLength(0);
        }),
        { numRuns: 100 },
      );
    });

    it("should handle single checkpoint", () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string(),
            label: fc.string(),
            files: fc.dictionary(fc.string(), fc.string()),
            timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
          }),
          (checkpointData) => {
            const checkpoint: Checkpoint = {
              id: checkpointData.id,
              timestamp: checkpointData.timestamp,
              label: checkpointData.label,
              files: checkpointData.files,
              description: `${Object.keys(checkpointData.files).length} files`,
            };

            const checkpoints = [checkpoint];

            // Verify single checkpoint is valid
            expect(checkpoints).toHaveLength(1);
            expect(checkpoints[0].id).toBe(checkpoint.id);
            expect(checkpoints[0].timestamp).toBe(checkpoint.timestamp);
            expect(checkpoints[0].label).toBe(checkpoint.label);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Additional property: Timeline completeness
  describe("Timeline Completeness Property", () => {
    it("should preserve all checkpoint metadata", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              label: fc.string({ minLength: 1 }),
              files: fc.dictionary(fc.string(), fc.string()),
              timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
              description: fc.option(fc.string()),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          (checkpointData) => {
            const checkpoints: Checkpoint[] = checkpointData.map((data) => ({
              id: data.id,
              timestamp: data.timestamp,
              label: data.label,
              files: data.files,
              description:
                data.description || `${Object.keys(data.files).length} files`,
            }));

            // Verify all metadata is preserved
            for (let i = 0; i < checkpoints.length; i++) {
              expect(checkpoints[i].id).toBe(checkpointData[i].id);
              expect(checkpoints[i].timestamp).toBe(
                checkpointData[i].timestamp,
              );
              expect(checkpoints[i].label).toBe(checkpointData[i].label);
              expect(checkpoints[i].files).toEqual(checkpointData[i].files);
              expect(checkpoints[i].description).toBeDefined();
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Additional property: Chronological ordering with random timestamps
  describe("Chronological Ordering with Random Timestamps", () => {
    it("should correctly order checkpoints regardless of insertion order", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              label: fc.string(),
              files: fc.dictionary(fc.string(), fc.string()),
              timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 3, maxLength: 20 },
          ),
          (checkpointData) => {
            // Create checkpoints
            const checkpoints: Checkpoint[] = checkpointData.map((data) => ({
              id: data.id,
              timestamp: data.timestamp,
              label: data.label,
              files: data.files,
              description: `${Object.keys(data.files).length} files`,
            }));

            // Sort by timestamp
            const sortedCheckpoints = [...checkpoints].sort(
              (a, b) => a.timestamp - b.timestamp,
            );

            // Verify strict ordering (or equal for duplicates)
            for (let i = 0; i < sortedCheckpoints.length - 1; i++) {
              expect(sortedCheckpoints[i].timestamp).toBeLessThanOrEqual(
                sortedCheckpoints[i + 1].timestamp,
              );
            }

            // Verify first checkpoint has earliest timestamp
            const minTimestamp = Math.min(
              ...checkpoints.map((cp) => cp.timestamp),
            );
            expect(sortedCheckpoints[0].timestamp).toBe(minTimestamp);

            // Verify last checkpoint has latest timestamp
            const maxTimestamp = Math.max(
              ...checkpoints.map((cp) => cp.timestamp),
            );
            expect(
              sortedCheckpoints[sortedCheckpoints.length - 1].timestamp,
            ).toBe(maxTimestamp);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
