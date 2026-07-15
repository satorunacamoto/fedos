# Secure Runtime Alpha 423 — Signing Boundary Options Review

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind.** Stage 2 of the Alpha 422–430 Arc, Phase A.
Compares the six named options against Alpha 422's inventory and
adopts exactly one.

## 1. Option A — narrow WASM export wrapping the existing Rust pipeline

Wrap `derive_nostr_secret_key_internal` → `derive_nostr_public_key_internal`
→ `new_nostr_event_internal`/`derive_nostr_event_id_internal` →
`sign_nostr_event_internal` (all already implemented, Alpha 422 §2)
behind one or two new `#[wasm_bindgen]` items, following the
`AeadKeyHandle`/`AeadCiphertextHandle` precedent (Alpha 422 §4)
exactly: opaque wrapper, zero derives, no raw-byte getter.

- Secret exposure: none required — the precedent pattern never returns
  raw bytes.
- Duplication: zero — reuses every existing derivation/signing/serialization
  function verbatim.
- Deterministic recovery: yes — same account index + same upstream root
  → same key, matching the existing Rust-side determinism tests
  (Alpha 164, 184, 194).
- Desktop availability: yes, same runtime as every other WASM export.
- Browser availability: yes, same `--target web` build already used for
  AEAD.
- Testability: yes — Rust unit tests plus TS integration tests, same
  pattern as `test/fedos_core_rust_public_opaque_crypto_api.test.ts`.
- WASM compatibility: proven today by the AEAD precedent (Alpha 422 §4).
- Dependency impact: **zero** — `wasm-bindgen` and `k256`'s `schnorr`
  feature are both already production dependencies (Alpha 422 §5).
- API surface: smallest of any option that avoids raw-secret export.
- Account-index support: native — the existing derivation function
  already takes an account index parameter.
- Multi-protocol extensibility: the pattern generalizes to
  Session/ATProto/Wallet without new architecture.
- Operational complexity: none — no new process, no new transport.
- Signing-abuse / arbitrary-signing risk: bounded entirely by whatever
  input shape Alpha 424 selects — not a property of Option A itself.
- Host/Outbox compatibility: fully additive, touches neither.

**Blocked, not by Option A itself, but by the Alpha 422 §13 finding**:
no safe seed exists yet to feed the pipeline this option would wrap.
Carried into Alpha 427.

## 2. Option B — Desktop NIP-07 signer boundary

NIP-07 (`window.nostr`) is a **delegation-to-an-external-signer**
pattern: the private key lives in a separate browser extension or
companion app, never in this repository's own Rust runtime. Fedos's
own `src/sign/nip07.ts` (Alpha 422 §8) is genuinely key-material-free
by design — it has nothing to sign WITH, structurally, because it
delegates. Adopting it here would mean the Desktop's own outbound
Nostr identity is NOT the identity this repository's `master_root`
pipeline derives — it would be whatever key an entirely separate,
un-integrated piece of software happens to hold. That directly
contradicts the objective ("Desktop-owned outbound Nostr event
creation" using the already-built native pipeline). Also: no Desktop
wiring for it exists anywhere in this repository (confirmed, Alpha 422
§8), so adopting it would mean designing a second, unrelated
signing-delegation product surface mid-Arc — exactly what Alpha 421
already declined to improvise.

**Rejected.**

## 3. Option C — native Desktop bridge calling Rust directly

Bypasses WASM/browser entirely (a native binary + IPC/FFI bridge). No
such bridge exists anywhere in this repository today (confirmed, Alpha
422 §10 — not investigated further here since a from-scratch bridge is
categorically larger than "the smallest safe signing boundary"). It
would also drop Browser availability, which Option A retains for free,
and introduces a wholly new operational surface (a second binary, a new
IPC contract) with no existing precedent to build on, unlike Option
A's exact AEAD precedent.

**Rejected — categorically larger scope than justified; no existing
foundation to build on, unlike Option A.**

## 4. Option D — TypeScript signing via `@noble/curves`

Requires either duplicating the entire deterministic key-derivation
hierarchy (Master Seed → ... → Nostr Secret Key) in a second language,
or exporting real derived secret bytes out of Rust for TypeScript to
sign with directly. Both are named, absolute prohibitions of this Arc
("duplicating signing cryptography in TypeScript", "exporting raw
secret-key bytes"). `src/nostr/noble_signature.ts` is itself
documented, in its own header, as verify-only — "it never signs. No
private keys are involved" (confirmed again at Alpha 421 §3, reconfirmed
here). Confirms the Arc's own prediction that Option D would be
rejected.

**Rejected — forbidden by name.**

## 5. Option E — external signing daemon/service

A new standalone process/service holding key material outside both
Rust-in-WASM and the Desktop process, communicating over some new IPC
or network boundary. No such daemon exists, and none of Alpha 422's
inventory or Alpha 421's prior inventory found any existing scaffolding
for one. This is strictly MORE operational complexity than Option C
(itself already rejected as oversized) — a new deployable, a new trust
boundary, a new attack surface for key material to traverse, for no
benefit Option A does not already provide using infrastructure that
already exists and already ships (the WASM/AEAD pipeline).

**Rejected — disproportionate operational complexity, no existing
foundation.**

## 6. Option F — expose raw Nostr Secret Key bytes to TypeScript

Directly names the permanent Security Invariant this Arc must never
violate ("Secret bytes remain inside Rust Secure Runtime") and this
Arc's own Absolute Prohibitions ("raw Secret Key export", "nsec
export"). Confirms the Arc's own prediction that Option F would be
rejected.

**Rejected — forbidden by name.**

## 7. Decision

**Option A — a narrow WASM signing authority using existing Rust
internals — is adopted**, exactly as the Arc's own preferred
candidate predicted, on the strength of Alpha 422's inventory: the
crate already has a proven, tested precedent (`AeadKeyHandle`/`AeadCiphertextHandle`)
for exposing opaque secret-bearing handles across WASM with zero raw-byte
exposure, zero new dependency, and zero new Cargo feature.

Adopting Option A on paper does **not** resolve the Alpha 422 §13
finding — no safe Master Seed exists to construct the authority
against. That gap is scoped precisely at Alpha 424–426 (what the
authority signs, given SOME upstream root) and confronted directly at
Alpha 427 (whether the authority can actually be constructed today).

## 8. See also

- `docs/secure_runtime_alpha_422_nostr_signing_boundary_inventory.md`
- `docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md`
- `docs/secure_runtime_alpha_018_ciphertext_wire_export_import_api.md`
