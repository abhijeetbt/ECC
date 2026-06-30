import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
        Powered by Claude
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Ship tested code, faster.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-gray-600">
        TestForge turns a Python or JavaScript function into a thorough unit test
        suite in seconds — happy paths, edge cases, and error handling included.
      </p>

      <div className="mt-8 flex gap-4">
        <SignedOut>
          <Link
            href="/sign-up"
            className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark"
          >
            Get started free
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-100"
          >
            Sign in
          </Link>
        </SignedOut>
        <SignedIn>
          <Link
            href="/dashboard"
            className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark"
          >
            Open dashboard
          </Link>
        </SignedIn>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        Free tier: 100K tokens / month · 5 projects
      </p>
    </main>
  );
}
