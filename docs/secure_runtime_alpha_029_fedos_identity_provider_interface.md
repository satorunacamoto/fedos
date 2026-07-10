# FedOS Secure Runtime Alpha 029 — FedOS Identity Provider Interface

**Status: IMPLEMENTED — a single interface only.** Adds
`FedosIdentityProvider` (`src/identity/fedos_identity_provider.ts`) —
one field, one method, no implementation, no Resolver, no Service, no
Bridge, no Runtime wiring. This Stage continues Alpha 027's Option C
decision and Alpha 028's `FedosIdentityDescriptor`, adding exactly the
next-smallest artifact: the shape a future provider implementation
would satisfy, not the implementation itself.

## 1. Why now

Alpha 027 §6 named `Identity Provider Boundary` as the layer beneath a
future `FedOS Identity Service`, with TWO parallel occupants at that
layer: the existing, unmodified `provider_boundary.ts` (an
AUTHENTICATION-reference concern) and a FUTURE Protocol Identity
Provider (not yet named as a real type). Alpha 028 built the value
shape (`FedosIdentityDescriptor`) such a Provider would eventually
return. This Stage names the CONTRACT a Provider implementation would
satisfy to produce that shape — nothing more. No implementation, no
selection mechanism, and no wiring exists after this Stage, exactly as
after Alpha 028.

## 2. The Provider Interface

```ts
export interface FedosIdentityProvider {
  readonly provider: string;
  describeIdentity(): Promise<FedosIdentityDescriptor | null>;
}
```

- **`provider`** — a plain, unconstrained `string` label naming which
  provider this is (mirrors `FedosIdentityDescriptor.provider` exactly
  — see §3). Not a fixed union; no protocol-specific vocabulary is
  introduced by this Stage, continuing Alpha 028 §6's own deferral.
- **`describeIdentity()`** — the ONLY method. Async, taking no
  argument, resolving `FedosIdentityDescriptor | null`. `null` names
  "this provider currently has nothing to describe" — no identity is
  linked, no error is thrown, just an absence, matching the Fail-Closed
  "resolve a safe absence, never throw" shape every other opaque
  boundary in this arc already uses (`RuntimeStorageBackend.load()`,
  `provider_types.ts`'s own `IdentityProviderBoundary.getStatus()`,
  etc.).

**Exactly one method exists, and only one ever should.** `begin()`,
`login()`, `authenticate()`, and `create()` are explicitly, permanently
excluded from this interface — see §5.

No class, no default implementation (not even a Noop), no factory
function. `FedosIdentityProvider` is the ONLY export of its own file.

## 3. Descriptorとの責務分離 (separation from `FedosIdentityDescriptor`)

`FedosIdentityProvider` CONSUMES/PRODUCES `FedosIdentityDescriptor`
(Alpha 028, imported unchanged, `readonly id`/`provider`/`publicIdentifier`,
all `string`) — it does not define, extend, or modify that shape in any
way. The two types have cleanly separate jobs:

- `FedosIdentityDescriptor` — a pure VALUE. It says nothing about how it
  was obtained, and has no behavior of its own.
- `FedosIdentityProvider` — a pure CONTRACT for OBTAINING one (or
  learning that none currently exists). It has no fields beyond
  `provider`, and never embeds a Descriptor's own data as its own
  property.

The `provider` field appears on BOTH types with the SAME meaning (a
label naming the provider) — this is deliberate parallelism, not
duplication: a real implementation's own `provider` field and the
`provider` field on any `FedosIdentityDescriptor` it returns are
expected to agree, though this Stage defines no code that enforces it
(no implementation exists to enforce anything).

## 4. Runtimeとの責務分離 (separation from Secure Runtime)

`fedos_identity_provider.ts` imports NOTHING from `src/runtime/` — not
`FedosWasmLoader`, not `RuntimeStorageBackend`, not
`determineFedosRuntimeMode()`/`determineFedosRuntimePlatform()`, not any
Public Runtime API function. This is unchanged from, and consistent
with, Alpha 026 §3's own "Identity Layer MUST NOT... construct a
`FedosWasmLoader`/`RuntimeStorageBackend` instance directly" finding —
a FUTURE real implementation of this interface would be expected to
call Secure Runtime's own Public API (`encrypt()`/`storeCiphertext()`/
etc.) exactly like any other caller, never reach around it — but no such
implementation exists yet, so there is nothing to call anything, and
nothing this Stage wires together.

## 5. Authenticationとの責務分離 (separation from authentication)

**`describeIdentity()` is a READ, never an authentication flow.** This
is the single most important boundary this Stage draws, and the reason
`begin()`/`login()`/`authenticate()`/`create()` are permanently excluded
rather than merely deferred:

