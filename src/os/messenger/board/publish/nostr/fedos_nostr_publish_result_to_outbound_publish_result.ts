/**
 * Secure Runtime Alpha 496 ("Publisher Adapter") — Stage 6 of the Alpha
 * 491–500 Canonical Publisher & Delivery Observation Contract
 * Reconciliation Arc.
 *
 * Converts `FedosNostrBoardPublisher.publishOne()`'s own bare `boolean`
 * (Alpha 455, UNCHANGED) into the canonical `FedosOutboundPublishResult`
 * (`../fedos_outbound_publish_result.js`, Alpha 492).
 *
 * `true` -> `{ outcome: "accepted", externalReference: event.id }` —
 * `event.id` is the event's OWN deterministically-computed NIP-01 id,
 * already known locally before the send, NEVER a relay-issued token.
 * Per Alpha 492 §5's own named limitation: this means "this
 * repository's own transport attempt completed without a local error,"
 * never "the relay confirmed receipt" — `FedosRelay.publish()` (Alpha
 * 216) returns no value of any kind and this repository has no
 * OK-correlation mechanism anywhere.
 *
 * `false` -> `{ outcome: "failed", externalReference: null }` — NEVER
 * `"rejected"`: rejection requires an explicit negative signal from the
 * counterparty, which requires the same OK-correlation this repository
 * does not have.
 *
 * HARD GUARDRAILS:
 *   - `nostrPublishOneResultToOutboundPublishResult` is the ONLY export.
 *   - Pure and synchronous — no Relay, Observation, or retry-policy
 *     reference of any kind.
 *   - Never produces `outcome: "rejected"`.
 */

import type { FedosNostrWireEvent } from "../../../../../desktop/fedos_nostr_wire_event.js";
import type { FedosOutboundPublishResult } from "../fedos_outbound_publish_result.js";

export function nostrPublishOneResultToOutboundPublishResult(
  success: boolean,
  event: FedosNostrWireEvent,
): FedosOutboundPublishResult {
  if (success) {
    return { outcome: "accepted", externalReference: event.id };
  }
  return { outcome: "failed", externalReference: null };
}
