/**
 * Secure Runtime Alpha 454 ("Nostr Wire Event to Event Descriptor
 * Mapping") — Stage 4 of the Alpha 451–460 Canonical Nostr Outbound
 * Publisher Foundation Arc.
 *
 * The Outbox→Relay conversion this Arc's own scope names:
 * `FedosRelay.publish()` (`../../../desktop/fedos_relay.ts`, Alpha 216,
 * UNCHANGED) accepts only a `FedosEventDescriptor` (Alpha 202); the
 * Nostr Signing Authority (`src/nostr/sign/`, Alpha 442–445, UNCHANGED)
 * produces only a `FedosNostrWireEvent` (Alpha 234). Alpha 234's own
 * header already anticipated this exact adapter ("a later adapter...
 * MAY map one onto the other; this Stage builds no such adapter") —
 * this file IS that later adapter, the mirror image of
 * `WebSocketRelay.publish()`'s own INBOUND-direction wire mapping
 * (Alpha 216: `author`→`pubkey`, `createdAt`→`created_at`,
 * `signature`→`sig`, `provider` DROPPED). Here the direction reverses:
 * `pubkey`→`author`, `created_at`→`createdAt`, `sig`→`signature`,
 * `id`/`kind`/`tags`/`content` verbatim, and `provider` is SUPPLIED as
 * the fixed literal `"nostr"`, since no wire source for it exists on
 * `FedosNostrWireEvent` itself (Alpha 234's own "no provider field"
 * guardrail).
 *
 * HARD GUARDRAILS:
 *   - `nostrWireEventToFedosEventDescriptor` is the ONLY export.
 *   - Pure and synchronous — no network I/O, no Relay reference, no
 *     Outbox reference, no signing, no validation beyond the mapping
 *     itself (the input is trusted to already be a well-formed
 *     `FedosNostrWireEvent`, exactly as `WebSocketRelay.publish()`'s own
 *     reverse mapping trusts its own `FedosEventDescriptor` input).
 *   - `provider` is ALWAYS the fixed literal `"nostr"` — never derived,
 *     never caller-overridable.
 *   - No field is dropped, renamed beyond the fixed six-field map above,
 *     or synthesized beyond `provider`.
 */

import type { FedosNostrWireEvent } from "../../../desktop/fedos_nostr_wire_event.js";
import type { FedosEventDescriptor } from "../../../desktop/fedos_event_descriptor.js";

export function nostrWireEventToFedosEventDescriptor(event: FedosNostrWireEvent): FedosEventDescriptor {
  return Object.freeze({
    id: event.id,
    provider: "nostr",
    author: event.pubkey,
    createdAt: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    signature: event.sig,
  });
}
