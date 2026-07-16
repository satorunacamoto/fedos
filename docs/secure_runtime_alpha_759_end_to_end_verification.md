# Secure Runtime Alpha 759 — End-to-End Verification

Stage 19. `test/secure_runtime_alpha_759_end_to_end_verification.test.ts`
exercises the REAL, durable (file-backed
`AppendOnlyFedosBoardPersistence`/`AppendOnlyFedosConversationPersistence`)
backends across a genuine Host stop → fresh-runtime-restart → hydrate
cycle, mirroring `test/secure_runtime_alpha_639_end_to_end_verification.test.ts`'s
own established pattern.

## Verified

1. Start a Local Runtime with real append-only paths (Board, Outbox,
   Conversation).
2. Create a Public Thread through `FedosBoardRuntime`.
3. Verify the Board Post is durable (`findPost`).
4. Verify the Conversation Record exists (`findConversation`/
   `conversationForThread`), with the correct `mode`/`boardId`/
   `rootThreadId`/`rootPostId`/`policyReference`.
5. Reply into the thread.
6. Verify the reply resolves the SAME Conversation (`conversation.outcome
   === "existing"`, same `id`) — no second record created.
7. Stop the runtime.
8. Create a fresh runtime over the SAME durable paths.
9. Hydrate both Board and Conversation state.
10. Verify the mapping and reads survive intact across the restart.

## Also verified

- **Duplicate command** — resubmitting an already-durable post's own
  logical write is idempotent (`"already-present"`/`"already-recorded"`),
  never a second record.
- **ID conflict** — a genuine `FedosConversationPersistence` conflict
  surfaces `{ outcome: "conflict" }`, never silently swallowed.
- **Conversation persistence failure** — a failing
  `FedosConversationPersistence` surfaces `{ outcome: "persistence-failed" }`
  on the association result, while the underlying Board post remains
  durable and the command's own top-level `outcome` is unaffected.
- **Board write failure** — unchanged from pre-Arc behavior; no
  Conversation write is ever attempted for a post that never durably
  succeeded.
- **Legacy Board without Conversation** — a reply into a directly
  Board-persisted thread with no Conversation record surfaces
  `{ outcome: "not-found" }`, and the underlying reply still succeeds
  (Alpha 755/756's own Option C).
- **Independent runtimes** — two `startFedosDesktopRuntime()` calls
  produce fully independent Conversation persistence, exactly mirroring
  the pre-existing Board/Outbox independence guarantee (Alpha 618).
- **Unsupported private/direct fail closed** — no code path anywhere in
  this Arc constructs a `mode !== "public"` record;
  `validateFedosConversationRecord` rejects any attempt.
- **No Outbox behavior change** — `test/secure_runtime_alpha_633_outbound_eligibility.test.ts`,
  `_636_failure_matrix`, and `_637_four_protocol_boundary` all pass
  unmodified; Conversation recording never influences eligibility or
  delivery.
