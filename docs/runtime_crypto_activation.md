# Runtime crypto activation planning (Stage 262) — docs only, no code

**Status: this document adds no code.** It fixes, in writing, the five-layer
path a future stage would ACTIVATE a real `RuntimeCryptoProvider` through —
BEFORE any activation exists. No activation flag is flipped, no real
provider is registered, and no `packages/fedos-core-rust` call is added by
this document or by Stage 262.

## 1. The five layers

```
Runtime (AppRuntime.crypto, src/runtime/types.ts, Stage 260)
   │  selectRuntimeCryptoProvider() resolves ONLY via the Registry below
   ▼
Registry (RuntimeCryptoProviderRegistry, src/runtime/runtime_crypto_registry.ts, Stage 257)
   │  registers ONLY "placeholder" -> PlaceholderRuntimeCryptoProvider
   ▼
Opaque Provider (RuntimeCryptoProvider, src/runtime/crypto_provider.ts, Stage 249)
   │  the ONLY boundary Runtime is ever allowed to see
   ▼
FedOS (packages/fedos-core-rust's TS package boundary — src/index.ts,
       Stage 59; PlaceholderFedosCoreCrypto; its host adapter,
       src/crypto/fedos_core_adapter.ts)
   │  the existing, INERT, permanently-placeholder package boundary
   ▼
Crypto (crypto::conversation_key / crypto::nip44_wire_encrypt /
        crypto::nip44_wire_decrypt, Stage 198-240 — complete,
        pub(crate)-only Rust)
```

This refines `docs/runtime_worker_crypto_bridge.md` (Stage 252)'s four-layer
`Runtime → Opaque API → FedOS → Internal Crypto` path by naming the
REGISTRY explicitly as the resolution point between Runtime and the Opaque
Provider — the place a future ACTIVATION would register a real provider,
without `src/runtime/runtime_crypto_bridge.ts`'s (Stage 259) own resolution
logic ever needing to change.

## 2. What "activation" would mean (not done here)

A future, separate, explicitly-reviewed stage would need to, in order:

1. Register a real provider under a new name (e.g. `"fedos"`) via
   `RuntimeCryptoProviderRegistry.register()` — never replacing or removing
   the existing `"placeholder"` entry.
2. Flip `src/runtime/runtime_crypto_config.ts`'s `runtimeCryptoEnabled` from
   `false` to a REAL selection mechanism (e.g. an opt-in flag mirroring
   `RuntimeEnv.ENABLE_CRYPTO_PLACEHOLDER`'s existing "explicit opt-in, never
   automatic" pattern) — never simply flipping the constant in place without
   review, since `getRuntimeCryptoConfig()`'s whole point is being a single,
   auditable gate.
3. Update `buildRuntimeCryptoProvider()` (`src/runtime/runtime_crypto_bridge.ts`)
   to resolve the newly-registered name when `runtimeCryptoEnabled` is true
   — the ONLY line this document anticipates needing to change in that
   file.

**None of the three steps above happens in this document or Stage 262.**

## 3. Update — Stage 281–285: step 1 partially landed, step 2 still does NOT

Steps 1 and (half of) 2 from §2 above are now real code, but activation
STILL has not happened:

- **`"fedos"` IS now registered** (Stage 266) —
  `createDefaultRuntimeCryptoProviderRegistry()` registers both
  `"placeholder"` and `"fedos"` (`FedosRuntimeCryptoProvider`, Stage 265,
  itself still encrypt/decrypt-`Unsupported`).
- **`runtimeCryptoProvider` IS now selectable** (Stage 282) — via the
  `FEDOS_CRYPTO_PROVIDER` environment variable, parsed by
  `src/runtime/crypto_provider_env.ts`'s (Stage 281) shared
  `parseFedosCryptoProviderEnv`. Allowed values: **`"placeholder"`**
  (default) and **`"fedos"`** — nothing else, and specifically NOT any
  truthy-flag spelling (`"true"`/`"1"`/`"on"`/`"enabled"`) and NOT any
  dev-only variant name (`"fedos-dev-only"`, etc.); all of those resolve to
  `"placeholder"` exactly like an unset/empty value does.
- **`runtimeCryptoEnabled` is STILL fixed `false`** (Stage 258, unchanged)
  — step 2's OWN "flip the enable gate" half has NOT happened. Setting
  `FEDOS_CRYPTO_PROVIDER=fedos` records `runtimeCryptoProvider: "fedos"` in
  the config (visible as `configuredProvider` in
  `runtimeCryptoActivationStatus()`, Stage 285) but changes NOTHING about
  which provider `buildRuntimeCryptoProvider()` actually resolves — its
  `effectiveProvider` stays `"placeholder"`, because `runtimeCryptoEnabled
  && runtimeCryptoProvider === "fedos"` still requires the first,
  still-`false` flag.
- **Step 3 (bridge resolving the new name when enabled) already existed**
  since Stage 268 and needed no change for this update (Stage 284
  confirmed it still behaves correctly with an env-sourced
  `runtimeCryptoProvider`).

**`encrypt`/`decrypt` are still never executed anywhere** — setting the
env var only changes a recorded configuration value, never causes a real
cryptographic operation.

## 4. Explicit non-goals of this planning document

- **No activation.** `runtimeCryptoEnabled` stays `false`
  (`src/runtime/runtime_crypto_config.ts`, Stage 258) — this document does
  not modify it, and no `FEDOS_CRYPTO_PROVIDER` value can change it either
  (§3).
- **No Worker implementation.** `src/worker.ts` is not modified — see
  `docs/runtime_worker_crypto_bridge.md` §3 for the Worker's own,
  still-unbuilt role.
- **No `packages/fedos-core-rust` change** (Rust or TypeScript side).
- **No WASM/FFI** — see `docs/fedos_wasm_boundary.md` (Stage 253).
- **No new dependency of any kind** (npm or Cargo).

## See also

- `docs/runtime_crypto_bridge.md` (Stage 243) / `docs/runtime_worker_crypto_bridge.md`
  (Stage 252) — the three- and four-layer policies this document refines
  into five by naming the Registry explicitly.
- `docs/public_nip44_wire_api.md` (Stage 241–242) — the Opaque API layer a
  real provider would eventually call through.
- `src/runtime/runtime_crypto_registry.ts` (Stage 257) — the registry this
  document names as the future activation point.
- `src/runtime/runtime_crypto_config.ts` (Stage 258) — the fixed,
  `runtimeCryptoEnabled: false` gate this document does not flip.
