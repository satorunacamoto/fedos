# Secure Runtime Alpha 397 — Write Protocol Neutrality Verification

**Status: this Stage is verification only — it makes NO production
code change of any kind.** Stage 7 of the Alpha 391–400 Desktop Host
Durable Write Coordination Arc. Verifies, with real fixtures produced
by all four Board Adapters, that every protocol uses exactly the same
`submitPost()` path, with no protocol-specific branching.

## 1. Why now

`FedosBoardQuery`'s own READ-side protocol neutrality was already
verified by Alpha 379/389 (`recentFeed()`/`thread()` never branch on a
protocol string). This Stage verifies the same property holds for the
NEW write path: `submitPost()` accepts a plain `FedosBoardPost` — the
SAME normalized shape every one of the four Board Adapters already
produces (`validateNostrBoardPost`/`validateActivityPubBoardPost`/
`validateAtprotoBoardPost`/`validateSessionBoardPost`, Alpha 266–300,
unmodified) — with zero protocol-aware code anywhere in
`fedos_desktop_host.ts` or `fedos_board_service.ts`.

## 2. Method

Each of the four adapters' own known-good fixture (the SAME fixtures
Alpha 389 §2 already used, reused directly here — never re-derived) is
validated into a `FedosBoardPost` and submitted via
`host.submitPost()`, one call per protocol, no protocol-specific
branch in the calling test code either beyond selecting which
`validate*BoardPost` function to call — the SAME shape every existing
protocol-adapter caller already uses.

## 3. Structural confirmation

Direct inspection of `fedos_desktop_host.ts` (Alpha 395) and
`fedos_board_service.ts` (Alpha 395) confirms neither file contains
the literal string `"nostr"`, `"activitypub"`, `"atproto"`,
`"session"`, or `"fedos"` anywhere — the SAME structural guarantee
Alpha 389 §9 already confirmed for the Query layer, now confirmed for
the Write layer too. `submitPost()`'s own only protocol-adjacent
reference is the type `FedosBoardPost` itself, whose own `source.protocol`
field (Alpha 253, unmodified) is opaque data `submitPost()` never
inspects or branches on.

## 4. Result

All four protocols' own fixtures round-trip through
`submitPost() → host.query()` identically — inserted with the same
`FedosBoardRegistrationResult` outcomes an in-memory
`FedosBoardService.registerPost()` call would produce directly, durably
persisted (confirmed via the underlying `FedosBoardPersistence.listPosts()`),
and immediately visible via `query()` (Alpha 396). Cross-protocol
threading (an AT Protocol reply on an AT Protocol root, matching Alpha
389 §6's own cross-protocol thread fixture) resolves correctly through
`submitPost()` exactly as it did through direct `registerPost()` calls
previously.

## 5. Conclusion

`submitPost()` is protocol-neutral by construction — it operates
entirely on the already-normalized `FedosBoardPost` shape every
adapter already produces, with zero protocol-specific code added by
this Arc, confirmed both structurally (§3) and behaviorally with real
fixtures from all four adapters (§4).

## 6. See also

- `docs/secure_runtime_alpha_396_immediate_query_visibility.md`
- `docs/secure_runtime_alpha_395_host_write_api_implementation.md`
- `docs/secure_runtime_alpha_389_four_protocol_host_query_verification.md`
- `docs/secure_runtime_alpha_379_four_protocol_query_verification.md`
