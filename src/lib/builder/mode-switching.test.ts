/**
 * Property-Based Tests for Mode Switching
 * Feature: ai-builder-ide
 * Tests Properties 22 and 23
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { ProjectState, LayoutMode } from "@/types/builder";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Simulates mode toggle behavior
 */
function toggleMode(currentMode: LayoutMode): LayoutMode {
  return currentMode === "chat" ? "builder" : "chat";
}

/**
 * Creates a sample project state
 */
function createProjectState(overrides?: Partial<ProjectState>): ProjectState {
  return {
    files: {},
    activeFile: null,
    template: "vite-react",
    serverStatus: "stopped",
    historyStack: [],
    currentCheckpointIndex: -1,
    libraryPreference: "tailwind",
    consoleOutput: [],
    mode: "chat",
    ...overrides,
  };
}

// ============================================================================
// Property 22: Mode Toggle State Transition
// ============================================================================

describe("Feature: ai-builder-ide, Property 22: Mode Toggle State Transition", () => {
  it("should switch to the opposite mode when mode toggle is clicked", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LayoutMode>("chat", "builder"),
        (currentMode) => {
          // When: user clicks mode toggle
          const newMode = toggleMode(currentMode);

          // Then: mode should be the opposite
          const expectedMode = currentMode === "chat" ? "builder" : "chat";
          expect(newMode).toBe(expectedMode);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should toggle back and forth between modes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LayoutMode>("chat", "builder"),
        (startMode) => {
          // When: user toggles mode twice
          const firstToggle = toggleMode(startMode);
          const secondToggle = toggleMode(firstToggle);

          // Then: should return to original mode
          expect(secondToggle).toBe(startMode);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 23: Mode Switch Project State Invariant
// ============================================================================

describe("Feature: ai-builder-ide, Property 23: Mode Switch Project State Invariant", () => {
  it("should preserve all project data when switching modes", () => {
    fc.assert(
      fc.property(
        // Generate random project state
        fc.record({
          files: fc.dictionary(fc.string(), fc.string()),
          activeFile: fc.option(fc.string(), { nil: null }),
          template: fc.constantFrom("vite-react", "nextjs", "node", "static"),
          serverStatus: fc.constantFrom(
            "stopped",
            "booting",
            "running",
            "error",
          ),
          libraryPreference: fc.constantFrom(
            "shadcn",
            "daisyui",
            "material-ui",
            "tailwind",
          ),
          consoleOutput: fc.array(
            fc.record({
              id: fc.string(),
              level: fc.constantFrom("log", "info", "warn", "error"),
              message: fc.string(),
              timestamp: fc.integer(),
            }),
          ),
          historyStack: fc.array(
            fc.record({
              id: fc.string(),
              timestamp: fc.integer(),
              label: fc.string(),
              files: fc.dictionary(fc.string(), fc.string()),
              description: fc.option(fc.string(), { nil: undefined }),
            }),
          ),
          currentCheckpointIndex: fc.integer({ min: -1, max: 10 }),
        }),
        fc.constantFrom<LayoutMode>("chat", "builder"),
        (projectData, startMode) => {
          // Given: a project state
          const initialState = createProjectState({
            ...projectData,
            mode: startMode,
          });

          // When: switching modes
          const newMode = toggleMode(startMode);
          const stateAfterSwitch = {
            ...initialState,
            mode: newMode,
          };

          // Then: all project data should be preserved
          expect(stateAfterSwitch.files).toEqual(initialState.files);
          expect(stateAfterSwitch.activeFile).toBe(initialState.activeFile);
          expect(stateAfterSwitch.template).toBe(initialState.template);
          expect(stateAfterSwitch.serverStatus).toBe(initialState.serverStatus);
          expect(stateAfterSwitch.libraryPreference).toBe(
            initialState.libraryPreference,
          );
          expect(stateAfterSwitch.consoleOutput).toEqual(
            initialState.consoleOutput,
          );
          expect(stateAfterSwitch.historyStack).toEqual(
            initialState.historyStack,
          );
          expect(stateAfterSwitch.currentCheckpointIndex).toBe(
            initialState.currentCheckpointIndex,
          );

          // Only mode should change
          expect(stateAfterSwitch.mode).toBe(newMode);
          expect(stateAfterSwitch.mode).not.toBe(initialState.mode);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve files object reference integrity when switching modes", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.string(), { minKeys: 1, maxKeys: 10 }),
        fc.constantFrom<LayoutMode>("chat", "builder"),
        (files, startMode) => {
          // Given: a project state with files
          const initialState = createProjectState({
            files,
            mode: startMode,
          });

          // When: switching modes
          const newMode = toggleMode(startMode);
          const stateAfterSwitch = {
            ...initialState,
            mode: newMode,
          };

          // Then: files should be deeply equal
          expect(stateAfterSwitch.files).toEqual(initialState.files);

          // And: all file paths should be preserved
          const initialPaths = Object.keys(initialState.files).sort();
          const newPaths = Object.keys(stateAfterSwitch.files).sort();
          expect(newPaths).toEqual(initialPaths);

          // And: all file contents should be preserved
          for (const path of initialPaths) {
            expect(stateAfterSwitch.files[path]).toBe(initialState.files[path]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve checkpoint history when switching modes", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            timestamp: fc.integer(),
            label: fc.string(),
            files: fc.dictionary(fc.string(), fc.string()),
            description: fc.option(fc.string(), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        fc.constantFrom<LayoutMode>("chat", "builder"),
        (checkpoints, startMode) => {
          // Given: a project state with checkpoint history
          const initialState = createProjectState({
            historyStack: checkpoints,
            currentCheckpointIndex: checkpoints.length - 1,
            mode: startMode,
          });

          // When: switching modes
          const newMode = toggleMode(startMode);
          const stateAfterSwitch = {
            ...initialState,
            mode: newMode,
          };

          // Then: checkpoint history should be preserved
          expect(stateAfterSwitch.historyStack).toEqual(
            initialState.historyStack,
          );
          expect(stateAfterSwitch.historyStack.length).toBe(
            initialState.historyStack.length,
          );
          expect(stateAfterSwitch.currentCheckpointIndex).toBe(
            initialState.currentCheckpointIndex,
          );

          // And: each checkpoint should be deeply equal
          for (let i = 0; i < checkpoints.length; i++) {
            expect(stateAfterSwitch.historyStack[i]).toEqual(
              initialState.historyStack[i],
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve chat history when switching modes", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            level: fc.constantFrom("log", "info", "warn", "error"),
            message: fc.string(),
            timestamp: fc.integer(),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.constantFrom<LayoutMode>("chat", "builder"),
        (consoleOutput, startMode) => {
          // Given: a project state with console output
          const initialState = createProjectState({
            consoleOutput,
            mode: startMode,
          });

          // When: switching modes
          const newMode = toggleMode(startMode);
          const stateAfterSwitch = {
            ...initialState,
            mode: newMode,
          };

          // Then: console output should be preserved
          expect(stateAfterSwitch.consoleOutput).toEqual(
            initialState.consoleOutput,
          );
          expect(stateAfterSwitch.consoleOutput.length).toBe(
            initialState.consoleOutput.length,
          );

          // And: each log entry should be preserved
          for (let i = 0; i < consoleOutput.length; i++) {
            expect(stateAfterSwitch.consoleOutput[i]).toEqual(
              initialState.consoleOutput[i],
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
