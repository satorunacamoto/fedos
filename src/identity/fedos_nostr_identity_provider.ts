/**
 * Secure Runtime Alpha 035 — "FedOS Nostr Identity Provider". Secure
 * Runtime Alpha 039 — "Nostr Public Identity Source Boundary". Secure
 * Runtime Alpha 046 — "Nostr Identity Provider Descriptor Expansion".
 * Secure Runtime Alpha 049 — "Nostr Identity Provider Source Resolver
 * Integration" (this revision — constructor default only).
 *
 * The FIRST Nostr-specific `FedosIdentityProvider` (Alpha 029)
 * implementation anywhere in this repository — the "leading candidate"
 * Alpha 027 §8 named but never built. Alpha 035 shipped this class with
 * a permanently-`null` `describeIdentity()`, no constructor, and no
 * source of any kind. Alpha 039 gave it a real, minimal, publicly-safe
 * information source — a single injected `FedosNostrPublicIdentitySource`
 * — and changed `describeIdentity()` from a fixed `return null;` into a
 * validated DELEGATION to that source, mapping only `id`/`publicIdentifier`
 * onto the returned Descriptor. Alpha 046 then wired
 * `snapshot.displayName`/`snapshot.avatar` onto the returned Descriptor
 * too. Every caller before this Stage had to supply a
 * `FedosNostrPublicIdentitySource` explicitly — `fedos_identity_provider_resolver.ts`
 * (Alpha 039) constructs one inline (`new NullNostrPublicIdentitySource()`)
 * every time it builds the shared `NostrIdentityProvider` singleton.
 * Alpha 048 then gave Source selection its own dedicated seam,
 * `resolveNostrPublicIdentitySource()`, without wiring it into anything.
 * THIS Stage is that wiring: the constructor's `source` parameter now
 * DEFAULTS to `resolveNostrPublicIdentitySource()` when the caller omits
 * it — explicit injection remains fully supported, unchanged, for any
 * caller (including every existing test) that still wants to pass its
 * own Source. See
 * `docs/secure_runtime_alpha_049_nostr_identity_provider_source_resolver_integration.md`
 * for this Stage's own full design rationale, and
 * `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
 * for the original Source Boundary rationale: why a Source Boundary was
 * introduced instead of deriving identity from a secret key, why no
 * fixed/dummy npub is ever used, why the Resolver's own default
 * construction still results in `describeIdentity()` resolving `null`
 * (via `NullNostrPublicIdentitySource`), and the Provider/Source
 * responsibility split.
 *
 * This file defines a SINGLE CLASS and nothing else — one constructor
 * parameter (the injected Source, now with a default value), one
 * private field, no other configuration, no Runtime reference, and no
 * wiring into `FedosIdentityService` (Alpha 031) or any other module in
 * this repository beyond the Source Resolver this Stage adds. `describeIdentity()`
 * reads the injected Source EXACTLY ONCE per call, never throws, and
 * returns `null` on any invalid or missing input — all BYTE-FOR-BYTE
 * unchanged by this Stage.
 *
 * HARD GUARDRAILS:
 *   - NO Relay connection of any kind (no `src/nostr/relay.ts` or
 *     `src/nostr/ws_relay.ts` import).
 *   - NO Nostr event construction, parsing, publishing, or subscribing
 *     (no `src/nostr/event.ts`, `src/nostr/messages.ts`, or
 *     `src/nostr/publish.ts` import).
 *   - NO signing or signature verification (no `src/nostr/signature.ts`
 *     or `src/nostr/noble_signature.ts` import).
 *   - NO secret key, `nsec`, seed, mnemonic, or `npub` ENCODE/DECODE
 *     handling of any kind (no `src/nostr/crypto.ts` import, no bech32
 *     logic).
 *   - NO Service, Runtime, or Worker reference — this file's ONLY new
 *     reference (this Stage) is `resolveNostrPublicIdentitySource()`
 *     itself, used solely as the constructor's default parameter value.
 *   - The Source is read EXACTLY ONCE per `describeIdentity()` call —
 *     never zero times (when a Source exists), never twice.
 *   - `provider` is ALWAYS the fixed literal `"nostr"` — the injected
 *     Source's own snapshot carries no `provider` field, so there is
 *     nothing from the Source this class could even mistakenly trust.
 *   - Empty-string `id`/`publicIdentifier` are treated identically to
 *     missing fields — both resolve `null`, never a Descriptor with an
 *     empty string in either field. `displayName`/`avatar` are NOT
 *     validated at all — whatever the Source reports (including
 *     `undefined`, an empty string, or any other string) is copied
 *     through verbatim, since both remain optional on the Descriptor.
 *   - No format correction, normalization, or reinterpretation of
 *     `publicIdentifier`, `displayName`, or `avatar` — the Source's own
 *     values are used verbatim or not at all.
 *   - No Record construction, no Registry reference, no Runtime
 *     reference — `displayName`/`avatar` reach only the Descriptor this
 *     method returns; nothing downstream of it is touched by this
 *     Stage.
 *   - The default parameter is evaluated ONCE per construction, at
 *     `new NostrIdentityProvider()` call time — never re-evaluated on
 *     any later `describeIdentity()` call, matching ordinary JavaScript
 *     default-parameter semantics.
 */

import type { FedosIdentityDescriptor } from "./fedos_identity_descriptor.js";
import type { FedosIdentityProvider } from "./fedos_identity_provider.js";
import type { FedosNostrPublicIdentitySnapshot, FedosNostrPublicIdentitySource } from "./fedos_nostr_public_identity_source.js";
import { resolveNostrPublicIdentitySource } from "./fedos_nostr_public_identity_source_resolver.js";

export class NostrIdentityProvider implements FedosIdentityProvider {
  readonly provider = "nostr";

  readonly #source: FedosNostrPublicIdentitySource;

  constructor(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource()) {
    this.#source = source;
  }

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    let snapshot: FedosNostrPublicIdentitySnapshot | null;
    try {
      snapshot = await this.#source.readPublicIdentity();
    } catch {
      return null;
    }

    if (snapshot === null) {
      return null;
    }
    if (typeof snapshot.id !== "string" || snapshot.id.length === 0) {
      return null;
    }
    if (typeof snapshot.publicIdentifier !== "string" || snapshot.publicIdentifier.length === 0) {
      return null;
    }

    return {
      id: snapshot.id,
      provider: "nostr",
      publicIdentifier: snapshot.publicIdentifier,
      displayName: snapshot.displayName,
      avatar: snapshot.avatar,
    };
  }
}
