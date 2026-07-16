# Secure Runtime Alpha 661 — Existing Eligibility Inventory

Stage 1 of Phase C. Reviews `isEligibleForPublicOutboundTarget()`
(`src/board/runtime/fedos_board_runtime_outbound_eligibility.ts`, Alpha
633) — confirmed still present, unmodified:

- **Anonymous authors cannot publish** — `isAnonymousLocalAuthor()`
  check, unconditional reject.
- **Session public fanout is denied** — `"session"` excluded from
  `FEDOS_BOARD_RUNTIME_PUBLIC_ELIGIBLE_PROTOCOLS`.
- **Author/target protocol matching rule** — `author.protocol ===
  target.protocol`, the final check.
- **Explicit targets only** — confirmed: `FedosBoardRuntime` never
  derives a target from `post.source` anywhere (Alpha 668).
- **No source-derived targets** — same confirmation; the function
  itself takes no `FedosBoardPost` parameter.
- **No Publisher policy checks** — confirmed: no
  `FedosBoardOutboxPublisher` import anywhere in this file.
- **No Conversation policy checks** — confirmed: this Alpha 633 file
  predates Phase B entirely; it has no `FedosConversationPolicy`
  awareness. This is exactly the gap Phase C's own
  `evaluateFedosOutboundEligibility()` closes, by composing this
  existing function's own checks with the new Policy input, rather
  than duplicating its logic.

No live Publisher exists today for `"activitypub"`/`"atproto"`/
`"session"` — only `MockFedosBoardOutboxPublisher` and
`FedosWasmNostrSigningAuthority`-backed Nostr delivery are real
(`src/board/outbox/fedos_board_outbox_publisher.ts`).
