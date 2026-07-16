# Secure Runtime Alpha 791 — Existing Storage and Deletion Inventory

Stage 1 of the Alpha 791–820 Conversation Retention & Private Payload
Storage Boundary Foundation Arc. Read-only inventory; no production
change in this Stage.

## Findings

1. **Existing delete methods.** None. `FedosConversationPersistence`
   (Alpha 749), `FedosBoardPersistence` (Alpha 315), and every
   append-only backend confirmed by direct inspection: `putX/getX/listX`
   only, no `delete` method anywhere.
2. **Existing tombstone concepts.** None implemented. Both prior reviews
   (`docs/reviews/board_runtime_conversation_foundation_02_conversation_lifecycle.md`,
   `docs/reviews/private_conversation_security/08_deletion_retention.md`)
   discuss lifecycle/deletion vocabulary at the design level only;
   `FedosBoardModerationRecord` (Alpha 258) is types-only, no `deleted`
   boolean.
3. **Existing compaction.** None. Every append-only backend's own
   header states "no compaction" as a hard guardrail.
4. **Existing encryption-at-rest.** None. `StorageBackend`
   (`src/storage/types.ts`, Stage 107) and `EncryptedPayloadDescriptor`
   (`src/storage/encrypted_payload.ts`, Stage 182–191) are both
   entirely label-only/placeholder — neither stores a real byte,
   neither connects to any cryptography.
5. **Existing payload-reference patterns.** `StorageRef`/`idRef`
   (`src/storage/types.ts`) is the closest precedent — an opaque,
   non-path label. This Arc's own `FedosConversationPayloadId` (Alpha
   802) follows the identical discipline.
6. **Existing corruption policy.** "Fail closed, never repair
   automatically" — confirmed uniform across `AppendOnlyFedosBoardPersistence`
   (Alpha 357) and `AppendOnlyFedosConversationPersistence` (Alpha 752).
   This Arc's own two new append-only backends (Alpha 752's
   retention/payload equivalents) adopt the identical policy.
7. **Existing restart/hydration policy.** `hydrateFedosConversations()`
   (Alpha 756) verifies persisted Conversation records against hydrated
   Board state at `startFedosDesktopRuntime()` startup. This Arc adds
   no new Runtime-level hydration step (Alpha 815: Option A, no Runtime
   wiring) — restart correctness for the new backends is verified
   directly (Alpha 812/819), not through `startFedosDesktopRuntime()`.
8. **Exact ripple scope.** New: `src/conversation/retention/` (7 files),
   `src/conversation/payload_storage/` (7 files). Zero modification to
   `src/conversation/persistence/`, `FedosConversationRecord`, Board
   persistence, Outbox, Observation, `FedosBoardRuntime`, or
   `startFedosDesktopRuntime()` — confirmed by
   `test/secure_runtime_alpha_816_no_duplication_guard.test.ts`.

Confirmed absent (not assumed): Alpha 761–790 does not exist as a
merged commit anywhere in this repository's history as of this Stage;
this Arc assumes nothing about its content, per its own precondition.
The Private Conversation Security Review and Conversation Foundation
V1 Specification Review (both never merged) remain readable via `git
show worktree-private-conversation-security-review:...`/`git show
worktree-conversation-foundation-v1-review:...` from this Arc's own
worktree.
