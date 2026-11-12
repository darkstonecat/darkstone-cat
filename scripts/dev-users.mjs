// scripts/dev-users.mjs
//
// Creates three easy-to-type accounts in the LOCAL Supabase stack for manual testing with
// `npm run dev`:
//
//   admin@darkstone.local   / admin    → superadmin
//   junta@darkstone.local   / junta    → board ("Junta")
//   usuario@darkstone.local / usuario  → member
//
// Usage: npm run db:dev-users   (local Supabase must be running: npm run db:start)
//
// Safety: the URL and service-role key come from `supabase status`, so this only ever talks to
// the local stack, and it refuses any host other than 127.0.0.1 / localhost. Never point it at
// production: these passwords are shorter than the password policy on purpose.
//
// Safe to re-run: existing accounts get their password, confirmation and role reset.
//
// The integration tests assume they are the only source of superadmins (roles.test.ts asserts
// the global count), so run `npm run db:reset` before `npm run test:integration`; it removes
// these accounts.

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const USERS = [
  { email: "admin@darkstone.local", password: "admin", role: "superadmin", first: "Admin" },
  { email: "junta@darkstone.local", password: "junta", role: "board", first: "Junta" },
  { email: "usuario@darkstone.local", password: "usuario", role: "member", first: "Usuari" },
];

function localStack() {
  let status;
  try {
    status = JSON.parse(
      execFileSync("npx", ["supabase", "status", "-o", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    console.error("Local Supabase is not running. Start it with: npm run db:start");
    process.exit(2);
  }
  const url = status.API_URL;
  const key = status.SERVICE_ROLE_KEY;
  const host = url ? new URL(url).hostname : "";
  if (!key || !["127.0.0.1", "localhost"].includes(host)) {
    console.error(`Refusing to run: ${url ?? "no API URL"} is not the local stack.`);
    process.exit(2);
  }
  return { url, key };
}

async function findUserId(admin, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) return user.id;
    if (data.users.length < 200) return null;
  }
}

async function upsertUser(admin, { email, password, role, first }) {
  // GoTrue enforces the 8-character policy even for the Admin API, so the account is written
  // with a throwaway long password and the short one is set as a bcrypt hash afterwards.
  const attrs = {
    password: `dev-${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { first_name: first, last_name: "Local" },
    ban_duration: "none",
  };
  let id = await findUserId(admin, email);
  if (id) {
    const { error } = await admin.auth.admin.updateUserById(id, attrs);
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, ...attrs });
    if (error) throw error;
    id = data.user.id;
  }

  await runSql(
    "UPDATE auth.users SET encrypted_password = extensions.crypt($1, extensions.gen_salt('bf')) WHERE id = $2",
    [password, id],
  );

  // The service role has no JWT subject, so the role guard's BR-11 check does not apply.
  const { error } = await admin
    .from("members")
    .update({ role, role_since: role === "member" ? null : new Date().toISOString(), left_on: null })
    .eq("id", id);
  if (error) throw error;
}

const { url, key } = localStack();

// One SQL statement as `postgres` through the local postgres-meta endpoint (local stack only).
async function runSql(query, parameters) {
  const res = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, parameters }),
  });
  if (!res.ok) throw new Error(`SQL failed: ${(await res.json())?.message ?? res.status}`);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

for (const user of USERS) {
  try {
    await upsertUser(admin, user);
    console.log(`ok  ${user.email.padEnd(24)} ${user.password.padEnd(8)} ${user.role}`);
  } catch (err) {
    console.error(`err ${user.email}: ${err.message ?? err}`);
    process.exitCode = 1;
  }
}
