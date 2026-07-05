# Runtime/Worker crypto activation policy (Stage 289–312) — implementation record

**Status: this document records real code.** It fixes, in writing, the
full set of conditions that must ALL hold before FedOS crypto could ever
actually run — and confirms that, today, none of them fully hold.
`src/runtime/runtime_crypto_activation_policy.ts` (Stage 289/297/308) and
`src/runtime/worker_crypto_activation_policy.ts` (Stage 290/297/308) are
the real, `cargo test`-adjacent (well, `npm test`-verified) code this
document describes.

## 1. The five conditions

FedOS activation — meaning a real `FedosRuntimeCryptoProvider` actually
performing `encrypt`/`decrypt` instead of resolving `"Unsupported"` — REQUIRES ALL FIVE of the following, simultaneously:

1. **`FEDOS_CRYPTO_PROVIDER=fedos`** — the env var (Stage 281–283) must
   name `"fedos"`, not `"placeholder"` (the default) and not any
   unrecognized/truthy-flag spelling.
2. **`runtimeCryptoEnabled`/`workerCryptoEnabled` = `true`** — the SEPARATE
   enable gate (Stage 258/273), still fixed `false` in this repository —
   OR, as of Stage 297, `FEDOS_CRYPTO_ENABLED=explicit-dev-only` (see §5
   below). Either path can, at best, only satisfy THIS ONE condition —
   conditions #3–#5 are untouched by either.
3. **A real FedOS Provider implementation** — `FedosRuntimeCryptoProvider`
   (`src/runtime/fedos_runtime_crypto_provider.ts`, Stage 265) must
   actually call through to real cryptography instead of unconditionally
   resolving `"Unsupported"`. Not implemented — `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
   (Stage 305) is fixed `false`, with no env path or override, and BOTH
   activation policies now read it directly (Stage 308) as their single
   source of truth for this condition. See
   `docs/runtime_fedos_provider_implementation.md` for the SHAPE this
   stage adds around it (`internalCapabilitySurface()`, `decisionReason()`)
   without changing this fact.
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
achieves nothing alone), and #2 (which, as of Stage 297, CAN also be
"satisfied" via `FEDOS_CRYPTO_ENABLED=explicit-dev-only` — but that
STILL leaves #3/#4/#5 completely missing, so nothing activates).

## 2. `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`

Two INDEPENDENT (never shared, per `docs/runtime_worker_activation_boundary.md`'s
own "separate knob per boundary" discipline) pure functions, each
evaluating conditions #1–#3 above (conditions #4/#5 are structural facts
about the surrounding code, not something a per-call function evaluates)
against a resolved config plus an optional env value, in this fixed
priority order:

```
1. !(configEnabled || envLockEnabled) -> "DisabledByConfig"
2. provider !== "fedos"                -> "ProviderNotSelected"
3. otherwise (both locks open,
   provider == "fedos")                -> "ProviderUnavailable"
                                           (FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
                                            src/runtime/fedos_runtime_crypto_provider.ts,
                                            Stage 305, is a fixed, permanently-false
                                            constant read directly by BOTH policies,
                                            Stage 308 — no parameter can flip it)
