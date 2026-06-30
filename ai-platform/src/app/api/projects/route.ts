import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProjectSchema } from "@/lib/types";

// GET /api/projects — list the caller's projects (newest first).
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      language: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ projects });
}

// POST /api/projects — create a new project.
export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const project = await db.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      language: parsed.data.language,
      code: parsed.data.code ?? "",
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
