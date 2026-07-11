# Secure Runtime Alpha 080 — Identity Bootstrap Observation Vocabulary Review

**Status: this Stage is a REVIEW / FORMAL CONFIRMATION only. It makes
NO functional code change — it adds a single header-comment paragraph
to `fedos_runtime_identity.ts` recording the Vocabulary, and nothing
else. `#observeBootstrap()`'s own current EMPTY body trivially
satisfies it; nothing here alters behavior.**

## 1. Why now

Alpha 076 named the Observation Boundary. Alpha 077 fixed the
Contract. Alpha 078 fixed the Ordering. Alpha 079 fixed the Scope —
WHAT category of information may be observed (coarse facts about the
attempt) versus WHAT is forbidden (Descriptor content, internal
object state, Runtime Mode/Platform, secrets). What Alpha 079 did not
fix is the actual VOCABULARY those permitted facts may be expressed
in. Left unconstrained, a future Logging implementation could stay
inside the Alpha 079 Scope while still emitting inconsistent,
free-form strings — `"bootstrap ok"`, `"identity found"`,
`"BootstrapSuccess"` — that vary Stage to Stage and implementation to
implementation. This Stage closes that gap: it fixes a small, closed
set of named tokens as the ONLY vocabulary any future observer may
ever use.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY file this Stage
touches, and the ONLY change is a new header-comment paragraph. No
method body changed. `#observeBootstrap()`'s own body remains exactly
what Alpha 076 left it:

```ts
#observeBootstrap(descriptor: FedosIdentityDescriptor | null): void {
  // Intentionally empty — Bootstrap Observation Boundary (Alpha 076); no observer implementation yet.
}
```

## 3. Allowed Vocabulary

Exactly five tokens, and no others, may ever be emitted by a future
`#observeBootstrap()` implementation:

- **`BOOTSTRAP_STARTED`**
- **`BOOTSTRAP_COMPLETED`**
- **`BOOTSTRAP_FAILED`**
- **`DESCRIPTOR_PRESENT`**
- **`DESCRIPTOR_ABSENT`**

These are named FACTS, not values, not messages, and not free text.

## 4. Forbidden Vocabulary

The following must NEVER appear in any observation emission, under
any future implementation:

- **`publicIdentifier`** — or its actual value.
- **`displayName`** — or its actual value.
- **`avatar`** — or its actual value.
- **Provider name** — which concrete Provider implementation resolved
  the Descriptor.
- **Registry state** — counts, contents, or any other Registry-derived
  value.
- **Storage state** — this class has never held a Storage reference;
  none may be introduced for this purpose.
- **Runtime Mode** — `Development`/`Production`/`Unknown`.
- **Platform** — OS or environment identification.
- **Secret information** — private keys, tokens, credentials, or any
  other sensitive value.
- **Exception message body** — the literal `.message` text of a
  caught error.
- **Stack trace** — `.stack`, or any derived call-site information.

## 5. Review items — facts only

The Vocabulary in §3 is closed to FACTS only:

- **No inference** — a future implementation may not derive or guess
  additional meaning beyond the token itself.
- **No evaluation** — a future implementation may not judge whether an
  outcome was "good" or "bad" beyond the bare
  `BOOTSTRAP_COMPLETED`/`BOOTSTRAP_FAILED` distinction.
- **No ranking** — no ordering, scoring, or comparison between
  Bootstrap attempts.
- **No severity assignment** — no "info"/"warn"/"error"/"critical"
  labeling layered on top of the Vocabulary; the Vocabulary itself is
  the entire signal.

## 6. Success / failure — Bootstrap-process-only, Descriptor-independent

`BOOTSTRAP_COMPLETED` and `BOOTSTRAP_FAILED` describe EXCLUSIVELY
whether the Bootstrap Promise itself settled by resolving or
rejecting — nothing about the Identity content it resolved to.
Concretely: if `#performBootstrap()`'s own Promise chain resolves
without throwing, the outcome is `BOOTSTRAP_COMPLETED`, EVEN IF the
resolved `descriptor` is `null`. A `null` Descriptor is not a failure
— `FedosIdentityService.describeIdentity()` returning `null` is a
normal, expected outcome under the Null Source (Alpha 032/033), and
Fail-Closed semantics (Alpha 060/061) already draw the only failure
line that matters: whether `#describeIdentity()`'s own `await`
rejected. `BOOTSTRAP_FAILED` corresponds exactly to that rejection
case, and to no other.

## 7. Descriptor — presence, never content

The `FedosIdentityDescriptor` itself can NEVER become Vocabulary — no
future implementation may serialize it, stringify it, or extract any
of its own fields into an observation. The ONLY fact about the
Descriptor the Vocabulary may ever express is:

- **`DESCRIPTOR_PRESENT`** — the resolved `descriptor` was non-`null`.
- **`DESCRIPTOR_ABSENT`** — the resolved `descriptor` was `null`.

This is consistent with, and a direct consequence of, the Alpha 079
Scope's own "bare fact of `null`-vs-non-`null`" allowance.

## 8. Future guarantee

Every future Observation implementation — Logging, Tracing, Metrics,
Audit, and Telemetry, per the Alpha 077 Contract — MUST draw
exclusively from the five-token Vocabulary fixed in §3. Free-form
strings are permanently forbidden for representing Bootstrap facts;
any human-readable message a future implementation wishes to attach
must be a FIXED, versioned mapping FROM one of these five tokens, not
an independently authored string.

## 9. What this Stage does NOT do

- Does **not** change `#observeBootstrap()`'s own body — it remains
  the empty implementation Alpha 076 left it.
- Does **not** change `#bootstrapIdentity()`'s own body, statement
  order, or any call site.
- Does **not** implement any Metrics/Tracing/Audit/Logging/Telemetry
  behavior, and does not define the Vocabulary as an actual TypeScript
  enum, constant, or type — that remains explicitly deferred to a
  future Stage's own implementation.
- Does **not** add any new public API.
- Does **not** add any new private field.
- Does **not** modify `src/runtime/create_runtime.ts`.
- Does **not** modify `src/runtime/types.ts` or any `AppRuntime`
  field.
- Does **not** modify any `src/identity/*` file (Provider, Registry,
  Resolver, Service, Descriptor, or Record).
- Does **not** modify `src/worker.ts`.
- Does **not** modify any Storage file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.

## 10. Summary

This Stage is a formal review, not an implementation. It fixes, as a
permanent Vocabulary, the exactly-five named tokens any future
`#observeBootstrap()` implementation may ever emit —
`BOOTSTRAP_STARTED`, `BOOTSTRAP_COMPLETED`, `BOOTSTRAP_FAILED`,
`DESCRIPTOR_PRESENT`, `DESCRIPTOR_ABSENT` — facts only, with no
inference, evaluation, ranking, or severity layered on top; success
and failure describe the Bootstrap process itself, independent of
whether the resolved Descriptor was `null`; and the Descriptor's own
content never becomes Vocabulary, only its presence or absence.
`#observeBootstrap()`'s own current empty body trivially satisfies
this Vocabulary.

## 11. See also

- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_076_identity_bootstrap_observation_boundary.md`
- `docs/secure_runtime_alpha_077_identity_bootstrap_observation_contract.md`
- `docs/secure_runtime_alpha_078_identity_bootstrap_observation_ordering_review.md`
- `docs/secure_runtime_alpha_079_identity_bootstrap_observation_scope_review.md`
