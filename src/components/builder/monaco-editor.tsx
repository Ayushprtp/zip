/**
 * MonacoEditor - Professional code editor component
 * Wraps @monaco-editor/react with project-specific configuration
 */

"use client";

import { useCallback, useRef } from "react";
import Editor, { OnMount, OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useProject } from "@/lib/builder/project-context";

// ============================================================================
// Types
// ============================================================================

interface MonacoEditorProps {
  /** Path of the file being edited */
  path: string;
  /** File content */
  value: string;
  /** Callback when content changes */
  onChange?: (value: string) => void;
  /** Editor theme */
  theme?: "vs-dark" | "vs-light";
  /** Additional editor options */
  options?: editor.IStandaloneEditorConstructionOptions;
}

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Maps file extensions to Monaco language identifiers
 */
function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";

  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    html: "html",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    graphql: "graphql",
    vue: "vue",
    svelte: "svelte",
  };

  return languageMap[ext] || "plaintext";
}

// ============================================================================
// Default Editor Options
// ============================================================================

const DEFAULT_EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: true },
  fontSize: 14,
  tabSize: 2,
  automaticLayout: true,
  formatOnPaste: true,
  formatOnType: true,
  scrollBeyondLastLine: false,
  wordWrap: "on",
  lineNumbers: "on",
  renderWhitespace: "selection",
  bracketPairColorization: {
    enabled: true,
  },
  suggest: {
    showKeywords: true,
    showSnippets: true,
  },
  quickSuggestions: {
    other: true,
    comments: false,
    strings: true,
  },
  parameterHints: {
    enabled: true,
  },
  folding: true,
  foldingStrategy: "indentation",
  showFoldingControls: "always",
  smoothScrolling: true,
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
};

// ============================================================================
// Component
// ============================================================================

export function MonacoEditor({
  path,
  value,
  onChange,
  theme = "vs-dark",
  options = {},
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const language = getLanguageFromPath(path);

  // Merge default options with custom options
  const editorOptions = {
    ...DEFAULT_EDITOR_OPTIONS,
    ...options,
  };

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Configure TypeScript/JavaScript compiler options
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: "React",
      allowJs: true,
      typeRoots: ["node_modules/@types"],
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: "React",
      allowJs: true,
    });

    // Set diagnostics options
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    // Focus the editor
    editor.focus();
  }, []);

  // Handle content changes
  const handleEditorChange: OnChange = useCallback(
    (value) => {
      if (value !== undefined && onChange) {
        onChange(value);
      }
    },
    [onChange],
  );

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={language}
        value={value}
        theme={theme}
        options={editorOptions}
        onMount={handleEditorMount}
        onChange={handleEditorChange}
        path={path}
      />
    </div>
  );
}

// ============================================================================
// Connected Component (with ProjectContext)
// ============================================================================

interface ConnectedMonacoEditorProps {
  /** Optional theme override */
  theme?: "vs-dark" | "vs-light";
  /** Additional editor options */
  options?: editor.IStandaloneEditorConstructionOptions;
}

/**
 * MonacoEditor connected to ProjectContext
 * Automatically syncs with active file and updates on changes
 */
export function ConnectedMonacoEditor({
  theme,
  options,
}: ConnectedMonacoEditorProps) {
  const { state, actions } = useProject();
  const { activeFile, files } = state;

  // Handle content changes
  const handleChange = useCallback(
    (value: string) => {
      if (activeFile) {
        actions.updateFile(activeFile, value);
      }
    },
    [activeFile, actions],
  );

  // If no active file, show placeholder
  if (!activeFile) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">No file selected</p>
          <p className="text-sm">
            Select a file from the file tree to start editing
          </p>
        </div>
      </div>
    );
  }

  const fileContent = files[activeFile] || "";

  return (
    <MonacoEditor
      path={activeFile}
      value={fileContent}
      onChange={handleChange}
      theme={theme}
      options={options}
    />
  );
}

// Export language detection utility for testing
export { getLanguageFromPath };
