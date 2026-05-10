import { useRef } from "react";
import { highlightCode, type CodeLanguage } from "../lib/syntax";
import { Label } from "./ui/label";

export function CodeEditor({
  label,
  language,
  path,
  value,
  manual,
  onChange,
  readOnly = false,
}: {
  label: string;
  language: CodeLanguage;
  path?: string;
  value: string;
  manual?: boolean;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineCount = Math.max(1, value.split("\n").length);
  const editorHeight = `${Math.min(Math.max(lineCount, 3), 24) * 20.4 + 28}px`;

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <Label>{label}</Label>
        <div className="truncate text-xs text-muted-foreground">{manual ? "手动编辑" : path}</div>
      </div>
      <div className="code-editor" style={{ height: editorHeight }}>
        <pre ref={highlightRef} aria-hidden="true" className="code-highlight">
          <code dangerouslySetInnerHTML={{ __html: highlightCode(value, language) || "<br />" }} />
        </pre>
        <textarea
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          className="code-input"
          onScroll={(event) => {
            if (highlightRef.current) {
              highlightRef.current.scrollTop = event.currentTarget.scrollTop;
              highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
          onChange={(event) => onChange?.(event.target.value)}
          aria-label={label}
        />
      </div>
    </div>
  );
}
