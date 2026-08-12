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
 *
 * COORDINATOR INTEGRATION (Purchase Completion mega-arc, integration
 * phase) — that seam is now taken up. Three real cross-process channels
 * exist post-integration, not one, and a user who is told only "Synced to
 * your configured Relay." cannot tell WHICH of the three actually synced:
 *  - `"order"` — `sendPrivateOrderSyncNonFatal()` (submit/accept/reject/
 *    fulfill/complete), the pre-existing channel this module was built
 *    against.
 *  - `"payment-evidence"` — the Coordinator's own
 *    `sendPrivatePaymentEvidenceSyncNonFatal()`, wiring Agent P's
 *    `RealPaymentEvidenceTransport`/`PaymentEvidenceSendPort`
 *    (`../payment/payment_evidence_port.ts`) into the Electron main
 *    process. Adds ONE genuinely new outcome string beyond the shared
 *    vocabulary: `"evidence-not-transportable"`, produced when
 *    `buildOutboundPaymentEvidenceSyncPayload()` REFUSES to package
 *    non-authoritative evidence — a refusal that is a security feature,
 *    not a network failure, and must never be described as one.
 *  - `"delivery"` — Agent D's `sendPrivateDeliverySyncNonFatal()`, which
 *    reuses the shared vocabulary exactly (`"published"`/
 *    `"transport-error"`/`"network-disabled"`/arbitrary transport
 *    message).
 *
 * The `channel` parameter is OPTIONAL and defaults to `"order"`, so every
 * pre-integration call site and every pre-integration assertion keeps
 * byte-identical output. Only a caller that explicitly names a non-order
 * channel gets the channel-attributing prefix.
 */

export type KnownCommerceSyncOutcome =
  | "published"
  | "duplicate"
  | "rejected"
  | "transport-error"
  | "network-disabled"
  /** Payment-evidence channel only: the OUTBOUND authority gate refused to package this evidence for transport at all (see this file's own header). */
  | "evidence-not-transportable"
  /** This process does not know a counterparty identity to send to, so nothing was transmitted. Never a network failure. */
  | "no-counterparty";

const COMMERCE_SYNC_OUTCOME_TEXT: Readonly<Record<KnownCommerceSyncOutcome, string>> = {
  published: "Synced to your configured Relay.",
  duplicate: "Already synced to your configured Relay.",
  rejected: "The Relay rejected this update. Your local copy is unaffected — you can try again later.",
  "transport-error": "Couldn't reach your configured Relay just now. Your local copy is unaffected — this will not retry automatically.",
  "network-disabled": "Network sync is off for this profile (see Settings → Network). Your local copy is unaffected.",
  "evidence-not-transportable":
    "Not sent: this was not backed by authoritative settlement evidence, so it was refused before anything left this device. Your local copy is unaffected.",
  "no-counterparty": "Not sent: no counterparty identity is known for this order yet. Your local copy is unaffected.",
};

/**
 * Which real cross-process channel an outcome came from. See this file's
 * own header for what each one is and which code produces it. `"order"` is
 * the default precisely so pre-integration callers are unaffected.
 */
export type CommerceSyncChannel = "order" | "payment-evidence" | "delivery";

/**
 * Channel-attributing prefix. `"order"` maps to the empty string so the
 * order channel's text stays exactly what it was before the integration
 * phase — the other two are prefixed so the user can tell WHICH
 * cross-process channel a note is about when several are shown on the
 * same order screen at once.
 */
const COMMERCE_SYNC_CHANNEL_PREFIX: Readonly<Record<CommerceSyncChannel, string>> = {
  order: "",
  "payment-evidence": "Payment confirmation — ",
  delivery: "Delivery update — ",
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
export function describeCommerceSyncOutcome(outcome: string | undefined, channel: CommerceSyncChannel = "order"): string | undefined {
  if (outcome === undefined) return undefined;
  const base = Object.prototype.hasOwnProperty.call(COMMERCE_SYNC_OUTCOME_TEXT, outcome)
    ? COMMERCE_SYNC_OUTCOME_TEXT[outcome as KnownCommerceSyncOutcome]
    : COMMERCE_SYNC_OUTCOME_FALLBACK;
  // Prefix lookup is over a closed, statically-declared union -- an
  // out-of-vocabulary `channel` (only reachable from untyped JS) falls
  // back to no prefix rather than `undefined` leaking into the text.
  const prefix = Object.prototype.hasOwnProperty.call(COMMERCE_SYNC_CHANNEL_PREFIX, channel)
    ? COMMERCE_SYNC_CHANNEL_PREFIX[channel]
    : "";
  return `${prefix}${base}`;
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
