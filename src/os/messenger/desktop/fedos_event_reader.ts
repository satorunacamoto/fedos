/**
 * Secure Runtime Alpha 202 ("Desktop-Facing Event Reader Abstraction")
 * — the SECOND new file of this Stage, alongside
 * `fedos_event_descriptor.ts`. `FedosEventReader` is a NEW,
 * protocol-independent read boundary for Events — deliberately named
 * without "Nostr" in it, mirroring `FedosPublicIdentityReader`
 * (`fedos_public_identity_reader.ts`, Alpha 101) exactly: an INTERFACE
 * ONLY, no implementation in this file, wired into nothing yet.
 * `NullEventReader` (Alpha 203) is the first implementation; whether
 * `DesktopApplication` gains a method reading through this interface
 * is Alpha 203's own separate decision.
 *
 * HARD GUARDRAILS:
 *   - `FedosEventReader` is the ONLY export.
 *   - Exactly ONE method, `readEvents(): Promise<readonly FedosEventDescriptor[]>`
 *     — read-only Event retrieval, and nothing else.
 *   - NO method that constructs, signs, or mutates an Event of any
 *     kind — Desktop may only ever OBSERVE Events that already exist
 *     (Alpha 204/205 confirm this by direct inspection).
 *   - NO secret key, `nsec`, seed, mnemonic, or signing method of any
 *     kind on this interface.
 *   - NO Relay, WebSocket, Subscription, or Filter method of any kind
 *     on this interface — a conforming implementation MAY read from a
 *     network source internally, but this interface itself names no
 *     such capability, exactly as `FedosPublicIdentityReader`'s own
 *     Alpha 101 guardrail already established for the identity-layer
 *     equivalent.
 *   - NO reference to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`,
 *     `src/nostr/crypto.ts`, `src/nostr/signature.ts`, or
 *     `src/nostr/noble_signature.ts` anywhere in this file.
 *   - NO reference to `FedosNostrEventHandle` or any
 *     `packages/fedos-core-rust` symbol of any kind — this interface
 *     is defined entirely independently of the pub(crate)-only Rust
 *     Event Foundation (Alpha 201 §2/§5).
 */

import type { FedosEventDescriptor } from "./fedos_event_descriptor.js";

export interface FedosEventReader {
  readEvents(): Promise<readonly FedosEventDescriptor[]>;
}
