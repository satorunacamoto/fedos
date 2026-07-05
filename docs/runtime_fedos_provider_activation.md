# Runtime FedOS provider activation planning (Stage 270) — docs only, no code

**Status: this document adds no code.** It fixes, in writing, the ORDER a
future stage would activate a real FedOS-backed `RuntimeCryptoProvider`
through — BEFORE any activation exists. No flag is flipped, no Worker code
is added, and no `packages/fedos-core-rust` call is added by this document
or by Stage 270.

## 1. The order

```
Placeholder (PlaceholderRuntimeCryptoProvider, src/runtime/crypto_provider.ts, Stage 249 — the permanent safe default)
   ↓
FedOS Provider (FedosRuntimeCryptoProvider, src/runtime/fedos_runtime_crypto_provider.ts, Stage 265 —
                registered as "fedos" in the Registry, Stage 266; still encrypt/decrypt-Unsupported today)
   ↓
Worker (src/worker.ts — NOT modified by Stage 257-272; would need to
        surface/gate the runtimeCryptoEnabled/runtimeCryptoProvider opt-in somehow)
   ↓
Runtime (AppRuntime.crypto, src/runtime/create_runtime.ts, Stage 260 —
         already wired, but selects Placeholder because
         runtimeCryptoEnabled is permanently false, Stage 258)
   ↓
Nostr (docs/nostr_dm_bridge.md — the eventual DM publish/receive
       consumer of a real, encrypt/decrypt-capable provider)
```

This is an ORDERING statement only — it does not itself change which layer
runs before which at execution time (`createRuntime()` already assembles
`AppRuntime.crypto` today; this order describes the sequence a human
reviewer/activation stage would work through, not a runtime call chain).

## 2. What each step still requires (none done here)

1. **Placeholder → FedOS Provider**: already possible today at the type
   level (`FedosRuntimeCryptoProvider` exists, `"fedos"` is registered) —
   and, as of Stage 281–282, `runtimeCryptoProvider` IS now a real,
   env-driven selection: setting `FEDOS_CRYPTO_PROVIDER=fedos` (parsed by
   `src/runtime/crypto_provider_env.ts`'s `parseFedosCryptoProviderEnv` —
   allowed values `"placeholder"`/`"fedos"` ONLY; truthy-flag spellings
   like `"true"`/`"1"`/`"on"`/`"enabled"` are NOT recognized and fall back
   to `"placeholder"`) makes `getRuntimeCryptoConfig()` report
   `runtimeCryptoProvider: "fedos"`. **This still does not activate
   anything**: `runtimeCryptoEnabled` stays fixed `false`
   (`src/runtime/runtime_crypto_config.ts`, Stage 258, unchanged), so
   `src/runtime/runtime_crypto_bridge.ts`'s two-flag gate
   (`runtimeCryptoEnabled && runtimeCryptoProvider === "fedos"`) still
   never passes — `FEDOS_CRYPTO_PROVIDER=fedos` is recorded as the
   `configuredProvider` (`runtimeCryptoActivationStatus()`, Stage 285) but
   the `effectiveProvider` stays `"placeholder"`. A future stage would
   still need to turn `runtimeCryptoEnabled` itself into a real,
   explicitly-reviewed selection (mirroring `RuntimeEnv.CRYPTO_PROVIDER`/
   `ENABLE_CRYPTO_PLACEHOLDER`'s existing pattern) — not done here.
2. **FedOS Provider → Worker**: `FedosRuntimeCryptoProvider.encrypt()`/
   `decrypt()` still always resolve to `"Unsupported"` (Stage 265) — before
   the Worker could usefully depend on this provider, a future,
   SEPARATE, explicitly-reviewed stage would need to give it a real
   implementation (calling through the still-unbuilt public opaque API,
   `docs/public_nip44_wire_api.md`) — not attempted here.
3. **Worker → Runtime**: `src/worker.ts` does not reference
   `RuntimeCryptoProviderRegistry`/`runtime_crypto_config`/
   `runtime_crypto_bridge` at all today — a future stage would need to
   decide how (or whether) the opt-in flag is exposed at the Worker/env
   layer, mirroring every other `RuntimeEnv`-selectable boundary's
   existing "explicit opt-in, never automatic" convention.
4. **Runtime → Nostr**: only once a real, non-`"Unsupported"` provider
   exists AND the Worker can select it does connecting it to
   `docs/nostr_dm_bridge.md`'s publish/receive flow become meaningful —
   that document's own activation is a separate, later stage (Stage 258
   in that document's own numbering, i.e. the roadmap's Stage 258/259
   candidates as renumbered in `docs/nip44_wire_implementation_roadmap.md`).

## 3. Explicit non-goals of this planning document

- **No `runtimeCryptoEnabled` flip.** It stays fixed `false`
  (`src/runtime/runtime_crypto_config.ts`) regardless of
  `FEDOS_CRYPTO_PROVIDER`. (`runtimeCryptoProvider` itself IS now
  env-selectable as of Stage 281–282 — see §2 step 1 above — but that
  alone changes no executable behavior.)
- **No Worker implementation or env exposure.** `src/worker.ts` is not
  modified.
- **No real FedOS core call.** `FedosRuntimeCryptoProvider.encrypt()`/
  `decrypt()` are not implemented here.
- **No WASM/FFI** — see `docs/fedos_wasm_boundary.md` (Stage 253).
- **No Relay/NIP-17 connection** — see `docs/nostr_dm_bridge.md` (Stage
  244).
- **No new dependency of any kind** (npm or Cargo).

## See also

- `docs/runtime_crypto_activation.md` (Stage 262) — the five-layer
  Registry-centric activation path this document sequences into an
  explicit order.
- `docs/runtime_worker_crypto_bridge.md` (Stage 252) — the four-layer
  Runtime↔Internal-Crypto path this document's "FedOS Provider → Worker"
  step connects into.
- `src/runtime/fedos_runtime_crypto_provider.ts` (Stage 265) — the
  still-non-operational provider this document names as step two.
- `src/runtime/runtime_crypto_config.ts` (Stage 258/267/282) —
  `runtimeCryptoProvider` is now env-driven; `runtimeCryptoEnabled` is the
  one flag this document's step one still needs turned into a real
  selection.
- `src/runtime/crypto_provider_env.ts` (Stage 281) — the shared
  `FEDOS_CRYPTO_PROVIDER` parser both Runtime and Worker configs use.
