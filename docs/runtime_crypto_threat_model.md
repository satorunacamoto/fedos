# Runtime/Worker crypto activation — threat model (Stage 293/297/305–312)

**Status: this document records real code's safety property.** It states,
explicitly, the ONE property `src/runtime/runtime_crypto_activation_policy.ts`/
`worker_crypto_activation_policy.ts` (Stage 289–290/297/308) exist to
guarantee: a misconfiguration of ONE knob — or even BOTH knobs of the
Stage 297 dual-lock model — can never, by itself, turn on real
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

## 1a. The Stage 297 scenario: BOTH locks set

Now suppose a caller sets BOTH:

```
FEDOS_CRYPTO_PROVIDER=fedos
FEDOS_CRYPTO_ENABLED=explicit-dev-only
```

...deliberately, on purpose, having read this very document. **Still
nothing happens.** `evaluateRuntimeCryptoActivation`/
`evaluateWorkerCryptoActivation` now get PAST `"DisabledByConfig"` and
`"ProviderNotSelected"` — but land on `"ProviderUnavailable"`, because
`FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
(`src/runtime/fedos_runtime_crypto_provider.ts`, Stage 305) is a fixed,
permanently-`false` constant with no env path, no parameter, no
override anywhere — and, as of Stage 308, BOTH policy files read this
SAME constant directly, rather than each keeping an independent literal
that could drift. `"Allowed"` is NEVER returned, no matter what env
values are supplied. And even if it somehow were: `runtime_crypto_bridge.ts`/
`worker_crypto_bridge.ts` (untouched this stage) never read
`FEDOS_CRYPTO_ENABLED` at all, so `buildRuntimeCryptoProvider()`/
`buildWorkerCryptoProvider()` STILL only ever resolve
`PlaceholderRuntimeCryptoProvider`. Two separate reasons, independently
sufficient, both currently true.

## 1b. The Stage 305–312 scenario: the provider gains a "shape" but not a "self"

Stage 305–312 gives `FedosRuntimeCryptoProvider` an implementation FLAG
(`FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`), a richer capability SURFACE
(`internalCapabilitySurface()`), and a decision-reason VOCABULARY
(`decisionReason()`) — none of which back any real cryptography. This
is deliberately NOT a step toward real crypto; it is bookkeeping ABOUT
the absence of real crypto, made precise enough that a future stage can
name exactly what it would need to change (the flag; nothing else)
without that future stage's diff needing to invent new vocabulary at
the same time. `encrypt()`/`decrypt()` are untouched, byte for byte,
across Stage 305–312.

## 2. Why "fail closed" and not "fail permissive"

Every knob in this pipeline defaults to the SAFEST state, and every
ADDITIONAL knob narrows (never widens) what is possible:

| Knob | Default | Effect of leaving it at default |
|---|---|---|
| `FEDOS_CRYPTO_PROVIDER` | `"placeholder"` | No provider NAME even points at FedOS. |
| `FEDOS_CRYPTO_ENABLED` | `"disabled"` (Stage 297; ONE exact phrase opens it) | Even a `"fedos"`-named config is ignored by the activation policy. |
| `runtimeCryptoEnabled`/`workerCryptoEnabled` | `false` (fixed, no env path) | The bridge's own gate is untouched by either env var above. |
| `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` (`FedosRuntimeCryptoProvider`'s real implementation) | `false` (fixed, Stage 305, no env path) | Even if ALL knobs above were somehow flipped, `encrypt`/`decrypt` still resolve `"Unsupported"` and no cryptography would run. |
| Runtime's automatic `encrypt`/`decrypt` call | absent | `AppRuntime.crypto` exists but nothing calls it automatically. |
| Worker's import of the Worker crypto boundary | absent | `src/worker.ts` cannot reach any of this even in principle. |

**Multiple independent layers, not one.** An attacker or a mistake would
need to simultaneously (a) set BOTH env vars to their exact open values,
(b) find and flip a non-existent `enabled` toggle the bridge itself
reads, (c) have a maintainer have already merged a real
`FedosRuntimeCryptoProvider` implementation, AND (d) have that
implementation wired into Runtime/Worker's actual call paths — all
across multiple, separately reviewed, future stages. No single commit,
config change, or env var (or PAIR of env vars) can collapse all of
that.

## 2a. Why `explicit-dev-only` and not a boolean flag

`FEDOS_CRYPTO_ENABLED` deliberately does NOT accept `"true"`/`"1"`/`"yes"`/
`"on"`/`"enabled"` — the spellings this repository's OTHER env flags
accept (`isEnvFlagTruthy`, `src/runtime/create_runtime.ts`) — for one
reason: those spellings are COMMON. A stray `FEDOS_CRYPTO_ENABLED=true`
left over from copy-pasting an unrelated `.env.example`, a CI variable
inherited from a different service, or a typo'd `1` meant for a totally
different flag, would all silently satisfy a conventional boolean gate.
Requiring the exact, unusual, unmistakably-deliberate phrase
`"explicit-dev-only"` makes an ACCIDENTAL match — as opposed to a
human deliberately typing this exact string, presumably having read
this document first — effectively impossible. The name itself also
communicates the intent: this is an EXPLICIT, DEV-ONLY escape hatch, not
a production switch, not a generic "on" state.

Every rejected spelling is deliberate, not an oversight: `true`/`1`/`yes`/
`on`/`enabled` (common truthy flags elsewhere in this codebase);
`false`/`0`/`no`/`off`/`disabled` (common negatives, rejected the same as
everything else — there is no "explicitly disabled" state distinct from
"unset", by design); `dev`/`development`/`debug`/`prod`/`production`
(environment-name-shaped words someone might guess); `allow`/
`allow-fedos`/`fedos`/`real`/`real-fedos`/`experimental`/`beta`
(FedOS-adjacent words that sound plausible); and empty/unset (the
default, safest state).

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

- `docs/runtime_crypto_activation_policy.md` (Stage 289–312) — the five
  conditions, the dual-lock model, and the two evaluate functions this
  document's guarantee rests on.
- `docs/runtime_fedos_provider_implementation.md` (Stage 305–312) — what
  the provider's new implementation flag/capability surface/decision
  vocabulary do and do NOT mean.
- `docs/runtime_fedos_provider_activation.md` (Stage 270) — the
  Placeholder→FedOS Provider→Worker→Runtime→Nostr order that must ALL be
  completed, in sequence, before this threat model's scenario could ever
  become live.
