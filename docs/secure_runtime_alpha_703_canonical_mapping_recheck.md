# Secure Runtime Alpha 703 — Canonical Board-to-Nostr Mapping Recheck

Stage 3 of Phase B. Reviewed the existing publisher implementation
(`FedosRelayNostrBoardPublisher`, `FedosNostrBoardPublisherAdapter`,
`nostrWireEventToFedosEventDescriptor`) and confirmed all of it is correct
and byte-for-byte unchanged. The one addition,
`boardPostToNostrUnsignedEventRequest()`
(`src/board/publish/nostr/fedos_board_post_to_nostr_unsigned_event.ts`):

- **canonical `body` → `content`**: verbatim. ✅
- **canonical `createdAt` → `created_at`**: verbatim (already Unix
  seconds in both types). ✅
- **local controlled pubkey**: never read/written here — the pubkey is
  supplied entirely by `FedosNostrSigningAuthority.signEvent()` itself,
  derived from `accountIndex`, never from `post.author`. ✅
- **thread/reply tags**: **not populated in V1** — an honest, disclosed
  gap (see the file's own header). A real NIP-01 `"e"` reply tag needs the
  PARENT post's own previously-delivered Nostr event id, and
  `FedosDeliveryObservationRepository` exposes no `postId`-keyed lookup
  today (`get(id)`/`list()` only). Fabricating a wrong tag would be worse
  than omitting one — this is not a redesign of the Nostr Event model,
  only an honest acknowledgment of what this Arc's own mapping does not
  yet do.
- **supported kind**: fixed `1`, unchanged (Alpha 424).
- **no imported-author impersonation**: the mapping function never reads
  `post.author` or `post.source` at all (verified structurally,
  `test/secure_runtime_alpha_718_structural_security_guards.test.ts` test
  5).
- **no source-derived target**: the mapping never reads `post.source`.
- **no private content path**: `post.body` is the only content source,
  same as every other public post.
- **deterministic event fields**: `content`/`createdAt`/`kind`/`tags` are
  a pure function of `post` and `accountIndex`; only the signature itself
  (via the Signing Authority) and `id` (via its own deterministic hash)
  vary — and both are themselves deterministic given the same inputs.

The Nostr Event model itself (`FedosNostrWireEvent`,
`FedosNostrUnsignedEventRequest`) was not redesigned — no defect was
found in either.
