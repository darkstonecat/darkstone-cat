/**
 * Structure of the V-8 procedures (spec P-1..P-7). The text lives in `admin.procedures.<id>.*`
 * of the message files (`title`, `s<n>`, `s<n>_a|b` for nested items, `s<n>_legal`, `action`);
 * this module only says which steps have nested items, a legal reference or are a warning.
 * The footer action links to the Socis view (the actions need a member), pre-filtered when the
 * procedure starts from a former member.
 */
export type ProcedureStep = {
  /** Number of nested items (`s<n>_a`, `s<n>_b`...). */
  nested?: number;
  /** Has an `s<n>_legal` reference. */
  legal?: boolean;
  /** Rendered as a warning notice instead of a numbered step body. */
  warning?: boolean;
};

export type ProcedureDef = {
  /** 1..7, anchors are `#p-<n>`. */
  n: number;
  steps: ProcedureStep[];
  /** Where the "Acció al panell" link goes (path with optional query, locale added by Link). */
  actionHref: string;
};

export const PROCEDURES: readonly ProcedureDef[] = [
  { n: 1, steps: [{}, {}, {}, {}, {}, {}], actionHref: "/admin/members?state=former" },
  { n: 2, steps: [{}, { legal: true }, {}, {}], actionHref: "/admin/members" },
  { n: 3, steps: [{}, {}, { legal: true }], actionHref: "/admin/members" },
  { n: 4, steps: [{}, {}, {}, { legal: true }], actionHref: "/admin/members?state=former" },
  { n: 5, steps: [{}, {}], actionHref: "/admin/members" },
  { n: 6, steps: [{ nested: 2 }, {}, {}, {}], actionHref: "/admin/members" },
  { n: 7, steps: [{ nested: 2 }, {}, { warning: true }, {}, {}], actionHref: "/admin/members" },
];
