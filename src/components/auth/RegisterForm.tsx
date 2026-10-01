"use client";

import {
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  MdArrowForward,
  MdAutorenew,
  MdCheck,
  MdOutlineErrorOutline,
  MdOutlineGridView,
} from "react-icons/md";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { discardUnconfirmedSignup, prepareSignup, updateMemberAfterSignup } from "@/lib/supabase/actions";
import { checkBggUsername, checkLudoyaUsername } from "@/lib/profile/username-checks";
import { useUsernameCheck, type UsernameCheckState } from "@/hooks/useUsernameCheck";
import { isValidDniNie } from "@/lib/validation/member-fields";
import { cn } from "@/lib/utils";

type FormStatus = "idle" | "submitting" | "error";

type FieldErrors = {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  dni?: string;
  conduct?: string;
  privacy?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "min-h-11 w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-[11px] text-base text-stone-custom placeholder:text-stone-custom/50 outline-none transition-colors focus:border-brand-orange focus-visible:outline-2 focus-visible:outline-brand-orange focus-visible:outline-offset-2 disabled:opacity-50";
const labelClass = "text-sm font-medium text-stone-custom/80";
const cardClass = "rounded-2xl bg-brand-white";
const linkClass =
  "font-medium text-brand-orange-text underline transition-colors hover:text-brand-orange";

/** Presentational 0-3 score; the only enforced rule stays "at least 8 characters". */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  return (
    (password.length >= 8 ? 1 : 0) +
    (password.length >= 8 && classes >= 3 ? 1 : 0) +
    (password.length >= 12 && classes >= 3 ? 1 : 0)
  );
}

/**
 * Card-style fieldset. A `<legend>` sits on the fieldset's border box and ignores its
 * padding, so the padding lives on the legend and on the body instead.
 */
function FieldsetCard({
  legend,
  step,
  className,
  bodyClassName = "gap-5",
  children,
}: {
  legend: string;
  step?: number;
  className: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="float-left w-full px-5 pt-5 md:px-8 md:pt-8">
        <span className="flex items-center gap-3 text-lg font-bold tracking-tight text-stone-custom md:text-xl">
          {step !== undefined && (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-custom text-sm font-semibold text-brand-white"
            >
              {step}
            </span>
          )}
          {legend}
        </span>
      </legend>
      <div className={cn("clear-both flex flex-col p-5 md:p-8 md:pt-6", bodyClassName)}>{children}</div>
    </fieldset>
  );
}

function Star() {
  return (
    <span className="text-brand-red" aria-hidden="true">
      *
    </span>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  optionalLabel?: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

function TextField({
  id,
  label,
  required,
  optionalLabel,
  error,
  hint,
  className,
  ...input
}: TextFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && (
          <>
            {" "}
            <Star />
          </>
        )}
        {optionalLabel && (
          <span className="font-normal text-stone-custom/65"> {optionalLabel}</span>
        )}
      </label>
      <input
        id={id}
        name={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={!!error}
        aria-describedby={
          [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined
        }
        className={inputClass}
        {...input}
      />
      {hint}
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-brand-red">
          {error}
        </p>
      )}
    </div>
  );
}

function CheckStatus({
  state,
  name,
  notFoundText,
}: {
  state: UsernameCheckState;
  name: string;
  notFoundText: string;
}) {
  const t = useTranslations("auth");
  return (
    <p role="status" className="text-[13px] leading-snug">
      {state === "checking" && (
        <span className="flex items-center gap-1.5 text-stone-custom/65">
          <MdAutorenew size={14} aria-hidden="true" className="animate-spin" />
          {t("register_check_checking")}
        </span>
      )}
      {state === "found" && (
        <span className="flex items-center gap-1.5 text-green-700">
          <MdCheck size={14} aria-hidden="true" className="shrink-0" />
          <span>
            {t.rich("register_check_found", {
              name,
              strong: (chunks: ReactNode) => <strong className="font-semibold">{chunks}</strong>,
            })}
          </span>
        </span>
      )}
      {state === "not_found" && (
        <span className="flex items-start gap-1.5 text-brand-orange-text">
          <MdOutlineErrorOutline size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {notFoundText}
        </span>
      )}
    </p>
  );
}

