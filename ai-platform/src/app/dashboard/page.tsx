import Link from "next/link";
import { getOrCreateUser } from "@/lib/auth";
import { getUsageSummary } from "@/lib/usage";

export default async function DashboardHome() {
  const user = await getOrCreateUser();
  const usage = user ? await getUsageSummary(user.id, user.plan) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Welcome to TestForge</h1>
      <p className="mt-2 text-gray-600">
        Create a project from the sidebar, paste a function, and generate a unit
        test suite.
      </p>

      {usage && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700">
            This month&apos;s usage
          </h2>
          <div className="mt-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}{" "}
                tokens
              </span>
              <span className="capitalize">{usage.plan} plan</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-brand"
                style={{
                  width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                }}
              />
            </div>
          </div>
          {usage.exceeded && (
            <p className="mt-3 text-sm text-red-600">
              You&apos;ve hit your monthly limit.{" "}
              <Link href="/dashboard" className="font-medium underline">
                Upgrade
              </Link>{" "}
              to keep generating.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
