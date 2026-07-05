# FedOS Runtime Provider — internal implementation readiness (Stage 305–312)

**Status: this document records real code.** It fixes, in writing, what
"implementation-ready" means for `FedosRuntimeCryptoProvider`
(`src/runtime/fedos_runtime_crypto_provider.ts`) today, and confirms
that it is NOT there yet — only the SHAPE of the boundary a future
stage would fill in exists so far.

## 1. What Stage 305–312 actually adds

`FedosRuntimeCryptoProvider` gains, purely additively:

- **`FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`** (Stage 305) — a fixed,
  permanently-`false` constant. No env var, no parameter, no override
  anywhere can flip it. It is surfaced read-only on `status()`'s return
  value as `implemented`.
- **`internalCapabilitySurface()`** (Stage 306) — an ADDITIONAL method
  (`capabilities()` itself is UNCHANGED) naming, for each capability
  label, whether it is `"internal-only"` (the underlying
  `packages/fedos-core-rust` NIP-44 wire pipeline genuinely exists and
  is exercised by that crate's own `cargo test` suite) or
  `"not-implemented"` (nothing backs the label at all). This is
  DISPLAY-ONLY — every capability remains `"Unsupported"`/`"NotConnected"`
  from the `RuntimeCryptoProvider` interface's own point of view, and no
  secret/key/ciphertext material is ever exposed.
- **`FedosProviderDecisionReason`/`decisionReason()`** (Stage 307) — an
  additional, purely-additive vocabulary for WHY `encrypt()`/`decrypt()`
  currently deny every request. Always `"NotImplemented"` in this stage.
  `encrypt()`/`decrypt()`'s own return type and values are UNCHANGED.
- **A single source of truth** (Stage 308) — `runtime_crypto_activation_policy.ts`/
  `worker_crypto_activation_policy.ts` (each independently) now read
  `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` directly, instead of each keeping
  its own, second, redundant `false` literal.
- **`providerImplemented` in diagnostics** (Stage 309) —
  `runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()` now
  also report this same flag.

## 2. What "implementation-ready" does NOT mean

None of the above makes `FedosRuntimeCryptoProvider` call any real
cryptography:

- `encrypt()`/`decrypt()` STILL always resolve `state: "Unsupported"` —
  completely unchanged from Stage 265.
- `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` is STILL `false` — this stage
  only gives it a NAME and a place other files can read it FROM, not a
  path to `true`.
- No `packages/fedos-core-rust` function is called anywhere in
  `fedos_runtime_crypto_provider.ts` — still zero imports of the Rust
  crate or its TS package boundary.
- `"Allowed"` is STILL never returned by either activation policy, even
  with BOTH `FEDOS_CRYPTO_PROVIDER=fedos` AND
  `FEDOS_CRYPTO_ENABLED=explicit-dev-only` set — `activationReason`
  stays `"ProviderUnavailable"`, exactly as before Stage 305.
- Runtime/Worker still never call this provider — `AppRuntime.crypto`
  exists but nothing calls `encrypt`/`decrypt` automatically, and
  `src/worker.ts` still does not import any Worker crypto file.
- No Relay, Storage, Nostr, NIP-17, WASM, or FFI connection of any kind.

## 3. What this stage prepares for (not yet done)

This stage builds the SHAPE a future, separate, explicitly-reviewed
stage would fill in:

1. `FedosRuntimeCryptoProvider` internal `encrypt`/`decrypt`
   implementation planning (Stage 313 candidate #1).
2. Internal NIP-44 call wiring — `FedosRuntimeCryptoProvider` itself
   calling `packages/fedos-core-rust`'s NIP-44 wire pipeline — while
   STILL not Runtime-auto-called (Stage 313 candidate #2).
3. A dev-only opt-in path where `evaluateRuntimeCryptoActivation` could
   legitimately return `"Allowed"` (Stage 313 candidate #3) — requires
   flipping `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` itself, which THIS
   stage explicitly does not do.

Each of these is a SEPARATE, future, explicitly-reviewed stage — this
document only records that the SHAPE now exists, not that any of them
have happened.

## See also

- `docs/runtime_crypto_activation_policy.md` — the five conditions and
  dual-lock model this provider's implementation flag is now one input
  to.
- `docs/runtime_crypto_threat_model.md` — the fail-closed guarantee that
  still holds regardless of this stage's additions.
