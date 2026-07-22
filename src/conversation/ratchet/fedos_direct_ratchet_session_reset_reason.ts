/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — the closed Session Reset reason vocabulary named by
 * `docs/reviews/fedos_ratchet_multidevice_identity_rotation_v1/09_session_reset_and_reestablishment.md`'s
 * own "Reset reasons" section.
 *
 * Deliberately excludes reasons that review named but explicitly declined
 * to build a trigger for: "peer-requested" (no peer-request signal exists
 * yet — see this Arc's own completion declaration), "device-replacement"
 * and "device-revocation" (neither is a reset of an EXISTING generation —
 * a replacement/revocation always starts fresh at generation `0` for a
 * brand-new tuple, or makes the tuple permanently unresolvable; never a
 * `generation + 1` reset of a live session), "suite/version change" (only
 * one suite exists), "identity rotation" and "rollback detection" (neither
 * is a live concept in this codebase — inventing a trigger for either
 * would be inventing the feature itself, which this Arc does not do).
 *
 * Secure Runtime Alpha 5961-6040 (FedOS Identity Transition Peer
 * Notification and Ratchet Reset Integration Arc) is exactly the trigger
 * this header named as not-yet-invented for "identity rotation" — it adds
 * `"identity-transition"` below. This is a purely additive widening of a
 * closed string union: `resetReason` is already typed
 * `FedosDirectRatchetSessionResetReason | null` everywhere it flows
 * (`fedos_direct_ratchet_session_reset_authentication.ts`'s signable
 * content, the reset record, the reset authority), so no field, no array
 * position, and no existing signature/digest shape changes.
 */

export type FedosDirectRatchetSessionResetReason =
  | "missing-sealed-state"
  | "corrupt-sealed-state"
  | "excessive-skipped-key-gap"
  | "suspected-compromise"
  | "identity-transition";

export const FEDOS_DIRECT_RATCHET_SESSION_RESET_REASONS: readonly FedosDirectRatchetSessionResetReason[] = [
  "missing-sealed-state",
  "corrupt-sealed-state",
  "excessive-skipped-key-gap",
  "suspected-compromise",
  "identity-transition",
];

export function isWellFormedFedosDirectRatchetSessionResetReason(
  value: unknown,
): value is FedosDirectRatchetSessionResetReason {
  return typeof value === "string" && (FEDOS_DIRECT_RATCHET_SESSION_RESET_REASONS as readonly string[]).includes(value);
}
