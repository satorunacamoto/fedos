# Secure Runtime Alpha 659 — Policy and Persistence Review

Stage 9. `FedosBoardPost`'s existing persistence record
(`src/board/persistence/fedos_board_post_codec.ts` and the append-only
Board log format) is NOT modified by this Arc — no `policy`/`mode`
field is added to a post's own durable shape.

`FEDOS_CONVERSATION_POLICY_PUBLIC_V1` is Runtime CONFIGURATION —
constructed fresh, in memory, by `StaticFedosConversationPolicyAuthority`
on every `resolvePolicy()` call — NOT persisted post state. Restarting
the Local Runtime (Phase D's own restart verification) always
re-resolves the SAME fixed policy; nothing is read back from a durable
log for policy.

## Migration requirements before private mode (future work)

Before any private/direct policy could vary per-Board, a real
persistence layer would need to be introduced (Option B, Alpha 654,
now with actual storage) keyed by Board/Conversation id, with an
explicit migration path for every Board this codebase's append-only
Board log already holds — none exists today, since every existing post
is implicitly `"public"`. This Arc records the requirement; it does not
build the migration.

No durable conversation-policy HISTORY is claimed anywhere — a policy
resolution today reflects only "what the current, in-memory Authority
would say now," never a versioned or auditable past state.
