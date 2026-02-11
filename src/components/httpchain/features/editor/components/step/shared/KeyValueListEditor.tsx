import { useState, useEffect } from "react";
import { Plus, Trash2, RotateCcw, Edit2 } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { Checkbox } from "@/components/httpchain/components/ui/checkbox";
import { SmartKeyValueEditorField } from "./SmartKeyValueEditorField";
import { cn } from "@/components/httpchain/lib/utils";

interface KeyValueListEditorProps {
  data: Record<string, string> | null;
  buffer: Record<string, string> | null;
  onUpdate: (
    data: Record<string, string> | null,
    buffer: Record<string, string> | null,
  ) => void;
  disabled?: boolean;
  availableVariables?: string[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

interface KeyValueRow {
  key: string;
  value: string;
  enabled: boolean;
}

function toRows(
  data: Record<string, string> | null,
  buffer: Record<string, string> | null,
): KeyValueRow[] {
  const rows: KeyValueRow[] = [];
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      rows.push({ key, value, enabled: true });
    });
  }
  if (buffer) {
    Object.entries(buffer).forEach(([key, value]) => {
      rows.push({ key, value, enabled: false });
    });
  }
  return rows;
}

function fromRows(rows: KeyValueRow[]): {
  data: Record<string, string> | null;
  buffer: Record<string, string> | null;
} {
  const data: Record<string, string> = {};
  const buffer: Record<string, string> = {};
  rows.forEach((row) => {
    if (!row.key.trim()) return;
    if (row.enabled) {
      data[row.key] = row.value;
    } else {
      buffer[row.key] = row.value;
    }
  });
  return {
    data: Object.keys(data).length > 0 ? data : null,
    buffer: Object.keys(buffer).length > 0 ? buffer : null,
  };
}

export function KeyValueListEditor({
  data,
  buffer,
  onUpdate,
  disabled = false,
  availableVariables = [],
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: KeyValueListEditorProps) {
  const rows = toRows(data, buffer);
  const enabledRows = rows.filter((r) => r.enabled);
  const disabledRows = rows.filter((r) => !r.enabled);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    if (editingKey && editingKey !== "__new__") {
      const row = rows.find((r) => r.key === editingKey);
      if (!row) setEditingKey(null);
    }
  }, [data, buffer]);

  const handleStartEdit = (row: KeyValueRow) => setEditingKey(row.key);
  const handleStartAdd = () => setEditingKey("__new__");
  const handleCancelEdit = () => setEditingKey(null);

  const handleSaveEdit = (
    originalKey: string | null,
    newKey: string,
    newValue: string,
  ) => {
    let updatedRows: KeyValueRow[];
    if (originalKey === "__new__" || originalKey === null) {
      updatedRows = [...rows, { key: newKey, value: newValue, enabled: true }];
    } else {
      updatedRows = rows.map((row) =>
        row.key === originalKey
          ? { ...row, key: newKey, value: newValue }
          : row,
      );
    }
    const { data: newData, buffer: newBuffer } = fromRows(updatedRows);
    onUpdate(newData, newBuffer);
    setEditingKey(null);
  };

  const handleToggleEnabled = (rowKey: string) => {
    const updatedRows = rows.map((row) =>
      row.key === rowKey ? { ...row, enabled: !row.enabled } : row,
    );
    const { data: newData, buffer: newBuffer } = fromRows(updatedRows);
    onUpdate(newData, newBuffer);
  };

  const handleDelete = (rowKey: string) => {
    const updatedRows = rows.filter((row) => row.key !== rowKey);
    const { data: newData, buffer: newBuffer } = fromRows(updatedRows);
    onUpdate(newData, newBuffer);
  };

  const isAddingNew = editingKey === "__new__";

  const renderDisplayRow = (row: KeyValueRow, isBuffered: boolean) => (
    <div
      key={row.key}
      className={cn(
        "flex items-center h-9 px-3 rounded border",
        isBuffered
          ? "bg-muted/20 border-dashed border-muted-foreground/20"
          : "bg-card border-border",
      )}
    >
      <Checkbox
        checked={row.enabled}
        onCheckedChange={() => handleToggleEnabled(row.key)}
        disabled={disabled}
        className="h-3.5 w-3.5 shrink-0 mr-3"
      />

      <div
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2 text-xs cursor-pointer",
          isBuffered && "opacity-50",
        )}
        onClick={() =>
          !isBuffered &&
          !disabled &&
          editingKey === null &&
          handleStartEdit(row)
        }
      >
        <span className="font-mono font-medium">{row.key}</span>
        <span className="text-muted-foreground shrink-0">=</span>
        <span className="flex-1 truncate text-muted-foreground">
          {row.value || <em>empty</em>}
        </span>
      </div>

      <div className="flex items-center shrink-0 ml-3">
        {isBuffered ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleToggleEnabled(row.key)}
            disabled={disabled}
            className="h-6 w-6 text-muted-foreground hover:text-primary"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleStartEdit(row)}
            disabled={disabled || editingKey !== null}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDelete(row.key)}
          disabled={disabled}
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  const renderEditRow = (row?: KeyValueRow) => (
    <SmartKeyValueEditorField
      keyValue={row?.key || ""}
      valueValue={row?.value || ""}
      onSave={(newKey, newValue) =>
        handleSaveEdit(row?.key || "__new__", newKey, newValue)
      }
      onCancel={handleCancelEdit}
      disabled={disabled}
      availableVariables={availableVariables}
      keyPlaceholder={keyPlaceholder}
      valuePlaceholder={valuePlaceholder}
      autoFocus
    />
  );

  return (
    <div className="space-y-1">
      {enabledRows.map((row) =>
        editingKey === row.key ? (
          <div key={row.key}>{renderEditRow(row)}</div>
        ) : (
          renderDisplayRow(row, false)
        ),
      )}

      {isAddingNew && renderEditRow()}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleStartAdd}
        disabled={disabled || editingKey !== null}
        className="w-full h-7 text-xs text-muted-foreground hover:text-foreground border border-dashed border-transparent hover:border-border"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add
      </Button>

      {disabledRows.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed space-y-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Disabled ({disabledRows.length})
          </div>
          {disabledRows.map((row) => renderDisplayRow(row, true))}
        </div>
      )}

      {rows.length === 0 && !isAddingNew && (
        <div className="text-center py-4 text-muted-foreground text-xs">
          No items
        </div>
      )}
    </div>
  );
}
