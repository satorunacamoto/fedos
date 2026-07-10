# FedOS Secure Runtime Alpha 011 — Public Runtime `encrypt()` Boundary Review

**Status: REVIEW ONLY. No Runtime, Worker, Production, Rust, `Cargo.toml`,
`package.json`, `create_runtime.ts`, or `fedos_wasm_loader.ts` change of
any kind. No wrapper is added, no `#[wasm_bindgen]` attribute is added, no
new Ciphertext type is added, no new Key Handle type is added, no Public
API is added, and no cryptographic algorithm/specification changes. This
document and its guard test are the entire deliverable.**

## 0. Where this picks up

Alpha 009 found `encrypt()` blocked on two independently-undecided
type-boundary questions — the opaque `FedosAeadKeyHandle`'s own
cross-boundary shape, and the opaque `FedosCiphertextEnvelope`'s own
cross-boundary shape — and recommended Alpha 010 resolve the smaller,
genuinely-separable prerequisite first: key GENERATION, not encryption
itself.

Alpha 010 shipped `AppRuntime.generateAeadKey(): Promise<Uint8Array | null>`
— but deliberately did NOT resolve the key-handle shape question Alpha 009
raised. It unwrapped the opaque `FedosAeadKeyHandle` back into raw bytes as
an explicitly-labeled "Alpha-limited, NOT the future shape" stand-in,
naming a future migration to an opaque key-handle class as still-pending
work.

Both of Alpha 009's original open questions therefore remain open today.
This Stage does not resolve either. It narrows and organizes them —
specifically the **key boundary** (§1–§2) and the **Ciphertext boundary**
(§3) — so that whichever future Stage implements `encrypt()` (this
review recommends Alpha 012, §7) inherits a reviewed comparison instead of
an ad hoc decision made under implementation pressure.

## 1. `generateAeadKey()`'s return shape, revisited for `encrypt()`'s sake

Today: `AppRuntime.generateAeadKey(): Promise<Uint8Array | null>`
(`docs/secure_runtime_alpha_010_aead_key_generation.md`) — 32 real key
bytes, or `null`. That document already states this is a "conscious,
temporary substitute — not the intended final design."

The question THIS Stage narrows is not whether to change
`generateAeadKey()` itself (out of scope — forbidden this Stage), but
whether `encrypt()` should **consume** that same raw-bytes shape, or
whether `encrypt()`'s arrival should be the trigger that finally migrates
the key boundary to an **Opaque Key Handle**.

| Candidate | Description | For | Against |
|---|---|---|---|
| **A. Raw bytes** (`Uint8Array`) | `encrypt()` accepts the same `Uint8Array` `generateAeadKey()` already returns; Rust-side, a NEW constructor path reconstructs a `FedosAeadKeyHandle` from those bytes each call (no such constructor exists today — `docs/public_crypto_opaque_handles.md` §2 names exactly two ways to obtain a handle: `fedos_generate_aead_key_32`, or receiving one back from a prior call; "construct from caller-supplied raw bytes" is neither). | Reuses the exact shape `generateAeadKey()` already established — zero NEW public type on the Runtime side; smallest possible Public API surface change. | Directly contradicts Alpha 007 §6's own PERMANENT exclusion list ("Raw key material as exportable bytes... never belongs on a public, general-purpose surface without its own dedicated, separately-reviewed Stage") — `generateAeadKey()` already crossed this line once, explicitly labeled temporary; `encrypt()` consuming it again would be a SECOND, compounding instance of the same temporary compromise, not a new one. Also requires a genuinely NEW Rust-side constructor (`FedosAeadKeyHandle::from_raw_bytes_for_internal_use`-shaped), which is not "zero new Rust surface" the way it first appears. |
| **B. Opaque Key Handle** (`#[wasm_bindgen]`-exported class) | `FedosAeadKeyHandle` itself becomes a `#[wasm_bindgen]`-exported opaque class (per Alpha 009 §3's own already-reviewed mechanics: wasm-bindgen natively supports this — a JS class instance backed by a Rust-owned value, reachable only through exported methods, no field ever readable). `generateAeadKey()` would need a SEPARATE future Stage to change its own return type to match (out of THIS Stage's scope — `generateAeadKey()` is explicitly unchanged here). | Matches this crate's own PERMANENT "opaque handle, never a raw byte getter" discipline (`docs/public_crypto_opaque_handles.md` §3) exactly — `FedosAeadKeyHandle` was designed this way from Stage 171–176 onward specifically so it COULD cross a public boundary opaquely. Zero algorithm change; reuses the exact CSPRNG/zeroize discipline already in place. Is the direction both Alpha 009 §3 and Alpha 010's own "Future migration planned" section already named as the intended final shape. | Larger lift than Candidate A — a genuinely NEW exported Rust type, not a return-type reshape. Creates a temporary MISMATCH with `generateAeadKey()`'s own current raw-bytes return value: a caller would generate a key as `Uint8Array` but need an opaque handle to encrypt with it — meaning `generateAeadKey()` itself would need its own follow-up migration Stage before this is coherent end-to-end. |