- The EXISTING `src/identity/provider_boundary.ts`'s own
  `IdentityProviderBoundary` (Alpha 027 §2, unmodified by this Stage)
  already models an authentication ATTEMPT — `getStatus()`/
  `getCapabilities()`/`begin(request)`/`cancel()`, with a real
  `idle → waiting → authenticated → cancelled/error` state lifecycle.
  That is a DIFFERENT, already-real, already-reviewed boundary for a
  DIFFERENT concern (Apple/Google/external/passkey AUTHENTICATION
  references).
- `FedosIdentityProvider` has NO status field, NO lifecycle, and NO
  method that starts, advances, or cancels anything. `describeIdentity()`
  can be called any number of times, in any order, with no side effect
  — a pure query, not a process.
- **A future real implementation MAY internally rely on some other
  boundary (e.g. the existing `IdentityProviderBoundary`, or a future
  Nostr-specific external signer) having already established that an
  identity is linked — but `FedosIdentityProvider` itself never
  performs, triggers, or represents that establishment.** It only ever
  reports the RESULT, as a value, after the fact.

This mirrors Alpha 025 §2's own distinction for Storage
(`AeadCiphertextHandle` — the OPAQUE, momentary value — vs.
`AeadCiphertextWire` — the STORABLE, at-rest form): here, the
DISTINCTION is between "the process of becoming linked" (explicitly
NOT this interface's job) and "the fact of currently being linked, as a
plain, re-checkable value" (this interface's ENTIRE job).

## 6. Protocol Adapterとの責務分離 (separation from Protocol Adapters)

A future Nostr/ActivityPub/AT Protocol/Session Adapter (Alpha 026 §5,
Alpha 027 §8 — none built) would eventually be composed with, or
directly implement, `FedosIdentityProvider` to produce a
`FedosIdentityDescriptor` FROM its own protocol-specific identity
concept (an `npub`, an actor URI, a DID) — but `fedos_identity_provider.ts`
itself carries ZERO protocol-specific vocabulary: no `"nostr"` literal,
no event/actor/DID field, nothing a Protocol Adapter's own shape would
need beyond the generic `provider: string`/`describeIdentity()`
contract. This is the SAME discipline Alpha 026 §5 already named ("each
Protocol must NOT bring its own event semantics down into Identity
Layer's own interface") and Alpha 028 §6 already applied to the
Descriptor's own `provider` field — continued here, one interface
level up.

## 7. 将来Resolverとの関係 (relationship to a future Resolver — not built)

A future Resolver (mirroring `resolveRuntimeStorageBackend()`'s own
"pick exactly one implementation, no fallback across implementations"
shape, Alpha 021/024) would eventually decide WHICH concrete
`FedosIdentityProvider` implementation a caller receives — this Stage
builds neither the Resolver nor any implementation for it to select
between. `FedosIdentityProvider` is deliberately the FIRST artifact in
that eventual chain, not the last: a Resolver cannot be meaningfully
designed before the shape it resolves TO is named, which is exactly
what this Stage does and no more.

## 8. What this Stage does NOT do

- Does **not** implement any `FedosIdentityProvider`, not even a Noop or
  Placeholder default.
- Does **not** implement a Resolver of any kind for this interface.
- Does **not** implement a FedOS Identity Service.
- Does **not** implement any Bridge (Identity ↔ anything).
- Does **not** add `begin()`, `login()`, `authenticate()`, `create()`,
  or any method beyond `describeIdentity()`.
- Does **not** modify `FedosIdentityDescriptor`
  (`fedos_identity_descriptor.ts`, Alpha 028) in any way.
- Does **not** modify `provider_boundary.ts`/`provider_types.ts` or any
  other existing `src/identity/*` file.
- Does **not** wire `FedosIdentityProvider` into Runtime, Worker, or any
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

## 9. See also

- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` (Secure
  Runtime Alpha 028) — the unmodified value shape this Interface's own
  `describeIdentity()` returns.
- `docs/secure_runtime_alpha_027_identity_foundation_inventory.md`
  (Secure Runtime Alpha 027) — the Option C decision and the existing
  `IdentityProviderBoundary`'s own real shape this Stage's §5 contrasts
  against.
- `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md`
  (Secure Runtime Alpha 026) — the Runtime/Protocol responsibility
  boundaries this Stage's §4/§6 reapply to the Provider Interface.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` /
  `secure_runtime_alpha_024_dpapi_resolver_integration.md` (Secure
  Runtime Alpha 021/024) — the Interface-then-Resolver sequencing this
  Stage's §7 continues for Identity, one step behind Storage's own.
