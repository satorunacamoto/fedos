# Runtime/Worker crypto bridge planning (Stage 252) — docs only, no code

**Status: this document adds no code.** It fixes, in writing, the FOUR-LAYER
path a future stage would connect the Worker-facing Runtime to the NIP-44 v2
wire internal crypto through — BEFORE any such connection exists. No Worker
implementation, no Runtime wiring, and no `packages/fedos-core-rust` call is
added by this document or by Stage 252.

## 1. The four layers

```
Runtime (AppRuntime / RuntimeCryptoProvider, src/runtime/, Stage 249-251)
   │  calls ONLY the future public Opaque API — never anything below it
   ▼
Opaque API (docs/public_nip44_wire_api.md, Stage 241-242 — planning + label-only Rust skeleton, not yet implemented)
   │  the ONLY boundary Runtime is ever allowed to see
   ▼
FedOS (packages/fedos-core-rust's TS package boundary — src/index.ts,
       Stage 59; PlaceholderFedosCoreCrypto; and its host adapter,
       src/crypto/fedos_core_adapter.ts, Stage 59)
   │  the existing, INERT, permanently-placeholder package boundary
   ▼
Internal Crypto (crypto::conversation_key / crypto::message_key /
                 crypto::nip44_wire_encrypt / crypto::nip44_wire_decrypt,
                 Stage 198-240 — complete, pub(crate)-only Rust)
```

This extends `docs/runtime_crypto_bridge.md` (Stage 243)'s three-layer
`Runtime → Opaque API → Internal Crypto` policy by naming the FOURTH layer
explicitly: **"FedOS"**, the ALREADY-EXISTING TypeScript package boundary
(`packages/fedos-core-rust/src/index.ts`/`types.ts`/`wasm_loader.ts`, Stage
59–65) that sits between a future Opaque API and the Rust crate's internal
crypto. This layer is NOT new — it already exists, and is already
permanently inert (`PlaceholderFedosCoreCrypto`, "no real Rust/WASM core, no
WASM loader" per its own doc comment) — this document only NAMES its place
in the four-layer chain.

## 2. What is planned, not built

- **Runtime** (`src/runtime/crypto_provider.ts`, Stage 249) is a NEW,
  Runtime-facing seam, `PlaceholderRuntimeCryptoProvider`-only — never wired
  into `AppRuntime`/`createRuntime`/the Worker.
- **Opaque API** does not exist yet — `docs/public_nip44_wire_api.md` plans
  it; `crypto::nip44_public_api` (Stage 242) is a label-only `pub(crate)`
  Rust skeleton.
- **FedOS** already exists as an inert package boundary (Stage 59) — this
  document does not modify it. A future Opaque API would need its own
  bridge INTO this layer (e.g. a new export on `packages/fedos-core-rust/src/index.ts`),
  not decided here.
- **Internal Crypto** is complete and vector-verified (`docs/nip44_wire_crypto_completion.md`)
  but entirely `pub(crate)`-only — unreachable from TypeScript at all today.

## 3. Worker's role: none, yet

`src/worker.ts` currently constructs no `FedosCoreCryptoProvider` and calls
no crypto operation (`test/fedos_core_adapter.test.ts`'s own guard #13
already proves this). A future connection stage would need the Worker to:

- select a real `RuntimeCryptoProvider` implementation (mirroring how
  `RuntimeEnv.CRYPTO_PROVIDER`/`ENABLE_CRYPTO_PLACEHOLDER` already select
  between `NoopCryptoProvider`/`FedosCoreCryptoProvider` today), behind its
  OWN explicit opt-in flag, distinct from the existing crypto-provider flag;
  and
- still never reach past the Opaque API layer to touch `ConversationKey`/
  `MessageKey`/`SecretHandle`/`Nip44WirePayload` directly.

**No Worker code is added or changed by this document.**

## 4. Explicit non-goals of this planning document

- **No Worker implementation.** `src/worker.ts` is not modified.
- **No Runtime wiring.** `src/runtime/crypto_provider.ts` (Stage 249) stays
  unreferenced by `AppRuntime`/`createRuntime`.
- **No `packages/fedos-core-rust` change** (Rust or TypeScript side).
- **No WASM/FFI** — see `docs/fedos_wasm_boundary.md` (Stage 253) for the
  separate, also planning-only, WASM boundary rule.
- **No new dependency of any kind** (npm or Cargo).

## See also

- `docs/runtime_crypto_bridge.md` (Stage 243) — the three-layer policy this
  document extends to four.
- `docs/public_nip44_wire_api.md` (Stage 241–242) — the Opaque API layer.
- `docs/fedos_wasm_boundary.md` (Stage 253) — the opaque-handle-only rule
  applied specifically to a future WASM boundary.
- `docs/nostr_dm_bridge.md` (Stage 244) — the separate, also planning-only,
  Nostr DM flow this same Opaque API would eventually also serve.
- `test/fedos_core_adapter.test.ts` — the existing proof that Runtime
  selects a FedOS provider but wires no real core/WASM loader and calls no
  crypto operation.
