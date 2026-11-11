# Member area launch

The member area (login, sign-up, La meva zona, member card) is deployed to
production but **not advertised** until the board has verified it. One build
flag controls that: `NEXT_PUBLIC_MEMBER_AREA_PUBLIC`.

## Current state: hidden (flag unset)

| What | Behaviour |
|---|---|
| NavBar, visitor | No login button (desktop and mobile), no loading placeholder |
| NavBar, signed-in member | User pill and menu as usual |
| "Fes-te soci" buttons (home, `/about`) | Google Form (`MEMBERSHIP_FORM_URL`, `src/lib/member-area.ts`) |
| `/login` sign-up card | Google Form instead of `/register` |
| `/login`, `/register`, `/forgot-password` | Reachable by direct URL; `noindex`, not in the sitemap |
| Admin panel, `/verify/<token>` | Unchanged |

Hiding is not access control. Anyone with the URL can sign up, and that
creates a real member (with the next member number) in the production
database. While the flag is off, check new web sign-ups against the Google
Form answers so nobody ends up registered twice.

## Before publishing: verify in production

Use the direct URLs on `https://www.darkstone.cat`:

1. **Sign-up**: `/register` with a real mailbox. The confirmation mail
   arrives, its link goes through `/auth/confirm` and ends on
   `/login?confirmed=success`.
2. **Login** with that account: lands on `/profile`, the NavBar shows the pill.
3. **Magic link** from `/login`: the mail link goes through
   `/auth/magic-link` and signs in.
4. **Password reset** from `/forgot-password`: the mail link goes through
   `/auth/callback` to `/reset-password`, and the new password works.
5. **Member area**: `/profile` (checklist, badges, benefits),
   `/profile/details`, `/profile/edit`, `/profile/card` (download, QR opens
   `/verify/<token>` with "Carnet vàlid").
6. **Sign-out** from the NavBar ends the session.
7. Remove or anonymise the test account from the admin panel afterwards.

If a mail link fails, check the Supabase dashboard (production project):

- **URL configuration**: Site URL `https://www.darkstone.cat`; the redirect
  allow-list contains `https://www.darkstone.cat/auth/callback` (password
  reset `redirectTo`) and the `/auth/magic-link` URL.
- **Email templates**: "Confirm signup", "Change email" and "Reset password"
  send the types the callback routes accept (`signup`/`email`/`email_change`
  for `/auth/confirm`, `recovery` for `/auth/callback`); "Magic link" points
  to `{{ .SiteURL }}/auth/magic-link?token_hash={{ .TokenHash }}&type=email`.
- **Mail sending limits**: Supabase's built-in sender is heavily rate-limited;
  check the Auth SMTP settings before announcing.

## Publishing

1. Vercel → Project → Settings → Environment Variables: add
   `NEXT_PUBLIC_MEMBER_AREA_PUBLIC` = `1` (Production).
2. Redeploy the latest production deployment. The value is inlined at build
   time, so it has no effect until a new build runs.
3. Check on `https://www.darkstone.cat`, in a private window: the NavBar shows
   "Inicia sessió" and the `/login` card goes to `/register`.
4. Decide separately whether the "Fes-te soci" buttons should move from the
   Google Form to `/register`. The flag does not change them.

## Rolling back

Delete the variable (or set it to anything other than `1`) and redeploy.
Accounts and sessions are untouched: signed-in members keep their access.

## Code

- Flag and form URL: `src/lib/member-area.ts` (`isMemberAreaPublic()`,
  `MEMBERSHIP_FORM_URL`).
- Consumers: `src/components/NavBar.tsx` (`desktopVisitorEntry`,
  `mobileVisitorEntry`), `src/components/auth/LoginSignupCard.tsx`.
- Tests: `tests/components/MemberAreaEntry.test.tsx` (both modes, desktop and
  mobile). The Playwright server runs with the flag set to `1`.
