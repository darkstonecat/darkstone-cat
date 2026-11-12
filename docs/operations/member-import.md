# Member import from the Google Form

While the member area is not advertised (`docs/operations/member-area-launch.md`), the "Fes-te
soci" buttons send people to the old Google Form (`MEMBERSHIP_FORM_URL`). Its answers land in a
Google Sheet, not in the database, so the board imports them from time to time with
`scripts/migrate-members.mjs` (`npm run migrate`).

The script is **insert-only**: it creates the members that are not in the database yet and never
changes, merges or deletes an existing one. The database is the source of truth.

## Before you start

- Local `.env.local` with the **production** values of `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` and `ENCRYPTION_KEY`. With the wrong `ENCRYPTION_KEY` the DNI check
  cannot read the stored values (the dry run warns `stored DNIs could not be decrypted`) and the
  new members' DNI and phone would be unreadable by the site: stop if you see that warning.
- `npm install` done (the script needs `csv-parse` and `@supabase/supabase-js`).

## Steps

1. **Export the sheet.** In Google Sheets: File → Download → Comma-separated values. Save it as
   `data/llista_membres.csv` (the whole `data/` folder is gitignored: the file holds DNIs and
   phones and must never be committed). Keep the columns in the form's order: number, timestamp,
   email, (empty), full name, phone, DNI/NIE, postal code, conduct, privacy, newsletter.
2. **Dry run** (reads production, writes nothing):

   ```bash
   npm run migrate
   ```

3. **Read the output** (see the next section). Every `[DRY] … WOULD CREATE` line is a member that
   will be created. Resolve every `DNI already belongs to …` line by hand before going on.
4. **Import**:

   ```bash
   npm run migrate -- --execute
   ```

   Each new member prints `[+] sheet 000-NNN Name <email> → created as 000-MMM`. Exit code 0 is
   success, 2 means some members failed (the lines start with `ERROR`), 1 is a fatal error.
5. **Check**: run the dry run again. It must say `0 would create`. Open one of the new members in
   `/admin/members` and reveal the DNI to confirm it decrypts.
6. **Log it**: add the date, the numbers created and the counts (never names, DNIs or phones) to
   `odd/tasks/admin-panel.md`, section "Member list import and renumbering".

## Reading the output

| Line | Meaning | What to do |
|---|---|---|
| `MERGE: … keep 000-A, merge data from 000-B` | The same email filled the form twice | Nothing: one member, date of the first answer, data of the last one |
| `⚠ … validation warnings` | Unusual phone, DNI or postal code format | Check the sheet row; the member is still imported as written |
| `⚠ sheet 000-A and 000-B share a DNI` | Two answers with the same DNI and different emails | Decide which email is right and fix the sheet before importing |
| `[=] … email exists as 000-NNN` | Already a member | Nothing |
| `[=] … FORMER member since <date>` | A former member answered the form again | Not rejoined automatically: use "Reincorpora" (A-7) on their member file |
| `[=] … DNI already belongs to 000-NNN, new email` | Probably an existing member with a new email | Not imported. Compare by hand; if it is the same person, change the email on the existing member instead |
| `[DRY] … WOULD CREATE with the next free number` | New member | Created with `--execute` |

## Member numbers

The sheet's own number column is **ignored** for new members. On 2026-11-03 production was
renumbered to the members' position in the sheet (000-001 … 000-202 with no gaps), so the sheet
number and the production number of the same person differ. A new member gets the next number of
`member_number_seq`, exactly like a web sign-up, and the new members are created in the order of
the sheet's timestamps. Always match people by email (and DNI), never by number.

## What the new members get

- A confirmed account with **no password** and **no e-mail**. They sign in with the magic link on
  `/login` or set a password with "He oblidat la contrasenya". The board can also send them an
  access link from their member file ("Envia enllaç d'accés", A-15).
- Role `member`, active, `membership_start_date` and `current_joined_on` set to the date they
  answered the form, newsletter as answered (`Accepto.` / `No accepto.`), DNI and phone encrypted
  for their row (v2).

## Known limits

- The script writes with the service role, so these sign-ups are **not in the audit log**.
- Insert-only: changes someone made to an earlier answer (new phone, new postal code) are not
  copied to an existing member. Edit them from the member file (A-4).
- Testing a change to the script: run it against the local Supabase by overriding the variables
  (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` from `npx supabase status -o env`, a
  dummy 64-hex `ENCRYPTION_KEY`); the shell values win over `.env.local`. Run `npm run db:reset`
  afterwards.
