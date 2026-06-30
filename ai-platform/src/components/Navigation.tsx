import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function Navigation() {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <Link href="/dashboard" className="text-lg font-bold text-brand">
        TestForge
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Projects
        </Link>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
