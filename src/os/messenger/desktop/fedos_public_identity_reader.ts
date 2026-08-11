/**
 * Secure Runtime Alpha 101 ("Public Identity Reader Interface") — the
 * FIRST file of the Alpha 101–105 Public Identity Source Foundation
 * Arc, following the completed Desktop Shell Foundation (Alpha
 * 096–100). `FedosPublicIdentityReader` is a NEW, protocol-independent
 * read boundary — deliberately named without "Nostr" in it, unlike
 * `FedosNostrPublicIdentitySource` (`src/identity/fedos_nostr_public_identity_source.ts`,
 * Alpha 039), which this interface does NOT replace, wrap implicitly,
 * or depend on. This is an INTERFACE ONLY — no implementation exists
 * in this file, and none is wired anywhere yet.
 *
 * HARD GUARDRAILS:
 *   - `FedosPublicIdentityReader` is the ONLY export.
 *   - Exactly ONE method, `readPublicIdentity(): Promise<FedosIdentityDescriptor | null>`
 *     — public identity retrieval, and nothing else.
 *   - NO secret key, `nsec`, seed, mnemonic, or signing method of any
 *     kind on this interface.
 *   - NO Relay, WebSocket, or network method of any kind on this
 *     interface — a conforming implementation MAY read from a network
 *     source internally, but this interface itself names no such
 *     capability.
 *   - NO reference to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`,
 *     `src/nostr/crypto.ts`, `src/nostr/signature.ts`, or
 *     `src/nostr/noble_signature.ts` anywhere in this file.
 */

import type { FedosIdentityDescriptor } from "../../core/identity/fedos_identity_descriptor.js";

export interface FedosPublicIdentityReader {
  readPublicIdentity(): Promise<FedosIdentityDescriptor | null>;
}
