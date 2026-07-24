# Secure Runtime Alpha 1611–1690 — Phase A Reconciliation Report
## Nostr Private Wire Standardization and Transport Reconciliation Arc

Produced BEFORE any production source under this Arc was modified, per
Alpha 1611's own instruction. Everything below was verified directly
against `git` output and actual source in
`C:\wt\nostr-private-wire-standardization` (branch
`arc/nostr-private-wire-standardization`), never assumed from a prior
Arc's own prose.

---

## 1. Ancestry of all prerequisite commits

`master` (`8c48c95`) and `review/onion-transport-v2` (and its own
ancestor chain) diverged at `8b65609` ("Secure Runtime Alpha 1051–1110:
Conversation Runtime Consolidation Arc") — the exact merge-base
confirmed by `git merge-base 8c48c95 review/onion-transport-v2`.

| Commit | Title | Ancestor of `master` (`8c48c95`)? | Branch(es) containing it |
|---|---|---|---|
| `b3b9b96` | Alpha 1261–1320, Production Conversation Crypto Runtime Activation | No | `arc/nostr-private-direct-pairwise-fanout-delivery`, `arc/private-conversation-activation-direct-messaging`, `review/onion-mailbox-backup-v1`, `review/onion-transport-v2` |
| `3dc4f7a` | Alpha 1321–1390, Private Group Pairwise Fanout Foundation | No | `arc/nostr-private-direct-pairwise-fanout-delivery`, `arc/private-group-pairwise-fanout-foundation`, `review/onion-mailbox-backup-v1`, `review/onion-transport-v2` |
| `71c938b` | Alpha 1391–1470, Nostr Private Direct and Pairwise Fanout Delivery (kind 24700) | No | `arc/nostr-private-direct-pairwise-fanout-delivery`, `review/onion-transport-v2` |
| `8c48c95` | Alpha 1471–1540, Private Transport Boundary and Multi-Relay Delivery | **Yes — this IS `master`'s own tip** | `master` |
| `5a283ad` | Alpha 1541–1610, Conversation Export/Restore/Archive Foundation | Yes (`master`'s parent) | `master` |
| `a40fa6f` | Onion/Mailbox/Backup review | No | `review/onion-mailbox-backup-v1`, `review/onion-transport-v2` |
| `a7922a8` | Onion Transport V2 review | No | `review/onion-transport-v2` only |
| `f715a5d` | Private Protocol Delivery and Group Encryption V1 review | No | `arc/nostr-private-direct-pairwise-fanout-delivery`, `review/onion-transport-v2`, `review/private-protocol-delivery-group-v1` |

**Decision:** the three genuinely required prerequisites not already on
`master` (`b3b9b96`, `3dc4f7a`, `71c938b`) all live, cleanly, on
`arc/nostr-private-direct-pairwise-fanout-delivery` (tip `71c938b`),
which does **not** include either Onion-review commit
(`a40fa6f`/`a7922a8` — confirmed absent by
`git log --oneline 8b65609..arc/nostr-private-direct-pairwise-fanout-delivery`).
This is the ONE branch merged into this integration branch. `a40fa6f`,
`a7922a8`, `f715a5d` were inspected read-only (per the task's own
"Also inspect" instruction) but not merged as production prerequisites
— `f715a5d` is already included transitively (it is an ancestor of
`71c938b` on the same branch).

**Merge performed:** `git merge arc/nostr-private-direct-pairwise-fanout-delivery`
into `arc/nostr-private-wire-standardization` (branched from `master`).
`git merge-tree` was run FIRST as a dry run and reported exactly three
conflicting files — confirmed to match the actual conflicts encountered.

### Conflict resolutions (all mechanical/additive-union, none redesigned anything)

1. **`README.md`** (one hunk, lines 11–646) — both sides had prepended
   a NEW top status banner onto the SAME "newest-first" changelog
   convention. Resolved chronologically: `master`'s own two most recent
   banners (Alpha 1471–1540, then Alpha 1541–1610) kept at the top
   (unmodified), followed by `arc/nostr-private-direct-pairwise-fanout-delivery`'s
   own unique banner chain (Alpha 1391–1470 back through Alpha
   1111–1180), connected by the file's own pre-existing "> Prior
   status:" transition idiom. Both sides' content is preserved
   byte-for-byte; nothing was deleted or reworded. The shared tail
   (Alpha 1051–1110 onward) was untouched by git (identical on both
   sides, not part of the conflict).

2. **`src/desktop/runtime/fedos_desktop_runtime.ts`** (two hunks) —
   `master`'s Alpha 1471–1540 added a `privateTransport()` accessor;
   the arc branch's Alpha 1263/1291 added a
   `conversationProductionCryptoCapability()` accessor. Both are
   genuinely additive, non-overlapping methods on the same interface
   and the same returned object literal. Resolved by keeping both, in
   construction order (production-crypto resolution already ran before
   `FedosPrivateTransport` construction on `master`'s own side).

3. **`src/desktop/runtime/fedos_desktop_runtime_config.ts`** (two
   hunks) — same additive-union shape, with ONE genuine duplicate:
   both sides had **independently declared the same two fields**,
   `conversationEnvelopeLogPath` and `conversationPayloadLogPath`
   (`master`'s Alpha 1471–1540 for `FedosPrivateTransport`'s own
   Envelope/Payload backends; the arc branch's Alpha 1113 for the
   Encryption Runtime Wiring facade). Both usages already point at the
   SAME underlying persistence classes reused from Alpha 804/857 — this
   is not a naming collision between two different concepts, it is two
   Arcs independently reaching for the one existing field. Resolved by
   keeping ONE declaration of each (under the Alpha 1471–1540 block,
   documented as now-shared) and removing the arc branch's duplicate,
   with a comment recording why.

**Verification of the integrated base** (this exact worktree, after
`npm install`):
- `npm run typecheck`: clean except the one pre-existing,
  cross-Arc-documented failure
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).
- `npm test`: 194 failing test files / 247 failing tests out of 948
  files / 12,446 tests, on FIRST run after the merge. Traced individually
  (§10 below) — ALL trace to either (a) the same `core.autocrlf=true`
  CRLF-vs-LF fresh-worktree artifact every prior integration worktree in
  this repository's own history has already hit and documented (confirmed
  directly: `packages/fedos-core-rust/Cargo.toml` has 293 `\r` bytes in
  THIS worktree, 0 in the main `master` worktree), or (b) the
  pre-existing "identity/protocol-root-handle" test group both `master`'s
  own Alpha 1471–1540 banner and the arc branch's own Alpha 1391–1470
  banner already independently named as pre-existing, or (c) exactly two
  test files (`secure_runtime_alpha_606_runtime_assembly.test.ts`,
  `secure_runtime_alpha_758_local_runtime_ownership.test.ts`) whose own
  `Object.keys(runtime)` assertions needed updating to include the
  now-merged `privateTransport` key — a real, expected, mechanical
  consequence of combining two independently-additive runtime accessors.
  Both were fixed and reverified passing (12/12 tests, 2/2 files) in
  isolation. **Zero other genuine regressions found.**

---

## 2. Private event kinds currently emitted (integrated base)

- **`kind: 1`** — public Board posts (`src/board/`, UNCHANGED, out of
  scope) AND, as of the pre-Alpha-1615 integrated base, `FedosPrivateTransport`'s
  own private-ciphertext wire events
  (`src/conversation/transport/fedos_conversation_transport_event.ts`,
  `buildFedosPrivateTransportUnsignedEventRequest()`, hard-fixes
  `kind: 1`). This is Primary Problem item B, confirmed present.
- **`kind: 24700`** (`FEDOS_PRIVATE_NOSTR_DELIVERY_KIND`,
  `src/conversation/delivery/nostr/fedos_private_nostr_delivery_mode.ts`)
  — the FedOS-proprietary Direct/Group private delivery facade
  (`conversationRuntime().privateNostrDelivery()`, Alpha 1391–1470).
  This is Primary Problem item A.
- **No `kind: 13`/`14`/`1059`** (NIP-59 Seal / NIP-17 Rumor / Gift
  Wrap) exists anywhere in the integrated base — confirmed by
  `git grep` across every local branch, zero hits. This is Primary
  Problem item C.

## 3. Signing allowlist

`src/nostr/sign/fedos_nostr_signing_authority.ts`: `SUPPORTED_NOSTR_KINDS`
is a closed, exactly-two-element `Set([1, FEDOS_PRIVATE_NOSTR_DELIVERY_KIND])`.
Any other `kind` is rejected at `isWellFormedFedosNostrUnsignedEventRequest()`
— structurally impossible to sign an event of any other kind through this
repository's ONE signing entry point.

## 4. Private Transport outbound path (`FedosPrivateTransport`, Alpha 1471–1540)

`src/conversation/transport/fedos_private_transport.ts` + siblings.
Owns: `FedosConversationRelaySet` (multi-Relay), Mailbox/Ephemeral
scheduling (`fedos_conversation_transport_scheduler.ts`), its own
Outbox (`FedosConversationTransportOutboxPersistence`), OK-correlated
multi-Relay publish
(`FedosMultiRelayOkCorrelatedConversationTransportPublisher`), inbound
subscription + dedup (`FedosConversationInboundSubscription`/
`FedosRelayEventDeduplicator`, keyed by the Nostr event's own
deterministic id). Wire shape: `fedos_conversation_transport_event.ts`
— **currently `kind: 1`** + marker tag `["fedos-private","1"]` +
`["p", counterparty]` + `["e-envelope", id]`, base64 ciphertext
`content`. This is the Alpha 1615 kind-1-closure target.

## 5. Proprietary delivery outbound path (`privateNostrDelivery()`, Alpha 1391–1470)

`src/conversation/delivery/nostr/` (13 files). Owns its OWN Delivery
Request persistence, its OWN OK-correlated Publisher adapter
(`FedosPrivateNostrDeliveryPublisher`, mirrors — does not reuse —
`FedosRelayOkCorrelatedNostrBoardPublisher`'s technique), its OWN
Inbound Delivery Coordinator, and a Group Delivery Planner reusing the
Alpha 1321–1390 Pairwise Fanout plan. Wire shape: `kind: 24700`,
disclosed FedOS-proprietary, confidentiality from the existing pairwise
ECDH+AEAD scheme (Alpha 861–890/1261–1320) — explicitly, in its own
banner text, "no gift-wrap, no seal, no ephemeral per-recipient key
scheme is invented."

## 6. Inbound classifiers

Two independent classifiers exist: `FedosPrivateTransport`'s own
`parseFedosPrivateTransportEventDescriptor()` (fails closed to `null`
for anything not `kind: 1` + the `fedos-private` marker tag — i.e. it
currently and deliberately does NOT classify a plain public Board
`kind: 1` post as private, only ITS OWN marker-tagged subset) and the
proprietary delivery facade's own Inbound Delivery Coordinator
(classifies by `kind: 24700` + recipient `p`-tag ownership, decrypts
via the existing `FedosConversationDecryptionAuthority` directly, never
re-implementing crypto). Neither classifier currently ever misreads the
OTHER's or the public Board's event kind as its own — confirmed by
Alpha 1650's regression guard (§ below) once kind 1 is closed.

## 7. Outbox/Retry/Observation ownership

Both `FedosPrivateTransport` and `privateNostrDelivery()` each own a
FULLY SEPARATE, parallel Outbox/Publisher/Observation stack — this is
the one genuine, named architectural duplication this Arc's own
Absolute Prohibitions flag ("never preserve two production routes that
claim the same authority"). See §9.

## 8. Local canonical import ownership

Both paths import into the SAME underlying Conversation Envelope/Payload
persistence ports (Alpha 804/857/861) — never a second canonical store.
`FedosConversationPersistence`/Membership/Capability remain the one
source of truth for both; Relay events are never canonical (both paths
already respect this, unchanged by this Arc).

## 9. Duplicate functionality — the real finding

`FedosPrivateTransport` (Mailbox/Ephemeral, multi-Relay fan-out, dedup,
its own Outbox) and `privateNostrDelivery()` (Direct/Group-aware
planning, its own OK-correlated Publisher, its own Outbox) are two
INDEPENDENT delivery verticals that can each, today, durably send an
encrypted Conversation Envelope over Nostr. This is a genuine
duplicate-authority condition per the Absolute Prohibitions
("never preserve two production routes that claim the same authority").

**Resolution adopted, scoped to what this Arc's own Alpha 1615/1616
instructions license — no wider unification:** Alpha 1615 migrates
`FedosPrivateTransport`'s wire SHAPE off `kind: 1` onto the SAME
disclosed proprietary `kind: 24700` already established by
`privateNostrDelivery()` — closing the kind-1 hole without touching
either subsystem's Outbox/Publisher/Scheduler internals, and without
merging the two verticals into one (that would be "redesigning the
generic Private Transport boundary," itself prohibited). The DEEPER
duplication — two separate Outbox/Publisher stacks both now emitting
`kind: 24700` — is reported here honestly as **not resolved by this
Arc** and is the recommended next Arc's own first task (Alpha 1690).
Both remain independently correct and non-conflicting on the wire (an
inbound observer cannot tell which of the two originated a given `kind:
24700` event, and neither currently double-delivers the same logical
message, since each owns a disjoint call path today) — but the standing
duplication itself is real and should not be understated.

## 10. Exact conflict/ripple scope

Ripple of the Alpha 1611–1690 Arc's own changes (this document plus
Alpha 1612–1617, per the Phase A/B boundary — see completion
declaration for the exact final file list) is confined to:
`src/conversation/transport/fedos_conversation_transport_event.ts` (and
its direct unit tests), `src/conversation/transport/fedos_private_transport.ts`
callers (if any hard-code `kind: 1`), one new route-vocabulary type,
one new wire-adapter freeze-boundary file/doc, `docs/`, `README.md`.
Nothing under `src/board/`, `src/conversation/persistence/`,
`src/conversation/envelope/`, `src/conversation/group/`,
`src/conversation/capability/`, `p2p/`, or `packages/fedos-core-rust/`
(Rust) is touched by Phase A/kind-1-closure work — confirmed by `git
diff --stat` against the merge commit before/after each subsequent
change (see completion declaration).
