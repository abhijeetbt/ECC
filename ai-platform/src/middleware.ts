import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes don't require auth. Everything else (notably /dashboard and the
// project/usage/process APIs) is protected. The Stripe webhook must stay public
// — it authenticates via its own signature, not a Clerk session.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook/stripe",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|png|gif|svg|ico|webp|woff2?|ttf)).*)",
    "/(api|trpc)(.*)",
  ],
};
