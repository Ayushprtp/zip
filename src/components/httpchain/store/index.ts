import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HttpChain, Step } from "../types/schema";
import type { ChainMeta, ChainFull } from "../types/chain";
import * as storage from "../services/storage";
import { createEmptyStep, generateUUID } from "../types/schema";
import { toast } from "../lib/toast";

// Types
type Theme = "light" | "dark";

interface AppState {
  // Backend URL for workflow execution (optional, set when needed)
  backendUrl: string | null;
  setBackendUrl: (url: string | null) => void;

  // Backend dialog dismissed (resets on refresh)
  backendDialogDismissed: boolean;
  setBackendDialogDismissed: (dismissed: boolean) => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Chains list
  chains: ChainMeta[];
  chainsLoaded: boolean;
  loadChains: () => Promise<void>;
  createChain: (name: string) => Promise<ChainFull | null>;
  deleteChain: (id: string) => Promise<void>;
  deleteAllChains: () => Promise<void>;

  // Selected Chain
  selectedChainId: string | null;
  setSelectedChainId: (id: string | null) => void;
  clearSelection: () => void;

  // Current Workflow (the chain being edited)
  chainId: string | null;
  workflow: HttpChain | null;
  chainUpdatedAt: string | null;
  chainTags: string[] | null;
  isLoading: boolean;
  isSaving: boolean;

  // Step Detail View
  selectedStepNodeId: string | null;
  setSelectedStepNodeId: (nodeId: string | null) => void;
  selectedStepTab: string | null;
  setSelectedStepTab: (tab: string | null) => void;

  // Workflow Actions
  loadWorkflow: (chainId: string) => Promise<void>;
  addInputVariable: (variableName: string) => Promise<void>;
  addStep: (step?: Partial<Step>) => Promise<void>;
  updateStep: (nodeId: string, updates: Partial<Step>) => Promise<void>;
  updateChainName: (name: string) => Promise<void>;
  updateChainTags: (tags: string[]) => Promise<void>;
  removeInputVariable: (variableName: string) => Promise<void>;
  removeStep: (nodeId: string) => Promise<void>;
  clearWorkflow: () => void;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const saved = localStorage.getItem("theme") as Theme | null;
  if (saved === "dark" || saved === "light") return saved;

  // Auto-detect system preference
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Backend URL for workflow execution (optional)
      backendUrl: null,
      setBackendUrl: (url) => set({ backendUrl: url }),

      // Backend dialog dismissed (resets on refresh)
      backendDialogDismissed: false,
      setBackendDialogDismissed: (dismissed) =>
        set({ backendDialogDismissed: dismissed }),

