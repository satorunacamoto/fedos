# Secure Runtime Alpha 756 — Hydration and Migration

Stage 16. `hydrateFedosConversations()`
(`src/conversation/fedos_conversation_hydration.ts`) — unlike
`hydrateFedosBoardService` (Alpha 318), builds NO in-memory
service/index (Alpha 753 already decided none is needed). Its only job
is verifying every persisted Conversation record's own root/thread
reference against the ALREADY-hydrated Board state, failing closed on
any mismatch or corrupt record. Called once, at
`startFedosDesktopRuntime()` startup (Alpha 758), strictly AFTER
`host.start()` (so `boardReader` is real and complete) and strictly
BEFORE any `FedosBoardRuntime` Conversation read is ever reachable.

## How pre-Conversation historical Board data is handled

Compared:

- **A. Startup fails for legacy missing records.** REJECTED — breaks
  Rule 10 for the ordinary, expected case of a Board log that predates
  this Arc; every existing deployment would fail to start.
- **B. Deterministic migration creates public records.** REJECTED —
  would silently fabricate a policy/creation-time association for data
  no real policy decision was ever made about, violating this Stage's
  own explicit "do not silently fabricate policy history" instruction.
- **C. Legacy threads remain readable but lack Application mutation
  support.** ADOPTED. A Board thread with no Conversation record is not
  an error condition this function detects or reports at all —
  `FedosConversationReader.conversationForThread()` simply returns
  `null` for it, and `replyToPublicThread()` already tolerates that
  (Alpha 755's `"not-found"` outcome, unchanged Board-level reply
  behavior).
- **D. A separate migration tool.** Rejected as unnecessary complexity
  this Arc's own scope does not need.

## What this function DOES fail closed on

Not a legacy gap — genuine storage corruption or an invariant
violation: a persisted record that fails deserialization
(`"rejected-corrupt-record"`), or one whose root post does not exist in
the hydrated Board state, belongs to a different `boardId`, is not a
real thread root (`replyTo !== null`), or names the wrong `threadId`
(`"rejected-root-mismatch"`). Per this Arc's own Absolute Prohibitions
(no silent repair), either halts startup — `startFedosDesktopRuntime()`
converts a non-`"hydrated"` outcome into a thrown `Error`, the same
pattern `FedosDesktopHost.start()` already uses for a corrupt Board
log.

No side effect of any kind — a pure read-and-verify pass; no write to
`conversationPersistence`, no repair, no compaction.
