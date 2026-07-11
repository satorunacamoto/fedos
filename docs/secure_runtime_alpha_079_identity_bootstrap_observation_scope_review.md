# Secure Runtime Alpha 079 — Identity Bootstrap Observation Scope Review

**Status: this Stage is a REVIEW / FORMAL CONFIRMATION only. It makes
NO functional code change — it adds a single header-comment paragraph
to `fedos_runtime_identity.ts` recording the Scope, and nothing else.
`#observeBootstrap()`'s own current EMPTY body trivially satisfies
this Scope; nothing here alters behavior.**

## 1. Why now

Alpha 076 named the Observation Boundary. Alpha 077 fixed the Contract
(synchronous, `void`-returning, never throwing, state-free, limited to
Metrics/Tracing/Audit/Logging/Telemetry). Alpha 078 fixed the Ordering
(always before `#completeBootstrap()`, observing only pre-write
state). None of the three fixed WHAT INFORMATION a future observer may
actually look at. `#observeBootstrap()` receives a real
`descriptor: FedosIdentityDescriptor | null` parameter — a future
implementation could, without violating any prior Stage's own rule,
read that Descriptor's own fields and log a user's `publicIdentifier`
or `displayName`. This Stage closes that gap before any observer is
ever written: it draws the line between the bare FACT that Bootstrap
happened and the CONTENT of what it resolved, and fixes that line
permanently.

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

## 3. Allowed Observation

A future `#observeBootstrap()` implementation MAY observe:

- **Bootstrap start** — that an attempt began.
- **Bootstrap end** — that an attempt concluded (successfully or
  not).
- **The bare fact that the resolved Descriptor was `null`** — i.e.
  `descriptor === null`, a boolean-shaped fact, not the Descriptor
  itself.
- **The bare fact that the resolved Descriptor was non-`null`** —
  i.e. `descriptor !== null`, equally boolean-shaped.
- **Processing time** — elapsed duration of the attempt.
- **Invocation count** — how many times Bootstrap has been attempted.
- **Success / failure** — the coarse outcome of the attempt.

Every item on this list is a fact ABOUT the Bootstrap attempt, never a
fact FROM INSIDE the Descriptor, the Provider, the Registry, or any
other internal object.

## 4. Forbidden Observation

A future `#observeBootstrap()` implementation MUST NEVER observe:

- **Descriptor content** — any field of the `FedosIdentityDescriptor`
  the method receives.
- **`publicIdentifier`** — specifically named, as the single most
  likely field a naive Logging implementation would reach for.
- **`displayName`** — specifically named, for the same reason.
- **`avatar`** — specifically named, for the same reason.
- **Provider internal state** — `#observeBootstrap()` has no
  reference to `this.#service` and must never gain one.
- **Registry internal state** — `#observeBootstrap()` has no
  reference to `this.#registry` and must never gain one.
- **Storage** — no file, key-value, or persistence access of any
  kind.
- **Runtime Mode** — `Development`/`Production`/`Unknown`
  classification is out of scope for this Hook.
- **Runtime Platform** — OS/environment detection is out of scope for
  this Hook.
- **Secret material** — private keys, tokens, credentials, or any
  other sensitive value, wherever it might be reachable from.

## 5. Review confirmation, against the actual source

- **`#observeBootstrap()` does not read Descriptor content** —
  confirmed; its own body contains no statement, so it reads nothing,
  including its own `descriptor` parameter's fields.
- **`#observeBootstrap()` does not write Descriptor content** —
  confirmed; it contains no assignment of any kind, and
  `#completeBootstrap()` (Alpha 069) remains the sole writer of
  `#descriptor`.
- **`#observeBootstrap()` does not access the Registry** — confirmed;
  no reference to `this.#registry` anywhere in its own body.
- **`#observeBootstrap()` does not access the Provider** — confirmed;
  no reference to `this.#service` anywhere in its own body.
- **`#observeBootstrap()` does not access Storage** — confirmed; this
  class has never held a Storage reference, and this Hook adds none.
- **`#observeBootstrap()` does not write Runtime state** — confirmed;
  no assignment to `#descriptor` or `#bootstrapped`, the only two
  pieces of Runtime state this class holds.

## 6. Future guarantee

Regardless of which of the five permitted purposes (Metrics, Tracing,
Audit, Logging, Telemetry — per the Alpha 077 Contract) a future Stage
implements inside `#observeBootstrap()`, the SCOPE fixed by this Stage
must never be exceeded: only the Allowed Observation list in §3 may
ever be read or emitted; every item in the Forbidden Observation list
in §4 remains permanently out of reach for this Hook, no matter how
the implementation is written.

## 7. What this Stage does NOT do

- Does **not** change `#observeBootstrap()`'s own body — it remains
  the empty implementation Alpha 076 left it.
- Does **not** change `#bootstrapIdentity()`'s own body, statement
  order, or any call site.
- Does **not** implement any Metrics/Tracing/Audit/Logging/Telemetry
  behavior.
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

## 8. Summary

This Stage is a formal review, not an implementation. It fixes, as a
permanent boundary, the SCOPE of information `#observeBootstrap()` may
ever observe: coarse, fact-shaped signals about the Bootstrap attempt
itself (start, end, null-vs-non-null, timing, count, outcome) are
allowed; the Descriptor's own contents, Provider/Registry/Storage
internal state, Runtime Mode/Platform, and secret material are
forbidden, permanently, regardless of what future Observation
implementation is written. `#observeBootstrap()`'s own current empty
body trivially satisfies this Scope.

## 9. See also

- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_076_identity_bootstrap_observation_boundary.md`
- `docs/secure_runtime_alpha_077_identity_bootstrap_observation_contract.md`
- `docs/secure_runtime_alpha_078_identity_bootstrap_observation_ordering_review.md`
