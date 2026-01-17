import { create } from "zustand";
import type {
  BuilderThread,
  BuilderMessage,
  BuilderFile,
} from "@/db/schema/builder";

interface BuilderStore {
  // State
  threads: BuilderThread[];
  currentThreadId: string | null;
  currentThread: BuilderThread | null;
  messages: BuilderMessage[];
  files: Record<string, string>; // filePath -> content
  isLoading: boolean;

  // Actions
  setThreads: (threads: BuilderThread[]) => void;
  setCurrentThreadId: (threadId: string | null) => void;
  setCurrentThread: (thread: BuilderThread | null) => void;
  setMessages: (messages: BuilderMessage[]) => void;
  setFiles: (files: Record<string, string>) => void;
  setIsLoading: (loading: boolean) => void;

  // Async actions
  loadThreads: () => Promise<void>;
  createThread: (template: string, title?: string) => Promise<string>;
  loadThread: (threadId: string) => Promise<void>;
  updateThreadTitle: (threadId: string, title: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  addMessage: (
    threadId: string,
    role: string,
    content: string,
    mentions?: any[],
  ) => Promise<void>;
  saveFile: (
    threadId: string,
    filePath: string,
    fileContent: string,
  ) => Promise<void>;
  deleteFile: (threadId: string, filePath: string) => Promise<void>;
  reset: () => void;
}

export const useBuilderStore = create<BuilderStore>((set, _get) => ({
  // Initial state
  threads: [],
  currentThreadId: null,
  currentThread: null,
  messages: [],
  files: {},
  isLoading: false,

  // Setters
  setThreads: (threads) => set({ threads }),
  setCurrentThreadId: (threadId) => set({ currentThreadId: threadId }),
  setCurrentThread: (thread) => set({ currentThread: thread }),
  setMessages: (messages) => set({ messages }),
  setFiles: (files) => set({ files }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  // Load all threads
  loadThreads: async () => {
    try {
      const response = await fetch("/api/builder/threads");

      // If redirected to sign-in, user is not authenticated - silently fail
      if (
        response.redirected ||
        response.status === 307 ||
        response.status === 401
      ) {
        set({ threads: [] });
        return;
      }

      if (!response.ok) throw new Error("Failed to load threads");
      const data = await response.json();
      set({ threads: data.threads || [] });
    } catch (error) {
      console.error("Error loading threads:", error);
      set({ threads: [] });
    }
  },

  // Create new thread
  createThread: async (template: string, title?: string) => {
    try {
      const response = await fetch("/api/builder/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, title: title || "Untitled Project" }),
      });

      if (!response.ok) throw new Error("Failed to create thread");

      const data = await response.json();
      const newThread = data.thread;

      set((state) => ({
        threads: [newThread, ...state.threads],
        currentThreadId: newThread.id,
        currentThread: newThread,
        messages: [],
        files: {},
      }));

      return newThread.id;
    } catch (error) {
      console.error("Error creating thread:", error);
      throw error;
    }
  },

  // Load specific thread with messages and files
  loadThread: async (threadId: string) => {
    try {
      set({ isLoading: true });

      const response = await fetch(`/api/builder/threads/${threadId}`);
      if (!response.ok) throw new Error("Failed to load thread");

      const data = await response.json();

      // Convert files array to object
      const filesObj: Record<string, string> = {};
      data.files.forEach((file: BuilderFile) => {
        filesObj[file.filePath] = file.fileContent;
      });

      set({
        currentThreadId: threadId,
        currentThread: data.thread,
        messages: data.messages,
        files: filesObj,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error loading thread:", error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Update thread title
  updateThreadTitle: async (threadId: string, title: string) => {
    try {
      const response = await fetch(`/api/builder/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) throw new Error("Failed to update thread");

      const data = await response.json();

      set((state) => ({
        threads: state.threads.map((t) =>
          t.id === threadId ? data.thread : t,
        ),
        currentThread:
          state.currentThreadId === threadId
            ? data.thread
            : state.currentThread,
      }));
    } catch (error) {
      console.error("Error updating thread:", error);
      throw error;
    }
  },

  // Delete thread
  deleteThread: async (threadId: string) => {
    try {
      const response = await fetch(`/api/builder/threads/${threadId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete thread");

      set((state) => ({
        threads: state.threads.filter((t) => t.id !== threadId),
        currentThreadId:
          state.currentThreadId === threadId ? null : state.currentThreadId,
        currentThread:
          state.currentThreadId === threadId ? null : state.currentThread,
      }));
    } catch (error) {
      console.error("Error deleting thread:", error);
      throw error;
    }
  },

  // Add message
  addMessage: async (
    threadId: string,
    role: string,
    content: string,
    mentions = [],
  ) => {
    try {
      const response = await fetch(
        `/api/builder/threads/${threadId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, content, mentions }),
        },
      );

      if (!response.ok) throw new Error("Failed to add message");

      const data = await response.json();

      set((state) => ({
        messages: [...state.messages, data.message],
      }));
    } catch (error) {
      console.error("Error adding message:", error);
      throw error;
    }
  },

  // Save file
  saveFile: async (threadId: string, filePath: string, fileContent: string) => {
    try {
      const response = await fetch(`/api/builder/threads/${threadId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, fileContent }),
      });

      if (!response.ok) throw new Error("Failed to save file");

      set((state) => ({
        files: { ...state.files, [filePath]: fileContent },
      }));
    } catch (error) {
      console.error("Error saving file:", error);
      throw error;
    }
  },

  // Delete file
  deleteFile: async (threadId: string, filePath: string) => {
    try {
      const response = await fetch(
        `/api/builder/threads/${threadId}/files?filePath=${encodeURIComponent(filePath)}`,
        { method: "DELETE" },
      );

      if (!response.ok) throw new Error("Failed to delete file");

      set((state) => {
        const newFiles = { ...state.files };
        delete newFiles[filePath];
        return { files: newFiles };
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  },

  // Reset store
  reset: () =>
    set({
      threads: [],
      currentThreadId: null,
      currentThread: null,
      messages: [],
      files: {},
      isLoading: false,
    }),
}));
