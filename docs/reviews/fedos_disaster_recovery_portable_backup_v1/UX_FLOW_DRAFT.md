# FedOS Recovery Bundle — Operator-Facing UX Draft (V1, DESIGN_ONLY)

Status: **DESIGN_ONLY draft copy**, written against `DESIGN.md` in this same
review folder. Nothing described here is built — no export screen, no
import screen, no `seal_recovery_bundle`/`restore_recovery_bundle` Rust
methods exist yet (`DESIGN.md` §2, §"Why DESIGN_ONLY"). This document is
the copy/flow spec an implementer would build against, and it doubles as
the honesty check the design's Goal ("do not describe unsupported recovery
as complete") requires before any of it ships.

This draft assumes the Recovery Bundle feature ships as new screens
alongside the existing Backup Guide's manual profile-directory copy (which
stays the primary/only shipped path until this is built) and the existing
Archive export/restore feature. Style, tone, and diagnostic-code
conventions below are matched to `docs/desktop_beta_user_guide_backup.md`
and `docs/desktop_beta_user_guide_recovery_and_troubleshooting.md`.

---

## 1. Export flow — creating a Recovery Bundle

Entry point: a new **Recovery Bundle** section, most naturally placed next
to Archive (same "export/restore a file you choose" shape), reachable from
Settings or a dedicated top-level screen. Steps:

1. Open **Recovery Bundle**.
2. Click **Create Recovery Bundle…**.
3. **Set a Recovery Bundle passphrase.** This screen must say, explicitly,
   in-line (not in a tooltip or a help link — this is the single highest-risk
   copy in this whole feature per `DESIGN.md` §2's "may equal or differ from
   your unlock passphrase" decision):

   > **This is a new passphrase, separate from your unlock passphrase.**
   > It protects this Recovery Bundle file only. You may reuse your unlock
   > passphrase here, or choose a different one — FedOS does not check or
   > enforce either way. Whichever you choose, **write it down and store it
   > with the bundle file itself, separately from your unlock passphrase.**
   > If you forget this passphrase, this bundle cannot be opened by anyone,
   > including FedOS — the same as forgetting your unlock passphrase (see
   > the Backup Guide).

   Below the input: a second, un-editable line confirming what this
   passphrase is *not*: "Entering your unlock passphrase here does not
   check it against your unlock passphrase, and does not change your
   unlock passphrase." (Two confirm-typed fields, standard passphrase-set
   pattern — no strength meter claims, matching this codebase's existing
   avoidance of unverifiable UX promises.)
4. Click **Choose destination…** and pick where to save the `.fedosrecovery`
   file using the normal OS save dialog.
5. Click **Create**. Progress indicator while the manifest is built and the
   bundle is sealed (this is a real Argon2id KDF pass plus an AEAD seal
   over your full conversation history — for a large profile this can take
   longer than the near-instant Archive export of a single conversation;
   say so if it's not instant in testing, don't silently spin).
6. On success: **"Recovery Bundle created."** with the destination path
   shown, and this line, matching the Backup Guide's existing custody
   warning verbatim in spirit:

   > Treat this file with the same care as a copy of your profile directory.
   > Store it somewhere you control; FedOS has no server-side copy of it and
   > no way to reissue it.

### What's NOT in the export flow (state plainly, don't let the user assume otherwise)

The export screen itself should list, under a **"What this bundle does NOT
include"** disclosure (collapsed by default, but present — not buried in a
separate doc only):

- Active Ratchet session state (re-established after restore, not carried
  over — see §2 below).
- Commerce receipts, purchased content, Tor settings — see §3.
- No auto-repeat/scheduled export. Every bundle is a manual, point-in-time
  snapshot, exactly like the existing raw profile-directory backup.

---

## 2. Import/restore flow on a fresh machine

Entry point: on a **fresh, empty profile** (this only makes sense before
`createProfile()` has run, or on an explicit "Restore from Recovery
Bundle" choice offered at first-run alongside "Create a new profile" —
`DESIGN.md` §3 requires import to land in a fresh, empty `userData`, never
merge into a live profile).

