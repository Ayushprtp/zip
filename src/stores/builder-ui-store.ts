import { create } from "zustand";

type ViewMode = "code" | "preview" | "split";
type ServerStatus = "idle" | "running" | "booting" | "error";
type ServerControl = { start: () => void; stop: () => void; restart: () => void } | null;

interface BuilderUIStore {
  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Server state
  serverStatus: ServerStatus;
  setServerStatus: (status: ServerStatus) => void;

  // Console state
  showConsole: boolean;
  setShowConsole: (show: boolean) => void;
  toggleConsole: () => void;

  // Mobile preview state
  mobilePreview: boolean;
  setMobilePreview: (mobile: boolean) => void;
  toggleMobilePreview: () => void;

  // Server control reference (set by Sandpack)
  serverControl: ServerControl;
  setServerControl: (control: ServerControl) => void;

  // Server controls (these will use the actual Sandpack server)
  startServer: () => void;
  stopServer: () => void;
  restartServer: () => void;

  // File sync status
  isSynced: boolean;
  setIsSynced: (synced: boolean) => void;
}

export const useBuilderUIStore = create<BuilderUIStore>((set, get) => ({
  // Initial state
  viewMode: "split",
  serverStatus: "running",
  showConsole: false,
  mobilePreview: false,
  serverControl: null,
  isSynced: true,

  // View mode
  setViewMode: (mode) => set({ viewMode: mode }),

  // Server status
  setServerStatus: (status) => set({ serverStatus: status }),

  // Console
  setShowConsole: (show) => set({ showConsole: show }),
  toggleConsole: () => set((state) => ({ showConsole: !state.showConsole })),

  // Mobile preview
  setMobilePreview: (mobile) => set({ mobilePreview: mobile }),
  toggleMobilePreview: () =>
    set((state) => ({ mobilePreview: !state.mobilePreview })),

  // Server control
  setServerControl: (control) => set({ serverControl: control }),

  // Server controls - use actual Sandpack server
  startServer: () => {
    const { serverControl } = get();
    if (serverControl) {
      set({ serverStatus: "booting" });
      serverControl.start();
      setTimeout(() => {
        set({ serverStatus: "running" });
      }, 1000);
    }
  },

  stopServer: () => {
    const { serverControl } = get();
    if (serverControl) {
      serverControl.stop();
      set({ serverStatus: "idle" });
    }
  },

  restartServer: () => {
    const { serverControl } = get();
    if (serverControl) {
      set({ serverStatus: "booting" });
      serverControl.restart();
      setTimeout(() => {
        set({ serverStatus: "running" });
      }, 1000);
    }
  },

  // File sync
  setIsSynced: (synced) => {
    // Only update if value actually changed
    const currentState = get();
    if (currentState.isSynced !== synced) {
      set({ isSynced: synced });
    }
  },
}));
