# FedOS Secure Runtime Alpha 043 — FedOS Identity Resolver (Registry Lookup)

**Status: IMPLEMENTED — a single, minimal class only.** Adds
`FedosIdentityResolver` (`src/identity/fedos_identity_resolver.ts`) —
the first, dedicated, READ-ONLY consumer of `FedosIdentityRegistry`
(Alpha 041), wrapping exactly two of its four methods (`find()`/
`list()`) behind `findIdentity()`/`listIdentities()`. No Runtime
connection, no Provider connection, no Storage persistence, no Worker,
no Rust. This is the fourteenth artifact in the FedOS Identity arc
(Alpha 028–043).

## 1. Why now

Alpha 042 §9/§10 explicitly deferred Registry LOOKUP to "a future
'Identity Resolver' (name provisional)... sitting above one or more
`FedosIdentityService` instances (or their shared Registry), never
inside any single Service" — while `FedosIdentityService` itself
(Alpha 042) gained the ability to WRITE into a Registry via
`register()`, nothing in this repository could yet READ from one except
tests constructing a `FedosIdentityRegistry` directly. This Stage is
exactly the deferred component Alpha 042 named, built to the smallest
possible shape: two methods, each a single pass-through, no new
capability the Registry did not already have.

## 2. The Resolver

```ts
export class FedosIdentityResolver {
  readonly #registry: FedosIdentityRegistry;

  constructor(registry: FedosIdentityRegistry) {
    this.#registry = registry;
  }

  findIdentity(id: string): FedosIdentityRecord | null {
    return this.#registry.find(id);
  }

  listIdentities(): readonly FedosIdentityRecord[] {
    return this.#registry.list();
  }
}
```

One private field (`#registry`, the injected `FedosIdentityRegistry`),
two methods, each calling exactly ONE Registry method and returning its
result unchanged:

- **`findIdentity(id)`** — `this.#registry.find(id)`, nothing added.
  Still resolves `null` for a missing `id`, exactly as `find()` itself
  does (Alpha 041 §2).
- **`listIdentities()`** — `this.#registry.list()`, nothing added.
  Still a fresh, `readonly FedosIdentityRecord[]` array on every call,
  exactly as `list()` itself does.

No constructor default, no configuration, no caching, no derived
state, no method beyond these two. `FedosIdentityResolver` is the ONLY
export of its own file.

## 3. 命名注記 (naming note — not the same "Resolver" as Alpha 032)

`FedosIdentityResolver` (this Stage) is UNRELATED to
`fedos_identity_provider_resolver.ts`'s own `resolveFedosIdentityProvider()`
function (Alpha 032/034/036/039) — the two share the English word
"resolver" and nothing else:

| | `resolveFedosIdentityProvider()` (Alpha 032) | `FedosIdentityResolver` (Alpha 043, this Stage) |
|---|---|---|
| **What it resolves** | WHICH `FedosIdentityProvider` implementation to construct and return | WHICH `FedosIdentityRecord` value(s) are currently registered |
| **Shape** | A single module-scoped function | A class with an injected dependency |
| **Reads from** | Nothing — constructs its own singleton | A `FedosIdentityRegistry` instance, injected |
| **Called by** | Nothing in this repository yet (zero real callers, Alpha 034 §-) | Nothing in this repository yet (zero real callers, this Stage) |
| **Relationship to each other** | NONE — neither imports, references, or is aware of the other |

This Stage confirms, by direct inspection, that its own new file
imports nothing from `fedos_identity_provider_resolver.ts`, and that
file's own guard tests (Alpha 032–039) continue asserting zero reference
in the opposite direction — the naming collision is coincidental and
this Stage does not attempt to rename either to avoid it, since both
names are already independently well-established across this arc's own
documentation.

## 4. ResolverとRegistryの責務 (boundary with `FedosIdentityRegistry`, Alpha 041)

