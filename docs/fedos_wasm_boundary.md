# FedOS WASM boundary planning (Stage 253) — docs only, no code

**Status: this document adds no code.** It fixes, in writing, the rule a
future WASM boundary MUST follow when (if) the NIP-44 v2 wire internal
crypto (`docs/nip44_wire_crypto_completion.md`) is ever compiled to WASM and
loaded via the existing `packages/fedos-core-rust/src/wasm_loader.ts` seam
(`docs/fedos_core_wasm_safety.md`, Stage 63) — BEFORE any real WASM module
exists. No WASM is compiled, loaded, or instantiated by this document or by
Stage 253.

## 1. The rule: only an Opaque Handle ever crosses the WASM boundary

Mirroring `docs/public_nip44_wire_api.md` §2's exact rule for the future
public Rust API, extended to the JS↔WASM boundary specifically:

**The only thing that may ever cross the WASM boundary (in either
direction) is an OPAQUE HANDLE — a non-sensitive label/reference the WASM
module resolves on its own side.** Never a raw secret byte, never an
internal Rust type marshalled directly.

| Internal type | Crosses the WASM boundary? |
|---|---|
| `crypto::conversation_key::ConversationKey` | **NEVER.** `SecretHandle`-backed; the whole point of its zeroize-on-drop, no-`Clone` design is that it never leaves Rust's own memory, let alone gets copied across a JS↔WASM marshalling boundary where garbage collection and structured-clone semantics could leak or duplicate it. |
| `crypto::message_key::MessageKey` | **NEVER.** Same reasoning. |
| `crate::secret_handle::SecretHandle` | **NEVER.** The crate-wide secret-lifetime primitive every key type is built on. |
| `crypto::nip44_wire_payload::Nip44WirePayload` | **NEVER as the internal struct.** Its `nonce`/`ciphertext`/`mac` fields must not be marshalled as a JS object with those field names — see §2. |

A future WASM boundary is allowed to cross a **base64 wire payload STRING**
(the already-encoded output of `crypto::nip44_wire_encoding::encode_wire_payload_internal`)
and an **opaque numeric/string handle** (e.g. an index into a Rust-side
registry the WASM module owns) — never the structured internal type itself.

## 2. Why this is a WASM-specific restatement, not a new rule

`docs/public_nip44_wire_api.md` §2 already forbade promoting any of the four
types above to `pub`. This document does not loosen or reinterpret that
rule for WASM — a `wasm-bindgen`-style boundary is, if anything, STRICTER:
`wasm-bindgen` can only marshal types it has explicit glue for, and writing
that glue for `ConversationKey`/`SecretHandle` would itself be the
prohibited "promote to public" step, just via a different door. This
document exists so that door is named and closed explicitly, not
overlooked because WASM has its own separate build/binding pipeline that a
future stage might approach without re-reading the opaque-handle rule.

## 3. What is explicitly NOT done by this document

- **No WASM module is compiled.** No `wasm-pack`, no `wasm-bindgen`
  attribute, no `.wasm` binary anywhere in this repository.
- **No `wasm_loader.ts` change.** `packages/fedos-core-rust/src/wasm_loader.ts`
  (Stage 63) remains exactly as inert as `docs/fedos_core_wasm_safety.md`
  already documents — "nothing loads automatically, nothing is fetched, and
  no cryptography runs until an audited core exists behind an explicit,
  disabled-by-default gate."
- **No FFI** of any other kind (native Node addon, etc.) — out of scope.
- **No Cargo.toml change** — no `wasm-bindgen`/`js-sys`/`web-sys` dependency
  is added.
- **No connection to Runtime/Worker/Storage/Relay** — see
  `docs/runtime_worker_crypto_bridge.md` (Stage 252) for that separate,
  also planning-only, four-layer path.

## See also

- `docs/public_nip44_wire_api.md` (Stage 241) — the opaque-handle-only rule
  this document restates specifically for the WASM boundary.
- `docs/fedos_core_wasm_safety.md` (Stage 63) — the existing WASM LOADER
  safety contract (nothing loads automatically) this document does not
  change.
- `docs/runtime_worker_crypto_bridge.md` (Stage 252) — the four-layer
  Runtime↔Internal-Crypto path this WASM boundary would sit inside, at the
  FedOS↔Internal-Crypto seam specifically.
- `packages/fedos-core-rust/src/wasm_loader.ts` — the existing, UNCHANGED
  loader seam this document describes but does not modify.
