import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { Label } from "@/components/httpchain/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/httpchain/components/ui/select";
import { Input } from "@/components/httpchain/components/ui/input";

// HTTPResponse root fields
const HTTP_RESPONSE_ROOTS = [
  "json_body",
  "text_body",
  "html_body",
  "json_ld_data",
  "application_json_data",
  "meta_tags_data",
  "response_headers",
  "response_cookies",
  "status_code",
  "response_url",
  "response_time",
  "failed",
  "failure_reason",
] as const;

// Fields that can be iterated (can have additional path items)
const ITERABLE_ROOTS = [
  "response_headers",
  "response_cookies",
  "json_body",
  "json_ld_data",
  "application_json_data",
  "meta_tags_data",
] as const;

type HttpResponseRoot = (typeof HTTP_RESPONSE_ROOTS)[number];

interface PathBuilderProps {
  value: string[];
  onChange: (path: string[]) => void;
  disabled?: boolean;
  label?: string;
}

export function PathBuilder({
  value,
  onChange,
  disabled,
  label = "Path",
}: PathBuilderProps) {
  // Initialize from value if it exists, otherwise empty
  const initialRoot =
    value && value.length > 0 ? (value[0] as HttpResponseRoot) : "";
  const initialItems = value && value.length > 1 ? value.slice(1) : [];

  const [root, setRoot] = useState<HttpResponseRoot | "">(initialRoot);
  const [pathItems, setPathItems] = useState<string[]>(initialItems);

  // Sync state when value prop changes externally (only when value actually changes)
  useEffect(() => {
    const newRoot =
      value && value.length > 0 ? (value[0] as HttpResponseRoot) : "";
    const isIterable =
      newRoot &&
      ITERABLE_ROOTS.includes(newRoot as (typeof ITERABLE_ROOTS)[number]);
    const newItems =
      isIterable && value && value.length > 1 ? value.slice(1) : [];

    if (newRoot !== root) {
      setRoot(newRoot);
    }
    if (JSON.stringify(newItems) !== JSON.stringify(pathItems)) {
      setPathItems(newItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (root) {
      onChange([root, ...pathItems]);
    } else {
      onChange([]);
    }
  }, [root, pathItems, onChange]);

  const handleRootChange = (newRoot: HttpResponseRoot) => {
    setRoot(newRoot);
    // Clear path items if switching to non-iterable root
    if (!ITERABLE_ROOTS.includes(newRoot as (typeof ITERABLE_ROOTS)[number])) {
      setPathItems([]);
    }
  };

  const handleAddItem = () => {
    setPathItems([...pathItems, ""]);
  };

  const handleRemoveItem = (index: number) => {
    setPathItems(pathItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, newValue: string) => {
    const updated = [...pathItems];
    updated[index] = newValue;
    setPathItems(updated);
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      {/* Root selector */}
      <div className="space-y-2">
        <Select
          value={root}
          onValueChange={(v) => handleRootChange(v as HttpResponseRoot)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select root field" />
          </SelectTrigger>
          <SelectContent>
            {HTTP_RESPONSE_ROOTS.map((rootField) => (
              <SelectItem key={rootField} value={rootField}>
                {rootField}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Select the root field from HTTPResponse
        </p>
      </div>

      {/* Path items - only show for iterable roots */}
      {root &&
        ITERABLE_ROOTS.includes(root as (typeof ITERABLE_ROOTS)[number]) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Path Items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddItem}
                disabled={disabled}
                className="h-7"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
            </div>

            {pathItems.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No additional path items. The path will be just the root field.
              </p>
            )}

            <div className="space-y-2">
              {pathItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={item}
                    onChange={(e) => handleItemChange(index, e.target.value)}
                    placeholder={`Item ${index + 1} (string or number)`}
                    disabled={disabled}
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveItem(index)}
                    disabled={disabled}
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Add string keys or numeric indices to navigate deeper into the
              response structure
            </p>
          </div>
        )}
    </div>
  );
}
