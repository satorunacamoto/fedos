# FedOS Secure Runtime Alpha 009 — Public Runtime `encrypt()` API Surface Review

REVIEW ONLY. No Runtime, Worker, Production, Rust, `Cargo.toml`,
`package.json`, `create_runtime.ts`, or `fedos_wasm_loader.ts` change of
any kind. No wrapper is added, no `#[wasm_bindgen]` attribute is added, no
new Public API is wired, and no cryptographic algorithm changes. This
document and its guard test are the entire deliverable.

## 0. Where this picks up

Alpha 008 reached `AppRuntime.randomBytes()` end to end:

```
AppRuntime.randomBytes() -> Runtime Service -> Loader -> Rust Boundary -> Rust
```

Per `docs/secure_runtime_alpha_007_crypto_api_surface_review.md` §9's own
ranking, `encrypt()`/`decrypt()` are next. This Stage asks whether
`encrypt()` can be exposed the SAME way — a thin, non-algorithmic
wrapper — and finds that it cannot, for reasons §1–§4 below make precise.
No implementation follows from this finding; it is recorded so Alpha 010
can be scoped correctly.

## 1. Current Rust encrypt-related API inventory

| Function / Type | Kind | Status |
|---|---|---|
| `encrypt_placeholder() -> FedosCoreStatus` | legacy placeholder (pre-Stage 102) | fixed `{ state: Placeholder, reason: "placeholder only..." }`; encrypts NOTHING. **Never expose.** |
| `decrypt_placeholder() -> FedosCoreStatus` | legacy placeholder | same as above, decrypts NOTHING. **Never expose.** |
| `fedos_generate_aead_key_32() -> FedosGenerateAeadKeyDecision` | REAL, CSPRNG-backed key generation (Stage 171–176) | `{ status: FedosKeyGenerationStatus, key: Option<FedosAeadKeyHandle> }` — returns an OPAQUE key handle, never raw bytes. Zeroizes its own staging buffer. A genuine PREREQUISITE for `encrypt()`, not itself an encrypt operation. |
| `fedos_aead_nonce_96() -> FedosAeadNonceDecision` | REAL, CSPRNG-backed nonce draw (Stage 138) | `{ kind, state, nonce: Option<[u8; 12]> }` — called AUTOMATICALLY and ONLY from inside `fedos_encrypt`; never accepts or is passed a caller-supplied nonce. Not itself an `encrypt()` candidate — it is `fedos_encrypt`'s own internal plumbing, already fully consumed there. |
| `fedos_encrypt(algorithm, key, aad_domain, plaintext) -> FedosEncryptDecision` | REAL, NIST/RFC-8439-tested AEAD seal (Stage 166–176) | `{ status: FedosEncryptStatus, envelope: Option<FedosCiphertextEnvelope> }` — see §2 for its exact parameter/return shape. **The actual target of this review.** |
| `fedos_decrypt(key, envelope) -> FedosDecryptDecision` | REAL AEAD open (Stage 166–176) | `{ status: FedosDecryptStatus, plaintext: Option<Vec<u8>> }` — the counterpart to `fedos_encrypt`; see §6. |
| `FedosAeadKeyHandle` | opaque struct (wraps `secret_handle::SecretHandle`) | zero raw-byte accessor anywhere; `inner()` is `pub(crate)` only. Required as `encrypt()`'s `key` parameter. |
| `FedosCiphertextEnvelope` | opaque struct (wraps `crate::crypto::ciphertext_envelope::AeadCiphertextEnvelope`) | zero raw-byte accessor, no `Serialize`, no `AsRef<[u8]>`, no `Debug`/`Display` that prints bytes. Its own doc comment names a FUTURE, separate, explicitly-reviewed stage for any serialization scheme (`docs/ciphertext_envelope_plan.md`) — genuinely undecided even in Rust today. Required as `encrypt()`'s return payload and `decrypt()`'s input. |
| `FedosAeadAlgorithm` | fieldless enum, 2 variants (`ChaCha20Poly1305`, `Aes256Gcm`) | a NEW public label, deliberately separate from the `pub(crate)`-only internal `AeadCipher`. Fieldless enums are natively wasm-bindgen-compatible — no reshape needed. |
| `FedosAeadAadDomain` | fieldless enum, 5 variants (`RootKey`, `Identity`, `Storage`, `Conversation`, `TestOnly`) | a fixed, closed set of AAD-binding domains — NOT arbitrary caller-supplied AAD bytes. Also natively wasm-bindgen-compatible. |

