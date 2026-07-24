# Secure Runtime Alpha 7401–7480 — Phase I: Legacy and Migration Policy

**FedOS Direct Conversation Route Binding and NIP-17 Inbound Isolation Arc.**

## Scope

Applies to inbound Direct messages that carry NO route binding at all —
genuinely pre-existing content, produced before this Arc's own outbound
wiring existed, or by a peer whose own software has not yet adopted it.
Never applies to a message that HAS a route binding (well-formed or not)
— that case has its own closed outcomes (`"malformed-binding"`,
`"unknown-conversation"`, `"membership-denied"`, `"binding-mismatch"`),
none of which ever fall through to this policy.

## Decision table

| Candidates found (active Direct conversations with the sender) | Outcome | Rationale |
|---|---|---|
| 0 | `"unknown-sender"` | Identical to the pre-existing Alpha 1424/1859 admission-gate behavior — never auto-creates a Conversation. |
| Exactly 1 | Accepted — `"legacy-unambiguous"` (imported normally) | The ONE case where the historical peer-only resolver's own answer is provably correct BY CONSTRUCTION (there is nothing else it could mean) — explicitly allowed, matching this Arc's own mission ("exactly one valid candidate → legacy-unambiguous, if explicitly allowed"). |
| 2 or more | `"ambiguous-legacy-route"` | Fails closed. NEVER a first-match guess — this is precisely the defect this Arc exists to close; a legacy message cannot be permitted to silently resurrect it. |

Implemented identically on both routes via one shared helper,
`countFedosPrivateNostrInboundLegacyCandidates()`
(`src/conversation/delivery/nostr/fedos_private_nostr_inbound_legacy_candidate_count.ts`)
— a total, never-throwing function that mirrors
`resolveFedosPrivateNostrInboundDirectConversation()`'s own iteration
exactly, but collects every match instead of stopping at the first.

## What counts as "no binding"

- Plain route: `decodeFedosDirectConversationPlainMessagePayload()`
  returns `{outcome: "absent"}` — the content is not even valid JSON
  (genuinely human-authored plaintext, this route's entire pre-Arc
  history).
- Ratchet route: a `"message"` payload at `schemaVersion: 1` (the
  original shape, no `conversationId` field) — pre-existing per this
  codebase's own history (Alpha 5561-5640 through Alpha 7320, before any
  real production deployment ever reached real end users per the
  Release Readiness Review's own finding that messaging IPC was gated
  behind AUTOTEST until Alpha 7321-7400).

A binding that IS present but broken (valid JSON, wrong shape; or
`schemaVersion` outside `{1, 2}`) is NEVER treated as "no binding" — it
fails closed immediately (`"malformed-binding"` / `"unsupported-version"`
respectively), never falling through to this policy. This distinction
matters: falling through malformed content to the legacy path would let
a tampered or corrupted binding silently downgrade to the OLD, weaker
resolution — exactly the "silent legacy fallback under ambiguity"
disqualifier this Arc's own mission forbids.

## Never rewrites history

- No past Relay event is ever re-published, re-signed, or modified.
- No binding is ever synthesized for a message that never carried one —
  the Legacy Policy above is the ONLY treatment such a message ever
  receives; there is no "backfill" step anywhere in this Arc.
- Local storage-at-rest for a legacy-accepted message is unchanged from
  before this Arc (still a fresh local Envelope/Payload pair through the
  same existing ports) — only the ROUTING decision that selects which
  Conversation it is filed under changed.

## Persisted-state versioning

No new persistence port and no schema version bump to any DURABLE
persistence format was required — the route binding is a wire-level
(Rumor content) concept only, computed at send time from already-durable
facts and validated at receive time against already-durable facts. The
one versioned artifact is `FedosDirectRatchetMessagePayloadV1.schemaVersion`
(`1 | 2`, additive) — a WIRE payload version, not a persisted-record
version; restarting a Runtime with existing `schemaVersion: 1`-tagged
Ratchet session/secret/snapshot records on disk is unaffected, since
those records never carried a `conversationId` field to begin with (the
Conversation binding for a message is a property of the MESSAGE payload,
not the session's own durable state) — confirmed by this Arc's own
regression run of `secure_runtime_alpha_7241_7320_direct_ratchet_repeated_restart.test.ts`
and `secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts`, both
passing unmodified.

## No destructive migration

Nothing in this Arc deletes, truncates, or overwrites any existing
persisted file, log, or record. Both new route-binding fields
(`FedosDirectConversationPlainMessagePayloadV1`'s whole shape;
`FedosDirectRatchetMessagePayloadV1.conversationId`) are additive to a
WIRE format, never to a durable persistence schema — there is nothing to
migrate on disk at all.
