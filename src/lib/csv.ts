/**
 * CSV helpers for the admin export.
 *
 * Spreadsheet apps evaluate a cell as a formula when it starts with `=`, `+`, `-`, `@`,
 * tab or CR (CSV/formula injection, OWASP). Member-controlled text (names, usernames)
 * ends up in the export, so those cells get a leading apostrophe, which Excel, Sheets
 * and LibreOffice treat as "text".
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
/** Plain phone numbers such as `+34 600 123 456` are inert and must stay untouched. */
const PLAIN_PHONE = /^\+?[0-9 ]+$/;
const NEEDS_QUOTES = /[",\r\n]/;

export function escapeCsv(value: string): string {
  let safe = value;
  if (FORMULA_TRIGGER.test(safe) && !PLAIN_PHONE.test(safe)) {
    safe = `'${safe}`;
  }
  if (NEEDS_QUOTES.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