1. First-run screen offers **Restore from Recovery Bundle** as an
   alternative to **Create a new profile**.
2. Click **Choose Recovery Bundle file…**, pick the `.fedosrecovery` file.
3. Enter the **Recovery Bundle passphrase** (not your old unlock
   passphrase — same explicit reminder as export, since this is exactly
   the moment a user who reused their unlock passphrase might second-guess
   themselves, and a user who chose a different one needs to know which
   one to type).
4. Click **Inspect manifest** (mirrors the Archive flow's existing
   "Inspect manifest" step) — shows, before anything is decrypted onto
   disk: source app version, bundle creation timestamp, and the per-asset
   list this doc's §3 table below expands on. This is the moment to warn
   about version compatibility if the manifest's app version looks
   incompatible with the running build (see Import Error States, §4).
5. Click **Restore**. Internally this runs the staged validate-then-move
   `DESIGN.md` §3 describes: decrypt to a temp staging area, validate every
   file's digest and every schema version, and only then move into the
   live profile. **If validation fails at any point, nothing is written to
   your live profile** — the screen should say this outright so a failed
   restore doesn't read as "my data is now half-gone."
6. On success, before the app unlocks into normal use, show a **one-time
   "Restore complete" summary screen** — this is the single most important
   piece of copy in the whole import flow, because it is where every
   RECOVERED / REESTABLISHED / PARTIAL / LOST classification from
   `DESIGN.md` §3 must be stated, not silently absorbed into "restore
   succeeded":

   > **Restore complete. Some things need one more step.**
   >
   > **Recovered:** Your identity, account keys, and conversation/message
   > history.
   >
   > **New device identity:** This computer is now registered as a new
   > device on your account. Contacts you've messaged before will be
   > notified automatically the next time FedOS reaches them — but a
   > contact who is offline won't see this until they come back online, and
   > FedOS cannot confirm they've received or accepted it (see below).
   > Until they have, sending to them may not use an encrypted Ratchet
   > session yet.
   >
   > **Not restored — not needed:** Old encrypted-session state was
   > deliberately not carried over, for your security. Sessions
   > re-establish automatically the next time you message each contact.
   >
   > **Not restored — did not exist to back up:** Commerce receipts,
   > purchased content, and Tor settings. See "What is genuinely lost," below.

### Peer notification — what actually happens, stated honestly

Per `DESIGN.md` §4, restore mints a fresh device identity and is expected
to notify known peers via the existing Identity Transition Outbound
Notification Coordinator
(`src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.ts`).
Confirmed from that file: the notification is sent through
`sendMailboxNip17Control`, described in the file's own header as reusing
"the SAME... Outbox/retry/Relay-ACK machinery verbatim" — i.e. the same
queue-and-retry path as an ordinary message, not an instant push. The
coordinator's own result type separates `relayOutcome` from peer
acceptance, and its header states plainly: "this coordinator has no way to
know whether the peer ever imports what it publishes." The UI copy must
match that limitation exactly — do not say "your contacts have been
notified." Say:

> Notification to your contacts is queued and sent the same way your
> messages are — it reaches contacts who are online now, and reaches
> offline contacts once they reconnect. FedOS cannot confirm a contact has
> received or acted on this notification.

### Messaging a contact whose Ratchet session hasn't re-established yet

This is a **confirmed gap, not a design choice**: a real readiness signal
exists in the runtime
(`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_readiness.ts`,
states `ready` / `sealing-authority-unavailable` / `session-not-found` /
`session-not-active` / `runtime-stopped`) and route resolution
(`fedos_direct_ratchet_route_resolution.ts:137-151`) already consults it to
decide whether a send can use the Ratchet route at all — but grepping the
full renderer/UI surface
(`packages/fedos-desktop-electron-spike/**`) turns up **zero** references to
this readiness type or its states. Nothing in the shipped UI reads or
displays it today. This matches the standing finding in this project's own
"Conversation Security State UI" review: FedOS computes no safety number
and gives no visible signal that an "active" session even means
ratchet-routed messages.

