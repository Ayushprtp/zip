/**
 * Property-based tests for SandpackController
 * Feature: ai-builder-ide
 */

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import {
  createServerController,
  isValidTransition,
  getExpectedStatus,
} from "./sandpack-controller";
import type { ServerStatus } from "@/types/builder";

describe("SandpackController Properties", () => {
  /**
   * Feature: ai-builder-ide, Property 2: Server State Transitions
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4
   *
   * For any valid server state transition (stopped→booting→running, running→stopped,
   * running→booting→running for restart), the system should correctly update the server
   * status and the status indicator should reflect the new state.
   */
  it("should correctly transition through valid server states", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<"start" | "stop" | "restart">(
          "start",
          "stop",
          "restart",
        ),
        async (action) => {
          const statusChanges: ServerStatus[] = [];
          const mockSandpackActions = {
            resetAllFiles: vi.fn(),
          };

          const controller = createServerController(mockSandpackActions, {
            onStatusChange: (status) => statusChanges.push(status),
          });

          // Get initial status
          const initialStatus = controller.getStatus();
          expect(initialStatus).toBe("stopped");

          // Perform action
          switch (action) {
            case "start":
              await controller.start();
              // Should transition: stopped -> booting -> running
              expect(statusChanges).toContain("booting");
              expect(controller.getStatus()).toBe("running");
              break;

            case "stop":
              // First start the server
              await controller.start();
              statusChanges.length = 0; // Clear previous changes

              // Then stop it
              await controller.stop();
              expect(controller.getStatus()).toBe("stopped");
              break;

            case "restart":
              // First start the server
              await controller.start();
              statusChanges.length = 0; // Clear previous changes

              // Then restart it
              await controller.restart();
              // Should transition: running -> booting -> running
              expect(statusChanges).toContain("booting");
              expect(controller.getStatus()).toBe("running");
              expect(mockSandpackActions.resetAllFiles).toHaveBeenCalled();
              break;
          }
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);

  /**
   * Additional property: Status changes are notified via callback
   */
  it("should notify status changes via callback for all actions", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<"start" | "stop" | "restart">(
          "start",
          "stop",
          "restart",
        ),
        async (action) => {
          const statusChanges: ServerStatus[] = [];
          const mockSandpackActions = {
            resetAllFiles: vi.fn(),
          };

          const controller = createServerController(mockSandpackActions, {
            onStatusChange: (status) => statusChanges.push(status),
          });

          // Perform action
          switch (action) {
            case "start":
              await controller.start();
              break;
            case "stop":
              await controller.start();
              statusChanges.length = 0;
              await controller.stop();
              break;
            case "restart":
              await controller.start();
              statusChanges.length = 0;
              await controller.restart();
              break;
          }

          // Should have received at least one status change
          expect(statusChanges.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);

  /**
   * Additional property: Server status is idempotent for repeated actions
   */
  it("should handle repeated start/stop actions idempotently", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async (repeatCount) => {
        const mockSandpackActions = {
          resetAllFiles: vi.fn(),
        };

        const controller = createServerController(mockSandpackActions);

        // Start multiple times
        for (let i = 0; i < repeatCount; i++) {
          await controller.start();
        }
        expect(controller.getStatus()).toBe("running");

        // Stop multiple times
        for (let i = 0; i < repeatCount; i++) {
          await controller.stop();
        }
        expect(controller.getStatus()).toBe("stopped");
      }),
      { numRuns: 10 },
    );
  }, 30000);

  /**
   * Additional property: Valid transitions are correctly identified
   */
  it("should correctly identify valid state transitions", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ServerStatus>("stopped", "booting", "running", "error"),
        fc.constantFrom<ServerStatus>("stopped", "booting", "running", "error"),
        (fromStatus, toStatus) => {
          const isValid = isValidTransition(fromStatus, toStatus);

          // Define expected valid transitions
          const expectedValid: Record<ServerStatus, ServerStatus[]> = {
            stopped: ["booting"],
            booting: ["running", "error", "stopped"],
            running: ["booting", "stopped", "error"],
            error: ["booting", "stopped"],
          };

          const shouldBeValid =
            expectedValid[fromStatus]?.includes(toStatus) ?? false;
          expect(isValid).toBe(shouldBeValid);
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * Additional property: Expected status after action is correct
   */
  it("should return correct expected status for each action", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ServerStatus>("stopped", "booting", "running", "error"),
        fc.constantFrom<"start" | "stop" | "restart">(
          "start",
          "stop",
          "restart",
        ),
        (currentStatus, action) => {
          const expectedStatus = getExpectedStatus(currentStatus, action);

          switch (action) {
            case "start":
              if (currentStatus === "stopped") {
                expect(expectedStatus).toBe("booting");
              } else {
                expect(expectedStatus).toBe(currentStatus);
              }
              break;
            case "stop":
              expect(expectedStatus).toBe("stopped");
              break;
            case "restart":
              expect(expectedStatus).toBe("booting");
              break;
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * Additional property: Error callback is invoked on errors
   */
  it("should invoke error callback when errors occur", async () => {
    const errors: Error[] = [];
    const mockSandpackActions = {
      resetAllFiles: vi.fn(() => {
        throw new Error("Reset failed");
      }),
    };

    const controller = createServerController(mockSandpackActions, {
      onError: (error) => errors.push(error),
    });

    // Start the server first
    await controller.start();

    // Restart should trigger an error
    await expect(controller.restart()).rejects.toThrow("Reset failed");

    // Error callback should have been invoked
    expect(errors.length).toBeGreaterThan(0);
    expect(controller.getStatus()).toBe("error");
  });
});
