# Secure Runtime Alpha 3081–3160 — Branch/Source Reconciliation Report

Phase (Precondition Reconciliation), written before any production edit.

## 1. Branches/worktrees inspected

Full registered worktree list re-surveyed (`git worktree list --porcelain`)
against the state at the start of this Arc. Candidates evaluated for the
"Desktop Application Shell commit `ad3fb81` or its integrated equivalent"
precondition:

- `git cat-file -t ad3fb81` confirms it is a real commit: "Add Secure
  Runtime Alpha 2841-2920: Desktop Local Application Shell and
  Conversation Management Boundary Arc".
- `git branch --all --contains ad3fb81` returns exactly ONE branch:
  `arc/desktop-application-shell` (worktree `C:\wt\desktop-application-shell`).
  No other branch had merged it.

## 2. Verifying actual source content (not commit titles)

Direct file-presence checks in `arc/desktop-application-shell` (before
any merge):

| Required precondition | Present? |
|---|---|
| Desktop Local Runtime (`FedosDesktopRuntime`) | YES — `src/desktop/runtime/fedos_desktop_runtime.ts` |
| Conversation Runtime | YES — `src/conversation/runtime/fedos_conversation_runtime.ts` |
| Envelope/Payload persistence | YES |
| Membership/Capability persistence | YES |
| Search Runtime | YES — `src/conversation/search/` |
| Search Retention Authority hardening | YES — own lineage includes Alpha 2581–2620 directly |
| Archive CLI | YES — `src/conversation/archive_cli/`, own lineage includes Alpha 2341–2420 directly |
| Desktop Application Shell | YES — `src/desktop/shell/fedos_desktop_application_shell.ts` |
| **Direct Conversation messaging** | **MISSING** — no `src/conversation/messaging/` directory, no send/reply coordinator anywhere in the tree |
| **Group Conversation messaging** | **MISSING** — no Group send coordinator anywhere |
| **Conversation Activation and Reactivation** | **MISSING** — only `construction`/`readiness` (pre-Activation, Draft-stage) concepts exist; no `activation`/`reactivation` directory |
| **Archive Runtime** (distinct from Archive CLI) | **MISSING** — `archive_cli` exists, `archive/runtime` does not |

