// ---------------------------------------------------------------------------
// Production environment check, run by next.config.ts on Vercel production builds
// ---------------------------------------------------------------------------
//
// A missing NEXT_PUBLIC_SUPABASE_* value is inlined as undefined and takes every
// page down (the proxy and the NavBar create a Supabase client), and a missing
// server secret breaks sign-in, the member area or the cron jobs at runtime.
// Failing the build instead keeps the previous deployment live.

type Env = Record<string, string | undefined>;

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_KEY",
  "LUDOYA_API_KEY",
  "CRON_SECRET",
  "SMTP_USER",
  "SMTP_PASSWORD",
] as const;

/** Test and local-only switches that must never reach production. */
const FORBIDDEN = ["LUDOYA_MOCK", "LUDOYA_MOCK_NOW", "CONTACT_ALLOW_LOCALHOST"] as const;

/** Every problem with a production environment, as readable lines (empty when fine). Never prints values. */
export function productionEnvProblems(env: Env): string[] {
  const problems: string[] = [];
  for (const name of REQUIRED) {
    if (!env[name]?.trim()) problems.push(`${name} is not set`);
  }
  const key = env.ENCRYPTION_KEY?.trim();
  if (key && !/^[0-9a-f]{64}$/i.test(key)) problems.push("ENCRYPTION_KEY is not 64 hex characters");
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url && !url.startsWith("https://")) problems.push("NEXT_PUBLIC_SUPABASE_URL is not an https URL");
  for (const name of FORBIDDEN) {
    if (env[name]?.trim()) problems.push(`${name} must not be set in production`);
  }
  return problems;
}

/** Throws when a Vercel production build has an unusable environment. */
export function assertProductionEnv(env: Env): void {
  if (env.VERCEL_ENV !== "production") return;
  const problems = productionEnvProblems(env);
  if (problems.length > 0) {
    throw new Error(`Production environment is incomplete:\n- ${problems.join("\n- ")}`);
  }
}
