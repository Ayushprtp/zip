import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Check,
  Edit2,
  Trash2,
  AlertTriangle,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/httpchain/components/ui/select";
import { DeclarativeCheckExtractor } from "../extractors/DeclarativeCheckExtractor";
import { CheckDisplay } from "./CheckDisplay";
import { getStepDependencies } from "@/components/httpchain/shared/utils/variables";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";
import type {
  DeclarativeCheck,
  ConditionOperator,
} from "@/components/httpchain/types/schema";
import { ConditionOperator as ConditionOperatorEnum } from "@/components/httpchain/types/schema";
import { DeclarativeOperator as DeclarativeOperatorEnum } from "@/components/httpchain/types/schema";
import { Badge } from "@/components/httpchain/components/ui/badge";

export function ConditionsEditor() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const workflow = useAppStore((s) => s.workflow);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const condition = step?.condition ?? null;
  const disabled = isSaving;

  const stepDependencies = useMemo(() => {
    if (!workflow || !selectedStepNodeId) return [];
    return getStepDependencies(workflow, selectedStepNodeId);
  }, [workflow, selectedStepNodeId]);

  if (!step) return null;

  const [operator, setOperator] = useState<ConditionOperator>(
    condition?.operator || ConditionOperatorEnum.AND,
  );
  const [checks, setChecks] = useState<DeclarativeCheck[]>(
    condition?.checks || [],
  );
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentCheck, setCurrentCheck] = useState<DeclarativeCheck>({
    path: [],
    operator: DeclarativeOperatorEnum.EXISTS,
    variable_name: "",
  });

  useEffect(() => {
    if (condition) {
      setOperator(condition.operator);
      setChecks(condition.checks);
    } else {
      setOperator(ConditionOperatorEnum.AND);
      setChecks([]);
    }
  }, [condition]);

  const invalidVariables = useMemo(() => {
    const invalid = new Set<string>();
    checks.forEach((check) => {
      if (
        check.variable_name &&
        !stepDependencies.includes(check.variable_name)
      ) {
        invalid.add(check.variable_name);
      }
    });
    return Array.from(invalid);
  }, [checks, stepDependencies]);

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingIndex(null);
    setCurrentCheck({
      path: [],
      operator: DeclarativeOperatorEnum.EXISTS,
      variable_name: "",
    });
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setIsAdding(false);
    setCurrentCheck(checks[index]);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setCurrentCheck({
      path: [],
      operator: DeclarativeOperatorEnum.EXISTS,
      variable_name: "",
    });
  };

  const handleSave = () => {
    if (!currentCheck.variable_name || !currentCheck.variable_name.trim()) {
      return;
    }

    const updated = [...checks];
    if (editingIndex !== null) {
      updated[editingIndex] = currentCheck;
    } else {
      updated.push(currentCheck);
    }

    setChecks(updated);
    updateCondition(operator, updated);
    handleCancel();
  };

  const handleDelete = (index: number) => {
    const updated = checks.filter((_, i) => i !== index);
    setChecks(updated);
    updateCondition(operator, updated);
  };

  const handleOperatorChange = (newOperator: ConditionOperator) => {
    setOperator(newOperator);
    updateCondition(newOperator, checks);
  };

  const updateCondition = (op: ConditionOperator, chks: DeclarativeCheck[]) => {
    if (!selectedStepNodeId) return;

    if (chks.length === 0) {
      updateStep(selectedStepNodeId, { condition: null });
    } else {
      updateStep(selectedStepNodeId, {
        condition: {
          operator: op,
          checks: chks,
        },
      });
    }
  };

  const isFormVisible = isAdding || editingIndex !== null;
  const isValid =
    currentCheck.variable_name && currentCheck.variable_name.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Conditions</h3>
          {checks.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {checks.length} check{checks.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {!isFormVisible && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleStartAdd}
            disabled={disabled}
            className="h-8 text-xs hover:bg-primary/10 hover:text-primary"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add Check
          </Button>
        )}
      </div>

      {invalidVariables.length > 0 && (
        <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900 animate-in fade-in">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Invalid variables in conditions:</p>
            <p className="text-xs mt-1">
              The following variables are used in conditions but are not in step
              dependencies:{" "}
              <span className="font-mono font-semibold">
                {invalidVariables.join(", ")}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Operator selector */}
      {(checks.length > 0 || isFormVisible) && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Logic:
          </span>
          <Select
            value={operator}
            onValueChange={(v) => handleOperatorChange(v as ConditionOperator)}
            disabled={disabled || isFormVisible}
          >
            <SelectTrigger className="w-32 h-8 text-xs border-0 bg-muted/50 hover:bg-muted focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ConditionOperatorEnum.AND}>
                AND (All)
              </SelectItem>
              <SelectItem value={ConditionOperatorEnum.OR}>OR (Any)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isFormVisible && (
        <div className="animate-in slide-in-from-top-2 duration-200 space-y-4 py-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {editingIndex !== null ? "Edit Check" : "New Check"}
            </h4>
          </div>

          <div className="pl-1">
            <DeclarativeCheckExtractor
              value={currentCheck}
              onChange={setCurrentCheck}
              disabled={disabled}
              showPath={false}
              showVariable={true}
              availableVariables={stepDependencies}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t mt-4 border-dashed">
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
      )}

      {/* Checks List */}
      {!isFormVisible &&
        (checks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed rounded-lg bg-muted/5">
            <GitBranch className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              No conditions configured
            </p>
            <p className="text-xs text-muted-foreground/70">
              Add checks to conditionally execute this step
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {checks.map((check, index) => (
              <div
                key={index}
                className="group flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                <div className="flex-1 min-w-0">
                  <CheckDisplay check={check} />
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
