import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-zinc-100 via-zinc-50 to-teal-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-teal-950/20">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
      >
        Go to dashboard
      </Link>
      <Link
        href="/login"
        className="mt-3 text-sm text-teal-600 dark:text-teal-400 hover:underline"
      >
        Sign in
      </Link>
    </div>
  );
}

