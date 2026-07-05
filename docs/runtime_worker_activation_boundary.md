# Runtime ⇔ Worker activation boundary review (Stage 276) — docs only, no code

**Status: this document adds no code.** It fixes, in writing, the ordering
a future stage would review before ever connecting `src/worker.ts` to the
Worker crypto boundary (`src/runtime/worker_crypto_config.ts`/
`worker_crypto_registry.ts`/`worker_crypto_bridge.ts`, Stage 273–275) —
BEFORE any such connection exists. No Worker code is added, no flag is
flipped, and no `packages/fedos-core-rust` call is added by this document
or by Stage 276.

## 1. The order

```
Runtime (AppRuntime.crypto, src/runtime/create_runtime.ts, Stage 260 —
         already wired, selects PlaceholderRuntimeCryptoProvider because
         runtimeCryptoEnabled is permanently false)
   ↓
Worker Bridge (buildWorkerCryptoProvider, src/runtime/worker_crypto_bridge.ts,
               Stage 275 — NOT called by src/worker.ts; exists but unreachable
               from the Worker today)
   ↓
FedOS Provider (FedosRuntimeCryptoProvider, src/runtime/fedos_runtime_crypto_provider.ts,
                Stage 265 — reachable via either registry, still
                encrypt/decrypt-Unsupported)
   ↓
FedOS Core (packages/fedos-core-rust's TS package boundary — src/index.ts,
            Stage 59; PlaceholderFedosCoreCrypto)
   ↓
Crypto (crypto::conversation_key / crypto::nip44_wire_encrypt /
        crypto::nip44_wire_decrypt, Stage 198-240 — complete,
        pub(crate)-only Rust)
```

This is an ORDERING/REVIEW statement only — it does not itself connect any
layer to the one above or below it. `src/worker.ts` does not import
`worker_crypto_bridge.ts` (or `worker_crypto_config.ts`/
`worker_crypto_registry.ts`) today, and this document does not change that.

## 2. Why Runtime and Worker each get their OWN config/registry/bridge

Mirroring `docs/runtime_crypto_activation.md` (Stage 262) and
`docs/runtime_fedos_provider_activation.md` (Stage 270)'s own "separate
knob per boundary" discipline: `RuntimeCryptoConfig`
(`runtimeCryptoEnabled`/`runtimeCryptoProvider`) and `WorkerCryptoConfig`
(`workerCryptoEnabled`/`workerCryptoProvider`) are two INDEPENDENT pairs of
fixed constants. Flipping one (hypothetically, in a future stage) would
not flip the other. Likewise, `createDefaultRuntimeCryptoProviderRegistry()`
and `createDefaultWorkerCryptoProviderRegistry()` build two SEPARATE
`RuntimeCryptoProviderRegistry` instances — Runtime never reaches into
Worker's registry, and Worker never reaches into Runtime's. This lets a
future stage activate Worker's opt-in independently of Runtime's (or vice
versa) without the two interfering.

Both configs/registries happen to reuse the SAME provider types
(`PlaceholderRuntimeCryptoProvider`/`FedosRuntimeCryptoProvider`,
`RuntimeCryptoProvider` interface) — a provider's own shape does not
differ depending on which boundary selected it, so no separate provider
type was needed for the Worker side (unlike, say, `RuntimeCryptoCapability`
needing its own type distinct from `CryptoCapability`, where the underlying
CONCEPT genuinely differed).

## 3. Update — Stage 281–285: `workerCryptoProvider` IS now env-selectable

`workerCryptoProvider` (`src/runtime/worker_crypto_config.ts`) now reads
the SAME `FEDOS_CRYPTO_PROVIDER` env var Runtime reads
(`src/runtime/crypto_provider_env.ts`'s shared `parseFedosCryptoProviderEnv`,
Stage 281), via an OPTIONAL `env` parameter on `getWorkerCryptoConfig`
(Stage 283) — but `src/worker.ts` still passes nothing to it, since it
still does not import `worker_crypto_config.ts`/`worker_crypto_bridge.ts`
at all (§1). `workerCryptoEnabled` is STILL fixed `false`, so even a
future stage that wired a real Worker env through would still see
`buildWorkerCryptoProvider()`'s `effectiveProvider` stay `"placeholder"`
(`workerCryptoActivationStatus()`, Stage 285, reports both
`configuredProvider` and `effectiveProvider` separately for exactly this
reason).

## 4. What a future connection stage would still need to decide

- **Whether the Worker even needs its own opt-in at all**, versus simply
  reading `AppRuntime.crypto` (already assembled by `createRuntime()`,
  Stage 260) — not decided here.
- **How `workerCryptoEnabled` would ever become selectable** — an
  env-driven flag (mirroring `RuntimeEnv.CRYPTO_PROVIDER`), a build-time
  flag, or something else — not decided here. (`workerCryptoProvider`
  itself already reads `FEDOS_CRYPTO_PROVIDER` as of Stage 283 — see §3 —
  but that alone activates nothing.)
- **Whether `FedosRuntimeCryptoProvider` ever gets a real, non-`"Unsupported"`
  implementation**, and through which layer (the still-unbuilt public
  opaque API, `docs/public_nip44_wire_api.md`) — a separate, later stage.

## 5. Explicit non-goals of this planning document

- **No Worker implementation or import.** `src/worker.ts` is not modified
  and does not reference any of Stage 273–275/281–285's new files.
- **No `workerCryptoEnabled` flip.** It stays fixed `false`
  (`src/runtime/worker_crypto_config.ts`) regardless of
  `FEDOS_CRYPTO_PROVIDER`.
- **No Relay/Storage connection.**
- **No real FedOS core call.**
- **No WASM/FFI, no NIP-17.**
- **No new dependency of any kind** (npm or Cargo).

## See also

- `docs/runtime_worker_crypto_bridge.md` (Stage 252) / `docs/runtime_crypto_activation.md`
  (Stage 262) — the earlier Runtime-side four/five-layer paths this
  document's Worker-side layers extend alongside, not replace.
- `docs/runtime_fedos_provider_activation.md` (Stage 270) — the
  Placeholder→FedOS Provider→Worker→Runtime→Nostr ordering this document's
  own order is consistent with (both name "Worker" as a still-unconnected
  checkpoint between the provider and Runtime/Nostr).
- `src/runtime/worker_crypto_config.ts` / `worker_crypto_registry.ts` /
  `worker_crypto_bridge.ts` (Stage 273–275) — the three new files this
  document reviews the ordering of, without connecting any of them to
  `src/worker.ts`.
