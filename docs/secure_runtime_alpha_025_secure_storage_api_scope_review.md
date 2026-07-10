# FedOS Secure Runtime Alpha 025 — Secure Storage API Scope Review

**Status: REVIEW ONLY. No code change of any kind — the Runtime
Storage Service (`fedos_runtime_ciphertext_storage.ts`), the Storage
Backend Interface/implementations (`fedos_runtime_storage_backend.ts`,
`fedos_runtime_storage_backend_windows_dpapi.ts`), the Storage Resolver
(`fedos_runtime_storage_resolver.ts`), the Runtime Mode/Platform
Authorities, `types.ts`, `create_runtime.ts`, Worker, Rust, `Cargo.toml`,
and `package.json` are all byte-for-byte unchanged. This document
classifies what the Secure Storage API can and cannot store today,
compares five future storage-scope candidates, and formally confirms
three layering boundaries: Storage must never hold Identity, Identity
Layer may use Storage, and Nostr Event/DM/Attachment persistence is an
Identity/Application Layer responsibility, never a Storage Layer one.**

## 1. What can be stored today

Exactly ONE type crosses `storeCiphertext()`/`loadCiphertext()`/
`RuntimeStorageBackend.store()`/`load()`: `AeadCiphertextWire` — the
branded, opaque, canonical-JSON-plus-base64url `string`
`exportCiphertext()` (Alpha 018) produces. Enforced at the TYPE level,
not merely by convention: `RuntimeStorageBackend.store(id: string,
wire: AeadCiphertextWire): Promise<boolean>` makes passing anything
else a compile-time error, byte-for-byte unchanged since Alpha 019.

## 2. What cannot be stored today — classified, with why

