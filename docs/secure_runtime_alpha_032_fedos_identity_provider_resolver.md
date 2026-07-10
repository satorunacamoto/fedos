# FedOS Secure Runtime Alpha 032 — FedOS Identity Provider Resolver

**Status: IMPLEMENTED — a single function only.** Adds
`resolveFedosIdentityProvider()` (`src/identity/fedos_identity_provider_resolver.ts`)
— hardcoded to always return `null`, with no `if`, no `switch`, no
environment read, no Runtime Mode/Platform Authority reference, and no
Storage Resolver integration. This is the fifth artifact in the FedOS
Identity arc (Alpha 028–032), and — like every one before it — adds
exactly one seam, wired into nothing.

## 1. Why now

Alpha 031's `FedosIdentityService` takes a `FedosIdentityProvider`
directly, via constructor injection — the CALLER decides which Provider
to construct it with (Alpha 031 §7). That is correct for a Service that
has no Provider implementation to choose between yet, but it leaves an
open question for whenever a real Provider eventually exists: WHERE
should the decision "which Provider, right now" live, so that adding a
second, third, or fourth real Provider later touches exactly ONE
function rather than every call site that currently passes a Provider
by hand? This Stage answers that by building the seam itself, before any
real Provider exists to select — exactly the same sequencing Alpha 021
already used for Storage (Backend Interface + Resolver seam BEFORE any
real OS-backed backend existed, Alpha 021, followed by Alpha 023's real
DPAPI backend, followed by Alpha 024's real wiring).

## 2. The Resolver

```ts
export function resolveFedosIdentityProvider(): FedosIdentityProvider | null {
  return null;
}
```

One function, no argument, no branch. `resolveFedosIdentityProvider()`
is the ONLY export of its own file.

## 3. Resolver責務 (responsibility)

`resolveFedosIdentityProvider()` exists to answer exactly one question,
whenever a future caller asks it: **"which `FedosIdentityProvider`
should I use right now?"** Today, and for this Stage only, the answer is
unconditionally `null` — see §6 for why that is the correct answer, not
merely the simplest one. This function's job is NOT to construct a
Provider, NOT to validate one, and NOT to decide whether using one is
currently allowed (that would be an authorization question — this
function, like every other Authority/Resolver seam in this arc, is
strictly a selector, never a gate).

## 4. Serviceとの責務分離 (separation from `FedosIdentityService`)

`fedos_identity_provider_resolver.ts` does NOT import
`fedos_identity_service.ts`, and `fedos_identity_service.ts` (Alpha 031)
is untouched by this Stage — still requiring an explicit
`FedosIdentityProvider` constructor argument, still with zero default
value, still with zero reference to any Resolver. The two files are
mutually unaware of each other's existence. This is deliberate: wiring
`FedosIdentityService`'s constructor to call
`resolveFedosIdentityProvider()` as a default argument (mirroring how
`storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()` default
their own `storage` parameter to `resolveRuntimeStorageBackend()`,
Alpha 021) would be Runtime-style wiring this Stage's own mandate
explicitly forbids ("Service変更禁止"). That wiring, if it ever happens,
is its own future, separately-reviewed Stage's decision — not this
one's.

## 5. Providerとの責務分離 (separation from `FedosIdentityProvider`)

This file imports `FedosIdentityProvider` (Alpha 029) as a TYPE ONLY —
for its own return type annotation — and constructs, implements, or
mocks nothing shaped like one. `fedos_identity_provider.ts` is
completely untouched: still exactly one method, `describeIdentity()`.
The Resolver SELECTS a `FedosIdentityProvider`; it is never, itself, one.

## 6. Storage Resolverとの比較 (comparison against `resolveRuntimeStorageBackend()`)

| | `resolveRuntimeStorageBackend()` (Alpha 021/024) | `resolveFedosIdentityProvider()` (Alpha 032) |
|---|---|---|
| **Return type** | `RuntimeStorageBackend` (never `null`) | `FedosIdentityProvider \| null` |
| **Current behavior** | Returns a REAL, working `MemoryStorageBackend` singleton | Returns `null`, unconditionally |
| **Why it can return a real object today** | `MemoryStorageBackend` (Alpha 019) already existed BEFORE the Resolver itself was built (Alpha 021) — there was always a legitimate default to hand back | ZERO `FedosIdentityProvider` implementations exist anywhere in this repository as of this Stage — there is no legitimate object to hand back yet |
| **Selection logic today** | NONE at Alpha 021's own introduction (hardcoded to Memory); Runtime Mode + Platform conditions were added LATER, at Alpha 024, once a second real backend (Alpha 023's DPAPI) existed | NONE, and none is added by this Stage — explicitly forbidden by this Stage's own mandate regardless of whether a second Provider existed |
| **Depends on Runtime Mode/Platform Authority?** | Yes, as of Alpha 024 | No — explicitly forbidden this Stage ("Runtime Mode禁止", "Platform判定禁止") |
| **Sequencing precedent this Stage follows** | — | Mirrors Alpha 021's OWN original hardcoded-seam step exactly, one arc behind: seam first, real implementation later, selection logic later still |

