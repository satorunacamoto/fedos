# Secure Runtime Alpha 081 — Identity Bootstrap Observation Event Review

**Status: this Stage is a REVIEW / FORMAL CONFIRMATION only. It makes
NO functional code change and implements NOTHING — it adds a single
header-comment paragraph to `fedos_runtime_identity.ts` recording a
Decision about a hypothetical future Event shape, and nothing else.
`#observeBootstrap()`'s own current EMPTY body is entirely unaffected.**

## 1. Why now

Alpha 076 through Alpha 080 built the full Observation Framework:
Boundary (the Hook exists), Contract (what it must be), Ordering (when
it runs), Scope (what category it may look at), and Vocabulary (the
exact five tokens it may ever say). None of the five fixed the SHAPE
of the actual notification a future observer would emit — if
`#observeBootstrap()` is ever implemented to call out to an external
sink (a logger, a tracer, a metrics collector), what does that call's
own argument look like? Left unconstrained, five independent future
implementations (Logging, Tracing, Audit, Telemetry, Metrics) could
each invent their own bespoke payload shape, and Vocabulary discipline
alone would not prevent that fragmentation. This Stage reviews and
fixes that shape now, as a Decision, before any Event is ever emitted.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY file this Stage
touches, and the ONLY change is a new header-comment paragraph. No
method body changed, and nothing was implemented.
`#observeBootstrap()`'s own body remains exactly what Alpha 076 left
it:

```ts
#observeBootstrap(descriptor: FedosIdentityDescriptor | null): void {
  // Intentionally empty — Bootstrap Observation Boundary (Alpha 076); no observer implementation yet.
}
```

## 3. Adopted fields

A hypothetical future Observation Event carries EXACTLY three fields,
and no others:

- **`event`** — a fixed name identifying that this is a Bootstrap
  observation notification (the notification's own type tag, not a
  free-form label).
- **`timestamp`** — the instant the observation occurred.
- **the Vocabulary token itself** (Alpha 080) — exactly one of
  `BOOTSTRAP_STARTED`, `BOOTSTRAP_COMPLETED`, `BOOTSTRAP_FAILED`,
  `DESCRIPTOR_PRESENT`, `DESCRIPTOR_ABSENT`.

## 4. Rejected fields

The following are permanently rejected as Event fields, under any
future implementation, for any purpose:

- **Descriptor** — the object itself, or any of its own fields.
- **Provider** — which concrete Provider resolved the attempt.
- **Registry** — any Registry-derived state.
- **Storage** — this class has never held a Storage reference.
- **Runtime** — Runtime Mode or any other Runtime-derived state.
- **Platform** — OS/environment identification.
- **`displayName`**
- **`avatar`**
- **`publicIdentifier`**
- **Error Message** — the literal `.message` text of a caught error.
- **Stack Trace** — `.stack`, or any derived call-site information.
- **Severity** — "info"/"warn"/"error"/"critical" or any equivalent
  layered classification.
- **Category** — any secondary classification beyond the Vocabulary
  token itself.
- **Metadata** — any open-ended key/value bag.
- **Attributes** — any open-ended key/value bag, under any other name.
- **Payload** — any purpose-specific data blob.
- **Free-form string** — any field whose value is not one of the
  three Adopted fields in §3.

## 5. Review perspective: the Event carries Vocabulary, it does not interpret it

The Observation Event's own entire purpose is to CARRY the Vocabulary
token established by Alpha 080 from `#observeBootstrap()` to whatever
external sink a future Stage connects. It must never ADD meaning of
its own: no field on the Event may re-derive, re-classify, re-word, or
elaborate on what the Vocabulary token already says. If a future
Logging implementation wants a human-readable message, that message
must be produced by a FIXED, versioned lookup FROM the Vocabulary
token at the point of final rendering — never carried as a field on
the Event itself (a rule already implied by the Alpha 080 Vocabulary's
own "no free-form strings" clause, restated here at the Event-shape
level).

## 6. Future guarantee

Every future Observation implementation — Logging, Tracing, Audit,
Telemetry, and Metrics, per the Alpha 077 Contract — MUST use this
SAME three-field Event shape. No purpose-specific Payload, Attributes
bag, or Metadata field is permitted for any of the five, regardless of
how specialized its own downstream sink might otherwise want its data
shaped. If a specific sink genuinely requires additional structure,
that structure must be derived entirely FROM the three Event fields at
the sink's own boundary — it must never be added TO the Event itself.

## 7. Decision

**The Observation Event is formally fixed, permanently, as the
minimal structure that carries the Vocabulary — `{ event, timestamp,
vocabulary }` — and nothing more.** This Decision binds every future
Stage that ever implements `#observeBootstrap()`'s own body.

## 8. What this Stage does NOT do

- Does **not** implement anything — `#observeBootstrap()`'s own body
  remains the empty implementation Alpha 076 left it.
- Does **not** define the Event shape as an actual TypeScript type,
  interface, or runtime value — that remains explicitly deferred to a
  future Stage's own implementation.
- Does **not** change `#bootstrapIdentity()`'s own body, statement
  order, or any call site.
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

## 9. Summary

This Stage is a formal review, not an implementation. It reviews and
fixes the SHAPE any future Observation Event is permitted to have —
exactly three fields (`event`, `timestamp`, and the Alpha 080
Vocabulary token) and nothing else — rejecting every field that would
let the Event carry Descriptor content, internal object state, error
detail, or open-ended metadata. The Event's own purpose is to CARRY
the Vocabulary, never to interpret or elaborate on it. Every future
Logging, Tracing, Audit, Telemetry, or Metrics implementation must
share this identical three-field shape, with no purpose-specific
Payload permitted.

## 10. See also

- `docs/secure_runtime_alpha_076_identity_bootstrap_observation_boundary.md`
- `docs/secure_runtime_alpha_077_identity_bootstrap_observation_contract.md`
- `docs/secure_runtime_alpha_078_identity_bootstrap_observation_ordering_review.md`
- `docs/secure_runtime_alpha_079_identity_bootstrap_observation_scope_review.md`
- `docs/secure_runtime_alpha_080_identity_bootstrap_observation_vocabulary_review.md`
