# Secure Runtime Alpha 189 — Signing Runtime Boundary Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 9 of the Alpha 181–190 Nostr Schnorr Signing Foundation Arc,
following Alpha 188's own Session/ATProto Extensibility Review.**

## 1. Why now

This Arc's own instruction states plainly: "No Runtime/Desktop/Worker
integration yet." Before Alpha 190 closes the Arc, this Stage confirms
that instruction was honored throughout — by direct inspection of
every file this Arc could have touched but did not, not by re-citing
each prior Stage's own "What this Stage does NOT do" section alone.

## 2. The boundary, confirmed unchanged

`derive_nostr_signature_internal` and `FedosNostrSignatureHandle`
(Alpha 182/183) are both `pub(crate)` — the SAME visibility every
prior Nostr key-material type in `master_root` already carries
(`FedosNostrSecretKeyHandle`, `FedosNostrPublicKeyHandle`,
`FedosNostrPublicKeyHex`, `FedosNostrNpub`). Neither carries a
`#[wasm_bindgen]` attribute. Rust's own privacy rules make both
UNREACHABLE from outside `packages/fedos-core-rust/src/` by
construction — not merely by convention this Stage merely observes,
but by what the compiler itself enforces.

## 3. `AppRuntime`/`create_runtime.ts`/`types.ts`/`worker.ts` — zero
   reference, confirmed by direct inspection

- `src/runtime/create_runtime.ts`: zero reference to `signature`,
  `sign`, `schnorr`, or any of this Arc's own five new symbols
  (`FedosNostrSignatureHandle`, `derive_nostr_signature_internal`,
  `expose_bytes_for_internal_signing`, `SchnorrSigningKey`,
  `PrehashSigner`).
- `src/runtime/types.ts`: same — zero reference.
- `src/worker.ts`: same — zero reference.
- `AppRuntime`'s own public method set (wherever declared/implemented
  across `src/runtime/*`): unchanged — no new method of any kind was
  added by this Arc.

## 4. Desktop — zero reference, confirmed by direct inspection

- `src/desktop/desktop_application.ts`: unchanged from Alpha 180's own
  closing state (Alpha 180 §7 item 18's own byte-for-byte public
  method/field assertion — this Stage reconfirms it, §6 below) — no
  new method, no new import, no reference to signing of any kind.
- `src/desktop/create_desktop_application.ts`: same — zero reference.
- No OTHER `src/desktop/*` file references signing either.

## 5. Worker, Storage, Observation — all three confirmed untouched

- `src/worker.ts`: zero reference (§3 above, restated for completeness
  against this Stage's own three-name list).
- Storage: no `storeCiphertext()`/`loadCiphertext()`/
  `deleteCiphertext()`/`RuntimeStorageBackend` reference anywhere in
  this Arc's own five `lib.rs` additions (Alpha 182/183/184).
- Observation: no event-emission, no logging call, no diagnostic
  surface of any kind was added by this Arc — `FedosNostrSignatureHandle`
  itself carries no `Debug` (Alpha 182 §3), so it could not be logged
  even if some future code mistakenly tried.

## 6. Structural confirmation (real inspection, this Stage)

- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged across
  the whole Arc (Alpha 181 through this Stage).
- `pub fn` count in `lib.rs`: fixed at 36, unchanged.
- `DesktopApplication`'s own public method/field set: byte-for-byte
  identical to Alpha 180's own closing state (`bootstrap`, `start`,
  `currentIdentity`, `isBootstrapped`, `readPublicIdentity`,
  `currentPublicIdentity`, `refreshPublicIdentity`; fields `identity`,
  `reader`, `publicIdentity`, `started`, `currentPublicIdentity`).
- `grep`, case-sensitive, for `derive_nostr_signature_internal`,
  `FedosNostrSignatureHandle`, `expose_bytes_for_internal_signing`,
  `SchnorrSigningKey`, and `PrehashSigner` across
  `src/runtime/create_runtime.ts`, `src/runtime/types.ts`,
  `src/worker.ts`, `src/desktop/desktop_application.ts`, and
  `src/desktop/create_desktop_application.ts`: zero matches, all five
  symbols, all five files.

## 7. Why this matters before Alpha 190 closes the Arc

A Runtime Boundary reviewed and found EMPTY (rather than reviewed and
found "mostly empty, with one exception") is the strongest possible
starting point for whatever future Arc eventually DOES wire signing
into `AppRuntime` — that future Stage inherits a completely clean
slate, with no ad hoc exception to first unwind. This mirrors exactly
the finding Alpha 176 made for the Identifier layer before ITS OWN
Runtime Boundary Arc (176–180) froze anything: confirm current state
matches the "no drift" bar before declaring anything frozen.

## 8. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** build a Public Runtime API for signing — that remains a
  distinct, future, explicitly out-of-scope Stage.
- Does **not** wire `FedosNostrSignatureHandle` into `AppRuntime`,
  `DesktopApplication`, or any Reader/Provider/Source type.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 9. See also

- `docs/secure_runtime_alpha_188_session_atproto_signing_extensibility_review.md`
- `docs/secure_runtime_alpha_185_signature_boundary_review.md`
- `docs/secure_runtime_alpha_180_nostr_public_identifier_runtime_boundary_completion.md`
- `docs/secure_runtime_alpha_176_nostr_public_identifier_origin_review.md`
