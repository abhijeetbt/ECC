import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";

/**
 * Ensure a `User` row exists for the currently signed-in Clerk user, and return
 * it. We key our `User.id` on the Clerk user id so there's no separate mapping.
 *
 * Returns `null` when there is no authenticated user.
 */
export async function getOrCreateUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.user.findUnique({ where: { id: userId } });
  if (existing) return existing;

  // First time we've seen this user — pull their profile from Clerk to seed the
  // row. `currentUser()` is only called on the create path to keep the common
  // case (returning user) to a single indexed lookup.
  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    `${userId}@placeholder.local`;
  const name =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    null;

  return db.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email, name },
  });
}

/** Convenience: the Clerk user id, or null. */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}