```

`envLockEnabled` is `parseFedosCryptoEnabledEnv(env?.FEDOS_CRYPTO_ENABLED)
=== "explicit-dev-only"` (Stage 297, §5 below). `configEnabled` is the
existing `runtimeCryptoEnabled`/`workerCryptoEnabled` field, still fixed
`false`. Either one being `true` satisfies condition #1 ALONE — condition
#3 (`FEDOS_PROVIDER_IMPLEMENTED`) still blocks everything regardless.

`ActivationReason` also names two RESERVED labels, `"FutureFeature"` and
`"Allowed"` — mirroring `RuntimeCryptoDiagnosticsState`'s own `"Enabled"`
precedent (`src/runtime/runtime_crypto_diagnostics.ts`) — but NEITHER
function ever produces them in this stage. `"Allowed"` specifically can
NEVER be produced: the internal "is a real implementation present" check
is a hardcoded `false` constant with no parameter, override, or code path
that could ever make it `true` in this repository as it exists today —
this holds EVEN WHEN `provider === "fedos"` AND
`FEDOS_CRYPTO_ENABLED === "explicit-dev-only"` simultaneously.

## 3. Diagnostics (Stage 291/297/309)

`runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()`
(`src/runtime/runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts`)
each gained an `activationReason` field (Stage 291), computed by calling
the matching `evaluate*Activation` function against the SAME config
already read for `configuredProvider`/`effectiveProvider`, plus (Stage
297) a `configuredEnabled` field — the PARSED `FEDOS_CRYPTO_ENABLED`
label (`"explicit-dev-only"` or `"disabled"`), and `env` is now also
passed through to the activation policy so `activationReason` reflects
the dual-lock combination. Stage 309 adds `providerImplemented` — a
direct read of `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`, the SAME constant
`activationReason`'s own computation now consults (Stage 308). Fixed
`false`; setting BOTH locks still leaves `activationReason:
"ProviderUnavailable"`.

`effectiveProvider` is DELIBERATELY UNCHANGED by Stage 297 — it still
mirrors ONLY `runtime_crypto_bridge.ts`/`worker_crypto_bridge.ts`'s own
two-flag gate, neither of which reads `FEDOS_CRYPTO_ENABLED` (they were
not touched this stage). This means `activationReason` and
`effectiveProvider` can now legitimately DIVERGE: setting
`FEDOS_CRYPTO_PROVIDER=fedos` and `FEDOS_CRYPTO_ENABLED=explicit-dev-only`
together makes `activationReason` report `"ProviderUnavailable"` (both
locks are open, so the policy layer gets past #1/#2), while
`effectiveProvider` STILL reports `"placeholder"` (the bridge's own gate
never even looks at `FEDOS_CRYPTO_ENABLED`). Neither field ever implies
real cryptography ran.

## 4. What this stage does NOT do

- **No `enabled` flip.** `runtimeCryptoEnabled`/`workerCryptoEnabled`
  (the ORIGINAL config fields) stay fixed `false`, unconditionally.
- **No `Allowed` return, ever**, from either evaluate function, under any
  combination of env inputs.
- **No real FedOS core call**, no `encrypt`/`decrypt` execution anywhere.
- **No Runtime→FedOS or Worker→FedOS connection.**
- **No bridge change.** `runtime_crypto_bridge.ts`/`worker_crypto_bridge.ts`
  are untouched — they still never read `FEDOS_CRYPTO_ENABLED`.
- **No shared implementation between the Runtime and Worker policies** —
  each is independently written, independently typed. (The env PARSER
  itself, `crypto_provider_env.ts`, IS shared — same precedent as
  `FEDOS_CRYPTO_PROVIDER`'s Stage 281 parser.)
- **No `RuntimeEnv` change, no Rust change, no new dependency.**

## 5. The dual-lock model (Stage 297)

Two, textually unrelated env vars must BOTH resolve to their single
"open" value before FedOS is even a candidate:

| Lock | Env var | Open value | Everything else |
|---|---|---|---|
| #1 | `FEDOS_CRYPTO_PROVIDER` | `"fedos"` | `"placeholder"` (default) |
| #2 | `FEDOS_CRYPTO_ENABLED` | `"explicit-dev-only"` | `"disabled"` — including EVERY common truthy spelling |

Lock #2's allowed value list is intentionally a SINGLE unusual phrase,
not a conventional boolean flag. See `docs/runtime_crypto_threat_model.md`
§2 for the full rationale (why `"true"`/`"1"`/`"on"`/`"enabled"` are
rejected, why `"explicit-dev-only"` was chosen, and why passing BOTH
locks still does not activate FedOS today).

## See also

- `docs/runtime_fedos_provider_implementation.md` (Stage 305–312) — what
  the provider implementation flag/capability surface/decision reason
  additions do and do NOT mean.
- `docs/runtime_crypto_threat_model.md` (Stage 293/297) — the fail-closed
  security posture this policy enforces, and the dual-lock rationale.
- `docs/runtime_fedos_provider_activation.md` (Stage 270) /
  `docs/runtime_crypto_activation.md` (Stage 262) — the earlier
  layer/order documents this policy sits on top of.
- `docs/runtime_worker_activation_boundary.md` (Stage 276) — the
  "separate knob per boundary, never shared" discipline this stage's
  Runtime/Worker policy split follows.
