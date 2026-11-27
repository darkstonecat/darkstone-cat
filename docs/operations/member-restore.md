# Restoring the member list from a backup Sheet

When the database is lost, the member list comes back from the weekly backup Sheet
(`docs/features/member-backup/spec.md`) with `scripts/restore-members.mjs` (`npm run restore`).
This page is written for a developer who has never worked on the project. You need the
board's **continuity kit** (spec §8): owner access to Supabase, Vercel and GitHub, and the
superadmin who can open the backup folder in Google Drive.

The script is **insert-only**: it never changes or deletes an existing member, so it is safe to
run again after a failure.

## What comes back, and what does not

| Comes back | Does not |
|---|---|
| Member number, names, e-mail, DNI/NIE, phone, postal code, Ludoya and BGG usernames | Passwords: members sign in with the magic link or "He oblidat la contrasenya" |
| Role (`member`, `board`, `superadmin`), newsletter choice | Card tokens: new ones are generated, so old QR cards stop verifying |
| *Primera alta*, *alta actual*, *baixa* date, *baixa per*, reason, anonymised date | The audit log, sessions, role dates |
| Badges whose key exists in the catalogue | The badge catalogue and the member benefits: re-create them in `/admin/badges` and `/admin/benefits` |

A former member's login account is banned again, as a *baixa* leaves it. An anonymised former
member without an e-mail comes back as a members row without an account.

## Steps

1. **New Supabase project.** Create it, then apply every migration of the repository to it
   (`supabase link --project-ref <ref>`, then `supabase db push --linked`). Configure Auth as the
   old project was (redirect URLs, e-mail templates; see `CLAUDE.md`, "Authentication").
2. **Environment.** In a local `.env.local`, set the NEW project's `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`, and the `ENCRYPTION_KEY` the site will use (the old one from the
   continuity kit, or a new 64-hex key; the Sheet holds the plain values, so either works, but
   it must be the same key you then set in Vercel).
3. **Badge catalogue.** Create the association's badges in the new database before the restore
   if you want badges re-awarded in one go (the dry run lists the missing keys). You can also do
   it afterwards and award them by hand.
4. **Download the Sheet.** A superadmin opens the newest `Darkstone · Socis · YYYY-MM-DD` in the
   backup folder and downloads it with File → Download → Comma-separated values. Save it outside
   the repository, or under `data/` (gitignored). It holds DNIs and phones: delete it when done.
5. **Dry run** (reads the new database, writes nothing):

   ```bash
   npm run restore -- data/backup.csv
   ```

   Lines: `[DRY] 000-NNN: WOULD RESTORE`, `[=] 000-NNN: skipped (…)` for members already there,
   `✗ 000-NNN: invalid (…), line N` for a row to fix in the CSV, `⚠` for warnings (an illegible
   DNI or phone in the backup, badge keys missing from the catalogue). The output names member
   numbers only.
6. **Restore:**

   ```bash
   npm run restore -- data/backup.csv --execute
   ```

   It first moves the member number sequence above the highest number in the Sheet (new
   sign-ups continue after it), then restores in member number order: `[+] 000-NNN: restored`.
   Exit code 0 is success, 2 means some rows were invalid or failed (`ERROR` lines: a failed
   member is removed again, so fix the cause and run the same command again; a line ending in
   `NOT UNDONE` means it could not be removed: delete that member by hand first), 1 is a fatal
   error. The role is set as the last step of each member.
7. **Check.** Run the dry run again: it must say `0 would restore`. Sign in as a superadmin
   (magic link), open two members in `/admin/members` and reveal their DNI to confirm it reads.
8. **Deploy.** Set the new Supabase values and the same `ENCRYPTION_KEY` in Vercel (Production),
   redeploy, and delete the local CSV.

## Errors

| Message | Cause | What to do |
|---|---|---|
| `FATAL: missing columns: …` | Not a backup Sheet, or columns were renamed | Download the Sheet again without editing it |
| `invalid (member number)` | The number is not `000-NNN` | Fix that cell in the CSV |
| `invalid (a former member cannot hold a role)` | A row with a *baixa* date and a role | Set `Rol` to `member` (the database refuses it otherwise, BR-12) |
| `invalid (Primera alta)` / `invalid (Alta actual)` | A row without an alta date (the database requires both) | Fill in the date from the old records |
| `invalid (insígnies)` | A badge cell that is not `key@YYYY-MM-DD; …`, or the same key twice | Fix the cell |
| `invalid (repeated in the file)` | Two rows with the same number or e-mail | Keep the right one |
| `skipped (e-mail has an account)` | That e-mail already signed up in the new database | Compare by hand; nothing was changed |
| `ERROR 000-NNN: account (422)` | Supabase refused the e-mail | Check the address in the CSV |
| `FATAL: cannot raise the member number sequence` | Migration `20261127100200_restore_member_number_floor.sql` is missing | Apply every migration (step 1) |
