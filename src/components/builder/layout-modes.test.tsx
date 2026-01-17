/**
 * Unit Tests for Layout Modes
 * Tests ChatMode and BuilderMode rendering
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ChatMode } from "./chat-mode";
import { BuilderMode } from "./builder-mode";
import { ProjectProvider } from "@/lib/builder/project-context";

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock child components to simplify testing
vi.mock("./chat-interface", () => ({
  ChatInterface: ({ condensed }: { condensed?: boolean }) => (
    <div data-testid="chat-interface" data-condensed={condensed}>
      Chat Interface {condensed && "(Condensed)"}
    </div>
  ),
}));

vi.mock("./monaco-editor", () => ({
  MonacoEditor: () => <div data-testid="monaco-editor">Monaco Editor</div>,
}));

vi.mock("./sandpack-wrapper", () => ({
  SandpackWrapper: () => (
    <div data-testid="sandpack-wrapper">Sandpack Preview</div>
  ),
}));

vi.mock("./timeline-sidebar", () => ({
  TimelineSidebar: () => (
    <div data-testid="timeline-sidebar">Timeline Sidebar</div>
  ),
}));

// ============================================================================
// ChatMode Tests
// ============================================================================

describe("ChatMode", () => {
  it("should display chat interface only", () => {
    render(
      <ProjectProvider>
        <ChatMode />
      </ProjectProvider>,
    );

    // Chat interface should be visible
    expect(screen.getByTestId("chat-interface")).toBeInTheDocument();

    // Code editor and preview should NOT be visible
    expect(screen.queryByTestId("monaco-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sandpack-wrapper")).not.toBeInTheDocument();
  });

  it("should render chat interface in full-screen mode", () => {
    render(
      <ProjectProvider>
        <ChatMode />
      </ProjectProvider>,
    );

    const chatInterface = screen.getByTestId("chat-interface");
    expect(chatInterface).toBeInTheDocument();

    // Chat should not be condensed in ChatMode (condensed prop not passed or false)
    const condensedAttr = chatInterface.getAttribute("data-condensed");
    expect(condensedAttr === null || condensedAttr === "false").toBe(true);
  });

  it("should hide timeline sidebar in ChatMode", () => {
    render(
      <ProjectProvider>
        <ChatMode />
      </ProjectProvider>,
    );

    // Timeline sidebar should NOT be visible in ChatMode
    expect(screen.queryByTestId("timeline-sidebar")).not.toBeInTheDocument();
  });
});

// ============================================================================
// BuilderMode Tests
// ============================================================================

describe("BuilderMode", () => {
  it("should display three-pane layout", () => {
    render(
      <ProjectProvider>
        <BuilderMode />
      </ProjectProvider>,
    );

    // All three panes should be visible
    expect(screen.getByTestId("chat-interface")).toBeInTheDocument();
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
    expect(screen.getByTestId("sandpack-wrapper")).toBeInTheDocument();
  });

  it("should render condensed chat in left pane", () => {
    render(
      <ProjectProvider>
        <BuilderMode />
      </ProjectProvider>,
    );

    const chatInterface = screen.getByTestId("chat-interface");
    expect(chatInterface).toBeInTheDocument();

    // Chat should be condensed in BuilderMode
    expect(chatInterface.getAttribute("data-condensed")).toBe("true");
  });

  it("should render Monaco editor in center pane", () => {
    render(
      <ProjectProvider>
        <BuilderMode />
      </ProjectProvider>,
    );

    const editor = screen.getByTestId("monaco-editor");
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveTextContent("Monaco Editor");
  });

  it("should render preview iframe in right pane", () => {
    render(
      <ProjectProvider>
        <BuilderMode />
      </ProjectProvider>,
    );

    const preview = screen.getByTestId("sandpack-wrapper");
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveTextContent("Sandpack Preview");
  });

  it("should display timeline sidebar by default", () => {
    render(
      <ProjectProvider>
        <BuilderMode />
      </ProjectProvider>,
    );

    expect(screen.getByTestId("timeline-sidebar")).toBeInTheDocument();
  });

  it("should hide timeline sidebar when showTimeline is false", () => {
    render(
      <ProjectProvider>
        <BuilderMode showTimeline={false} />
      </ProjectProvider>,
    );

    expect(screen.queryByTestId("timeline-sidebar")).not.toBeInTheDocument();
  });
});

// ============================================================================
// Mode Toggle Integration Tests
// ============================================================================

describe("Mode Toggle Integration", () => {
  it("should switch from ChatMode to BuilderMode correctly", () => {
    const { rerender } = render(
      <ProjectProvider>
        <ChatMode />
      </ProjectProvider>,
    );

    // Initially in ChatMode
    expect(screen.getByTestId("chat-interface")).toBeInTheDocument();
    expect(screen.queryByTestId("monaco-editor")).not.toBeInTheDocument();

    // Switch to BuilderMode
    rerender(
      <ProjectProvider>
        <BuilderMode />
      </ProjectProvider>,
    );

    // Now all three panes should be visible
    expect(screen.getByTestId("chat-interface")).toBeInTheDocument();
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
    expect(screen.getByTestId("sandpack-wrapper")).toBeInTheDocument();
  });

  it("should switch from BuilderMode to ChatMode correctly", () => {
    const { rerender } = render(
      <ProjectProvider>
        <BuilderMode />
      </ProjectProvider>,
    );

    // Initially in BuilderMode
    expect(screen.getByTestId("chat-interface")).toBeInTheDocument();
    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
    expect(screen.getByTestId("sandpack-wrapper")).toBeInTheDocument();

    // Switch to ChatMode
    rerender(
      <ProjectProvider>
        <ChatMode />
      </ProjectProvider>,
    );

    // Now only chat should be visible
    expect(screen.getByTestId("chat-interface")).toBeInTheDocument();
    expect(screen.queryByTestId("monaco-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sandpack-wrapper")).not.toBeInTheDocument();
  });
});
