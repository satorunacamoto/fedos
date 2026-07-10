# FedOS Secure Runtime Alpha 039 — Nostr Public Identity Source Boundary

**Status: IMPLEMENTED — a new Boundary (interface + Null implementation),
one modified Provider, and one modified Resolver construction line.**
Adds `FedosNostrPublicIdentitySource`/`FedosNostrPublicIdentitySnapshot`
(`src/identity/fedos_nostr_public_identity_source.ts`) and
`NullNostrPublicIdentitySource`
(`src/identity/fedos_null_nostr_public_identity_source.ts`). Changes
`NostrIdentityProvider` (Alpha 035) from a fixed `return null;` into a
validated delegation to an injected Source. Changes
`fedos_identity_provider_resolver.ts` (Alpha 032/034/036) to construct
the shared `NostrIdentityProvider` with a `NullNostrPublicIdentitySource`
injected — its OBSERVABLE behavior (`describeIdentity()` always `null`)
is unchanged from Alpha 036. This is the tenth artifact in the FedOS
Identity arc (Alpha 028–039).

## 1. 実装前調査 — existing public identity sources (none found; investigated before writing code)

Before adding anything, `src/identity/**`, `src/nostr/**`,
`src/runtime/**`, and every `docs/**identity**`/`docs/**nostr**` file
were searched for a reusable, LEGITIMATE public-identity source. Result,
item by item:

| Candidate source | Found? | Detail |
|---|---|---|
| A public-key reader/holder | **No** | `src/nostr/types.ts`'s `NostrEvent.pubkey` is a field on an already-RECEIVED event, not a "my own identity" reader. `NostrIdentityProvider` itself (Alpha 035) held nothing. |
| npub encoder/decoder (bech32) | **No** | Zero `npub`/`bech32`/`nsec`/`nprofile` references anywhere in `src/nostr/**` or `src/identity/**`. |
| Nostr profile fetch (kind:0 metadata) | **No** | `src/nostr/event.ts` validates generic event shape only; no `name`/`about`/`picture` JSON parsing anywhere. |
| A `displayName` field/type | **No** | Zero matches in `src/identity/**`/`src/nostr/**` (one unrelated comment in `webauthn_adapter.ts` about a relying-party label, not identity data). |
| An `avatar`/`picture` URL field | **No** | Zero matches anywhere in `src/identity/**`/`src/nostr/**`. |
| A linked-account descriptor type | **Partially** | `FedosIdentityDescriptor` (Alpha 028, `id`/`provider`/`publicIdentifier`) is the correct SHAPE to populate, but is type-only and currently unpopulated for Nostr — not itself a source of data. |
| WebAuthn-derived public identity | **No** | `webauthn_adapter.ts`/`passkey_boundary.ts` are unlock-trigger-only boundaries carrying opaque, non-secret LABELS (`reference`, `rpIdRef`, `userRef`) — by their own hard guardrail, never a credential id, public key, or Nostr-adjacent identifier. |
| Application State / config holding a user's own pubkey/profile | **No** | `fedos_runtime_storage_backend.ts` is a pure `AeadCiphertextWire` K/V store with zero Nostr/identity awareness; `provider_types.ts`/`provider_boundary.ts` are AUTH-attempt state machines (Apple/Google/passkey) carrying only opaque references, never key/profile data. |

Additionally confirmed, to establish the "no secret derivation" ceiling
is not merely a rule but already this codebase's real behavior:
`src/nostr/crypto.ts` is a SHA-256/constant-time-compare helper only,
touching no key material of any kind; `src/nostr/signature.ts` defines
a verification-only `SignatureVerifier` interface; `src/nostr/noble_signature.ts`
(`NobleSignatureVerifier`) performs real BIP-340 Schnorr signature
VERIFICATION against an already-known `pubkey` — its own doc comment
states "never signs. No private keys are involved." None of the three
files reads, derives, or holds any key material, public or private.

**Conclusion: no existing, legitimate public-identity source exists
anywhere in this repository.** The only reusable pieces are
`FedosIdentityDescriptor`'s own shape (the eventual OUTPUT) and
`NostrIdentityProvider`'s own stub (the eventual CALLER) — the Source
Boundary itself must be built new, which is this Stage's own mandate.

## 2. なぜ公開Identity情報源を明示的なBoundaryにしたのか (why a Public Identity Source Boundary, as its own type, rather than logic inside the Provider)