This branch's own history (`git log --oneline`) shows it diverged from
the shared trunk at commit `22c1bf2` ("Alpha 2341-2420: Conversation
Archive CLI and User Packaging") and continued through Multi-Device-Sync
Foundation, Private Transport, Search Runtime, Search Retention
hardening, straight to the Desktop Shell — never picking up Direct/Group
messaging or Activation/Reactivation, which were built on a SEPARATE,
parallel lineage after the SAME divergence point.

## 3. Locating the missing capabilities

`git branch --all --contains` and `git merge-base --is-ancestor` checks
identified `arc/conversation-identity-restoration-reactivation`
(worktree `C:\wt\conversation-identity-reactivation`) as the most
integrated branch carrying every missing REQUIRED capability:

- `arc/private-conversation-activation-direct-messaging` is an ancestor
  of it (Direct messaging).
- `arc/private-group-pairwise-fanout-foundation` is an ancestor of it
  (Group messaging).
- Its own tip commit is "Alpha 2041-2120: Conversation Identity
  Restoration and Reactivation Arc" (Activation/Reactivation).
- Its own history additionally includes "Alpha 1691-1760: Conversation
  Archive Runtime Integration and Recovery Operations" and "Alpha
  1921-1980: Group Conversation Archive Integration and Cross-Branch
  Recovery" (Archive Runtime, distinct from Archive CLI).

File-presence verification in this branch confirms all four previously-
missing pieces are real, non-placeholder source:
`src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts`
(+4 sibling files), `src/conversation/group/fedos_group_send_coordinator.ts`,
`src/conversation/activation/fedos_conversation_reactivation_coordinator.ts`
(+result type), `src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts`
(+assembly).

`arc/conversation-identity-restoration-reactivation` and
`arc/desktop-application-shell` diverged at commit `8c48c95` ("Alpha
1471-1540: Private Transport Boundary and Multi-Relay Delivery") —
neither is an ancestor of the other. Below that point their history is
identical (shared trunk); above it, each added ORTHOGONAL, non-competing
capabilities (Shell/Search/Retention/Archive-CLI on one side;
Messaging/Group/Reactivation/Archive-Runtime on the other) — not two
different designs of the same thing. This is a genuine "needs merging"
divergence, not a "select between incompatible architectures" one (Phase
A step 7 does not apply).

## 4. Merge performed

```
git worktree add -b arc/desktop-runtime-conversation-content-accessor \
    C:\wt\desktop-content-accessor arc/desktop-application-shell
git merge --no-ff arc/conversation-identity-restoration-reactivation
```

Result: 194 files touched, exactly ONE conflict — `README.md` (both
lineages independently prepended their own newest-status blurb; resolved
by chronological insertion, HEAD's newest entry on top, the other
lineage's unique entries spliced in immediately after as further "Prior
status", then rejoining the shared trunk's own unconflicted history —
no entry's own text edited, matching this repository's own established
resolution convention). **Zero source files conflicted** — confirming
the two lineages really were orthogonal.

Merge commit: `0236ac5` ("Merge arc/conversation-identity-restoration-reactivation
into arc/desktop-runtime-conversation-content-accessor").

Post-merge file-presence re-verification confirms every REQUIRED
precondition now has real source in this worktree (re-checked directly,
not inferred from the merge alone).

## 5. Optional capabilities — documented, NOT merged in

Per this Arc's own instruction ("do not merge optional branches merely
to satisfy this Arc"), none of the following were added:

- **Sender-Key Runtime**: absent from this base (`0` files matching
  `*sender_key*` anywhere under `src/`). Pairwise Group messaging is the
  only Group encryption mode available on this base — Phase F's own
  "Sender-Key Group send when available on the chosen base" therefore
  does not apply here; this is documented honestly, not silently
  implemented as a fake capability.
- **Device Trust Runtime**: only ONE stray file exists,
  `src/identity/device_trust.ts` — not a Runtime, a narrow type/utility
  left over from an unrelated, unmerged branch's own partial work. Not
  treated as "Device Trust Runtime present."
- **Incremental Archive**: absent (`0` files matching
  `*incremental_archive*`).

`arc/device-trust-runtime-integration` and `arc/incremental-archive-snapshot-chain`
were inspected (`git branch --all`) but deliberately NOT merged — doing
so would broaden this Arc's scope beyond its own stated objective.

## 6. Identity resolution — confirmed present and unblocked

`arc/desktop-application-shell`'s own OLDER history contains a commit
literally titled "Alpha 851-8XX: Private Message Envelope + Encryption
Authority (Direct-mode), blocked at Identity-domain key resolution" —
raising the real possibility Phase D's own contingency ("if the Identity
resolver still does not exist, stop at that boundary") would apply.
Verified directly in the MERGED worktree: `src/conversation/encryption/identity/fedos_conversation_identity_resolver.ts`
and `src/identity/fedos_identity_resolver.ts` both exist, and the Direct
messaging coordinator's own source contains no "blocked" language of any
kind. The historical blocker was resolved further along the
Reactivation lineage (which this Arc's own merge just brought in) — **Identity
resolution is available on this base.** Phase D's contingency does not
apply; full implementation proceeds.

## 7. Files expected to change (refined further during Phase A)

- New: one Conversation Content Accessor file (Phase B).
- `src/desktop/runtime/fedos_desktop_runtime.ts` — additive accessor
  ownership wiring (Phase C).
- `src/desktop/shell/fedos_desktop_application_shell.ts` — replace
  unconditional-`unavailable` method bodies (Phase I).
- New test files (Phase J).
- No Rust/Cargo file — this Arc touches TypeScript only.
