import { PathBuilder } from "./PathBuilder";

interface JsonPathArrayExtractorProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export function JsonPathArrayExtractor({
  value,
  onChange,
  disabled,
}: JsonPathArrayExtractorProps) {
  return (
    <PathBuilder
      value={value}
      onChange={onChange}
      disabled={disabled}
      label="JSON Path"
    />
  );
}
