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
import type { FedosNostrWireEvent } from "../../desktop/fedos_nostr_wire_event.js";
import type { FedosEventDescriptor } from "../../desktop/fedos_event_descriptor.js";
import type { FedosPrivateWireRouteRequest } from "./fedos_private_wire_route.js";

export interface FedosPrivateWireBuildInput {
  readonly envelope: FedosConversationMessageEnvelope;
  readonly ciphertext: Uint8Array;
  readonly counterpartyPublicKeyHex: string;
  readonly localAccountIndex: number;
  /**
   * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap
   * Standard Delivery Arc") Phase G (Alpha 1788) — ADDITIVE, OPTIONAL.
   * `FedosPrivateV1WireAdapter` ignores this field entirely (it builds
   * its wire event from `ciphertext` alone, exactly as before this
   * Arc — the Envelope domain's own "plaintext never travels through
   * this domain" guardrail is unaffected for the proprietary route).
   * `NostrNip17V1WireAdapter` REQUIRES it: NIP-17's own Rumor is built
   * from, and NIP-44-encrypted from, the ORIGINAL plaintext — this
   * Arc's own absolute prohibition on repurposing this crate's generic
   * Envelope-AEAD `ciphertext` as NIP-44 wire ciphertext means the
   * standard route cannot be built from `ciphertext` at all. A caller
   * that only ever drives the proprietary route may safely omit this
   * field forever; a caller wiring the standard route must supply the
   * plaintext bytes at the SAME call site (never persisted here, never
   * added to `FedosConversationMessageEnvelope` itself, never routed
   * through `FedosConversationPayloadStorage` — this field exists only
   * to cross this one function call).
   */
  readonly plaintext?: Uint8Array;
}

export interface FedosPrivateWireParsedEvent {
  readonly envelopeId: string;
  readonly recipientPublicKeyHex: string;
  readonly ciphertext: Uint8Array;
}

/**
 * Secure Runtime Alpha 1761–1840 Phase G (Alpha 1788) — the fully
 * unwrapped result of a standard NIP-17 Gift-Wrap/Seal/Rumor pipeline.
 * Deliberately a SEPARATE type from `FedosPrivateWireParsedEvent` above
 * (not an additional optional field bolted onto it) — a decrypted Rumor
 * is a full unsigned Nostr event (pubkey/created_at/kind/tags/content),
 * structurally nothing like a single opaque `ciphertext: Uint8Array`
 * blob, and forcing one shape to cover both would blur the exact
 * "already-opaque ciphertext bytes only" contract
 * `FedosPrivateWireParsedEvent` was documented against. `envelopeId` is
 * the Rumor's own `id` (its NIP-01 canonical hash, even though the
 * Rumor itself is never signed) — the SAME provenance role
 * `FedosPrivateWireParsedEvent.envelopeId` plays for the proprietary
 * route.
 */
export interface FedosPrivateWireParsedRumor {
  readonly envelopeId: string;
  readonly senderPublicKeyHex: string;
  readonly recipientPublicKeyHex: string;
  readonly createdAt: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
}

/**
 * The one closed outcome vocabulary EVERY adapter's `build()` returns —
 * `"unsupported"` (never a thrown error, never a silently-degraded
 * partial event) is how `NostrNip17V1WireAdapter` reported its own
 * permanently-blocked state before this Arc (Alpha 1617), and is still
 * how it reports malformed/missing input today. `FedosPrivateV1WireAdapter`
 * never returns `"unsupported"` — it is always available.
 *
 * `"built-signed"` is ADDITIVE (Alpha 1788) — `NostrNip17V1WireAdapter`'s
 * own outcome, never returned by `FedosPrivateV1WireAdapter`. NIP-17's
 * own Gift Wrap MUST be signed by a fresh, single-use EPHEMERAL key
 * (NIP-59 §3) — never the caller's real signing authority
 * (`FedosNostrUnsignedEventRequest` implies "hand this to
 * `FedosNostrSigningAuthority.signEvent()`", which always signs with the
 * REAL, Master-Seed-derived account; that would be a protocol violation
 * for the outer Gift Wrap). Since a Wire Adapter is the ONE boundary
 * that owns "native event identity" (this file's own interface doc
 * comment), and the standard route's real signing identity is
 * necessarily split across two different keys (the real sender signs
 * the inner Seal, a fresh ephemeral key signs the outer Gift Wrap), the
 * adapter must be allowed to return an ALREADY-SIGNED event for the
 * standard route rather than an unsigned request for the caller to sign
 * once. This is additive (a new variant, not a change to `"built"`) and
 * does not affect `FedosPrivateV1WireAdapter` in any way.
 */