- **`NostrIdentityProvider` (Alpha 029's contract) must stay a thin,
  interface-implementing class — never a place where "how to obtain
  Nostr identity data" logic accumulates.** A future real source (an
  npub reader, a cached profile, a linked-account lookup) is a
  substantially different, separately-reviewable concern from
  "validate a snapshot and map it to a Descriptor," which is all
  `NostrIdentityProvider` itself should ever do. Splitting them into two
  types now means a future Stage that builds a REAL source only ever
  touches the Source file, never the Provider's own validation logic.
- **This mirrors Alpha 021's own `RuntimeStorageBackend` precedent
  directly** — Storage's own Interface + N implementations + a single
  injection point pattern, applied here to Nostr identity data instead
  of ciphertext. `FedosNostrPublicIdentitySource` is to
  `NostrIdentityProvider` what `RuntimeStorageBackend` is to the Storage
  Service: an injected, swappable, minimally-scoped dependency.
- **A dedicated Boundary makes the "no secret material" guarantee
  independently auditable.** `FedosNostrPublicIdentitySnapshot`'s own
  two-field shape (`id`, `publicIdentifier`) is, by construction, unable
  to carry a private key — a future reviewer checking THIS ONE FILE can
  confirm the entire class of "could a future source implementation leak
  a secret" risk is bounded, without having to re-audit
  `NostrIdentityProvider`'s own logic every time.

## 3. 秘密鍵から導出しない理由 (why identity is never derived from a secret key)

No candidate source considered in §1, and no code this Stage adds,
derives a public identifier FROM a private key. Three independent
reasons, all pre-existing in this arc:

1. **This repository has never implemented Nostr key generation, `nsec`
   handling, or private-key-to-`npub` derivation anywhere** — Alpha 027
   §8 named this exclusion explicitly seven Stages ago, and §1's own
   investigation reconfirms it still holds. Building a derivation path
   NOW, merely to populate a Descriptor field, would be a strictly new
   and substantially riskier capability than "add a read boundary."
2. **Deriving a public key from a private key requires HOLDING the
   private key**, even momentarily — directly violating this Stage's own
   explicit mandate ("秘密鍵から導出しない") and Alpha 007 §6's permanent
   raw-key-material exclusion (Alpha 026 §3 already extended to Identity
   Layer, Alpha 038 §2 reconfirmed with no future-model exception of any
   kind).
