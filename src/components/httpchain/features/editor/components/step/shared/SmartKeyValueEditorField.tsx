import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/httpchain/components/ui/input";
import { Variable, Check, X } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";

interface SmartKeyValueEditorFieldProps {
  keyValue: string;
  valueValue: string;
  onSave: (key: string, value: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  availableVariables?: string[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  autoFocus?: boolean;
}

export function SmartKeyValueEditorField({
  keyValue,
  valueValue,
  onSave,
  onCancel,
  disabled = false,
  availableVariables = [],
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  autoFocus = true,
}: SmartKeyValueEditorFieldProps) {
  const [editedKey, setEditedKey] = useState(keyValue);
  const [editedValue, setEditedValue] = useState(valueValue);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<"key" | "value" | null>(null);

  const keyInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  useEffect(() => {
    if (autoFocus && keyInputRef.current) {
      keyInputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSave = () => {
    if (editedKey.trim()) {
      onSave(editedKey.trim(), editedValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Tab" && !e.shiftKey && activeInput === "key") {
      // Don't prevent default - let it naturally move to value field
    }
  };

  const handleFocus = (input: "key" | "value") => {
    setActiveInput(input);
    if (availableVariables.length > 0) {
      setIsDropdownOpen(true);
    }
    const ref = input === "key" ? keyInputRef : valueInputRef;
    if (ref.current) {
      setCursorPosition(ref.current.selectionStart || 0);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !relatedTarget.closest(".kv-variable-dropdown")) {
      setTimeout(() => {
        setIsDropdownOpen(false);
        setActiveInput(null);
      }, 150);
    }
  };

  const updateCursorPosition = () => {
    const ref = activeInput === "key" ? keyInputRef : valueInputRef;
    if (ref.current) {
      setCursorPosition(ref.current.selectionStart || 0);
    }
  };

  const insertVariable = (variable: string) => {
    const variableText = `{{${variable}}}`;
    const currentValue = activeInput === "key" ? editedKey : editedValue;
    const setter = activeInput === "key" ? setEditedKey : setEditedValue;
    const ref = activeInput === "key" ? keyInputRef : valueInputRef;

    const beforeCursor = currentValue.substring(0, cursorPosition);
    const afterCursor = currentValue.substring(cursorPosition);
    const newValue = beforeCursor + variableText + afterCursor;
    setter(newValue);

    setTimeout(() => {
      if (ref.current) {
        const newCursorPos = cursorPosition + variableText.length;
        ref.current.setSelectionRange(newCursorPos, newCursorPos);
        ref.current.focus();
      }
    }, 0);

    setIsDropdownOpen(false);
  };

  const canSave = editedKey.trim().length > 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-1 p-1 bg-primary/5 border border-primary/30 rounded-md ring-1 ring-primary/20">
        {/* Key input */}
        <Input
          ref={keyInputRef}
          value={editedKey}
          onChange={(e) => {
            setEditedKey(e.target.value);
            setTimeout(updateCursorPosition, 0);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={updateCursorPosition}
          onClick={updateCursorPosition}
          onSelect={updateCursorPosition}
          onFocus={() => handleFocus("key")}
          onBlur={handleBlur}
          placeholder={keyPlaceholder}
          disabled={disabled}
          className="h-7 text-xs font-mono border-0 bg-transparent shadow-none focus-visible:ring-0 flex-1 min-w-0"
        />

        <span className="text-muted-foreground text-xs px-1">=</span>

        {/* Value input */}
        <Input
          ref={valueInputRef}
          value={editedValue}
          onChange={(e) => {
            setEditedValue(e.target.value);
            setTimeout(updateCursorPosition, 0);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={updateCursorPosition}
          onClick={updateCursorPosition}
          onSelect={updateCursorPosition}
          onFocus={() => handleFocus("value")}
          onBlur={handleBlur}
          placeholder={valuePlaceholder}
          disabled={disabled}
          className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-0 flex-1 min-w-0"
        />

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={disabled || !canSave}
            className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
            title="Save (Enter)"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={disabled}
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Cancel (Escape)"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Variable dropdown */}
      {isDropdownOpen && availableVariables.length > 0 && (
        <div
          className="kv-variable-dropdown absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="p-1">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b mb-1">
              Insert Variable
            </div>
            {availableVariables.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                onMouseDown={(e) => e.preventDefault()}
                className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded-sm flex items-center gap-2"
              >
                <Variable className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-mono truncate">{variable}</span>
                <span className="ml-auto text-muted-foreground shrink-0">
                  {"{{" + variable + "}}"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
