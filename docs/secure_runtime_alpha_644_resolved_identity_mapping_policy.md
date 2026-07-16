# Secure Runtime Alpha 644 — Resolved Identity Mapping Policy

Stage 4. Mapping from `FedosIdentityDescriptor`
(`src/identity/fedos_identity_descriptor.ts`) to `FedosBoardAuthorReference`
(`src/board/fedos_board_author.ts`), implemented in
`FedosDesktopPublicAuthorAuthority.resolvePublicAuthor()`:

| Descriptor field | Author field | Policy |
|---|---|---|
| `publicIdentifier` | `publicIdentifier` | Preserved verbatim — never re-encoded, never hex-to-npub converted (no field of `FedosIdentityDescriptor` today carries a format this Arc would need to convert). |
| `id` | `identityId` | Preserved as-is, only when the Descriptor is accepted at all (see below). |
| `provider` | `protocol` | Preserved only when `isFedosBoardSourceProtocol(provider)` — otherwise the whole Descriptor is rejected to `"conflict"`, never partially mapped. |
| `displayName` | — | NEVER read or mapped — `FedosBoardAuthorReference` has no such field (Alpha 254's own deliberate exclusion, to avoid an immutable post going stale). |
| `avatar` | — | NEVER read or mapped, same reason. |

## Is `identityId === descriptor.id` valid and stable?

Yes. `FedosIdentityDescriptor.id` (Alpha 028) is documented as "a
caller-supplied opaque id" with no format constraint beyond being a
`string` — there is no narrower validity predicate this Arc could apply
to `id` alone that isn't already subsumed by accepting the Descriptor as
a whole (`provider` recognized + `publicIdentifier` non-empty). No
`null`-ing-out case exists: an accepted Descriptor's `id` is always
used, unmodified.

## Guardrails confirmed

No signature is created, no Relay is called, no protocol adapter is
invoked, and no Identity Runtime mutation occurs anywhere in this
mapping — `FedosDesktopPublicAuthorAuthority` calls only
`host.desktop()` and `.currentPublicIdentity()`, both pure, synchronous,
already-cached reads.
