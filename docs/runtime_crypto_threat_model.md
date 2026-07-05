# Runtime/Worker crypto activation — threat model (Stage 293)

**Status: this document records real code's safety property.** It states,
explicitly, the ONE property `src/runtime/runtime_crypto_activation_policy.ts`/
`worker_crypto_activation_policy.ts` (Stage 289–290) exist to guarantee: a
misconfiguration of ONE knob can never, by itself, turn on real
cryptography. This is a **fail-closed** design.

## 1. The scenario this document rules out

A caller (a developer, a deploy script, a misremembered env file) sets:

```
FEDOS_CRYPTO_PROVIDER=fedos
```

...and NOTHING ELSE. No other flag, no code change, no review.

**Nothing happens.** No cryptographic operation starts. No
`FedosRuntimeCryptoProvider.encrypt`/`decrypt` call ever resolves to
anything but `"Unsupported"`. `buildRuntimeCryptoProvider()`/
`buildWorkerCryptoProvider()` (`docs/runtime_crypto_activation_policy.md`
§2) still resolve `PlaceholderRuntimeCryptoProvider`, because
`runtimeCryptoEnabled`/`workerCryptoEnabled` remain fixed `false` —
`FEDOS_CRYPTO_PROVIDER` is a NAME selector, evaluated only AFTER the
separate `enabled` gate, and the gate itself has no env/flag path to
`true` anywhere in this repository today.

`evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation` report
this exact scenario as `activationReason: "DisabledByConfig"` — the
HIGHEST-priority reason, checked before the provider name is even
inspected. A single misconfigured env var cannot silently degrade into
"provider selected, so let's assume the rest is fine" — the enable gate
is checked first and independently.

## 2. Why "fail closed" and not "fail permissive"

Every knob in this pipeline defaults to the SAFEST state, and every
ADDITIONAL knob narrows (never widens) what is possible:

| Knob | Default | Effect of leaving it at default |
|---|---|---|
| `FEDOS_CRYPTO_PROVIDER` | `"placeholder"` | No provider NAME even points at FedOS. |
| `runtimeCryptoEnabled`/`workerCryptoEnabled` | `false` (fixed, no env path) | Even a `"fedos"`-named config is ignored. |
| `FedosRuntimeCryptoProvider`'s real implementation | absent (`encrypt`/`decrypt` → `"Unsupported"`) | Even if BOTH knobs above were somehow flipped, no cryptography would run. |
| Runtime's automatic `encrypt`/`decrypt` call | absent | `AppRuntime.crypto` exists but nothing calls it automatically. |
| Worker's import of the Worker crypto boundary | absent | `src/worker.ts` cannot reach any of this even in principle. |

**Three independent layers, not one.** An attacker or a mistake would
need to simultaneously (a) set the env var, (b) find and flip a
non-existent `enabled` toggle, AND (c) have a maintainer have already
merged a real `FedosRuntimeCryptoProvider` implementation AND wired it
into Runtime/Worker's actual call paths — all across multiple, separately
reviewed, future stages. No single commit, config change, or env var can
collapse all three.

## 3. What this document does NOT claim

- **Not a claim that FedOS crypto, once eventually activated, will be
  secure.** That is a property of whatever real implementation a future
  stage adds — this document only covers the ACTIVATION gate, not the
  cryptography itself (see `docs/nip44_wire_crypto_completion.md` for the
  actual NIP-44 cryptography's own, separate correctness record).
- **Not a claim that this policy is exploit-proof against a compromised
  build/deploy pipeline** that could rewrite these files directly — this
  is a configuration-safety property, not a supply-chain guarantee.
- **Not a claim that Runtime/Worker will never be connected to FedOS** —
  only that connecting them is a deliberate, separate, future, reviewed
  act, not an accidental side effect of one env var.

## See also

- `docs/runtime_crypto_activation_policy.md` (Stage 289–291) — the five
  conditions and the two evaluate functions this document's guarantee
  rests on.
- `docs/runtime_fedos_provider_activation.md` (Stage 270) — the
  Placeholder→FedOS Provider→Worker→Runtime→Nostr order that must ALL be
  completed, in sequence, before this threat model's scenario could ever
  become live.
