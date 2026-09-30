/** Grid placeholder. Pass `label` to announce it as a status; without it the skeleton is silent. */
export default function CalendarSkeleton({ label }: { label?: string }) {
  return (
    <div {...(label ? { role: "status" } : {})} aria-busy="true" className="flex flex-col gap-1.5">
      {label && <span className="sr-only">{label}</span>}
      <div aria-hidden="true" className="grid animate-pulse grid-cols-7 gap-1 md:gap-1.5">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="h-11 rounded-[10px] bg-stone-custom/8 md:h-28" />
        ))}
      </div>
    </div>
  );
}
