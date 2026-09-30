"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MdCheckCircle, MdGridView, MdInfoOutline, MdOpenInNew } from "react-icons/md";
import { cn } from "@/lib/utils";
import { checkBggUsername, checkLudoyaUsername } from "@/lib/profile/username-checks";
import { linkGamingAccount, unlinkGamingAccount, type GamingService } from "@/lib/profile/details-actions";
import { useUsernameCheck } from "@/hooks/useUsernameCheck";
import LiveMessages from "./LiveMessages";

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
  const [error, setError] = useState<"invalid" | "failed" | null>(null);
  const linkedRef = useRef<HTMLParagraphElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set by the link/unlink handlers: the button that had focus disappears, so focus moves to what replaces it.
  const focusAfter = useRef<"linked" | "input" | null>(null);
  const check = useUsernameCheck(CHECKERS[service]);

  const name = t(`${service}_name`);
  const isLinked = linked !== null;

  useEffect(() => {
    if (focusAfter.current === "linked") linkedRef.current?.focus();
    else if (focusAfter.current === "input") inputRef.current?.focus();
    focusAfter.current = null;
  }, [linked]);

  async function handleLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !value.trim()) return;
    setBusy(true);
    setError(null);
    const result = await linkGamingAccount(service, value).catch(() => ({ error: "failed" as const }));
    setBusy(false);
    if (result.error === null && result.username) {
      focusAfter.current = "linked";
      setLinked(result.username);
      setValue("");
      check.reset();
    } else {
      setError(result.error === "invalid" ? "invalid" : "failed");
    }
  }

  async function handleUnlink() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await unlinkGamingAccount(service).catch(() => ({ error: "failed" as const }));
    setBusy(false);
    if (result.error === null) {
      focusAfter.current = "input";
      setLinked(null);
    } else {
      setError("failed");
    }
  }

  let status: ReactNode = null;
  let statusClass = "text-stone-custom/65";
  if (!isLinked && check.state === "checking") {
    status = t("check_checking");
  } else if (!isLinked && check.state === "found") {
    statusClass = "flex items-center gap-1.5 font-medium text-green-700";
    status = (
      <>
        <MdCheckCircle aria-hidden="true" className="size-4 shrink-0" />
        {t("check_found", { username: check.checked })}
      </>
    );
  } else if (!isLinked && check.state === "not_found") {
    statusClass = "flex items-center gap-1.5 font-medium text-brand-orange-text";
    status = (
      <>
        <MdInfoOutline aria-hidden="true" className="size-4 shrink-0" />
        {t(`${service}_not_found`)}
      </>
    );
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
          <p ref={linkedRef} tabIndex={-1} className="break-all text-[15px] text-brand-white/75 outline-none">
            @{linked}
          </p>
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
              aria-disabled={busy}
              className="inline-flex min-h-11 items-center rounded-xl border border-brand-white/25 px-4 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-white/10 aria-disabled:opacity-50"
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
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => void check.run(value)}
              placeholder={t(`${service}_placeholder`)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={65}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-2 text-base text-stone-custom transition-colors placeholder:text-stone-custom/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
            />
            <button
              type="submit"
              aria-disabled={busy || !value.trim()}
              className="inline-flex min-h-11 items-center rounded-xl bg-stone-custom px-4 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/90 aria-disabled:opacity-50"
            >
              {t("link")}
            </button>
          </div>
        </form>
      )}

      <LiveMessages
        // Collapse the flex gap while both regions are empty.
        className={status || error ? undefined : "-mt-3.5"}
        statusClassName={statusClass}
        errorClassName={isLinked ? "text-brand-white" : "text-brand-red"}
        status={status}
        error={error ? t(error === "invalid" ? "save_invalid" : "save_error") : null}
      />
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