**Classification:**
- (a) Legacy placeholders, never real, never expose: `encrypt_placeholder`, `decrypt_placeholder`.
- (b) Real, tested, but a PREREQUISITE operation, not itself an encrypt op: `fedos_generate_aead_key_32` (key generation). `fedos_aead_nonce_96` is internal-only plumbing already fully owned by `fedos_encrypt` — not a separate exposure candidate at all.
- (c) The real encrypt/decrypt pair — this review's actual subject: `fedos_encrypt`, `fedos_decrypt`.
- (d) Supporting boundary types that ANY `encrypt()` Public API must somehow cross the WASM boundary through, without leaking a raw key or ciphertext byte: `FedosAeadKeyHandle`, `FedosCiphertextEnvelope` (both opaque, both undecided for WASM export), `FedosAeadAlgorithm`, `FedosAeadAadDomain` (both fieldless enums, both straightforward).

## 2. Candidate Public Runtime API

The example given at the start of this Stage —

```
encrypt(key, plaintext, nonce?, aad?)
```

— **mismatches the real Rust signature on two points**, not merely a
naming difference:

1. `fedos_encrypt` does **not** accept a caller-supplied nonce at all —
   by design (`docs/nonce_generation_policy.md`), it draws its own via
   `fedos_aead_nonce_96()` internally. A public `nonce?` parameter would
   be actively wrong: either it is silently ignored (a misleading Public
   API) or Runtime would need a NEW Rust entry point accepting an
   external nonce — which is an algorithm-adjacent policy change, out of
   this Stage's scope and arguably out of scope for `encrypt()` at all
   given the existing policy doc's own reasoning.
2. `aad` in Rust is a fixed, closed `FedosAeadAadDomain` enum (5 named
   domains), not arbitrary AAD bytes. Exposing a free-form `aad?: Uint8Array`
   would again require either diverging from the existing AAD-binding
   scheme (forbidden — no algorithm change) or silently discarding
   caller input.

A signature actually faithful to the Rust function would look closer to:

```
encrypt(keyHandle, algorithm, aadDomain, plaintext) -> envelope | null
```

But this immediately surfaces the two undecided dependencies §3–§4 below
describe: `keyHandle` must already exist as something a JS caller holds
(requiring `generateKey()` or `importKey()` — neither exposed yet), and
`envelope` must be something a JS caller can hold and later pass back
into `decrypt()` — a shape Rust's own code has not yet decided either.

**Return value comparison** (`Result` / `Option` / `null` / `Error`):
Alpha 008's own precedent — `Promise<Uint8Array | null>`, never a thrown
`Error`, never a `Result`-shaped object exposing Rust's own diagnostic
detail — is the natural fit here too. `FedosEncryptStatus`'s own four
variants (`Ready`/`InvalidKey`/`NonceUnavailable`/`InternalFailure`) are
DELIBERATELY coarse at the Rust layer already ("no secret byte is
exposed through this label itself") — Runtime reproducing that whole
enum publicly would add detail Rust itself chose not to expose at this
granularity. The `null`-on-any-non-success pattern `randomBytes()`
established collapses cleanly onto `encrypt()`'s own four failure modes
the same way it already collapsed `random_bytes_32`'s two.

**Nothing here is decided.** This section only compares; Alpha 010 (or
whichever Stage actually reviews `generateKey()`, per this doc's own
recommendation below) makes the real decision.

## 3. Rust Boundary — is a thin wrapper adequate?

Alpha 008's `random_bytes_32()` wrapper worked because exactly ONE thing
needed reshaping (`Option<[u8; 32]>` → `Option<Vec<u8>>`), and every
other part of the signature (`()` — no parameters) was already trivial.

For `encrypt()`, the same "thin wrapper, zero algorithm change" pattern
is achievable in principle, but is blocked on TWO independently-undecided
type shapes, not one:

- **`key: &FedosAeadKeyHandle`** — a thin wrapper is plausible only if
  `FedosAeadKeyHandle` itself becomes a `#[wasm_bindgen]`-exported OPAQUE
  class. `wasm-bindgen` natively supports this: a struct annotated
  `#[wasm_bindgen]` becomes a JS class backed by a Rust-owned instance,
  reachable only through exported methods — no field is ever readable
  from JS unless a method explicitly returns it. This is a genuine
  structural match for this crate's own existing "opaque handle, never a
  raw byte getter" discipline (`docs/public_crypto_opaque_handles.md`).
  It is a LARGER change than Alpha 008's own (a new exported type, not
  merely a return-type reshape), but it introduces **zero** algorithm
  change — the same CSPRNG call and zeroize discipline `fedos_generate_aead_key_32`
  already uses would be completely unaffected.
