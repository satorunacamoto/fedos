# Secure Runtime Alpha 794 — Retention State Model

Stage 4. `FedosPayloadRetentionState = "active" | "tombstoned" |
"payload-removed"` (`src/conversation/retention/fedos_payload_retention_state.ts`).

## `payload-removed`: a state, or a separate storage fact?

**A separate fact, with its own independent authority.** `payload-removed`
is never a mutable field written onto any existing record — it is
OBSERVED from the Retention Decision Log (a durable
`FedosPayloadRetentionDecision` record, Alpha 795), exactly the same
way `tombstoned` is. Preferring separate facts over a mutable field
matches this Arc's own explicit instruction and this codebase's
established "no mutable deleted boolean" discipline
(`FedosBoardModerationRecord`, Alpha 258; `FedosConversationRecord`,
Alpha 745).

`"active"` itself is never stored — it is the implicit default: the
absence of any decision record for a given payload id. This mirrors
`FedosConversationRecord`'s own decision to carry no lifecycle field at
all (Alpha 745) when nothing produces a transition.

## No Conversation lifecycle is introduced

This Arc concerns stored PAYLOAD retention only. No `archived`/`closed`
Conversation state is added — `FedosConversationRecord` (Alpha 745)
deliberately still carries no lifecycle field, and no real producer of
a Conversation-level lifecycle transition exists anywhere in this
codebase (confirmed unchanged,
`test/secure_runtime_alpha_816_no_duplication_guard.test.ts` item 1).
Conversation lifecycle and payload retention are two independent
concerns; conflating them was explicitly rejected.
