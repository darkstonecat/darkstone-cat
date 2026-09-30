"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { MdCheckCircle, MdGridView, MdInfoOutline, MdOpenInNew } from "react-icons/md";
import { cn } from "@/lib/utils";
import { checkBggUsername, checkLudoyaUsername } from "@/lib/profile/username-checks";
import { linkGamingAccount, unlinkGamingAccount, type GamingService } from "@/lib/profile/details-actions";
import { useUsernameCheck } from "@/hooks/useUsernameCheck";

type GamingAccountsProps = {
  ludoyaUsername: string | null;
  bggUsername: string | null;
};

const CHECKERS = { ludoya: checkLudoyaUsername, bgg: checkBggUsername } as const;

function profileUrl(service: GamingService, username: string): string {
  return service === "bgg"
    ? `https://boardgamegeek.com/user/${encodeURIComponent(username)}`
    : `https://app.ludoya.com/${encodeURIComponent(username)}`;
}

function GamingTile({ service, initialUsername }: { service: GamingService; initialUsername: string | null }) {
  const t = useTranslations("profile.details");
  const inputId = useId();
  const [linked, setLinked] = useState<string | null>(initialUsername);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const check = useUsernameCheck(CHECKERS[service]);

  const name = t(`${service}_name`);
  const isLinked = linked !== null;

  async function handleLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !value.trim()) return;
    setBusy(true);
    setError(false);
    const result = await linkGamingAccount(service, value).catch(() => ({ error: "failed" as const }));
    setBusy(false);
    if (result.error === null && result.username) {
      setLinked(result.username);
      setValue("");
      check.reset();
    } else {
      setError(true);
    }
  }

  async function handleUnlink() {
    if (busy) return;
    setBusy(true);
    setError(false);
    const result = await unlinkGamingAccount(service).catch(() => ({ error: "failed" as const }));
    setBusy(false);
    if (result.error === null) setLinked(null);
    else setError(true);
  }

  const icon =
    service === "ludoya" ? (
      <MdGridView aria-hidden="true" className="size-5 text-stone-custom" />
    ) : (
      <span aria-hidden="true" className="text-xs font-bold text-brand-blue">
        BGG
      </span>
    );

  return (
    <div
      data-testid={`gaming-tile-${service}`}
      className={cn(
        "flex flex-col gap-3.5 rounded-xl p-5 sm:p-[22px]",
        isLinked ? "bg-stone-custom text-brand-white" : "border border-stone-custom/[0.12]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              service === "ludoya" && isLinked ? "bg-brand-white" : "bg-brand-beige"
            )}
          >
            {icon}
          </span>
          <span className="truncate text-base font-bold">{name}</span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
            isLinked ? "bg-brand-orange-light/20 text-brand-orange-light" : "bg-stone-custom/[0.07] text-stone-custom/65"
          )}
        >
          {isLinked ? t("linked") : t("not_linked")}
        </span>
      </div>

      {isLinked ? (
        <>
          <p className="break-all text-[15px] text-brand-white/75">@{linked}</p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={profileUrl(service, linked)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-white px-4 text-sm font-semibold text-stone-custom transition-colors hover:bg-brand-white/90"
            >
              {t(`view_${service}`)}
              <MdOpenInNew aria-hidden="true" className="size-4" />
              <span className="sr-only">{t("opens_new_tab")}</span>
            </a>
            <button
              type="button"
              onClick={handleUnlink}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-xl border border-brand-white/25 px-4 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-white/10 disabled:opacity-50"
            >
              {t("unlink")}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleLink} className="flex flex-col gap-3.5" noValidate>
          <label htmlFor={inputId} className="text-[13px] text-stone-custom/65">
            {t("link_help")}
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => void check.run(value)}
              placeholder={t(`${service}_placeholder`)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={65}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-2 text-base text-stone-custom outline-none transition-colors placeholder:text-stone-custom/50 focus:border-2 focus:border-brand-orange"
            />
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="inline-flex min-h-11 items-center rounded-xl bg-stone-custom px-4 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/90 disabled:opacity-50"
            >
              {t("link")}
            </button>
          </div>
        </form>
      )}

      <div aria-live="polite" className="empty:hidden">
        {!isLinked && check.state === "checking" && (
          <p role="status" className="text-[13px] text-stone-custom/65">
            {t("check_checking")}
          </p>
        )}
        {!isLinked && check.state === "found" && (
          <p role="status" className="flex items-center gap-1.5 text-[13px] font-medium text-green-700">
            <MdCheckCircle aria-hidden="true" className="size-4 shrink-0" />
            {t("check_found", { username: check.checked })}
          </p>
        )}
        {!isLinked && check.state === "not_found" && (
          <p role="status" className="flex items-center gap-1.5 text-[13px] font-medium text-brand-orange-text">
            <MdInfoOutline aria-hidden="true" className="size-4 shrink-0" />
            {t(`${service}_not_found`)}
          </p>
        )}
        {error && (
          <p role="alert" className={cn("text-[13px] font-medium", isLinked ? "text-brand-white" : "text-brand-red")}>
            {t("save_error")}
          </p>
        )}
      </div>
    </div>
  );
}

/** "On jugues": link or unlink the member's Ludoya and BoardGameGeek usernames. */
export default function GamingAccounts({ ludoyaUsername, bggUsername }: GamingAccountsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <GamingTile service="ludoya" initialUsername={ludoyaUsername} />
      <GamingTile service="bgg" initialUsername={bggUsername} />
    </div>
  );
}
