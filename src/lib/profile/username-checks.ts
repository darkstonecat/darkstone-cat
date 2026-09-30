"use server";

import { headers } from "next/headers";
import { lookupBggUsername } from "@/lib/bgg-user";
import { lookupLudoyaUsername } from "@/lib/ludoya/username";
import { allowRequest } from "@/lib/rate-limit";

/**
 * Result of a username check. Checks are advisory: `not_found` and `failed`
 * only warn the member and never block sign-up or saving the profile.
 */
export type UsernameCheckResult = { status: "found" | "not_found" | "failed" };

const MAX_USERNAME_LENGTH = 64;
const CHECKS_PER_MINUTE = 20;

async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

async function prepare(scope: string, username: string): Promise<string | null> {
  const clean = username.trim();
  if (!clean || clean.length > MAX_USERNAME_LENGTH) return null;
  // The sign-up form is public, so keep one client from draining the shared upstream quota.
  if (!allowRequest(await clientKey(scope), CHECKS_PER_MINUTE, 60_000)) return null;
  return clean;
}

/** Check that a Ludoya account with this username exists (play-intent search). */
export async function checkLudoyaUsername(username: string): Promise<UsernameCheckResult> {
  const clean = await prepare("ludoya-username", username);
  if (!clean) return { status: "failed" };
  return { status: await lookupLudoyaUsername(clean) };
}

/** Check that a BoardGameGeek account with this username exists. */
export async function checkBggUsername(username: string): Promise<UsernameCheckResult> {
  const clean = await prepare("bgg-username", username);
  if (!clean) return { status: "failed" };
  return { status: await lookupBggUsername(clean) };
}
