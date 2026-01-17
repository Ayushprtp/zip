/**
 * SandpackController - Provides server control methods for Sandpack
 * Manages server lifecycle: start, stop, restart
 */

import type { ServerStatus } from "@/types/builder";

export interface ServerControl {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  getStatus: () => ServerStatus;
}

export interface ServerControlCallbacks {
  onStatusChange?: (status: ServerStatus) => void;
  onError?: (error: Error) => void;
}

/**
 * Creates a server controller with the given callbacks
 */
export function createServerController(
  sandpackActions: {
    resetAllFiles: () => void;
  },
  callbacks: ServerControlCallbacks = {},
): ServerControl {
  let currentStatus: ServerStatus = "stopped";

  const updateStatus = (status: ServerStatus) => {
    currentStatus = status;
    callbacks.onStatusChange?.(status);
  };

  return {
    /**
     * Start the development server
     * Transitions: stopped -> booting -> running
     */
    start: async () => {
      try {
        if (currentStatus === "running") {
          return; // Already running
        }

        updateStatus("booting");

        // Sandpack auto-starts, so we just need to track the status
        // Wait for the server to boot
        await new Promise((resolve) => setTimeout(resolve, 1000));

        updateStatus("running");
      } catch (error) {
        updateStatus("error");
        callbacks.onError?.(error as Error);
        throw error;
      }
    },

    /**
     * Stop the development server
     * Transitions: running -> stopped
     */
    stop: async () => {
      try {
        if (currentStatus === "stopped") {
          return; // Already stopped
        }

        updateStatus("stopped");
      } catch (error) {
        updateStatus("error");
        callbacks.onError?.(error as Error);
        throw error;
      }
    },

    /**
     * Restart the development server
     * Transitions: running -> booting -> running
     */
    restart: async () => {
      try {
        updateStatus("booting");

        // Force a restart by resetting all files
        sandpackActions.resetAllFiles();

        // Wait for the server to restart
        await new Promise((resolve) => setTimeout(resolve, 1000));

        updateStatus("running");
      } catch (error) {
        updateStatus("error");
        callbacks.onError?.(error as Error);
        throw error;
      }
    },

    /**
     * Get the current server status
     */
    getStatus: () => currentStatus,
  };
}

/**
 * Server status transition validator
 * Ensures state transitions are valid
 */
export function isValidTransition(
  from: ServerStatus,
  to: ServerStatus,
): boolean {
  const validTransitions: Record<ServerStatus, ServerStatus[]> = {
    stopped: ["booting"],
    booting: ["running", "error", "stopped"],
    running: ["booting", "stopped", "error"],
    error: ["booting", "stopped"],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Get the expected next status after an action
 */
export function getExpectedStatus(
  currentStatus: ServerStatus,
  action: "start" | "stop" | "restart",
): ServerStatus {
  switch (action) {
    case "start":
      return currentStatus === "stopped" ? "booting" : currentStatus;
    case "stop":
      return "stopped";
    case "restart":
      return "booting";
    default:
      return currentStatus;
  }
}