export type FedosPrivateWireBuildResult =
  | { readonly outcome: "built"; readonly request: FedosNostrUnsignedEventRequest }
  | { readonly outcome: "built-signed"; readonly event: FedosNostrWireEvent }
  | { readonly outcome: "unsupported" };

/**
 * The one closed outcome vocabulary EVERY adapter's `parse()` returns.
 * `"not-mine"` is the SAME fail-closed-to-null discipline
 * `parseFedosPrivateTransportEventDescriptor()` already established,
 * named explicitly here so a caller trying multiple adapters in
 * sequence can distinguish "not this adapter's own event shape" from a
 * hard `"unsupported"` adapter.
 *
 * `"parsed-rumor"` is ADDITIVE (Alpha 1788) — `NostrNip17V1WireAdapter`'s
 * own outcome for a fully-validated, fully-decrypted standard delivery
 * (Gift Wrap -> Seal -> Rumor), carrying a
 * [`FedosPrivateWireParsedRumor`] rather than a `FedosPrivateWireParsedEvent`
 * (see that type's own doc comment for why). `FedosPrivateV1WireAdapter`
 * never returns this variant.
 */
export type FedosPrivateWireParseResult =
  | { readonly outcome: "parsed"; readonly event: FedosPrivateWireParsedEvent }
  | { readonly outcome: "parsed-rumor"; readonly rumor: FedosPrivateWireParsedRumor }
  | { readonly outcome: "not-mine" }
  | { readonly outcome: "unsupported" };

/**
 * The narrow contract a Wire Adapter implements — event shape,
 * encryption wrapping (already-opaque ciphertext bytes only for the
 * proprietary route; real NIP-44/NIP-59 construction for the standard
 * route), tags/kinds, native event identity, and unwrap/classification.
 * `route` is this adapter's own entry in the Alpha 1613 vocabulary —
 * fixed per adapter, never computed.
 *
 * Secure Runtime Alpha 1761–1840 Phase G (Alpha 1788) — `build()`/
 * `parse()` are now `async` (a SIGNATURE change to this frozen
 * interface, made only because a REVIEWED DEFECT proves the prior
 * synchronous shape cannot express the standard route's real behavior:
 * NIP-17's construction/unwrap pipeline requires multiple sequential
 * calls into the Rust/WASM NIP-44 wire bridge and the ephemeral
 * Gift-Wrap signing authority — genuinely asynchronous operations, not
 * something a synchronous method can wrap or defer). This is NOT a
 * redesign: the four members (`route`/`isAvailable`/`build`/`parse`) and
 * every existing outcome variant are unchanged; only the return type of
 * two methods is `Promise`-wrapped. `FedosPrivateV1WireAdapter`'s own
 * `build()`/`parse()` bodies are byte-for-byte unchanged internally —
 * only the `async` keyword is added, a trivial wrap with zero observable
 * behavior change, since neither ever awaited anything to begin with.
 * No existing caller is broken by this change: per this file's own
 * Alpha 1616 header, `FedosPrivateTransport` does not yet call through
 * this interface at all (Phase G's own constructor-injection work below
 * is this interface's FIRST real caller) — there is no synchronous call
 * site anywhere in this repository to break.
 */
export interface FedosPrivateWireAdapter {
  readonly route: FedosPrivateWireRouteRequest;
  /** `true` for `FedosPrivateV1WireAdapter`, always. `true` for `NostrNip17V1WireAdapter` as of Alpha 1768's own real vector-gate pass (Phase B) — see that adapter's own header for the exact verification this claim rests on. Never probes the network or a Relay — a static, local fact about this build. */
  isAvailable(): boolean;
  build(input: FedosPrivateWireBuildInput): Promise<FedosPrivateWireBuildResult>;
  parse(descriptor: FedosEventDescriptor): Promise<FedosPrivateWireParseResult>;
}