3. **A public identity source and a key-derivation path answer different
   questions.** "What public identity is currently available" (this
   Stage's own scope) never requires "what private key produces it" —
   the two are cleanly separable, and this Stage deliberately answers
   only the first.

## 4. 固定npubを使わない理由 (why no fixed or dummy npub is used)

A hardcoded or placeholder `npub` string was considered and rejected —
not merely omitted, but actively rejected as WORSE than the chosen
alternative (`NullNostrPublicIdentitySource`, §5):

- **A fixed npub is a fabricated identity, not an absence of one.** Every
  caller of `resolveFedosIdentityProvider()` → `describeIdentity()`
  would receive a `FedosIdentityDescriptor` that LOOKS like a real,
  resolved Nostr identity — indistinguishable, from the caller's side,
  from a genuinely-linked account. This is the exact "placeholder object
  would be a worse answer than `null`" risk Alpha 032 §6 and Alpha 035
  §2 (reason 3) already rejected at the Resolver and Provider level,
  respectively — a fixed npub would reintroduce it one layer further in,
  at the Source level.
- **A fixed npub cannot honestly belong to the person running this
  code.** Any concrete, non-generated npub value is either (a) a real
  person's real public key, wrongly claimed as this application's own
  identity, or (b) an obviously-fake placeholder that still risks being
  copy-pasted into a real deployment. Neither is acceptable as
  production-adjacent code.
- **This Stage's own explicit mandate forbids it directly** ("固定値・
  ダミーnpub・秘密鍵からの導出は行わないでください"), independent of the
  two reasons above.

## 5. Null Sourceを採用する理由 (why `NullNostrPublicIdentitySource` is the Resolver's own default)

With no real source available (§1) and a fixed/dummy value rejected
(§4), a Null Source — always resolving `null` — is the only remaining
option that is both HONEST and SAFE:

- **Honest**: `NullNostrPublicIdentitySource.readPublicIdentity()`
  resolving `null` truthfully reports "no public identity data is
  currently available," which is the actual state of this repository
  today — no worse, and no better, than the truth.
- **Safe**: a class with zero fields and a single, argument-free,
  always-`null` method cannot leak a secret, cannot be
  misconfigured into leaking a secret, and cannot silently start
  returning different data based on hidden state — the same "simplest
  POSSIBLE implementation, which happens to also be maximally safe"
  property Alpha 033 §6 already established for
  `NoopFedosIdentityProvider`, now applied one layer down at the Source
  level.
- **Structurally required today**: `NostrIdentityProvider`'s new
  constructor (§6) REQUIRES a `FedosNostrPublicIdentitySource` argument
  — there is no valid way to construct the Resolver's own shared
  singleton without supplying SOME Source, and `NullNostrPublicIdentitySource`
  is the only implementation this Stage builds.
- **Preserves Alpha 036's own observable behavior exactly.** Every
  caller of `resolveFedosIdentityProvider()` before this Stage received
  a Provider whose `describeIdentity()` always resolved `null`
  (Alpha 035/036). After this Stage, the SAME call returns the SAME
  observable result — `describeIdentity()` still always resolves
  `null` — because `NullNostrPublicIdentitySource` always resolves
  `null` too. This Stage changes the INTERNAL wiring (a real delegation
  path now exists) without changing any EXTERNAL behavior a caller could
  observe today.

## 6. ProviderとSourceの責務分離 (the Provider/Source responsibility split)

```ts
export interface FedosNostrPublicIdentitySnapshot {
  readonly id: string;
  readonly publicIdentifier: string;
}

export interface FedosNostrPublicIdentitySource {
  readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null>;
}
```

```ts
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
    if (snapshot === null) return null;
    if (typeof snapshot.id !== "string" || snapshot.id.length === 0) return null;
    if (typeof snapshot.publicIdentifier !== "string" || snapshot.publicIdentifier.length === 0) return null;
    return { id: snapshot.id, provider: "nostr", publicIdentifier: snapshot.publicIdentifier };
  }
}
```

The split is exact and one-directional:

- **Source's own responsibility**: report whatever public identity data
  it currently holds, or `null` — nothing else. A Source never knows
  about `FedosIdentityDescriptor`, never sets a `provider` label (the
  Snapshot type has no such field — there is nothing for the Provider
  to even mistakenly trust from the Source on this point), and never
  validates its own output for the Provider's benefit.
- **Provider's own responsibility**: call the Source EXACTLY ONCE per
  `describeIdentity()` invocation, treat any exception or invalid shape
  as `null` (never let a Source's own failure escape as an uncaught
  exception — this repository's Public API has never thrown from
  `describeIdentity()` since Alpha 029, and this Stage does not start
  now), and map a VALID snapshot onto `FedosIdentityDescriptor` by
  copying `id`/`publicIdentifier` VERBATIM and fixing `provider` to the
  literal `"nostr"` — never reformatting, normalizing, or "correcting"
  `publicIdentifier`'s own shape, and never attempting to encode/decode
  `npub` (§4/§9's own no-new-bech32-logic exclusion). The Provider does
  not know or care WHERE the Source's data came from (memory, a future
  cache, a future linked-account lookup) — only whether it is
  well-shaped enough to become a Descriptor.

## 7. Descriptorの選択 — Option A採用 (Option A adopted; Descriptor unchanged)

Alpha 038 formally ADOPTED `displayName`/`avatar` for `FedosIdentityDescriptor`,
but explicitly reserved implementation for "a future, separately-reviewed
implementation Stage" (Alpha 038 §10, item 1) — it did not schedule
THIS Stage to be that Stage. This Stage adopts **Option A**: the
Descriptor stays byte-for-byte `id`/`provider`/`publicIdentifier`, and
`FedosNostrPublicIdentitySnapshot` carries only `id`/`publicIdentifier`
— no `displayName`/`avatar` on either type yet. Reasoning, against the
four named judgment criteria:

- **1 Stage = 1 responsibility**: this Stage's own title and mandate is
  "Nostr Public Identity Source Boundary" — a single, well-scoped
  addition (one Interface, one Null implementation, one Provider
  delegation change, one Resolver construction-argument change).
  Implementing Alpha 038's Descriptor decision is a SEPARATE
  responsibility — a public-type field addition affecting every
  existing and future `FedosIdentityProvider` implementation, every
  guard test across Alpha 028–038 that asserts the Descriptor's exact
  field count, and `FedosIdentityService`'s own pass-through contract.
  Bundling both into one Stage would mean this Stage answers two
  different questions ("where does Nostr identity data come from" and
  "what shape does EVERY provider's identity data eventually take"),
  which this arc's own established discipline (Alpha 028→029→030→031→
  032→033→034→035→036, each exactly one artifact) consistently avoids.
