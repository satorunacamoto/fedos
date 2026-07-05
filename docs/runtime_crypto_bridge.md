# Runtime crypto bridge planning (Stage 243) — docs only, no code

**Status: this document adds no code.** It fixes, in writing, the
CONNECTION POLICY a future stage would follow to wire the NIP-44 v2 wire
opaque API (`docs/public_nip44_wire_api.md`, Stage 241–242) into the
existing `CryptoProvider` seam (`src/crypto/types.ts`, Stage 34) —
BEFORE any such wiring exists. No Runtime code, no `CryptoProvider`
implementation, and no `packages/fedos-core-rust` call is added by this
document or by Stage 243.

## 1. What already exists (TypeScript side, unconnected)

`src/crypto/types.ts` (Stage 34) already defines a `CryptoProvider` seam
anticipating this exact connection:

- `CryptoCapability` already includes a `"nip44_placeholder"` label —
  "future NIP-44 payload encryption — not implemented here" (its own
  doc comment). This label has named the INTENT to connect NIP-44 since
  Stage 34, long before any real NIP-44 code existed.
- `src/runtime/types.ts`'s `RuntimeEnv.CRYPTO_PROVIDER`/
  `ENABLE_CRYPTO_PLACEHOLDER` already select between `NoopCryptoProvider`
  (permanently `unavailable`) and a `FedosCoreCryptoProvider` injected
  with a **permanently-inert** `PlaceholderFedosCoreCrypto` — "no real
  Rust/WASM core, no WASM loader" (that file's own doc comment). Building
  a runtime today loads no WASM, calls no `packages/fedos-core-rust`
  function, and runs no cryptography — this remains true after Stage
  241–244.

**Nothing above changes.** This document plans a FUTURE stage that would
eventually replace `PlaceholderFedosCoreCrypto` with a real bridge —
that stage does not exist yet.

## 2. The connection policy: three layers, one direction

```
Runtime (AppRuntime / CryptoProvider seam, TypeScript)
   │  calls ONLY the public opaque API — never anything below it
   ▼
Opaque API (docs/public_nip44_wire_api.md, Stage 241-242 — planning + label-only skeleton, not yet implemented)
   │  the ONLY boundary Runtime is ever allowed to see
   ▼
Internal Crypto (crypto::conversation_key / crypto::message_key / crypto::nip44_wire_encrypt / crypto::nip44_wire_decrypt, Stage 198-240 — complete, pub(crate)-only)
```

**Runtime never reaches past the opaque API layer.** This is the same
"select an adapter, never reach through it" discipline every other
`RuntimeEnv`-selectable boundary in this repository already follows
(`docs/runtime_diagnostics.md` §1 — "selected component TYPE LABELS
only", never the component's internals).

### Rule: Runtime touches NONE of these internal types, ever

Mirroring `docs/public_nip44_wire_api.md` §2's table exactly:

| Internal type | Runtime may... |
|---|---|
| `crypto::conversation_key::ConversationKey` | never construct, read, or name it. |
| `crypto::message_key::MessageKey` | never construct, read, or name it. |
| `crate::secret_handle::SecretHandle` | never construct, read, or name it. |
| `crypto::nip44_wire_payload::Nip44WirePayload` | never construct, read, or name it. |

A future `FedosCoreCryptoProvider` implementation would hold, at most, a
handle to a compiled WASM module (a WASM/FFI boundary decision not made
here — see `docs/fedos_core_wasm_safety.md` for this crate's existing
WASM safety notes) and call ONLY the future public opaque API functions
named in `docs/public_nip44_wire_api.md` §3 — never an internal type,
never a raw key byte, never a raw ciphertext byte.

## 3. Why this order (opt-in, not automatic)

Following `RuntimeEnv.ENABLE_CRYPTO_PLACEHOLDER`'s existing "explicit
opt-in, never automatic" pattern (`src/runtime/types.ts`), a future real
connection would need its OWN explicit opt-in flag, distinct from the
current placeholder flag — connecting a real Rust/WASM core is a
categorically bigger step than selecting the already-inert
`PlaceholderFedosCoreCrypto`, and deserves its own reviewed, named
stage (see `docs/nip44_wire_implementation_roadmap.md`'s Stage 249
candidate).

## 4. Explicit non-goals of this planning document

- **No WASM loading, no WASM/FFI boundary decision.** Whether a future
  bridge uses `wasm-bindgen`, a native Node addon, or something else is
  not decided here — a separate, future, explicitly-reviewed stage.
- **No `CryptoProvider` implementation change.** `PlaceholderFedosCoreCrypto`
  remains permanently inert; this document does not modify
  `src/crypto/`, `src/runtime/`, or any `.ts` file.
- **No `packages/fedos-core-rust` public API added** — see
  `docs/public_nip44_wire_api.md`; that remains planning + skeleton only.
- **No Worker/Storage/Relay connection** — this document is scoped to
  the Runtime↔crypto-core boundary only.
- **No new dependency of any kind** (npm or Cargo).

## See also

- `docs/public_nip44_wire_api.md` (Stage 241–242) — the opaque API
  boundary this document plans to connect Runtime to, once it exists.
- `docs/nostr_dm_bridge.md` (Stage 244) — the separate, also
  planning-only, Nostr DM publish/receive flow this same opaque API
  would eventually serve.
- `docs/runtime_diagnostics.md` — the existing "read-only inspection,
  never touch internals" discipline this plan's Runtime-side rule
  extends.
- `src/crypto/types.ts` / `src/runtime/types.ts` — the existing,
  UNCHANGED TypeScript seams this document describes but does not
  modify.
