# Secure Runtime Alpha 755 — Reply Integration

Stage 15. `FedosBoardRuntime.replyToPublicThread()` NEVER creates a
second Conversation record — it only RESOLVES the already-existing one
via `#resolveConversationForReply()`, which calls
`FedosConversationReader.conversationForThread(boardId, threadId)`
(Alpha 753/757).

## Requirements, checked

- **Resolves existing Conversation from thread/root** — via
  `toFedosConversationId(boardId, threadId)`, no separate index needed
  (Alpha 747).
- **Never creates a second Conversation record for a reply** — no code
  path in `replyToPublicThread()` calls
  `#recordConversationForRootPost()` (that method is reachable only
  from `createPublicThread()`).
- **Preserves existing Board thread validation** — unchanged;
  `#assembleAndSubmit()` still routes through
  `FedosDesktopHost.submitPost()`/`submitPostWithOutbox()`'s own
  pre-existing thread-integrity precheck exactly as before this Arc.
- **Does not mutate the Conversation record** — `FedosConversationRecord`
  has no mutation method of any kind (Alpha 745); this method only
  reads one.
- **Does not change mode/policy** — a reply never touches
  `FedosConversationPolicyAuthority` differently than it already did
  before this Arc (Alpha 656's own policy resolution call in
  `replyToPublicThread()` is unmodified).

## Compatibility decision for old persisted threads without Conversation records

**`{ outcome: "not-found" }`.** A reply into a thread that predates
this Arc (no Conversation record exists for it) is NOT a reply-command
failure of any kind — the underlying Board reply already succeeded or
failed by the time `#resolveConversationForReply()` is ever called,
regardless of its own outcome. This is the direct consequence of Rule
10 ("Existing public Board behavior must remain compatible"): rejecting
a legitimate reply into legacy Board data would be a regression this
Arc must not introduce. See
`docs/secure_runtime_alpha_756_hydration_and_migration.md` for the
full "Option C" reasoning this decision is one half of.
