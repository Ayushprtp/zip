import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { useAppStore } from "@/components/httpchain/store";
import { getImportHeader } from "./languages";
import type { FunctionLanguage } from "./types";
import { Lock } from "lucide-react";

interface CodeEditorProps {
  code: string;
  language: FunctionLanguage;
  onChange: (code: string) => void;
  disabled?: boolean;
  height?: string;
}

function getLanguageExtension(language: FunctionLanguage) {
  // Only Python is supported for now
  if (language === "python") {
    return python();
  }
  return null;
}

function CodeEditor({
  code,
  language,
  onChange,
  disabled = false,
  height = "320px",
}: CodeEditorProps) {
  const theme = useAppStore((s) => s.theme);
  const importHeader = getImportHeader(language);
  const langExtension = useMemo(
    () => getLanguageExtension(language),
    [language],
  );

  return (
    <div className="rounded-lg border overflow-hidden bg-background">
      {importHeader && (
        <div className="relative">
          <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-muted-foreground/50 select-none z-10">
            <Lock className="h-3 w-3" />
            <span>READ-ONLY</span>
          </div>
          <pre className="px-4 py-3 text-xs font-mono bg-muted/50 text-muted-foreground border-b overflow-x-auto select-none opacity-70">
            {importHeader.trim()}
          </pre>
        </div>
      )}

      <CodeMirror
        value={code}
        onChange={onChange}
        height={height}
        editable={!disabled}
        extensions={langExtension ? [langExtension] : []}
        theme={theme === "dark" ? oneDark : undefined}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          dropCursor: false,
          allowMultipleSelections: false,
        }}
      />
    </div>
  );
}

// Default export for lazy loading (industry standard pattern)
export default CodeEditor;
