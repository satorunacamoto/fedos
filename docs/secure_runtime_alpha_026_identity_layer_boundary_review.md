# FedOS Secure Runtime Alpha 026 — Identity Layer / Secure Runtime Boundary Review

**Status: REVIEW ONLY. No code change of any kind — every `src/runtime/`
file, `src/identity/`, `src/nostr/`, `src/sign/`, `src/worker.ts`, Rust,
`Cargo.toml`, and `package.json` are all byte-for-byte unchanged. This
document inventories the current Public Runtime API, compares five
Identity Layer architecture candidates, and formally defines the
responsibility boundary between Identity Layer, Secure Runtime, and the
Protocol Layer (Nostr/ActivityPub/Bluesky/Session).**

## 1. Public Runtime API — current inventory (11 functions)

Every function `AppRuntime` (`create_runtime.ts`/`types.ts`) exposes,
as of Alpha 025:

| # | Function | Concern | Input/output shape |
|---|---|---|---|
| 1 | `initializeCrypto()` | Crypto | No input; fixed `{ allowed, initialized, reason }` |
| 2 | `runtimeCapabilities()` | Environment | No input; `{ prototypeCompleted, rustReachable, rustVersion, runtimeMode }` |
| 3 | `randomBytes()` | Crypto | No input; `Uint8Array \| null` |
| 4 | `generateAeadKey()` | Crypto | No input; opaque `AeadKeyHandle \| null` |
| 5 | `encrypt(key, algorithm, aadDomain, plaintext)` | Crypto | Opaque `AeadKeyHandle` + labels + `Uint8Array`; opaque `AeadCiphertextHandle \| null` |
| 6 | `decrypt(key, algorithm, aadDomain, ciphertext)` | Crypto | Opaque handles + labels; `Uint8Array \| null` |
| 7 | `exportCiphertext(ciphertext)` | Crypto | Opaque `AeadCiphertextHandle`; branded `AeadCiphertextWire \| null` (`string`) |
| 8 | `importCiphertext(serialized)` | Crypto | `AeadCiphertextWire`; opaque `AeadCiphertextHandle \| null` |
| 9 | `storeCiphertext(id, wire)` | Storage | Caller-supplied `string` + `AeadCiphertextWire`; `boolean \| null` |
| 10 | `loadCiphertext(id)` | Storage | Caller-supplied `string`; `AeadCiphertextWire \| null` |
| 11 | `deleteCiphertext(id)` | Storage | Caller-supplied `string`; `boolean \| null` |

**Finding, confirmed by direct signature inspection of every one of the
11 functions**: NONE accepts or returns an Identity-shaped value. Every
parameter and return type is drawn from exactly six shapes — a plain
caller-supplied `string` (`id`), `AeadCiphertextWire`, `AeadKeyHandle`,
`AeadCiphertextHandle`, `Uint8Array`, `boolean` — plus the two fixed
label unions `AeadAlgorithm`/`AeadAadDomain`. This is the SAME "id is
opaque, never interpreted" property Alpha 025 §4 already confirmed for
Storage specifically; this Stage confirms it holds across the ENTIRE
Public Runtime API, not Storage alone.

## 2. Identity Layer candidates — compared

Five candidates for how an Identity Layer should relate to Secure
Runtime, across eight criteria.

