# Review 18 — Protocol Delivery Boundary

## Construction stays independent of protocol publishing

Per this review's own required boundary, restated as an enforced
architectural fact rather than aspiration: `04`/`05`/`06`/`07`/`10`'s
own construction sequence never imports, calls, or references
`src/board/publish/`, `src/board/outbox/`, `src/desktop/websocket_relay.ts`,
or any Nostr/ActivityPub/AT Protocol/Session adapter. This mirrors
`FedosBoardRuntime`'s own EXISTING discipline exactly — its own header
already states "no `FedosBoardOutboxPublisher`/`.publish()` reference,"
confirmed in `01` by direct import inspection, and construction
inherits the identical boundary rather than introducing a new one.

## Why this separation matters specifically for private construction

A `federationEligibility` axis value of `"allowed"` on a
constructed private-group Policy (`07`) records INTENT only — exactly
as the EXISTING public `FEDOS_CONVERSATION_POLICY_PUBLIC_V1`'s own
`federationEligibility: "allowed"` value already does today, where
`evaluateFedosOutboundEligibility()` (a send-time, protocol-specific
gate) is the ONLY place that intent is ever actually checked against a
real Publisher, and today fails EVERY real target closed regardless
(`01`, confirmed via `test/reviews/conversation_foundation_v1/decision_consistency.test.ts`
item 8's `"identity-not-controlled"` grounding). Construction setting
`federationEligibility: "allowed"` on a private Conversation's Policy
therefore NEVER implies delivery will succeed, or even that delivery
will be attempted — this review's own required framing.

## Protocol-by-protocol status, marked for official research where required

- **Nostr** — a real, working Publisher exists for PUBLIC posts
  (`src/board/publish/nostr/`), gated fail-closed on unproven key
  control (`01`). No NIP-17 gift-wrap or private-DM-shaped envelope
  exists anywhere in `src/` — this matches the prior Security review's
  own §18 finding, unchanged at this later commit. **Requires official
  protocol research**: NIP-17 gift-wrap envelope semantics, Nostr
  group-DM conventions — this review does not guess at either, per its
  own "no external web research" ground rule.
- **ActivityPub** — no outbound Publisher of ANY kind exists in
  `src/board/publish/` (only `src/board/activitypub/fedos_activitypub_board_adapter.ts`,
  an INBOUND-post-validation adapter, confirmed by directory listing
  in `01`'s own source review). **Requires official protocol
  research**: ActivityPub's actual confidentiality guarantee for
  addressed-only delivery, and Group actor membership semantics —
  both named, neither resolved here.
- **AT Protocol** — same as ActivityPub: an inbound adapter exists
  (`src/board/atproto/`), no outbound Publisher. **Requires official
  protocol research**: AT Protocol's entire private-messaging story is
  unexamined by any source in this repository.
- **Session** — `src/board/session/fedos_session_board_adapter.ts`'s
  own header names encryption/decryption/DM retrieval as explicitly
  out of scope (confirmed directly, matching
  `test/reviews/private_conversation_security/source_inventory.test.ts`
  item 8's own grounding). **Requires official protocol research**:
  Session's entire private-delivery protocol — the largest gap of the
  four, per the prior Security review's own §20 finding, unchanged.

## Construction's own responsibility, stated once, plainly

Construction produces a Conversation record, a Policy, a Membership,
and (optionally) a Capability. It never produces an Outbox intent, a
signed event, or a delivery attempt of any kind for ANY protocol —
that remains exclusively `FedosBoardOutboxPublisher`/protocol-adapter
territory, a boundary this review inherits unmodified rather than
redraws.