      // Chains list
      chains: [],
      chainsLoaded: false,
      loadChains: async () => {
        const chains = await storage.getChainsMeta();
        set({ chains, chainsLoaded: true });
      },
      createChain: async (name: string) => {
        try {
          const newChain = await storage.createChain(name);
          const chains = await storage.getChainsMeta();
          set({ chains });
          return newChain;
        } catch (error) {
          toast.error(
            "Failed to create chain",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
          return null;
        }
      },
      deleteChain: async (id: string) => {
        try {
          await storage.deleteChain(id);
          const chains = await storage.getChainsMeta();
          set({ chains });
        } catch (error) {
          toast.error(
            "Failed to delete chain",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
        }
      },
      deleteAllChains: async () => {
        try {
          await storage.deleteAllChains();
          set({ chains: [] });
        } catch (error) {
          toast.error(
            "Failed to delete chains",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
        }
      },

      // Theme state
      theme: getInitialTheme(),
      setTheme: (theme) => {
        set({ theme });
        if (typeof window !== "undefined") {
          localStorage.setItem("theme", theme);
          document.documentElement.classList.toggle("dark", theme === "dark");
        }
      },
      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        set({ theme: newTheme });
        if (typeof window !== "undefined") {
          localStorage.setItem("theme", newTheme);
          document.documentElement.classList.toggle(
            "dark",
            newTheme === "dark",
          );
        }
      },

      // Selected chain state
      selectedChainId: null,
      setSelectedChainId: (id) => set({ selectedChainId: id }),
      clearSelection: () => set({ selectedChainId: null }),

      // Workflow state
      chainId: null,
      workflow: null,
      chainUpdatedAt: null,
      chainTags: null,
      isLoading: false,
      isSaving: false,

      // Step Detail View state
      selectedStepNodeId: null,
      setSelectedStepNodeId: (nodeId) => set({ selectedStepNodeId: nodeId }),
      selectedStepTab: null,
      setSelectedStepTab: (tab) => set({ selectedStepTab: tab }),

      // UI state

      // Workflow actions
      loadWorkflow: async (chainId: string) => {
        set({ isLoading: true });
        try {
          const data = await storage.getChain(chainId);
          const steps = (data.steps || []).map(
            (step: any): Step => ({
              ...step,
              node_id: step.node_id || generateUUID(),
            }),
          );

          const workflow: HttpChain = {
            version: data.version || 1,
            name: data.name || "New Chain",
            steps,
            chain_variables: data.chain_variables || [],
          };

          set({
            chainId,
            workflow,
            chainUpdatedAt: data.updated_at,
            chainTags: data.tags || [],
            isLoading: false,
          });
        } catch (error) {
          toast.error(
            "Failed to load workflow",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
          set({ isLoading: false });
        }
      },

      addInputVariable: async (variableName: string) => {
        const { chainId, workflow } = get();
        if (!chainId || !workflow) return;

        if (workflow.chain_variables.includes(variableName)) {
          toast.warning(
            "Variable already exists",
            `The variable "${variableName}" is already in the workflow.`,
          );
          return;
        }

        const updatedWorkflow: HttpChain = {
          ...workflow,
          chain_variables: [...workflow.chain_variables, variableName],
        };

        set({ workflow: updatedWorkflow, isSaving: true });

        try {
          const response = await storage.updateChain(chainId, {
            name: updatedWorkflow.name,
            steps: updatedWorkflow.steps,
            chain_variables: updatedWorkflow.chain_variables,
          });
          set({
            chainUpdatedAt: response.updated_at,
            chainTags: response.tags,
            isSaving: false,
          });
        } catch (error) {
          toast.error(
            "Failed to save workflow",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
          set({ workflow, isSaving: false });
        }
      },

      addStep: async (stepData?: Partial<Step>) => {
        const { chainId, workflow } = get();
        if (!chainId || !workflow) return;

        const newStep: Step = {
          ...createEmptyStep(),
          name: `Step ${workflow.steps.length + 1}`,
          ...stepData,
        };

        const updatedWorkflow: HttpChain = {
          ...workflow,
          steps: [...workflow.steps, newStep],
        };

        set({ workflow: updatedWorkflow, isSaving: true });

        try {
          const response = await storage.updateChain(chainId, {
            name: updatedWorkflow.name,
            steps: updatedWorkflow.steps,
            chain_variables: updatedWorkflow.chain_variables,
          });
          set({
            chainUpdatedAt: response.updated_at,
            chainTags: response.tags,
            isSaving: false,
          });
        } catch (error) {
          toast.error(
            "Failed to save workflow",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
          set({ workflow, isSaving: false });
        }
      },

      updateStep: async (nodeId: string, updates: Partial<Step>) => {
        const { chainId, workflow } = get();
        if (!chainId || !workflow) return;

        const stepIndex = workflow.steps.findIndex((s) => s.node_id === nodeId);
        if (stepIndex === -1) return;

        const updatedSteps = [...workflow.steps];
        updatedSteps[stepIndex] = {
          ...updatedSteps[stepIndex],
          ...updates,
          node_id: nodeId, // Preserve node_id
        };

        const updatedWorkflow: HttpChain = {
          ...workflow,
          steps: updatedSteps,
        };

        set({ workflow: updatedWorkflow, isSaving: true });

        try {
          const response = await storage.updateChain(chainId, {
            name: updatedWorkflow.name,
            steps: updatedWorkflow.steps,
            chain_variables: updatedWorkflow.chain_variables,
          });
          set({
            chainUpdatedAt: response.updated_at,
            chainTags: response.tags,
            isSaving: false,
          });
        } catch (error) {
          toast.error(
            "Failed to save workflow",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
          set({ workflow, isSaving: false });
        }
      },

      updateChainName: async (name: string) => {
        const { chainId, workflow, chains } = get();
        if (!chainId || !workflow) return;

        const updatedWorkflow: HttpChain = {
          ...workflow,
          name,
        };

        set({ workflow: updatedWorkflow, isSaving: true });

        try {
          const response = await storage.updateChain(chainId, {
            name: updatedWorkflow.name,
            steps: updatedWorkflow.steps,
            chain_variables: updatedWorkflow.chain_variables,
          });
          // Also update chains list
          const updatedChains = chains.map((c) =>
            c.id === chainId
              ? { ...c, name, updated_at: response.updated_at }
              : c,
          );
          set({
            chains: updatedChains,
            chainUpdatedAt: response.updated_at,
            chainTags: response.tags,
            isSaving: false,
          });
        } catch (error) {
          toast.error(
            "Failed to save workflow",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
          set({ workflow, isSaving: false });
        }
      },

      updateChainTags: async (tags: string[]) => {
        const { chainId, chains } = get();
        if (!chainId) return;

        const prevTags = get().chainTags;
        set({ chainTags: tags, isSaving: true });

        try {
          const response = await storage.updateChain(chainId, { tags });
          // Also update chains list
          const updatedChains = chains.map((c) =>
            c.id === chainId
              ? { ...c, tags, updated_at: response.updated_at }
              : c,
          );
          set({
            chains: updatedChains,
            chainUpdatedAt: response.updated_at,
            chainTags: response.tags,
            isSaving: false,
          });
        } catch (error) {
          toast.error(
            "Failed to update tags",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
          set({ chainTags: prevTags, isSaving: false });
        }
      },

      removeInputVariable: async (variableName: string) => {
        const { chainId, workflow } = get();
        if (!chainId || !workflow) return;

        const updatedWorkflow: HttpChain = {
          ...workflow,
          chain_variables: workflow.chain_variables.filter(
            (v) => v !== variableName,
          ),
        };

        set({ workflow: updatedWorkflow, isSaving: true });

        try {
          const response = await storage.updateChain(chainId, {
            name: updatedWorkflow.name,
            steps: updatedWorkflow.steps,
            chain_variables: updatedWorkflow.chain_variables,
          });
          set({
            chainUpdatedAt: response.updated_at,
            chainTags: response.tags,
            isSaving: false,
          });
        } catch (error) {
          toast.error(
            "Failed to save workflow",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
          set({ workflow, isSaving: false });
        }
      },

      removeStep: async (nodeId: string) => {
        const { chainId, workflow } = get();
        if (!chainId || !workflow) return;

        const updatedWorkflow: HttpChain = {
          ...workflow,
          steps: workflow.steps.filter((s) => s.node_id !== nodeId),
        };

        set({ workflow: updatedWorkflow, isSaving: true });

        try {
          const response = await storage.updateChain(chainId, {
            name: updatedWorkflow.name,
            steps: updatedWorkflow.steps,
            chain_variables: updatedWorkflow.chain_variables,
          });
          set({
            chainUpdatedAt: response.updated_at,
            chainTags: response.tags,
            isSaving: false,
          });
        } catch (error) {
          toast.error(
            "Failed to save workflow",
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          );
          set({ workflow, isSaving: false });
        }
      },

      clearWorkflow: () => {
        set({
          chainId: null,
          workflow: null,
          chainUpdatedAt: null,
          chainTags: null,
          isLoading: false,
          isSaving: false,
        });
      },
    }),
    {
      name: "app-store",
      partialize: (state) => ({
        theme: state.theme,
      }),
    },
  ),
);

// Initialize theme on load
if (typeof window !== "undefined") {
  const theme = useAppStore.getState().theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}
