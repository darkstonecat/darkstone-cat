"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdLockOutline } from "react-icons/md";
import AuthHero from "@/components/auth/AuthHero";
import RegisterForm from "@/components/auth/RegisterForm";
import RegisterDone from "@/components/auth/RegisterDone";

const STEPS = ["register_step_account", "register_step_member", "register_step_play"] as const;

/** Overview of the three fieldsets. All orange on purpose: it is not a progress state. */
function Steps() {
  const t = useTranslations("auth");
  return (
    <ol
      aria-label={t("register_steps_label")}
      className="mt-9 flex items-start justify-center text-sm font-semibold text-brand-white md:items-center md:gap-4"
    >
      {STEPS.map((key, i) => (
        <li key={key} className="flex items-start md:items-center md:gap-4">
          <span className="flex w-[92px] flex-col items-center gap-2 text-xs md:w-auto md:flex-row md:gap-2.5 md:text-sm">
            <span
              aria-hidden="true"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand-orange text-sm"
            >
              {i + 1}
            </span>
            {t(key)}
          </span>
          {i < STEPS.length - 1 && (
            <span
              aria-hidden="true"
              className="mt-[15px] h-px w-5 bg-brand-white/25 md:mt-0 md:w-12"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

function Aside() {
  const t = useTranslations("auth");
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-28 lg:w-[300px] lg:shrink-0 lg:self-start">
      <div className="flex flex-col gap-3.5 rounded-2xl bg-stone-custom p-6 text-brand-white md:p-7">
        <h2 className="text-xl font-bold">{t("register_aside_title")}</h2>
        <p className="text-sm leading-relaxed text-brand-white/70">{t("register_aside_text")}</p>
      </div>
      <div className="flex flex-col gap-2.5 rounded-2xl border border-stone-custom/15 p-6 text-sm leading-normal text-stone-custom/75">
        <h2 className="flex items-center gap-2 font-semibold text-stone-custom">
          <MdLockOutline size={18} aria-hidden="true" />
          {t("register_data_title")}
        </h2>
        <p>{t("register_data_text")}</p>
      </div>
    </aside>
  );
}

/**
 * `/register`: the form and, after a successful sign-up, the "Revisa el teu
 * correu" screen (02b) swapped in place. The form stays mounted (hidden) so
 * "back to the form" keeps every value.
 */
export default function RegisterFlow() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const done = submittedEmail !== null;

  useEffect(() => {
    if (done) headingRef.current?.focus();
  }, [done]);

  return (
    <>
      <AuthHero
        titleKey={done ? "register_done_title" : "register_title"}
        subtitleKey={done ? "register_done_subtitle" : "register_subtitle"}
        headingRef={headingRef}
      >
        {!done && <Steps />}
      </AuthHero>

      <section className="flex-1 bg-brand-beige pt-8 pb-14 md:pt-14 md:pb-[72px]" hidden={done}>
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 md:px-12 lg:flex-row-reverse lg:gap-12">
          <RegisterForm
            onSuccess={(email, saved) => {
              setProfileSaved(saved);
              setSubmittedEmail(email);
              window.scrollTo({ top: 0 });
            }}
          />
          <Aside />
        </div>
      </section>

      {done && (
        <RegisterDone
          email={submittedEmail}
          profileSaved={profileSaved}
          onBack={() => {
            setSubmittedEmail(null);
            requestAnimationFrame(() => document.getElementById("email")?.focus());
          }}
        />
      )}
    </>
  );
}
