import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProjectSchema } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

// Shared ownership check: returns the project if it belongs to the caller,
// otherwise an error response to return directly.
async function loadOwnedProject(id: string) {
  const user = await getOrCreateUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  if (project.userId !== user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { project };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { project, error } = await loadOwnedProject(id);
  if (error) return error;
  return NextResponse.json({ project });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { project, error } = await loadOwnedProject(id);
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const updated = await db.project.update({
    where: { id: project!.id },
    data: parsed.data,
  });
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { project, error } = await loadOwnedProject(id);
  if (error) return error;

  await db.project.delete({ where: { id: project!.id } });
  return NextResponse.json({ success: true });
}
