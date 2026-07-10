# Secure Runtime Alpha 050–052 — Identity Runtime Integration Arc

## 1. Why now

Alpha 027 through Alpha 049 built a complete Identity Layer entirely
inside `src/identity/*`, deliberately isolated from the Runtime,
Worker, and Rust — Source (Alpha 039) → Source Resolver (Alpha 048) →
Provider (Alpha 029/035/046/049) → Provider Resolver (Alpha
032/034/036) → Service (Alpha 031/042/047) → Registry (Alpha 041) →
Identity Resolver (Alpha 043). Every one of those Stages explicitly
forbade any Runtime connection. This three-Stage Arc is the first,
deliberately minimal crossing of that boundary: the Runtime now
constructs and internally holds the Identity Layer's own
Service/Registry/Resolver triad, without exposing anything about it to
`AppRuntime`'s own Public Runtime API, without touching Worker, and
without performing any real Nostr network activity.

## 2. Alpha 050 — Runtime Identity Authority

New `src/runtime/fedos_runtime_identity.ts` defines a single class,
`FedosRuntimeIdentity`:

```ts
export class FedosRuntimeIdentity {
  readonly #registry: FedosIdentityRegistry;
  readonly #service: FedosIdentityService;
  readonly #resolver: FedosIdentityResolver;

  constructor() {
    this.#registry = new FedosIdentityRegistry();
    const provider = resolveFedosIdentityProvider() ?? new NoopFedosIdentityProvider();
    this.#service = new FedosIdentityService(provider, this.#registry);
    this.#resolver = new FedosIdentityResolver(this.#registry);
  }

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    return this.#service.describeIdentity();
  }

  findIdentity(id: string): FedosIdentityRecord | null {
    return this.#resolver.findIdentity(id);
  }

  listIdentities(): readonly FedosIdentityRecord[] {
    return this.#resolver.listIdentities();
  }
}
```

The constructor wires all three Identity Layer objects to the SAME
`FedosIdentityRegistry` instance — the Service writes to it, the
Resolver reads from it — mirroring exactly how `FedosIdentityResolver`
(Alpha 043) has always required a Registry shared with whatever Service
populates it. The injected Provider is
`resolveFedosIdentityProvider() ?? new NoopFedosIdentityProvider()` —
the Resolver's own return type is nullable (`FedosIdentityProvider | null`,
a holdover from Alpha 032's own original, Provider-less scope), so the
same `NoopFedosIdentityProvider` (Alpha 033) fallback this repository
already built for exactly this situation resolves the type without
changing any observable behavior: `resolveFedosIdentityProvider()`
itself, as of Alpha 036/039/049, always returns the shared
`NostrIdentityProvider` singleton, never `null`, so the fallback is
never actually exercised today.

## 3. Alpha 051 — Runtime Identity Bootstrap

`create_runtime.ts`'s own `createRuntime()` function now constructs one
`FedosRuntimeIdentity` per call:

```ts
const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity();
void runtimeIdentity;
```

immediately before the `AppRuntime` object literal is built and
returned. `runtimeIdentity` is a local, function-scoped constant — it
is NEVER attached to that object literal, and no other file in this
repository imports or references `FedosRuntimeIdentity` at all. This
is "Runtime内部保持" in the most literal sense: the Identity Layer
triad exists, fully constructed, for the lifetime of a single
`createRuntime()` call, entirely internal to the Runtime's own
assembly process, invisible to every caller of `createRuntime()` and
to `AppRuntime`'s own type (`types.js`, itself byte-for-byte
unchanged). Construction happens unconditionally, before `resolveMode()`
is even consulted for the returned object's own `mode` field — Runtime
Mode plays no role in whether or how `FedosRuntimeIdentity` is built.

## 4. Alpha 052 — Integration Verification

This Stage adds no new source file — it is a verification pass,
carried out entirely in this Arc's own test suite. It confirms:
`FedosRuntimeIdentity` constructs without throwing under every
`RuntimeMode` this repository defines (`Development`/`Production`/
`Unknown`, driven the same way `resolveMode()`/Runtime Mode Authority
tests already drive it elsewhere in this repository); `describeIdentity()`
always resolves `null` (since the underlying `NostrIdentityProvider`
singleton is still wired to `NullNostrPublicIdentitySource`, per Alpha
049); `createRuntime()` itself still returns a structurally-correct
`AppRuntime` object for every mode, with every pre-existing field
(`storeCiphertext`/`loadCiphertext`/`deleteCiphertext`,
`initializeCrypto`, `runtimeCapabilities`, all six Crypto APIs, every
non-Identity adapter) behaving exactly as before this Arc; and that
constructing `FedosRuntimeIdentity` inside `createRuntime()` introduces
no new exception path, no new async operation before the function
returns, and no change to `createRuntime()`'s own synchronous,
side-effect-free contract.

## 5. Why this class wires Service/Registry/Resolver together, rather than leaving Runtime to construct each separately

A Runtime that constructed `FedosIdentityRegistry`,
`FedosIdentityService`, and `FedosIdentityResolver` as three
independent fields would need to get their wiring right at EVERY call
site that ever needed all three — passing the SAME Registry instance to
both the Service and the Resolver is a correctness requirement, not an
implementation detail, since a Resolver backed by a different Registry
than the one the Service writes to would silently never see anything
the Service ever registers. `FedosRuntimeIdentity` makes that
correctness requirement structurally impossible to violate: the
Registry is a private field, constructed once, and both the Service and
the Resolver are handed the exact same reference in the same
constructor call. This is the same "wire it once, correctly, in one
place" reasoning `create_runtime.ts` itself already applies to every
other subsystem it assembles.

