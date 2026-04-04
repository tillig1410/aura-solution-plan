"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <h1 className="text-4xl font-bold text-gray-900">Une erreur est survenue</h1>
      <p className="mt-4 text-gray-600">
        Quelque chose ne s&apos;est pas passé comme prévu.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Réessayer
      </button>
    </div>
  );
}
