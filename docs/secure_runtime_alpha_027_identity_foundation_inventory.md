# FedOS Secure Runtime Alpha 027 — Existing Identity Foundation Inventory & Integration Decision

**Status: REVIEW / DESIGN DECISION ONLY. No code change of any kind —
every `src/runtime/*` file, `src/identity/*`, `src/nostr/*`,
`src/worker.ts`, Rust, `Cargo.toml`, and `package.json` are all
byte-for-byte unchanged. This document inventories every existing
Identity-related file by ACTUAL, verified import-graph reachability
(never by assumption), audits the current codebase for any Secret
handling by Identity code, compares four integration Options, and
recommends exactly one candidate for Alpha 028 — advisory only, no
implementation.**

## 1. Full Identity-related file inventory (29 files, by verified reachability)

Every classification below was determined by grepping actual `import`
statements across `src/`, not by reading a file's own doc comment in
isolation — several files' own historical comments turned out to be
STALE (§1.3).

### 1.1 `src/identity/` (11 files)

| File | Stage | Classification (verified) |
|---|---|---|
| `webauthn_adapter.ts` | 60 | **Connected** — imported by `create_runtime.ts` (`selectWebAuthnProvider()`, Stage 62), wired to `AppRuntime.webAuthnProvider`. `NoopWebAuthnProvider`/`PlaceholderWebAuthnProvider` only; no real WebAuthn browser API is ever called. |
| `provider_types.ts` | 37 | **Disconnected island** relative to Runtime/Worker — used only within `src/identity/` (`provider_boundary.ts`, `provider_bridge.ts`, `recovery_policy.ts`) and by tests. Not imported by `create_runtime.ts`/`src/worker.ts`. |
| `provider_boundary.ts` | 37 | **Disconnected island** — `NoopIdentityProvider`/`PlaceholderIdentityProvider`; imported only by tests. Not imported by `create_runtime.ts`/`src/worker.ts`. |
| `provider_bridge.ts` | 37 | **Disconnected island** — pure mapping functions (Identity Provider request/report → Passkey/Vault requests); type-only dependency on `../vault/types.js`; not imported by `create_runtime.ts`/`src/worker.ts`. |
| `device_registration.ts` | 127 | **Worker-reachable (HTTP), Secure-Runtime-disconnected** — imported by `src/render/device_preview.ts`, which IS imported by `src/worker.ts` and reachable via `?devicePreview=1`; that route is documented and verified to never read `runtime` (sample/static data only). |
| `device_trust.ts` | 128 | Same as `device_registration.ts`. |
| `session_boundary.ts` | 129 | Same as `device_registration.ts`. |
| `recovery_policy.ts` | 130 | Same as `device_registration.ts`; additionally imports `provider_types.ts` (the only cross-reference to `provider_types.ts` outside `src/identity/` itself and tests). |
| `passkey_boundary.ts` | 36 | **Disconnected island / test-only** — `NoopPasskeyBoundary`/`PlaceholderPasskeyBoundary`; not imported by any production `src/` file; covered by `test/passkey_boundary.test.ts`. |
| `vault_bridge.ts` | 36 | **Disconnected island / test-only** — Passkey→Vault mapping function; not imported by any production `src/` file; covered by `test/passkey_boundary.test.ts`. (Distinct from the unrelated, differently-scoped `src/crypto/vault_bridge.ts`.) |
| `types.ts` | 36 | **Internal implementation** — shared `PasskeyAuthenticationKind`/`PasskeyAuthenticationRequest`/`PasskeyBoundary`/`PasskeyCapability`/`PasskeyReport` types; consumed internally by `webauthn_adapter.ts`, `passkey_boundary.ts`, `vault_bridge.ts`, `provider_bridge.ts`. |

### 1.2 `src/nostr/` (9 files)

