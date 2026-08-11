/**
 * Secure Runtime Alpha 526 ("Retry Reason Codec") — Stage 6 of the
 * Alpha 521–540 Durable Delivery Retry Coordination Arc.
 *
 * Encodes "FinalState"/"RetryReason" (this Arc's own required
 * vocabulary) into the EXISTING, UNCHANGED `FedosDeliveryObservation.reason?: string`
 * field (`./fedos_delivery_observation.js`, Alpha 462) — no new field
 * is added to that type. A terminal (`accepted`/`rejected`/`failed`)
 * Observation's own `reason` always encodes whether THIS attempt is
 * final (no further attempt will ever occur for the same logical
 * intent) or will be retried, plus an optional human-readable detail
 * string (e.g. a Publisher-supplied failure reason).
 *
 * HARD GUARDRAILS:
 *   - `encodeFedosDeliveryRetryReason` and `decodeFedosDeliveryRetryReason`
 *     are the ONLY exports.
 *   - Pure, synchronous — no I/O, no Repository reference.
 *   - `decodeFedosDeliveryRetryReason` NEVER throws — an
 *     unrecognized/malformed input fails closed to `{ isFinal: false,
 *     detail: <the raw string> }`, the conservative reading (assume a
 *     retry might still happen rather than wrongly declare finality).
 */

const FINAL_MARKER = "final";
const RETRY_MARKER = "retry";

export function encodeFedosDeliveryRetryReason(isFinal: boolean, detail: string | null): string {
  const marker = isFinal ? FINAL_MARKER : RETRY_MARKER;
  return detail === null ? marker : `${marker}:${detail}`;
}

export function decodeFedosDeliveryRetryReason(reason: string | undefined): {
  readonly isFinal: boolean;
  readonly detail: string | null;
} {
  if (reason === undefined) return { isFinal: false, detail: null };
  if (reason === FINAL_MARKER) return { isFinal: true, detail: null };
  if (reason.startsWith(`${FINAL_MARKER}:`)) {
    return { isFinal: true, detail: reason.slice(FINAL_MARKER.length + 1) };
  }
  if (reason === RETRY_MARKER) return { isFinal: false, detail: null };
  if (reason.startsWith(`${RETRY_MARKER}:`)) {
    return { isFinal: false, detail: reason.slice(RETRY_MARKER.length + 1) };
  }
  return { isFinal: false, detail: reason };
}
