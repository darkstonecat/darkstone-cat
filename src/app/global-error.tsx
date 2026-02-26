"use client";

import ErrorContent from "@/components/ErrorContent";
import "@/styles/globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ca">
      <body>
        <main className="relative min-h-screen font-sans bg-stone-custom selection:bg-stone-300">
          <ErrorContent
            code="500"
            title="Alguna cosa ha anat malament"
            description="S'ha produït un error inesperat. Si us plau, torna-ho a provar."
          >
            <button
              onClick={reset}
              className="inline-block rounded-full bg-brand-white/10 px-6 py-3 text-sm font-medium text-brand-white transition-colors hover:bg-brand-white/20"
            >
              Tornar a intentar
            </button>
          </ErrorContent>
        </main>
      </body>
    </html>
  );
}
