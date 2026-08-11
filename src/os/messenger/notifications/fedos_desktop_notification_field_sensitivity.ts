/**
 * Runtime Ownership Extraction Arc — Root Cause C fix.
 *
 * `fedos_desktop_notification_types.ts` used to import
 * `isSensitiveNotificationField` from `src/notification/policy.ts`, a
 * generic, desktop-agnostic seam for a FUTURE EXTERNAL push transport
 * (Telegram/LINE/APNs/FCM/Email) that this file's own header already
 * documents as "DELIBERATELY UNRELATED, never merged" with this Desktop
 * OS-notification-tray boundary. That import was a real, live, intentional
 * cross-root dependency (not a stray old-path leftover) — but `src/notification/`
 * is not `os/core`, `os/messenger`, or `os/commerce`, so the import was a
 * genuine package-extraction blocker: `@fedos/messenger` cannot depend on a
 * bare top-level `src/notification/` directory that isn't itself a package.
 *
 * Fix: duplicate the ONE pure, stateless helper this boundary actually
 * needs, rather than invent a new shared-package seam for a single
 * ~8-line function, or accept a cross-root dependency the two boundaries'
 * own documented independence already argues against. If `src/notification/`
 * is ever promoted to a real, live capability, this is the one place to
 * reconcile — see `docs/architecture/PACKAGE-EXTRACTION-PLAN.md`, Root
 * Cause C.
 *
 * Kept intentionally identical in behavior to
 * `src/notification/policy.ts`'s `isSensitiveNotificationField` at the time
 * of this fork (same conservative marker list, same case-insensitive
 * substring match) — but now independently owned and independently
 * evolvable by this boundary, matching the "two boundaries remain
 * independent" framing `fedos_desktop_notification_types.ts` already
 * documented for itself.
 */

/**
 * Substrings that mark a VALUE as sensitive (case-insensitive). Deliberately
 * conservative: matching one denies/sanitizes the field. Long hex strings are
 * NOT flagged, because an opaque public pubkey is legitimate hex — only
 * explicit secret markers are treated as sensitive.
 */
const SENSITIVE_VALUE_MARKERS: readonly string[] = [
  "secret",
  "seed",
  "passphrase",
  "password",
  "private key",
  "privatekey",
  "nsec", // bech32 private key prefix
  "credential",
  "entitlement",
  "bearer ",
  "api key",
  "apikey",
  "payment",
  "card number",
  "cardnumber",
  "cvv",
  "token",
];

/** True if a string value looks like it carries secret/sensitive content. */
export function isSensitiveNotificationField(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_VALUE_MARKERS.some((marker) => v.includes(marker));
}
