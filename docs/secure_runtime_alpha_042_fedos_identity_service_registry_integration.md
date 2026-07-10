# FedOS Secure Runtime Alpha 042 — FedOS Identity Service Registry Integration

**Status: IMPLEMENTED — one constructor signature change and one method
body change, in one file.** `FedosIdentityService` (Alpha 031) now takes
a required second constructor dependency, `FedosIdentityRegistry` (Alpha
041), and `describeIdentity()` registers a `FedosIdentityRecord` (Alpha
040) for every successful Descriptor before returning it unchanged.
`describeCapability()` is byte-for-byte unchanged. This is the
thirteenth artifact in the FedOS Identity arc (Alpha 028–042).

## 1. Why now

Alpha 041 built `FedosIdentityRegistry` explicitly to make
`FedosIdentityRecord` "usable at all... without yet deciding WHO
produces one" (Alpha 041 §1). This Stage is that decision, scoped as
narrowly as possible: `FedosIdentityService` is the ONE place in this
repository that already sits directly downstream of a real
`FedosIdentityProvider.describeIdentity()` call, making it the natural,
minimal-blast-radius place to introduce the first real Record producer
— no new class, no new file, one existing Service gaining one new
dependency and one new (small) step in an already-existing method.

## 2. The change

```ts
export class FedosIdentityService {
  readonly #provider: FedosIdentityProvider;
  readonly #registry: FedosIdentityRegistry;

  constructor(provider: FedosIdentityProvider, registry: FedosIdentityRegistry) {
    this.#provider = provider;
    this.#registry = registry;
  }

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    const descriptor = await this.#provider.describeIdentity();
    if (descriptor === null) {
      return null;
    }

    const record: FedosIdentityRecord = {
      id: descriptor.id,
      provider: descriptor.provider,
      publicIdentifier: descriptor.publicIdentifier,
    };
    this.#registry.register(record);

    return descriptor;
  }

  async describeCapability(): Promise<FedosIdentityCapability> {
    return { provider: this.#provider.provider, available: true };
  }
}
```

The flow this Stage's own mandate specified, realized exactly:

```txt
Provider
   |
   v
describeIdentity()          <- Provider's own call, unchanged
   |
   v
null? -----------------> return null (nothing registered)
   |
   v (real Descriptor)
map onto FedosIdentityRecord  <- verbatim field copy, no derivation
   |
   v
registry.register(record)     <- Registry's ONLY method this Service calls
   |
   v
return the ORIGINAL Descriptor (unchanged)
```

`describeCapability()`'s own body is untouched — still exactly
`return { provider: this.#provider.provider, available: true };`,
never reading the Registry, never calling `describeIdentity()`.

## 3. Serviceと Providerの責務 (boundary with `FedosIdentityProvider`)

