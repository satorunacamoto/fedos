# Secure Runtime Alpha 103 — Source Injection

**Status: this Stage IMPLEMENTS. It adds one new file,
`src/desktop/nostr_public_identity_reader.ts`, and modifies two
existing files, `src/desktop/desktop_application.ts` and
`src/desktop/create_desktop_application.ts`. This is Stage 3 of the
Alpha 101–105 Public Identity Source Foundation Arc.**

## 1. Why now

Alpha 101 defined `FedosPublicIdentityReader` with no implementation.
Alpha 102 decided `DesktopApplication` will own one. This Stage builds
the FIRST concrete implementation and wires the entire injection path:
`createDesktopApplication()` → generate a `NostrPublicIdentitySource`
→ wrap it in a `NostrPublicIdentityReader` → inject into
`DesktopApplication`.

## 2. What was implemented

### `NostrPublicIdentityReader` (new file)

```ts
export class NostrPublicIdentityReader implements FedosPublicIdentityReader {
  readonly #source: FedosNostrPublicIdentitySource;

  constructor(source: FedosNostrPublicIdentitySource) {
    this.#source = source;
  }

  async readPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
    // reads #source.readPublicIdentity(), validates id/publicIdentifier,
    // maps to a Descriptor with provider: "nostr" fixed
  }
}
```

Wraps exactly one injected `FedosNostrPublicIdentitySource`
(Alpha 039) and performs the SAME validation and mapping
`NostrIdentityProvider.describeIdentity()` (Alpha 035/039/046) already
performs — deliberately duplicated rather than reused, so this class
never depends on the Identity Layer's own Provider/Service pipeline.

### `DesktopApplication` (modified)

A new `readonly #reader: FedosPublicIdentityReader` field, and a new
constructor parameter with a default:

```ts
constructor(
  reader: FedosPublicIdentityReader = new NostrPublicIdentityReader(resolveNostrPublicIdentitySource()),
) {
  this.#identity = new FedosRuntimeIdentity();
  this.#reader = reader;
}
```

The default mirrors `NostrIdentityProvider`'s own Alpha 049
default-parameter pattern exactly — every existing no-argument
`new DesktopApplication()` call site, including every prior Stage's
own test suite, continues to work unchanged, since the default
resolves through the SAME `resolveNostrPublicIdentitySource()`
singleton that today always yields `NullNostrPublicIdentitySource`.
`#reader` is held but read by no method on this class yet.

### `createDesktopApplication()` (modified)

```ts
export function createDesktopApplication(): DesktopApplication {
  const source = resolveNostrPublicIdentitySource();
  const reader = new NostrPublicIdentityReader(source);
  return new DesktopApplication(reader);
}
```

Explicitly performs the injection this Stage's own title names, rather
than relying on `DesktopApplication`'s own default parameter silently
— functionally equivalent to the default, but explicit.

## 3. Behavioral equivalence confirmed

Since `resolveNostrPublicIdentitySource()` (Alpha 048) is fixed to
always return the shared `NullNostrPublicIdentitySource` singleton
today, EVERY observable behavior of `DesktopApplication` and
`createDesktopApplication()` remains byte-for-byte identical to before
this Stage — `bootstrap()`/`start()`'s own Bootstrap semantics are
completely unaffected; only a new, currently-unread field is added.

## 4. What this Stage does NOT do

- Does **not** add any public method to `DesktopApplication` that
  reads `#reader` — the Reader is held, not yet exposed or called.
- Does **not** open any Relay, WebSocket, or network connection of any
  kind — `NostrPublicIdentityReader` only ever calls
  `source.readPublicIdentity()`, and the injected Source
  (`NullNostrPublicIdentitySource`) performs no I/O of its own.
- Does **not** touch any secret key, signing, or GUI construct of any
  kind.
- Does **not** modify any `src/identity/*` file — only imports from
  existing, unchanged files.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** implement Observation of any kind.

## 5. See also

- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
- `docs/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver.md`
- `docs/secure_runtime_alpha_049_nostr_identity_provider_source_resolver_integration.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_102_desktop_identity_reader.md`
