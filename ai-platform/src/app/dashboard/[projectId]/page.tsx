"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CodeEditor from "@/components/Editor";
import OutputPanel from "@/components/OutputPanel";
import ProcessButton from "@/components/ProcessButton";

interface Project {
  id: string;
  name: string;
  description: string | null;
  code: string;
  language: string;
  lastResult: string | null;
}

export default function ProjectEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the project on mount / when the id changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        if (!cancelled) setError("Could not load this project.");
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setProject(data.project);
      setCode(data.project.code ?? "");
      setResult(data.project.lastResult ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const save = useCallback(async () => {
    if (!project) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
    } finally {
      setSaving(false);
    }
  }, [project, projectId, code]);

  async function generate() {
    if (!project || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          code,
          language: project.language,
          action: "generate_tests",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Generation failed. Please try again.");
        return;
      }
      setResult(data.result);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  if (error && !project) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!project) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-sm text-gray-500 capitalize">{project.language}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <ProcessButton onClick={generate} loading={loading} disabled={!code.trim()} />
          <button
            onClick={remove}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CodeEditor value={code} language={project.language} onChange={setCode} />
        <OutputPanel result={result} loading={loading} error={error} />
      </div>
    </div>
  );
}
