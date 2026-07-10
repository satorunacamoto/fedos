/**
 * Secure Runtime Alpha 035 — "FedOS Nostr Identity Provider". Secure
 * Runtime Alpha 039 — "Nostr Public Identity Source Boundary". Secure
 * Runtime Alpha 046 — "Nostr Identity Provider Descriptor Expansion"
 * (this revision — mapping only).
 *
 * The FIRST Nostr-specific `FedosIdentityProvider` (Alpha 029)
 * implementation anywhere in this repository — the "leading candidate"
 * Alpha 027 §8 named but never built. Alpha 035 shipped this class with
 * a permanently-`null` `describeIdentity()`, no constructor, and no
 * source of any kind. Alpha 039 gave it a real, minimal, publicly-safe
 * information source — a single injected `FedosNostrPublicIdentitySource`
 * — and changed `describeIdentity()` from a fixed `return null;` into a
 * validated DELEGATION to that source, mapping only `id`/`publicIdentifier`
 * onto the returned Descriptor. Alpha 044 then added optional
 * `displayName`/`avatar` fields to the Snapshot, and Alpha 045 added the
 * identical two optional fields to `FedosIdentityDescriptor` — both
 * additions this Provider's own mapping logic did not yet read or write.
 * THIS Stage is the wiring: the mapping now ALSO copies
 * `snapshot.displayName`/`snapshot.avatar` onto the returned Descriptor,
 * verbatim, unconditionally — no validation, no reformatting, no
 * conditional omission when either is `undefined`. See
 * `docs/secure_runtime_alpha_046_nostr_identity_provider_descriptor_expansion.md`
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
 * parameter (the injected Source), one private field, no other
 * configuration, no Resolver reference, no Runtime reference, and no
 * wiring into `FedosIdentityService` (Alpha 031) or any other module in
 * this repository. `describeIdentity()` reads the injected Source
 * EXACTLY ONCE per call, never throws, and returns `null` on any
 * invalid or missing input.
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
 *   - NO Resolver, Service, Runtime, or Worker reference.
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
 */

import type { FedosIdentityDescriptor } from "./fedos_identity_descriptor.js";
import type { FedosIdentityProvider } from "./fedos_identity_provider.js";
import type { FedosNostrPublicIdentitySnapshot, FedosNostrPublicIdentitySource } from "./fedos_nostr_public_identity_source.js";

export class NostrIdentityProvider implements FedosIdentityProvider {
  readonly provider = "nostr";

  readonly #source: FedosNostrPublicIdentitySource;

  constructor(source: FedosNostrPublicIdentitySource) {
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
