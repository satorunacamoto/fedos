/**
 * Secure Runtime Alpha 1616 ("Transport/Protocol Separation") — part of
 * the Alpha 1611–1690 Nostr Private Wire Standardization and Transport
 * Reconciliation Arc.
 *
 * Freezes the boundary this Arc's own task text specifies:
 *
 *   FedosPrivateTransport
 *       |
 *       v
 *   FedosPrivateWireAdapter
 *       +-- FedosPrivateV1WireAdapter   (fedos_private_v1_wire_adapter.ts)
 *       +-- NostrNip17V1WireAdapter     (../delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.ts)
 *
 * Transport (`fedos_private_transport.ts`, `fedos_conversation_transport_scheduler.ts`,
 * `relay/*` — ALL unmodified by this Arc beyond Alpha 1615's own kind-1
 * closure inside the event module a Wire Adapter now also wraps) owns
 * Relay connections, mailbox/ephemeral scheduling, multi-Relay fanout,
 * retry, and inbound dedup — exactly as before this Arc.
 *
 * A Wire Adapter owns event shape, encryption wrapping, tags/kinds,
 * native event identity, and unwrap/classification — this interface is
 * that boundary's own narrow contract. `FedosConversationRuntime` owns
 * neither (unmodified, untouched by this Arc).
 *
 * THIS ARC'S OWN SCOPE DECISION (see the Phase A reconciliation report,
 * `docs/secure_runtime_alpha_1611_1690_phase_a_reconciliation.md`, §9,
 * and the completion declaration): `FedosPrivateTransport` and its own
 * signed-event-source/inbound-subscription call sites continue to call
 * `fedos_conversation_transport_event.ts`'s own
 * `buildFedosPrivateTransportUnsignedEventRequest()`/
 * `parseFedosPrivateTransportEventDescriptor()` functions directly,
 * UNCHANGED beyond Alpha 1615's own kind-1 closure — `FedosPrivateV1WireAdapter`
 * below is a REAL, additive, behavior-preserving wrapper around those
 * SAME functions, but wiring `FedosPrivateTransport`'s own constructor
 * to accept and dispatch through an INJECTED adapter is deliberately
 * deferred: with `NostrNip17V1WireAdapter` permanently `"unsupported"`
 * today (Alpha 1617's own Normative Source Gate blocker), adding a live
 * route-selection knob to `FedosPrivateTransport` itself would be a
 * speculative abstraction with no real second behavior to select
 * between yet — explicitly prohibited by this Arc's own "No speculative
 * abstractions" instruction. Wiring real runtime adapter selection into
 * `FedosPrivateTransport`/its Signed Event Source/Inbound Subscription
 * is this boundary's own next real consumer, once
 * `NostrNip17V1WireAdapter` has a real Gift-Wrap implementation to
 * offer (see the completion declaration's own recommended next Arc).
 */

import type { FedosConversationMessageEnvelope } from "../envelope/fedos_conversation_message_envelope.js";
import type { FedosNostrUnsignedEventRequest } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosEventDescriptor } from "../../desktop/fedos_event_descriptor.js";
import type { FedosPrivateWireRouteRequest } from "./fedos_private_wire_route.js";

export interface FedosPrivateWireBuildInput {
  readonly envelope: FedosConversationMessageEnvelope;
  readonly ciphertext: Uint8Array;
  readonly counterpartyPublicKeyHex: string;
  readonly localAccountIndex: number;
}

export interface FedosPrivateWireParsedEvent {
  readonly envelopeId: string;
  readonly recipientPublicKeyHex: string;
  readonly ciphertext: Uint8Array;
}

/**
 * The one closed outcome vocabulary EVERY adapter's `build()` returns —
 * `"unsupported"` (never a thrown error, never a silently-degraded
 * partial event) is how `NostrNip17V1WireAdapter` reports its own
 * permanently-blocked state (Alpha 1617). `FedosPrivateV1WireAdapter`
 * never returns `"unsupported"` — it is always available.
 */
export type FedosPrivateWireBuildResult =
  | { readonly outcome: "built"; readonly request: FedosNostrUnsignedEventRequest }
  | { readonly outcome: "unsupported" };

/**
 * The one closed outcome vocabulary EVERY adapter's `parse()` returns.
 * `"not-mine"` is the SAME fail-closed-to-null discipline
 * `parseFedosPrivateTransportEventDescriptor()` already established,
 * named explicitly here so a caller trying multiple adapters in
 * sequence can distinguish "not this adapter's own event shape" from a
 * hard `"unsupported"` adapter.
 */
export type FedosPrivateWireParseResult =
  | { readonly outcome: "parsed"; readonly event: FedosPrivateWireParsedEvent }
  | { readonly outcome: "not-mine" }
  | { readonly outcome: "unsupported" };

/**
 * The narrow contract a Wire Adapter implements — event shape,
 * encryption wrapping (already-opaque ciphertext bytes only; no adapter
 * implementing this interface ever encrypts/decrypts/derives a key
 * itself), tags/kinds, native event identity, and unwrap/classification.
 * `route` is this adapter's own entry in the Alpha 1613 vocabulary —
 * fixed per adapter, never computed.
 */
export interface FedosPrivateWireAdapter {
  readonly route: FedosPrivateWireRouteRequest;
  /** `true` for `FedosPrivateV1WireAdapter`, always. `false` for `NostrNip17V1WireAdapter` until a real Gift-Wrap implementation exists (Alpha 1617). Never probes the network or a Relay — a static, local fact about this build. */
  isAvailable(): boolean;
  build(input: FedosPrivateWireBuildInput): FedosPrivateWireBuildResult;
  parse(descriptor: FedosEventDescriptor): FedosPrivateWireParseResult;
}