- **Alpha 038の正式決定 (respecting the formal decision, not
  pre-empting its own sequencing)**: Alpha 038 §10 named "a future,
  separately-reviewed implementation Stage" as the OWN, DISTINCT next
  step for `displayName`/`avatar` — deliberately not bundled with
  whatever Stage would eventually need to feed those fields real data.
  Adopting Option A respects that sequencing exactly as written, the
  same way Alpha 012 §5/§6 sequenced "decide the boundary" (Alpha 012)
  before "implement the migration" (Alpha 013) as two Stages, not one.
- **不必要な変更範囲 (avoiding unnecessary change scope)**: adding
  `displayName`/`avatar` to `FedosIdentityDescriptor` now would ripple
  into every prior Identity-arc guard test that asserts the Descriptor's
  exact three-field shape (Alpha 028, 029, 030, 031, 032, 033, 034, 035,
  036, 037, 038 — eleven files), none of which this Stage's own mandate
  requires touching. Option A's actual ripple is limited to file-count
  sentinels (two new `src/identity/*.ts` files) and the Nostr
  Provider/Resolver's own construction-signature assertions — a strictly
  smaller, more contained blast radius for a Stage whose OWN
  responsibility is the Source Boundary, not the Descriptor shape.
- **将来の公開API破壊回避 (avoiding future public API breakage)**: a
  public interface's field set is easiest to extend correctly when the
  extension is its OWN reviewed change, decoupled from unrelated
  plumbing work — bundling the two here would make any future review of
  "was adding displayName/avatar itself correct" have to first
  disentangle it from this Stage's own Source Boundary changes. Keeping
  them separate means Alpha 038's own eventual implementation Stage can
  be reviewed purely on its own merits.

**Explicit decision: Option A. `FedosIdentityDescriptor` and
`FedosNostrPublicIdentitySnapshot` both remain two/three-field types;
`displayName`/`avatar` are added to neither by this Stage.**

## 8. ResolverはProvider選択のみであること (the Resolver remains selection-only, confirmed unchanged in kind)

`resolveFedosIdentityProvider()`'s own body remains a single,
unconditional statement — `return sharedNostrProvider;` — byte-for-byte
identical to Alpha 036. The ONLY change is what expression constructs
`sharedNostrProvider` itself: `new NostrIdentityProvider(new NullNostrPublicIdentitySource())`
instead of `new NostrIdentityProvider()`. This is a CONSTRUCTION-ARGUMENT
change, not a SELECTION change — there is still exactly one Provider
implementation the Resolver ever returns, and still exactly one Source
implementation the Resolver ever injects; no `if`, no `switch`, and no
new condition of any kind was added. The Resolver still does not know,
and does not need to know, what a "valid" Nostr identity looks like —
that validation logic lives entirely in `NostrIdentityProvider` itself
(§6).

## 9. Relay / Authentication / Runtimeには未接続であること (confirmed disconnected)

- **Relay**: `fedos_nostr_public_identity_source.ts`,
  `fedos_null_nostr_public_identity_source.ts`, and the modified
  `fedos_nostr_identity_provider.ts` import nothing from `src/nostr/*`
  — confirmed by direct inspection of every import line in all three
  files. No `relay.ts`/`ws_relay.ts` reference exists anywhere in this
  Stage's own code.
- **Authentication**: none of this Stage's three files reference
  `session`, `credential`, `Authenticat`, or any of the existing
  `session_boundary.ts`/`passkey_boundary.ts`/`provider_boundary.ts`
  exports.
- **Runtime**: none of this Stage's three files import
  `create_runtime.ts`, `AppRuntime`, or any `src/runtime/*` file — a
  Nostr Provider's `describeIdentity()` remains, as it has since Alpha
  035, entirely unreachable from Runtime, Worker, or Production.
- **Signing/Verification**: no reference to `signature.ts`/
  `noble_signature.ts` — no signing or signature-verification logic is
  touched, added, or modified by this Stage.

## 10. Descriptorは非永続Read Modelであること (reconfirmed, unaffected by this Stage)

