# Secure Runtime Alpha 084 — Identity Bootstrap Observation Consumer Boundary Review

**Status: this Stage is a REVIEW / FORMAL CONFIRMATION only. It makes
NO functional code change and implements NOTHING — it adds a single
header-comment paragraph to `fedos_runtime_identity.ts` recording the
Decision, and nothing else. `#observeBootstrap()`'s own current EMPTY
body is entirely unaffected.**

## 1. Why now

Alpha 076 through Alpha 083 built the full Observation Framework:
Boundary, Contract, Ordering, Scope, Vocabulary, Event shape, Event
Lifecycle, and Delivery Responsibility. All eight govern the Runtime
side and the Event itself — what it may contain, when it fires, what
happens to it afterward, and who must deliver it. None of the eight
answers a distinct question, asked from the opposite direction: once a
Consumer receives an Observation Event, what influence may that
Consumer ever have BACK on this Runtime? Left unanswered, a future
Consumer implementation could satisfy every prior rule (correct
Vocabulary, correct three-field shape, no retention, correct delivery
ownership) while still reaching back into `FedosRuntimeIdentity` —
forcing a re-run of Bootstrap, mutating the cached Descriptor,
poking the Registry, swapping the Provider — turning a one-way
notification into a two-way control channel. This Stage closes that
gap: it fixes, permanently, the outer boundary of what a Consumer may
ever do with what it receives.

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

## 3. Adopted position

An Observation Consumer may only READ an Observation Event. It must
never change Runtime State of any kind. Receiving an Event grants a
Consumer no authority over this Runtime whatsoever — read access only,
nothing else.

## 4. Operations permanently forbidden to a Consumer

The following are permanently forbidden to any Observation Consumer,
under any future Observation implementation, with respect to this
Runtime:

- **Re-running Bootstrap** — triggering `bootstrapIdentity()` again,
  directly or indirectly, from inside a Consumer's own handling of an
  Event.
- **Changing the Descriptor** — mutating, replacing, or clearing
  `#descriptor` in any way.
- **Changing the Registry** — registering, removing, or otherwise
  mutating `FedosIdentityRegistry` state.
- **Changing the Provider** — swapping, reconfiguring, or invoking the
  identity Provider on the Consumer's own behalf.
- **Changing the Resolver** — mutating `FedosIdentityResolver` state
  or its own view of the Registry.
- **Changing Storage** — writing to, or deleting from, any Storage
  backend as a side effect of consuming an Event.
- **Changing Runtime state** — mutating `#bootstrapped` or any other
  field of `FedosRuntimeIdentity`.
- **Changing Worker state** — reaching into `src/worker.ts` or any
  request-scoped state as a side effect of consuming an Event.

## 5. Operations permitted to a Consumer

A Consumer may do any of the following with an Observation Event it
receives, and nothing else:

- **Read the Observation Event.**
- **Log it.**
- **Trace it.**
- **Send it as Telemetry.**
- **Send it as a Metric.**
- **Audit it.**
- **Discard it.**

All seven are things a Consumer does with its OWN copy of the Event,
entirely outside this Runtime — none of them touch this Runtime in any
way.

## 6. Review items

- **Observation is one-way.** The flow is strictly `Runtime →
  Observation Event → Consumer`, and nothing flows the other
  direction.
- **No reverse flow from Consumer to Runtime is ever permitted.** A
  Consumer's own reaction to an Event — however it chooses to Log,
  Trace, or Audit it — must never call back into
  `FedosRuntimeIdentity`, directly or indirectly, under any future
  implementation.

## 7. Future guarantee

A Consumer must never know this Runtime's own internal implementation.
This Runtime must never know a Consumer's own implementation. The
Observation Event — the Alpha 081 three-field shape, carrying the
Alpha 080 Vocabulary — is the ONLY thing the two sides ever share, now
and under every future Stage.

## 8. What this Stage does NOT do

- Does **not** implement anything — `#observeBootstrap()`'s own body
  remains the empty implementation Alpha 076 left it.
- Does **not** change `#bootstrapIdentity()`'s own body, statement
  order, or any call site.
- Does **not** define a Consumer interface, callback type, or any
  other Consumer-related construct — that remains explicitly deferred
  to a future Stage's own implementation.
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

This Stage is a formal review, not an implementation. It fixes,
permanently, the outer boundary of an Observation Consumer's own
influence on this Runtime: a Consumer may only read an Observation
Event and may Log, Trace, send it as Telemetry, send it as a Metric,
Audit, or discard it — nothing more, and nothing that reaches back
into `FedosRuntimeIdentity`. Re-running Bootstrap, changing the
Descriptor, the Registry, the Provider, the Resolver, Storage, Runtime
state, or Worker state are all permanently forbidden to any Consumer.
Observation remains strictly one-way, and neither side ever knows the
other's own internal implementation — only the Observation Event
itself is ever shared.

## 10. See also

- `docs/secure_runtime_alpha_076_identity_bootstrap_observation_boundary.md`
- `docs/secure_runtime_alpha_077_identity_bootstrap_observation_contract.md`
- `docs/secure_runtime_alpha_081_identity_bootstrap_observation_event_review.md`
- `docs/secure_runtime_alpha_082_identity_bootstrap_observation_event_lifecycle_review.md`
- `docs/secure_runtime_alpha_083_identity_bootstrap_observation_delivery_review.md`
