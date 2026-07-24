# Secure Runtime Alpha 7481–7560 — Phase F: Retained-Copy / Non-Guarantee Document

**FedOS Archive Envelope Retention Parity and Metadata Deletion Semantics Arc.**

## What this Arc does NOT and cannot claim

- **No physical erasure.** `removeLocalPayload()`'s own bytes may still
  exist on disk in an append-only log (Alpha 811, unmodified). This Arc
  changes only what a FUTURE Archive export/restore reintroduces —
  never what already happened to bytes on a physical medium.
- **No modification of an already-exported archive file.** An Archive
  taken BEFORE a later deletion is a real, independent, point-in-time
  file. This Arc never reaches into an existing `.fedosarchive` file on
  disk to retroactively edit it — doing so would be exactly the kind of
  fabricated, out-of-band mutation "Fail Closed over fabrication" forbids.
  That file, wherever it is, still contains what it always contained.
- **No remote/Relay deletion.** Unchanged — `relay-ciphertext-may-remain`
  continues to apply exactly as before.
- **No cross-device/global deletion propagation.** This Arc never
  transmits a deletion fact to any other device. Each device's own
  `FedosPayloadRetentionAuthority` is queried locally, evaluating only
  facts THAT device already has.

## The real, implemented truth

1. **Live application records a real, durable fact.** Signed Deletion
   execution (or a bare retention denial) writes a real
   `active → tombstoned → payload-removed` transition into the
   `FedosPayloadRetentionAuthority`'s own append-only decision log
   (Alpha 796–811, unmodified) — a genuine, persisted, restart-surviving
   fact, not a runtime-only flag.
2. **Future restore, on a device that already has this fact, consults it
   and suppresses.** This Arc's own restore-time gate
   (`isPayloadPermittedForRestore()`) re-evaluates that SAME real fact
   against every incoming Envelope/Payload pair before writing either —
   proven live in the vertical slice (Phase I).
3. **Future export, from a device that already has this fact, excludes
   it.** This Arc's own export-time gate (the same `retentionAuthority`,
   now also linked to Envelope collection) excludes both the Envelope
   and the Payload from any NEW archive taken after the fact exists —
   closing the audit's own headline finding.
4. **An archive taken BEFORE the fact existed is untouched — by design,
   not by oversight.** A point-in-time snapshot cannot know about a
   future event. This was already correctly disclosed by the original
   V1 specification review (`cf5b870`) and remains correct; this Arc
   does not change it and does not claim otherwise.
5. **Restoring that PRE-existing archive onto a device that has SINCE
   independently recorded the same deletion fact is still suppressed.**
   Because restore re-evaluates the RESTORING device's own current
   state (step 2), a stale archive cannot resurrect content or metadata
   that device already knows to deny — even though the archive file
   itself was never edited.
6. **Restoring that same archive onto a device that has NEVER recorded
   the deletion fact (a genuinely foreign/new profile) is NOT
   suppressed, and this Arc says so plainly.** `evaluatePayloadAccess()`
   correctly returns `{outcome:"not-found"}` for a Payload id it has
   never heard of — a materially DIFFERENT signal from `{outcome:"denied"}`,
   and this Arc treats it as permission to proceed, honestly, rather
   than inventing a global-deletion-propagation mechanism this codebase
   has never built and this Arc's own mission explicitly forbids
   ("Do not fabricate global deletion propagation").

## The disclosed limitation, stated for a user

> If you restore an archive onto a device or profile that was never
> present when a message was deleted, that device has no way to know
> the deletion happened, and the message may reappear there. Restoring
> the same archive onto a device that already knows about the deletion
> will not bring the message back.

This is the exact, honest limitation Phase H's own Safety Center warning
(`archive-restore-may-be-suppressed-by-local-deletion-facts`, alongside
the existing `foreign-archive-copies-cannot-be-verified`-style framing)
states directly, in the Archive workflow itself — not only the generic
overview screen.
