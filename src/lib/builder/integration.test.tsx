/**
 * Integration Test: Chat and Editor Working Together
 *
 * This test verifies that:
 * 1. Chat messages are sent and displayed
 * 2. Context mentions capture correct data
 * 3. AI responses update the file system
 * 4. Monaco editor reflects file changes
 *
 * @vitest-environment jsdom
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterEach,
} from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectProvider, useProject } from "./project-context";
import { ChatInterface } from "@/components/builder/chat-interface";
import { MonacoEditor } from "@/components/builder/monaco-editor";
import { MentionHandler } from "./mention-handler";
import { ChatMessage } from "@/types/builder";
import React from "react";

// Import jest-dom matchers after expect is defined
import "@testing-library/jest-dom/vitest";

// Mock scrollIntoView which is not available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

describe("Integration: Chat and Editor Working Together", () => {
  describe("1. Chat messages are sent and displayed", () => {
    it("should display user messages immediately after sending", async () => {
      const user = userEvent.setup();
      const messages: ChatMessage[] = [];
      const handleSendMessage = vi.fn((content: string, mentions: any[]) => {
        messages.push({
          id: `msg-${messages.length}`,
          role: "user",
          content,
          mentions,
          timestamp: Date.now(),
        });
      });

      const { rerender } = render(
        <ChatInterface messages={messages} onSendMessage={handleSendMessage} />,
      );

      // Type a message
      const input = screen.getByTestId("chat-input");
      await user.type(input, "Hello, AI!");

      // Send the message
      const sendButton = screen.getByTestId("send-button");
      await user.click(sendButton);

      // Verify the handler was called
      expect(handleSendMessage).toHaveBeenCalledWith("Hello, AI!", []);

      // Rerender with the new message
      rerender(
        <ChatInterface messages={messages} onSendMessage={handleSendMessage} />,
      );

      // Verify the message is displayed
      await waitFor(() => {
        expect(screen.getByText("Hello, AI!")).toBeInTheDocument();
      });
    });

    it("should display streaming AI responses token by token", async () => {
      const messages: ChatMessage[] = [
        {
          id: "msg-1",
          role: "user",
          content: "Create a button",
          mentions: [],
          timestamp: Date.now(),
        },
      ];

      const { rerender } = render(
        <ChatInterface
          messages={messages}
          onSendMessage={vi.fn()}
          isStreaming={true}
          streamingContent="Creating a button component..."
        />,
      );

      // Verify streaming content is displayed
      expect(
        screen.getByText(/Creating a button component/),
      ).toBeInTheDocument();

      // Update streaming content
      rerender(
        <ChatInterface
          messages={messages}
          onSendMessage={vi.fn()}
          isStreaming={true}
          streamingContent="Creating a button component with Tailwind CSS..."
        />,
      );

      // Verify updated content
      expect(screen.getByText(/with Tailwind CSS/)).toBeInTheDocument();
    });
  });

  describe("2. Context mentions capture correct data", () => {
    it("should capture file contents when @Files is used", async () => {
      const files = {
        "/src/App.tsx":
          "export default function App() { return <div>Hello</div>; }",
        "/src/index.tsx": 'import App from "./App";',
      };

      const mentionHandler = new MentionHandler();

      const mention = await mentionHandler.handleFilesMention(
        ["/src/App.tsx"],
        files,
      );

      expect(mention.type).toBe("files");
      expect(mention.data).toHaveLength(1);
      expect(mention.data[0].path).toBe("/src/App.tsx");
      expect(mention.data[0].content).toContain("export default function App");
    });

    it("should capture terminal output when @Terminal is used", async () => {
      const consoleLogs = [
        { level: "log", message: "Server started", timestamp: Date.now() },
        {
          level: "error",
          message: "Error: Module not found",
          timestamp: Date.now(),
        },
      ];

      const mentionHandler = new MentionHandler();

      const mention = mentionHandler.handleTerminalMention(consoleLogs);

      expect(mention.type).toBe("terminal");
      expect(mention.data.logs).toHaveLength(2);
      expect(mention.data.logs[1].message).toBe("Error: Module not found");
    });
  });

  describe("3. AI responses update the file system", () => {
    it("should update files in the project context when AI creates/modifies files", async () => {
      let capturedState: any = null;

      function TestComponent() {
        const { state, actions } = useProject();
        capturedState = state;

        React.useEffect(() => {
          // Simulate AI creating a new file
          actions.createFile("/src/Button.tsx", "export function Button() {}");
        }, [actions]);

        return null;
      }

      render(
        <ProjectProvider>
          <TestComponent />
        </ProjectProvider>,
      );

      await waitFor(() => {
        expect(capturedState.files["/src/Button.tsx"]).toBe(
          "export function Button() {}",
        );
      });
    });

    it("should update existing files when AI modifies them", async () => {
      const initialFiles = {
        "/src/App.tsx":
          "export default function App() { return <div>Old</div>; }",
      };

      let capturedState: any = null;

      function TestComponent() {
        const { state, actions } = useProject();
        capturedState = state;

        React.useEffect(() => {
          // Simulate AI modifying the file
          actions.updateFile(
            "/src/App.tsx",
            "export default function App() { return <div>New</div>; }",
          );
        }, [actions]);

        return null;
      }

      render(
        <ProjectProvider initialState={{ files: initialFiles }}>
          <TestComponent />
        </ProjectProvider>,
      );

      await waitFor(() => {
        expect(capturedState.files["/src/App.tsx"]).toContain("New");
      });
    });
  });

  describe("4. Monaco editor reflects file changes", () => {
    it("should display the active file content in the editor", async () => {
      const files = {
        "/src/App.tsx":
          "export default function App() { return <div>Hello</div>; }",
      };

      function TestComponent() {
        const { state } = useProject();
        const activeFileContent = state.activeFile
          ? state.files[state.activeFile]
          : "";

        return (
          <MonacoEditor
            path={state.activeFile || ""}
            value={activeFileContent}
            language="typescript"
            onChange={vi.fn()}
          />
        );
      }

      render(
        <ProjectProvider initialState={{ files, activeFile: "/src/App.tsx" }}>
          <TestComponent />
        </ProjectProvider>,
      );

      const editor = screen.getByTestId("monaco-editor");
      expect(editor).toHaveValue(
        "export default function App() { return <div>Hello</div>; }",
      );
    });

    it("should update the file system when editor content changes", async () => {
      const user = userEvent.setup();
      const files = {
        "/src/App.tsx":
          "export default function App() { return <div>Hello</div>; }",
      };

      let capturedState: any = null;

      function TestComponent() {
        const { state, actions } = useProject();
        capturedState = state;
        const activeFileContent = state.activeFile
          ? state.files[state.activeFile]
          : "";

        const handleChange = (value: string | undefined) => {
          if (state.activeFile && value !== undefined) {
            actions.updateFile(state.activeFile, value);
          }
        };

        return (
          <MonacoEditor
            path={state.activeFile || ""}
            value={activeFileContent}
            language="typescript"
            onChange={handleChange}
          />
        );
      }

      render(
        <ProjectProvider initialState={{ files, activeFile: "/src/App.tsx" }}>
          <TestComponent />
        </ProjectProvider>,
      );

      const editor = screen.getByTestId("monaco-editor");

      // Clear and type new content (using paste to avoid special character issues)
      await user.clear(editor);
      await user.click(editor);
      await user.paste(
        "export default function App() { return <div>Modified</div>; }",
      );

      await waitFor(() => {
        expect(capturedState.files["/src/App.tsx"]).toContain("Modified");
      });
    });

    it("should switch editor content when active file changes", async () => {
      const files = {
        "/src/App.tsx": "App content",
        "/src/Button.tsx": "Button content",
      };

      let capturedState: any = null;

      function TestComponent() {
        const { state, actions } = useProject();
        capturedState = state;
        const activeFileContent = state.activeFile
          ? state.files[state.activeFile]
          : "";

        return (
          <>
            <MonacoEditor
              path={state.activeFile || ""}
              value={activeFileContent}
              language="typescript"
              onChange={vi.fn()}
            />
            <button
              data-testid="switch-file"
              onClick={() => actions.setActiveFile("/src/Button.tsx")}
            >
              Switch to Button
            </button>
          </>
        );
      }

      const user = userEvent.setup();

      render(
        <ProjectProvider initialState={{ files, activeFile: "/src/App.tsx" }}>
          <TestComponent />
        </ProjectProvider>,
      );

      // Initially shows App content
      let editor = screen.getByTestId("monaco-editor");
      expect(editor).toHaveValue("App content");

      // Switch to Button file
      const switchButton = screen.getByTestId("switch-file");
      await user.click(switchButton);

      await waitFor(() => {
        expect(capturedState.activeFile).toBe("/src/Button.tsx");
      });

      // Editor should now show Button content
      editor = screen.getByTestId("monaco-editor");
      expect(editor).toHaveValue("Button content");
    });
  });

  describe("5. End-to-end flow: Chat → AI → File System → Editor", () => {
    it("should complete the full flow from chat message to editor update", async () => {
      const user = userEvent.setup();
      let capturedState: any = null;

      function IntegratedApp() {
        const { state, actions } = useProject();
        capturedState = state;
        const [messages, setMessages] = React.useState<ChatMessage[]>([]);
        const [isStreaming, setIsStreaming] = React.useState(false);
        const [streamingContent, setStreamingContent] = React.useState("");

        const handleSendMessage = async (content: string, mentions: any[]) => {
          // Add user message
          const userMessage: ChatMessage = {
            id: `msg-${messages.length}`,
            role: "user",
            content,
            mentions,
            timestamp: Date.now(),
          };
          setMessages([...messages, userMessage]);

          // Simulate AI response
          setIsStreaming(true);
          setStreamingContent("Creating Button component...");

          // Simulate AI creating a file
          setTimeout(() => {
            actions.createFile(
              "/src/Button.tsx",
              "export function Button() { return <button>Click me</button>; }",
            );
            actions.setActiveFile("/src/Button.tsx");

            // Complete streaming
            const aiMessage: ChatMessage = {
              id: `msg-${messages.length + 1}`,
              role: "assistant",
              content: "I created a Button component for you.",
              mentions: [],
              timestamp: Date.now(),
            };
            setMessages([...messages, userMessage, aiMessage]);
            setIsStreaming(false);
            setStreamingContent("");
          }, 100);
        };

        const activeFileContent = state.activeFile
          ? state.files[state.activeFile]
          : "";

        return (
          <div>
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
            />
            <MonacoEditor
              path={state.activeFile || ""}
              value={activeFileContent}
              language="typescript"
              onChange={(value) => {
                if (state.activeFile && value !== undefined) {
                  actions.updateFile(state.activeFile, value);
                }
              }}
            />
          </div>
        );
      }

      render(
        <ProjectProvider>
          <IntegratedApp />
        </ProjectProvider>,
      );

      // Send a chat message
      const input = screen.getByTestId("chat-input");
      await user.type(input, "Create a button component");

      const sendButton = screen.getByTestId("send-button");
      await user.click(sendButton);

      // Wait for AI to create the file
      await waitFor(
        () => {
          expect(capturedState.files["/src/Button.tsx"]).toBeDefined();
        },
        { timeout: 3000 },
      );

      // Verify the file was created
      expect(capturedState.files["/src/Button.tsx"]).toContain(
        "export function Button",
      );

      // Verify the editor shows the new file
      const editor = screen.getByTestId("monaco-editor");
      await waitFor(() => {
        const value = (editor as HTMLTextAreaElement).value;
        expect(value).toContain("export function Button");
      });

      // Verify the active file was set
      expect(capturedState.activeFile).toBe("/src/Button.tsx");
    });
  });
});
