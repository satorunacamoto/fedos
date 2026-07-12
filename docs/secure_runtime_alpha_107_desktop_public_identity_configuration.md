# Secure Runtime Alpha 107 — Desktop Public Identity Configuration

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
2 of the Alpha 106–110 Nostr Public Identity Implementation Arc.**

## 1. Why now

Alpha 106 confirmed `FedosNostrPublicIdentitySnapshot` already has the
exact shape (`id`, `publicIdentifier`, `displayName?`, `avatar?`) a
Desktop-level public identity configuration needs — no new type
required. This Stage gives `DesktopApplication` a place to hold such a
configuration, injectable at construction time, defaulting to unset.

## 2. What changed, recorded precisely

A new, SECOND, optional constructor parameter,
`publicIdentity: FedosNostrPublicIdentitySnapshot | undefined = undefined`,
and a new `readonly #publicIdentity` field storing it:

```ts
readonly #publicIdentity: FedosNostrPublicIdentitySnapshot | undefined;

constructor(
  reader: FedosPublicIdentityReader = new NostrPublicIdentityReader(resolveNostrPublicIdentitySource()),
  publicIdentity: FedosNostrPublicIdentitySnapshot | undefined = undefined,
) {
  this.#identity = new FedosRuntimeIdentity();
  this.#reader = reader;
  this.#publicIdentity = publicIdentity;
}
```

This is the ONLY change this Stage makes. The pre-existing `reader`
parameter (Alpha 103) stays FIRST, with its own default value
completely unchanged.

## 3. Why purely additive, and why SECOND, not FIRST

The new `publicIdentity` parameter is placed AFTER `reader`, not
before it, for a concrete, mechanical reason: JavaScript/TypeScript
default-parameter expressions may reference only EARLIER parameters,
never later ones. Since `reader`'s own default value
(`new NostrPublicIdentityReader(resolveNostrPublicIdentitySource())`)
does not, and by this Stage's own design cannot yet, depend on
`publicIdentity`, placing `publicIdentity` first would have offered no
benefit while breaking positional compatibility with every existing
call site. Placing it SECOND means the change is purely additive: `new
DesktopApplication()` and `new DesktopApplication(customReader)` —
every call site across Alpha 096–105's own test suites — continue to
work completely unchanged.

## 4. What this Stage deliberately leaves undone

`#publicIdentity` is held but read by NOTHING yet — no method on this
class references it, and `reader`'s own default-value expression does
not use it either. Wiring a configured `publicIdentity` into an actual
Source/Reader chain is explicitly Alpha 109's own deliverable, at the
`createDesktopApplication()` factory level — not inside this
constructor. This split mirrors the SAME "hold the shape now, wire the
behavior in a dedicated later Stage" discipline this whole project has
used repeatedly (Alpha 076's empty Observation Hook; Alpha 096's empty
`start()`; Alpha 102's design-only Reader-ownership Decision before
Alpha 103's own implementation).

## 5. What this Stage does NOT do

- Does **not** compute `reader`'s own default value from
  `publicIdentity` — the two parameters remain fully independent at
  this Stage.
- Does **not** add any public method that reads `#publicIdentity`.
- Does **not** implement `StaticNostrPublicIdentitySource` — that
  remains Alpha 108's own deliverable.
- Does **not** modify `create_desktop_application.ts`,
  `fedos_public_identity_reader.ts`, or `nostr_public_identity_reader.ts`.
- Does **not** modify any `src/identity/*` file — only imports the
  existing, unchanged `FedosNostrPublicIdentitySnapshot` type.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, WebSocket connections,
  NIP logic, event retrieval, signing, or DM handling of any kind.

## 6. See also

- `docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md`
- `docs/secure_runtime_alpha_049_nostr_identity_provider_source_resolver_integration.md`
- `docs/secure_runtime_alpha_103_source_injection.md`
- `docs/secure_runtime_alpha_106_public_identity_source_interface_review.md`
