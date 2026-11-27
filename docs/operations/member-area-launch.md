# Member area launch

The member area (login, sign-up, La meva zona, member card) is public since
2026-11-27. There is no flag any more: the web sign-up is the only way to join.

## Entry points

| What | Behaviour |
|---|---|
| NavBar, visitor | "Iniciar sessió" (desktop and mobile menu); a same-size placeholder while the session loads |
| NavBar, signed-in member | User pill and menu |
| "Fes-te soci" buttons (home `JoinUs`, `/about` `AboutWhyJoin` and `AboutCTA`) | `/register`, same tab |
| `/login` sign-up card (`LoginSignupCard`) | `/register` |
| Signed-in member opening `/register` | Redirected to `/profile` by the proxy (`AUTH_ROUTES`) |
| `/login`, `/register`, `/forgot-password` | `noindex`, not in the sitemap |

The old Google Form is no longer linked from the site. Close it (or replace its
description with a link to `https://www.darkstone.cat/register`) so nobody
signs up twice. Answers it received before closing can still be imported with
`docs/operations/member-import.md`.

## Before announcing: verify in production

On `https://www.darkstone.cat`:

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

## Supabase dashboard (production project)

- **Auth SMTP**: Supabase's built-in sender only allows a few mails per hour.
  Set a custom SMTP (Google Workspace) before announcing, or confirmation
  mails get lost.
- **URL configuration**: Site URL `https://www.darkstone.cat`; the redirect
  allow-list contains `https://www.darkstone.cat/auth/callback` (password
  reset `redirectTo`) and the `/auth/magic-link` URL.
- **Email templates**: "Confirm signup", "Change email" and "Reset password"
  send the types the callback routes accept (`signup`/`email`/`email_change`
  for `/auth/confirm`, `recovery` for `/auth/callback`); "Magic link" points
  to `{{ .SiteURL }}/auth/magic-link?token_hash={{ .TokenHash }}&type=email`.

## Code

- NavBar login: `src/components/NavBar.tsx` (`desktopVisitorEntry`,
  `mobileVisitorEntry`).
- Sign-up links: `src/components/home/JoinUs.tsx`,
  `src/components/about/AboutWhyJoin.tsx`, `src/components/about/AboutCTA.tsx`,
  `src/components/auth/LoginSignupCard.tsx`.
- Tests: `tests/components/MemberAreaEntry.test.tsx`, `e2e/pages/home.spec.ts`,
  `e2e/auth/login.spec.ts`.
- The `NEXT_PUBLIC_MEMBER_AREA_PUBLIC` variable is no longer read; delete it
  from Vercel and local `.env*` files if it is still set.