| Criterion | ① Runtimeへ直接鍵管理 | ② Identity Service | ③ Identity Provider抽象 | ④ Protocolごと独立Identity | ⑤ FedOS Identity中核 |
|---|---|---|---|---|---|
| **Security** | Low — Runtime's own opaque-handle outputs would start carrying Identity meaning, widening the exact attack surface Alpha 025 §3 (candidate ③, rejected) already identified for Storage, now at the Crypto layer too | Medium — depends entirely on the undefined internal shape of "the Identity Service"; a single undifferentiated service risks becoming the same kind of catch-all Alpha 025 §3 (candidate ⑤) rejected for Storage | High — each Protocol implementation is confined to its own reviewed boundary behind a shared Interface, mirroring `RuntimeStorageBackend`'s own proven shape (Alpha 021) | Medium — sound within one Protocol, but no cross-Protocol consistency guarantee; a weaker implementation in one Protocol doesn't get caught by shared review | High — a single, reviewed canonical model that every Protocol adapts to, so security review effort concentrates in one place instead of N places |
| **責務分離 (separation of concerns)** | Worst — directly reverses Alpha 025's own confirmed Identity/Storage layering, now also at the Crypto layer | Good but underspecified — clean IF the Service stays narrow, but nothing about "a Service" enforces that | Best — Runtime stays completely unaware of Identity Layer's existence; Identity Layer only ever CALLS Runtime's existing Public API, never the reverse | Fair — separated from Runtime, but responsibilities blur BETWEEN Protocols (duplicated logic, inconsistent scoping) | Best when built ON `③` — a single canonical model with per-Protocol adapters keeps the Protocol/Identity boundary as clean as the Identity/Runtime one |
| **Runtime依存 (Runtime dependency)** | Maximal — every Identity operation is coupled directly into Runtime's own internals; a future Identity change forces a Runtime change | None — Runtime never references Identity Service | None — Runtime never references any Identity Provider; this is the SAME "Runtime never knows the Resolver exists" property Alpha 021 §6 already proved for Storage | None | None (inherits `③`'s own zero-dependency property) |
| **Nostr** | Nostr-specific key derivation (NIP-06) would leak into Runtime itself, forcing a Runtime change for a Nostr-only concern | Possible, but the Service must internally special-case Nostr without a defined seam for doing so cleanly | Clean — a `NostrIdentityProvider` implementation, isolated from every other Protocol's own implementation | Clean in isolation, but re-derives common logic (key handle lifecycle, Storage calls) that `③`/`⑤` would share once | Clean — Nostr's own npub/nsec-adjacent concepts map onto the canonical model via its own adapter, never leaking into Runtime |
| **ActivityPub** | Same problem as Nostr, duplicated for a second Protocol | Same ambiguity as Nostr | Clean — `ActivityPubIdentityProvider`, independent of `NostrIdentityProvider` | Clean in isolation, same duplication concern as Nostr | Clean — ActivityPub's actor/key model maps onto the canonical model via its own adapter |
| **Bluesky** | Same problem, duplicated a third time | Same ambiguity | Clean — `BlueskyIdentityProvider`, independent of the other two | Clean in isolation, same duplication concern | Clean — Bluesky's DID/key model maps onto the canonical model via its own adapter |
| **Session** | Same problem, duplicated a fourth time | Same ambiguity | Clean — `SessionIdentityProvider`, independent of the other three | Clean in isolation, same duplication concern | Clean — Session's own identity model maps onto the canonical model via its own adapter |
| **将来性 (future extensibility)** | Worst — every new Protocol requires a Runtime change, directly against this arc's own "Runtime stays minimal and stable" discipline (Alpha 001 onward) | Fair — extensible, but each new Protocol added to an undifferentiated Service compounds the ambiguity | Best — a new Protocol is a new, isolated Provider implementation; ZERO change to Runtime, the Resolver-equivalent seam, or any other Protocol's own implementation — this is the EXACT extensibility property Alpha 023 already demonstrated for Storage (adding `WindowsDpapiStorageBackend` required zero change to `MemoryStorageBackend` or the Runtime Storage Service) | Fair-to-poor — Protocol count growth means duplication growth, and cross-Protocol FedOS features (e.g. "same person across Nostr and ActivityPub") become structurally hard to express | Best — a canonical model is the ONLY candidate that makes cross-Protocol FedOS identity linkage possible at all, and it is realized BY `③`'s own architecture, not competing with it |