| Value | Why it cannot be stored |
|---|---|
| `AeadKeyHandle` | Permanently excluded by `docs/public_crypto_opaque_handles.md`/Alpha 007 §6 — raw/persistable key material is never allowed on a general-purpose surface. `RuntimeStorageBackend.store()`'s own parameter type makes this a compile-time error, not a runtime check. |
| `AeadCiphertextHandle` (the OPAQUE, in-memory-only value `encrypt()` directly returns, BEFORE `exportCiphertext()`) | Never serializable by design — it is a `#[wasm_bindgen]`-exported class instance with exactly one field (`kind`), no raw-byte accessor of any kind. Only its EXPORTED form, `AeadCiphertextWire`, is a storable `string`; the handle itself is not a storage input to any function in this arc. |
| `RuntimeCapabilities` | A read-only, ephemeral REPORT (`prototypeCompleted`/`rustReachable`/`rustVersion`/`runtimeMode`), recomputed fresh on every `runtimeCapabilities()` call. It has no `store`/`load` path anywhere in this arc, and persisting a snapshot would let a stale report be mistaken for a live one — directly against its own "PUBLIC REPORT, not a gate, always recomputed" design (Alpha 006 §1). |
| Runtime Mode (`determineFedosRuntimeMode()`'s own return value) | A CLASSIFIER result, deliberately never cached or persisted — Alpha 020 §4 explicitly designed it to be re-evaluated on every call, never a stored/trusted-later value. Persisting it would let an environment classification made at one moment silently outlive the conditions that produced it. |
| Runtime Platform (`determineFedosRuntimePlatform()`'s own return value) | Same reasoning as Runtime Mode, one level down (Alpha 024 §3/§4) — a platform read has no reason to ever be stale-read from storage; `process.platform` is always available synchronously and cheaply. |
| `randomBytes()`'s own raw `Uint8Array` output | Never passed to any storage function anywhere in this arc. Raw entropy output has no defined use as a stored value; a caller needing persisted secret material is expected to route it through `generateAeadKey()`/`encrypt()`/`exportCiphertext()` first, never store raw random bytes directly. |
| `decrypt()`'s own raw plaintext `Uint8Array` output | Never passed to any storage function anywhere in this arc. Storing recovered PLAINTEXT would defeat the entire purpose of encrypting it in the first place — this arc's Storage Layer only ever holds `AeadCiphertextWire`, the encrypted form, never the decrypted one. |

**Summary**: this arc's Secure Storage API has exactly one storable
shape (`AeadCiphertextWire`) and seven distinct categories of value
that are structurally, or by simple absence of any code path,
impossible to store through it today.

## 3. Future storage-scope candidates — compared

Five candidates for what a FUTURE Stage might expand the storable
scope to, compared across nine criteria.

| Criterion | ① Ciphertextのみ (current) | ② Ciphertext + Metadata | ③ Ciphertext + Identity | ④ Runtime全体 | ⑤ Arbitrary Object Store |
|---|---|---|---|---|---|
| **Fail Closed** | Best — type-level exclusion of everything else; zero additional Fail-Closed surface needed | Moderate — a new, separately-reviewed shape/validation surface for metadata fields | Weak — Identity verification failure becomes a NEW Fail-Closed dimension every Backend must now handle | Worst — persisting a Classifier result (Runtime Mode/Platform) directly contradicts their own "always re-evaluated, never cached" design (§2) | Weak — losing the type-level `AeadCiphertextWire`-only guarantee pushes every exclusion back to a runtime check, a real regression from today |
| **責務 (responsibility)** | Cleanest possible — Storage is "an opaque container for encrypted bytes," nothing else | Slightly widened — Storage would gain "what did I store," still no Identity/content semantics IF metadata stays non-secret | **Violates the Identity/Storage layering (§4)** — Storage would need to understand WHOSE ciphertext this is | **Violates it more severely** — Storage would hold Runtime's own operational state, a layer it has no business knowing about | Undefined — "stores anything" is definitionally "has no responsibility boundary," directly opposed to this arc's Fail-Closed-first philosophy |
| **Security** | High — only ever holds already-AEAD-encrypted, opaque bytes | Medium-High — safe IF metadata is provably non-secret; a new review burden every time a metadata field is proposed | Low-Medium — pubkey-to-ciphertext correlation becomes possible AT THE STORAGE LAYER, a new attack surface no Backend needs today | Low — environment/capability data becoming persistent creates a new, unnecessary disclosure surface | Low — no type system backstop against a caller accidentally storing an `AeadKeyHandle` or raw plaintext |
| **移植性 (portability)** | High — `RuntimeStorageBackend`'s 3-method contract already proven across Memory AND a real OS backend (DPAPI, Alpha 023) | Medium — every Backend (including future Keychain/Secret Service/SQLite) must additionally represent metadata, a breaking interface change | Low — every Backend must understand Identity, most native OS keystores (Keychain, DPAPI, Secret Service) have no concept of it | Very low — no real backend (OS keystore or otherwise) is designed to hold "an entire Runtime's state" | Nominally high, actually low — "accepts anything" does not match what any real OS keystore API (DPAPI/Keychain/Secret Service) actually offers |
| **Storage抽象 (abstraction)** | Stable, already validated by two independent implementations (Alpha 019, Alpha 023) | Requires a NEW, carefully-scoped shape decision (out of this Stage's own scope) | Breaks the existing abstraction — the Interface would need an Identity parameter threaded through every method | Not applicable — Runtime state was never designed to fit a `store(id, value)` shape | Over-abstracted to the point of meaninglessness |
| **Worker** | No dependency, unaffected either way (still unconnected) | No dependency | No dependency, but sets a precedent that would need re-litigating once Worker connects | No dependency | No dependency |
| **Production** | No dependency — the Runtime Storage Service's own Development-only gate is unaffected by WHAT is storable | No dependency | No dependency | Directly undermines Production Fail-Closed reasoning — persisting a Production/Unknown classification result risks it being read back and TRUSTED without re-evaluation | No dependency, but removes a layer of Production-safety the type system currently provides for free |
| **Nostr** | Fully decoupled — Storage never parses or understands ciphertext content, so it is equally correct whether the encrypted payload happens to be a Nostr event or anything else | Still decoupled, IF metadata never includes Nostr-specific fields (event `kind`, `pubkey`, etc. — see §5) | **Direct violation risk** — Identity-tagged storage is the natural (wrong) place someone would reach for to store "Alice's DMs," conflating Storage with Nostr's own Identity model | Unrelated to Nostr directly, but the general erosion of layering this candidate represents makes a future Nostr-in-Storage mistake more likely | The genuinely dangerous candidate for Nostr scope creep — "store anything" is exactly the shape a future contributor would use to bolt Nostr Event storage directly onto this layer, which §5 explicitly forbids |
| **将来性 (future extensibility)** | Real, ALREADY DEMONSTRATED — Alpha 023 added a full second Backend (DPAPI) with ZERO change to this candidate's own scope | Plausible for a genuinely non-secret bookkeeping need, but not designed by this Stage | **Should be permanently rejected** — the layering violation only gets more expensive to unwind the longer it exists | **Should be permanently rejected** — contradicts the Authorities' own core design principle | **Should be permanently rejected** — the "arbitrary" property is precisely what this arc's Fail-Closed discipline has consistently refused to allow anywhere else (Runtime Mode Authority, Storage Backend Interface, every opaque handle) |

**Conclusion**: ① (the current scope) remains correct and should stay
the ONLY implemented scope. ② is the only candidate worth a future,
separately-reviewed Stage — and only once a genuine non-secret metadata
need exists, with an explicit review of exactly which fields are safe
to add. ③, ④, and ⑤ should be treated as PERMANENTLY REJECTED
directions, not merely deprioritized — each one violates a boundary
this arc has deliberately built and repeatedly reaffirmed (Identity/
Storage layering, Classifier-not-cached-state, and type-level
Fail-Closed exclusion, respectively).

## 4. Identityとの関係 — the layering this Stage confirms

FedOS Runtime's own maintained direction is a strict, one-directional
layering:

```txt
Identity Layer
     |
     v
Crypto Layer
     |
     v
Storage Layer
```

**Storage must never hold, reference, or depend on Identity.** Verified
by direct source inspection (this Stage's own test suite, §7): none of
`fedos_runtime_ciphertext_storage.ts`, `fedos_runtime_storage_backend.ts`,
`fedos_runtime_storage_backend_windows_dpapi.ts`, or
`fedos_runtime_storage_resolver.ts` contains any reference to
`Identity`/`pubkey`/`npub`/`nsec`/`nevent` outside of guardrail PROSE
explicitly stating those concepts are absent. Every one of
`storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()`'s own `id`
parameter is an OPAQUE `string` the CALLER supplies and the CALLER
alone gives meaning to — Storage itself never interprets, validates, or
derives meaning from it. An `id` happening to look like a Nostr pubkey
or an Identity-scoped key is invisible to Storage; it is exactly as
meaningful to this layer as any other string.

**The only permitted structure is the REVERSE**: Identity Layer (once
it exists) MAY call into Storage — exactly the same "higher layer calls
lower layer" direction Crypto Layer already uses today (a future
Identity Layer would call `storeCiphertext()` the same way Runtime's
own callers do now) — but Storage may NEVER call into, import from, or
hold a reference to anything Identity-shaped. This is a ONE-DIRECTIONAL
permission, not a two-way relationship.

## 5. Nostrとの関係 — Application/Identity Layer responsibility, not Storage

**Nostr Event storage, DM storage, and Attachment storage are explicitly
NOT Storage Layer responsibilities.** They belong to the Identity/
Application Layer, for a structural reason, not merely a stylistic one:
a Nostr Event has intrinsic Identity and content semantics (`pubkey`,
`kind`, `content`, tags, signature) that Storage Layer is architecturally
forbidden from understanding (§4). The ONLY correct integration shape is:

```txt
Nostr Event / DM / Attachment (Application/Identity Layer)
     |
     v  (encrypt via Crypto Layer, producing an AeadCiphertextWire)
     |
     v
storeCiphertext(id, wire)   (Storage Layer — sees an opaque id/wire pair only)
```

Storage Layer never parses, validates, or is aware that the
`AeadCiphertextWire` it is holding happens to be an encrypted Nostr
Event rather than any other kind of encrypted payload — this is exactly
what makes the current, single-shape (`AeadCiphertextWire`-only) design
correct and Nostr-agnostic by construction (§3, candidate ① row
"Nostr"). Confirmed by inspection: no file under this arc's Storage
chain references `kind`/`content`/`sig`/`tags`/`relay`/any other
Nostr-specific vocabulary.

## 6. What this Stage does NOT do

- Does **not** change `fedos_runtime_ciphertext_storage.ts`.
- Does **not** change `fedos_runtime_storage_backend.ts`.
- Does **not** change `fedos_runtime_storage_backend_windows_dpapi.ts`.
- Does **not** change `fedos_runtime_storage_resolver.ts`.
- Does **not** change `fedos_runtime_mode_authority.ts`/
  `fedos_runtime_platform_authority.ts`.
- Does **not** change `types.ts`/`create_runtime.ts`.
- Does **not** change `src/worker.ts` — Worker remains fully
  unconnected and unmodified.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change any Public Runtime API signature.
- Does **not** implement a Metadata/Identity/Runtime-state/Arbitrary
  storage scope of any kind — §3's comparison is advisory only.
- Does **not** implement Identity Layer, Nostr Event storage, DM
  storage, or Attachment storage of any kind.

## 7. See also

- `docs/secure_runtime_alpha_019_secure_storage_foundation.md` (Secure
  Runtime Alpha 019) — defined the `AeadCiphertextWire`-only restriction
  this Stage's §1/§2 reconfirms unchanged.
- `docs/secure_runtime_alpha_020_runtime_mode_authority_consolidation.md`
  (Secure Runtime Alpha 020) — the Classifier-not-cached-state design
  this Stage's §2/§3 (Runtime Mode/candidate ④) relies on.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` /
  `secure_runtime_alpha_022_storage_backend_selection_policy_review.md`
  / `secure_runtime_alpha_023_windows_dpapi_storage_backend.md` /
  `secure_runtime_alpha_024_dpapi_resolver_integration.md` (Secure
  Runtime Alpha 021–024) — the Backend/Resolver/Platform Authority
  architecture this Stage's §3 candidate comparison is scoped against.
- `docs/public_crypto_opaque_handles.md` / Alpha 007 §6 — the permanent
  "no raw/persistable key material" exclusion this Stage's §2
  (`AeadKeyHandle` row) reconfirms.
- `docs/secure_runtime_alpha_006_mode_authority_review.md` (Secure
  Runtime Alpha 006) — the review-only format (comparison table,
  explicit non-goals list) this Stage follows.
