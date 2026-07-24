# Secure Runtime Alpha 7481–7560 — Phase C: Chosen Archive Model

**FedOS Archive Envelope Retention Parity and Metadata Deletion Semantics Arc.**

## Options compared

**A. Drop the whole envelope when payload access is denied.** Simple,
zero schema impact, exactly mirrors the existing Payload filter. Referential
integrity risk: a dangling `replyToEnvelopeId` elsewhere pointing at the
dropped id — but this is an ALREADY-tolerated condition in this codebase
(no port anywhere enforces envelope→payload OR reply-chain referential
integrity at write time; confirmed by reading the restore loop directly).
Conversation ordering: a gap in the sequence with no signal of why —
acceptable, since this codebase's own Conversation read paths already
tolerate gaps (no "sequence number" concept exists; ordering is by
`createdAt`/insertion, not a dense index).

**B. Preserve a minimal tombstone envelope.** Requires either a NEW,
additive record shape (a real Archive schema version bump) or overloading
existing Envelope fields with sentinel values outside their own validated
domain — both riskier and larger than this Arc's own narrow mission
("Do not redesign the Archive format broadly," "no message-history
rewrite"). Rejected as unnecessary given Option A's own referential-
integrity risk is already tolerated pre-existingly.

**C. Redact selected metadata fields.** Same schema-impact problem as B
(the Envelope's own field set is fixed and validated) — redacting
`senderMembershipId`/`createdAt` in place would either require a schema
version bump (to make fields optional) or writing sentinel values that
could collide with real data. Rejected for the same reason as B.

**D. Export full envelope but deny restore.** Fails the mission's own
explicit requirement ("one retention decision cannot gate payload while
silently bypassing envelope" applies to EXPORT too, not just restore) —
an export-side gap remains even though restore is protected; the audit's
own sharpest finding (export-after-deletion) would remain fully
unaddressed. Rejected.

**E. Export a separate deletion fact that suppresses metadata on
restore.** This is Option B's own persistence-side twin — requires a new
record type in the bundle schema (a real, additive schema version) to
carry the "this envelope's payload was denied at export time" fact
forward. More invasive than necessary: Option A (uniform exclusion)
already achieves the identical end state (the Envelope is simply not in
the bundle) with zero schema change. Rejected as unnecessary.

**F. Couple envelope export directly to the existing retention
decision.** This is the mechanism, not a competing end-state — Option A
IS the applied form of Option F using the SAME `evaluatePayloadAccess()`
gate and the SAME exclusion technique the Payload filter already uses.
**Adopted as the export-time mechanism.**

**G. Another source-grounded model.** Not needed — F(export)+A(exclusion
form)+a symmetric restore-time re-evaluation (below) dominates cleanly.

## Chosen model

**Couple Envelope collection to the SAME Payload retention decision
(Option F), applying it as a full exclusion (Option A's end state), at
BOTH export time (closing the audit's own headline finding) AND restore
time (closing the audit's own "Option 2" defense-in-depth, which this
Arc's own mission explicitly requires via Phase E: "restore re-evaluates
current Retention facts where available").**

Restore-time re-evaluation is symmetric with export: for each Envelope
in a bundle being restored, if the RESTORING device's own
`retentionAuthority` (when supplied) evaluates that Envelope's own
`payloadId` as `{outcome:"denied", ...}`, the Envelope (and its Payload,
if present in the bundle) is skipped — never written. If the restoring
device has no record of that `payloadId` at all
(`{outcome:"not-found"}`), restore proceeds normally — this is NOT a
weaker check, it is the correct, honest signal that a foreign/new
profile has no basis to deny something it never knew about (Phase F).

## Evaluation against the required criteria

- **Referential integrity** — no worse than the pre-existing, already-
  tolerated dangling-reference condition; Membership (Conversation-level)
  is deliberately left unlinked, preserving Conversation-level integrity
  for every OTHER, non-denied message.
- **User history expectations** — a user who deletes a message before
  exporting a fresh Archive no longer finds that message's metadata in
  it; a message deleted AFTER an existing Archive was taken is still
  suppressed from resurfacing via restore into any device that already
  knows about the deletion.
- **Deletion semantics** — Envelope and Payload now share exactly one
  fate, closing the audit's own "two independent, unlinked loops" finding
  precisely.
- **Archive round-trip consistency** — deterministic: the same bundle,
  restored twice onto the same device, produces the same outcome both
  times (idempotent `put*` semantics, unchanged).
- **Search behavior** — unaffected; out of scope, unchanged.
- **Conversation ordering** — unaffected beyond the existing, tolerated
  gap condition described under Option A.
- **Duplicate/import behavior** — unaffected; the existing
  `"duplicate"`/`"conflict"` vocabulary (Alpha 315/749/804/827/837/857)
  is reused verbatim, never touched.
- **Conflict resolution** — unaffected.
- **Version compatibility** — no schema version bump required; both
  gates are OPTIONAL, additive dependencies — omitted, behavior is
  byte-for-byte unchanged (matching the existing Payload gate's own
  precedent exactly).
- **Information leakage** — strictly reduced (this is the entire point);
  no new leakage introduced.
- **Migration burden** — none; no persisted format changes.

## Preferred characteristics achieved

- No message-content resurrection — unchanged (Payload gate already
  correct).
- No metadata resurrection contrary to retention policy — closed by
  this Arc.
- Deterministic exclusion semantics — yes (a boolean gate, not a
  probabilistic or timing-dependent one).
- Preserved referential integrity where necessary — Membership/
  Conversation-level integrity preserved; Envelope-level dangling
  references are an accepted, pre-existing, unavoidable condition, not
  worsened.
- Explicit user-visible retained-copy limitations — addressed in Phase H
  (Safety Center).
- Versioned compatibility — trivially satisfied (no version change).
- Fail closed under missing/corrupt retention state — yes, inherited
  from `isPayloadPermitted()`'s own existing discipline.