## 6. Why this is not yet exposed on `AppRuntime`

This Arc's own mandate is explicit: no Public Runtime API addition, no
`AppRuntime` exposure, no Worker connection, no real Nostr
communication. `FedosRuntimeIdentity` existing and being constructed
inside `createRuntime()` is a necessary, but not sufficient, condition
for any future Public Identity API — this Arc deliberately stops at
"the Runtime CAN hold Identity Layer state correctly" without yet
answering "what should any caller of `AppRuntime` be allowed to do with
it," which fields such an API should expose, or what authorization
model should gate it. Those are each their own future,
separately-reviewed Stage's decision.

## 7. Why identity retrieval is always `null` today

`FedosRuntimeIdentity`'s own `describeIdentity()` is a pure
pass-through to `FedosIdentityService.describeIdentity()`, which itself
delegates to the shared `NostrIdentityProvider` singleton
`resolveFedosIdentityProvider()` resolves. That singleton is
constructed with `resolveNostrPublicIdentitySource()` as its default
Source (Alpha 049), which currently always resolves the shared
`NullNostrPublicIdentitySource` (Alpha 039/048) — a Source that always
resolves `null`. Every layer in this chain, from `NullNostrPublicIdentitySource`
up through `FedosRuntimeIdentity` itself, is therefore guaranteed to
report `null` today, by construction, without this Arc adding any new
`null`-forcing logic anywhere — it is simply the observable consequence
of every prior Stage's own deliberate, incremental "no real Source
implementation yet" decision.

## 8. What this Arc does NOT do

- Does **not** add any field to `AppRuntime` (`types.js`) — its own
  field set is byte-for-byte unchanged.
- Does **not** modify `fedos_identity_service.ts`, `fedos_identity_registry.ts`,
  `fedos_identity_resolver.ts`, `fedos_identity_provider_resolver.ts`,
  `fedos_nostr_identity_provider.ts`, `fedos_nostr_public_identity_source_resolver.ts`,
  `fedos_null_nostr_public_identity_source.ts`, `fedos_identity_descriptor.ts`,
  or `fedos_identity_record.ts`.
- Does **not** modify `src/worker.ts`, or reference it from either new
  file.
- Does **not** modify any `src/storage/*` or `src/runtime/fedos_runtime_storage_*`
  file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** perform any real Nostr Relay connection, event
  construction, signing, or DM feature.
- Does **not** change `initializeCrypto()`, `runtimeCapabilities()`, or
  any of the six Crypto Public Runtime APIs.
- Does **not** change `resolveMode()`'s own logic or any Runtime Mode
  Authority file.

## 9. Verification matrix (Alpha 052)

This Arc's own test suite exercises `createRuntime()` and
`FedosRuntimeIdentity` directly across three axes to satisfy Alpha
052's own mandate:

- **Runtime Mode**: `createRuntime()` with no `env` (`"test"` mode via
  `resolveMode()`), with a bare `env` object supplying no
  binding/endpoint (`"local"` mode), and with an `env` supplying at
  least one Cloudflare binding/endpoint (`"cloudflare"` mode) — all
  three confirmed to construct a structurally-correct `AppRuntime`
  without throwing, and each confirmed to leave `FedosRuntimeIdentity`'s
  own construction and behavior identical regardless of which mode was
  selected.
- **Identity retrieval**: a directly-constructed `FedosRuntimeIdentity`'s
  own `describeIdentity()` confirmed to resolve `null` in every one of
  the three Runtime Mode configurations above, `findIdentity()` on any
  id confirmed to resolve `null` before any registration ever occurs,
  and `listIdentities()` confirmed to resolve an empty array.
- **Non-interference**: every pre-existing `AppRuntime` field —
  `mode`, `eventCache`, `assetCache`, `spaceDirectory`, `metadataIndex`,
  `signatureVerifier`, `promotionProvider`, `recommendationProvider`,
  `relayPublisher`, `notificationBridge`, `paymentProvider`,
  `promotionProviderPreviewAllowed`, `webAuthnProvider`,
  `cryptoProvider`, `storageBackend`, `federationProvider`,
  `chatProvider`, `marketplaceProvider`, `creatorEntitlementProvider`,
  `crypto`, `initializeCrypto`, `runtimeCapabilities`, `randomBytes`,
  `generateAeadKey`, `encrypt`, `decrypt`, `exportCiphertext`,
  `importCiphertext`, `storeCiphertext`, `loadCiphertext`,
  `deleteCiphertext` — confirmed present and functioning exactly as
  before this Arc, via real calls where each field is itself callable,
  confirming that constructing a `FedosRuntimeIdentity` alongside them
  introduces no side effect, no shared mutable state, and no ordering
  dependency with any of the twenty-nine fields that already existed.

## 10. See also

- `docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md`
- `docs/secure_runtime_alpha_041_fedos_identity_registry.md`
- `docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
- `docs/secure_runtime_alpha_043_fedos_identity_resolver.md`
- `docs/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver.md`
- `docs/secure_runtime_alpha_049_nostr_identity_provider_source_resolver_integration.md`
