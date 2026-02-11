import { useState, useMemo, lazy, Suspense } from "react";
import {
  Edit2,
  Trash2,
  Filter,
  Check,
  Code,
  Regex,
  Braces,
  AlertCircle,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { Skeleton } from "@/components/httpchain/components/ui/skeleton";
import { Input } from "@/components/httpchain/components/ui/input";
import { Label } from "@/components/httpchain/components/ui/label";
import { DeclarativeCheckExtractor } from "./DeclarativeCheckExtractor";
import { RegexExtractorForm } from "./RegexExtractor";
import { JsonPathArrayExtractor } from "./JsonPathArrayExtractor";
import { ValueDisplay } from "./ValueDisplay";
import { ValidationStatus } from "./function";

// Lazy load FunctionExtractorForm (contains CodeMirror which is heavy ~200-300KB)
// Standard React.lazy pattern with default export
const FunctionExtractorForm = lazy(
  () => import("./function/FunctionExtractorForm"),
);
import { getLanguageConfig } from "./function/languages";
import { getForbiddenExtractorKeys } from "@/components/httpchain/shared/utils/variables";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";
import { useCodeValidation } from "@/components/httpchain/features/editor/hooks/useCodeValidation";
import type {
  Extractor,
  ExtractorType,
  DeclarativeCheck,
  RegexExtractor,
  FunctionExtractor,
} from "@/components/httpchain/types/schema";
import { ExtractorType as ExtractorTypeEnum } from "@/components/httpchain/types/schema";
import { DeclarativeOperator as DeclarativeOperatorEnum } from "@/components/httpchain/types/schema";
import { Badge } from "@/components/httpchain/components/ui/badge";
import type { FunctionLanguage } from "./function/types";
import { cn } from "@/components/httpchain/lib/utils";

type AddingType = ExtractorType | null;

export function ExtractorsEditor() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const workflow = useAppStore((s) => s.workflow);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const extractors = step?.request.extractors ?? [];
  const disabled = isSaving;
  const [addingType, setAddingType] = useState<AddingType>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [extractorKey, setExtractorKey] = useState("");

  if (!step || !selectedStepNodeId) return null;

  // Get forbidden extractor keys (chain variables + dependency variables)
  const forbiddenKeys = useMemo(() => {
    return getForbiddenExtractorKeys(workflow);
  }, [workflow, selectedStepNodeId]);

  // Get all used extractor keys for duplicate checking
  const usedKeys = useMemo(() => {
    const keys = new Set<string>();
    forbiddenKeys.forEach((k) => keys.add(k));
    if (workflow?.steps) {
      workflow.steps.forEach((s) => {
        if (s.node_id !== selectedStepNodeId && s.request.extractors) {
          s.request.extractors.forEach((extractor) => {
            keys.add(extractor.extractor_key);
          });
        }
      });
    }
    extractors.forEach((extractor, index) => {
      if (editingIndex === null || index !== editingIndex) {
        keys.add(extractor.extractor_key);
      }
    });
    return keys;
  }, [workflow, selectedStepNodeId, extractors, editingIndex, forbiddenKeys]);

  const isDuplicate = useMemo(() => {
    if (!extractorKey.trim()) return false;
    return usedKeys.has(extractorKey.trim());
  }, [extractorKey, usedKeys]);

  const [declarativeCheck, setDeclarativeCheck] = useState<DeclarativeCheck>({
    path: [],
    operator: DeclarativeOperatorEnum.EXISTS,
  });
  const [regexExtractor, setRegexExtractor] = useState<RegexExtractor>({
    path: [],
    pattern: "",
    find_all: false,
  });
  const [jsonPathArray, setJsonPathArray] = useState<string[]>([]);
  const [functionExtractor, setFunctionExtractor] = useState<FunctionExtractor>(
    {},
  );

  // Validation ONLY for display and button control - NOT for editor control
  const functionCode = functionExtractor.code?.python ?? "";
  const functionValidation = useCodeValidation(functionCode, "python");

  const handleStartAdd = (type: ExtractorType) => {
    setAddingType(type);
    setExtractorKey("");
    setDeclarativeCheck({ path: [], operator: DeclarativeOperatorEnum.EXISTS });
    setRegexExtractor({ path: [], pattern: "", find_all: false });
    setJsonPathArray([]);
    setFunctionExtractor({});
    setEditingIndex(null);
  };

  const handleStartEdit = (index: number) => {
    const extractor = extractors[index];
    setEditingIndex(index);
    setExtractorKey(extractor.extractor_key);
    setAddingType(extractor.extractor_type);

    if (extractor.declarative_check_extractor) {
      setDeclarativeCheck(extractor.declarative_check_extractor);
    }
    if (extractor.regex_extractor) {
      setRegexExtractor(extractor.regex_extractor);
    }
    if (extractor.jsonpatharray_extractor) {
      setJsonPathArray(extractor.jsonpatharray_extractor);
    }
    if (extractor.function_extractor) {
      setFunctionExtractor(extractor.function_extractor);
    }
  };

  const handleCancel = () => {
    setAddingType(null);
    setEditingIndex(null);
    setExtractorKey("");
    setDeclarativeCheck({ path: [], operator: DeclarativeOperatorEnum.EXISTS });
    setRegexExtractor({ path: [], pattern: "", find_all: false });
    setJsonPathArray([]);
    setFunctionExtractor({});
  };

  const handleSave = () => {
    if (!extractorKey.trim() || !addingType) return;
    const trimmedKey = extractorKey.trim();
    if (usedKeys.has(trimmedKey)) return;

    const newExtractor: Extractor = {
      extractor_key: trimmedKey,
      extractor_type: addingType,
    };

    if (addingType === ExtractorTypeEnum.DECLARATIVE_CHECK) {
      newExtractor.declarative_check_extractor = declarativeCheck;
    } else if (addingType === ExtractorTypeEnum.REGEX) {
      newExtractor.regex_extractor = regexExtractor;
    } else if (addingType === ExtractorTypeEnum.JSONPATHARRAY) {
      newExtractor.jsonpatharray_extractor = jsonPathArray;
    } else if (addingType === ExtractorTypeEnum.FUNCTION) {
      newExtractor.function_extractor = functionExtractor;
    }

    const updated = [...extractors];
    if (editingIndex !== null) {
      updated[editingIndex] = newExtractor;
    } else {
      updated.push(newExtractor);
    }

    updateStep(selectedStepNodeId, {
      request: {
        ...step.request,
        extractors: updated,
      },
    });
    handleCancel();
  };

  const handleDelete = (index: number) => {
    const updated = extractors.filter((_, i) => i !== index);
    updateStep(selectedStepNodeId, {
      request: {
        ...step.request,
        extractors: updated.length > 0 ? updated : null,
      },
    });
  };

  const isFormVisible = addingType !== null;

  // Check if function extractor is valid (validation hook controls button, not editor)
  const isFunctionExtractorValid =
    functionExtractor.registered_function_name?.trim() ||
    (functionExtractor.code && functionValidation.valid);

  const isValid =
    extractorKey.trim() &&
    !isDuplicate &&
    addingType &&
    ((addingType === ExtractorTypeEnum.DECLARATIVE_CHECK &&
      declarativeCheck?.path &&
      declarativeCheck.path.length > 0) ||
      (addingType === ExtractorTypeEnum.REGEX &&
        regexExtractor?.path &&
        regexExtractor.path.length > 0 &&
        regexExtractor.pattern) ||
      (addingType === ExtractorTypeEnum.JSONPATHARRAY &&
        jsonPathArray &&
        jsonPathArray.length > 0) ||
      (addingType === ExtractorTypeEnum.FUNCTION && isFunctionExtractorValid));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Data Extraction</h3>
          {extractors.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {extractors.length}
            </Badge>
          )}
        </div>
        {!isFormVisible && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                handleStartAdd(ExtractorTypeEnum.DECLARATIVE_CHECK)
              }
              disabled={disabled}
              className="h-8 text-xs hover:bg-primary/10 hover:text-primary"
            >
              <Code className="h-3 w-3 mr-1.5" />
              Declarative
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleStartAdd(ExtractorTypeEnum.JSONPATHARRAY)}
              disabled={disabled}
              className="h-8 text-xs hover:bg-primary/10 hover:text-primary"
            >
              <Braces className="h-3 w-3 mr-1.5" />
              JSON Path
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleStartAdd(ExtractorTypeEnum.REGEX)}
              disabled={disabled}
              className="h-8 text-xs hover:bg-primary/10 hover:text-primary"
            >
              <Regex className="h-3 w-3 mr-1.5" />
              Regex
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleStartAdd(ExtractorTypeEnum.FUNCTION)}
              disabled={disabled}
              className="h-8 text-xs hover:bg-primary/10 hover:text-primary"
            >
              <Terminal className="h-3 w-3 mr-1.5" />
              Function
            </Button>
          </div>
        )}
      </div>

      {/* Inline Form */}
      {isFormVisible && (
        <div className="animate-in slide-in-from-top-2 duration-200 space-y-4 py-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              {editingIndex !== null ? "Edit Extractor" : "New Extractor"}
            </h4>
          </div>

          <div className="space-y-4 pl-1">
            <div className="space-y-1.5">
              <Label
                htmlFor="extractor_key"
                className="text-xs font-medium text-muted-foreground"
              >
                Variable Name (Key)
              </Label>
              <Input
                id="extractor_key"
                value={extractorKey}
                onChange={(e) => setExtractorKey(e.target.value)}
                placeholder="e.g., user_id, token"
                disabled={disabled}
                className={cn(
                  "h-9 font-mono text-sm",
                  isDuplicate ? "border-destructive" : "",
                )}
              />
              {isDuplicate && (
                <div className="flex items-center gap-2 text-[10px] text-destructive animate-in fade-in">
                  <AlertCircle className="h-3 w-3" />
                  <span>Key unavailable</span>
                </div>
              )}
            </div>

            {addingType === ExtractorTypeEnum.DECLARATIVE_CHECK && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Path Selection
                </Label>
                <DeclarativeCheckExtractor
                  value={declarativeCheck}
                  onChange={setDeclarativeCheck}
                  disabled={disabled}
                  showPath={true}
                  showVariable={false}
                />
              </div>
            )}

            {addingType === ExtractorTypeEnum.REGEX && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Regex Configuration
                </Label>
                <RegexExtractorForm
                  value={regexExtractor}
                  onChange={setRegexExtractor}
                  disabled={disabled}
                />
              </div>
            )}

            {addingType === ExtractorTypeEnum.JSONPATHARRAY && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  JSON Path Configuration
                </Label>
                <JsonPathArrayExtractor
                  value={jsonPathArray}
                  onChange={setJsonPathArray}
                  disabled={disabled}
                />
              </div>
            )}

            {addingType === ExtractorTypeEnum.FUNCTION && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Function Configuration
                </Label>
                <Suspense
                  fallback={
                    <div className="rounded-lg border h-64 bg-muted/30 p-4 space-y-3">
                      {/* Tabs skeleton */}
                      <div className="flex gap-2">
                        <Skeleton className="h-7 w-20" />
                        <Skeleton className="h-7 w-24" />
                      </div>
                      {/* Code lines skeleton */}
                      <div className="space-y-2 pt-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-4 w-4/5" />
                      </div>
                    </div>
                  }
                >
                  <FunctionExtractorForm
                    value={functionExtractor}
                    onChange={setFunctionExtractor}
                    disabled={disabled}
                  />
                </Suspense>
                {functionExtractor.code && (
                  <ValidationStatus result={functionValidation} />
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t mt-4 border-dashed">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={disabled}
                size="sm"
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={disabled || !isValid}
                size="sm"
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3 mr-1.5" />
                {editingIndex !== null ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Extractor List */}
      {!isFormVisible &&
        (extractors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed rounded-lg bg-muted/5">
            <Filter className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              No extractors configured
            </p>
            <p className="text-xs text-muted-foreground/70">
              Add an extractor to save values
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {extractors.map((extractor, index) => (
              <div
                key={index}
                className="group flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold font-mono text-primary">
                      {extractor.extractor_key}
                    </span>
                    {extractor.extractor_type === ExtractorTypeEnum.FUNCTION &&
                    extractor.function_extractor ? (
                      (() => {
                        // Show language icon for function extractors
                        if (
                          extractor.function_extractor.registered_function_name
                        ) {
                          return (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider border-muted-foreground/30 text-muted-foreground flex items-center gap-1"
                            >
                              <Code className="h-2.5 w-2.5" />
                              Plugin
                            </Badge>
                          );
                        } else if (extractor.function_extractor.code) {
                          const codeKeys = Object.keys(
                            extractor.function_extractor.code,
                          ) as FunctionLanguage[];
                          const firstLang = codeKeys[0];
                          if (firstLang) {
                            const langConfig = getLanguageConfig(firstLang);
                            const Icon = langConfig.icon;
                            return (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider border-muted-foreground/30 text-muted-foreground flex items-center gap-1"
                              >
                                <Icon className="h-2.5 w-2.5" />
                                {langConfig.displayName}
                              </Badge>
                            );
                          }
                        }
                        return (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider border-muted-foreground/30 text-muted-foreground"
                          >
                            Function
                          </Badge>
                        );
                      })()
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider border-muted-foreground/30 text-muted-foreground"
                      >
                        {extractor.extractor_type.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    {extractor.extractor_type ===
                      ExtractorTypeEnum.JSONPATHARRAY &&
                      extractor.jsonpatharray_extractor && (
                        <span className="font-mono">
                          {extractor.jsonpatharray_extractor.join(" → ")}
                        </span>
                      )}
                    {extractor.extractor_type === ExtractorTypeEnum.REGEX &&
                      extractor.regex_extractor && (
                        <span className="font-mono">
                          /{extractor.regex_extractor.pattern}/
                        </span>
                      )}
                    {extractor.extractor_type ===
                      ExtractorTypeEnum.DECLARATIVE_CHECK &&
                      extractor.declarative_check_extractor && (
                        <div className="flex items-center gap-1">
                          <span className="font-mono">
                            {extractor.declarative_check_extractor.operator}
                          </span>
                          {extractor.declarative_check_extractor.value !==
                            undefined && (
                            <ValueDisplay
                              value={
                                extractor.declarative_check_extractor.value
                              }
                            />
                          )}
                        </div>
                      )}
                    {extractor.extractor_type === ExtractorTypeEnum.FUNCTION &&
                      extractor.function_extractor && (
                        <div className="flex items-center gap-1.5">
                          {extractor.function_extractor
                            .registered_function_name ? (
                            <>
                              <Code className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono text-xs">
                                {
                                  extractor.function_extractor
                                    .registered_function_name
                                }
                                ()
                              </span>
                            </>
                          ) : extractor.function_extractor.code ? (
                            (() => {
                              // Get the first language from code
                              const codeKeys = Object.keys(
                                extractor.function_extractor.code,
                              ) as FunctionLanguage[];
                              const firstLang = codeKeys[0];
                              if (firstLang) {
                                const langConfig = getLanguageConfig(firstLang);
                                const Icon = langConfig.icon;
                                return (
                                  <>
                                    <Icon className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">
                                      {langConfig.displayName}
                                      {codeKeys.length > 1 &&
                                        ` +${codeKeys.length - 1}`}
                                    </span>
                                  </>
                                );
                              }
                              return null;
                            })()
                          ) : null}
                        </div>
                      )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleStartEdit(index)}
                    disabled={disabled}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(index)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
