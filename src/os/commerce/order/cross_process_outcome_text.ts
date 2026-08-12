/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) — pure, honest
 * copy for the `nostrSyncOutcome` value the main process already computes
 * and returns on several Commerce results, but which
 * `fedos_electron_beta_renderer.ts` never read or rendered before this
 * arc: a real cross-process sync failure (e.g. the counterparty was never
 * actually notified a payment was accepted, or a listing never actually
 * reached the Relay) was silently dropped at the UI layer — confirmed live
 * by grep (zero occurrences of `nostrSyncOutcome` in the renderer or its
 * window type declarations prior to this file). This directly violates
 * this arc's own "No silent failure" requirement for cross-process paths.
 *
 * Mirrors `OUTCOME_TEXT`/`describeOutcome()`'s established closed-
 * vocabulary-with-safe-fallback discipline in `fedos_electron_beta_renderer.ts`
 * exactly, kept in its own pure/testable module (this package has no
 * jsdom/DOM test harness — see this file's own test for how the renderer
 * wiring is proven separately, by structural inspection) rather than
 * inline there.
 *
 * TWO known real vocabularies feed this map today:
 *  - `CommerceNostrPublishOutcome` (`src/os/commerce/events/commerce_nostr_event_port.ts`):
 *    `"published" | "duplicate" | "rejected" | "transport-error" | "network-disabled"`
 *    — used by product publish/unpublish/update sync.
 *  - `sendPrivateOrderSyncNonFatal()`'s own return value
 *    (`fedos_electron_beta_main.cts`): `"network-disabled"`, `"published"`,
 *    `"transport-error"`, OR an ARBITRARY transport-supplied
 *    `result.message` string — used by every Order-action sync (submit/
 *    accept/reject/fulfill/complete). That arbitrary transport message is
 *    exactly why `describeCommerceSyncOutcome()` NEVER echoes its input
 *    string back verbatim on a lookup miss — only a generic, safe
 *    fallback, exactly like `describeOutcome()`'s own unknown-outcome
 *    fallback. An arbitrary transport string could otherwise carry
 *    anything (including something the transport itself failed to
 *    sanitize) straight into user-facing DOM text.
 *
 * INTEGRATION SEAM for the Coordinator: Agent P's real payment transport
 * (landing in parallel this wave, not present in this worktree) may
 * introduce NEW outcome strings on this same channel (e.g. distinct
 * payment-relay failure modes), and Agent D's real delivery/content
 * transport likewise. Any unrecognized string safely falls through to
 * `COMMERCE_SYNC_OUTCOME_FALLBACK` below rather than crashing or leaking —
 * add a specific entry to `COMMERCE_SYNC_OUTCOME_TEXT` once each real
 * vocabulary is known; this function's contract does not need to change.
 */

export type KnownCommerceSyncOutcome = "published" | "duplicate" | "rejected" | "transport-error" | "network-disabled";

const COMMERCE_SYNC_OUTCOME_TEXT: Readonly<Record<KnownCommerceSyncOutcome, string>> = {
  published: "Synced to your configured Relay.",
  duplicate: "Already synced to your configured Relay.",
  rejected: "The Relay rejected this update. Your local copy is unaffected — you can try again later.",
  "transport-error": "Couldn't reach your configured Relay just now. Your local copy is unaffected — this will not retry automatically.",
  "network-disabled": "Network sync is off for this profile (see Settings → Network). Your local copy is unaffected.",
};

/** Safe generic fallback for ANY outcome string not in the closed vocabulary above — including an arbitrary transport-supplied message (see this file's own header). Never leaks the raw input. */
const COMMERCE_SYNC_OUTCOME_FALLBACK = "Couldn't confirm this synced to your configured Relay. Your local copy is unaffected.";

/**
 * Safe, honest, non-jargon copy for one `nostrSyncOutcome` value.
 * `undefined` input (the field is optional — omitted whenever the network-
 * sync attempt hasn't run at all, e.g. this profile has no Commerce sync
 * transport configured for the current call) produces `undefined`, so a
 * caller can cleanly render "no supplementary sync note" — never a
 * fabricated "synced" claim.
 */
export function describeCommerceSyncOutcome(outcome: string | undefined): string | undefined {
  if (outcome === undefined) return undefined;
  if (Object.prototype.hasOwnProperty.call(COMMERCE_SYNC_OUTCOME_TEXT, outcome)) {
    return COMMERCE_SYNC_OUTCOME_TEXT[outcome as KnownCommerceSyncOutcome];
  }
  return COMMERCE_SYNC_OUTCOME_FALLBACK;
}

/**
 * True for outcomes that represent a real problem worth flagging distinctly
 * from ordinary success (`"published"`/`"duplicate"`) — lets a caller
 * decide presentation (e.g. a plain `.muted` note vs. a more visible
 * `.warn` one) without re-deriving the vocabulary itself. `undefined` is
 * never concerning (see `describeCommerceSyncOutcome()`'s own doc on why
 * `undefined` means "no attempt happened", not "attempt failed").
 */
export function isCommerceSyncOutcomeConcerning(outcome: string | undefined): boolean {
  return outcome !== undefined && outcome !== "published" && outcome !== "duplicate";
}