**The Resolver calls exactly TWO Registry methods — `find()` and
`list()` — and NEVER `register()` or `remove()`.** This is the exact
mirror image of Alpha 042's own Service/Registry boundary: where the
Service WRITES only (`register()`, never `find()`/`list()`/`remove()`),
this Resolver READS only (`find()`/`list()`, never `register()`/
`remove()`). Neither component can, by its own code, do what the other
does — the Registry itself remains the ONLY place both capabilities
coexist, exactly as Alpha 041's own four-method design already made
possible without requiring the Registry itself to change at all (Alpha
041/043's own explicit "Registry API変更禁止" mandate, respected).

## 5. ResolverとServiceの責務 (boundary with `FedosIdentityService`, Alpha 031/042)

**No reference in either direction.** This Resolver does not import,
construct, or reference `FedosIdentityService`, and `fedos_identity_service.ts`
(confirmed byte-for-byte unchanged by this Stage's own guard test) does
not import, construct, or reference this Resolver either. The two
components are DELIBERATELY siblings, not a caller/callee pair, both
depending on the SAME injected `FedosIdentityRegistry` instance without
depending on each other — a future caller wanting the write side
constructs a `FedosIdentityService`; a future caller wanting the read
side constructs a `FedosIdentityResolver`; both would typically share
one Registry instance, but this Stage does not build, require, or
assume that any single caller ever holds both at once.

## 6. ResolverとProviderの責務 (boundary with `FedosIdentityProvider`, Alpha 029)

**Zero Provider reference of any kind.** `fedos_identity_resolver.ts`
imports nothing from `fedos_identity_provider.ts`,
`fedos_noop_identity_provider.ts`, or `fedos_nostr_identity_provider.ts`
— confirmed by direct inspection of its own two import lines (both
type-only, both naming Record/Registry types exclusively). This
Resolver cannot construct a Provider, cannot call `describeIdentity()`
on one, and structurally has no code path that could reach one — see §9
for the reasoning, not merely the observation.

## 7. ResolverとDescriptorの責務 (boundary with `FedosIdentityDescriptor`, Alpha 028)

**Zero Descriptor reference of any kind.** Neither `findIdentity()` nor
`listIdentities()` accepts, returns, or constructs a
`FedosIdentityDescriptor` anywhere — both methods are typed exclusively
against `FedosIdentityRecord`. This preserves Alpha 040 §3's own
Descriptor/Record distinction exactly: the Resolver operates entirely
on the CANONICAL side of that distinction, never touching the per-call,
per-Provider Read Model side. A caller wanting a live Descriptor (not
an already-registered Record) still has no path through this Resolver
at all — it must go through a Provider or a `FedosIdentityService`
instead, which this Resolver deliberately does not wrap or expose.

## 8. ResolverとRecordの責務 (boundary with `FedosIdentityRecord`, Alpha 040)

**The Resolver never constructs, validates, or modifies a
`FedosIdentityRecord` — it only returns whatever the Registry itself
already holds, unchanged.** `findIdentity()`'s own return value is
Registry-`get()`-then-`null`-coalesced, exactly as `find()` produces it;
`listIdentities()`'s own return value is Registry-`values()`-spread,
exactly as `list()` produces it. No field is read, copied, reformatted,
or filtered — this Resolver is, if anything, EVEN more purely a
pass-through than the Registry's own `find()`/`list()` methods are
relative to the underlying `Map`, since it adds no coalescing or
spreading logic of its own; it delegates both operations wholesale.

## 9. Resolverがregister()を持たない理由 (why this Resolver has no `register()`-shaped method)

Three independent reasons, mirroring Alpha 042 §9's own "why the
Service does not perform lookup" structure, inverted:

1. **Registration and lookup are still different responsibilities with
   different callers** (Alpha 042 §9, reason 1, restated from the
   opposite side) — a component whose own name and purpose is "Registry
   Lookup" gains nothing, and loses conceptual clarity, by also
   exposing a write path. A caller wanting to register a Record already
   has the correct place to do so: `FedosIdentityService.describeIdentity()`
   (Alpha 042), which performs registration as a SIDE EFFECT of a real
   Provider call — registration divorced from that context (a bare
   `resolver.register(record)` with no Provider having produced the
   Record) would let a caller register arbitrary, unverified data with
   no Provider ever having vouched for it.
2. **This Resolver's own read-only contract is a stronger, more
   auditable guarantee if it is structurally incapable of writing**, not
   merely conventionally discouraged from it. A future caller reviewing
   `fedos_identity_resolver.ts` in isolation can confirm, from the file
   alone, that nothing reachable through this class can ever mutate the
   Registry — a property that would be lost the moment ANY write-shaped
   method existed here, even one this Stage intended callers to avoid.
3. **This Stage's own explicit mandate states the boundary directly**:
   the exact class shape given (`findIdentity()`/`listIdentities()`
   only) is this Stage's own complete, non-negotiable scope — adding a
   third method would exceed it regardless of the two structural reasons
   above.

## 10. ResolverがProviderを直接呼ばない理由 (why this Resolver never calls a Provider directly)

- **This Resolver answers a different question than a Provider does.**
  A `FedosIdentityProvider.describeIdentity()` call answers "what does
  this ONE Provider currently, freshly report" (Alpha 029) — an
  operation that may involve real I/O in a future Source implementation
  (Alpha 039). `findIdentity()`/`listIdentities()` answer "what has
  ALREADY been registered" — a purely local, synchronous Registry read.
  Conflating the two would mean this Resolver sometimes does a fresh,
  possibly-slow lookup and sometimes returns cached data from the SAME
  method, an inconsistency this Stage avoids by construction: every
  method here is synchronous specifically because it never reaches
  outside the Registry's own in-memory `Map`.
- **Calling a Provider here would require this Resolver to hold one**,
  which would collapse the deliberate Resolver/Service sibling
  relationship (§5) into a Resolver that duplicates the Service's own
  Provider-holding responsibility — the opposite of the minimal,
  single-purpose component this Stage's own mandate requests.
- **This Stage's own explicit mandate states it directly**: "Providerを
  呼ばない" and "describeIdentity()を呼ばない" are both named exclusions,
  independent of the structural reasoning above.

## 11. ResolverとRuntimeの責務・ResolverとStorageの責務 (boundary with Runtime and Storage)

**Zero Runtime and zero Storage reference of any kind** — confirmed by
direct inspection: `fedos_identity_resolver.ts` imports nothing from
`src/runtime/*`, and `create_runtime.ts`/`types.ts`/every other
`src/runtime/*` file has zero reference to `FedosIdentityResolver`,
confirmed by this Stage's own guard test. Runtime remains
Crypto/Storage/Environment-only (Alpha 026 §4); this Resolver does not
create a fourth concern for it. Storage is untouched for the identical
reason Alpha 041 §7/Alpha 042 §8 already established for the Registry
and Service respectively — this Resolver reads only the Registry's own
in-memory state, never calling `storeCiphertext()`/`loadCiphertext()`/
`deleteCiphertext()` or referencing any `RuntimeStorageBackend`.

## 12. 将来create_runtime.tsへ配線する場合の方針 (the future `create_runtime.ts` wiring direction — advisory only)

This Stage schedules nothing, but records the reasoning a future Stage
would need, per this Stage's own explicit "Runtimeへは接続しない" scope:

1. **Any future wiring would add a NEW `AppRuntime` method** (e.g.
   something like `findIdentityRecord(id)`), never retrofit an existing
   Public Runtime API function — this arc has never modified an
   existing Public Runtime API signature to add unrelated capability,
   and a future Stage doing so for Identity lookup would be the first,
   requiring its own dedicated review of exactly that precedent.
2. **`AppRuntime` would need to hold, or be able to construct, BOTH a
   `FedosIdentityRegistry` and this `FedosIdentityResolver`** — today,
   `create_runtime.ts` has zero reference to any Identity-arc type
   (confirmed unchanged since Alpha 026 §4's own original finding); a
   future Stage would need to decide whether Runtime owns the shared
   Registry instance directly, or merely re-exposes a Resolver
   constructed elsewhere.
3. **This Resolver's own synchronous method signatures might need to
   change first.** If a future Registry implementation is ever
   non-Memory (Alpha 041 §10's own migration direction — `list()`
   becoming `async`), this Resolver's own `findIdentity()`/
   `listIdentities()` would need the identical signature change BEFORE
   any Runtime wiring could honestly expose them, since Runtime's own
   Public API has never silently swallowed an `async`/sync mismatch.
4. **This Stage's own wiring does not foreclose any of the above** — a
   plain, injectable class with a single dependency is, structurally,
   exactly what a future Runtime-wiring Stage would want to receive
   already-built, with zero change to this Stage's own file required to
   support it.

## 13. What this Stage does NOT do

- Does **not** modify `fedos_identity_registry.ts` (Alpha 041) — the
  Registry's own four methods (`register()`/`find()`/`list()`/
  `remove()`) are called (only `find()`/`list()`), never changed.
- Does **not** modify `fedos_identity_service.ts` (Alpha 031/042).
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029),
  `fedos_identity_descriptor.ts` (Alpha 028),
  `fedos_identity_capability.ts` (Alpha 030), or
  `fedos_identity_record.ts` (Alpha 040).
- Does **not** modify `fedos_identity_provider_resolver.ts` (Alpha
  032/034/036/039), `fedos_noop_identity_provider.ts` (Alpha 033), or
  `fedos_nostr_identity_provider.ts` (Alpha 035/039).
- Does **not** modify `create_runtime.ts` or any `src/runtime/*` file.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any existing `src/nostr/*` file.
- Does **not** call `registry.register()` or `registry.remove()`
  anywhere — only `registry.find()` and `registry.list()`.
- Does **not** call any `FedosIdentityProvider.describeIdentity()`
  anywhere.
- Does **not** add authentication, credential, session, or Relay/DM
  handling of any kind.
- Does **not** add `displayName`, `avatar`, or any field to
  `FedosIdentityRecord`/`FedosIdentityDescriptor`.
- Does **not** add a Public Runtime API — `FedosIdentityResolver` is an
  Identity Layer-internal class, never reachable from `AppRuntime` or
  any Public Runtime API function.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.
- Does **not** change any Public Runtime API signature.

## 14. See also

- `docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
  (Secure Runtime Alpha 042) — §9/§10's own "why the Service does not
  perform lookup" reasoning and future Identity Resolver naming this
  Stage directly executes.
- `docs/secure_runtime_alpha_041_fedos_identity_registry.md` (Secure
  Runtime Alpha 041) — `FedosIdentityRegistry`'s own four methods, this
  Stage's own two consumed methods (`find()`/`list()`), and the
  write-side (`register()`/`remove()`) this Stage deliberately never
  touches.
- `docs/secure_runtime_alpha_040_fedos_identity_record.md` (Secure
  Runtime Alpha 040) — `FedosIdentityRecord`'s own shape, this Stage's
  own return type for both methods.
- `docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md`
  (Secure Runtime Alpha 032) — the OTHER "Resolver" in this arc, §3's
  own naming-note comparison point.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` /
  `secure_runtime_alpha_024_dpapi_resolver_integration.md` (Secure
  Runtime Alpha 021/024) — the Resolver-sits-above-backends precedent
  §12's own future Runtime-wiring direction is modeled on.
