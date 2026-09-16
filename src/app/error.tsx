"use client";

import { useEffect } from "react";

/**
 * Shown when a page throws. The most likely cause on this app is the database
 * being unreachable — Neon sleeps an idle free-tier project, and a phone on
 * shop wifi drops out — so the copy says what to do rather than apologising.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md w-full mx-auto">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-ink-soft">
        The khata could not be loaded. Check the internet connection and try
        again.
      </p>

      <button
        type="button"
        onClick={retry}
        className="mt-6 tap h-14 rounded-xl bg-brand text-white text-lg font-semibold
                   active:bg-brand-dark"
      >
        Try again
      </button>

      {/*
        The digest is the only handle on the server-side error, which is not
        sent to the browser. Worth showing so it can be quoted, but quiet.
      */}
      {error.digest ? (
        <p className="mt-4 text-center text-xs text-ink-faint">
          Reference: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
