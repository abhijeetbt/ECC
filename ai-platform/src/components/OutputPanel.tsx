"use client";

import { useState } from "react";

interface OutputPanelProps {
  result: string;
  loading: boolean;
  error: string | null;
}

export default function OutputPanel({ result, loading, error }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-[500px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <span className="text-sm font-medium text-gray-300">Generated tests</span>
        {result && !loading && (
          <button
            onClick={copy}
            className="text-xs font-medium text-gray-400 hover:text-white"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <p className="text-sm text-gray-400">Generating tests…</p>
        )}
        {error && !loading && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {!loading && !error && !result && (
          <p className="text-sm text-gray-500">
            Your generated test suite will appear here.
          </p>
        )}
        {!loading && result && (
          <pre className="whitespace-pre-wrap text-sm text-gray-100">
            <code>{result}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
