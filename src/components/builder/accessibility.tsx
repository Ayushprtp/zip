"use client";

/**
 * Accessibility utilities and components for the AI Builder IDE
 */

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================================
// Skip Links
// ============================================================================

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-4 left-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <a
        href="#chat-interface"
        className="fixed top-4 left-40 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to chat
      </a>
      <a
        href="#code-editor"
        className="fixed top-4 left-72 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to editor
      </a>
    </div>
  );
}

// ============================================================================
// Keyboard Navigation Hook
// ============================================================================

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch =
          shortcut.ctrlKey === undefined || shortcut.ctrlKey === event.ctrlKey;
        const shiftMatch =
          shortcut.shiftKey === undefined ||
          shortcut.shiftKey === event.shiftKey;
        const altMatch =
          shortcut.altKey === undefined || shortcut.altKey === event.altKey;
        const metaMatch =
          shortcut.metaKey === undefined || shortcut.metaKey === event.metaKey;
        const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

// ============================================================================
// Focus Management
// ============================================================================

/**
 * Hook to trap focus within a container (for modals, dialogs)
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element when trap activates
    firstElement?.focus();

    container.addEventListener("keydown", handleTabKey);
    return () => container.removeEventListener("keydown", handleTabKey);
  }, [containerRef, active]);
}

/**
 * Hook to restore focus when a component unmounts
 */
export function useFocusRestore() {
  const previousActiveElement = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;

    return () => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, []);
}

// ============================================================================
// ARIA Live Region
// ============================================================================

interface LiveRegionProps {
  message: string;
  politeness?: "polite" | "assertive" | "off";
  atomic?: boolean;
}

export function LiveRegion({
  message,
  politeness = "polite",
  atomic = true,
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className="sr-only"
    >
      {message}
    </div>
  );
}

// ============================================================================
// Accessible Button
// ============================================================================

interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  loading?: boolean;
  loadingText?: string;
}

export function AccessibleButton({
  label,
  loading,
  loadingText = "Loading",
  children,
  ...props
}: AccessibleButtonProps) {
  return (
    <button
      aria-label={label}
      aria-busy={loading}
      aria-disabled={loading || props.disabled}
      {...props}
    >
      {children}
      {loading && <span className="sr-only">{loadingText}</span>}
    </button>
  );
}

// ============================================================================
// Accessible Icon Button
// ============================================================================

interface AccessibleIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: React.ReactNode;
}

export function AccessibleIconButton({
  label,
  icon,
  ...props
}: AccessibleIconButtonProps) {
  return (
    <button aria-label={label} title={label} {...props}>
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}

// ============================================================================
// Accessible Form Field
// ============================================================================

interface AccessibleFormFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}

export function AccessibleFormField({
  id,
  label,
  error,
  required,
  description,
  children,
}: AccessibleFormFieldProps) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      <div>
        {React.cloneElement(children as React.ReactElement, {
          id,
          "aria-invalid": !!error,
          "aria-describedby":
            [description ? descriptionId : null, error ? errorId : null]
              .filter(Boolean)
              .join(" ") || undefined,
          "aria-required": required,
        })}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Accessible Tabs
// ============================================================================

interface AccessibleTabsProps {
  tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function AccessibleTabs({
  tabs,
  activeTab,
  onTabChange,
}: AccessibleTabsProps) {
  return (
    <div>
      <div role="tablist" className="flex border-b">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                const nextIndex = (index + 1) % tabs.length;
                onTabChange(tabs[nextIndex].id);
              } else if (e.key === "ArrowLeft") {
                const prevIndex = (index - 1 + tabs.length) % tabs.length;
                onTabChange(tabs[prevIndex].id);
              }
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          tabIndex={0}
          className="p-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Accessible Dialog
// ============================================================================

interface AccessibleDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function AccessibleDialog({
  open,
  onClose,
  title,
  description,
  children,
}: AccessibleDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, open);
  useFocusRestore();

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-description" : undefined}
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title" className="text-lg font-semibold mb-2">
          {title}
        </h2>
        {description && (
          <p
            id="dialog-description"
            className="text-sm text-muted-foreground mb-4"
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Screen Reader Only Text
// ============================================================================

export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

// ============================================================================
// Accessible Status Badge
// ============================================================================

interface AccessibleStatusBadgeProps {
  status: "success" | "error" | "warning" | "info";
  label: string;
}

export function AccessibleStatusBadge({
  status,
  label,
}: AccessibleStatusBadgeProps) {
  const statusColors = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  };

  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium text-white ${statusColors[status]}`}
    >
      <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />
      {label}
    </span>
  );
}

// ============================================================================
// Keyboard Shortcuts Help
// ============================================================================

interface KeyboardShortcutsHelpProps {
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

export function KeyboardShortcutsHelp({
  shortcuts,
}: KeyboardShortcutsHelpProps) {
  return (
    <div role="region" aria-label="Keyboard shortcuts">
      <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
      <dl className="space-y-2">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">
              {shortcut.description}
            </dt>
            <dd className="flex items-center gap-1">
              {shortcut.keys.map((key, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-muted-foreground">+</span>}
                  <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                    {key}
                  </kbd>
                </React.Fragment>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
