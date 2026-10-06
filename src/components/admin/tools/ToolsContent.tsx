"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdArrowForward, MdSync } from "react-icons/md";
import { Link, useRouter } from "@/i18n/routing";
import { refreshCaches, type RefreshCachesJob, type RefreshCachesResult } from "@/lib/admin/ops-actions";
import { OPS_JOBS, type OpsJobStatus } from "@/lib/admin/ops-status";
import { AuditTimeLabel } from "../activity/AuditParts";
import { adminButtonClass } from "../adminButtons";
import Notice from "../Notice";
import StatusChip from "../StatusChip";

const CARD = "rounded-2xl bg-brand-white p-5 md:p-8";

type Outcome =
  | { kind: "results"; results: RefreshCachesResult[] }
  | { kind: "error"; code: "rate_limited" | "forbidden" | "unauthenticated" | "generic" };

function useSeconds() {
  const locale = useLocale();
  return (ms: number) => (ms / 1000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function JobStatusLine({ status, now }: { status: OpsJobStatus | undefined; now?: Date }) {
  const t = useTranslations("admin.tools");
  const seconds = useSeconds();

  if (!status) return <p className="text-sm text-stone-custom/65">{t("status_unavailable")}</p>;
  if (status.lastRunAt === null || status.lastOk === null) {
    return <p className="text-sm text-stone-custom/65">{t("never_run")}</p>;
  }

  const who = status.lastAutomatic
    ? t("run_automatic")
    : (status.lastActorName ?? status.lastActorNumber ?? t("run_manual_unknown"));
  const parts = [who];
  if (status.lastDurationMs !== null) parts.push(t("duration", { seconds: seconds(status.lastDurationMs) }));
  if (!status.lastOk) parts.push(t("error_code", { code: status.lastErrorCode ?? "error" }));

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-stone-custom/80">
        <StatusChip kind={status.lastOk ? "valid" : "error"} label={status.lastOk ? t("run_ok") : t("run_failed")} />
        <span>
          <AuditTimeLabel iso={status.lastRunAt} now={now} /> · {parts.join(" · ")}
        </span>
      </p>
      {!status.lastOk && (
        <p className="text-[13px] text-stone-custom/65">
          {status.lastSuccessAt ? (
            <>
              {t("last_success")} <AuditTimeLabel iso={status.lastSuccessAt} now={now} />
            </>
          ) : (
            t("no_success")
          )}
        </p>
      )}
    </div>
  );
}

function Outcomes({ outcome }: { outcome: Outcome | null }) {
  const t = useTranslations("admin.tools");
  const seconds = useSeconds();
  if (!outcome) return null;

  if (outcome.kind === "error") {
    return (
      <Notice kind="blocked">
        {t(
          outcome.code === "rate_limited"
            ? "error_rate_limited"
            : outcome.code === "forbidden"
              ? "error_forbidden"
              : outcome.code === "unauthenticated"
                ? "error_unauthenticated"
                : "error_generic",
        )}
      </Notice>
    );
  }

  const allOk = outcome.results.every((r) => r.ok);
  return (
    <Notice kind={allOk ? "info" : "warning"}>
      <p className="font-semibold">{t("result_title")}</p>
      <ul className="mt-1 list-disc pl-5">
        {outcome.results.map((r) => (
          <li key={r.job}>
            {r.ok
              ? t("result_ok", { job: t(`job_${r.job}`), seconds: seconds(r.durationMs) })
              : t("result_failed", { job: t(`job_${r.job}`), code: r.errorCode ?? "error" })}
          </li>
        ))}
      </ul>
    </Notice>
  );
}

type ToolsContentProps = {
  /** Null when `admin_ops_status` failed. */
  jobs: OpsJobStatus[] | null;
  now?: Date;
};

/** V-6: link to the event images tool and the cache refresh card (A-14). */
export default function ToolsContent({ jobs, now }: ToolsContentProps) {
  const t = useTranslations("admin.tools");
  const router = useRouter();
  const [busy, setBusy] = useState<RefreshCachesJob | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function run(job: RefreshCachesJob) {
    if (busy) return;
    setBusy(job);
    setOutcome(null);
    try {
      const answer = await refreshCaches(job);
      if ("error" in answer) {
        const code =
          answer.error === "rate_limited" || answer.error === "forbidden" || answer.error === "unauthenticated"
            ? answer.error
            : "generic";
        setOutcome({ kind: "error", code });
      } else {
        setOutcome({ kind: "results", results: answer.results });
        router.refresh();
      }
    } catch {
      setOutcome({ kind: "error", code: "generic" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pt-10 sm:px-6 md:pt-16">
      <section aria-labelledby="tools-events" className={`${CARD} flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-6`}>
        <div className="flex flex-col gap-2">
          <h2 id="tools-events" className="text-[22px] font-bold text-stone-custom">
            {t("events_title")}
          </h2>
          <p className="text-stone-custom/80">{t("events_text")}</p>
        </div>
        <Link href="/admin/tools/event-images" className={adminButtonClass("primary", "gap-2 max-md:w-full")}>
          {t("events_open")}
          <MdArrowForward aria-hidden="true" className="size-5" />
        </Link>
      </section>

      <section aria-labelledby="tools-cache" className={`${CARD} flex flex-col gap-5`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <h2 id="tools-cache" className="text-[22px] font-bold text-stone-custom">
              {t("cache_title")}
            </h2>
            <p className="text-stone-custom/80">{t("cache_intro")}</p>
          </div>
          <button
            type="button"
            onClick={() => run("all")}
            disabled={busy !== null}
            aria-busy={busy === "all"}
            className={adminButtonClass("secondary", "gap-2 max-md:w-full md:shrink-0")}
          >
            <MdSync aria-hidden="true" className={busy === "all" ? "size-5 animate-spin" : "size-5"} />
            {busy === "all" ? t("refreshing") : t("refresh_all")}
          </button>
        </div>

        {jobs === null && <Notice kind="blocked">{t("status_error")}</Notice>}

        <ul>
          {OPS_JOBS.map((name) => {
            const status = jobs?.find((j) => j.job === name);
            const nameId = `tools-job-${name}`;
            return (
              <li
                key={name}
                className="flex flex-col gap-3 border-t border-stone-custom/8 py-5 md:flex-row md:items-center md:justify-between md:gap-6"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <p id={nameId} className="font-semibold text-stone-custom">
                    {t(`job_${name}`)}
                  </p>
                  <div aria-live="polite">
                    <JobStatusLine status={status} now={now} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => run(name)}
                  disabled={busy !== null}
                  aria-busy={busy === name}
                  aria-describedby={nameId}
                  className={adminButtonClass("primary", "gap-2 max-md:w-full md:shrink-0")}
                >
                  <MdSync aria-hidden="true" className={busy === name ? "size-5 animate-spin" : "size-5"} />
                  {busy === name ? t("refreshing") : t("refresh_job")}
                </button>
              </li>
            );
          })}
        </ul>

        <div aria-live="polite">
          <Outcomes outcome={outcome} />
        </div>
        <p className="text-[13px] text-stone-custom/65">{t("cache_footnote")}</p>
      </section>
    </div>
  );
}
