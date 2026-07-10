# Secure Runtime Alpha 048 — FedOS Nostr Public Identity Source Resolver

## 1. Why now

Alpha 039 through Alpha 047 built a complete, deliberately incremental
pipeline: `FedosNostrPublicIdentitySource` (Alpha 039, the Boundary
contract) → `NullNostrPublicIdentitySource` (Alpha 039, its only
implementation) → `NostrIdentityProvider` (Alpha 035/039, consumes a
Source) → `FedosIdentityDescriptor` (Alpha 028/045) →
`FedosIdentityRecord` (Alpha 040/047) → `FedosIdentityRegistry` (Alpha
041) → `FedosIdentityResolver` (Alpha 043). At every step so far, the
ONE place in this repository that decides which `FedosNostrPublicIdentitySource`
to use has been `fedos_identity_provider_resolver.ts` (Alpha 039),
which constructs `new NullNostrPublicIdentitySource()` inline, directly
inside its own shared-singleton initializer.

That inline construction has worked because there has only ever been
one Source implementation to choose. This Stage adds a name for that
choice — `resolveNostrPublicIdentitySource()` — without adding a second
implementation to choose between yet. The goal is purely structural:
give Source selection its own seam, mirroring the seam
`resolveFedosIdentityProvider()` (Alpha 032) already gives Provider
selection, one layer lower in the pipeline, so that a future Stage can
introduce a real Source implementation and a real selection rule
without touching `NostrIdentityProvider` or
`fedos_identity_provider_resolver.ts` at all.

## 2. The change

New `src/identity/fedos_nostr_public_identity_source_resolver.ts`:

```ts
import type { FedosNostrPublicIdentitySource } from "./fedos_nostr_public_identity_source.js";
import { NullNostrPublicIdentitySource } from "./fedos_null_nostr_public_identity_source.js";

const sharedNullSource: FedosNostrPublicIdentitySource = new NullNostrPublicIdentitySource();

export function resolveNostrPublicIdentitySource(): FedosNostrPublicIdentitySource {
  return sharedNullSource;
}
```

One file, one function, one module-scoped singleton — the same shape
`fedos_identity_provider_resolver.ts` (Alpha 032) uses for
`resolveFedosIdentityProvider()`. No other file in this repository is
modified: `NostrIdentityProvider`, `NullNostrPublicIdentitySource`,
`fedos_identity_provider_resolver.ts`, `FedosIdentityService`,
`FedosIdentityRegistry`, `FedosIdentityResolver`, and every Runtime,
Worker, and Rust file are all confirmed byte-for-byte unchanged.
Nothing in this repository imports the new file yet — it exists,
tested, and unwired, exactly as `FedosIdentityRecord` (Alpha 040) and
`FedosIdentityRegistry` (Alpha 041) each did on their own first day.

## 3. なぜResolverを挟むか (why a dedicated Resolver is introduced now)

Without this Stage, "which Source does the shared Provider use" is
answered by one specific line inside
`fedos_identity_provider_resolver.ts`'s own module-scope initializer —
a decision buried inside a DIFFERENT Resolver's own construction logic,
rather than named and owned by its own seam. That was an acceptable
shortcut when only one Source implementation existed anywhere, but it
means any future Stage that wants to introduce a second Source
implementation and a real selection rule between them would have to
edit `fedos_identity_provider_resolver.ts` itself — a file whose own
job is Provider selection, not Source selection — to do so. Introducing
`resolveNostrPublicIdentitySource()` now, while the answer is still
trivial, gives Source selection its own single, dedicated home before
any real selection logic needs to exist, so that logic can be added
later purely inside this new file.

## 4. なぜ今はNullSource固定か (why this Resolver is fixed to `NullNostrPublicIdentitySource` today)

This Stage's own mandate is explicit: no real public-identity retrieval
is implemented here. There is exactly one `FedosNostrPublicIdentitySource`
implementation in this repository — `NullNostrPublicIdentitySource`
(Alpha 039) — so `resolveNostrPublicIdentitySource()` has exactly one
correct value to return, unconditionally. This mirrors
`resolveFedosIdentityProvider()`'s own Alpha 039 revision, which
likewise construct-injects `NullNostrPublicIdentitySource` with no
condition, no environment read, and no configuration — a single,
unconditional construction, not a selection between real alternatives.
Fixing the return value now, rather than leaving it `null` or throwing,
lets every downstream consumer treat this Resolver's return type as a
real, always-usable `FedosNostrPublicIdentitySource` — matching how
`NostrIdentityProvider` itself is always constructed with a real
Source object, never `null`.

## 5. Noop Providerとの違い (difference from `NoopFedosIdentityProvider`, Alpha 033)

`NoopFedosIdentityProvider` is a concrete `FedosIdentityProvider`
IMPLEMENTATION — a class satisfying the Provider contract with a fixed,
permanently-`null` `describeIdentity()` body, usable anywhere a real
Provider is expected. `resolveNostrPublicIdentitySource()` is not an
implementation of anything — it is a SELECTOR, a function whose only
job is to hand back whichever `FedosNostrPublicIdentitySource`
instance is currently the right one to use. The two solve different
problems at different layers: `NoopFedosIdentityProvider` answers "what
does a deliberately-inert Provider look like," while this Stage answers
"which Source instance does the rest of the system currently use."
`NullNostrPublicIdentitySource` (this Resolver's own fixed return
value) is the Source-layer analogue of `NoopFedosIdentityProvider` —
also deliberately inert — but this Resolver itself is a different kind
of object: a lookup function, not an implementation.

