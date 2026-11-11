/** Google Form used to join the association while web sign-up is not public. */
export const MEMBERSHIP_FORM_URL =
  "https://docs.google.com/forms/d/1OBM0vAOs0vvBioSeop4T0aYh__ysuNEOy36kprTJo7Q/viewform";

/**
 * Whether the member area is advertised: the navbar login button and the
 * sign-up link on `/login`. Off unless `NEXT_PUBLIC_MEMBER_AREA_PUBLIC` is
 * exactly "1". The pages themselves stay reachable by direct URL either way.
 * The value is inlined at build time, so changing it needs a redeploy.
 */
export function isMemberAreaPublic(): boolean {
  return process.env.NEXT_PUBLIC_MEMBER_AREA_PUBLIC === "1";
}
