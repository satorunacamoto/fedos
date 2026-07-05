# Runtime/Worker crypto activation policy (Stage 289–296) — implementation record

**Status: this document records real code.** It fixes, in writing, the
full set of conditions that must ALL hold before FedOS crypto could ever
actually run — and confirms that, today, none of them fully hold.
`src/runtime/runtime_crypto_activation_policy.ts` (Stage 289) and
`src/runtime/worker_crypto_activation_policy.ts` (Stage 290) are the real,
`cargo test`-adjacent (well, `npm test`-verified) code this document
describes.

## 1. The five conditions

FedOS activation — meaning a real `FedosRuntimeCryptoProvider` actually
performing `encrypt`/`decrypt` instead of resolving `"Unsupported"` — REQUIRES ALL FIVE of the following, simultaneously:

1. **`FEDOS_CRYPTO_PROVIDER=fedos`** — the env var (Stage 281–283) must
   name `"fedos"`, not `"placeholder"` (the default) and not any
   unrecognized/truthy-flag spelling.
2. **`runtimeCryptoEnabled`/`workerCryptoEnabled` = `true`** — the SEPARATE
   enable gate (Stage 258/273) — still fixed `false` in this repository,
   permanently, until a future, separate, explicitly-reviewed stage
   changes that.
3. **A real FedOS Provider implementation** — `FedosRuntimeCryptoProvider`
   (`src/runtime/fedos_runtime_crypto_provider.ts`, Stage 265) must
   actually call through to real cryptography instead of unconditionally
   resolving `"Unsupported"`. Not implemented.
4. **Runtime connected** — `AppRuntime.crypto`
   (`src/runtime/create_runtime.ts`, Stage 260) exists and is ASSEMBLED,
   but nothing in Runtime's own request-handling path ever calls its
   `encrypt`/`decrypt` automatically.
5. **Worker connected** — `src/worker.ts` does not import ANY of
   `worker_crypto_config.ts`/`worker_crypto_registry.ts`/
   `worker_crypto_bridge.ts`/`worker_crypto_activation_policy.ts` at all
   (`docs/runtime_worker_activation_boundary.md`).

**If even ONE of the five is missing, FedOS does not start.** Today, ALL
FIVE are missing simultaneously except #1 (which CAN be set via env, but
achieves nothing alone).

## 2. `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`

Two INDEPENDENT (never shared, per `docs/runtime_worker_activation_boundary.md`'s
own "separate knob per boundary" discipline) pure functions, each
evaluating conditions #1–#3 above (conditions #4/#5 are structural facts
about the surrounding code, not something a per-call function evaluates)
against a resolved config, in this fixed priority order:

```
1. !enabled                        -> "DisabledByConfig"
2. provider !== "fedos"            -> "ProviderNotSelected"
3. otherwise (enabled && "fedos")  -> "ProviderUnavailable"
                                       (FEDOS_PROVIDER_IMPLEMENTED is a
                                        fixed, private, permanently-false
                                        constant — no parameter can flip it)
```

`ActivationReason` also names two RESERVED labels, `"FutureFeature"` and
`"Allowed"` — mirroring `RuntimeCryptoDiagnosticsState`'s own `"Enabled"`
precedent (`src/runtime/runtime_crypto_diagnostics.ts`) — but NEITHER
function ever produces them in this stage. `"Allowed"` specifically can
NEVER be produced: the internal "is a real implementation present" check
is a hardcoded `false` constant with no parameter, override, or code path
that could ever make it `true` in this repository as it exists today.

## 3. Diagnostics (Stage 291)

`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()`
(`src/runtime/runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts`)
each gained an `activationReason` field, computed by calling the
matching `evaluate*Activation` function against the SAME config already
read for `configuredProvider`/`effectiveProvider`. Since `enabled` is
permanently `false` on both sides, `activationReason` is permanently
`"DisabledByConfig"` today, regardless of `FEDOS_CRYPTO_PROVIDER`'s value
— this is DELIBERATE: condition #1 (env selection) is checked SECOND in
priority, after condition #2 (the enable gate), so an unset `enabled`
flag masks whatever the provider name says.

## 4. What this stage does NOT do

- **No `enabled` flip.** `runtimeCryptoEnabled`/`workerCryptoEnabled`
  stay fixed `false`.
- **No `Allowed` return, ever**, from either evaluate function.
- **No real FedOS core call**, no `encrypt`/`decrypt` execution anywhere.
- **No Runtime→FedOS or Worker→FedOS connection.**
- **No shared implementation between the Runtime and Worker policies** —
  each is independently written, independently typed.
- **No `RuntimeEnv` change, no Rust change, no new dependency.**

## See also

- `docs/runtime_crypto_threat_model.md` (Stage 293) — the fail-closed
  security posture this policy enforces.
- `docs/runtime_fedos_provider_activation.md` (Stage 270) /
  `docs/runtime_crypto_activation.md` (Stage 262) — the earlier
  layer/order documents this policy sits on top of.
- `docs/runtime_worker_activation_boundary.md` (Stage 276) — the
  "separate knob per boundary, never shared" discipline this stage's
  Runtime/Worker policy split follows.
