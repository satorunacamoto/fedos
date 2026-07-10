# FedOS Secure Runtime Alpha 031 — FedOS Identity Service Skeleton

**Status: IMPLEMENTED — a single, minimal class only.** Adds
`FedosIdentityService` (`src/identity/fedos_identity_service.ts`) — a
constructor taking exactly one `FedosIdentityProvider` (Alpha 029) and
two pass-through methods, `describeIdentity()`/`describeCapability()`.
No Resolver, no Provider implementation, no Runtime wiring, no Nostr
connection, no authentication. This is the first Stage in the FedOS
Identity arc (Alpha 028–031) to add a real CLASS with behavior, rather
than a value/contract type alone — but that behavior is, deliberately,
pure delegation and nothing more.

## 1. Why now

Alpha 028–030 named three independent artifacts: a value
(`FedosIdentityDescriptor`), a contract for obtaining one
(`FedosIdentityProvider`), and a value naming provider availability
(`FedosIdentityCapability`). None of them, on their own, gives a caller
a single object to hold and call both queries through. This Stage adds
exactly that — the smallest possible object composing the three
existing artifacts, with no new capability, no new type, and no
decision-making of its own.

## 2. The Service

```ts
export class FedosIdentityService {
  readonly #provider: FedosIdentityProvider;

  constructor(provider: FedosIdentityProvider) {
    this.#provider = provider;
  }

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    return this.#provider.describeIdentity();
  }

  async describeCapability(): Promise<FedosIdentityCapability> {
    return { provider: this.#provider.provider, available: true };
  }
}
```

One constructor parameter, one private field, two methods. No other
member exists. `FedosIdentityService` is the ONLY export of its own
file.

## 3. Service責務 (responsibility) — composition, not computation

`FedosIdentityService` exists to give a caller ONE object exposing both
existing queries (`describeIdentity()`, from Alpha 029's own
`FedosIdentityProvider`; `describeCapability()`, answering the question
`FedosIdentityCapability`, Alpha 030, names) instead of requiring the
caller to hold a bare `FedosIdentityProvider` and separately know how to
derive a `FedosIdentityCapability` from it. It is a COMPOSITION
convenience, not a new source of information — everything it can ever
report is already fully determined by the single `FedosIdentityProvider`
its constructor was given.

**No internal state beyond the injected dependency itself.** The
private `#provider` field is NOT "state" in the forbidden sense — it is
the unavoidable delegation target every object implementing a
constructor-injection pattern must hold to answer a LATER method call
with an EARLIER-supplied dependency. What this Service explicitly does
NOT hold: no cache of a previous `describeIdentity()` result, no
memoized `describeCapability()` value, no counter, no timestamp, no
lifecycle flag of any kind. Every call to either method re-delegates
from scratch; calling either method any number of times, in any order,
produces the SAME behavior as calling it once — pure delegation has no
memory.

## 4. Providerとの責務 (relationship to `FedosIdentityProvider`) — delegation only

`describeIdentity()`'s ENTIRE body is `return this.#provider.describeIdentity();`
— no wrapping, no error translation, no retry, no timeout, no
transformation of the result. Whatever the injected `FedosIdentityProvider`
resolves (a `FedosIdentityDescriptor` or `null`), the Service resolves
identically. `fedos_identity_provider.ts` (Alpha 029) is completely
untouched by this Stage — still exactly one method, `describeIdentity()`,
still no `describeCapability()` of its own (Alpha 030 §7 reviewed that
addition and explicitly declined to make it; this Stage does not revisit
that decision).

## 5. Descriptorとの責務 (relationship to `FedosIdentityDescriptor`)

The Service never constructs, validates, or modifies a
`FedosIdentityDescriptor` — it only ever returns exactly what
`FedosIdentityProvider.describeIdentity()` itself returned.
`fedos_identity_descriptor.ts` (Alpha 028) is untouched; its own three
fields (`id`/`provider`/`publicIdentifier`) are unchanged.

## 6. Capabilityとの責務 (relationship to `FedosIdentityCapability`) — the one real design decision this Stage makes

`FedosIdentityProvider` has NO `describeCapability()` method (§4) — so
`describeCapability()` cannot be pure method-delegation the way
`describeIdentity()` is. This Stage's own, narrowly-scoped answer:

```ts
async describeCapability(): Promise<FedosIdentityCapability> {
  return { provider: this.#provider.provider, available: true };
}
```

- **`provider`** is read directly off the `FedosIdentityProvider`
  object's own `provider` FIELD (not a method call) — still a form of
  delegation, just to a property instead of a method.
- **`available: true`** is not computed, cached, or inferred from
  calling `describeIdentity()` — it reports the ONLY fact this Service
  can observe without exceeding its own "delegate only" mandate: a
  `FedosIdentityProvider` object was successfully constructed and handed
  to this Service's own constructor. That is the minimal, honest
  definition of "available" available at this layer today.

