# Secure Runtime Alpha 643 — Public Author Resolution Result

Stage 3. `FedosPublicAuthorResolution`
(`src/board/runtime/identity/fedos_public_author_authority.ts`) is a
closed, four-outcome vocabulary — no adjustment from the Arc's own
candidate shape was needed:

```ts
export type FedosPublicAuthorResolution =
  | { readonly outcome: "resolved"; readonly author: FedosBoardAuthorReference }
  | { readonly outcome: "anonymous-local"; readonly author: FedosBoardAuthorReference }
  | { readonly outcome: "unavailable" }
  | { readonly outcome: "conflict" };
```

Never returned: a raw key, an `Error` object, a stack trace, a
Provider/Reader instance, or an arbitrary metadata bag — confirmed by
direct inspection of `FedosDesktopPublicAuthorAuthority.resolvePublicAuthor()`
(Alpha 647): its only two non-trivial return expressions construct a
frozen `FedosBoardAuthorReference` (already a closed, three-field type,
Alpha 254) or a bare outcome tag.

See Alpha 644/645 for exactly which real-world case maps to which of
the four outcomes.
