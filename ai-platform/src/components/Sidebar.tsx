"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import ProjectList, { type ProjectListItem } from "./ProjectList";
import { SUPPORTED_LANGUAGES } from "@/lib/types";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeId = pathname?.split("/dashboard/")[1]?.split("/")[0];

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<string>("python");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects);
    }
  }

  useEffect(() => {
    load();
  }, [pathname]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, language }),
      });
      if (res.ok) {
        const data = await res.json();
        setName("");
        await load();
        router.push(`/dashboard/${data.project.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-3">
      <form onSubmit={createProject} className="mb-4 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create project"}
        </button>
      </form>
      <ProjectList projects={projects} activeId={activeId} />
    </aside>
  );
}
