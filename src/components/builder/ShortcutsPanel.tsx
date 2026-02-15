"use client";

export function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: "Ctrl + S", description: "Save File" },
    { key: "Ctrl + P", description: "Quick Open / Search" },
    { key: "Ctrl + B", description: "Toggle Sidebar" },
    { key: "Ctrl + `", description: "Toggle Terminal" },
    { key: "Ctrl + Shift + F", description: "Search in Files" },
    { key: "Shift + Alt + F", description: "Format Document" },
    { key: "Ctrl + W", description: "Close Tab" },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Keyboard Shortcuts
        </span>
        <button
          onClick={onClose}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-1">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
            >
              <span className="text-xs text-muted-foreground">
                {shortcut.description}
              </span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