| File | Classification (verified) |
|---|---|
| `noble_signature.ts` | **Connected** — imported by `create_runtime.ts`, the DEFAULT `AppRuntime.signatureVerifier` (via `selectSignatureVerifier()`). Real, working BIP-340 Schnorr/secp256k1 signature VERIFICATION via `@noble/curves`. Its own doc comment — *"This module verifies only; it never signs. No private keys are involved"* — is independently confirmed true by inspection: zero private-key/nsec/seed vocabulary anywhere in `src/nostr/`. |
| `signature.ts` | **Internal implementation** — `SignatureVerifier` interface + `NoopSignatureVerifier`/`RejectAllSignatureVerifier`; the type is imported by both `create_runtime.ts` and `types.ts`. |
| `publish.ts` | **Connected** — imported by `create_runtime.ts`, the DEFAULT `AppRuntime.relayPublisher` (via `selectRelayPublisher()`), which **always constructs `MockRelayPublisher`** — its own comment states *"A real `WebSocketRelayPublisher` is composed explicitly elsewhere"* (i.e. never by default). |
| `relay.ts` | **Disconnected island** relative to `AppRuntime` — the read-only `WebSocketRelayAdapter` counterpart `publish.ts`'s own comment references; NOT imported by `create_runtime.ts`. |
| `types.ts` | Internal implementation — shared Nostr event/tag types. |
| `ws_relay.ts` | Internal implementation — WebSocket helpers used by `relay.ts`/`publish.ts`. |
| `event.ts` | Internal implementation — event id/tag construction helpers. |
| `crypto.ts` | Internal implementation — SHA-256 hashing ONLY (`webCryptoSha256Hex`, `constantTimeHexEqual`). Zero key material. |
| `messages.ts` | Internal implementation — Nostr wire-message framing/parsing. |

### 1.3 `docs/**identity**` and adjacent (3 files) — and one important correction

| File | Classification |
|---|---|
| `docs/vault_crypto_identity.md` | docs-only — non-binding design notes ("Status: design notes only. Nothing here is implemented"). |
| `docs/device_identity_boundary.md` | docs-only — accurately describes the FOUR shipped `device_registration.ts`/`device_trust.ts`/`session_boundary.ts`/`recovery_policy.ts` boundaries plus `device_preview.ts`; independently confirms none of the four handles password/seed/mnemonic/backup/credential data. |
| `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md` | docs-only — this arc's own prior Stage. |

**Correction, found by verifying rather than trusting each file's own
prose (exactly what this Stage was asked to do)**: `webauthn_adapter.ts`
(§1.1) and `publish.ts` (§1.2) each carry a top-of-file doc comment
stating they are "NOT wired into the runtime or Worker" — this was true
at the Stage each file was written (60 and 12 respectively), but is now
**STALE**: both are empirically wired into `AppRuntime` today (Stage 62
for `webAuthnProvider`; an unnamed later Stage for `relayPublisher`),
confirmed by direct `import` inspection of `create_runtime.ts`. This
does not change any Fail-Closed behavior (both remain Noop/Placeholder/
Mock-only by default), but it is a real, reportable inaccuracy in two
files' own historical claims.

### 1.4 `test/**identity**` and adjacent (6 files) — all test-only

`test/identity_provider_boundary.test.ts`, `test/identity_device_suite.test.ts`,
`test/passkey_boundary.test.ts`, `test/webauthn_adapter.test.ts`,
`test/runtime_webauthn_env.test.ts`, and this arc's own
`test/secure_runtime_alpha_026_identity_layer_boundary_review.test.ts`.

**Total: 29 files** (11 + 9 + 3 + 6) inventoried by verified import-graph
reachability.

## 2. `provider_boundary.ts` — actual shape, confirmed by reading the file

