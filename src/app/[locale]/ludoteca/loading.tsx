import NavBar from "@/components/NavBar";

const SKELETON_COUNT = 12;

function CardSkeleton() {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-stone-200/50 bg-white">
      <div className="aspect-[4/5] w-full animate-pulse bg-stone-200" />
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
        <div className="mt-auto flex flex-col gap-2">
          <div className="h-3 w-full animate-pulse rounded bg-stone-100" />
          <div className="h-1.5 w-16 animate-pulse rounded bg-stone-100" />
        </div>
      </div>
    </div>
  );
}

export default function LudotecaLoading() {
  return (
    <main className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <NavBar />

      {/* Hero skeleton */}
      <section className="bg-stone-custom pt-24 pb-6">
        <div className="container mx-auto px-6 text-center">
          <div className="mx-auto h-12 w-64 animate-pulse rounded-lg bg-brand-white/10 sm:h-14 md:h-16" />
          <div className="mx-auto mt-4 h-5 w-80 max-w-full animate-pulse rounded bg-brand-white/5" />
          <div className="mx-auto mt-3 h-4 w-48 animate-pulse rounded bg-brand-white/5" />
        </div>
      </section>

      {/* Content skeleton */}
      <section className="flex-1 bg-brand-beige pb-20">
        <div className="container mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div className="flex gap-8">
            {/* Sidebar skeleton — desktop only */}
            <aside className="hidden w-[300px] shrink-0 md:block">
              <div className="flex flex-col gap-6 rounded-2xl border border-stone-200 bg-white p-6">
                <div className="h-10 w-full animate-pulse rounded-full bg-stone-100" />
                <hr className="border-stone-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-stone-100" />
                  ))}
                </div>
                <hr className="border-stone-200" />
                <div className="h-4 w-28 animate-pulse rounded bg-stone-200" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="h-9 w-9 animate-pulse rounded-full bg-stone-100" />
                  ))}
                </div>
                <hr className="border-stone-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-stone-100" />
                  ))}
                </div>
              </div>
            </aside>

            {/* Grid skeleton */}
            <div className="min-w-0 flex-1">
              <div className="mb-4 hidden items-center justify-between md:flex">
                <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
                <div className="h-9 w-40 animate-pulse rounded-lg bg-white" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 min-[1200px]:grid-cols-3">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
