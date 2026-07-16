# Secure Runtime Alpha 667 — BoardRuntime Command Integration

Stage 7 of Phase C. `FedosBoardRuntime.createPublicThread()`/
`replyToPublicThread()` (`src/board/runtime/fedos_board_runtime.ts`)
now run:

1. validate command (unchanged — reuses `validateFedosBoardPost`,
   plus an early `boardId`/`threadId` branding check before Authority
   calls).
2. resolve public author, via the injected `FedosPublicAuthorAuthority`.
3. resolve public conversation policy, via the injected
   `FedosConversationPolicyAuthority`.
4. assemble the canonical post (unchanged shape).
5. evaluate every requested target via
   `evaluateFedosOutboundEligibility()`.
6. submit.

Both methods are now `async`, returning
`Promise<FedosBoardRuntimeCommandResult>` — see
`docs/secure_runtime_alpha_641_current_identity_and_author_inventory.md`
§10 for the resulting test-suite ripple (7 files, `await` + `async`
callbacks added, zero assertions changed by that ripple alone).

## Ineligible-target policy: Option 2 adopted, not the nominally preferred Option 1

Compared:

- **Option 1** ("reject the whole command before any durable write")
  — the task's own nominally preferred choice.
- **Option 2** ("allow the local post; surface each ineligible target
  explicitly in the outbox result array") — Alpha 636's own
  already-shipped `"outbox-partial-failure"` behavior.

**Adopted: Option 2**, unchanged from Alpha 636. Reasoning: Option 2
already satisfies the actual concern behind Option 1's preference — "do
not silently ignore requested targets" — since every ineligible target
still appears in `outbox` with `result: "ineligible"`, never dropped.
Switching to Option 1 would discard a large, already-verified,
"Already Complete" test surface (Alpha 633/636/639) for no additional
safety benefit: the post itself remains valid and durable regardless;
only the OUTBOUND portion of the request partially failed, which
Option 2 already reports explicitly, never silently.

## The honest consequence

Phase C's own tightened eligibility (Alpha 665/666) means EVERY real
target is `"ineligible"` today — a real, resolved Nostr author
requesting a `"nostr"` target now ALSO reaches
`"outbox-partial-failure"` (collapsed into `result: "ineligible"`),
where Alpha 633's own original check would have accepted it. Three
pre-existing tests were updated to expect this corrected outcome:
`test/secure_runtime_alpha_633_outbound_eligibility.test.ts` item 6,
`test/secure_runtime_alpha_636_failure_matrix.test.ts` item 12,
`test/secure_runtime_alpha_639_end_to_end_verification.test.ts` item
1's outbound assertion.

## New command-result vocabulary

`FedosBoardRuntimeCommandResult`'s `"invalid-command"` reason gains two
values: `"unsupported-conversation-mode"` (structurally unreachable in
V1) and `"author-conflict"` (a resolved-but-malformed identity fails
closed, explicitly, rather than silently downgrading to anonymous or
silently reporting `"unavailable"`).