**Nothing here is decided.** Candidate B is the direction every prior
Stage in this arc has pointed toward (Alpha 009 §3, Alpha 010's own
"Future migration planned" section, `docs/public_crypto_opaque_handles.md`
§1–§2 in general), but choosing it for `encrypt()` alone, without also
migrating `generateAeadKey()`, produces a real end-to-end inconsistency
this review flags but does not resolve — see §8.

## 2. `encrypt()` public signature candidates

Per Alpha 009 §2, the real Rust function is
`fedos_encrypt(algorithm: FedosAeadAlgorithm, key: &FedosAeadKeyHandle, aad_domain: FedosAeadAadDomain, plaintext: &[u8]) -> FedosEncryptDecision`
— no caller-supplied nonce (drawn internally via `fedos_aead_nonce_96()`,
`docs/nonce_generation_policy.md`), and AAD is a fixed, closed 5-value
enum label, never free-form bytes. Candidate Public Runtime signatures,
compared against that real shape:

| Candidate | Shape | Faithfulness to `fedos_encrypt` |
|---|---|---|
| `encrypt(key, plaintext)` | 2-arg | Omits `algorithm` and `aadDomain` entirely — Runtime would need to hardcode BOTH internally. That is a POLICY decision (which cipher, which AAD domain, for which caller), not a signature simplification, and is not reviewed by this Stage. |
| `encrypt(key, plaintext, aad)` | 3-arg, free-form `aad` | The exact naive shape Alpha 009 §2 already found mismatched: `aad` in Rust is `FedosAeadAadDomain`, a fixed 5-variant label, not arbitrary caller bytes. Exposing free-form `aad: Uint8Array` would mean either silently discarding caller input or diverging from the existing AAD-binding scheme (an algorithm-adjacent change, forbidden). |
| `encrypt(key, algorithm, aadDomain, plaintext)` | 4-arg, faithful | Matches `fedos_encrypt`'s real shape field-for-field. `algorithm`/`aadDomain` are both natively wasm-bindgen-compatible fieldless enums (§4) — genuinely thin to expose. This is the ONLY candidate that does not require Runtime to make an undocumented policy choice on the caller's behalf. |
| `encrypt(key, plaintext, algorithm?)` with a Runtime-fixed default `aadDomain` | 2–3 arg, partial policy default | A middle ground: still requires deciding (and hardcoding) ONE fixed AAD domain for every public `encrypt()` call — itself a policy review this Stage does not undertake, since `docs/nonce_generation_policy.md`-style binding decisions have always had their own dedicated stage in this arc. |

No candidate is selected. The 4-arg faithful shape is the ONLY one of the
four that introduces no hidden policy decision — but "introduces no
hidden policy decision" is a property this review can observe, not a
recommendation to adopt it wholesale (a smaller Alpha 012 candidate is
named in §7, and it does not need to resolve this table in full).

## 3. Ciphertext boundary — how should `FedosCiphertextEnvelope` cross into Runtime?

