/**
 * V-2 member list: URL parameters, their sanitiser and the row type of `admin_list_members`.
 *
 * The RPC rejects unknown state, role and sort values (`admin:invalid_argument`), so nothing
 * from the URL reaches it raw: every parameter is checked against a whitelist and falls back to
 * its default. Pure module (no `server-only`): shared by the page, the components and the tests.
 */

export const MEMBER_STATES = ["active", "former", "all"] as const;
export type MemberStateFilter = (typeof MEMBER_STATES)[number];

export const MEMBER_ROLE_FILTERS = ["all", "member", "board", "superadmin"] as const;
export type MemberRoleFilter = (typeof MEMBER_ROLE_FILTERS)[number];

export const MEMBER_SORT_COLUMNS = ["number", "name", "joined", "left"] as const;
export type MemberSortColumn = (typeof MEMBER_SORT_COLUMNS)[number];

export const MEMBER_SORTS = MEMBER_SORT_COLUMNS.flatMap((c) => [`${c}_asc`, `${c}_desc`] as const);
export type MemberSort = (typeof MEMBER_SORTS)[number];

/** The mockup draws 12 rows; `pp` may pick one of these (there is no UI for it yet). */
export const MEMBER_PAGE_SIZES = [12, 24, 48, 96] as const;
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_SEARCH_LENGTH = 100;
/** Far beyond any real list; keeps `offset` a small safe integer. */
export const MAX_PAGE = 100000;

export type MembersQuery = {
  state: MemberStateFilter;
  role: MemberRoleFilter;
  q: string;
  sort: MemberSort;
  page: number;
  pp: number;
};

export const DEFAULT_MEMBERS_QUERY: MembersQuery = {
  state: "active",
  role: "all",
  q: "",
  sort: "number_asc",
  page: 1,
  pp: DEFAULT_PAGE_SIZE,
};

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

/** Search text: control characters removed, whitespace collapsed, at most 100 characters. */
export function sanitizeSearch(value: string | undefined): string {
  if (!value) return "";
  const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(cleaned).slice(0, MAX_SEARCH_LENGTH).join("").trim();
}

/** Reads `searchParams` (first value of each key) into a query that is always safe for the RPC. */
export function parseMembersParams(raw: RawParams): MembersQuery {
  const pageText = single(raw.page);
  const page = pageText && /^\d{1,6}$/.test(pageText) ? Math.min(Math.max(Number(pageText), 1), MAX_PAGE) : 1;
  const ppText = single(raw.pp);
  const pp = MEMBER_PAGE_SIZES.find((size) => String(size) === ppText) ?? DEFAULT_PAGE_SIZE;

  return {
    state: oneOf(MEMBER_STATES, single(raw.state), DEFAULT_MEMBERS_QUERY.state),
    role: oneOf(MEMBER_ROLE_FILTERS, single(raw.role), DEFAULT_MEMBERS_QUERY.role),
    q: sanitizeSearch(single(raw.q)),
    sort: oneOf(MEMBER_SORTS, single(raw.sort), DEFAULT_MEMBERS_QUERY.sort),
    page,
    pp,
  };
}

/** Arguments of `admin_list_members` for a sanitised query. */
export function toListMembersArgs(query: MembersQuery) {
  return {
    p_state: query.state,
    p_role: query.role === "all" ? null : query.role,
    p_q: query.q === "" ? null : query.q,
    p_sort: query.sort,
    p_limit: query.pp,
    p_offset: (query.page - 1) * query.pp,
  };
}

/** `/admin/members` URL for a query with overrides; default values are left out to keep URLs short. */
export function buildMembersHref(query: MembersQuery, overrides: Partial<MembersQuery> = {}): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (next.state !== DEFAULT_MEMBERS_QUERY.state) params.set("state", next.state);
  if (next.role !== DEFAULT_MEMBERS_QUERY.role) params.set("role", next.role);
  if (next.q !== "") params.set("q", next.q);
  if (next.sort !== DEFAULT_MEMBERS_QUERY.sort) params.set("sort", next.sort);
  if (next.pp !== DEFAULT_PAGE_SIZE) params.set("pp", String(next.pp));
  if (next.page > 1) params.set("page", String(next.page));
  const text = params.toString();
  return text ? `/admin/members?${text}` : "/admin/members";
}

/** Sort that a click on a column header selects: ascending first, then toggles. */
export function nextSort(current: MemberSort, column: MemberSortColumn): MemberSort {
  return current === `${column}_asc` ? `${column}_desc` : `${column}_asc`;
}

export function sortDirectionOf(current: MemberSort, column: MemberSortColumn): "ascending" | "descending" | "none" {
  if (current === `${column}_asc`) return "ascending";
  if (current === `${column}_desc`) return "descending";
  return "none";
}

/** One row of `admin_list_members` (no DNI, phone or ciphertext). */
export type AdminMemberListRow = {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  has_login: boolean;
  state: "active" | "former";
  role: string;
  membership_start_date: string | null;
  current_joined_on: string | null;
  left_on: string | null;
  total_count: number;
};

/** "2026-10-05" → "5/10/2026" (the mockup's d/m/yyyy), without going through Date and time zones. */
export function formatAdminDate(iso: string | null | undefined): string | null {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return match ? `${Number(match[3])}/${Number(match[2])}/${match[1]}` : null;
}
