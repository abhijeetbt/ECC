import Link from "next/link";

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  language: string;
  updatedAt: string | Date;
}

export default function ProjectList({
  projects,
  activeId,
}: {
  projects: ProjectListItem[];
  activeId?: string;
}) {
  if (projects.length === 0) {
    return (
      <p className="px-3 py-4 text-sm text-gray-500">
        No projects yet. Create one to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/dashboard/${project.id}`}
            className={`block rounded-md px-3 py-2 text-sm ${
              project.id === activeId
                ? "bg-brand/10 font-medium text-brand"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span className="block truncate">{project.name}</span>
            <span className="block text-xs text-gray-400">
              {project.language}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
