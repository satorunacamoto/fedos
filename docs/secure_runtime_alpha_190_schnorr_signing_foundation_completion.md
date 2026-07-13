# Secure Runtime Alpha 190 — Nostr Schnorr Signing Foundation Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
181–190 Nostr Schnorr Signing Foundation Arc.**

## 1. Why now

Alpha 181 inventoried and enabled k256's own `schnorr` feature; Alpha
182/183 implemented the Opaque Handle and the signing function; Alpha
184 verified determinism/separation/Fail-Closed by real execution;
Alpha 185–189 reviewed the Boundary, Interoperability, future Event
Builder fit, Session/ATProto extensibility, and Runtime exposure, in
that order. This Stage issues the Arc's own closing Completion
Declaration and recommends exactly one next Arc.

## 2. The Foundation, confirmed complete

```rust
FedosNostrSecretKeyHandle (Alpha 163/164, UNCHANGED this Arc)
        │  expose_bytes_for_internal_signing()      (Alpha 183)
        │  derive_nostr_signature_internal()          (Alpha 183)
        │      via k256::schnorr::SigningKey::from_bytes  (Alpha 181)
        │      via k256::schnorr::PrehashSigner::sign_prehash  (Alpha 181)
        ↓
FedosNostrSignatureHandle                                (Alpha 182)
        — Opaque: no Clone, no Debug, no Serialize,
          no wasm_bindgen, no raw byte export

-- proven consistent with the pre-existing, UNCHANGED public key chain --

FedosNostrPublicKeyHandle (Alpha 168/169, UNCHANGED this Arc)
        ↓  cross-verified against FedosNostrSignatureHandle (Alpha 186)
        via k256::schnorr::VerifyingKey::verify_prehash — Ok() (Alpha 184 §2.5)
```

Zero new cryptographic algorithm: BIP-340 Schnorr-over-secp256k1 is a
fixed, public specification, implemented by RustCrypto's own audited
`k256::schnorr` module (Alpha 181), never hand-written by this crate.
Zero new Cargo DEPENDENCY (Alpha 181 §5: one Cargo FEATURE FLAG on the
already-present `k256` line, zero new `[dependencies]` entry). Zero
new npm dependency.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. A Nostr Schnorr
Signature can now be deterministically derived from the existing
`FedosNostrSecretKeyHandle`, entirely `pub(crate)`, via a dedicated,
minimally-scoped signing function (`derive_nostr_signature_internal`)
and Opaque output Handle (`FedosNostrSignatureHandle`), with ZERO new
Cargo dependency, ZERO new npm dependency, ZERO new cryptographic
algorithm, ZERO manual signing implementation, ZERO new
`#[wasm_bindgen]` export (fixed at 13), ZERO new `pub fn` (fixed at
36), ZERO Desktop access, and ZERO Runtime/Worker/Storage/Observation
exposure, verified by real execution (Alpha 184) rather than assumed
from reading source alone.**

**The following do NOT exist yet, exactly as this Arc's own Objective
requires:**

- **`nsec`** — no bech32 secret-key encoding exists (unchanged from
  Alpha 175 §5).
- **A hex/base64 Encoder for the 64-byte signature** — confirmed
  absent, named as a future need, not built (Alpha 187 §4 item 1).
- **Nostr Event construction or serialization** — `computeEventId`
  remains TypeScript-only and unrelated; no Rust-side event assembly
  exists (Alpha 187 §4 items 2/3).
- **Relay communication** — no WebSocket/Relay connection exists.
- **A public Runtime API for signing** — `FedosNostrSignatureHandle`/
  `derive_nostr_signature_internal` are `pub(crate)` only, unreachable
  from `AppRuntime`/`types.ts`/Desktop (Alpha 189, confirmed by direct
  inspection of all five candidate files).
- **Session/ATProto/Wallet signing of any kind** — `SecretHandleKind`
  gained zero new variant; no `ed25519`/`p256`/second elliptic-curve
  crate exists; `k256`'s own `"ecdsa"` feature remains excluded (Alpha
  188).

**Next Arc recommendation — ONE candidate, chosen from this Arc's own
Inventory:** **Nostr Signature Encoding & Event Assembly Boundary
Review.** Alpha 187's own gap analysis (§4) found FOUR concrete,
named prerequisites before any Event could ever be published — a hex
Encoder for the 64-byte signature (the SAME shape decision the
Identifier Runtime Boundary Arc, Alpha 176–180, already worked through
once for the 32-byte public key), Rust-side event serialization,
an event-field assembly API, and eventually a Public Runtime API. The
NEXT natural, LOWER-RISK step is reviewing and deciding THAT boundary
— mirroring exactly how Alpha 175 recommended the Identifier Runtime
Boundary Arc before Signing, and this Arc recommends the SAME kind of
Boundary-first sequencing now, one layer further out: Relay/publishing
remains explicitly OUT of scope for that next Arc too, exactly as it
was out of scope here.

## 4. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` beyond
  what Alpha 182/183/184 already landed in the same file edit — no
  further production code change.
- Does **not** wire a signature Encoder, Event Builder, or Public
  Runtime API of any kind — §3's own "does NOT exist yet" list is a
  finding, not an implementation.
- Does **not** implement `nsec`, Relay communication, or a Decoder.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `src/nostr/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, any Protocol Adapter, `Cargo.toml` (beyond Alpha 181's
  own already-landed feature-flag change), or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_189_signing_runtime_boundary_review.md`
- `docs/secure_runtime_alpha_188_session_atproto_signing_extensibility_review.md`
- `docs/secure_runtime_alpha_187_event_builder_compatibility_review.md`
- `docs/secure_runtime_alpha_186_public_key_interoperability_review.md`
- `docs/secure_runtime_alpha_185_signature_boundary_review.md`
- `docs/secure_runtime_alpha_184_signature_determinism_verification.md`
- `docs/secure_runtime_alpha_183_derive_nostr_signature_internal.md`
- `docs/secure_runtime_alpha_182_nostr_signature_handle.md`
- `docs/secure_runtime_alpha_181_k256_schnorr_api_inventory.md`
- `docs/secure_runtime_alpha_180_nostr_public_identifier_runtime_boundary_completion.md`