/** GoTrue answers a sign-up for a confirmed email with "User already registered". */
function isAlreadyRegistered(error: { message?: string; code?: string }): boolean {
  return (
    error.code === "user_already_exists" ||
    !!error.message?.includes("already registered") ||
    !!error.message?.includes("already been registered")
  );
}

type Props = {
  /**
   * Called with the (trimmed) submitted email once the form is done. It is the
   * same call whether the account is new or the email was already registered,
   * so the screen after it never reveals which one happened.
   */
  onSuccess: (email: string) => void;
};

export default function RegisterForm({ onSuccess }: Props) {
  const t = useTranslations("auth");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [password, setPassword] = useState("");
  const ludoya = useUsernameCheck(checkLudoyaUsername);
  const bgg = useUsernameCheck(checkBggUsername);
  /** Sign-up already created for this form ("back to the form" keeps the values). */
  const pendingSignupId = useRef<string | null>(null);

  function validate(form: FormData): FieldErrors {
    const errs: FieldErrors = {};
    const email = (form.get("email") as string).trim();
    const pass = form.get("password") as string;
    const dni = (form.get("dni") as string).trim();

    if (!email) {
      errs.email = t("required_field");
    } else if (!EMAIL_RE.test(email)) {
      errs.email = t("invalid_email");
    }

    if (!pass) {
      errs.password = t("required_field");
    } else if (pass.length < 8) {
      errs.password = t("password_min_length");
    }

    if (!(form.get("first_name") as string).trim()) errs.first_name = t("required_field");
    if (!(form.get("last_name") as string).trim()) errs.last_name = t("required_field");

    if (dni && !isValidDniNie(dni)) {
      errs.dni = t("invalid_dni");
    }

    if (!form.get("conduct")) errs.conduct = t("must_accept_conduct");
    if (!form.get("privacy")) errs.privacy = t("must_accept_privacy");

    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const fieldErrors = validate(formData);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setStatus("submitting");
    setErrorMessage("");

    const email = (formData.get("email") as string).trim();
    const firstName = (formData.get("first_name") as string).trim();
    const lastName = (formData.get("last_name") as string).trim();

    // The person went back to fix the email and submitted again: drop the first,
    // unconfirmed sign-up so its data does not linger. Best effort, never blocks.
    if (pendingSignupId.current) {
      const previousId = pendingSignupId.current;
      pendingSignupId.current = null;
      try {
        await discardUnconfirmedSignup(previousId);
      } catch {
        // ignored: the server also refuses anything but a fresh unconfirmed user
      }
    }

    // Last sign-up wins: drop a stale UNCONFIRMED account for this email so the new
    // password is the one that ends up confirmed. Same answer in every case and never
    // blocks the sign-up.
    try {
      await prepareSignup(email);
    } catch {
      // ignored: signing up must work even if this step could not run
    }

    let userId = "";
    try {
      const supabase = createClient();
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password: formData.get("password") as string,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        if (isAlreadyRegistered(error)) {
          // Same outcome as a new sign-up, so the form does not reveal whether
          // an account exists for this email. Nothing was created: skip the
          // member update and do not track an id to discard.
          setStatus("idle");
          onSuccess(email);
          return;
        }
        setStatus("error");
        setErrorMessage(t("register_error_generic"));
        return;
      }
      userId = signUpData.user?.id ?? "";
    } catch {
      setStatus("error");
      setErrorMessage(t("register_error_generic"));
      return;
    }

    pendingSignupId.current = userId || null;

    // Update member with optional fields + consents via Server Action.
    // Uses admin client because no session exists yet (email confirmation pending).
    // The account already exists, so a failure here must not block the done screen,
    // and it must not change it either (that would reveal an existing account):
    // the action logs the reason server-side and the member completes the data
    // later from the "Completa el perfil" checklist.
    try {
      await updateMemberAfterSignup({
        userId,
        phone: formData.get("phone") as string,
        dni: formData.get("dni") as string,
        postal_code: formData.get("postal_code") as string,
        ludoya_username: formData.get("ludoya_username") as string,
        bgg_username: formData.get("bgg_username") as string,
        newsletter_accepted: !!formData.get("newsletter"),
      });
    } catch {
      // ignored on purpose, see above
    }

    setStatus("idle");
    onSuccess(email);
  }

  const isSubmitting = status === "submitting";
  const strength = passwordStrength(password);

  function clearError(field: keyof FieldErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function consentBox(
    name: "conduct" | "privacy",
    labelKey: "register_conduct_checkbox" | "register_privacy_checkbox",
    href: string
  ) {
    return (
      <div>
        <label className="flex min-h-11 items-start gap-3 md:min-h-0">
          <input
            type="checkbox"
            name={name}
            required
            aria-required="true"
            disabled={isSubmitting}
            aria-invalid={!!errors[name]}
            aria-describedby={errors[name] ? `${name}-error` : undefined}
            onChange={() => clearError(name)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand-orange"
          />
          <span className="text-[15px] leading-snug text-stone-custom">
            {t.rich(labelKey, {
              link: (chunks: ReactNode) => (
                <Link href={href} target="_blank" className={linkClass}>
                  {chunks}
                </Link>
              ),
            })}{" "}
            <Star />
          </span>
        </label>
        {errors[name] && (
          <p id={`${name}-error`} className="mt-1 ml-8 text-[13px] text-brand-red">
            {errors[name]}
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="flex min-w-0 flex-1 flex-col gap-6 md:gap-7" onSubmit={handleSubmit} noValidate>
      {status === "error" && errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {/* 1 · Account */}
      <FieldsetCard step={1} legend={t("register_step_account")} className={cardClass}>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="email"
            type="email"
            label={t("register_email_label")}
            required
            autoComplete="email"
            disabled={isSubmitting}
            error={errors.email}
            onChange={() => clearError("email")}
          />
          <TextField
            id="password"
            type="password"
            label={t("register_password_label")}
            required
            autoComplete="new-password"
            minLength={8}
            disabled={isSubmitting}
            error={errors.password}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError("password");
            }}
            hint={
              <div id="password-hint" className="flex flex-col gap-1.5">
                <div className="flex gap-1" aria-hidden="true" data-testid="password-strength">
                  {[1, 2, 3].map((segment) => (
                    <span
                      key={segment}
                      data-filled={strength >= segment}
                      className={cn(
                        "h-1 flex-1 rounded",
                        strength >= segment ? "bg-brand-orange" : "bg-stone-custom/12"
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-stone-custom/65">{t("register_password_hint")}</p>
              </div>
            }
          />
        </div>
      </FieldsetCard>

      {/* 2 · Member details */}
      <FieldsetCard step={2} legend={t("register_step_member")} className={cardClass}>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="first_name"
            label={t("register_first_name_label")}
            required
            autoComplete="given-name"
            disabled={isSubmitting}
            error={errors.first_name}
            onChange={() => clearError("first_name")}
          />
          <TextField
            id="last_name"
            label={t("register_last_name_label")}
            required
            autoComplete="family-name"
            disabled={isSubmitting}
            error={errors.last_name}
            onChange={() => clearError("last_name")}
          />
          <TextField
            id="dni"
            label={t("register_dni_label")}
            optionalLabel={t("register_optional")}
            placeholder={t("register_dni_placeholder")}
            autoComplete="off"
            disabled={isSubmitting}
            error={errors.dni}
            onChange={() => clearError("dni")}
          />
          <TextField
            id="phone"
            type="tel"
            label={t("register_phone_label")}
            optionalLabel={t("register_optional")}
            placeholder={t("register_phone_placeholder")}
            autoComplete="tel"
            disabled={isSubmitting}
          />
          <TextField
            id="postal_code"
            label={t("register_postal_code_label")}
            optionalLabel={t("register_optional")}
            autoComplete="postal-code"
            disabled={isSubmitting}
          />
        </div>
      </FieldsetCard>

      {/* 3 · Where you play */}
      <FieldsetCard step={3} legend={t("register_step_play")} className={cardClass}>
        <p className="text-sm text-stone-custom/65">{t("register_play_intro")}</p>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="ludoya_username" className={cn(labelClass, "flex items-center gap-2")}>
              <MdOutlineGridView size={16} aria-hidden="true" />
              {t("register_ludoya_label")}
            </label>
            <div className="flex min-h-11 items-center overflow-hidden rounded-xl border border-stone-custom/15 bg-brand-white focus-within:border-brand-orange focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-orange">
              <span aria-hidden="true" className="pl-4 text-base text-stone-custom/65">
                @
              </span>
              <input
                id="ludoya_username"
                name="ludoya_username"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={isSubmitting}
                aria-describedby="ludoya_username-status"
                onChange={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/^@+/, "");
                  ludoya.reset();
                }}
                onBlur={(e) => void ludoya.run(e.currentTarget.value)}
                className="min-h-11 w-full min-w-0 bg-transparent px-2 py-[11px] text-base text-stone-custom outline-none placeholder:text-stone-custom/50 disabled:opacity-50"
              />
            </div>
            <div id="ludoya_username-status">
              <CheckStatus
                state={ludoya.state}
                name={ludoya.checked}
                notFoundText={t("register_ludoya_not_found")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="bgg_username" className={labelClass}>
              {t("register_bgg_label")}
            </label>
            <input
              id="bgg_username"
              name="bgg_username"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isSubmitting}
              aria-describedby="bgg_username-status"
              onChange={() => bgg.reset()}
              onBlur={(e) => void bgg.run(e.currentTarget.value)}
              className={inputClass}
            />
            <div id="bgg_username-status">
              <CheckStatus
                state={bgg.state}
                name={bgg.checked}
                notFoundText={t("register_bgg_not_found")}
              />
            </div>
          </div>
        </div>
      </FieldsetCard>

      {/* Consents */}
      <FieldsetCard
        legend={t("register_section_consents")}
        className="rounded-2xl border border-stone-custom/15 bg-brand-white"
        bodyClassName="gap-3.5"
      >
        {consentBox("conduct", "register_conduct_checkbox", "/conduct")}
        {consentBox("privacy", "register_privacy_checkbox", "/data-protection")}
        <div className="h-px bg-stone-custom/10" />
        <label className="flex min-h-11 items-start gap-3 md:min-h-0">
          <input
            type="checkbox"
            name="newsletter"
            disabled={isSubmitting}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-brand-orange"
          />
          <span className="text-sm leading-snug text-stone-custom/75">
            {t("register_newsletter_consent")}{" "}
            <span className="text-stone-custom/65">{t("register_optional")}</span>
          </span>
        </label>
      </FieldsetCard>

      {/* Submit row */}
      <div className="flex flex-col items-stretch gap-4 md:flex-row-reverse md:items-center md:justify-between">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-orange px-8 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-orange/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
        >
          {isSubmitting ? t("register_submitting") : t("register_submit")}
          {!isSubmitting && <MdArrowForward size={16} aria-hidden="true" />}
        </button>
        <p className="text-center text-sm text-stone-custom/65">
          {t("register_has_account")}{" "}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-semibold text-brand-orange-text underline transition-colors hover:text-brand-orange md:min-h-0"
          >
            {t("register_login_link")}
          </Link>
        </p>
      </div>
    </form>
  );
}