**Why NOT call `describeIdentity()` to determine availability**: doing
so would mean `describeCapability()` internally pays the FULL cost of
the fuller identity query just to answer a cheaper question — directly
contradicting Alpha 030 §5's own reason `FedosIdentityCapability` exists
as a SEPARATE artifact from `FedosIdentityProvider` in the first place
("a caller could cheaply check availability before paying the cost of
the fuller query"). It would also mean interpreting a thrown
exception/`null` result as "unavailable," which is real inferential
LOGIC — exactly what this Stage's own "delegate only" constraint
forbids.

This is a real, narrow design decision, named here explicitly rather
than hidden inside the code: `available: true` will be accurate for
every `FedosIdentityService` this Stage's own code can construct today
(there is no other kind of `FedosIdentityProvider` to construct one
with), and a FUTURE, separately-reviewed Stage — once a real
`FedosIdentityProvider` implementation or a `describeCapability()`
method on the Provider Interface itself exists — may need to revisit
this method's own body. `fedos_identity_capability.ts` (Alpha 030)
itself is untouched; its own two fields are unchanged.

## 7. Resolverを持たない理由 (why this Service has no Resolver)

A Resolver (Alpha 021/024's own `resolveRuntimeStorageBackend()` shape)
exists to pick ONE implementation from among SEVERAL possible ones, when
the caller itself should not need to know which. `FedosIdentityService`
has no such problem to solve: its constructor takes the
`FedosIdentityProvider` to delegate to as a plain, direct argument —
DEPENDENCY INJECTION, not resolution. The CALLER decides which Provider
to construct the Service with; the Service itself never chooses,
searches, or falls back between multiple Providers. Building a Resolver
here would require something to resolve BETWEEN — and no second
`FedosIdentityProvider` implementation exists yet (Alpha 029/030 both
explicitly declined to implement one) — so a Resolver at this Stage
would have nothing real to select between, exactly the kind of
premature abstraction this arc has consistently avoided (most recently,
Alpha 025 §3's rejection of an "Arbitrary Object Store" for the
analogous reason: don't build a selection mechanism before there is
something real to select).

## 8. Runtimeとの責務分離 (separation from Secure Runtime)

`fedos_identity_service.ts` imports ONLY the three existing Identity
types (`FedosIdentityDescriptor`/`FedosIdentityProvider`/
`FedosIdentityCapability`, all type-only) — nothing from `src/runtime/`.
Unchanged from Alpha 026 §3/Alpha 029 §4/Alpha 030 §6: Runtime holds no
Identity semantics, and this Service holds no Runtime reference either.
A future real `FedosIdentityProvider` implementation would be expected
to call Secure Runtime's own Public API directly (per Alpha 026 §3) —
this Service, one layer above, never needs to know that, since it only
ever talks to the `FedosIdentityProvider` interface, never to whatever
sits behind it.

## 9. What this Stage does NOT do

- Does **not** implement a Resolver of any kind.
- Does **not** implement any `FedosIdentityProvider`.
- Does **not** add authentication, login, or connection status of any
  kind.
- Does **not** implement any Bridge (Identity ↔ anything).
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029) — still
  exactly one method, `describeIdentity()`, no `describeCapability()`.
- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028).
- Does **not** modify `fedos_identity_capability.ts` (Alpha 030).
- Does **not** modify `provider_boundary.ts`/`provider_types.ts` or any
  other existing `src/identity/*` file.
- Does **not** cache, memoize, or otherwise retain any result across
  calls.
- Does **not** wire `FedosIdentityService` into Runtime, Worker, or any
  other module — it has zero importers by design.
- Does **not** connect Nostr, ActivityPub, AT Protocol, or Session in
  any way.
- Does **not** change any `src/runtime/*` file or any Public Runtime
  API signature.
- Does **not** change `src/worker.ts`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.

## 10. See also

- `docs/secure_runtime_alpha_030_fedos_identity_capability.md` (Secure
  Runtime Alpha 030) — the unmodified `FedosIdentityCapability` value
  this Stage's §6 constructs, and the "reviewed, not added"
  `describeCapability()`-on-Provider decision this Stage does not
  revisit.
- `docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md`
  (Secure Runtime Alpha 029) — the unmodified `FedosIdentityProvider`
  contract this Service's own constructor requires and delegates to.
- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` (Secure
  Runtime Alpha 028) — the unmodified `FedosIdentityDescriptor` value
  `describeIdentity()` passes through unchanged.
- `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md`
  (Secure Runtime Alpha 026) — the Runtime/Identity responsibility
  boundary this Stage's §8 reapplies.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` /
  `secure_runtime_alpha_024_dpapi_resolver_integration.md` (Secure
  Runtime Alpha 021/024) — the Resolver shape this Stage's §7 contrasts
  its own constructor-injection design against.
