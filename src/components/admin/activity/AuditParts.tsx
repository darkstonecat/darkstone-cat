import { useTranslations } from "next-intl";
import type { AuditParam, AuditText, AuditActor, AdminActivityRow } from "@/lib/admin/audit-format";
import { describeAuditEntry, describeAuditTime } from "@/lib/admin/audit-format";
import StatusChip from "../StatusChip";

/** Message function of the `admin.activity` namespace (loose on purpose: keys come from the renderer). */
type Translate = (key: string, values?: Record<string, string | number>) => string;

function resolveParam(t: Translate, value: AuditParam): string | number {
  if (typeof value === "string" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map((item) => resolveParam(t, item)).join(", ");
  return t(value.i18n);
}

/** Resolves a structured audit text into the current locale. */
export function renderAuditText(t: Translate, text: AuditText): string {
  const values: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(text.params)) values[name] = resolveParam(t, value);
  return t(text.key, values);
}

const NO_VALUE = "—";

/** "Marta Puig" + role chip, "000-154 (ell mateix)" or "Sistema". */
export function AuditActorLabel({ actor, withChip = true }: { actor: AuditActor; withChip?: boolean }) {
  const t = useTranslations("admin.activity");
  if (actor.kind === "system") return <strong className="font-semibold">{t("actor_system")}</strong>;
  const label =
    actor.kind === "self"
      ? t("actor_self", { number: actor.number ?? NO_VALUE })
      : (actor.name ?? actor.number ?? NO_VALUE);
  return (
    <>
      <strong className="font-semibold break-words">{label}</strong>
      {withChip && actor.role && (
        <StatusChip kind={actor.role} className="mt-1 block w-fit px-2 py-0.5 text-[11px]" />
      )}
    </>
  );
}

/** `<time>` with "Avui 10:42" / "Ahir 19:30" / "3/10/2026 20:10". */
export function AuditTimeLabel({ iso, now }: { iso: string; now?: Date }) {
  const t = useTranslations("admin.activity");
  const parts = describeAuditTime(iso, now);
  if (!parts) return <span>{NO_VALUE}</span>;
  const text =
    parts.kind === "today"
      ? t("time_today", { time: parts.time })
      : parts.kind === "yesterday"
        ? t("time_yesterday", { time: parts.time })
        : t("time_date", { date: parts.date, time: parts.time });
  return <time dateTime={iso}>{text}</time>;
}

/** Sentence, detail line and reason of one entry, rendered as plain text. */
export function useAuditLines(entry: AdminActivityRow) {
  const t = useTranslations("admin.activity") as unknown as Translate;
  const description = describeAuditEntry(entry);
  const details = description.details.map((detail) => renderAuditText(t, detail));
  if (description.reason) details.push(t("reason_line", { reason: description.reason }));
  return {
    actor: description.actor,
    sentence: renderAuditText(t, description.sentence),
    detail: details.join(" · "),
  };
}
