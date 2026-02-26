export default function GameCardSkeleton() {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-sm">
      {/* Image placeholder */}
      <div className="aspect-[4/5] w-full animate-pulse bg-stone-200" />

      {/* Info placeholder */}
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
