# Secure Runtime Alpha 646 — Public Author Authority Interface

Stage 6. The smallest interface, unchanged from the Arc's own
candidate:

```ts
export interface FedosPublicAuthorAuthority {
  resolvePublicAuthor(): Promise<FedosPublicAuthorResolution>;
}
```

## Implementations shipped this Arc

- `FedosDesktopPublicAuthorAuthority` — the DEFAULT PRODUCTION
  implementation `FedosBoardRuntime` constructs when no
  `publicAuthorAuthority` dependency is supplied (explicit, documented
  default — see Alpha 642's own "mirrors `idGenerator?`/`clock?`"
  note; not a hidden fallback, since this doc and the constructor's own
  doc comment both name it).
- `StaticFedosPublicAuthorAuthority` — fixed-resolution test/explicit-
  configuration double.
- `AnonymousLocalPublicAuthorAuthority` — explicit always-anonymous
  authority (Alpha 645).

No implementation of `FedosPublicAuthorAuthority` performs a Relay call,
Registry lookup, or Reader/Provider construction of its own — each
either wraps an already-existing `FedosDesktopHost`/`DesktopApplication`
read path, or returns a fixed value.
