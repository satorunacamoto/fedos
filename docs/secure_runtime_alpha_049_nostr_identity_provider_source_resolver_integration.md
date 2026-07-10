# Secure Runtime Alpha 049 — Nostr Identity Provider Source Resolver Integration

## 1. Why now

Alpha 039 gave `NostrIdentityProvider` a required constructor
parameter — an injected `FedosNostrPublicIdentitySource` — and every
caller since then has had to supply one explicitly.
`fedos_identity_provider_resolver.ts` (Alpha 039) does this by
constructing `new NullNostrPublicIdentitySource()` inline, directly
inside its own shared-singleton initializer, every time it builds the
shared `NostrIdentityProvider`. Alpha 048 then introduced
`resolveNostrPublicIdentitySource()` — a dedicated, single-purpose
seam for Source selection — but left it completely unwired: nothing in
this repository called it.

This Stage is the wiring Alpha 048 explicitly deferred. The
constructor's `source` parameter now DEFAULTS to
`resolveNostrPublicIdentitySource()` when a caller omits it, so a bare
`new NostrIdentityProvider()` now resolves a real, correctly-selected
Source automatically — while every existing call site that still
passes a Source explicitly (including every prior test file's
`FakeSource`/`NullNostrPublicIdentitySource` construction) continues to
work identically, since a default parameter only applies when the
argument is omitted.

## 2. The change

`src/identity/fedos_nostr_identity_provider.ts` — before:

```ts
constructor(source: FedosNostrPublicIdentitySource) {
  this.#source = source;
}
```

after:

```ts
constructor(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource()) {
  this.#source = source;
}
```

Plus one new import: `import { resolveNostrPublicIdentitySource } from "./fedos_nostr_public_identity_source_resolver.js";`.
`describeIdentity()`'s own body — the Source read, the try/catch, the
null check, both `id`/`publicIdentifier` presence checks, and the final
Descriptor object literal including `displayName`/`avatar` — is
confirmed byte-for-byte unchanged. No other file is modified:
`fedos_nostr_public_identity_source_resolver.ts` (Alpha 048),
`fedos_null_nostr_public_identity_source.ts` (Alpha 039),
`fedos_identity_descriptor.ts`, `fedos_identity_record.ts`,
`fedos_identity_registry.ts`, `fedos_identity_resolver.ts`, and every
Runtime, Worker, and Rust file are all confirmed byte-for-byte
unchanged.

## 3. なぜProviderがResolverだけを見る構造なのか (why the Provider depends only on the Resolver, never on a concrete Source)

`NostrIdentityProvider`'s new default value is a CALL to
`resolveNostrPublicIdentitySource()`, not a direct reference to
`NullNostrPublicIdentitySource` or any other concrete class. The
Provider's own source code still imports only the
`FedosNostrPublicIdentitySource` TYPE from `fedos_nostr_public_identity_source.js`
for its field and parameter types — it imports the Resolver FUNCTION,
not any concrete Source implementation. This preserves the exact
separation Alpha 039 established: the Provider depends on the
Interface for its own internal typing, and now depends on the Resolver
— a single function whose entire job is "hand back today's correct
Source" — for its default value. If the Resolver's own answer changes
in the future (Alpha 048 §4/§6), the Provider's own source code does
not need to change at all, because it never named a concrete Source
class itself.

## 4. なぜNullSourceを直接newしないのか (why the constructor does not default to `new NullNostrPublicIdentitySource()` directly)

A direct `new NullNostrPublicIdentitySource()` default would work
today — it is, after all, exactly what `resolveNostrPublicIdentitySource()`
itself currently returns — but it would silently reintroduce the exact
problem Alpha 048 was built to solve: Source selection logic
duplicated in two places (this constructor AND
`fedos_identity_provider_resolver.ts`'s own inline construction),
instead of named once. Depending on the Resolver instead of
duplicating its current answer means: (1) there is exactly ONE place
in this repository that decides which concrete Source class is
"current" — `fedos_nostr_public_identity_source_resolver.ts` itself —
and (2) a future Stage that changes the Resolver's own answer (Alpha
048 §7) automatically changes what every future bare
`new NostrIdentityProvider()` call receives, with zero additional
edits anywhere else. Depending on the concrete class directly would
mean this file, not the Resolver, is secretly the "real" Source
selection authority — exactly the buried, unnamed decision Alpha 048
existed to give a home to.

## 5. Storage Backend Resolverとの構造比較 (structural comparison with the Storage Backend Resolver)