- **`envelope: Option<FedosCiphertextEnvelope>` (return value)** — the
  SAME opaque-class treatment is structurally available, but
  `FedosCiphertextEnvelope`'s own doc comment already states its
  eventual cross-boundary shape is **undecided even in Rust today**
  (`docs/ciphertext_envelope_plan.md` names this "a future, separate,
  explicitly-reviewed stage"). This review does not resolve that;
  resolving it is that future stage's own job, not something to pre-empt
  here.
- **`aad_domain: FedosAeadAadDomain`** — genuinely thin-wrapper-friendly:
  wasm-bindgen supports C-style (fieldless) enums natively, no reshape
  needed, same category as `FedosAeadAlgorithm`.

**Conclusion:** `encrypt()`'s own thin-wrapper feasibility is blocked on
two prerequisite, separately-reviewable decisions (key-handle exposure
shape, envelope exposure shape) — not a lack of will to keep it thin.
Everything ELSE about the operation (the algorithm itself, the AAD
domain enum, the plaintext input) is already wrapper-ready today. The
existing algorithm (`ChaCha20Poly1305`/`Aes256Gcm`, RFC 8439/NIST-CAVP
vectors) is unaffected by any shape discussed here — a thin wrapper only
reshapes types; it never touches `crate::crypto::aead_internal::seal_internal`.

## 4. JS/WASM boundary type mapping

| Rust type | Role | JS-side shape | Notes |
|---|---|---|---|
| `plaintext: &[u8]` | input | `Uint8Array` | standard wasm-bindgen slice marshaling — this WOULD be Runtime's first WASM-boundary byte-buffer *input* (`randomBytes()` had no input at all). |
| `FedosAeadAlgorithm` | input (enum) | JS number-like enum | native wasm-bindgen C-style enum support; genuinely thin, no reshape. |
| `FedosAeadAadDomain` | input (enum) | JS number-like enum | same as above. |
| `FedosAeadKeyHandle` | input (opaque) | **undecided** | candidate: `#[wasm_bindgen]`-exported opaque class (§3). Alternative: never cross the boundary as a standalone value at all — fold key generation into a single combined operation Runtime never separates. Neither decided here. |
| `FedosCiphertextEnvelope` | output (opaque) | **undecided** | same two candidate directions as the key handle; additionally blocked on Rust's own not-yet-written serialization plan. |
| `plaintext: Option<Vec<u8>>` (from `fedos_decrypt`) | output | `Uint8Array \| undefined` | straightforward, already-precedented reshape — identical pattern to `random_bytes_32`'s own `Option<Vec<u8>>` → `Uint8Array \| undefined`. |

Two of six rows are already fully resolved by precedent (enums,
plaintext-out); one is a new-but-standard pattern (plaintext-in); two are
genuinely open questions this review surfaces but does not answer.

## 5. Fail Closed

The four guarantees `randomBytes()` established are confirmed
ARCHITECTURALLY INDEPENDENT of which key-handle/envelope shape a future
Stage picks — none of the candidate directions in §3–§4 require
deviating from any of them:

- **Development-only reachability** — any future `encrypt()` Runtime
  Service would reuse the SAME six-condition `FedosWasmLoader` gate
  (`attemptDevOnlyRandomBytesCall()`'s own pattern), or a sibling method
  following the identical shape.
- **Production Fail Closed** — the same environment check that makes
  `randomBytes()` resolve `null` outside Development Runtime applies
  unchanged; nothing about key handles or envelopes affects this gate.
- **Worker unconnected** — `encrypt()` would be a NEW, separate
  `AppRuntime` field; nothing reviewed here requires touching
  `src/worker.ts`.
- **`initializeCrypto()` unchanged** — `encrypt()` would sit alongside
  `randomBytes`/`runtimeCapabilities` as a fully independent field, the
  same pattern both of those already established.

This is recorded as a confirmed constraint for whichever future Stage
implements `encrypt()` — not something this review needed to re-decide.

## 6. `encrypt()` and `decrypt()` — same Phase or separate?

**Arguments for separate Phases:**
- `fedos_decrypt`'s own parameters (`key`, `envelope`) are BOTH types
  this review found undecided — `decrypt()` cannot be meaningfully
  scoped independent of whatever shape `encrypt()`'s own Stage settles
  on for those two types. They are coupled at the TYPE level, which does
  not require them to be IMPLEMENTED in the same Stage.
- Mirrors this arc's own "1 Stage = 1 responsibility" discipline, and
  Alpha 008's own precedent — `randomBytes()` shipped alone, not paired
  with any other operation.
- `decrypt()` consuming an `encrypt()`-produced envelope means
  `decrypt()` is naturally untestable in isolation before `encrypt()`
  exists — `encrypt()` must land first regardless of phase grouping.

**Arguments for the same Phase:**
- They share ALL FOUR of the same undecided boundary types (key handle,
  algorithm enum, AAD domain enum, envelope) — deciding one without the
  other risks a mismatched round-trip shape (`encrypt()` producing an
  envelope shape `decrypt()` cannot actually consume).
- A round-trip test (`encrypt()` then `decrypt()` recovers the original
  plaintext) is the single most valuable guard for this pair, and reads
  naturally as a same-Phase test either way.

**Recommendation: separate Phases, `encrypt()` first.** `encrypt()`
alone already carries the two hardest open questions (key-handle
exposure, envelope exposure); resolving them fully for `encrypt()` first
means `decrypt()` becomes a comparatively mechanical mirror-image Stage
once those shapes are fixed — the same reasoning Alpha 007 itself used
ranking `randomBytes()` ahead of the `encrypt()`/`decrypt()` pair
("closest to `version()`'s own precedent" — simplest available surface
first).

## Recommendation for Alpha 010

**`encrypt()` itself is not a safe minimal Alpha 010 candidate** — it is
blocked on two independently-undecided type-boundary questions (§3–§4).

The genuinely minimal, safe next wrapper is:

> **Expose `fedos_generate_aead_key_32()` as an opaque,
> `#[wasm_bindgen]`-exported key-handle class.**

Reasoning:
- It has exactly ONE candidate treatment (an opaque class), unlike
  `encrypt()`'s two independently-undecided types.
- It reuses Alpha 008's own CSPRNG Fail-Closed shape
  (`EntropySourceUnavailable` → `null`) — no new Fail-Closed pattern is
  needed.
- It is a genuine PREREQUISITE for `encrypt()` regardless of which
  further shape `encrypt()` eventually takes — no future `encrypt()`
  candidate can be called from JS without a JS-held key value first.
- It does NOT require deciding the ciphertext envelope's own future
  shape at all — fully decoupling the two open questions this review
  found, so Alpha 010 can resolve ONE decision at a time instead of two
  at once.

This is a recommendation only. Alpha 010 itself must review the
opaque-class `#[wasm_bindgen]` mechanics properly before implementing —
mirroring Alpha 008's own use of a genuine mid-Stage decision point
(there, `AskUserQuestion`; here, whatever Alpha 010's own review turns
up) rather than assuming the mechanics are risk-free.

## Unresolved / open questions for future Stages

- The ciphertext envelope's own future serialization/opaque-class shape
  — `docs/ciphertext_envelope_plan.md` already flags this as unresolved
  on the Rust side; this review does not resolve it either.
- Whether `FedosAeadKeyHandle` should be `#[wasm_bindgen]`-opaque-exported
  vs. never crossing the WASM boundary as a standalone value at all (a
  combined "generate-and-seal in one call" API instead) — not decided.
- Whether `decrypt()` ships in the SAME or a SEPARATE Stage from
  `encrypt()` — this review recommends separate, but does not bind a
  future Stage to that choice.
- `importKey()`/`exportKey()` scoping — explicitly out of this review's
  scope; Alpha 007 already deferred these pending their own review.