**Unchanged from Alpha 031, reaffirmed.** The Service still calls
`provider.describeIdentity()` EXACTLY ONCE per `describeIdentity()`
invocation, still never calls it from `describeCapability()`, and still
returns the Provider's own result completely unmodified in the `null`
case. This Stage adds a step AFTER the Provider call returns, never
before it and never changing what the Provider is asked or how many
times — `NostrIdentityProvider`/`NoopFedosIdentityProvider` (both
confirmed byte-for-byte unchanged by this Stage's own guard test) see
zero difference in how they are called.

## 4. Serviceと Registryの責務 (boundary with `FedosIdentityRegistry`, Alpha 041)

**The Service calls exactly ONE Registry method — `register()` — and
never `find()`, `list()`, or `remove()`.** This is a deliberately
ASYMMETRIC relationship: the Service WRITES to the Registry (via
`register()`) but never READS from it. `register()`'s own return type is
`void` (Alpha 041 §2) — this Service never inspects, branches on, or
surfaces any value from the call, consistent with `register()` never
having one to surface. The Registry, from this Service's perspective, is
a write-only sink the Service feeds — never a data source the Service
consults. This mirrors Alpha 041 §5's own "no Provider constructs,
holds, or references a Registry" framing exactly one relationship
inverted: here, the Service (not a Provider) legitimately holds a
Registry reference, because THIS is the Stage explicitly authorized to
wire that specific connection, unlike Alpha 041's own explicit
prohibition on wiring it into any Provider.

## 5. Serviceと Descriptorの責務 (boundary with `FedosIdentityDescriptor`, Alpha 028)

**`describeIdentity()`'s own return value is, and remains, the
Provider's own Descriptor — byte-for-byte, never a copy, never a
Record-derived reconstruction.** The local `record` variable this
Stage's own code builds is a SEPARATE object, built by copying three
field values FROM `descriptor` — it is never assigned back into, and
never replaces, `descriptor` itself, and the method's own `return`
statement returns the original `descriptor` reference. A caller
comparing `identical === true` on the object returned by
`describeIdentity()` against what the injected Provider itself produced
would still find them reference-equal (mediated only by the `await`),
exactly as Alpha 031's own "pure delegation" design intended — this
Stage does not weaken that property; it adds a side effect ALONGSIDE it,
never a transformation of the return value itself.

## 6. Serviceと Recordの責務 (boundary with `FedosIdentityRecord`, Alpha 040)

**The Service is the FIRST, and so far only, code in this repository
that constructs a `FedosIdentityRecord` object literal.** The mapping is
intentionally the simplest one possible: `id`/`provider`/
`publicIdentifier` copied VERBATIM from the Descriptor, field for field
— no validation beyond what already happened inside
`NostrIdentityProvider`'s own `describeIdentity()` (Alpha 039 §6, which
already guarantees non-empty strings before a Descriptor is ever
produced), no reformatting, no enrichment, and critically, no attempt to
populate any field `FedosIdentityRecord` does not have (Alpha 040 never
added `displayName`/`avatar`/`linkedProtocols`/etc., and this Stage does
not either — see §9/§10 for why). This is the FIRST real evidence, in
code rather than prose, of Alpha 040 §3's own framing: "a Record, if a
future Stage ever builds the mechanism, would be assembled FROM one or
more Descriptors" — this Stage builds exactly that mechanism, in its
smallest possible form (one Descriptor, one Record, no reconciliation
across multiple Providers yet).

## 7. Serviceと Runtimeの責務 (boundary with Runtime)

**Zero Runtime reference of any kind, unchanged from Alpha 031.**
`fedos_identity_service.ts` imports nothing from `src/runtime/*`, and
`create_runtime.ts`/`types.ts`/every other `src/runtime/*` file has zero
reference to `FedosIdentityService`, `FedosIdentityRegistry`, or
`FedosIdentityRecord`, confirmed by this Stage's own guard test. This
Stage's registration step happens entirely within the Identity Layer's
own process memory (via the injected `FedosIdentityRegistry`'s own
`Map`) — Runtime remains completely unaware this Service, this Registry,
or this registration step exist.

## 8. Serviceと Storageの責務 (boundary with Storage)

**Zero Storage reference of any kind.** This Stage does not call
`storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()`, does not
reference any `RuntimeStorageBackend`, and does not make the Registry's
own registration durable across process restarts — `register()` writes
into `FedosIdentityRegistry`'s own in-memory `Map` only (Alpha 041 §7),
and this Stage's own new call site does not change that property in any
way. If Record persistence is ever built, Alpha 041 §10's own migration
direction (route through `storeCiphertext()`, never bypass it) still
applies unchanged — this Stage does not need, and does not attempt, to
pre-empt that future design.

## 9. ServiceがRegistry検索を担当しない理由 (why this Service does not perform Registry lookup)

Three independent reasons this Stage's own mandate enforces, each
sufficient alone:

