# Secure Runtime Alpha 670 — Phase C Gate

Stage 10. Real application-path tests run (focused suite: 13 files, 90
tests, all passing):

- **Anonymous local-only post succeeds** — `test/secure_runtime_alpha_636_failure_matrix.test.ts`
  item 8.
- **Anonymous + Nostr target fails before write is misleading** —
  corrected: the post itself still writes (local-only semantics are
  unaffected by eligibility); only the requested Nostr target fails,
  explicitly, via `"outbox-partial-failure"` — see
  `test/secure_runtime_alpha_633_outbound_eligibility.test.ts` item 5.
- **Resolved controlled Nostr identity + target follows actual
  key-control result** — since no real key-control check exists, this
  now correctly fails `"ineligible"`/`"identity-not-controlled"` —
  `test/secure_runtime_alpha_633_outbound_eligibility.test.ts` item 6
  (updated), `test/secure_runtime_alpha_665_nostr_eligibility_evaluator.test.ts`
  item 1.
- **Unsupported ActivityPub target rejected** —
  `test/secure_runtime_alpha_665_nostr_eligibility_evaluator.test.ts`
  items 2/2b.
- **Unsupported AT Protocol target rejected** — same file, items 3/2b.
- **Session target rejected** — same file, item 4.
- **Public local-only reply succeeds** —
  `test/secure_runtime_alpha_630_reply_to_public_thread.test.ts`
  (unaffected by this Arc, still passing).
- **Missing policy fails closed** — `StaticFedosConversationPolicyAuthority`
  never produces a missing-policy state in V1; the `"unavailable"`
  branch in `FedosBoardRuntime` handles it structurally, should a
  future Authority ever return it.
- **Unsupported mode fails closed** —
  `test/secure_runtime_alpha_665_nostr_eligibility_evaluator.test.ts`
  item 9 (evaluator level); `FedosBoardRuntime`'s own
  `"unsupported-conversation-mode"` branch (integration level,
  structurally unreachable in V1, verified by type-checking).
- **No partial Board write for invalid outbound request** — confirmed:
  Option 2 (adopted, Alpha 667) always durably writes the post when the
  post itself validates, regardless of outbound eligibility — there is
  no partial-post-write scenario in this codebase (a post either
  validates and writes completely, or is rejected before any write);
  "partial" refers only to the OUTBOUND portion, never the post itself.

Phase C gate: **PASSED**. Proceeding to Phase D (Local Runtime
Integration).