Consistent with Alpha 037 §3/Alpha 038 §3's own conclusion:
`describeIdentity()` remains a pure, idempotent READ, recomputed fresh
on every call — this Stage's own Provider still constructs a NEW
`FedosIdentityDescriptor` object literal on every successful call (never
caching, never reusing a prior result), and `NullNostrPublicIdentitySource`
holds no state between calls either. Nothing in this Stage persists
Descriptor or Snapshot data anywhere — no `storeCiphertext()` call
appears in any file this Stage adds or modifies.

## 11. Fail Closed — every invalid input resolves `null`

| Condition | Result |
|---|---|
| No Source (impossible today — the constructor requires one) | N/A, structurally prevented by the type system |
| Source's own `readPublicIdentity()` resolves `null` | `null` |
| Source's own `readPublicIdentity()` throws (sync or async) | `null` — caught, never re-thrown |
| `snapshot.id` is `undefined`/non-string/empty string | `null` |
| `snapshot.publicIdentifier` is `undefined`/non-string/empty string | `null` |
| A valid snapshot (non-empty `id` and `publicIdentifier`, both strings) | A real `FedosIdentityDescriptor` — `{ id, provider: "nostr", publicIdentifier }` |

No detailed error, exception, or diagnostic reaches
`describeIdentity()`'s own caller under any failure path — every branch
above resolves either `null` or a well-formed `FedosIdentityDescriptor`,
matching this repository's own established Fail-Closed discipline (no
`throw` anywhere in `NostrIdentityProvider`'s own method body).

## 12. What this Stage does NOT do

- Does **not** implement Nostr key generation, `nsec` handling, seed/
  mnemonic handling, or any private-key-to-public-key derivation.
- Does **not** implement `npub` encode/decode (no bech32 logic of any
  kind, new or reused).
- Does **not** connect to any Relay, construct or parse any Nostr Event,
  or implement `publish()`/`subscribe()`.
- Does **not** modify `src/nostr/signature.ts` or
  `src/nostr/noble_signature.ts` — signature verification is unchanged.
- Does **not** implement NIP-17, NIP-44, or NIP-59, Direct Messages, a
  Marketplace, or a BBS feature of any kind.
- Does **not** add Authentication, Credential, or Session handling of
  any kind — `session_boundary.ts`/`passkey_boundary.ts`/
  `provider_boundary.ts` are all confirmed unchanged.
- Does **not** modify `create_runtime.ts`, `AppRuntime`, or any
  `src/runtime/*` file.
- Does **not** modify `src/worker.ts`.
- Does **not** modify `fedos_identity_service.ts` (Alpha 031),
  `fedos_identity_provider.ts` (Alpha 029),
  `fedos_identity_descriptor.ts` (Alpha 028), or
  `fedos_identity_capability.ts` (Alpha 030) — see §7 for the explicit
  Option A reasoning.
- Does **not** modify `fedos_noop_identity_provider.ts` (Alpha 033), and
  does **not** delete it.
- Does **not** add any selection condition, `if`, or `switch` to the
  Resolver — still a single unconditional construction and return.
- Does **not** change any Storage API — no `storeCiphertext()`/
  `loadCiphertext()`/`deleteCiphertext()` reference anywhere in this
  Stage's own new or modified files.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.

## 13. See also

- `docs/secure_runtime_alpha_035_fedos_nostr_identity_provider.md`
  (Secure Runtime Alpha 035) — the original, source-less
  `NostrIdentityProvider` this Stage gives a real delegation path.
- `docs/secure_runtime_alpha_036_fedos_nostr_resolver_wiring.md`
  (Secure Runtime Alpha 036) — the Resolver wiring this Stage's §8
  confirms remains selection-only, now with an updated construction
  argument.
- `docs/secure_runtime_alpha_037_fedos_identity_descriptor_field_review.md`
  / `secure_runtime_alpha_038_fedos_identity_descriptor_decision.md`
  (Secure Runtime Alpha 037/038) — the Descriptor field review and
  formal decision this Stage's §7 explicitly defers implementing
  (Option A).
- `docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md`
  (Secure Runtime Alpha 033) — the "simplest possible, maximally safe"
  Null-implementation precedent this Stage's §5 reapplies at the Source
  level.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md`
  (Secure Runtime Alpha 021) — the Interface + injected-implementation
  pattern this Stage's §2 explicitly reuses for Nostr identity data.
- `docs/secure_runtime_alpha_027_identity_foundation_inventory.md`
  (Secure Runtime Alpha 027) — §8's key-generation/`npub`/`nsec`/signing
  exclusion list this Stage's §3/§4 continue respecting.
