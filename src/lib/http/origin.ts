/**
 * Same-origin check for state-changing or data-exporting POST routes (CSRF). A browser always
 * sends `Origin` on a cross-site POST, so a request whose Origin is not the site itself was not
 * made by our pages. Used by the contact form and the admin exports.
 *
 * **Update SITE_ORIGINS if the production domain changes**, or these routes start answering 403.
 * Vercel preview deployments (`*.vercel.app`) are deliberately not accepted.
 */

export const SITE_ORIGINS: readonly string[] = ["https://darkstone.cat", "https://www.darkstone.cat"];

const LOCALHOST_ORIGIN = /^http:\/\/localhost:(\d{1,5})$/;

export type OriginOptions = {
  /** localhost ports accepted outside production; all ports when omitted. */
  localhostPorts?: readonly number[];
  /**
   * Environment variable that, set to "1", also accepts those localhost origins in production
   * (testing against a local production build). Never set it in Vercel.
   */
  allowLocalhostEnv?: string;
};

/**
 * True for the production origins, and for `http://localhost:<port>` outside production (or in
 * production when `allowLocalhostEnv` names a variable set to "1"). Anything else, a missing
 * header or the literal `null` (sandboxed frames, some redirects) is refused.
 */
export function isAllowedOrigin(origin: string | null | undefined, options: OriginOptions = {}): boolean {
  if (!origin) return false;
  if (SITE_ORIGINS.includes(origin)) return true;

  const local = LOCALHOST_ORIGIN.exec(origin);
  if (!local) return false;
  if (options.localhostPorts && !options.localhostPorts.includes(Number(local[1]))) return false;

  return (
    process.env.NODE_ENV !== "production" ||
    (options.allowLocalhostEnv !== undefined && process.env[options.allowLocalhostEnv] === "1")
  );
}