**The key structural difference is not stylistic — it is honesty about
what currently exists.** Storage's Resolver returning a real object from
its very first Stage was correct precisely because a real object already
existed to return. Identity's Resolver returning `null` is equally
correct for the identical reason, inverted: no real object exists yet,
so claiming to resolve one — even a well-intentioned placeholder —
would misrepresent the system's own actual state.

## 7. なぜ今は`null`固定なのか (why `null`, fixed, right now)

Three independent reasons, each sufficient on its own:

1. **No real answer exists.** Every prior Stage in this arc (Alpha
   029/030/031) explicitly forbade implementing a real
   `FedosIdentityProvider`. A Resolver cannot honestly select among zero
   candidates — `null` is not a stand-in for "not implemented yet," it
   IS the accurate state.
2. **A placeholder object would be a worse answer than `null`.**
   Returning some `NoopFedosIdentityProvider`-shaped object (whose own
   `describeIdentity()` always resolves `null`) would LOOK like a real
   selection outcome to a future caller, when nothing was actually
   selected — an unnecessary, avoidable ambiguity `null` does not have.
   `null` unambiguously means "no Provider is currently resolvable,"
   full stop.
3. **This arc has never authorized building a "safe default" Provider.**
   Unlike Storage, where `MemoryStorageBackend` is both a real,
   permanently-useful backend AND a reasonable universal default (Alpha
   024 §6), no Stage in the Identity arc has designed, reviewed, or
   authorized ANY concrete `FedosIdentityProvider`, safe-default or
   otherwise — building one now, even a trivial one, JUST to give this
   Resolver something non-`null` to return, would be exactly the kind of
   unauthorized Provider implementation this Stage's own mandate
   forbids ("Provider実装禁止").

## 8. 将来Nostr Providerをここへ接続する理由 (why a future Nostr Provider would connect here)

When a future, separately-reviewed Stage eventually builds a real
`FedosIdentityProvider` implementation (a Nostr Provider being the most
likely first candidate, per Alpha 027 §8/Alpha 026 §5's own "Nostr as
first Protocol Adapter candidate" framing), the SINGLE function this
Stage names — `resolveFedosIdentityProvider()` — is where that decision
would be wired in, and NOWHERE else. This is the entire value of
building the seam before the implementation: every future caller of
`resolveFedosIdentityProvider()` (none exist yet — see §9) would
automatically observe a real Provider the moment this ONE function's own
body changes, without any of those callers themselves needing to change.
This Stage does not authorize, name, or sketch what that future
selection CONDITION would be (unlike Storage's own Alpha 024, which had
Runtime Mode + Platform to select on) — a Nostr Provider's own
availability likely depends on facts this arc has not yet built any
Authority for (e.g. "is an external NIP-07 signer present" — outside
this Stage's own scope entirely).

## 9. What this Stage does NOT do

- Does **not** implement any `FedosIdentityProvider` (Nostr or
  otherwise).
- Does **not** add any selection condition, `if`, or `switch` to the
  Resolver.
- Does **not** read `process.env`, call
  `determineFedosRuntimeMode()`/`determineFedosRuntimePlatform()`, or
  reference either Authority module.
- Does **not** integrate with, call, or reference
  `resolveRuntimeStorageBackend()` or any Storage Backend file.
- Does **not** modify `fedos_identity_service.ts` (Alpha 031) — its own
  constructor still requires an explicit `FedosIdentityProvider`
  argument.
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029).
- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028).
- Does **not** modify `fedos_identity_capability.ts` (Alpha 030).
- Does **not** add authentication, a Bridge, or any Nostr/ActivityPub/
  Bluesky/Session connection of any kind.
- Does **not** wire `resolveFedosIdentityProvider()` into Runtime,
  Worker, or any other module — it has zero importers by design.
- Does **not** change any `src/runtime/*` file or any Public Runtime
  API signature.
- Does **not** change `src/worker.ts`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.

## 10. See also

- `docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md`
  (Secure Runtime Alpha 031) — the unmodified `FedosIdentityService`
  this Resolver deliberately stays disconnected from.
- `docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md`
  (Secure Runtime Alpha 029) — the unmodified `FedosIdentityProvider`
  contract this Resolver's own return type names but never implements.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` /
  `secure_runtime_alpha_024_dpapi_resolver_integration.md` (Secure
  Runtime Alpha 021/024) — the Resolver shape and sequencing (seam
  first, implementation later, selection logic later still) this
  Stage's §6 explicitly compares itself against.
- `docs/secure_runtime_alpha_027_identity_foundation_inventory.md`
  (Secure Runtime Alpha 027) — the Nostr-as-first-Protocol-Adapter
  framing this Stage's §8 references.