## 6. Identity Provider Resolverとの違い (difference from `resolveFedosIdentityProvider()`, Alpha 032)

Both Resolvers share the same SHAPE — one exported function, one
private shared singleton, no condition — but resolve different layers
of the same pipeline. `resolveFedosIdentityProvider()` answers "which
`FedosIdentityProvider` does this repository currently expose,"
returning `FedosIdentityProvider | null` (nullable, because Alpha 032
originally had no Provider at all to return). This new Resolver answers
one layer lower: "which `FedosNostrPublicIdentitySource` does the
Nostr Provider currently read from," returning a non-nullable
`FedosNostrPublicIdentitySource` — every Source implementation,
including the Null one, is a valid, always-present object, so there is
no `null` case to represent. The two Resolvers are not wired together
by this Stage: `fedos_identity_provider_resolver.ts` continues to
construct its own `NullNostrPublicIdentitySource` inline, exactly as
it did before this Stage, and does not call
`resolveNostrPublicIdentitySource()`. That wiring — replacing the
inline construction with a call to this new Resolver — is explicitly
left to a future, separately-reviewed Stage.

## 7. 将来Filesystem/SQLite/Nostr Profile Cache/Remote Sourceなどへ切り替える場合でもNostrIdentityProviderを変更しない理由 (why swapping the Source implementation will never require modifying `NostrIdentityProvider`)

`NostrIdentityProvider` (Alpha 035/039/046) depends only on the
`FedosNostrPublicIdentitySource` INTERFACE (Alpha 039), injected
through its own constructor — it has never imported
`NullNostrPublicIdentitySource` or any other concrete Source class
directly, and this Stage does not change that. A future Filesystem,
SQLite, Nostr-profile-cache, or Remote Source implementation would be a
NEW class implementing the same `FedosNostrPublicIdentitySource`
interface, and the only code that would ever need to change to start
using it is whatever constructs the Source that gets injected — today,
that is the inline `new NullNostrPublicIdentitySource()` call inside
`fedos_identity_provider_resolver.ts`; after a future Stage wires this
Resolver in, it would be the single `return` statement inside
`resolveNostrPublicIdentitySource()` itself. Either way,
`NostrIdentityProvider`'s own source code never needs to know which
concrete Source implementation exists — that is the entire purpose of
depending on the interface rather than a concrete class, and this
Stage's own Resolver is a second, independent confirmation of that
boundary holding, not a new one.

## 8. What this Stage does NOT do

- Does **not** modify `fedos_nostr_identity_provider.ts` (Alpha
  035/039/046) — it continues to depend only on the
  `FedosNostrPublicIdentitySource` interface, unaware this new Resolver
  exists.
- Does **not** modify `fedos_null_nostr_public_identity_source.ts`
  (Alpha 039) — its own single class and single always-`null` method
  are unchanged.
- Does **not** modify `fedos_identity_provider_resolver.ts` (Alpha
  032/034/036/039) — it continues to construct its own
  `NullNostrPublicIdentitySource` inline, not via this new Resolver.
- Does **not** modify `fedos_identity_service.ts`,
  `fedos_identity_registry.ts`, or `fedos_identity_resolver.ts`.
- Does **not** implement any real public-identity retrieval —
  Filesystem, SQLite, Nostr profile cache, and Remote Source all remain
  named, future, unimplemented candidates.
- Does **not** add any condition, environment read, or configuration to
  Source selection — the return value is a single, unconditional
  constant.
- Does **not** wire this new Resolver into `fedos_identity_provider_resolver.ts`
  or anywhere else — it is exported, tested, and otherwise unreferenced.
- Does **not** modify `create_runtime.ts` or any `src/runtime/*` file.
- Does **not** change `Cargo.toml`, any Rust source, or `package.json`.
- Does **not** change any Public Runtime API signature.

## 9. Summary

This Stage adds exactly one new file, `fedos_nostr_public_identity_source_resolver.ts`,
containing exactly one exported function and one private module-scoped
singleton. It gives Nostr public-identity Source selection its own
dedicated seam — the same shape `resolveFedosIdentityProvider()`
already established for Provider selection one layer higher — while
changing zero observable behavior anywhere in this repository: the new
function is not called by anything, `NostrIdentityProvider` continues
to receive its Source exactly as it always has, and every other file in
the Identity Layer, the Runtime, the Worker, and the Rust crate remains
byte-for-byte unchanged. The value of this Stage is entirely structural
and preparatory — it exists so that a future Stage introducing a real
Source implementation and a real selection rule between multiple
Sources can do so by editing exactly one function body, in exactly one
file, without touching `NostrIdentityProvider`, the Identity Provider
Resolver, the Service, the Registry, or the Resolver that already
exist.

## 10. See also

- `docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md`
- `docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md`
- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
- `docs/secure_runtime_alpha_047_fedos_identity_record_expansion.md`
