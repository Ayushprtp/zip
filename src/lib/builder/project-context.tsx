/**
 * ProjectContext - Central state management for the AI Builder IDE
 * Provides React Context for managing project files, checkpoints, and configuration
 */

"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useReducer,
  useEffect,
} from "react";
import type {
  ProjectState,
  ProjectActions,
  Checkpoint,
  ServerStatus,
  LibraryType,
  ConsoleLog,
  TemplateType,
  LayoutMode,
} from "@/types/builder";
import { nanoid } from "nanoid";
import {
  saveLibraryPreference,
  loadLibraryPreference,
} from "./library-preference-storage";

// ============================================================================
// Context Types
// ============================================================================

interface ProjectContextValue {
  state: ProjectState;
  actions: ProjectActions;
}

// ============================================================================
// Action Types
// ============================================================================

type ProjectAction =
  | { type: "UPDATE_FILE"; payload: { path: string; content: string } }
  | { type: "CREATE_FILE"; payload: { path: string; content: string } }
  | { type: "DELETE_FILE"; payload: { path: string } }
  | { type: "SET_ACTIVE_FILE"; payload: { path: string } }
  | { type: "CREATE_CHECKPOINT"; payload: { label: string } }
  | { type: "RESTORE_CHECKPOINT"; payload: { checkpointId: string } }
  | {
      type: "RESTORE_CHECKPOINT_WITH_FILES";
      payload: { files: Record<string, string>; checkpointIndex: number };
    }
  | { type: "SET_LIBRARY_PREFERENCE"; payload: { library: LibraryType } }
  | { type: "UPDATE_SERVER_STATUS"; payload: { status: ServerStatus } }
  | { type: "ADD_CONSOLE_LOG"; payload: { log: ConsoleLog } }
  | { type: "CLEAR_CONSOLE" }
  | { type: "SET_TEMPLATE"; payload: { template: TemplateType } }
  | { type: "SET_MODE"; payload: { mode: LayoutMode } };

// ============================================================================
// Initial State
// ============================================================================

const initialState: ProjectState = {
  files: {},
  activeFile: null,
  template: "vite-react",
  serverStatus: "stopped",
  historyStack: [],
  currentCheckpointIndex: -1,
  libraryPreference: "tailwind",
  consoleOutput: [],
  mode: "chat",
};

// ============================================================================
// Reducer
// ============================================================================

function projectReducer(
  state: ProjectState,
  action: ProjectAction,
): ProjectState {
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
        id: nanoid(),
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

    case "RESTORE_CHECKPOINT_WITH_FILES": {
      const { files, checkpointIndex } = action.payload;
      return {
        ...state,
        files: { ...files },
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

    case "ADD_CONSOLE_LOG": {
      return {
        ...state,
        consoleOutput: [...state.consoleOutput, action.payload.log],
      };
    }

    case "CLEAR_CONSOLE": {
      return {
        ...state,
        consoleOutput: [],
      };
    }

    case "SET_TEMPLATE": {
      return {
        ...state,
        template: action.payload.template,
      };
    }

    case "SET_MODE": {
      return {
        ...state,
        mode: action.payload.mode,
      };
    }

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined,
);

// ============================================================================
// Provider Component
// ============================================================================

interface ProjectProviderProps {
  children: React.ReactNode;
  initialState?: Partial<ProjectState>;
}

export function ProjectProvider({
  children,
  initialState: customInitialState,
}: ProjectProviderProps) {
  // Load library preference from storage on mount
  const loadedLibraryPreference =
    typeof window !== "undefined" ? loadLibraryPreference() : null;

  const [state, dispatch] = useReducer(
    projectReducer,
    customInitialState
      ? { ...initialState, ...customInitialState }
      : loadedLibraryPreference
        ? { ...initialState, libraryPreference: loadedLibraryPreference }
        : initialState,
  );

  // Persist library preference to storage when it changes
  useEffect(() => {
    saveLibraryPreference(state.libraryPreference);
  }, [state.libraryPreference]);

  // Memoized actions to prevent unnecessary re-renders
  const actions: ProjectActions = useMemo(
    () => ({
      updateFile: (path: string, content: string) => {
        dispatch({ type: "UPDATE_FILE", payload: { path, content } });
      },

      createFile: (path: string, content: string) => {
        dispatch({ type: "CREATE_FILE", payload: { path, content } });
      },

      deleteFile: (path: string) => {
        dispatch({ type: "DELETE_FILE", payload: { path } });
      },

      setActiveFile: (path: string) => {
        dispatch({ type: "SET_ACTIVE_FILE", payload: { path } });
      },

      createCheckpoint: (label: string) => {
        dispatch({ type: "CREATE_CHECKPOINT", payload: { label } });
      },

      restoreCheckpoint: (checkpointId: string) => {
        dispatch({ type: "RESTORE_CHECKPOINT", payload: { checkpointId } });
      },

      setLibraryPreference: (library: LibraryType) => {
        dispatch({ type: "SET_LIBRARY_PREFERENCE", payload: { library } });
      },

      updateServerStatus: (status: ServerStatus) => {
        dispatch({ type: "UPDATE_SERVER_STATUS", payload: { status } });
      },

      setMode: (mode: LayoutMode) => {
        dispatch({ type: "SET_MODE", payload: { mode } });
      },
    }),
    [],
  );

  // Additional helper actions (not in ProjectActions interface but useful)
  const addConsoleLog = useCallback((log: ConsoleLog) => {
    dispatch({ type: "ADD_CONSOLE_LOG", payload: { log } });
  }, []);

  const clearConsole = useCallback(() => {
    dispatch({ type: "CLEAR_CONSOLE" });
  }, []);

  const setTemplate = useCallback((template: TemplateType) => {
    dispatch({ type: "SET_TEMPLATE", payload: { template } });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      state,
      actions,
      // Additional helpers
      addConsoleLog,
      clearConsole,
      setTemplate,
    }),
    [state, actions, addConsoleLog, clearConsole, setTemplate],
  );

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

// ============================================================================
// Selector Hooks (for optimized re-renders)
// ============================================================================

/**
 * Hook to access only the files state
 * Prevents re-renders when other state changes
 */
export function useProjectFiles() {
  const { state } = useProject();
  return state.files;
}

/**
 * Hook to access only the active file
 */
export function useActiveFile() {
  const { state } = useProject();
  return state.activeFile;
}

/**
 * Hook to access only the server status
 */
export function useServerStatus() {
  const { state } = useProject();
  return state.serverStatus;
}

/**
 * Hook to access only the history stack
 */
export function useHistoryStack() {
  const { state } = useProject();
  return state.historyStack;
}

/**
 * Hook to access only the console output
 */
export function useConsoleOutput() {
  const { state } = useProject();
  return state.consoleOutput;
}

/**
 * Hook to access only the library preference
 */
export function useLibraryPreference() {
  const { state } = useProject();
  return state.libraryPreference;
}

/**
 * Hook to access only the template
 */
export function useTemplate() {
  const { state } = useProject();
  return state.template;
}

/**
 * Hook to access only the mode
 */
export function useMode() {
  const { state } = useProject();
  return state.mode;
}

/**
 * Hook to access only the actions
 */
export function useProjectActions() {
  const { actions } = useProject();
  return actions;
}