1. **Registration and lookup are different responsibilities with
   different callers.** `describeIdentity()`'s own job (per Alpha 031's
   original design, unrevised) is "ask the Provider, return what it
   said" — a producer-side operation. Looking up an EXISTING Record by
   some caller-supplied `id` is a consumer-side operation with no
   natural place in a method whose entire signature is "no input, return
   the current Descriptor." Bolting a `find(id)`-shaped capability onto
   `FedosIdentityService` would require either a new method (out of this
   Stage's own scope, which touches only the constructor and
   `describeIdentity()`'s own body) or overloading `describeIdentity()`
   itself with an optional lookup parameter — a real API-shape decision
   this Stage's own narrow mandate does not authorize making.
2. **`FedosIdentityService` wraps exactly ONE Provider (Alpha 031's own
   permanent design), but a Registry lookup is naturally
   Provider-agnostic.** A caller asking "do I have a Record for this
   id" does not care WHICH Provider originally produced it — that
   question's natural home is something that sits ABOVE any single
   Provider-scoped Service, not inside one. Adding lookup here would
   mean every future multi-Provider Stage duplicates lookup logic once
   per Service instance instead of having ONE shared lookup surface.
3. **This Stage's own mandate states it directly**: "RegistryはRecord保
   持のみ担当。Service自身はRecord検索を行わない" — an explicit
   instruction this Stage treats as a hard boundary independent of the
   two structural reasons above.

## 10. 将来IdentityResolverがRegistry検索を担当する方針 (the future Identity Resolver direction for lookup — advisory only)

This Stage schedules nothing, but records the reasoning a future Stage
would need, mirroring how Alpha 021's own Storage Resolver
(`resolveRuntimeStorageBackend()`) sits ABOVE individual backends rather
than inside one:

1. **A future "Identity Resolver" (name provisional, not
   `fedos_identity_provider_resolver.ts` — that Resolver already has a
   fixed, unrelated meaning since Alpha 032: selecting WHICH Provider to
   construct) would be the natural home for `find(id)`/`list()`-shaped
   Registry consumption** — sitting above one or more
   `FedosIdentityService` instances (or their shared Registry), never
   inside any single Service.
2. **That future Resolver would consume the SAME `FedosIdentityRegistry`
   instance this Stage's Service already writes into** — no new Registry
   API is anticipated; Alpha 041's own `find()`/`list()`/`remove()`
   already exist and already fully cover the read side this Stage
   deliberately leaves unused.
3. **This Stage's own wiring does not foreclose that future design in
   any way** — `FedosIdentityRegistry` is a plain class, injectable
   anywhere; a future Resolver could receive the exact same instance
   this Stage's Service was constructed with, read-only, with zero
   change to this Stage's own file.
4. **Multi-Provider reconciliation (per Alpha 040 §1's own eventual
   "linkedProtocols" reason for `FedosIdentityRecord` existing at all)
   remains that future Resolver's own, still-undesigned, scope** — this
   Stage's own Service continues wrapping exactly one Provider, and
   registers exactly one Record per successful `describeIdentity()`
   call, with no cross-Provider awareness of any kind.

## 11. What this Stage does NOT do

- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028),
  `fedos_identity_provider.ts` (Alpha 029),
  `fedos_identity_capability.ts` (Alpha 030),
  `fedos_identity_record.ts` (Alpha 040), or
  `fedos_identity_registry.ts` (Alpha 041) — the Registry's own four
  methods are called (only `register()`), never modified.
- Does **not** modify `fedos_identity_provider_resolver.ts` (Alpha
  032/034/036), `fedos_noop_identity_provider.ts` (Alpha 033),
  `fedos_nostr_identity_provider.ts` (Alpha 035/039),
  `fedos_nostr_public_identity_source.ts`, or
  `fedos_null_nostr_public_identity_source.ts` (Alpha 039).
- Does **not** modify `create_runtime.ts` or any `src/runtime/*` file.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any existing `src/nostr/*` file.
- Does **not** call `registry.find()`, `registry.list()`, or
  `registry.remove()` anywhere — only `registry.register()`.
- Does **not** add authentication, credential, session, or Relay/DM
  handling of any kind.
- Does **not** add `displayName`, `avatar`, or any field to
  `FedosIdentityRecord`/`FedosIdentityDescriptor` beyond their existing
  three each.
- Does **not** add a Public Runtime API — `FedosIdentityService`'s own
  constructor is an Identity Layer-internal signature change, never
  reachable from `AppRuntime` or any Public Runtime API function.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.
- Does **not** change any Public Runtime API signature.

## 12. See also

- `docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md`
  (Secure Runtime Alpha 031) — the original single-dependency Service
  and its own "pure delegation, no internal logic" design this Stage
  extends by exactly one write-only side effect.
- `docs/secure_runtime_alpha_041_fedos_identity_registry.md` (Secure
  Runtime Alpha 041) — `FedosIdentityRegistry`'s own four methods, this
  Stage's own single consumed method (`register()`), and its own
  "zero producers" gap this Stage closes.
- `docs/secure_runtime_alpha_040_fedos_identity_record.md` (Secure
  Runtime Alpha 040) — `FedosIdentityRecord`'s own shape, this Stage's
  own first real constructor of one.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` (Secure
  Runtime Alpha 021) — the Resolver-sits-above-backends precedent §10's
  own future Identity Resolver direction is modeled on.