| Candidate | Description | Cost / readiness today |
|---|---|---|
| **`Uint8Array`** | The envelope serialized to a flat byte buffer, returned to JS as ordinary bytes. | **Not ready.** No serialization function exists in Rust at all. `docs/ciphertext_envelope_serialization_plan.md` §9 records that Stage 182 DECIDED the eventual MVP wire encoding (canonical JSON + base64url fields) but explicitly did NOT implement it — "no encode/decode function... exist anywhere in this crate." Producing `Uint8Array` today would require writing that encoder first: new Rust code, and likely a new production dependency (`serde_json` promoted from `[dev-dependencies]`, per that document's own §4 criterion 1) — both forbidden this Stage and not a "thin wrapper" by any measure. |
| **Opaque Class** (`#[wasm_bindgen]`-exported, mirroring `FedosAeadKeyHandle`'s own candidate treatment) | `FedosCiphertextEnvelope` becomes a JS class instance, opaque, passed only from `encrypt()`'s return to `decrypt()`'s input — never inspected, never serialized. | **Cheapest to reach.** Requires zero Rust serialization work — the type crosses the boundary as a live, wasm-bindgen-owned reference, exactly the same mechanism as Candidate B in §1. Matches `docs/public_crypto_opaque_handles.md`'s existing permanent design for this exact type. Limitation: a caller cannot persist or transmit the ciphertext this way (no storage, no Nostr transport) — `docs/ciphertext_envelope_serialization_plan.md` §2.1 exists precisely because those ARE named future consumers; an opaque class defers that need entirely rather than solving it. |
| **JSON** | The envelope's fields (`version`/`algorithm`/`aad`/`nonce`/`ciphertext`/`tag`) as a plain JS object or JSON string, per the Stage 182 canonical-field-order decision (`v`/`alg`/`aad`/`n`/`ct`/`tag`). | **Decided in principle, not implemented.** Same blocker as the `Uint8Array` row — no encoder exists, and adopting one is its own, separate, `Cargo.toml`-touching Stage (forbidden here). Advantage over raw `Uint8Array` if ever built: human-inspectable, and already matches this crate's own Stage 182 decision, so it would not be a NEW format choice, only an implementation of an existing one. |

**Comparison summary:** the Opaque Class is the only candidate buildable
today without new serialization code or a new dependency — but it also
does not answer the actual reason an envelope format was ever planned
(`docs/ciphertext_envelope_plan.md` §2: "a caller storing or transmitting
this ciphertext needs...metadata to open it again"). `Uint8Array`/JSON
both require Rust work this Stage is forbidden from doing. **No decision
is made here.**

## 4. JS/WASM boundary type mapping — existing pattern vs. new

| Rust type | Direction | Classification |
|---|---|---|
| `plaintext: &[u8]` → `Uint8Array` | input | **New pattern for a byte-buffer input** (first noted by Alpha 009 §4 — `randomBytes()`/`generateAeadKey()` had no byte input at all), but a STANDARD wasm-bindgen slice-marshaling pattern, not a novel mechanism. |
| `FedosAeadAlgorithm` / `FedosAeadAadDomain` → JS number-like enum | input | **Existing pattern.** Both are fieldless enums; wasm-bindgen supports these natively, already confirmed by Alpha 009 §4 with zero reshape needed. |
| `Option<Vec<u8>>` → `Uint8Array \| undefined` | output | **Existing pattern.** Identical to `random_bytes_32()` (Stage 1004) and `generate_aead_key_32()` (Stage 1005) — both already ship this exact reshape today. |
| `FedosAeadKeyHandle` (opaque) → JS value | input | **New pattern, IF Candidate B (§1) is chosen.** No `#[wasm_bindgen]`-exported opaque class exists anywhere in this crate today — `version()`, `random_bytes_32()`, `generate_aead_key_32()` are the only three `#[wasm_bindgen]` functions, and all three take no argument beyond primitives/nothing. If Candidate A (§1) is chosen instead, this row collapses into the already-existing `Uint8Array` input pattern, at the cost of the reconstruction concern §1 already named. |
| `FedosCiphertextEnvelope` (opaque) → JS value | output | **New pattern regardless of §3's outcome**, unless the Opaque Class candidate is chosen, in which case it is the SAME new mechanism as the `FedosAeadKeyHandle` row above (one new mechanism, reused for two types, not two separate new mechanisms). |

**Classification summary:** three of five rows are fully existing
precedent; the byte-input row is a standard-but-first-use pattern; the
two opaque-value rows are the genuinely new mechanism this arc has not
yet built — and both would use the SAME underlying wasm-bindgen feature
(`#[wasm_bindgen]` on a struct), so resolving one is most of the work of
resolving the other.

## 5. Fail Closed — reconfirmed unaffected

None of §1–§4's comparisons touch any Fail-Closed guarantee already in
place. Verified by inspection (no code was run or changed by this
Stage — this is a structural confirmation, matching Alpha 009 §5's own
method):

- **Development-only reachability** — any future `encrypt()` would reuse
  the SAME six-condition `FedosWasmLoader` gate every prior Crypto API
  (`randomBytes()`, `generateAeadKey()`) already uses. Neither §1's key
  shape nor §3's ciphertext shape changes this gate's own conditions.
- **Production Fail Closed** — the same environment check that resolves
  `randomBytes()`/`generateAeadKey()` to `null` outside Development
  Runtime applies unchanged; nothing reviewed here is environment-aware.
- **Worker unconnected** — `src/worker.ts` is untouched by this Stage,
  confirmed by direct inspection (§9 below) and would remain so under
  EITHER candidate in §1 or §3 — a future `encrypt()` would be a new,
  separate `AppRuntime` field, exactly as `randomBytes`/`generateAeadKey`
  already are.
- **`initializeCrypto()` unchanged** — still `{ allowed: false,
  initialized: false, reason: "PrototypeDisabled" }`, confirmed by an
  ACTUAL call in this Stage's own guard test, not by inspection alone.
- **`runtimeCapabilities()` unchanged** — still exactly its Alpha 005
  four fields, confirmed by an ACTUAL call.
- **`randomBytes()` unchanged** — confirmed by an ACTUAL call.
- **`generateAeadKey()` unchanged** — confirmed by an ACTUAL call.

Every one of these guarantees is independent of which candidate in §1 or
§3 a future Stage eventually picks — the Fail-Closed gate lives entirely
in the Runtime Service / Rust Boundary reach layers (`FedosWasmLoader`),
which neither candidate requires touching.

## 6. `encrypt()` / `decrypt()` — same Phase or separate, revisited

Alpha 009 §6 already recommended separate Phases, `encrypt()` first. This
Stage's own findings do not change that recommendation, and sharpen the
reasoning:

- §1 and §3 together mean `encrypt()`'s OWN Phase must resolve, at
  minimum, the key-input shape (§1) before it can be implemented at all —
  `decrypt()` additionally needs the SAME two shapes to already be fixed
  by the time it is scoped, since `fedos_decrypt(key, envelope)` takes
  exactly the two types §1/§3 review. This is now, if anything, MORE
  clearly a case for `encrypt()` landing first: `decrypt()` cannot even be
  meaningfully drafted (let alone implemented) until whichever shapes
  `encrypt()`'s own Stage picks are real, working Rust Boundary types.
- The round-trip argument Alpha 009 §6 raised (an `encrypt()`-then-
  `decrypt()` test is the single most valuable guard for this pair) still
  favors reviewing them close together conceptually — which THIS
  document does, by covering both the key (§1) and ciphertext (§3)
  boundary in one place — while still implementing them as separate
  Stages.

**Recommendation, reaffirmed: separate Stages, `encrypt()` first.** No
new argument surfaced by this Stage favors merging them.

## 7. Recommendation for Alpha 012 — the minimal Encrypt Wrapper

Given §1 and §3 are BOTH still open, a full, faithful `encrypt()` (opaque
key handle in, opaque or serialized envelope out) is not yet a minimal
Alpha 012 candidate — it would require resolving two structurally-new
`#[wasm_bindgen]` opaque-class mechanisms in one Stage, a larger lift than
any prior Stage in this arc has taken at once.

**Recommended minimal Alpha 012 candidate:**

> `encrypt(keyBytes, algorithm, aadDomain, plaintext) -> Uint8Array | null`,
> where `keyBytes` matches `generateAeadKey()`'s OWN existing raw-bytes
> return shape (Candidate A, §1) — reconstructing a `FedosAeadKeyHandle`
> from caller-supplied bytes via ONE new, narrowly-scoped Rust
> constructor (mirroring this crate's established one-accessor/
> one-constructor-per-consumer convention) — and the return value packs
> the envelope's already-fixed fields into a single flat buffer using the
> simplest available framing (the "raw binary, fixed-offset" candidate
> named in `docs/ciphertext_envelope_serialization_plan.md` §3), NOT the
> canonical-JSON+base64url MVP that document's Stage 182 update decided
> for the crate's eventual real wire format (adopting THAT would need a
> new production dependency, forbidden for a "thin wrapper" Stage).

Reasoning:

- It keeps `encrypt()`'s FIRST implementation to exactly the same
  "raw-bytes, explicitly-labeled Alpha-limited stand-in, opaque class
  deferred" shape `generateAeadKey()` itself already used — the SAME
  precedent Alpha 010 set, applied consistently rather than introducing a
  brand-new mechanism (opaque classes) in the very Stage that also has to
  get plaintext/ciphertext framing right for the first time.
- It avoids answering §3's harder question (the crate's REAL, Stage
  182-decided wire format) by explicitly NOT attempting to satisfy it —
  a genuinely temporary, narrow framing exists only to make `encrypt()`
  end-to-end callable, and is named as such, not silently presented as
  the crate's real ciphertext format.
- It leaves BOTH the opaque-key-handle migration (§1 Candidate B) and the
  real serialization implementation (§3's `Uint8Array`/JSON rows) as
  later, separately-reviewed Stages — exactly the same "resolve the
  smaller open question first, defer the rest" discipline Alpha 009 used
  when it recommended Alpha 010 target key generation instead of
  `encrypt()` itself.

**This is a recommendation only. No implementation follows from it in
this Stage.** Whichever Stage acts on it must still review the
constructor-from-raw-bytes mechanics and the fixed-offset framing layout
on their own terms before writing any code — the same discipline every
prior Stage in this arc has followed.

## 8. Unresolved / open questions for future Stages

- **Key boundary (§1):** raw bytes vs. opaque handle — not decided. Note
  the real inconsistency flagged in §1: choosing the opaque-handle
  direction for `encrypt()` alone, without a follow-up migration of
  `generateAeadKey()`'s own return shape, leaves the Public API
  internally mismatched (a caller could not use `generateAeadKey()`'s
  output directly as `encrypt()`'s input). Whether that migration ever
  happens, and in which Stage, is not decided here.
- **encrypt() signature (§2):** four candidates compared, none chosen;
  the 4-arg faithful shape is the only one with no hidden policy default,
  but that alone does not make it the recommended candidate — see §7's
  narrower recommendation instead.
- **Ciphertext boundary (§3):** `Uint8Array` / Opaque Class / JSON — none
  chosen. The crate's own Stage 182 decision (canonical JSON + base64url)
  remains unimplemented; whether `encrypt()`'s eventual REAL (not
  Alpha-limited) shape ever adopts it, or whether an opaque class
  supersedes the need entirely, is unresolved.
- **Whether `decrypt()` ships in the SAME or a SEPARATE Stage from
  `encrypt()`** — reaffirmed separate (§6), not binding on a future Stage.
- **`importKey()`/`exportKey()` scoping** — still explicitly out of every
  review in this arc since Alpha 007.
- **Whether Alpha 012 (or whichever Stage implements `encrypt()`)
  actually adopts this Stage's §7 recommendation** — named as a
  recommendation, not a binding decision; a future Stage may find a
  different minimal candidate preferable upon its own review.

## 9. Confirmed unchanged (see also the guard test for this Stage)

- `AppRuntime.initializeCrypto()` — `{ allowed: false, initialized:
  false, reason: "PrototypeDisabled" }`, byte-for-byte, confirmed by an
  actual call.
- `AppRuntime.runtimeCapabilities()` — Alpha 005's four fields, byte-for-
  byte, confirmed by an actual call.
- `AppRuntime.randomBytes()` — confirmed by an actual call.
- `AppRuntime.generateAeadKey()` — confirmed by an actual call.
- `FedosWasmLoader`'s seven Plan interfaces — untouched.
- `src/worker.ts` — no reference to anything named in this document.
- `packages/fedos-core-rust/src/lib.rs` — still 30 `pub fn`, still
  exactly three `#[wasm_bindgen]` exports (`version`, `random_bytes_32`,
  `generate_aead_key_32`) — no fourth added by this Stage.
- `Cargo.toml`/`package.json` — no new dependency, no dependency count
  change (11 production / 2 dev-relevant Rust dependencies; 2 JS
  dependencies).
- `encrypt()`/`decrypt()` — neither is implemented anywhere in this
  Stage; `fedos_encrypt`/`fedos_decrypt` remain unreferenced by any
  Runtime file.

## 10. See also

- `docs/secure_runtime_alpha_007_crypto_api_surface_review.md` — the
  original Crypto API Surface review, §6's permanent "never expose raw
  key material" exclusion this Stage's §1 measures Candidate A against.
- `docs/secure_runtime_alpha_009_encrypt_api_surface_review.md` — this
  Stage's direct predecessor; §2–§4 of that document are the baseline
  §1–§4 here extend, not replace.
- `docs/secure_runtime_alpha_010_aead_key_generation.md` — the
  Alpha-limited raw-bytes precedent §1 Candidate A and §7's recommendation
  both build on.
- `docs/public_crypto_opaque_handles.md` — the permanent opaque-wrapper
  design for `FedosAeadKeyHandle`/`FedosCiphertextEnvelope` this Stage's
  §1/§3 "Opaque Class" candidates would extend into WASM if ever chosen.
- `docs/ciphertext_envelope_plan.md` / `docs/ciphertext_envelope_serialization_plan.md` —
  the in-memory field list and wire-format comparison §3/§7 draw on.