**Conclusion**: ① is REJECTED outright — it repeats, one layer up, the
exact mistake Alpha 025 §3 already rejected for Storage. ② is not
rejected but is superseded — it is really an underspecified version of
③ without ③'s own Interface discipline. ④ is workable in isolation per
Protocol but actively works against FedOS's own cross-protocol
federation goal and duplicates logic four times over. **③ (Identity
Provider abstraction — a shared Interface, Runtime-agnostic, with one
implementation per Protocol) is the correct STRUCTURAL answer — the
direct extension of the SAME architecture pattern this arc already
proved twice: once by Alpha 021–024's `RuntimeStorageBackend`/Resolver,
and independently by the PRE-EXISTING `src/identity/provider_boundary.ts`'s**
**own `IdentityProviderBoundary` (§7).** ⑤ (a single canonical FedOS
Identity model, with each Protocol mapping onto it via its own adapter)
is the correct CONTENT answer for what that Provider abstraction should
express — not a competing candidate, but the design direction ③'s own
architecture is meant to carry.

## 3. Identity責務 — what Identity Layer may and may not hold

**MAY hold:**

- Public, non-secret protocol identifiers (`npub`, an ActivityPub actor
  URI, a Bluesky DID, a Session identity id) — these are public by
  design in their own protocols; holding them carries no Fail-Closed
  risk.
- OPAQUE HANDLES Runtime itself issues (e.g. an `AeadKeyHandle` obtained
  by calling Runtime's own `generateAeadKey()`) — Identity Layer holds
  the HANDLE, never the raw bytes behind it; Runtime's own opaque-handle
  discipline (Alpha 007 §6) already guarantees the raw bytes are
  unreachable regardless of which layer holds the handle.
- Cross-protocol MAPPING data — which `npub`/actor-URI/DID/session-id
  values represent the SAME local FedOS user. This is Identity Layer's
  own core, protocol-agnostic responsibility, and the reason ⑤'s
  canonical-model direction exists at all.
- Non-secret protocol metadata (relay lists, server URLs, display
  profile fields) needed for federation — IF persisted, only ever via
  Runtime's own `storeCiphertext()` (already-encrypted
  `AeadCiphertextWire` in, opaque `id` out), never written to any
  storage medium directly by Identity Layer itself.

**MUST NOT hold:**

- Raw private signing keys (Nostr `nsec`, an ActivityPub actor's
  private key, a Bluesky signing key, a Session identity's private
  key). This repo's own existing policy already states this precisely:
  `docs/vault_crypto_identity.md` §0 — *"No key custody in the app...
  signing is delegated to an external NIP-07 signer"* — and this is
  independently confirmed as ALREADY TRUE today by `src/nostr/`/
  `src/sign/` (§7): this codebase performs real Schnorr signature
  VERIFICATION, never signing or key generation.
- Raw AEAD key material of any kind. Alpha 007 §6's exclusion is
  PERMANENT and applies to every layer, not Storage alone — Identity
  Layer extracting/holding raw bytes out of an `AeadKeyHandle` would
  violate it exactly as directly as Storage doing the same would.
- A `RuntimeStorageBackend` instance, or any other Storage-internal
  construct, directly. Identity Layer must call `storeCiphertext()`/
  `loadCiphertext()`/`deleteCiphertext()` like any other caller — never
  construct a backend, never bypass the Runtime Storage Service's own
  `isDevelopmentRuntimeForCiphertextStorage()` gate.
- Its own, independently-implemented environment or platform
  classification logic. If a future Identity Layer genuinely needs
  Runtime-Mode/Platform awareness, it must be reviewed as its own
  Stage, consuming Runtime's existing exposure — never a THIRD
  independently-implemented classifier duplicating `fedos_runtime_mode_authority.ts`/
  `fedos_runtime_platform_authority.ts`'s own already-consolidated
  responsibility (Alpha 020/024).
- A `FedosWasmLoader` instance, or any other Rust-Boundary-internal
  construct, directly — Identity Layer reaches Crypto exclusively
  through Runtime's own Public API, exactly like every other caller.

## 4. Runtime責務 — confirmed: 暗号 (Crypto), Storage, Environment only

§1's inventory confirms, by direct signature inspection, that all 11
Public Runtime API functions fall into exactly three concerns and no
others:

