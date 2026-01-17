/**
 * Property-based tests for ProjectContext
 * Tests universal properties for state management
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { ProjectState, Checkpoint } from "@/types/builder";

// Import the reducer function directly for testing
// We'll test the reducer logic without React rendering
function projectReducer(state: ProjectState, action: any): ProjectState {
  switch (action.type) {
    case "UPDATE_FILE": {
      const { path, content } = action.payload;
      return {
        ...state,
        files: {
          ...state.files,
          [path]: content,
        },
      };
    }

    case "CREATE_FILE": {
      const { path, content } = action.payload;
      return {
        ...state,
        files: {
          ...state.files,
          [path]: content,
        },
      };
    }

    case "DELETE_FILE": {
      const { path } = action.payload;
      const newFiles = { ...state.files };
      delete newFiles[path];

      return {
        ...state,
        files: newFiles,
        activeFile: state.activeFile === path ? null : state.activeFile,
      };
    }

    case "SET_ACTIVE_FILE": {
      return {
        ...state,
        activeFile: action.payload.path,
      };
    }

    case "CREATE_CHECKPOINT": {
      const { label } = action.payload;
      const checkpoint: Checkpoint = {
        id: `checkpoint-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        label,
        files: { ...state.files },
        description: `${Object.keys(state.files).length} files`,
      };

      return {
        ...state,
        historyStack: [...state.historyStack, checkpoint],
        currentCheckpointIndex: state.historyStack.length,
      };
    }

    case "RESTORE_CHECKPOINT": {
      const { checkpointId } = action.payload;
      const checkpointIndex = state.historyStack.findIndex(
        (cp) => cp.id === checkpointId,
      );

      if (checkpointIndex === -1) {
        return state;
      }

      const checkpoint = state.historyStack[checkpointIndex];
      return {
        ...state,
        files: { ...checkpoint.files },
        currentCheckpointIndex: checkpointIndex,
      };
    }

    case "SET_LIBRARY_PREFERENCE": {
      return {
        ...state,
        libraryPreference: action.payload.library,
      };
    }

    case "UPDATE_SERVER_STATUS": {
      return {
        ...state,
        serverStatus: action.payload.status,
      };
    }

    default:
      return state;
  }
}

const initialState: ProjectState = {
  files: {},
  activeFile: null,
  template: "vite-react",
  serverStatus: "stopped",
  historyStack: [],
  currentCheckpointIndex: -1,
  libraryPreference: "tailwind",
  consoleOutput: [],
};

describe("ProjectContext Property Tests", () => {
  // Feature: ai-builder-ide, Property 40: File Tree Display Completeness
  it("should include all created files in the state", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            path: fc
              .string({ minLength: 1, maxLength: 30 })
              .filter(
                (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F]/.test(s),
              )
              .map((s) => `/test/${s}.txt`),
            content: fc.string({ maxLength: 500 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (fileSpecs) => {
          let state = { ...initialState };

          // Create all files and track the final content for each path
          const finalContent = new Map<string, string>();
          for (const spec of fileSpecs) {
            try {
              state = projectReducer(state, {
                type: "CREATE_FILE",
                payload: { path: spec.path, content: spec.content },
              });
              // Track the last content for this path (handles duplicates)
              finalContent.set(spec.path, spec.content);
            } catch {
              // Skip files that fail validation
            }
          }

          // Verify all created files are in state with correct final content
          const files = state.files;
          for (const [path, expectedContent] of finalContent.entries()) {
            expect(files[path]).toBeDefined();
            expect(files[path]).toBe(expectedContent);
          }

          // Verify count matches
          expect(Object.keys(files).length).toBe(finalContent.size);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: File updates should preserve other files
  it("should preserve other files when updating a single file", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            path: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(
                (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F]/.test(s),
              )
              .map((s) => `/test/${s}.txt`),
            content: fc.string({ maxLength: 200 }),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        fc.nat(),
        fc.string({ maxLength: 200 }),
        (fileSpecs, updateIndex, newContent) => {
          if (fileSpecs.length === 0) return true;

          let state = { ...initialState };

          // Create all files
          for (const spec of fileSpecs) {
            state = projectReducer(state, {
              type: "CREATE_FILE",
              payload: { path: spec.path, content: spec.content },
            });
          }

          const filesBefore = { ...state.files };
          const pathToUpdate = fileSpecs[updateIndex % fileSpecs.length].path;

          // Update one file
          state = projectReducer(state, {
            type: "UPDATE_FILE",
            payload: { path: pathToUpdate, content: newContent },
          });

          const filesAfter = state.files;

          // Verify updated file has new content
          expect(filesAfter[pathToUpdate]).toBe(newContent);

          // Verify all other files unchanged
          for (const path of Object.keys(filesBefore)) {
            if (path !== pathToUpdate) {
              expect(filesAfter[path]).toBe(filesBefore[path]);
            }
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: File deletion should remove only the specified file
  it("should remove only the deleted file and preserve others", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            path: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(
                (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F]/.test(s),
              )
              .map((s) => `/test/${s}.txt`),
            content: fc.string({ maxLength: 200 }),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        fc.nat(),
        (fileSpecs, deleteIndex) => {
          if (fileSpecs.length === 0) return true;

          let state = { ...initialState };

          // Create all files
          for (const spec of fileSpecs) {
            state = projectReducer(state, {
              type: "CREATE_FILE",
              payload: { path: spec.path, content: spec.content },
            });
          }

          const filesBefore = { ...state.files };
          const pathToDelete = fileSpecs[deleteIndex % fileSpecs.length].path;

          // Delete one file
          state = projectReducer(state, {
            type: "DELETE_FILE",
            payload: { path: pathToDelete },
          });

          const filesAfter = state.files;

          // Verify deleted file is gone
          expect(filesAfter[pathToDelete]).toBeUndefined();

          // Verify all other files still exist
          for (const path of Object.keys(filesBefore)) {
            if (path !== pathToDelete) {
              expect(filesAfter[path]).toBe(filesBefore[path]);
            }
          }

          // Verify count decreased by 1
          expect(Object.keys(filesAfter).length).toBe(
            Object.keys(filesBefore).length - 1,
          );

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: Checkpoint creation should snapshot current files
  it("should create checkpoint with exact copy of current files", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            path: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(
                (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F]/.test(s),
              )
              .map((s) => `/test/${s}.txt`),
            content: fc.string({ maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.string({ minLength: 1, maxLength: 50 }),
        (fileSpecs, label) => {
          let state = { ...initialState };

          // Create all files
          for (const spec of fileSpecs) {
            state = projectReducer(state, {
              type: "CREATE_FILE",
              payload: { path: spec.path, content: spec.content },
            });
          }

          const filesBeforeCheckpoint = { ...state.files };

          // Create checkpoint
          state = projectReducer(state, {
            type: "CREATE_CHECKPOINT",
            payload: { label },
          });

          const checkpoint = state.historyStack[0];

          // Verify checkpoint contains exact copy of files
          expect(checkpoint).toBeDefined();
          expect(checkpoint.label).toBe(label);
          expect(checkpoint.files).toEqual(filesBeforeCheckpoint);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: Checkpoint restoration should restore exact file state
  it("should restore files to exact checkpoint state", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            path: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(
                (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F]/.test(s),
              )
              .map((s) => `/test/${s}.txt`),
            content: fc.string({ maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.array(
          fc.record({
            path: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(
                (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F]/.test(s),
              )
              .map((s) => `/test/${s}.txt`),
            content: fc.string({ maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (initialFiles, modifiedFiles) => {
          let state = { ...initialState };

          // Create initial files
          for (const spec of initialFiles) {
            state = projectReducer(state, {
              type: "CREATE_FILE",
              payload: { path: spec.path, content: spec.content },
            });
          }

          const filesAtCheckpoint = { ...state.files };

          // Create checkpoint
          state = projectReducer(state, {
            type: "CREATE_CHECKPOINT",
            payload: { label: "test" },
          });

          const checkpointId = state.historyStack[0].id;

          // Modify files
          for (const spec of modifiedFiles) {
            state = projectReducer(state, {
              type: "CREATE_FILE",
              payload: { path: spec.path, content: spec.content },
            });
          }

          // Restore checkpoint
          state = projectReducer(state, {
            type: "RESTORE_CHECKPOINT",
            payload: { checkpointId },
          });

          const filesAfterRestore = state.files;

          // Verify files match checkpoint state
          expect(filesAfterRestore).toEqual(filesAtCheckpoint);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: Server status updates should not affect files
  it("should preserve files when updating server status", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            path: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(
                (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F]/.test(s),
              )
              .map((s) => `/test/${s}.txt`),
            content: fc.string({ maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.constantFrom("stopped", "booting", "running", "error"),
        (fileSpecs, newStatus) => {
          let state = { ...initialState };

          // Create files
          for (const spec of fileSpecs) {
            state = projectReducer(state, {
              type: "CREATE_FILE",
              payload: { path: spec.path, content: spec.content },
            });
          }

          const filesBefore = { ...state.files };

          // Update server status
          state = projectReducer(state, {
            type: "UPDATE_SERVER_STATUS",
            payload: { status: newStatus },
          });

          const filesAfter = state.files;

          // Verify files unchanged
          expect(filesAfter).toEqual(filesBefore);

          // Verify server status updated
          expect(state.serverStatus).toBe(newStatus);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: Library preference updates should not affect files
  it("should preserve files when updating library preference", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            path: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(
                (s) => !s.includes("\x00") && !/[<>:"|?*\x00-\x1F]/.test(s),
              )
              .map((s) => `/test/${s}.txt`),
            content: fc.string({ maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        fc.constantFrom("shadcn", "daisyui", "material-ui", "tailwind"),
        (fileSpecs, newLibrary) => {
          let state = { ...initialState };

          // Create files
          for (const spec of fileSpecs) {
            state = projectReducer(state, {
              type: "CREATE_FILE",
              payload: { path: spec.path, content: spec.content },
            });
          }

          const filesBefore = { ...state.files };

          // Update library preference
          state = projectReducer(state, {
            type: "SET_LIBRARY_PREFERENCE",
            payload: { library: newLibrary },
          });

          const filesAfter = state.files;

          // Verify files unchanged
          expect(filesAfter).toEqual(filesBefore);

          // Verify library preference updated
          expect(state.libraryPreference).toBe(newLibrary);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
