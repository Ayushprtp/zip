import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/httpchain/components/ui/tabs";
import { RegisteredFunctionInput } from "./RegisteredFunctionInput";
import { getDefaultTemplate, getAllLanguages } from "./languages";
import type {
  FunctionExtractor,
  FunctionExtractorCode,
} from "@/components/httpchain/types/schema";
import type { FunctionLanguage, FunctionExtractorMode } from "./types";
import { Code2, Package } from "lucide-react";
import { Skeleton } from "@/components/httpchain/components/ui/skeleton";

// Lazy load CodeEditor (contains CodeMirror which is heavy ~200-300KB)
// Standard React.lazy pattern with default export
const CodeEditor = lazy(() => import("./CodeEditor"));

interface FunctionExtractorFormProps {
  value: FunctionExtractor;
  onChange: (value: FunctionExtractor) => void;
  disabled?: boolean;
}

function getCodeForLanguage(
  code: FunctionExtractorCode | undefined,
  language: FunctionLanguage,
): string {
  if (!code) return "";
  return code[language] ?? "";
}

function getModeFromValue(value: FunctionExtractor): FunctionExtractorMode {
  if (value.registered_function_name) {
    return "registered";
  }
  return "inline";
}

function getInitialLanguage(
  code: FunctionExtractorCode | undefined,
): FunctionLanguage {
  if (!code) return "python";
  if (code.python) return "python";
  if (code.go) return "go";
  if (code.js) return "js";
  if (code.rust) return "rust";
  if (code.c) return "c";
  if (code.cpp) return "cpp";
  return "python";
}

function FunctionExtractorForm({
  value,
  onChange,
  disabled = false,
}: FunctionExtractorFormProps) {
  const [mode, setMode] = useState<FunctionExtractorMode>(() =>
    getModeFromValue(value),
  );
  const [language, setLanguage] = useState<FunctionLanguage>(() =>
    getInitialLanguage(value.code),
  );

  const currentCode = getCodeForLanguage(value.code, language);
  const languages = getAllLanguages();

  const handleModeChange = useCallback(
    (newMode: FunctionExtractorMode) => {
      setMode(newMode);

      if (newMode === "registered") {
        onChange({
          registered_function_name: value.registered_function_name ?? "",
          code: undefined,
        });
      } else {
        const template = getDefaultTemplate(language);
        onChange({
          registered_function_name: undefined,
          code: {
            [language]: currentCode || template,
          },
        });
      }
    },
    [onChange, value.registered_function_name, language, currentCode],
  );

  const handleLanguageChange = useCallback(
    (newLanguage: FunctionLanguage) => {
      setLanguage(newLanguage);

      if (mode === "inline") {
        const existingCode = getCodeForLanguage(value.code, newLanguage);
        if (!existingCode) {
          const template = getDefaultTemplate(newLanguage);
          onChange({
            ...value,
            code: {
              ...value.code,
              [newLanguage]: template,
            },
          });
        }
      }
    },
    [mode, value, onChange],
  );

  const handleRegisteredNameChange = useCallback(
    (name: string) => {
      onChange({
        ...value,
        registered_function_name: name || undefined,
      });
    },
    [value, onChange],
  );

  const handleCodeChange = useCallback(
    (code: string) => {
      onChange({
        ...value,
        code: {
          ...value.code,
          [language]: code,
        },
      });
    },
    [value, language, onChange],
  );

  useEffect(() => {
    if (mode === "inline" && !currentCode) {
      const template = getDefaultTemplate(language);
      if (template) {
        onChange({
          ...value,
          code: {
            ...value.code,
            [language]: template,
          },
        });
      }
    }
  }, []);

  return (
    <div className="space-y-2">
      {/* Compact header */}
      <div className="flex items-center gap-2">
        <Tabs
          value={mode}
          onValueChange={(v) => handleModeChange(v as FunctionExtractorMode)}
          className="flex-shrink-0"
        >
          <TabsList className="h-7 p-0.5">
            <TabsTrigger
              value="inline"
              disabled={disabled}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Code2 className="h-3 w-3" />
              Code
            </TabsTrigger>
            <TabsTrigger
              value="registered"
              disabled={disabled}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Package className="h-3 w-3" />
              Plugin
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "inline" && (
          <Tabs
            value={language}
            onValueChange={(v) => handleLanguageChange(v as FunctionLanguage)}
            className="flex-shrink-0"
          >
            <TabsList className="h-7 p-0.5">
              {languages.map((lang) => {
                const Icon = lang.icon;
                return (
                  <TabsTrigger
                    key={lang.id}
                    value={lang.id}
                    disabled={disabled || !lang.isAvailable}
                    className="h-6 px-2 text-[11px] gap-1"
                  >
                    <Icon className="h-3 w-3" />
                    {lang.displayName}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Main content */}
      {mode === "registered" ? (
        <RegisteredFunctionInput
          value={value.registered_function_name ?? ""}
          onChange={handleRegisteredNameChange}
          disabled={disabled}
        />
      ) : (
        <Suspense
          fallback={
            <div className="rounded-lg border h-[320px] bg-muted/30 p-4 space-y-3">
              {/* Language tabs skeleton */}
              <div className="flex gap-1">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-14" />
                <Skeleton className="h-6 w-12" />
              </div>
              {/* Code lines skeleton */}
              <div className="space-y-2 pt-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            </div>
          }
        >
          <CodeEditor
            code={currentCode}
            language={language}
            onChange={handleCodeChange}
            disabled={disabled}
            height="320px"
          />
        </Suspense>
      )}
    </div>
  );
}

// Default export for lazy loading (industry standard pattern)
export default FunctionExtractorForm;
