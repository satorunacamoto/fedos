# Secure Runtime Alpha 7001–7080 — End-to-End Messaging Acceptance Report

**FedOS Desktop Beta Final Runtime Validation and End-to-End Messaging
Acceptance Arc.** Covers Phases G through M (session establishment,
message 1/2, duplicate/out-of-order, lock/shutdown/relaunch, message 3,
adjacent security features, crash recovery). Fail Closed over
fabrication: this report states plainly that the full real two-party
message round trip was **not completed and not proven** in this session,
and explains exactly why, rather than claiming partial evidence as if it
were the real thing.

## What is real and proven (the foundation this report builds on, not
fabricated)

- The production Direct Ratchet session-establishment/encrypt/decrypt/
  seal/restore layer itself is real and proven — at Node level, with real
  WASM and two independent real production authorities — by the
  immediately-prior Arc (Alpha 6921-7000, `1dfb7a48`). This Arc did not
  re-prove or weaken that.
- The real local WebSocket relay server fixture built this session is
  real and proven in isolation (smoke test, 1/1 passing): genuine RFC
  6455 handshake, genuine NIP-01 framing, real OK ack, real
  subscribe/unsubscribe/redeliver semantics.
- The `messageDelivery` wiring fix is real: `sendMessage()` now CAN route
  through Direct Ratchet when a caller opts in with a target
  `remoteDeviceRef` — confirmed by direct source read and by structural
  guard test 1, though not yet exercised end-to-end through a live
  two-party send in this session.
- The closed `fedos-acceptance:*` IPC vocabulary is real, wired, input-
  validated, and correctly gated to AUTOTEST-only mode (structural guard
  tests 3-7) — but was not driven end-to-end against a live spawned
  Electron process in this session.

## What blocked full completion (a real, disclosed constraint, not an
excuse)

A real Direct Conversation between two genuinely independent profiles
(separate Draft/Membership persistence, per Phase E's own "no shared
Runtime" requirement) requires the SECOND party to hold a LOCAL Draft
record for the SAME `conversationId` the first party generated
(`FedosConversationDirectActivationCoordinator.activateDirectConversation()`,
confirmed by direct source read: `Step 1 — find draft;` returns
`"conversation-not-found"` if the local `draftPersistence` has no record
for that id) plus a LOCAL "active" Membership entry for both parties.

`createDirectDraft()`'s own conversationId is not deterministically
derivable from the two participants alone (confirmed: `idempotencyKey` is
caller-supplied and optional; omitting it does not yield a value the
second party could independently recompute). The accepted, real mechanism
for a second party to learn of and join a conversation the first party
created is invitation/Capability redemption
(`FedosDesktopApplicationShell.issuedInvitations()`/`redeemInvitation()`).
Direct source read confirms `redeemInvitation()` is unconditionally
`"unavailable"` on this codebase's own current base — a pre-existing,
already-disclosed limitation (not created by this Arc, not something this
Arc's own narrow mandate authorizes closing, since implementing real
invitation redemption is itself a materially sized feature, not a narrow
acceptance-testability fix).

The only remaining route — test-side construction of a matching Draft +
Membership record directly on the second party's own persistence, the
SAME category of technique `secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts`
already uses for Device Trust (`seedTrustedDevicePair()`) — was
identified as viable but not implemented, verified, or debugged against a
real spawned Electron process within this session's remaining time.

## Consequence for Phases G through M

| Phase | Status |
|---|---|
| G — session establishment | NOT ATTEMPTED against a live two-party topology (blocked upstream by the Conversation/Membership gap above) |
| H — message 1 and message 2 | NOT ATTEMPTED |
| I — duplicate/out-of-order acceptance | NOT ATTEMPTED (the relay fixture itself supports it — `redeliverLast()` — but no live message flow exists to exercise it against) |
| J — lock/shutdown/relaunch | NOT ATTEMPTED |
| K — message 3 continuation | NOT ATTEMPTED |
| L — adjacent security features remain reachable | NOT VERIFIED through a live post-Ratchet-activation Runtime in this session (the underlying Shell methods for Peer Capability/Identity Transition/Signed Deletion/Safety Center were confirmed to already exist and be unmodified by this Arc — see the reconciliation report — but were not exercised together against a running instance) |
| M — crash recovery | NOT ATTEMPTED |

## Explicitly not fabricated

No log line, status field, or test assertion in this Arc's own new files
claims a message was sent, received, decrypted, or persisted through the
real two-party topology. The structural guards (Phase Q) prove only what
was actually built: the wiring fix, the two Shell wrappers, the
acceptance command vocabulary's own shape/gating, and the relay fixture's
own isolated correctness — never an end-to-end claim this report does not
back with a passing, real test.
