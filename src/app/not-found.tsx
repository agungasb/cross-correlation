import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0a0e17] text-slate-200 gap-3">
      <h1 className="text-xl font-bold text-cyan-400">404 — Page Not Found</h1>
      <Link
        href="/"
        className="px-4 py-2 rounded bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500"
      >
        Return to 3D Triad Market Analyzer
      </Link>
    </div>
  );
}
