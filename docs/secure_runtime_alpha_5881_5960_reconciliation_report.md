# Secure Runtime Alpha 5881–5960 — Phase A Reconciliation Report

**FedOS Signed Recipient Deletion Request Private Transport and Local Policy Integration Arc**

Worktree: `C:\wt\signed-deletion-private-transport`. Branch: `arc/signed-deletion-private-transport-local-policy`.

## 0. Ancestry and range selection

Highest confirmed `Secure Runtime Alpha` ranges found across every local branch: `d825aa0`
(5721–5800, Ratchet Peer Notification/Capability), `b8e9e06` (5561–5640, Ratchet/NIP-17
Integration), `22f9277` (5641–5720, Signed Deletion Request Types/State Foundation),
`080cb99` (5481–5560, Ratchet Cryptographic Core), and a genuine, already-documented
5401–5480 collision between `be1bc0d` (Ratchet State Foundation) and `b3b3a6d` (Local
Deletion Capability Foundation). No branch or README status entry anywhere uses 5801+.

**Chosen range: 5881–5960** — reserving 5801–5880 for the concurrently-active Identity
Transition Arc (a separate worktree, `C:\wt\identity-transition-foundation`, branch
`arc/identity-transition-types-validation-durable-evidence`, confirmed running in parallel
and never touched by this Arc), per the coordination instructions' own "reserve the earlier
free range for Arc A, the immediately following range for Arc B" rule.

## 1. Base selection — a real merge, not a single-branch pick

This mission requires BOTH lineages this Arc integrates:

- `22f9277` (5641–5720) — the real Signed Deletion Request type/validation/signing/durable-
  state foundation, itself based on `b3b3a6d` (Local Deletion Capability Foundation).
- `d825aa0` (5721–5800) — the strongest real, live private-transport/NIP-17/Ratchet lineage
  (`b8e9e06` NIP-17 integration, `f80889d` Ratchet Device Lifecycle, `080cb99`/`be1bc0d`
  Ratchet Core/State).

`git merge-base 22f9277 d825aa0` resolves to `3eb9ead` (master's own tip) — the two
lineages are genuine siblings, diverged directly from master, never merged into each other.
`git merge-tree` between them reported **zero conflict markers** across the full tree; a
real `git merge d825aa0` (onto a branch cut from `22f9277`) produced exactly four textual
conflicts — README.md and the three `docs/secure_runtime_alpha_5401_5480_*.md` files, all
attributable to the already-known 5401–5480 numbering collision, never a content
disagreement about the SAME feature.

**Decision: merge, not pick-one.** `decda87` (commit "Merge FedOS Ratchet/NIP-17 Private
Transport lineage (d825aa0) into Signed Deletion Request Foundation (22f9277) as Phase A
integration base") is this Arc's own chosen integration base. No incompatible Conversation,
Signing, Retention, or Private Transport ownership model was found — both lineages already
share the same `src/conversation/` foundations (Retention, Search, Membership, Device Sync)
from `master`; only their own additive domains (`deletion_request/`, `ratchet/`) differ, and
those are disjoint directories.

## 2. Conflict resolution detail

- **`docs/secure_runtime_alpha_5401_5480_{completion_declaration,execution_spec,reconciliation_report}.md`**
  (add/add conflicts): kept `22f9277`'s own copies (Local Deletion Capability Foundation) at
  their original filenames; `d825aa0`'s own copies (Direct Ratchet State Foundation) were
  renamed to `..._ratchet_state_foundation_{...}.md` — both preserved in full, neither
  rewritten, the collision recorded rather than silently repaired (mirrors `be1bc0d`'s and
  `b3b3a6d`'s own prior precedent for this exact numbering collision).
- **`README.md`**: the two branches' own "Status" blurb stacks were interleaved by REAL
  commit timestamp (`git log -1 --format=%ci`), not by Alpha-range number — confirming
  [[project_secure_runtime_arc_conventions]]'s own standing note that this stacking is
  newest-commit-first. Chronological order: `d825aa0` (21:52) → `b8e9e06` (18:33) →
  `22f9277` (15:19) → `080cb99` (14:02) → `be1bc0d` (12:17) → `b3b3a6d` (11:35) — note
  `b8e9e06` (numerically 5561–5640, LOWER than `22f9277`'s 5641–5720) actually landed
  chronologically AFTER it, a second confirmed real instance of the exact non-monotonic
  pattern that memory entry already documents.

## 3. Inspected, read-only, unmerged into this branch

- `b3b3a6d` (Local Deletion Capability and Deletion-State Foundation) — inspected via the
  now-merged `22f9277` lineage (it is `22f9277`'s own direct parent); every execution
  coordinator/plan/assessment/capability-descriptor entry point reused unmodified.
- `b8e9e06`/route resolution (`fedos_conversation_transport_routing.ts`,
  `fedos_private_transport.ts`) — the real `sendMailboxNip17Control()` seam,
  `d825aa0`'s own established precedent for a protocol-neutral control payload
  (`fedos_ratchet_peer_capability_control_payload.ts`) reused as this Arc's own direct
  structural template (Phase B).
- Ratchet route interaction (`fedos_direct_ratchet_route_resolution.ts`) — inspected;
  this Arc does not select or require an active Ratchet session (Phase K scope is the
  standard `"nostr-nip17-v1"` Gift Wrap route only, matching `d825aa0`'s own peer-capability
  precedent) — no Ratchet cryptography is touched (verified structurally, Phase Q).

## 4. A genuine integration gap found and closed

`22f9277`'s own `fedos_deletion_request_authorization_assessment.ts` header states plainly:
"this Arc claims no deeper cryptographic binding between a Nostr pubkey and a
`publicIdentifier`... a future transport-integration Arc may revisit it." Direct inspection
of `FedosConversationRuntime` found two real, load-bearing facts that gap actually blocks:

1. `FedosConversationRuntime` holds **no** `FedosConversationPersistence`/
   `FedosPersistedConversationRecordV1` of its own — real Direct Conversations there are
   modeled entirely through `draftPersistence`/`activationPersistence`
   (`resolveActiveConversation()`), never a discrete Conversation record. Closed with a
   narrow, honest read-only adapter (`fedos_deletion_request_conversation_existence_adapter.ts`)
   over the Runtime's own already-real `resolveActiveConversation()` — the assessment
   function only ever checks the returned value's non-null-ness, so the adapter's synthetic
   record carries no fabricated board/thread/policy fact.
2. `participantReferenceForFedosDeletionRequestAccountRef()` hardcoded
   `authority: "fedos"` — but a REAL production Direct Conversation's own Membership uses
   `authority: "nostr"` (the real resolved pubkey). Left unfixed, EVERY real deletion
   request against a real production Conversation would have failed
   `"requester-not-author"` regardless of correctness. Closed with a narrow, additive,
   100%-backward-compatible change: `accountAuthority` is now an OPTIONAL parameter
   (default `"fedos"`, every existing `5641-5720` call site/test unaffected), threaded
   through this Arc's own outbound/inbound wiring as `"nostr"`. Verified for real: the Phase
   O real vertical slice (real WASM Master Seeds, real Direct Conversation, real Membership)
   passes end to end using this fix.

## 5. Stop conditions checked — none triggered

No incompatible Conversation/Signing/Retention/Private-Transport ownership model was found.
No third parallel transport architecture was created — this Arc reuses
`FedosPrivateTransport.sendMailboxNip17Control()` exclusively, the SAME seam `d825aa0`'s
own Peer Capability domain already established as this codebase's real precedent for a
protocol-neutral private control payload.
