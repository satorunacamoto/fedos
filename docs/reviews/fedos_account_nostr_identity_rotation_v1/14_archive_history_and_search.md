# 14 — Archive, History, and Search

## Binding rules (all confirmed already true of current source; this
review requires they remain true)

- **Historical messages retain their original author identity.**
  `fedos_conversation_archive_restore.ts` replays Membership/Envelope
  facts verbatim (`01`) — no future Implementation Arc may rewrite a
  restored fact's embedded `participant` reference to point at a new
  identity.
- **Old signatures are not rewritten.** No Nostr event this codebase ever
  received or produced is re-signed for any reason; this review does not
  propose one either.
- **Archives are not silently modified.** `restoreFedosConversationArchiveBundle()`'s
  own header already states restore "never deletes, never overwrites,
  never rewrites" (`01`) — a future Arc must not weaken this to
  accommodate identity transitions.
- **Restored history does not reactivate old Ratchet sessions.** Already
  true structurally (`12`): Archive Restore never touches Ratchet session
  persistence at all (confirmed by the zero-match `ratchet` grep across
  `src/conversation/archive/`, `01`).
- **Search may associate old/new identity only through an explicit,
  accepted transition fact.** `fedos_conversation_search_participant_index.ts`
  buckets by `authority::publicIdentifier` live off the CURRENT Membership
  (`01`) — a rotated pubkey naturally starts a new bucket; this review
  requires that any FUTURE cross-referencing of old/new buckets (e.g., "show
  me all messages from this person across their identity change") only
  ever consult an explicit, LOCALLY-accepted transition record (`10`'s
  `"locally-accepted"` state) — never infer linkage from any other
  signal (timing, content similarity, Relay metadata).
- **Rejected/conflicting transitions must not merge histories.** If a
  transition claim is `"rejected"`/`"conflicting"`/`"stale"` (`10`, `17`),
  Search/Archive must continue to treat the old and new identities as
  fully separate — this review explicitly forbids any UI or indexing
  behavior that would visually or structurally merge them absent
  acceptance.
- **Archive Restore cannot establish trust in a new identity.**
  Confirmed already true: `fedos_conversation_archive_restore.ts` has no
  identity-verification step at all (`01`) — restoring a bundle that
  happens to CONTAIN a transition claim record does not itself accept
  that claim; acceptance only ever happens through the live inbound
  acceptance pipeline (`10`), never through the Archive replay path.
- **Old identity references remain immutable historical facts.** Stated
  once, applies everywhere in this document: nothing in Archive, Search,
  or Membership history is ever updated in place to reflect a later
  transition. Continuity, where it exists at all, is expressed only as a
  NEW, separate, additive fact pointing backward (`13`'s proposed
  `"superseded-by-transition"` state) — never as a mutation of the old
  fact itself.

## Non-goal

This review does not specify a UI/UX for how a user browses "the same
person across an identity change" — only that the underlying data model
never merges or rewrites history to make such a view possible without an
explicit, accepted transition record backing it.
