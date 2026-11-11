import { describe, expect, it } from "vitest";
import { assertProductionEnv, productionEnvProblems } from "@/lib/production-env";

const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "pk",
  SUPABASE_SERVICE_ROLE_KEY: "sr",
  ENCRYPTION_KEY: "a".repeat(64),
  LUDOYA_API_KEY: "lk",
  CRON_SECRET: "cs",
  SMTP_USER: "no-reply@example.org",
  SMTP_PASSWORD: "pw",
};

describe("productionEnvProblems", () => {
  it("accepts a complete environment", () => {
    expect(productionEnvProblems(complete)).toEqual([]);
  });

  it("names every missing or blank variable without printing values", () => {
    const problems = productionEnvProblems({ ...complete, CRON_SECRET: " ", NEXT_PUBLIC_SUPABASE_URL: undefined });
    expect(problems).toEqual(["NEXT_PUBLIC_SUPABASE_URL is not set", "CRON_SECRET is not set"]);
  });

  it("rejects a malformed encryption key and a non-https Supabase URL", () => {
    const problems = productionEnvProblems({
      ...complete,
      ENCRYPTION_KEY: "not-hex",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });
    expect(problems).toEqual([
      "ENCRYPTION_KEY is not 64 hex characters",
      "NEXT_PUBLIC_SUPABASE_URL is not an https URL",
    ]);
    expect(problems.join()).not.toContain("not-hex");
  });

  it("rejects test and local-only switches", () => {
    expect(productionEnvProblems({ ...complete, LUDOYA_MOCK: "1", CONTACT_ALLOW_LOCALHOST: "1" })).toEqual([
      "LUDOYA_MOCK must not be set in production",
      "CONTACT_ALLOW_LOCALHOST must not be set in production",
    ]);
  });
});

describe("assertProductionEnv", () => {
  it("only checks Vercel production builds", () => {
    expect(() => assertProductionEnv({})).not.toThrow();
    expect(() => assertProductionEnv({ VERCEL_ENV: "preview" })).not.toThrow();
  });

  it("throws with the list of problems on a production build", () => {
    expect(() => assertProductionEnv({ ...complete, VERCEL_ENV: "production", LUDOYA_API_KEY: "" })).toThrow(
      "Production environment is incomplete:\n- LUDOYA_API_KEY is not set"
    );
  });

  it("passes a complete production environment", () => {
    expect(() => assertProductionEnv({ ...complete, VERCEL_ENV: "production" })).not.toThrow();
  });
});