Concretely, that means: **as of this branch, there is no "reconnecting…"
state a user would see.** When a Ratchet route is not ready, route
resolution returns `{ route: "unsupported", reason: ... }`; whether the
caller then silently falls back to a non-Ratchet wire route, silently
queues, or silently fails is a property of whatever calls
`resolveFedosDirectRatchetRoute()` — out of scope to re-trace fully here,
but the UI layer has no readiness-aware display regardless of which
happens. **This UX draft cannot honestly promise a "waiting to
reconnect…" indicator, because none exists to wire up.** This is called
out again as a Finding below — it is a prerequisite for shipping the
Recovery Bundle import flow honestly, not a nice-to-have.

Until that UI signal exists, the Restore Complete summary screen (above)
is the only honest place to set the expectation up front, and the copy
should say so rather than imply a live status indicator will appear later
in the conversation view.

---

## 3. What to tell the user is LOST

A dedicated, permanent line item in both the export "what this bundle does
NOT include" disclosure and the import "Restore complete" summary — not a
buried footnote, matching the bluntness of the Backup Guide's "There is no
cloud backup or account-recovery service":

> **Commerce receipts, purchased content, and Tor settings are not
> included in a Recovery Bundle, and never will be by copying more files —
> there is nothing to back up.** No durable storage for any of these
> exists anywhere in this build. If you are relying on FedOS to retain a
> purchase record or a specific Tor configuration, it is not doing so
> today, with or without a Recovery Bundle.

---

## 4. Import error states

Matching the existing Recovery and Troubleshooting Guide's short
diagnostic-code convention (`recovery-required` / `corrupt` /
`seed-unavailable` / `unsupported-version`) and `DESIGN.md` §3's staged
validate-then-move design (nothing is written to the live profile unless
the *whole* bundle validates):

- **`bundle-wrong-passphrase`** — "This Recovery Bundle could not be
  opened. Either the passphrase is incorrect, or the file is corrupted —
  FedOS cannot tell these apart (the same is true for your unlock
  passphrase; see the Recovery Guide). Re-check the passphrase and try
  again."