- **暗号 (Crypto)**: `initializeCrypto`/`randomBytes`/`generateAeadKey`/
  `encrypt`/`decrypt`/`exportCiphertext`/`importCiphertext` — seven
  functions, all operating on opaque handles/wires, none aware of WHO
  the caller is or WHAT the encrypted content represents.
- **Storage**: `storeCiphertext`/`loadCiphertext`/`deleteCiphertext` —
  three functions, confirmed Identity-blind by Alpha 025 §4.
- **Environment**: `runtimeCapabilities` — one function, a read-only,
  always-recomputed report of Runtime's own reach and mode (Alpha 006/
  020/024), never a decision point.

**Runtime does not, and must not, handle Identity semantics.** No
function accepts a pubkey/DID/actor-URI/session-id as a
SEMANTICALLY-INTERPRETED parameter — the closest any function comes is
`storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()`'s own `id:
string`, which Runtime treats as a completely opaque lookup key (Alpha
025 §4), indistinguishable from any other string a caller might supply.

## 5. Protocol責務 — Nostr/ActivityPub/Bluesky/Session sit above Identity Layer

The full layering this Stage confirms, refining Alpha 025 §5's own
combined "Application/Identity Layer" box into its two constituent
layers:

```txt
Nostr | ActivityPub | Bluesky | Session        Protocol Layer
     \       |          |      /                (each protocol's own event/actor/DID semantics)
            v
      Identity Layer                            (§3 — cross-protocol mapping, opaque handles only)
            |
            v
      Crypto Layer                              (Secure Runtime -- encrypt()/decrypt()/generateAeadKey()/etc.)
            |
            v
      Storage Layer                             (Secure Runtime -- storeCiphertext()/loadCiphertext()/deleteCiphertext())
```

**Each Protocol must NOT:**

- Bring its own event semantics (Nostr `kind`/`content`/`tags`, an
  ActivityPub actor/object document, a Bluesky record, a Session
  message shape) DOWN INTO Identity Layer's own interface. Identity
  Layer's own Provider abstraction (§2, candidate ③) must stay
  protocol-agnostic — each Protocol's own adapter code translates
  its native shapes to/from Identity Layer's generic calls
  ("encrypt this blob for this local identity," "resolve the opaque
  key handle for this local identity") on either side of the boundary.
- Reach directly into Crypto Layer or Storage Layer, BYPASSING Identity
  Layer. A Protocol calling `storeCiphertext()`/`generateAeadKey()`
  directly, without going through Identity Layer's own scoping/access
  logic, reintroduces — one layer up — the exact "Storage understands
  WHOSE data this is" risk Alpha 025 §3 (candidate ③) already rejected;
  the fact that Storage itself stays Identity-blind is only meaningful
  if every caller ABOVE it also respects the same discipline.

This confirms, and extends one layer further, Alpha 025 §5's own
conclusion: Nostr Event storage, DM storage, and Attachment storage
were already confirmed to be an "Identity/Application Layer"
responsibility, never Storage Layer's — this Stage names that
responsibility precisely as Identity Layer's own (with Protocol Layer
sitting one level higher still), not Storage Layer's under any
protocol-specific name.

## 6. FedOS Identity方針 — recommended direction (advisory only)

Building on §2's conclusion:

1. **Structural pattern (③)**: a shared `IdentityProvider`-shaped
   Interface (mirroring `RuntimeStorageBackend`'s own three-method
   discipline), with one independent implementation per Protocol
   (`NostrIdentityProvider`/`ActivityPubIdentityProvider`/
   `BlueskyIdentityProvider`/`SessionIdentityProvider`), selected
   through a Resolver-equivalent seam — the SAME "Interface + N
   implementations + a selection seam Runtime never needs to know
   about" shape Alpha 021's `RuntimeStorageBackend`/
   `resolveRuntimeStorageBackend()` already proved, and the SAME shape
   `src/identity/provider_boundary.ts`'s own `IdentityProviderBoundary`
   already independently applies to a DIFFERENT identity concern (§7).
2. **Content direction (⑤)**: a single canonical FedOS Identity model
   — the cross-protocol MAPPING data named in §3 — that each Protocol's
   own adapter maps its native identity concept onto, never the reverse
   (Protocol semantics must never leak downward into the canonical
   model itself, per §5).

Both together let a future, separately-reviewed Identity Layer Stage
add support for a new Protocol by writing ONE new, isolated Provider
implementation plus ONE adapter — with ZERO change to Runtime, ZERO
change to any other Protocol's own implementation, and ZERO change to
the canonical model's own shape (only a new mapping entry). This is
advisory only; no Identity Layer, Provider, or adapter is implemented
by this Stage.

## 7. Relationship to existing scaffolding — confirmed consistent, unmodified

- `src/identity/provider_types.ts`/`provider_boundary.ts` ALREADY
  implements §2/§6's own recommended `③` pattern — `IdentityProviderBoundary`,
  with `NoopIdentityProvider`/`PlaceholderIdentityProvider` as its only
  implementations today — for a DIFFERENT identity concern (Apple/
  Google/external/passkey AUTHENTICATION providers, not multi-protocol
  federated PROTOCOL identity). This Stage's own scope is narrower —
  specifically the boundary between a future Protocol-facing Identity
  Layer and Secure Runtime — but the architectural precedent this
  existing scaffold already establishes is directly consistent with,
  and reinforces, §2's own conclusion. Unmodified by this Stage.
- `docs/vault_crypto_identity.md` §0 already states "No key custody in
  the app" and "Boundaries first, implementation later" as
  repo-wide-established, non-binding design notes. §3/§6 of this Stage
  are fully consistent with, and formalize, those same principles
  specifically at the Identity Layer/Secure Runtime boundary. Unmodified
  by this Stage.
- `src/nostr/noble_signature.ts`/`src/sign/*` ALREADY implement real
  Nostr Schnorr signature VERIFICATION (not signing or key generation)
  — independent confirmation that "no private key custody" is already
  this codebase's real, working behavior for Nostr today, not merely an
  aspiration. Unmodified by this Stage.

## 8. What this Stage does NOT do

- Does **not** implement an Identity Layer, Identity Provider, or any
  Protocol adapter.
- Does **not** change `src/identity/provider_types.ts`,
  `provider_boundary.ts`, `provider_bridge.ts`, `passkey_boundary.ts`,
  `device_trust.ts`, `session_boundary.ts`, `recovery_policy.ts`, or
  `vault_bridge.ts`.
- Does **not** change `src/nostr/*` or `src/sign/*`.
- Does **not** change any `src/runtime/*` file.
- Does **not** change `types.ts`/`create_runtime.ts`.
- Does **not** change `src/worker.ts` — Worker remains fully
  unconnected and unmodified.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change any Public Runtime API signature.

## 9. See also

- `docs/secure_runtime_alpha_025_secure_storage_api_scope_review.md`
  (Secure Runtime Alpha 025) — confirmed the Storage/Identity layering
  direction this Stage extends to the whole Runtime API, and the
  Application/Identity Layer box this Stage refines into two.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` /
  `secure_runtime_alpha_022_storage_backend_selection_policy_review.md`
  / `secure_runtime_alpha_023_windows_dpapi_storage_backend.md` /
  `secure_runtime_alpha_024_dpapi_resolver_integration.md` (Secure
  Runtime Alpha 021–024) — the Interface + N implementations + Resolver
  pattern this Stage's §2/§6 recommends reusing for Identity.
- `docs/public_crypto_opaque_handles.md` / Alpha 007 §6 — the permanent
  raw-key-material exclusion this Stage's §3 confirms applies to
  Identity Layer too, not Storage alone.
- `docs/vault_crypto_identity.md` — pre-existing, non-binding design
  notes this Stage's §3/§6/§7 confirms consistency with.
- `docs/secure_runtime_alpha_006_mode_authority_review.md` (Secure
  Runtime Alpha 006) — the review-only format (comparison table,
  explicit non-goals list) this Stage follows.
- `src/identity/provider_types.ts`/`provider_boundary.ts` — the
  existing `IdentityProviderBoundary` this Stage's §7 cites as
  independent precedent for the ③ pattern.