`fedos_runtime_storage_resolver.ts`'s own `resolveRuntimeStorageBackend()`
is used as a constructor/function-parameter DEFAULT VALUE in exactly
this same shape, at three call sites inside
`fedos_runtime_ciphertext_storage.ts`:
`storage: RuntimeStorageBackend = resolveRuntimeStorageBackend()`. This
Stage adopts the identical pattern one layer over, in the Identity
Layer rather than the Storage Layer:
`source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource()`.
Both share the same three properties: (1) the resolved value is a
DEFAULT, not a forced dependency — an explicit argument always wins;
(2) the resolver function is called exactly once, at the moment the
default is evaluated, never re-evaluated later; (3) the consuming
file's own logic (`describeIdentity()` here, `store()`/`load()`/`delete()`
there) is completely unaware of which concrete implementation the
resolver actually returned. The one structural difference: the Storage
Resolver itself contains real selection logic (Runtime Mode × Platform
branching, Alpha 024), while the Nostr Source Resolver (Alpha 048)
today is a fixed, unconditional return — this Stage does not add any
selection logic anywhere; it only wires the Provider to whatever the
existing, already-reviewed Resolver returns.

## 6. 将来Filesystem/SQLite/Profile Cache/Remote FetchへProviderを変更しなくてよい理由 (why swapping the Source implementation will still never require modifying the Provider)

This Stage strengthens, rather than weakens, Alpha 048 §7's own
guarantee. Before this Stage, a future Filesystem/SQLite/Profile-Cache/
Remote-Fetch Source would require editing whichever call site
constructed the Provider (today, `fedos_identity_provider_resolver.ts`'s
own inline `new NullNostrPublicIdentitySource()`) to inject the new
Source. After this Stage, the SAME future change requires editing
exactly one function body — `resolveNostrPublicIdentitySource()`'s own
`return` statement — and every bare `new NostrIdentityProvider()` call
anywhere in this repository, present or future, picks up the new
Source automatically, with zero Provider-side change and zero change
to any OTHER call site that also relies on the default. Explicit
injection remains available for tests and for any caller that
deliberately wants a specific Source regardless of what the Resolver
would choose — that path is untouched by this Stage and requires no
change either, now or after any future Source swap.

## 7. What this Stage does NOT do

- Does **not** modify `fedos_nostr_public_identity_source_resolver.ts`
  (Alpha 048) — its own single function and fixed `NullNostrPublicIdentitySource`
  return value are unchanged.
- Does **not** modify `fedos_null_nostr_public_identity_source.ts`
  (Alpha 039).
- Does **not** modify `fedos_identity_descriptor.ts`,
  `fedos_identity_record.ts`, `fedos_identity_registry.ts`, or
  `fedos_identity_resolver.ts`.
- Does **not** modify `fedos_identity_provider_resolver.ts` (Alpha
  032/034/036/039) — it continues to construct its own
  `NullNostrPublicIdentitySource` inline, unaffected by this Stage's
  new default parameter.
- Does **not** implement any real public-identity retrieval logic —
  Filesystem, SQLite, Profile Cache, and Remote Fetch all remain named,
  future, unimplemented candidates.
- Does **not** change `describeIdentity()`'s own body in any way — the
  Source read, the try/catch, the null check, both presence checks, and
  the Descriptor construction (including `displayName`/`avatar`
  forwarding, Alpha 046) are all byte-for-byte unchanged.
- Does **not** modify `create_runtime.ts`, any `src/runtime/*` file, or
  any Public Runtime API signature.
- Does **not** change `Cargo.toml`, any Rust source, or `package.json`.

## 8. What explicit injection still means after this Stage

Nothing about explicit Source injection changes. `new NostrIdentityProvider(mySource)`
still constructs a Provider backed by exactly `mySource`, ignoring the
Resolver entirely — the default parameter is only ever consulted when
the constructor is called with ZERO arguments. This matters for two
groups of callers this Stage must not disturb: every existing test
file across this arc (Alpha 035/039/044/045/046) that constructs a
`FakeSource`, a `NullNostrPublicIdentitySource`, or another
hand-written fake and injects it directly, and any future real caller
that deliberately wants to bypass whatever the Resolver would choose
(for example, a test harness verifying behavior against a specific,
non-default Source implementation). Both groups continue to work
exactly as before this Stage, unmodified, because JavaScript/TypeScript
default parameters are evaluated only in the absence of an explicit
argument — this is ordinary language semantics, not a new behavior
this Stage introduces or has to guard specially.

## 9. Why a default parameter, not an overloaded constructor or a separate factory function

Three shapes could express "usually resolve the Source automatically,
but still allow explicit injection": a default parameter value (what
this Stage uses), a second, separate static factory method (e.g. a
`NostrIdentityProvider.createDefault()` alongside the existing
constructor), or constructor overloading. A default parameter was
chosen because it keeps the class to exactly ONE construction path —
matching this file's own long-standing "SINGLE CLASS, one constructor
parameter" framing (Alpha 035/039) — rather than introducing a second,
parallel way to obtain a `NostrIdentityProvider` that callers would
need to choose between. It is also the same shape already proven at
`fedos_runtime_ciphertext_storage.ts`'s own three `resolveRuntimeStorageBackend()`
call sites (§5), so this Stage introduces no new pattern into this
repository, only reuses an existing, already-reviewed one.

## 10. See also

- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
- `docs/secure_runtime_alpha_046_nostr_identity_provider_descriptor_expansion.md`
- `docs/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver.md`
- `docs/secure_runtime_alpha_024_dpapi_resolver_integration.md`
