"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { MdSearch } from "react-icons/md";
import {
  MEMBER_ROLE_FILTERS,
  MEMBER_SORTS,
  MEMBER_STATES,
  MAX_SEARCH_LENGTH,
  DEFAULT_PAGE_SIZE,
  type MembersQuery,
} from "@/lib/admin/members-list";
import { adminButtonClass } from "../adminButtons";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-stone-custom/20 bg-brand-white px-3.5 text-base text-stone-custom outline-none focus-visible:outline-2 focus-visible:outline-brand-orange";

/**
 * Search, state and role filters as a plain GET form: the URL is the state, it works without
 * JavaScript, and a new filter always starts at page 1 (the form never sends `page`). Changing
 * the state, the role or the sort submits at once; the search submits with Enter or the button.
 */
export default function MembersFilters({ query }: { query: MembersQuery }) {
  const t = useTranslations("admin.members");
  const tAdmin = useTranslations("admin");
  const formRef = useRef<HTMLFormElement>(null);
  const sortRef = useRef<HTMLInputElement>(null);

  const submit = () => formRef.current?.requestSubmit();

  return (
    <form ref={formRef} method="get" role="search" className="flex flex-col gap-4">
      {/* Sort is chosen with the table headers on desktop and the select below on mobile. */}
      <input ref={sortRef} type="hidden" name="sort" value={query.sort} readOnly />
      {query.pp !== DEFAULT_PAGE_SIZE && <input type="hidden" name="pp" value={query.pp} />}

      <div className="grid gap-4 md:grid-cols-[1fr_auto_220px] md:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="members-search" className="text-sm font-medium text-stone-custom/80">
            {t("search_label")}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MdSearch
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-stone-custom/40"
              />
              <input
                id="members-search"
                type="search"
                name="q"
                defaultValue={query.q}
                maxLength={MAX_SEARCH_LENGTH}
                placeholder={t("search_placeholder")}
                autoComplete="off"
                className={`${fieldClass} pl-11`}
              />
            </div>
            <button type="submit" className={adminButtonClass("secondary")}>
              {t("search_submit")}
            </button>
          </div>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-stone-custom/80">{t("state_legend")}</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-brand-beige p-1">
            {MEMBER_STATES.map((state) => (
              <label
                key={state}
                className="flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] px-4 text-sm font-semibold has-checked:bg-stone-custom has-checked:text-brand-white has-focus-visible:outline-2 has-focus-visible:outline-brand-orange"
              >
                <input
                  type="radio"
                  name="state"
                  value={state}
                  defaultChecked={query.state === state}
                  onChange={submit}
                  className="sr-only"
                />
                {t(`state_${state}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="members-role" className="text-sm font-medium text-stone-custom/80">
            {t("role_label")}
          </label>
          <select
            id="members-role"
            name="role"
            defaultValue={query.role}
            onChange={submit}
            className={fieldClass}
          >
            {MEMBER_ROLE_FILTERS.map((role) => (
              <option key={role} value={role}>
                {role === "all" ? t("role_all") : tAdmin(`role_${role}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 md:hidden">
        <label htmlFor="members-sort" className="text-sm font-medium text-stone-custom/80">
          {t("sort_label")}
        </label>
        <select
          id="members-sort"
          defaultValue={query.sort}
          onChange={(event) => {
            if (sortRef.current) sortRef.current.value = event.target.value;
            submit();
          }}
          className={fieldClass}
        >
          {MEMBER_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`sort_${sort}`)}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