- **`bundle-corrupt`** — same on-screen message as above, since (per
  `DESIGN.md` §2, reusing `restore_sealed`'s discipline) AEAD failure never
  distinguishes wrong-passphrase from tampering by design. Do not present
  these as two different diagnoses to the user; present one message, one
  code, honestly reflecting that ambiguity rather than guessing.
- **`bundle-unsupported-version`** — "This Recovery Bundle was created by
  an incompatible FedOS version and cannot be restored by this build.
  Install the version shown in the bundle manifest, or a compatible one,
  and try again." Shown only if the manifest itself decrypts successfully
  but declares a schema version this build doesn't recognize — i.e., after
  passphrase/AEAD success, at the manifest-validation stage in `DESIGN.md`
  §3 step 2.
- **`bundle-incomplete`** — "This Recovery Bundle did not pass validation
  — one or more included files is missing or does not match the bundle's
  own manifest. Nothing has been written to this profile. This bundle
  cannot be restored as-is." This is the direct product of `DESIGN.md`
  §3's "any mismatch → reject the whole bundle, zero partial writes"
  rule — there is no partial-restore option in this design, and the UI
  must not offer one. **Do not offer "restore what we can"** — that would
  contradict the design's own closed-fail discipline. If a partial-restore
  path is ever wanted, it needs to be a deliberate, separately-labeled
  design decision, not a UI convenience layered on top of this validator.
- **Generic staging/IO failure** (disk full, permissions, temp directory
  unwritable) — "Restore could not complete: `<short OS error text>`. Your
  live profile was not modified." — reiterate the "not modified" guarantee
  every time restore does not reach the final atomic move step, since
  that's the single fact users will be most anxious about after a
  failed-looking restore.

Every error state above ends the same way the existing Recovery screen
does: a **Copy diagnostic code** action (non-secret, shareable with
support), and no path that claims to recover a forgotten Recovery Bundle
passphrase — matching "There is no way to recover a forgotten passphrase"
verbatim from the Recovery and Troubleshooting Guide.

---

## §6 precedent — verified wording

`DESIGN.md` §6 quotes the Backup Guide's Archive-restore precedent to
justify re-running restored content through current retention/suppression
state. Checked against source: the quoted sentence — *"restoring an
Archive applies your CURRENT retention/suppression state at restore time,
so some previously-deleted content may come back marked as
redacted/tombstoned rather than fully restored, by design"* — appears
**verbatim** in `docs/desktop_beta_user_guide_backup.md` (lines 61-64,
under "A different, narrower backup: Archive export"). `DESIGN.md`'s
citation is accurate.

The dedicated Archive and Deletion Guide
(`docs/desktop_beta_user_guide_archive_and_deletion.md`) does **not**
repeat that exact sentence — it states the same underlying idea in
different words ("A Device that never received a related
deletion/suppression fact from you is not covered by this restore's own
retention guarantees — restoring the same Archive onto a different,
out-of-sync Device may show content this Device would otherwise have
hidden," lines 28-31), without the "redacted/tombstoned" phrasing. Recovery
Bundle restore copy should reuse the Backup Guide's exact
"redacted/tombstoned" wording (that is the phrase `DESIGN.md` itself
anchors on), e.g.:

> Restoring this Recovery Bundle applies your CURRENT retention/suppression
> state, not the state at the time the bundle was created. Some
> previously-deleted content may come back marked as redacted/tombstoned
> rather than fully restored, by design.

---

## Findings for the design doc

1. **No UI readiness signal exists for Ratchet re-establishment — this is
   a real prerequisite gap, not just missing copy.** `DESIGN.md` §5
   describes sessions "reestablish[ing] through the existing... machinery
   on next contact with each peer" but never states whether the user sees
   anything while that happens. Confirmed by full grep: the readiness type
   (`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_readiness.ts:9-14`)
   and its consumer
   (`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_route_resolution.ts:137-151`)
   are both internal-only — zero references anywhere under
   `packages/fedos-desktop-electron-spike/**`. Recommend `DESIGN.md` §5
   explicitly add a UI requirement (or an explicit non-goal, if deferred):
   surface Ratchet readiness state per-conversation so a user restoring
   onto a new device sees *something* other than a message that may or may
   not silently fall back to a non-Ratchet route. This should be scoped
   and flagged before Goal 3/4 implementation, not discovered post-ship.

2. **Two-passphrase confusion is a real UX risk the design doc names but
   doesn't resolve.** `DESIGN.md` §2's "may equal or differ from your
   unlock passphrase" is the right cryptographic decision, but nothing in
   the design specifies *how* the export/import screens prevent a user
   from assuming "my usual passphrase unlocks everything." This draft
   handles it with explicit repeated on-screen copy (§1, §2 above) — but
   recommend `DESIGN.md` §2 be updated to state the UI requirement
   directly (e.g. "export and import screens MUST explicitly label this as
   a separate passphrase, adjacent to the input, not only in a help
   panel"), so it isn't left to an implementer's judgment call the way it
   currently is.

3. **Peer-notification honesty constrains the Restore-Complete copy more
   than `DESIGN.md` §4 currently spells out.** §4 says peers are notified
   "rather than silently resuming," which is accurate for the *device* not
   silently resuming, but on a first read could be misread as "peers are
   promptly informed." Confirmed from
   `fedos_identity_transition_outbound_notification_coordinator.ts:1-31`
   that delivery reuses ordinary Outbox retry semantics and the
   coordinator explicitly cannot confirm peer-side acceptance. Recommend
   `DESIGN.md` §4 add one sentence making the queue-not-push nature and
   the no-delivery-confirmation property explicit, so a future
   implementer doesn't build a UI that overpromises (as an early draft of
   this document nearly did before checking the source file).

4. **No partial-restore path exists or should exist, but this is worth
   pinning down explicitly in `DESIGN.md` §3** — the design's "any
   mismatch → reject the whole bundle" is the right behavior and this
   draft encodes it as `bundle-incomplete` with no partial-accept option,
   but §3 doesn't explicitly rule out a future "restore what validated"
   feature. Worth one sentence in §3 stating that's a deliberate
   closed-fail choice, not an oversight, so it isn't "fixed" into a
   partial-restore feature without a fresh security review.
