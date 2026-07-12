# Secure Runtime Alpha 154 — Protocol Separation Verification

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 4 of the Alpha 151–155 Protocol Root
Derivation Arc, following Alpha 153's own Session/ATProto/Wallet Root.**

## 1. Why now

Alpha 151–153 built four Protocol Root derivations — Nostr/Session/
ATProto/Wallet — all sharing one opaque `FedosProtocolRootHandle`
type. This Stage adds the ONE comparison operation needed to verify
the whole set's own determinism and domain separation — by Handle,
never by raw secret byte, mirroring Alpha 149's own precedent exactly.

## 2. What was implemented

```rust
pub(crate) fn matches_for_internal_verification(&self, other: &Self) -> bool
```

— added to `FedosProtocolRootHandle`, identical in shape to
`FedosIdentityRootHandle`/`FedosApplicationRootHandle`'s own methods
(Stage 1015, Alpha 149): exposes both operands' own bytes via the same
narrow accessor every other consumer in this crate already uses,
compares them with `subtle::ConstantTimeEq`, immediately zeroizes both
transient arrays, and returns ONLY a `bool`. Comparing two roots
derived under DIFFERENT `HkdfDomain` variants (e.g. a Nostr Root
against a Session Root) is a well-defined call, not a type error — it
simply returns `false`, since domain-separated HKDF output never
collides.

## 3. Purity confirmed

- **No raw byte returned or logged:** the method signature returns
  `bool`.
- **Constant-time:** `subtle::ConstantTimeEq::ct_eq` is used, not a
  plain `==`/`PartialEq` comparison.
- **No `PartialEq`/`Eq` derive:** `FedosProtocolRootHandle` derives
  neither — the ONLY way to compare two handles is this one, narrowly
  named method.
- **`false` on a cleared handle:** if either side has been
  `clear()`-ed, the method returns `false` rather than panicking or
  exposing a stale value.

## 4. Verification confirmed (by real execution, not assertion)

Every assertion below compares exclusively via
`matches_for_internal_verification` — never a raw secret byte
comparison — per this Arc's own explicit requirement.

- **Same Master Seed → same protocol domain → same Root:** building
  two independent `Master Seed → Identity Root → Application Root →
  Protocol Root` chains from the SAME Master Seed bytes, for all four
  protocol domains, yields matching Roots every time.
- **Different protocol domains → different Root, always:** deriving
  all four Protocol Roots (Nostr/Session/ATProto/Wallet) from the SAME
  Application Root and comparing every pairwise combination (six
  pairs) confirms none match.
- **Same Root re-derived twice → matches exactly:** deriving the same
  Protocol Root twice from the same Application Root, and comparing
  via Handle, confirms an exact match.
- **Different Application Roots → non-matching Protocol Roots for the
  SAME domain:** two different Application Roots (stemming from two
  different Master Seeds) each deriving a Nostr Root yields two
  non-matching Roots.

## 5. What this Stage does NOT do

- Does **not** add a `PartialEq`/`Eq`/`Hash` derive to
  `FedosProtocolRootHandle`.
- Does **not** add a public byte-exposing accessor of any kind.
- Does **not** add a WASM-export attribute (wasm_bindgen) of any kind.
- Does **not** add a new Protocol Root domain or derivation function —
  the four from Alpha 152/153 remain the complete set this Arc names.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_152_nostr_root_derivation.md`
- `docs/secure_runtime_alpha_153_session_atproto_wallet_root.md`
- `docs/secure_runtime_alpha_149_root_handle_verification.md`
