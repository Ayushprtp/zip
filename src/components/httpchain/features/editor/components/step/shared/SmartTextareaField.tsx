import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/httpchain/components/ui/textarea";
import { Variable } from "lucide-react";

interface SmartTextareaFieldProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  availableVariables?: string[];
}

export function SmartTextareaField({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  disabled,
  autoFocus,
  availableVariables = [],
}: SmartTextareaFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleFocus = () => {
    if (availableVariables.length > 0) {
      setIsOpen(true);
    }
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart || 0);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !relatedTarget.closest(".variable-dropdown")) {
      setTimeout(() => setIsOpen(false), 200);
    }
  };

  const updateCursorPosition = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart || 0);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setTimeout(updateCursorPosition, 0);
  };

  const handleInputClick = () => {
    updateCursorPosition();
    if (availableVariables.length > 0) {
      setIsOpen(true);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    updateCursorPosition();
    onKeyDown?.(e);
  };

  const handleInputKeyUp = () => {
    updateCursorPosition();
  };

  const insertVariable = (variable: string) => {
    const variableText = `{{${variable}}}`;
    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);
    const newValue = beforeCursor + variableText + afterCursor;
    onChange(newValue);

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = cursorPosition + variableText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);

    setIsOpen(false);
  };

  if (availableVariables.length === 0) {
    return (
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    );
  }

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onKeyUp={handleInputKeyUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleInputClick}
        onSelect={updateCursorPosition}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {isOpen && (
        <div
          className="variable-dropdown absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="p-1">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b">
              Available Variables
            </div>
            {availableVariables.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                onMouseDown={(e) => e.preventDefault()}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-sm flex items-center gap-2"
              >
                <Variable className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono">{variable}</span>
                <span className="ml-auto text-muted-foreground">
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
