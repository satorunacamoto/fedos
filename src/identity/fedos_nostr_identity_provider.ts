/**
 * Secure Runtime Alpha 035 — "FedOS Nostr Identity Provider".
 *
 * The FIRST Nostr-specific `FedosIdentityProvider` (Alpha 029)
 * implementation anywhere in this repository — the "leading candidate"
 * Alpha 027 §8 named but never built. See
 * `docs/secure_runtime_alpha_035_fedos_nostr_identity_provider.md` for
 * the full design rationale: why a Nostr Provider is added now, why
 * `describeIdentity()` still always resolves `null` at this Stage, why
 * this is deliberately NOT wired into `resolveFedosIdentityProvider()`
 * (Alpha 032/034), the comparison against `NoopFedosIdentityProvider`
 * (Alpha 033), the future Descriptor-fetching plan this Stage does not
 * implement, and why no secret key of any kind is read, derived, or
 * held here.
 *
 * This file defines a SINGLE CLASS and nothing else — no constructor,
 * no configuration, no internal state, no thrown exceptions, no
 * Resolver reference, no Runtime reference, and no wiring into
 * `FedosIdentityService` (Alpha 031) or any other module in this
 * repository. `describeIdentity()` always resolves to `null`.
 *
 * HARD GUARDRAILS:
 *   - NO Relay connection of any kind (no `src/nostr/relay.ts` or
 *     `src/nostr/ws_relay.ts` import).
 *   - NO Nostr event construction, parsing, publishing, or subscribing
 *     (no `src/nostr/event.ts`, `src/nostr/messages.ts`, or
 *     `src/nostr/publish.ts` import).
 *   - NO signing or signature verification (no `src/nostr/signature.ts`
 *     or `src/nostr/noble_signature.ts` import).
 *   - NO secret key, `nsec`, or `npub` handling of any kind (no
 *     `src/nostr/crypto.ts` import).
 *   - NO Resolver, Service, Runtime, or Worker reference.
 */

import type { FedosIdentityDescriptor } from "./fedos_identity_descriptor.js";
import type { FedosIdentityProvider } from "./fedos_identity_provider.js";

export class NostrIdentityProvider implements FedosIdentityProvider {
  readonly provider = "nostr";

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    return null;
  }
}