- **Interfaces/types** (`provider_types.ts`): `IdentityProviderKind = "apple" | "google" | "external" | "passkey"`; `IdentityProviderStatus = "idle" | "waiting" | "authenticated" | "cancelled" | "unavailable" | "error"`; `IdentityProviderCapability` (four `*_placeholder` labels); `IdentityProviderRequest { kind, reference? }`; `IdentityProviderReport { status, kind?, reference?, reason? }`; `IdentityProviderBoundary { getStatus(); getCapabilities(); begin(request); cancel(); }`.
- **Input/output**: `begin(request: IdentityProviderRequest): IdentityProviderReport` — the ONLY "input" is `kind` (a fixed 4-value label) plus an OPTIONAL opaque `reference: string`; output is a coarse status label plus the same echoed `reference`. No other shape exists anywhere in the file.
- **Responsibility as an Identity Provider**: names, WITHOUT implementing, an AUTHENTICATION-REFERENCE boundary — "Apple / Google / External identity providers as OPAQUE AUTHENTICATION-REFERENCE providers that FEED the Passkey unlock boundary and, through it, the Vault — NOT as key sources" (its own doc comment, `provider_types.ts` line 4-7). This is an AUTHENTICATION concern (how does a user prove who they are to unlock a local secret), NOT a PROTOCOL IDENTITY concern (what is a user's Nostr/ActivityPub/Bluesky/Session identity) — the two share the English word "identity" but are structurally different problems.
- **Runtime/Application reference**: NONE. `provider_boundary.ts`/`provider_types.ts` reference nothing outside their own two files; `provider_bridge.ts` (a separate file) is the only consumer, and IT is also disconnected from `create_runtime.ts`/`src/worker.ts` (§1.1).
- **Nostr-specific vocabulary**: NONE. `IdentityProviderKind` has no `"nostr"` value, no `npub`/`nsec`/`relay` reference anywhere in either file.
- **Secret key material**: NONE. Every request/report field is explicitly documented as "OPAQUE, non-secret" and this is structurally enforced — the type system offers no field capable of carrying a token, credential, JWT, or key.
- **Direct Storage reference**: NONE — zero import of `fedos_runtime_ciphertext_storage.ts`/`RuntimeStorageBackend`/anything Storage-shaped.
- **Crypto Runtime bypass**: NONE — zero import of `fedos_wasm_loader.ts`/`FedosWasmLoader`/any Crypto Layer symbol. It does not reach Secure Runtime at all, correctly or otherwise — it simply does not touch it.
- **Reusable for Alpha 026's recommended structure?** — Directly, as a literal artifact: **NO**, because its own `IdentityProviderKind` union is permanently scoped to four AUTHENTICATION providers, not PROTOCOL identities, and repurposing it would overload one type across two concerns. Indirectly, as an **architectural precedent**: **YES** — it already validates the exact "Interface + Noop default + Placeholder dev/test, zero secret exposure" shape Alpha 026 §2/§6 recommends for a NEW, separately-scoped Protocol Identity Provider (§5, Option C).

## 3. Existing Identity model classification — what each piece of code actually represents

| Candidate label | Which files represent it | Assessment |
|---|---|---|
| **FedOS Core Identity** | None yet. | Not represented anywhere in the current codebase — this is exactly the gap Alpha 026 §6/this Stage's §6-§7 name as the future direction. |
| **Nostr Identity** | None yet, as a STORED/MAPPED concept. `src/nostr/`'s own code handles Nostr EVENTS and SIGNATURES, never a persisted "this npub is a FedOS identity" record. | `src/sign/`/`src/nostr/` operate entirely on already-signed events supplied by an external signer — they never construct or hold a Nostr identity record of any kind. |
| **Vault Identity** | `docs/vault_crypto_identity.md` (design notes only — no code). | Purely a design-notes concept today; no `src/vault/*` file was found to implement an "Identity" shape (only `VaultUnlockKind`/`VaultUnlockRequest`, an UNLOCK concern, referenced type-only by `provider_bridge.ts`/`vault_bridge.ts`). |
| **Provider Identity** (AUTHENTICATION reference) | `src/identity/provider_types.ts`/`provider_boundary.ts`. | The ONLY genuinely-implemented "Identity"-named concept in the repo today — and it means AUTHENTICATION PROVIDER REFERENCE (Apple/Google/external/passkey), not protocol identity. |
| **Session Identity** | `src/identity/session_boundary.ts`. | A session LIFECYCLE request/response label (per `docs/device_identity_boundary.md`), not a persisted identity record. |
| **UI/Application profile** | Not found. `src/render/device_preview.ts` renders SAMPLE data only. | No real profile-shaped Identity data exists in `src/render/`. |
| **Descriptor / placeholder only** | `device_registration.ts` (`DeviceRegistrationDescriptor`), `device_trust.ts` (`DeviceTrustDescriptor`), `session_boundary.ts` (`SessionRequestDescriptor`), `recovery_policy.ts`. | All four are, by `docs/device_identity_boundary.md`'s own description, "types + pure review function, reject sensitive metadata" — descriptor/label shapes, never a stored identity. |

**Overlap found, explicitly flagged**: the word **"Identity"** is used
in this repo for at least THREE distinct, non-overlapping concerns —
(1) `src/identity/provider_boundary.ts`'s AUTHENTICATION-provider
reference, (2) `src/identity/device_registration.ts`/`device_trust.ts`/
`session_boundary.ts`'s DEVICE/SESSION descriptor labels, and (3) the
FUTURE, not-yet-implemented PROTOCOL identity (Nostr/ActivityPub/
Bluesky/Session) Alpha 026 scoped. None of these three currently
conflicts in code (each lives in its own file with its own type union),
but the shared directory name `src/identity/` and the shared English
word invite future confusion if a new Protocol Identity type were added
without a clearly separate name — a naming risk worth carrying into
Alpha 028's own scope, not a currently-broken state.

## 4. Secret boundary audit — verified absent

Every term below was searched for across `src/identity/**` and
`src/nostr/**` (case-insensitive, actual source text, not assumption):

| Term | Found in Identity/Nostr code? | Where / risk |
|---|---|---|
| `nsec` | **No.** | Zero occurrences anywhere in `src/identity/`, `src/nostr/`. |
| Raw private key | **No.** | `noble_signature.ts`'s own comment explicitly states "No private keys are involved"; independently confirmed by full-text search. |
| Raw AEAD key bytes | **No.** | No `src/identity/`/`src/nostr/` file references `AeadKeyHandle`/any AEAD type at all — they are entirely unaware Secure Runtime's Crypto Layer exists. |
| Seed | **No.** | Zero occurrences. |
| Mnemonic | **No.** | Zero occurrences. |
| Secret serialization | **No.** | Every request/report/descriptor type across all 11 `src/identity/` files is documented and structurally limited to opaque `reference`/label fields — none has a field capable of holding serialized secret material. |
| Direct filesystem secret storage | **No.** | No `src/identity/`/`src/nostr/` file imports `node:fs` or any filesystem API. |
| Direct `RuntimeStorageBackend` construction | **No.** | Zero import of `fedos_runtime_storage_backend.ts`/`fedos_runtime_storage_backend_windows_dpapi.ts` anywhere in `src/identity/`/`src/nostr/`. |
| Direct `FedosWasmLoader` access | **No.** | Zero import of `fedos_wasm_loader.ts` anywhere in `src/identity/`/`src/nostr/`. |

**Result: no Secret-boundary violation exists anywhere in the current
Identity/Nostr codebase.** This matches, and is independently confirmed
by, `docs/vault_crypto_identity.md` §0's own pre-existing "No key
custody in the app" principle and `docs/device_identity_boundary.md`'s
own "NONE... carries, derives, stores, or references a password,
recovery phrase, mnemonic, seed..." claim — both now cross-checked by
this Stage's own direct source search rather than accepted on their own
word.

## 5. Identity Provider Architecture — Options compared

Ten criteria, per the mandate: 重複回避 (duplication avoidance) /
Public API安定性 / Protocol非依存性 / Secret非公開 / Runtimeとの責務分離
/ Storageとの責務分離 / Nostr Adapterへの適合性 / ActivityPub・AT
Protocol・Sessionへの拡張性 / 移行コスト / Fail Closed.

| Criterion | A: `provider_boundary.ts`をそのまま中核に | B: 既存boundaryを拡張して昇格 | C: 新Provider追加、既存boundaryはAdapter化 | D: 整理してから新規設計 |
|---|---|---|---|---|
| **重複回避** | Low — reuses an AUTH-provider type union AS the protocol-identity type union, conflating two concerns this Stage's §2/§3 just found are genuinely different | Medium — reuses the Interface SHAPE but overloads `IdentityProviderKind`'s own meaning, the exact "one word, two jobs" mistake Alpha 005 already fixed once in this codebase's history | **High** — a new, correctly-scoped Interface for protocol identity; `provider_boundary.ts` keeps meaning exactly what it already means, zero redefinition | Medium — depends entirely on an unscoped "reorganize" step |
| **Public API安定性** | No risk (stays disconnected either way) | No risk | **No risk** — new Provider lives above Runtime per Alpha 026's own layering; zero touch to any of the 11 existing functions | No risk, but adds an unscoped prerequisite before any real progress |
| **Protocol非依存性** | Low — `IdentityProviderKind` has no room for Nostr/ActivityPub/Bluesky/Session without breaking "そのまま" | Medium — extensible, but every extension keeps stretching an AUTH-shaped Interface | **High** — designed from the start for multi-protocol identity, matching Alpha 026 §2/§6 exactly | Undetermined until the deferred design phase |
| **Secret非公開** | High (inherits existing discipline) | High (inherits existing discipline) | **High** (new design can adopt the SAME opaque-reference discipline `provider_types.ts` already proves works) | High (no behavior change) |
| **Runtimeとの責務分離** | High (already disconnected) | High | **High** (new Provider calls Runtime's own Public API like any other caller, never the reverse — Alpha 026 §3) | High |
| **Storageとの責務分離** | High (never referenced) | High | **High** | High |
| **Nostr Adapterへの適合性** | Low — `provider_boundary.ts`'s own lifecycle ("authentication ATTEMPT": idle→waiting→authenticated) is semantically an AUTH ceremony, not a stored/mapped protocol identity | Low-Medium — same semantic mismatch, just relabeled | **High** — a Nostr Adapter maps cleanly onto an Interface actually shaped for protocol identity | Undetermined |
| **拡張性 (ActivityPub/AT Protocol/Session)** | Low | Low-Medium | **High** — each is a new, isolated Adapter against the SAME Interface, zero change to `provider_boundary.ts` or any other Adapter | Undetermined |
| **移行コスト** | Lowest (nothing changes) but achieves nothing | Medium — no new file, but redefines an existing, real Interface's own meaning | **Medium** — one new Interface/file is real work, but `provider_boundary.ts` requires ZERO change | **Highest** — adds a whole separate "reorganize 11 existing, working, tested files" phase, raising regression risk, before the actual goal even starts |
| **Fail Closed** | High (unchanged) | High (unchanged) | **High** — new design inherits the SAME "Noop default + Placeholder dev/test only" discipline this codebase already applies everywhere it names an unimplemented boundary | High (unchanged) |

### Conclusion: **Option C**

A/B each repeat, or repeat with extra steps, the exact "one type serves
two concerns" mistake this codebase's own history (Alpha 005's naming
cleanup, cited in Alpha 020's own precedent) already corrected once.
D adds an UNSCOPED prerequisite — reorganizing 11 existing, working,
tested files for zero new capability — directly against this Stage's
own mandate to prioritize reuse over new abstraction; reusing
`provider_boundary.ts` CORRECTLY here means leaving it untouched (it
already does its own real job well), not reorganizing it.

**Option C is the only candidate that satisfies BOTH of this Stage's
priorities at once: it reuses `provider_boundary.ts` (as a cited
architectural precedent — and a literal future Adapter slot for
AUTH-provider-fed identity, exactly as `docs/vault_crypto_identity.md`
already sketches), while adding exactly one new, correctly-scoped
abstraction (a Protocol Identity Provider Interface) rather than
overloading an existing one.** This directly reconfirms, now grounded in
an actual file-by-file inventory rather than a purely theoretical
comparison, Alpha 026 §2/§6's own conclusion (③ Identity Provider
abstraction + ⑤ FedOS Identity core model).

## 6. Recommended architecture — confirmed alignment

```txt
Application
    |
    v
Protocol Adapter                  (Nostr / ActivityPub / AT Protocol / Session — each its own file)
    |
    v
FedOS Identity Service             (NOT YET IMPLEMENTED — Alpha 028+ candidate)
    |
    v
Identity Provider Boundary         (TWO parallel occupants at this SAME conceptual layer:)
    |                                (1) EXISTING src/identity/provider_boundary.ts -- AUTH-provider
    |                                    references (Apple/Google/external/passkey), UNCHANGED
    |                                (2) FUTURE Protocol Identity Provider (Nostr/ActivityPub/etc.),
    |                                    Option C's own new Interface -- NOT built this Stage
    v
Secure Runtime
       |- Crypto      (11-function Public API, Alpha 001-025, unmodified)
       |- Storage     (storeCiphertext/loadCiphertext/deleteCiphertext, unmodified)
       +- Environment (runtimeCapabilities, unmodified)
```

**Confirmed, by this Stage's own §1-§4 inventory, not merely asserted:**

- **Runtime holds no Identity semantics** — reconfirmed by §1.2 (Alpha
  026's own 11-function inventory is untouched) AND newly by this
  Stage's finding that even `AppRuntime.webAuthnProvider`/
  `signatureVerifier`/`relayPublisher` — real, connected fields — carry
  ONLY opaque, Noop/Placeholder/Mock-default providers, never Identity
  data itself.
- **Identity Service holds no raw secret** — no code implementing a
  "FedOS Identity Service" exists yet; §4's audit confirms every EXISTING
  Identity-adjacent file already upholds this discipline, the baseline
  any future Service must not regress from.
- **Protocol Adapter never calls Runtime directly** — confirmed
  structurally possible today: `src/nostr/`'s own `noble_signature.ts`/
  `publish.ts` are the ONLY `src/nostr/` files `create_runtime.ts`
  reaches, and neither is a "Protocol Adapter" in Alpha 026's sense —
  they are narrow, generic (verify-a-signature / publish-an-already-signed-event)
  primitives Runtime happens to compose, not a Nostr-semantics-aware
  Identity path.
- **Identity Provider understands no Protocol-specific event** —
  confirmed by §2: `provider_boundary.ts` has zero Nostr/ActivityPub
  vocabulary today, and Option C's own new Provider Interface is
  recommended to be designed the same way.
- **Storage understands no Identity** — reconfirmed unchanged from
  Alpha 025 §4/Alpha 026 §3; this Stage's own §4 audit found zero
  `RuntimeStorageBackend` construction anywhere in Identity/Nostr code.

## 7. Minimal FedOS Identity state candidate (advisory only — not implemented)

```ts
interface FedosIdentityDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
}
```

This shape is consistent with, and directly modeled on, the ALREADY
EXISTING opaque-reference discipline `provider_types.ts`'s own
`IdentityProviderRequest`/`IdentityProviderReport` (`kind` + optional
opaque `reference`) already established (§2) — a label plus a public,
non-secret identifier, nothing more. `id`/`provider`'s exact types are
left UNDECIDED by this Stage, consistent with the mandate; `publicIdentifier`
maps to a PUBLIC value only (an `npub`, an ActivityPub actor URI, a
Bluesky DID — all confirmed "MAY hold" under Alpha 026 §3).

**Explicitly excluded, per the mandate**: raw private key, `nsec`,
`AeadKeyHandle` serialization, protocol event shape, profile UI state,
relay state, credentials. None of these appears in the descriptor above,
and none should ever be added to it.

## 8. Nostr boundary — first Protocol Adapter candidate

```txt
Nostr Adapter                      (NOT YET IMPLEMENTED — would live in src/nostr/ or adjacent)
    |
    v
FedOS Identity Service             (NOT YET IMPLEMENTED)
    |
    v
Identity Provider Boundary         (existing provider_boundary.ts pattern, or Option C's new one)
```

**What `src/nostr/` already does TODAY, as fact (verified §1.2, not
speculation)**:

- Real BIP-340 Schnorr signature VERIFICATION (`noble_signature.ts`),
  connected to `AppRuntime.signatureVerifier` by default.
- Unsigned Nostr event construction and signed-event structural
  validation (`src/sign/*`, outside this Stage's own `src/nostr/`
  glob scope but factually adjacent) — confirmed by Alpha 026's own
  investigation to never import `src/runtime/`.
- A relay PUBLISH boundary (`publish.ts`) defaulting to
  `MockRelayPublisher`, connected to `AppRuntime.relayPublisher`, never
  touching a real network by default.
- A read-only relay adapter (`relay.ts`) NOT connected to `AppRuntime`
  at all.
- SHA-256 hashing only (`crypto.ts`) — zero key material.

**Explicitly forbidden by this Stage's own mandate, and NOT implemented
here**: Nostr key generation, `npub`/`nsec` conversion, event signing,
relay connection (live network), NIP-17, NIP-44, NIP-59, DM,
Marketplace, BBS. None of these existed in `src/nostr/` before this
Stage (§1.2/§4 confirm), and none is added by it.

## 9. Alpha 028 recommendation — exactly one

**Recommended: FedOS Identity Descriptor型の追加** (add the
`FedosIdentityDescriptor` type from §7 — type definition only, no
Runtime wiring, no Service, no Provider implementation).

Reasoning, against the other four candidates:

1. **既存Identity Provider Boundaryの最小整理** — REJECTED for Alpha
   028: Option C (§5) already concluded `provider_boundary.ts` needs
   ZERO change; "cleanup" of a file that is already correct for its own
   scope would be busywork against a working, tested, 3-file-old
   design, not genuine progress.
2. **FedOS Identity Descriptor型の追加** — **RECOMMENDED**: the
   smallest possible unit of real forward progress; a single type
   definition with no Runtime/Worker/Storage wiring of any kind, zero
   risk to any existing file, and it directly promotes this Stage's own
   §7 output from "advisory in a review doc" to "a real, guard-tested
   type" — without yet committing to the full Identity Service or
   Provider Interface shape (still correctly deferred).
3. **Identity Service skeleton** — premature: a Service needs to know
   what it's a service FOR (the Descriptor shape) before its own
   skeleton can be meaningfully named; building the skeleton before the
   Descriptor risks designing around a shape that later changes.
4. **Legacy Identity islandの整理** — REJECTED for the same reason as
   candidate 1 and Option D (§5): touches multiple existing, working,
   tested files for zero new capability, against this Stage's own
   reuse-first mandate.
5. **Nostr Adapter boundaryの設計レビュー** — premature: a Nostr Adapter
   review is most useful once the Descriptor/Service shapes it would
   adapt TO already exist; reviewing it first risks a design that
   doesn't fit what Alpha 028's own Descriptor work produces.

## 10. What this Stage does NOT do

- Does **not** implement any Identity API, Identity Service, or
  Identity Provider.
- Does **not** add any new Public Runtime API function.
- Does **not** add any Nostr feature (signing, key generation, relay
  connection, NIP-17/44/59, DM, Marketplace, BBS).
- Does **not** generate, derive, or store any secret key.
- Does **not** change any Crypto API or Storage API.
- Does **not** change `src/identity/*`, `src/nostr/*`, or any
  `src/runtime/*` file.
- Does **not** connect Worker or Production to anything new.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.
- Does **not** delete, merge, or reorganize any existing file.

## 11. See also

- `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md`
  (Secure Runtime Alpha 026) — the Identity/Runtime layering and
  Provider-abstraction recommendation this Stage's inventory grounds in
  actual, verified existing code.
- `docs/secure_runtime_alpha_025_secure_storage_api_scope_review.md`
  (Secure Runtime Alpha 025) — the Identity/Storage layering this
  Stage's §4/§6 reconfirms unchanged.
- `docs/vault_crypto_identity.md` — pre-existing, non-binding design
  notes; source of the "No key custody in the app" principle this
  Stage's §4 independently re-verifies.
- `docs/device_identity_boundary.md` — describes the four shipped
  `src/identity/device_*`/`session_boundary.ts`/`recovery_policy.ts`
  boundaries this Stage's §1.1 classifies as Worker-reachable-but-Runtime-disconnected.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` /
  `secure_runtime_alpha_022_storage_backend_selection_policy_review.md`
  (Secure Runtime Alpha 021/022) — the Interface + N-implementations +
  Resolver pattern Option C (§5) recommends reusing for Identity.
