# Secure Runtime Alpha 149 — Root Handle Verification

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 4 of the Alpha 146–150 Master Root
Derivation Foundation Arc, following Alpha 148's own Application Root
Derivation.**

## 1. Why now

Alpha 146–148 built the chain `Master Seed → Identity Root →
Application Root`. This Stage adds the ONE comparison operation
needed to verify the chain's own determinism and domain separation —
by Handle, never by raw secret byte.

## 2. What was implemented

```rust
pub(crate) fn matches_for_internal_verification(&self, other: &Self) -> bool
```

— added identically to both `FedosIdentityRootHandle` and
`FedosApplicationRootHandle`. Each:

1. Exposes both operands' own bytes via the SAME narrow accessor
   (`SecretHandle::expose_bytes_for_internal_derivation`) every other
   consumer in this crate already uses, into two transient local
   `[u8; 32]` arrays.
2. Compares them with `subtle::ConstantTimeEq` — this crate's own
   established constant-time-comparison discipline, already used in
   production by `crypto::nip44_hmac::verify_hmac_internal` (Stage
   194), now used for the FIRST time inside `lib.rs` itself.
3. Immediately zeroizes both transient arrays.
4. Returns ONLY a `bool` — never the bytes themselves.

## 3. Purity confirmed

- **No raw byte returned or logged:** the method signature returns
  `bool`; there is no code path by which either operand's own bytes
  escape the method body.
- **Constant-time:** `subtle::ConstantTimeEq::ct_eq` is used, not a
  plain `==`/`PartialEq` comparison — the same discipline
  `crypto::nip44_hmac::verify_hmac_internal` already established for
  MAC verification.
- **No `PartialEq`/`Eq` derive:** neither `FedosIdentityRootHandle`
  nor `FedosApplicationRootHandle` derives `PartialEq`/`Eq` — the ONLY
  way to compare two handles is this one, deliberate,
  narrowly-named method, mirroring `SecretHandle`'s own "no
  `Eq`/`PartialEq` over the payload" rule (Stage 144–146's own module
  doc comment) exactly.
- **`false` on a cleared handle:** if either side has been `clear()`-ed,
  the method returns `false` rather than panicking or exposing a stale
  value — there is no payload left to compare.

## 4. Verification confirmed (by real execution, not assertion)

- **Same Master Seed → same Identity Root, across two independent
  derivations:** confirmed via `matches_for_internal_verification`.
- **Same Identity Root → same Application Root, across two
  independent derivations:** confirmed via
  `matches_for_internal_verification`.
- **Different Master Seeds → different Identity Roots:** confirmed —
  `matches_for_internal_verification` returns `false`.
- **Different Identity Roots → different Application Roots:**
  confirmed — `matches_for_internal_verification` returns `false`,
  via Handle comparison, never raw byte comparison, at the assertion
  site itself.

## 5. What this Stage does NOT do

- Does **not** add a `PartialEq`/`Eq`/`Hash` derive to either Root
  Handle type.
- Does **not** add a public byte-exposing accessor of any kind.
- Does **not** add a `#[wasm_bindgen]`-annotated item of any kind.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.
- Does **not** generate a Nostr secret key, public key, `npub`, or
  signature, and does **not** contact a Relay.

## 6. See also

- `docs/secure_runtime_alpha_147_identity_root_derivation.md`
- `docs/secure_runtime_alpha_148_application_root_derivation.md`
- `docs/secret_memory_test_strategy.md`
