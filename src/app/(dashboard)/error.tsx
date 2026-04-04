"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-semibold text-gray-900">Erreur de chargement</h2>
      <p className="mt-2 text-gray-600">Impossible de charger cette page.</p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Réessayer
      </button>
    </div>
  );
}
