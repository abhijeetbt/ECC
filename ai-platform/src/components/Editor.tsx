"use client";

import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
}

// Maps our stored language values to Monaco's language ids.
const MONACO_LANGUAGE: Record<string, string> = {
  python: "python",
  javascript: "javascript",
};

export default function CodeEditor({
  value,
  language,
  onChange,
}: CodeEditorProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <Editor
        height="500px"
        language={MONACO_LANGUAGE[language] ?? "plaintext"}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
