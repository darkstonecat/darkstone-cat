"use server";

import { headers } from "next/headers";
import { lookupBggUsername } from "@/lib/bgg-user";
import { lookupLudoyaUsername } from "@/lib/ludoya/username";
import { allowRequest } from "@/lib/rate-limit";
import { USERNAME_PATTERN } from "./username-pattern";

/**
 * Result of a username check. Checks are advisory: `not_found` and `failed`
 * only warn the member and never block sign-up or saving the profile.
 */
export type UsernameCheckResult = { status: "found" | "not_found" | "failed" };

/*
 * Input outside USERNAME_PATTERN is never sent upstream and reports `failed`
 * ("could not check"), never `not_found`, because we cannot vouch that the
 * service rejects those characters.
 */
const CHECKS_PER_MINUTE = 20;
/** Per server instance, across all clients, for lookups that spend the shared Ludoya quota (100/min). */
const LUDOYA_GLOBAL_PER_MINUTE = 30;

async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  // The platform sets x-real-ip; only fall back to the first forwarded hop.
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}

async function prepare(scope: string, username: unknown, globalPerMinute?: number): Promise<string | null> {
  // Server actions receive whatever the client posts, not what the type says.
  if (typeof username !== "string") return null;
  const clean = username.trim();
  if (!USERNAME_PATTERN.test(clean)) return null;
  // The sign-up form is public, so keep one client from draining the shared upstream quota.
  if (!allowRequest(await clientKey(scope), CHECKS_PER_MINUTE, 60_000)) return null;
  if (globalPerMinute !== undefined && !allowRequest(`${scope}:global`, globalPerMinute, 60_000)) return null;
  return clean;
}

/** Check that a Ludoya account with this username exists (play-intent search). */
export async function checkLudoyaUsername(username: string): Promise<UsernameCheckResult> {
  const clean = await prepare("ludoya-username", username, LUDOYA_GLOBAL_PER_MINUTE);
  if (!clean) return { status: "failed" };
  return { status: await lookupLudoyaUsername(clean) };
}

/** Check that a BoardGameGeek account with this username exists. */
export async function checkBggUsername(username: string): Promise<UsernameCheckResult> {
  const clean = await prepare("bgg-username", username);
  if (!clean) return { status: "failed" };
  return { status: await lookupBggUsername(clean) };
}
