export default function GameListRowSkeleton() {
  return (
    <div className="flex w-full items-center gap-4 rounded-xl bg-white p-3 shadow-sm">
      {/* Thumbnail placeholder */}
      <div className="h-20 w-20 shrink-0 animate-pulse rounded-lg bg-stone-200" />

      {/* Info placeholder */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-stone-100" />
      </div>
    </div>
  );
}
