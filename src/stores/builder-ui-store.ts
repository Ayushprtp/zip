import { create } from "zustand";

type ViewMode = "code" | "preview" | "split";
type ServerStatus = "idle" | "running" | "booting" | "error";
type ServerControl = {
  start: () => void;
  stop: () => void;
  restart: () => void;
} | null;
type BottomPanel = "none" | "console" | "terminal" | "report" | "ssh";
type SidebarPanel = "files" | "source-control" | "search";

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

  // Terminal state
  showTerminal: boolean;
  setShowTerminal: (show: boolean) => void;
  toggleTerminal: () => void;

  // Report panel state
  showReport: boolean;
  setShowReport: (show: boolean) => void;
  toggleReport: () => void;

  // SSH panel state
  showSSH: boolean;
  setShowSSH: (show: boolean) => void;
  toggleSSH: () => void;

  // Bottom panel (unified: console, terminal, report, or ssh)
  bottomPanel: BottomPanel;
  setBottomPanel: (panel: BottomPanel) => void;
  bottomPanelMaximized: boolean;
  toggleBottomPanelMaximized: () => void;

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

  // Sidebar panel state (files / source-control / search)
  sidebarPanel: SidebarPanel;
  setSidebarPanel: (panel: SidebarPanel) => void;

  // Active file tracking for status bar
  activeFilePath: string | null;
  setActiveFilePath: (path: string | null) => void;
  cursorPosition: { line: number; col: number };
  setCursorPosition: (pos: { line: number; col: number }) => void;
  selectionCount: number;
  setSelectionCount: (count: number) => void;
}

export const useBuilderUIStore = create<BuilderUIStore>((set, get) => ({
  // Initial state
  viewMode: "split",
  serverStatus: "running",
  showConsole: false,
  showTerminal: false,
  showReport: false,
  showSSH: false,
  bottomPanel: "none",
  bottomPanelMaximized: false,
  mobilePreview: false,
  serverControl: null,
  isSynced: true,
  sidebarPanel: "files",
  activeFilePath: null,
  cursorPosition: { line: 1, col: 1 },
  selectionCount: 0,

  // View mode
  setViewMode: (mode) => set({ viewMode: mode }),

  // Server status
  setServerStatus: (status) => set({ serverStatus: status }),

  // Console
  setShowConsole: (show) =>
    set({ showConsole: show, bottomPanel: show ? "console" : "none" }),
  toggleConsole: () => {
    const { bottomPanel } = get();
    if (bottomPanel === "console") {
      set({ showConsole: false, bottomPanel: "none" });
    } else {
      set({
        showConsole: true,
        showTerminal: false,
        showReport: false,
        showSSH: false,
        bottomPanel: "console",
      });
    }
  },

  // Terminal
  setShowTerminal: (show) =>
    set({ showTerminal: show, bottomPanel: show ? "terminal" : "none" }),
  toggleTerminal: () => {
    const { bottomPanel } = get();
    if (bottomPanel === "terminal") {
      set({ showTerminal: false, bottomPanel: "none" });
    } else {
      set({
        showTerminal: true,
        showConsole: false,
        showReport: false,
        showSSH: false,
        bottomPanel: "terminal",
      });
    }
  },

  // Report
  setShowReport: (show) =>
    set({ showReport: show, bottomPanel: show ? "report" : "none" }),
  toggleReport: () => {
    const { bottomPanel } = get();
    if (bottomPanel === "report") {
      set({ showReport: false, bottomPanel: "none" });
    } else {
      set({
        showReport: true,
        showConsole: false,
        showTerminal: false,
        showSSH: false,
        bottomPanel: "report",
      });
    }
  },

  // SSH
  setShowSSH: (show) =>
    set({ showSSH: show, bottomPanel: show ? "ssh" : "none" }),
  toggleSSH: () => {
    const { bottomPanel } = get();
    if (bottomPanel === "ssh") {
      set({ showSSH: false, bottomPanel: "none" });
    } else {
      set({
        showSSH: true,
        showConsole: false,
        showTerminal: false,
        showReport: false,
        bottomPanel: "ssh",
      });
    }
  },

  // Bottom panel
  setBottomPanel: (panel) => {
    set({
      bottomPanel: panel,
      showConsole: panel === "console",
      showTerminal: panel === "terminal",
      showReport: panel === "report",
      showSSH: panel === "ssh",
    });
  },
  toggleBottomPanelMaximized: () =>
    set((state) => ({ bottomPanelMaximized: !state.bottomPanelMaximized })),

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

  // Sidebar panel
  setSidebarPanel: (panel) => set({ sidebarPanel: panel }),

  // Active file for status bar
  setActiveFilePath: (path) => set({ activeFilePath: path }),
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  setSelectionCount: (count) => set({ selectionCount: count }),
}));
