# Secure Runtime Alpha 379 — Four-Protocol Query Verification

**Status: this Stage verifies existing, unmodified behavior end to
end — no production code change.** Stage 9 of the Alpha 371–380
Canonical Board Query Foundation Arc.

## 1. Requirement

Register fixtures from Nostr, ActivityPub, AT Protocol, and Session —
the same four real, unmodified Board Adapters Alpha 309/339/359 each
already exercised for a different layer — into a real
`FedosBoardService`, then exercise `FedosBoardQuery` against them.

## 2. What is verified

- **`recentFeed()` returns all four protocols' own posts, correctly
  ordered**, mirroring Alpha 309 §4's own "protocol origin does not
  affect ordering" finding, now confirmed at the QUERY layer rather
  than the raw `FedosBoardFeed` layer.
- **`recentFeed({ protocol: "..." })` correctly isolates each protocol
  in turn** — filtering to `"nostr"` returns ONLY the Nostr-sourced
  post, filtering to `"activitypub"` returns ONLY the ActivityPub one,
  and so on for all four, plus confirming a fifth, never-registered
  protocol value (`"fedos"`, Alpha 253's own reserved fifth token)
  correctly yields zero matches without error.
- **`thread()` correctly groups a CROSS-PROTOCOL reply** — the same
  Nostr-root/AT-Protocol-reply fixture Alpha 309 §5 and Alpha 339 §2
  each already used, now queried through `thread()` and confirmed to
  return both posts in chronological (`createdAt` ASC) order,
  regardless of which two protocols are involved.
- **`authorPublicIdentifier` filtering works identically across
  protocols** — each protocol's own author field
  (`npub...`/an ActivityPub actor URI/a DID/a Session identifier) is
  matched exactly, confirming the filter performs no protocol-specific
  parsing or normalization of any kind (matching Alpha 253's own
  "opaque reference" discipline).
- **Pagination composes correctly with a mixed-protocol result set** —
  requesting `limit: 2` over a four-protocol feed returns exactly two
  posts, in the correct order, with `hasMore: true` and `total: 4`.
- **No adapter is modified** — every fixture's own known-good
  validated shape (mirroring Alpha 309 §15/§359 §6's own identical
  regression discipline) is reproduced unchanged before being queried.

## 3. Why this Stage matters beyond Alpha 377's own ordering proof

Alpha 377 proved ordering determinism with generic fixtures. This
Stage proves the QUERY LAYER's own real-world purpose — a client
reading a genuinely multi-protocol Board — works end to end, with
REAL adapter output, not synthetic `FedosBoardPost` values constructed
by hand. This is the same "real fixtures through all four real,
unmodified Board Adapters" discipline every prior integration-verification
Stage in this Arc's own lineage has applied (Alpha 309, Alpha 339,
Alpha 359), now extended to the query layer specifically.

## 4. Conclusion

`FedosBoardQuery` — both `recentFeed()` and `thread()`, with every
filter dimension and pagination — works correctly against real,
multi-protocol Board data, confirmed by direct execution using the
same real adapters every prior Board Arc has relied on for this exact
class of verification.

## 5. See also

- `docs/secure_runtime_alpha_378_performance_review.md`
- `docs/secure_runtime_alpha_377_deterministic_ordering_verification.md`
- `docs/secure_runtime_alpha_309_four_protocol_board_integration.md`
- `docs/secure_runtime_alpha_359_four_protocol_append_only_verification.md`
