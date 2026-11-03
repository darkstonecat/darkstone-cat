"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdClose, MdSearch } from "react-icons/md";
import { useRouter } from "@/i18n/routing";
import { awardBadgeToMembers, searchMembersForBadge, type BadgeMemberOption } from "@/lib/admin/badge-actions";
import { BADGE_BULK_MAX, BADGE_NOTE_MAX } from "@/lib/admin/badges";
import AdminDialog from "../AdminDialog";
import { INPUT_CLASS, TEXTAREA_CLASS } from "../member-file/errors";
import { badgeErrorKey } from "./shared";

const SEARCH_DELAY_MS = 250;

type BulkAwardDialogProps = {
  open: boolean;
  onClose: () => void;
  /** After the award: how many members got it and how many already had it. */
  onDone: (awarded: number, skipped: number) => void;
  badgeKey: string;
  badgeName: string;
};

type Search = { status: "loading" | "ready" | "error"; members: BadgeMemberOption[] };

const fullName = (member: BadgeMemberOption) => `${member.firstName} ${member.lastName}`.trim() || member.memberNumber;

/**
 * "Atorga a socis" (S7.5): debounced search of active members, a checkbox list where members
 * who already hold the badge are disabled, chips of the selection (kept across searches),
 * at most 100, optional note. All or nothing (`admin_award_badge_bulk`).
 */
export default function BulkAwardDialog(props: BulkAwardDialogProps) {
  // Mounted only while open, so every opening starts from a clean search and selection.
  return props.open ? <BulkAwardPanel {...props} /> : null;
}

function BulkAwardPanel({ onClose, onDone, badgeKey, badgeName }: BulkAwardDialogProps) {
  const t = useTranslations("admin.badges");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ status: "loading", members: [] });
  const [selected, setSelected] = useState<Map<string, BadgeMemberOption>>(() => new Map());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(0);
  const ids = { search: useId(), note: useId(), noteHint: useId(), count: useId() };

  useEffect(() => {
    const request = ++latest.current;
    const timer = setTimeout(
      async () => {
        setSearch((prev) => ({ status: "loading", members: prev.members }));
        try {
          const result = await searchMembersForBadge(badgeKey, query);
          if (request !== latest.current) return;
          setSearch("error" in result ? { status: "error", members: [] } : { status: "ready", members: result.members });
        } catch {
          if (request === latest.current) setSearch({ status: "error", members: [] });
        }
      },
      // The first list loads at once; typing waits for a pause.
      request === 1 ? 0 : SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [badgeKey, query]);

  const full = selected.size >= BADGE_BULK_MAX;

  function toggle(member: BadgeMemberOption) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(member.id)) next.delete(member.id);
      else if (next.size < BADGE_BULK_MAX) next.set(member.id, member);
      return next;
    });
  }

  function close() {
    if (busy) return;
    onClose();
  }

  async function confirm() {
    if (selected.size === 0) return;
    setBusy(true);
    setError("");
    try {
      const result = await awardBadgeToMembers(badgeKey, [...selected.keys()], note.trim() || null);
      if ("error" in result) {
        setError(t(badgeErrorKey(result.error)));
        setBusy(false);
        return;
      }
      setBusy(false);
      onDone(result.awarded, result.skipped);
      router.refresh();
    } catch {
      setError(t("errors.failed"));
      setBusy(false);
    }
  }

  return (
    <AdminDialog
      open
      onClose={close}
      onConfirm={confirm}
      title={t("award.title")}
      target={badgeName}
      confirmLabel={busy ? t("award.saving") : t("award.confirm", { count: selected.size })}
      confirmDisabled={selected.size === 0}
      confirmDisabledReason={t("award.disabled")}
      busy={busy}
      error={error || undefined}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.search} className="text-sm font-semibold text-stone-custom">
          {t("award.search_label")}
        </label>
        <div className="relative">
          <MdSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-stone-custom/50" />
          <input
            id={ids.search}
            type="search"
            data-autofocus
            autoComplete="off"
            maxLength={100}
            disabled={busy}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${INPUT_CLASS} pl-11`}
          />
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {search.status === "loading" ? t("award.searching") : ""}
      </div>
      {search.status === "error" ? (
        <p role="alert" className="text-sm text-brand-red">
          {t("award.search_error")}
        </p>
      ) : search.status === "ready" && search.members.length === 0 ? (
        <p className="text-sm text-stone-custom/65">{t("award.no_results")}</p>
      ) : (
        <ul
          aria-label={t("award.list_label")}
          aria-busy={search.status === "loading" || undefined}
          data-lenis-prevent
          className="max-h-[260px] overflow-auto rounded-xl border border-stone-custom/10"
        >
          {search.members.map((member) => {
            const name = fullName(member);
            const checked = selected.has(member.id);
            const disabled = busy || member.alreadyHolds || (full && !checked);
            return (
              <li key={member.id} className="border-t border-stone-custom/10 first:border-0">
                <label
                  className={`flex min-h-12 items-center gap-3 px-3.5 py-1.5 text-[15px] ${
                    disabled ? "cursor-not-allowed text-stone-custom/55" : "cursor-pointer text-stone-custom"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked || member.alreadyHolds}
                    disabled={disabled}
                    onChange={() => toggle(member)}
                    className="size-[18px] shrink-0 accent-stone-custom"
                  />
                  <span className="min-w-0 flex-1">
                    {name}
                    {member.alreadyHolds && <span> · {t("award.held")}</span>}
                  </span>
                  <span className="text-[13px] text-stone-custom/65 tabular-nums">{member.memberNumber}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-1.5">
          {[...selected.values()].map((member) => (
            <li key={member.id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-custom py-0.5 pr-0.5 pl-3 text-xs font-bold text-brand-white">
                {fullName(member)}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(member)}
                  aria-label={t("award.remove_aria", { name: fullName(member) })}
                  className="flex size-7 items-center justify-center rounded-full hover:bg-brand-white/15"
                >
                  <MdClose aria-hidden="true" className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <p id={ids.count} aria-live="polite" className="text-[13px] text-stone-custom/65">
          {t("award.selected", { count: selected.size, max: BADGE_BULK_MAX })}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.note} className="text-sm font-semibold text-stone-custom">
          {t("award.note_label")}
        </label>
        <textarea
          id={ids.note}
          rows={2}
          maxLength={BADGE_NOTE_MAX}
          disabled={busy}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby={ids.noteHint}
          className={TEXTAREA_CLASS}
        />
        <p id={ids.noteHint} className="text-[13px] text-stone-custom/65">
          {t("award.note_hint")}
        </p>
      </div>
    </AdminDialog>
  );
}
