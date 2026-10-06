import { useTranslations } from "next-intl";
import { MdFilterList } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { ACTION_FILTERS, type ActivityQuery } from "@/lib/admin/activity";
import { adminButtonClass } from "../adminButtons";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-stone-custom/20 bg-brand-white px-3.5 text-base text-stone-custom outline-none focus-visible:outline-2 focus-visible:outline-brand-orange";
const labelClass = "text-sm font-medium text-stone-custom/80";

export type ActivityActorOption = { id: string; name: string };

/**
 * V-4 filters as a plain GET form: the URL is the state, it works without JavaScript and a new
 * filter always starts from the newest entry (the form never sends the `before` cursor).
 */
export default function ActivityFilters({
  query,
  actors,
}: {
  query: ActivityQuery;
  actors: ActivityActorOption[];
}) {
  const t = useTranslations("admin.activity");
  const knownActor = query.actor === "system" || query.actor === "self" || actors.some((a) => a.id === query.actor);

  return (
    <section aria-labelledby="activity-filters" className="rounded-2xl bg-brand-white p-5 md:p-8">
      <h2 id="activity-filters" className="text-[22px] font-bold text-stone-custom">
        {t("filters_title")}
      </h2>
      <form method="get" role="search" className="mt-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="activity-from" className={labelClass}>
              {t("filter_from")}
            </label>
            <input id="activity-from" type="date" name="from" defaultValue={query.from ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="activity-to" className={labelClass}>
              {t("filter_to")}
            </label>
            <input id="activity-to" type="date" name="to" defaultValue={query.to ?? ""} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="activity-actor" className={labelClass}>
              {t("filter_actor")}
            </label>
            <select
              id="activity-actor"
              name="actor"
              defaultValue={knownActor ? (query.actor ?? "") : ""}
              className={fieldClass}
            >
              <option value="">{t("actor_everyone")}</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
              <option value="self">{t("actor_self_option")}</option>
              <option value="system">{t("actor_system")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="activity-action" className={labelClass}>
              {t("filter_action")}
            </label>
            <select id="activity-action" name="action" defaultValue={query.action ?? ""} className={fieldClass}>
              <option value="">{t("action_all")}</option>
              {ACTION_FILTERS.map((action) => (
                <option key={action} value={action}>
                  {t(`action_group.${action.replace(/[.*]/g, "_")}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="activity-target" className={labelClass}>
              {t("filter_member")}
            </label>
            <input
              id="activity-target"
              type="text"
              name="target"
              maxLength={32}
              defaultValue={query.target ?? ""}
              placeholder={t("filter_member_placeholder")}
              autoComplete="off"
              className={fieldClass}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className={adminButtonClass("primary", "gap-2 max-sm:w-full")}>
            <MdFilterList aria-hidden="true" className="size-5" />
            {t("apply")}
          </button>
          <Link href="/admin/activity" className={adminButtonClass("secondary", "max-sm:w-full")}>
            {t("clear")}
          </Link>
        </div>
      </form>
    </section>
  );
}
