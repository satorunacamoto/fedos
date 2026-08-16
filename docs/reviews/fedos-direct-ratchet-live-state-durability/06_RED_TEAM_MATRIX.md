# Direct Ratchet Live-State Durability — Red Team Attack Matrix

**Author**: Agent R. Adversarial, read-only review. No source file was modified to produce
this document. Repo `C:/wt/fedos-installed-startup-root-cause`, branch
`arc/fedos-installed-startup-root-cause`, HEAD `3b78add15642fd38af601647c7ca332b1027e658`
(verified via `git rev-parse HEAD`; unchanged throughout — no checkout performed).

**Scope**: threat-models the sealed live-state snapshot mechanism for the four fixed-kind
Direct Ratchet secrets (root key, sending chain key, receiving chain key, local ratchet
private key) against the 11 attacks named in the task brief. Extends, and in three places
sharpens or corrects, the prior work already landed in this same review directory:
`01_CURRENT_LIVE_STATE_MODEL.md` (Agent S), `02_EXISTING_SEALED_SECRET_PRIMITIVES.md`
(Agent S), `03_RESTART_FAILURE_MODEL.md` (Agent M), `05_SECURITY_UI_TRUTH_MODEL.md`
(Agent U) — all four already existed on disk when this document was written (they landed
concurrently, mid-investigation). This document does not repeat the identity-space
analysis already closed by `docs/reviews/fedos-direct-ratchet-identity-space-final/05_SECURITY_MIGRATION_THREAT_MODEL.md`
(read in full first, per the task brief) — it cites that document's INV-11 and Attack-6
findings directly where the new mechanism's behavior needs to be checked against them.

**Correction to the task brief's own premise**: the brief frames this as future design
work ("Agent S the persistence/sealing mechanism... Agent M the restore lifecycle"). Per
Agent S's own `01_CURRENT_LIVE_STATE_MODEL.md` §0, **this is not true** — a fully-built,
restart-safe, file-backed implementation of the snapshot mechanism (`FileFedosDirectRatchetLiveStateSnapshotPersistence`,
`src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.ts:76-121`)
already exists in the tree and is already exercised end-to-end by a real, passing restart
test (`test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts:335-603`). The gap
is that this class is never constructed at the real desktop composition root
(`fedos_desktop_runtime.ts:1231-1259` never sets `snapshotPersistence`, so the in-memory
default is always used in production — `fedos_conversation_runtime.ts:757-765`). This
document therefore threat-models **real, already-written code**, not a hypothetical
design — every citation below is to a file:line that exists on HEAD today.

**Verdict key** (same as the prior threat-model doc):
- **SAFE-BY-CONSTRUCTION** — the existing mechanism already forecloses the attack.
- **SAFE-WITH-EXPLICIT-CHECK** — closed only if a named, specific, testable check holds.
- **VULNERABLE-IF-CARELESS** — a real way to get this wrong exists, avoidable only by a
  named discipline.
- **GENUINELY-VULNERABLE** — a structural gap discipline alone cannot close.

---

## 0. Grounding facts specific to this mechanism

- **The binding tuple is bound directly in Rust, not just indirectly via `sessionId`.**
  `FedosMasterSeedAuthority::seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`
  (`packages/fedos-core-rust/src/lib.rs:12741-12840`) take `local_device_ref`,
  `remote_device_ref`, `conversation_id`, and `generation` as **four separate, explicit
  parameters**, all four folded into the HKDF session-key derivation
  (`fedos_derive_direct_ratchet_session_sealing_key_internal`, `lib.rs:12938-12997`).
  Any mismatch on any of the four re-derives a different AEAD key, so restoration fails
  by AEAD authentication, never by a string comparison. This is a stronger binding than
  the prior threat-model doc's INV-11 described for the Foundation Arc's general-purpose
  path — this new path binds `conversationId` and `generation` as first-class sealing
  context too, not only device refs.
- **Every one of the five secret-kind seal/restore wrappers reuses the exact same shared
  primitive.** `seal_root_key`/`seal_sending_chain_key`/`seal_receiving_chain_key`/
  `seal_local_ratchet_private_key`/`seal_all_skipped_keys` (`lib.rs:13241-13344`) are thin
  wrappers that each call `seal_direct_ratchet_secret()` with the identical four-tuple
  (`self.inner.local_device_ref`, caller-supplied `remote_device_ref`, caller-supplied
  `conversation_id`, `self.inner.generation`). `FedosDirectRatchetSession::restore()`
  (`lib.rs:13354-13480`) is symmetric — confirmed independently by this review and by
  `02_EXISTING_SEALED_SECRET_PRIMITIVES.md` §4/§5.
- **This binding is device-ref-only, NOT account-ref-folded — a real, separate finding
  from the prior threat model's INV-11.** The actual live call sites
  (`fedos_direct_ratchet_inbound_integration.ts:406,487`; `fedos_direct_ratchet_outbound_integration.ts:234,362`)
  call `session.sealState(masterSeedAuthority, remoteDeviceRef, conversationId)` with the
  **raw** `remoteDeviceRef` string, never `fedosDirectRatchetSealingDeviceContext(accountRef, deviceRef)`
  (the account+device composite string, `fedos_direct_ratchet_session_binding.ts:39-41`).
  That composite-context function IS used — but only by `FedosDirectRatchetStateRuntime.sealAndPersistSecret()`/`.recover()`
  (`fedos_direct_ratchet_state_runtime.ts:369-371,424-425`), a **different, older
  (Alpha 5401-5480) API that is never called anywhere in `src/`** (confirmed:
  `grep -rn "\.sealAndPersistSecret\(\|\.recover\(" src/` → no matches — dead code, not
  wired into the live message path). See Attack 2 below for the consequence.
- **`sessionId` bakes in the entire binding tuple as a string, including `generation`.**
  `toFedosDirectRatchetSessionId()` (`fedos_direct_ratchet_session_id.ts:100-129`) encodes
  `localAccountRef##localDeviceRef##remoteAccountRef##remoteDeviceRef##conversationId##suite##generation`
  with a collision-safe `"##"` delimiter (every component pre-validated free of the
  delimiter, `/`, `\`, NUL — `isSafeComponent()`, `:78-88`). `FedosDirectRatchetLiveStateSnapshotPersistence.putSnapshot()`/`.getSnapshot()`
  (`fedos_direct_ratchet_live_state_snapshot_persistence.ts:52-55`) are keyed by this
  **full** `sessionId` string. This is load-bearing for Attacks 3, 5, 9, 10 below.
- **The live-state snapshot record itself has no `schemaVersion`, no `generation`, and no
  chain-position field of its own** (`FedosDirectRatchetLiveStateSnapshotV1`,
  `fedos_direct_ratchet_live_state_snapshot_persistence.ts:45-50`) — it is four opaque
  hex strings and nothing else. Contrast with `FedosSealedDirectRatchetSecretRecordV1`
  (`fedos_sealed_direct_ratchet_secret_record.ts:51-65`), which DOES carry `schemaVersion: 1`,
  `generation`, and `chainCounter`. This asymmetry is load-bearing for Attacks 5, 6, 8.
- **The current-value store is physically an append-forever NDJSON log with
  "last-line-for-this-key-wins" read semantics**
  (`fedos_direct_ratchet_live_state_snapshot_persistence.ts:83-121`), not a rewrite-in-place
  single-file store. `putSnapshot()` is a pure `appendFileSync` — it never deletes or
  truncates a prior line. `02_EXISTING_SEALED_SECRET_PRIMITIVES.md` §6b already identifies
  the direct consequence (every historical sealed chain-key value for a session remains
  recoverable from the file forever, given the Master Seed) as **the** open issue blocking
  safe production wiring, with a recommended fix (atomic overwrite-in-place, modeled on
  `FileFedosSealedMasterSeedEnvelopePersistence`'s existing single-file precedent). This
  document's Attack 5 treats the SAME root cause from a second, more active angle that
  `02_EXISTING_SEALED_SECRET_PRIMITIVES.md` does not cover: not passive file-read exposure,
  but live-session rollback via NDJSON replay.
- **`checkpointFedosDirectRatchetSecretsV1()`/`restoreFedosDirectRatchetSealedStateV1()`
  perform no sealing/unsealing of their own** (`fedos_direct_ratchet_secret_checkpoint.ts:1-141`,
  confirmed by the file's own header, lines 10-11) — they only route already-sealed hex
  strings between the two persistence ports. All cryptographic authentication happens
  exclusively inside the Rust boundary.
- **`checkpointFedosDirectRatchetSecretsV1()` is called at exactly three sites**, always
  immediately after a state-advancing step: session establishment
  (`outbound_integration.ts:234-245`, `inbound_integration.ts:406-417`), every outbound
  `encrypt()` (`outbound_integration.ts:362-377`), every inbound `decrypt()`
  (`inbound_integration.ts:487-502`). `03_RESTART_FAILURE_MODEL.md` §4 independently
  confirms and endorses this per-step (not batched/interval) checkpoint policy as the only
  safe one, for the same reason argued here in Attack 5/11.
- **Restore is lazy, on first use, never eager at startup** — confirmed independently by
  this review and by `03_RESTART_FAILURE_MODEL.md` §2, which also argues (correctly) that
  staying lazy is the right design, not a gap.
- **Not yet wired to a real profile-scoped path at all.** `FedosLocalProfilePaths`
  (`src/os/messenger/desktop/onboarding/fedos_local_profile_paths.ts:39-163`) has no
  `directRatchetLiveStateSnapshotLogFile` leaf (confirmed by direct read of the full
  interface and `planFedosLocalProfilePaths()`) — the file has leaves for
  `directRatchetSessionLogFile`, `directRatchetSealedSecretLogFile`,
  `directRatchetResetRecordLogFile`, `directRatchetImportRecordLogFile`, but not for the
  live-state snapshot. This is a real, currently-open gap relevant to Attack 2.

---

## 1. Per-attack analysis

### Attack 1 — Tampered sealed snapshot (bit-flip)

Traced the exact path: `restore_32()` (`lib.rs:13372-13396`), the shared helper every one
of `restore()`'s four fixed-field restores calls, does `authority.restore_direct_ratchet_secret(...)?`
— the `?` operator means **any** `None` (AEAD authentication failure, malformed hex,
truncated nonce) propagates immediately out of the whole `restore()` call with **no**
partial session ever constructed (`lib.rs:13398-13421`, every field restore uses the same
`?`-propagation pattern). At the TypeScript boundary,
`attemptDevOnlyDirectRatchetRestoreCall()` (`fedos_direct_ratchet_cryptographic_session.ts:247-253`)
wraps the call in try/catch and maps both a thrown exception and a `null`/`undefined`
result to `null`. `FedosDirectRatchetCryptographicSession.restore()` (`:430-468`) then
returns `null`. The caller — `#restoreLiveSession()` in both
`fedos_direct_ratchet_outbound_integration.ts:401-428` and
`fedos_direct_ratchet_inbound_integration.ts:561-586` — checks `if (restored === null) return { outcome: "crypto-unavailable" }`.

**Critically, `"crypto-unavailable"` is a distinct outcome from `"unknown-session"` /
`"session-initialization-required"`** (used when `sessionMetadata`/`getSnapshot()` itself
is `null`, i.e. genuinely never-existed state — `inbound_integration.ts:433`,
`outbound_integration.ts:321`). Grepped every call site of `"crypto-unavailable"` in
`src/` (13 matches, all in `fedos_direct_ratchet_{in,out}bound_integration.ts` and
sibling transport files) — none of them catches this outcome and silently falls back to
creating a fresh session. The outcome propagates up to the caller's own caller
unmodified. **Verdict: SAFE-BY-CONSTRUCTION.** The existing AEAD fail-closed discipline
generalizes correctly to this new use, and the outcome taxonomy already keeps
"tampered/mismatched" distinguishable from "cold start" — the exact property the task
brief asks to confirm is not silently collapsed.

One caveat worth naming precisely, not a vulnerability: **which** of the four fields was
tampered is not distinguishable from the outcome — `restore()` fails closed as a whole,
which is correct (never construct a session from 3 good fields + 1 tampered one), but
means a single-bit flip anywhere in a ~350+ character hex blob destroys the entire
session's restorability, forcing full re-establishment rather than, say, recovering the
root key while re-deriving the chain keys. This is an availability tradeoff already
implicit in "one current-value snapshot with one shared `getSnapshot()` read," not a new
finding — flagged for completeness.

### Attack 2 — Wrong profile

Two separate questions, both grounded in code:

**(a) Path-level cross-profile leak.** `fedosLocalProfilePathsIsolated()`
(`fedos_local_profile_paths.ts:239-246`) provides the same "two roots share no subpath"
guarantee the prior threat model's Attack 4 already confirmed for every OTHER durable
leaf. **This guarantee does not yet apply to the live-state snapshot at all**, because no
leaf for it exists in `FedosLocalProfilePaths` today (§0 above) — there is nothing to
isolate yet since the file isn't wired to a profile-scoped path in production (only the
in-memory default is used, per Agent S's `01_CURRENT_LIVE_STATE_MODEL.md` §0). This is
**SAFE-BY-CONSTRUCTION-BY-ABSENCE today, VULNERABLE-IF-CARELESS the moment it's wired** —
the discipline is exactly the one the prior threat model already named for this pattern:
add `directRatchetLiveStateSnapshotLogFile: join(root, "direct-ratchet-live-state-snapshot.ndjson")`
to the existing planner (mirroring the sibling `directRatchetSealedSecretLogFile` line
immediately above it, `:197`), never construct a hand-built path elsewhere. Agent S's
`02_EXISTING_SEALED_SECRET_PRIMITIVES.md` §6a recommends wiring a `directRatchetLiveStateSnapshotLogPath`
config field but does not mention routing it through `FedosLocalProfilePaths` specifically
— this document adds that as an explicit requirement, not an optional nicety, since it is
the ONE mechanism in this codebase that actually proves isolation
(`fedosLocalProfilePathsIsolated()`, exercised by existing tests for every sibling leaf).

**(b) Cryptographic cross-account/cross-profile leak** (a sealed snapshot's ciphertext
copied from Profile A's file into Profile B's file, e.g. by a careless backup tool that
merges profile directories). Since each profile has its own independent Master Seed (a
fully separate root of trust — confirmed by every other document in this codebase's
sealing-authority chain), `restore_direct_ratchet_secret` run against Profile B's Master
Seed would derive a completely different session key than the one used to seal under
Profile A's Master Seed — AEAD authentication fails regardless of whether
`local_device_ref`/`remote_device_ref`/`conversation_id`/`generation` happen to collide.
**SAFE-BY-CONSTRUCTION** — this does not depend on device-ref uniqueness or account
binding at all; it is enforced by the Master Seed itself being profile-scoped, one layer
below anything this document's other findings touch. (Contrast with (a): a *path*-level
leak that let Profile B's process merely **see** the file is closed only once the planner
leaf exists; a *cryptographic* leak that let Profile B's process actually **decrypt** it
requires the wrong Master Seed to succeed, which it structurally cannot.)

**Verdict: SAFE-WITH-EXPLICIT-CHECK** (the check being: add the missing planner leaf
before wiring this store to a real path — not yet done, tracked as an open item).

### Attack 3 — Wrong conversation

Already answered definitively in §0: `conversation_id` is one of the four explicit,
separately-passed parameters to `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`
(`lib.rs:12741-12747,12797-12803`), folded directly into the AEAD key derivation. This is
**stronger** than the task brief's framing suggests ("does the sealing context bind
conversationId, or only device/account refs?") — it binds conversationId as a first-class,
independent parameter, not merely indirectly through `sessionId`. A Rust-level unit test
already exists and passes for exactly this: `restore_direct_ratchet_secret_fails_closed_on_wrong_conversation`
(`lib.rs:14877-14886`).

On the "is this even reachable" sub-question: since Direct Conversations are 1:1 and
`sessionId` already embeds `conversationId` as one of its own components
(`fedos_direct_ratchet_session_id.ts:66`), a snapshot for conversation X literally cannot
be looked up under conversation Y's sessionId key in the first place — `getSnapshot(sessionId_Y)`
would simply return `null` (or, in a pathological same-device-pair-different-conversation
scenario, the record for a DIFFERENT, unrelated session), never conversation X's record.
The cryptographic binding is therefore defense-in-depth on top of a lookup-key structure
that already makes the substitution unreachable through the normal call path — the only
way to even ATTEMPT this attack is by directly forging a `getSnapshot()` call with a
mismatched sessionId/conversationId pair, which the AEAD binding then independently
rejects. **Verdict: SAFE-BY-CONSTRUCTION**, doubly so (lookup-key structure AND
cryptographic binding both independently close it).

### Attack 4 — Wrong local/remote device

Confirmed: `restore_direct_ratchet_secret_fails_closed_on_wrong_local_device`
(`lib.rs:14855-14864`) and `restore_direct_ratchet_secret_fails_closed_on_wrong_remote_device`
(`lib.rs:14866-14875`) both exist and pass today, exercising the shared
`seal_direct_ratchet_secret`/`restore_direct_ratchet_secret` primitive directly.

The crux question — "would these tests extend correctly to the new four-fixed-kind
secrets IF they reuse the exact same Rust functions" — resolves cleanly: **yes, by
construction, not by inference.** `seal_root_key`/`seal_sending_chain_key`/
`seal_receiving_chain_key`/`seal_local_ratchet_private_key` (`lib.rs:13241-13315`) each
call `master_seed_authority.seal_direct_ratchet_secret(self.inner.local_device_ref.clone(), remote_device_ref, conversation_id, self.inner.generation, &bytes)`
— the literal same function under test at line 14855+, with no intermediate
transformation of any argument. There is no code path by which the four fixed-kind
secrets could receive weaker device-mismatch protection than what those two tests already
prove, because they are not a "similar" mechanism, they are the identical function call.
**Verdict: SAFE-BY-CONSTRUCTION, confirmed inherited, not merely assumed.**

One genuine gap, not in the crypto but in **test coverage of the wiring**: the existing
Rust tests exercise `FedosMasterSeedAuthority::seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`
directly, never through `FedosDirectRatchetSession::restore()` (the WASM-exported wrapper
`checkpointFedosDirectRatchetSecretsV1()`/`restoreFedosDirectRatchetSealedStateV1()`
actually call). No TypeScript-level test constructs a real session, checkpoints it, then
attempts `FedosDirectRatchetCryptographicSession.restore()` with a deliberately wrong
`remoteDeviceRef`/`localDeviceRef`/`conversationId` and asserts `null`. This is a coverage
gap for the *wiring*, not the *primitive* — see the negative-test matrix, row LSS-4.

### Attack 5 — Stale generation replay (the single most important question in this document)

This decomposes into two structurally different sub-attacks that the task brief's framing
conflates; distinguishing them precisely is the point.

**5a. Cross-generation replay (an OLDER *generation*'s snapshot reintroduced after a
session reset bumped the generation).** `generation` is baked into BOTH the AEAD sealing
context (§0) AND the `sessionId` string itself (`fedos_direct_ratchet_session_id.ts:69,125`).
A session reset (`FedosDirectRatchetSessionResetAuthority.evaluate()`, gated per the prior
threat model's Attack 6/INV-5 on the RECEIVER's own `locallyKnownPreviousGeneration`, never
payload-asserted) produces a **new** `sessionId` for the new generation. Once the local
Runtime has advanced to generation G+1, every lookup (`getSnapshot()`, `#restoreLiveSession()`)
uses the sessionId encoding G+1 — the OLD generation-G snapshot sits under a DIFFERENT key
and is never consulted again, even if the file backing it (or a malicious/buggy replay of
it) still exists on disk. Restoring the wrong tuple's snapshot into the current session is
therefore not just AEAD-rejected, it is **structurally never attempted** — the current
Runtime literally does not know to look there. **Verdict: SAFE-BY-CONSTRUCTION** for
cross-generation replay specifically, confirmed by tracing `sessionId` derivation rather
than assumed.

**5b. Same-generation stale-position replay (the real, unclosed gap).** Within ONE
generation, the chain key legitimately advances on **every** `encrypt()`/`decrypt()` call
(§0), but the AEAD sealing context does **not** include the chain position/counter for
the four fixed-kind secrets (only `local_device_ref`/`remote_device_ref`/`conversation_id`/`generation`
— confirmed at `lib.rs:12741-12747`; `secretKind` itself is not even in the context, per
`02_EXISTING_SEALED_SECRET_PRIMITIVES.md` §5's own residual-observation finding). This
means **every sealed chain-key value ever produced for a given `(sessionId, generation)`
authenticates successfully under the identical key**, regardless of which chain position
it actually represents. Combined with the physical storage shape (§0: append-forever
NDJSON, last-line-wins), this produces two distinct, both-real exploitation angles for the
identical root cause:

- **Passive** (already identified, `02_EXISTING_SEALED_SECRET_PRIMITIVES.md` §6b): anyone
  who obtains both the snapshot log file and the Master Seed can restore and walk forward
  from ANY historical sealed chain-key line in the file, decrypting every message the
  session ever sent/received in that generation — not just the current state. This
  retroactively and completely defeats forward secrecy for the file's entire on-disk
  history the moment both secrets are compromised together.
- **Active, live-session rollback** (this document's own addition — not covered by
  `02_EXISTING_SEALED_SECRET_PRIMITIVES.md` §6b, which analyzes file exposure, not replay
  into a running process). If an attacker with local write access to the profile
  directory — or, with zero adversarial intent, a naive backup/restore tool that appends
  an old NDJSON snapshot back onto the live file, or restores a stale full-profile backup
  over a newer one — reintroduces an OLDER line for the SAME `sessionId`, the reader's own
  "last line for this key wins" logic (`getSnapshot()`, `:96-118`) makes that stale line
  authoritative on the very next lazy restore. Since the AEAD context doesn't encode chain
  position, the stale blob decrypts successfully (it is a genuinely valid seal, just an
  old one) and the RUNNING session's own `#restoreLiveSession()` reconstructs the ratchet
  at the older chain position. **This is the retroactive forward-secrecy break made
  concrete and reachable, not just theoretical**: a message that was supposed to become
  permanently undecryptable the moment the chain advanced past it becomes decryptable
  again the moment the Runtime restores from the stale checkpoint and walks the KDF chain
  forward from that older position, since a hash-ratchet chain is one-way-forward-derivable
  — possessing chain state at position K lets you derive positions K, K+1, K+2, ... exactly
  as if the discard of the newer state had never happened.

**Does the protocol's own generation-integrity check (`FedosDirectRatchetSessionResetAuthority`)
protect against 5b? No — confirmed precisely, not assumed.** That authority gates
session-level `generation`/`previousGeneration` transitions only (a NEW reset payload
claiming to establish generation G+1); it has no visibility into, and no opinion about,
the WITHIN-generation chain-key checkpoint mechanism at all — the two are structurally
independent code paths (`fedos_direct_ratchet_session_reset_authority.ts` is never called
by `checkpointFedosDirectRatchetSecretsV1()`/`restoreFedosDirectRatchetSealedStateV1()`,
confirmed by absence of any import between the two files). This is exactly the
"structurally different, unprotected surface" the task brief asked to identify precisely.

**Verdict for 5b: GENUINELY-VULNERABLE as currently implemented** (both the passive file-
exposure framing already named by Agent S and this document's active-replay framing share
the same root cause and the same fix). This is not closeable by discipline alone at the
application layer — a determined replay of an old, validly-sealed NDJSON line cannot be
distinguished from a legitimate current checkpoint using only information available to
`getSnapshot()`'s "last line wins" logic, because the record carries no monotonic ordering
fact of its own. **The fix Agent S already recommends (§6b: rewrite-in-place instead of
append-forever, one current sealed value survives on disk) closes the passive angle
completely, and substantially narrows the active-replay angle** (there's no longer a
history of old lines sitting in the SAME file to selectively re-append), **but does not by
itself fully close 5b** unless paired with a write-ordering/freshness guard: an entire
stale FILE (or stale directory, via a whole-profile backup restore) can still be
substituted wholesale for the current one even under rewrite-in-place semantics, since
"this file's content is current" is still established purely by "it decrypts," never by
any monotonic counter. This is precisely the class of guard the task brief attributes to
"Agent M" as a separate design concern — and it is the single highest-priority invariant
this whole document identifies (see INV-LSS-1).

### Attack 6 — Duplicate / conflicting snapshot

Current semantics: `putSnapshot()` is unconditional overwrite-via-append, no conflict
detection of any kind (`fedos_direct_ratchet_live_state_snapshot_persistence.ts:83-85`).
Correct idempotency behavior, stated precisely:

- **Genuine duplicate** (a retried checkpoint call after a transient write failure,
  re-sealing the SAME already-current chain-key value): since `seal_direct_ratchet_secret`
  uses a fresh random 96-bit nonce every call (`fedos_aead_nonce_96()`, `lib.rs:12766`),
  even a byte-for-byte-identical plaintext produces a DIFFERENT ciphertext string on
  retry — confirmed by the existing Rust test
  `seal_direct_ratchet_secret_is_deterministic_in_key_but_not_in_ciphertext`
  (`lib.rs:14941-14955`). Two "duplicate" lines are therefore never byte-identical in the
  file, but both decrypt to the identical plaintext, so `getSnapshot()`'s last-line-wins
  read is functionally correct regardless of which of the two lines it happens to
  pick — the RESULT is idempotent even though the STORED bytes are not. **This is
  correct**, and should stay this way (the four fixed-kind fields deliberately have no
  "already-present" conflict check — unlike the insert-only sealed-secret store's
  skipped-key path, `append_only_fedos_sealed_direct_ratchet_secret_persistence.ts:34-42`,
  which correctly DOES conflict-check via `recordsAreIdenticalByValue()`, because THAT
  store's key includes a unique `chainCounter` making "same key, different value" a real
  corruption signal — the current-value snapshot's key is deliberately coarser, so this
  distinction does not apply to it).
- **Genuine conflict** (two DIFFERENT, both-legitimate advances racing — e.g. a caller bug
  that invokes `encrypt()` twice concurrently on the same live session object before the
  first checkpoint lands): this is a liveness/serialization concern, not a storage-format
  concern. `appendFileSync` is synchronous and Node's single-threaded event loop already
  serializes any two calls originating from the same process, so a genuine data race
  requires either multiple processes writing the same file (not this codebase's current
  architecture — one process per profile) or an `async` gap between reading live counters
  and committing them that lets two logically-concurrent sends interleave. No such gap was
  found in the traced call sequence (§0) — each `sendMessage()`/`#receiveMessage()` call
  reads and commits counters synchronously relative to its own `await` chain, and
  `FedosDirectRatchetLiveSessionCache` is a bare `Map`, so two calls for the DIFFERENT
  sessions never contend, and two calls for the SAME session within one process would
  both operate on the same in-memory Rust handle sequentially (WASM has no internal
  threading here). **Verdict: SAFE-BY-CONSTRUCTION for the single-process architecture
  this codebase currently has** — the "conflict" case the task brief asks about is not
  presently reachable, PROVIDED (discipline, not automatic) no future change ever allows
  two processes/threads to hold the same profile's snapshot file open for concurrent
  write, which nothing today prevents at the filesystem level (no lock file). Named as
  INV-LSS-6 below since it is currently true by architecture, not by an enforced
  invariant.

### Attack 7 — Truncated/partial-write snapshot

Traced precisely through both layers:

1. **NDJSON-line truncation** (crash mid-`appendFileSync`): `getSnapshot()`'s parse loop
   (`:96-118`) wraps `JSON.parse` in try/catch and `continue`s past any line that fails to
   parse — a torn trailing line (missing closing brace, cut-off string) throws inside
   `JSON.parse` and is silently skipped, falling back to the last successfully-parsed
   line. Confirmed independently by `03_RESTART_FAILURE_MODEL.md` §3(a)/(b)/(c), which
   reaches the identical conclusion via the crash-window analysis. **A torn line can never
   be silently accepted as valid state** — it either parses (and is then subject to the
   AEAD check below) or it doesn't parse at all.
2. **Ciphertext-body truncation** (a syntactically-valid-JSON line whose hex `sealedBlob`
   value was itself truncated, e.g. by a disk-full write that still closed the JSON
   correctly): `fedos_decode_direct_ratchet_sealed_blob()` (`lib.rs:13041-13068`) rejects
   an odd-length hex string outright and rejects fewer than 12 decoded bytes (too short
   even to hold the 96-bit nonce) — both `None`, never a panic, never a partial decode.
   If the truncation left ≥12 bytes (nonce present, ciphertext+tag short), decoding
   succeeds but `open_internal()`/the underlying `chacha20poly1305` AEAD open
   (`crypto/aead_internal.rs:339-389`) requires the ciphertext to be at least
   `AEAD_TAG_LEN` (16 bytes, `ciphertext_serialization.rs:76`) and authenticates the
   FULL remaining byte sequence as `ciphertext‖tag` — a truncated buffer either fails this
   minimum-length check or, if coincidentally long enough, presents the WRONG final 16
   bytes as the "tag" (since the real tag was computed over the complete, untruncated
   ciphertext) — authentication fails with cryptographically negligible (~2⁻¹²⁸)
   probability of accidental success. No code path anywhere in this chain returns a
   shorter-but-still-"successfully"-decrypted plaintext.

**Verdict: SAFE-BY-CONSTRUCTION**, confirmed by tracing the concrete AEAD construction
(ChaCha20Poly1305, per `crypto::aead_internal::AeadCipher::ChaCha20Poly1305` at
`lib.rs:12773`) rather than assumed from the cipher's name alone.

### Attack 8 — Unsupported schema version

**This is the one place this document finds a real, if narrow, discipline gap already
latent in the shipped code.** `FedosSealedDirectRatchetSecretRecordV1`
(`fedos_sealed_direct_ratchet_secret_record.ts:51-65`) DOES carry `schemaVersion: 1` and
`isWellFormedFedosSealedDirectRatchetSecretRecordV1()` rejects any record whose field set
or `schemaVersion` value deviates (`:148-172`, exact-closed-field-set check at `:153`).
**`FedosDirectRatchetLiveStateSnapshotV1` (`fedos_direct_ratchet_live_state_snapshot_persistence.ts:45-50`)
has NO `schemaVersion` field at all**, and `FileFedosDirectRatchetLiveStateSnapshotPersistence.getSnapshot()`'s
own structural validation (`:100-113`) only checks that `sessionId` matches and that
`sealedRootKey`/`sealedLocalRatchetPrivateKey` are non-empty strings — it does not reject
an object carrying EXTRA unknown fields (a future schema's additive field would be
silently ignored, not rejected), and has no version discipline to reject-unknown-version
in the first place, because there is no version to check.

This matters concretely because §0 already establishes the four fixed-kind fields are the
ENTIRE snapshot — a future schema addition (e.g., adding a chain-position counter to close
Attack 5b) would need a `schemaVersion` field to distinguish an old-format line (no
counter, must be treated as legacy/lower-trust) from a new-format line (counter present,
can be trusted for freshness ordering) during any rollout window. Without one today,
adding that field later cannot cleanly distinguish "this line predates the fix" from
"this line's counter is genuinely absent/zero," which is exactly the kind of migration
hazard `06_PROTOCOL_CONTRACT_FREEZE.md`/the identity-space threat model's INV-13 pattern
already warns about for a structurally analogous situation.

The codebase's own established discipline for exactly this shape of file — confirmed
directly by reading `fedos_local_peer_device_announcement_identity.ts:76`: "never
silently regenerates over a corrupt file, which would silently change this device's own
identity out from under every peer" — is fail-closed-on-malformed, never
silently-reinterpret-as-current. The live-state snapshot's OWN validation already does the
"fail closed on missing required field" half correctly (empty/non-string `sealedRootKey`
→ line skipped, `:107`), but has no version field to apply that discipline TO for a future
format change. **Verdict: VULNERABLE-IF-CARELESS** — not exploitable today (there is only
one schema version, so there is nothing to confuse it with yet), but a real, specific gap
that must be closed BEFORE any future field is added to this record, not after. See
INV-LSS-3.

### Attack 9 — Restore after identity transition

Confirmed by tracing `sessionId` derivation, not assumed: `localAccountRef`/`remoteAccountRef`
are two of the seven components `toFedosDirectRatchetSessionId()` joins
(`fedos_direct_ratchet_session_id.ts:117-126`). A peer's Identity Replacement changes the
`remoteAccountRef` the new session would be constructed with (the prior threat-model doc's
§0/Attack 7 already establishes device trust does not auto-carry across an Identity
Replacement, and `06_PROTOCOL_CONTRACT_FREEZE.md` §8 requires a fresh announcement under
the new identity Y). Any NEW session established post-transition therefore necessarily
encodes the NEW `remoteAccountRef` in its `sessionId`, which is a **different key** than
the OLD identity's session used for `putSnapshot`/`getSnapshot`. The old identity's
snapshot is neither read nor considered — there is no code path that resolves a
snapshot by `remoteAccountRef` alone, only by the full `sessionId`. **Verdict:
SAFE-BY-CONSTRUCTION**, confirmed to generalize to snapshot restoration specifically (the
task brief's own open question), via the identical mechanism (full-tuple `sessionId` as
the lookup key) that already closes Attacks 3/5a/10.

### Attack 10 — Restore after device change

Identical reasoning and identical proof mechanism as Attack 9: `localDeviceRef`/`remoteDeviceRef`
are two more of the seven `sessionId` components. `resolveFedosDirectRatchetDevicePair()`
(`fedos_direct_ratchet_device_pair_resolver.ts`) resolves a NEW session identity whenever
`remoteDeviceRef` changes (a genuinely new device per the prior threat model's Attack 8 —
`"device-replaced"` routes to `"manual-review-required"`, never automatic session
inheritance). A session for the SUPERSEDED device and a session for the NEW device
necessarily have different `sessionId` strings, hence different snapshot keys. **Verdict:
SAFE-BY-CONSTRUCTION**, verified by tracing `sessionId` derivation directly rather than
assumed from the resolver's own trust-gating behavior alone — the trust gate (Attack 8's
own mechanism) prevents a NEW session from ever being *established* against the
superseded device, and the sessionId structure independently prevents the superseded
device's OLD snapshot from ever being looked up even if that gate were somehow bypassed —
defense in depth, same pattern as Attack 3.

### Attack 11 — Crash consistency

`03_RESTART_FAILURE_MODEL.md` §3 already provides a thorough, correct crash-window
enumeration for all three checkpoint call sites (establishment, outbound encrypt, inbound
decrypt) and correctly concludes the checkpoint-before-enqueue/checkpoint-before-import
ordering this codebase already has is what prevents key-reuse across a crash. **This
document's own contribution is a narrower sub-window Agent M's analysis groups together
but does not split out, with a materially different conclusion for that sub-window.**

Both send and receive paths commit durable session-metadata counters
(`stateRuntime.commitCounters()`) STRICTLY BEFORE the durable crypto-state checkpoint
(`checkpointFedosDirectRatchetSecretsV1()`) — confirmed by exact line order:
outbound `sendMessage()`, counters at `:350-355`, checkpoint at `:362-377`; inbound
`#receiveMessage()`, counters at `:478-482`, checkpoint at `:487-502`. These are two
SEPARATE durable writes to two SEPARATE persistence ports (`FedosDirectRatchetSessionPersistence`
vs. `FedosDirectRatchetLiveStateSnapshotPersistence`), not one atomic transaction.
`03_RESTART_FAILURE_MODEL.md` §3(b)/(c) analyzes "crash before commitCounters()/the
snapshot checkpoint land" as one combined window and concludes "the send/receive never
happened" — that conclusion is correct ONLY for the sub-case where crash precedes BOTH
writes. It does not separately address the sub-case where crash lands strictly BETWEEN
them.

**Outbound sub-window** (crash after `commitCounters()` durably lands, before the
checkpoint durably lands): on restart, `sessionMetadata.counters.sendCounter` is durable
and ADVANCED (say, to N+1), but `snapshotPersistence.getSnapshot()` still returns the
STALE (pre-`encrypt()`) chain-key state. `#restoreLiveSession()` calls
`FedosDirectRatchetCryptographicSession.restore(..., sessionMetadata.counters.sendCounter [N+1], ..., sealedState [stale, pre-advance])`.
Traced into Rust: `DirectRatchetSessionState::restore()` (`direct_ratchet_session.rs:514-566`)
assigns `send_counter`/`sending_chain_key_bytes` from its given arguments independently,
with **no cross-validation between them** — confirmed by direct read of the function body
(a sequence of field assignments, no comparison between the counter and the chain-key
material's own implied position). The restored session is therefore internally
**self-inconsistent**: it believes `send_counter = N+1` (i.e., N+1 messages already sent
on this chain) while its actual `sending_chain_key` bytes are the value from BEFORE
message N was encrypted. The very next `encrypt()` call (`direct_ratchet_session.rs:242-263`)
embeds `message_number: self.send_counter` (= N+1, WRONG — no peer-visible message N+1 was
ever produced) in the wire header at line 252, THEN derives the message key by advancing
the STALE chain key one step (which is cryptographically the correct derivation for
position N, not N+1). The receiver, tracking its own expected position, will derive the
WRONG expected key for a message CLAIMING to be N+1 (advancing its own receiving chain
according to the claimed gap, not the sender's true internal state) — this fails closed
via AEAD authentication on the receiver's side (the Rust core's own duplicate/replay and
authentication logic, `03_RESTART_FAILURE_MODEL.md` §3(b) cites the relevant test
precedent), but **the mismatch is now permanent for this generation** — every subsequent
message inherits the same off-by-one desync, since `send_counter` never realigns with the
actual chain position on its own. This is NOT a security hole (no key reuse across
distinct plaintexts, no forward-secrecy violation, no cross-party key confusion — it fails
closed) but IS a genuine availability/correctness gap this document's crash-window
analysis identifies more precisely than `03_RESTART_FAILURE_MODEL.md`'s combined framing:
recovery requires a full session reset (`resetDirectRatchetSession()`), not a clean resend,
the moment a crash lands in this specific narrow sub-window.

**Inbound sub-window, a distinct and arguably more concerning consequence**: crash after
`commitCounters()` durably advances `receiveCounter` to M+1, before the checkpoint durably
lands (chain key still reflects PRE-`decrypt()` state at M). `03_RESTART_FAILURE_MODEL.md`
§3(c) argues redelivery of the same wire message "decrypts cleanly again with the SAME...
message key" on the theory that BOTH counters and chain state remain pre-decrypt — but in
THIS narrower sub-window, `receiveCounter` is already durably M+1 while the chain key is
still at M. On restart, the restored session's `receive_counter` (M+1) and its actual
`receiving_chain_key` (pre-M+1) disagree exactly as in the outbound case. Whether the
redelivered message M is then (a) wrongly rejected as an already-processed duplicate
(because the session BELIEVES receive_counter already passed M) or (b) processed via the
skipped-key mechanism with a key that doesn't actually match (because the chain material
backing that belief was never actually advanced) depends on exactly how the Rust decrypt
path reconciles a claimed message number against `receive_counter` vs. actual chain
material — either outcome is a correctness gap `03_RESTART_FAILURE_MODEL.md`'s "clean
redelivery" conclusion does not cover for this specific sub-window. Both outcomes fail
closed cryptographically (no plaintext corruption, no key confusion); the risk is
availability (a legitimately-sent message becomes permanently unreadable without a reset),
not confidentiality or integrity.

**Fix, stated precisely** (extends, does not replace, `03_RESTART_FAILURE_MODEL.md` §4's
own "checkpoint every step" conclusion, which this document endorses unchanged): the two
durable writes per step — `commitCounters()` and `checkpointFedosDirectRatchetSecretsV1()`
— must never be allowed to land independently of each other. Either (preferred) make them
one atomic transaction (a single durable write covering both counters and sealed chain
state, e.g. by folding the counters into the same current-value snapshot record and
dropping the separate `FedosDirectRatchetSessionPersistence` counter write for these three
fields specifically), or (minimum fix, smaller diff) reverse the write order so the crypto
checkpoint always lands FIRST and `commitCounters()` second — a crash between them then
always leaves counters LAGGING BEHIND (or equal to) the crypto state's true implied
position, never ahead of it, which degrades to the already-analyzed-safe "crash before
this step fully happened" case Agent M's document already covers correctly.

**Verdict: VULNERABLE-IF-CARELESS** (an availability/correctness gap, not a
confidentiality/integrity one — every failure mode here still fails closed
cryptographically) — closeable by the write-ordering/atomicity fix above, which should be
treated as part of the SAME piece of work as Attack 5's ordering-guard fix, since both are
instances of "two durable facts about the same session must never be allowed to disagree
about which is more current."

---

## 2. Consolidated verdict table

| # | Attack | Verdict |
|---|---|---|
| 1 | Tampered sealed snapshot | SAFE-BY-CONSTRUCTION |
| 2 | Wrong profile (path-level) | SAFE-WITH-EXPLICIT-CHECK (planner leaf not yet added) |
| 2 | Wrong profile (cryptographic) | SAFE-BY-CONSTRUCTION |
| 3 | Wrong conversation | SAFE-BY-CONSTRUCTION (doubly: lookup-key + AEAD binding) |
| 4 | Wrong local/remote device | SAFE-BY-CONSTRUCTION (confirmed inherited, not assumed) |
| 5a | Cross-generation replay | SAFE-BY-CONSTRUCTION |
| 5b | Same-generation stale-position replay | **GENUINELY-VULNERABLE** |
| 6 | Duplicate/conflicting snapshot | SAFE-BY-CONSTRUCTION (single-process architecture) |
| 7 | Truncated/partial-write snapshot | SAFE-BY-CONSTRUCTION |
| 8 | Unsupported schema version | VULNERABLE-IF-CARELESS (no version field exists yet) |
| 9 | Restore after identity transition | SAFE-BY-CONSTRUCTION |
| 10 | Restore after device change | SAFE-BY-CONSTRUCTION |
| 11 | Crash consistency (counters-ahead-of-crypto sub-window) | VULNERABLE-IF-CARELESS |

**One GENUINELY-VULNERABLE verdict** (5b), already independently identified from the
storage-exposure angle by `02_EXISTING_SEALED_SECRET_PRIMITIVES.md` §6b and extended here
with a live-rollback-via-replay angle and a note that the already-recommended fix narrows
but does not fully close it without an added freshness/ordering guard. Everything else is
SAFE-BY-CONSTRUCTION or a named, narrow, closeable discipline gap.

---

## 3. Non-negotiable invariants (falsifiable)

1. **INV-LSS-1 (Freshness/monotonicity of the live-state snapshot)**: a live-state
   snapshot restore MUST be able to detect and reject a chronologically-older sealed
   value being substituted for the current one, within the SAME `(sessionId, generation)`
   — not merely rely on "it decrypts" as proof of currency. This requires either (a) a
   monotonic position/counter field carried inside the (now-versioned, see INV-LSS-3)
   snapshot record and cross-checked against the session's own durable counter at restore
   time, rejecting a restore where the snapshot's own recorded position is behind the
   durably-committed counter, or (b) a storage shape that makes an old value physically
   unrecoverable (Agent S's rewrite-in-place recommendation, `02_EXISTING_SEALED_SECRET_PRIMITIVES.md`
   §6b) COMBINED with a guard against whole-file substitution (e.g., a monotonic sequence
   number in the file itself, checked against the last-known value held in a SEPARATE
   durable location that a single stale-file substitution cannot also roll back). This is
   the single highest-priority invariant in this document — see Attack 5b.
2. **INV-LSS-2 (Counters and crypto checkpoint never disagree about currency)**: the
   durable session-metadata counters (`sendCounter`/`receiveCounter`/`previousChainCounter`)
   and the durable sealed live-state snapshot for the same session MUST be updated as one
   atomic fact, or in an order such that a crash between them always leaves the counters
   NO FURTHER AHEAD than what the crypto checkpoint actually reflects — never the reverse.
   See Attack 11.
3. **INV-LSS-3 (Schema version discipline)**: `FedosDirectRatchetLiveStateSnapshotV1` MUST
   carry an explicit `schemaVersion` field before any future field is added to it, and the
   reader MUST reject (never silently ignore or silently accept as valid) a record whose
   `schemaVersion` it does not recognize — mirroring the discipline already established for
   `FedosSealedDirectRatchetSecretRecordV1` and `fedos_local_peer_device_announcement_identity.ts`'s
   own "never silently regenerate over a corrupt/unrecognized file" rule. See Attack 8.
4. **INV-LSS-4 (Profile isolation via the planner, not a hand-built path)**: the durable
   backend for this snapshot type MUST be wired through a dedicated leaf on
   `FedosLocalProfilePaths`/`planFedosLocalProfilePaths()`, never a separately-constructed
   path string, before it is ever pointed at a real profile root. See Attack 2.
5. **INV-LSS-5 (Binding tuple stays four-wide and Rust-enforced)**: the sealing context for
   every one of the four fixed-kind secrets (and skipped-message-key entries) MUST continue
   to bind `local_device_ref`, `remote_device_ref`, `conversation_id`, and `generation` as
   explicit parameters to `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`,
   enforced by AEAD authentication inside the Rust boundary — never weakened to a
   TypeScript-side string-equality check as a substitute. See Attacks 3/4/5a/9/10.
6. **INV-LSS-6 (Single-writer-per-profile)**: at most one process may hold a given
   profile's live-state snapshot file open for write at any time. Currently true by this
   codebase's single-process-per-profile architecture (no enforced lock exists) — MUST
   remain true, or be enforced explicitly, before any change that could allow concurrent
   multi-process access to the same profile root. See Attack 6.
7. **INV-LSS-7 (Fail-closed outcome stays distinguishable from cold-start)**: a
   restore-time cryptographic failure (tamper, wrong binding tuple, truncation) MUST
   continue to surface as an outcome distinct from "no prior session record exists" —
   never silently collapsed into a fresh-session code path. See Attack 1.

---

## 4. Negative-test matrix

| ID | Invariant | Test scenario (inputs) | Expected outcome |
|---|---|---|---|
| LSS-1 | INV-LSS-1 | Establish a real session (real WASM), send 3 messages (3 checkpoints, same generation), capture the snapshot NDJSON line after message 1. After message 3's checkpoint lands, APPEND the captured message-1 line back onto the live snapshot file (simulating a buggy backup/restore or malicious local write). Force `liveSessionCache` eviction, then call `sendMessage()`/`#receiveMessage()` again to trigger `#restoreLiveSession()`. | Today: restore SUCCEEDS using the stale (message-1) chain state (AEAD auth passes, since context doesn't encode position) — demonstrates Attack 5b is live and reachable. After INV-LSS-1 is implemented: restore MUST either reject the stale line or detect and refuse to use it in place of the durably-known-later counter state. |
| LSS-2 | INV-LSS-1 | Same setup as LSS-1, but instead of appending, REPLACE the entire snapshot file's content with the message-1-era captured content (simulating a whole-file/whole-profile backup restore). | Same expected pre/post-fix outcome as LSS-1 — proves the fix must survive whole-file substitution, not just single-line append (this is what distinguishes INV-LSS-1(a) from INV-LSS-1(b) alone). |
| LSS-3 | INV-LSS-2 | Real session, real `sendMessage()`. Instrument/stub `checkpointFedosDirectRatchetSecretsV1()` to throw (or simply never call it) for exactly one send, AFTER `stateRuntime.commitCounters()` has already been called and durably landed for that same send. Restart (fresh `FedosDirectRatchetOutboundIntegration` instance, same durable backends). Call `sendMessage()` again for the next logical message. | Today: the durable counters are ahead of the durable chain-key snapshot; the restored session embeds a wrong `message_number` in the next wire header and the peer's subsequent decrypt fails permanently for this generation. After INV-LSS-2 is implemented: either the crash is impossible to reach in a way that leaves this disagreement (atomic write), or restore detects the disagreement and forces `"crypto-unavailable"`/reset rather than producing a silently-desynced session. |
| LSS-4 | INV-LSS-5 | Construct a real `FedosDirectRatchetCryptographicSession` via `createAsSender()`, call `sealState(masterSeedAuthority, "device-B", "conv-1")`, then call `FedosDirectRatchetCryptographicSession.restore(masterSeedAuthority, "device-B-WRONG", "conv-1", sessionId, "device-A", generation, ...)` (wrong `remoteDeviceRef` at the TS wiring layer, not the Rust primitive directly). Repeat for wrong `conversationId` and wrong `generation`. | `restore()` returns `null` in all three cases — proves the WIRING (not just the underlying Rust primitive already tested at `lib.rs:14855-14898`) correctly propagates a binding mismatch to failure. This is new coverage; no existing test exercises `FedosDirectRatchetCryptographicSession.restore()` with a deliberately mismatched tuple. |
| LSS-5 | INV-LSS-3 | Hand-craft an NDJSON line for the snapshot file containing all four required fields (`sealedRootKey` etc.) PLUS one unrecognized extra field (e.g. `"futureField": "x"`), or with `schemaVersion: 2` once that field exists. Call `getSnapshot()`. | Once INV-LSS-3 lands: line is rejected (treated as unparseable/untrusted), never silently accepted with the extra field ignored. Today (baseline, pre-fix): documents the current permissive behavior for comparison. |
| LSS-6 | INV-LSS-4 | Call `planFedosLocalProfilePaths(rootA)` and `planFedosLocalProfilePaths(rootB)` once the live-state snapshot leaf exists. Assert `fedosLocalProfilePathsIsolated(pathsA, pathsB)` is `true` and that the new leaf's path differs between A and B and shares no subpath with any other leaf. | `true`; the new leaf participates in the existing isolation guarantee exactly like every sibling `*LogFile` leaf — proves it wasn't wired as a hand-built exception. |
| LSS-7 | INV-LSS-1/7 | Seal a snapshot, flip one hex character in `sealedSendingChainKey` only (leave `sealedRootKey`/`sealedLocalRatchetPrivateKey` untouched), call `restoreFedosDirectRatchetSealedStateV1()` then `FedosDirectRatchetCryptographicSession.restore()`. | `restore()` returns `null` for the WHOLE session (never a session with 3 good fields + 1 silently-defaulted/skipped field) — proves partial-tamper does not degrade to partial-trust. This exercises the wiring layer; the equivalent Rust-only case is already covered by `restore_direct_ratchet_secret_fails_closed_on_a_tampered_sealed_blob` (`lib.rs:14899-14915`), but not through the TS session-restore path specifically. |
| LSS-8 | INV-LSS-7 | Same as LSS-7, feed the `null` result from `#restoreLiveSession()` through the full `sendMessage()`/`#receiveMessage()` call and assert the returned outcome is exactly `"crypto-unavailable"`, and separately assert no NEW session gets silently created/persisted as a side effect of that call (`stateRuntime.getSessionMetadata(sessionId)` still shows the ORIGINAL, now-unrestorable record, not a fresh one). | `"crypto-unavailable"`; `getSessionMetadata()` unchanged; no new `sessionId` written to `sessionPersistence`. |
| LSS-9 | INV-LSS-6 | Two `FileFedosDirectRatchetLiveStateSnapshotPersistence` instances pointed at the SAME file path, in the SAME process (simulating what a future multi-instance bug would do), call `putSnapshot()` on both concurrently (interleaved via `Promise.all` around otherwise-synchronous calls, or two real processes if feasible). | Document/assert current behavior (both writes land, order is whichever `appendFileSync` call completes first — no corruption since each write is a single line, but "current" becomes racy) — this test exists to make INV-LSS-6's current-truth-by-architecture status explicit and regression-detectable if a future change removes the single-writer assumption without an explicit lock. |
| LSS-10 | INV-LSS-1 (regression baseline) | Cross-generation variant of LSS-1: after a session reset bumps generation from G to G+1 (new `sessionId`), attempt to feed the OLD generation-G snapshot's sealed blobs into a restore call using the NEW generation-G+1 context (mismatched generation parameter). | `restore()` returns `null` (AEAD failure, generation is bound) — proves 5a stays closed as a regression guard, distinct from 5b which is the actual gap. |

---

## 5. Summary for the record

Ten of eleven attacks in the task brief resolve to SAFE-BY-CONSTRUCTION, most of them
doubly so (an independent lookup-key structural barrier plus an independent AEAD
cryptographic barrier) — the four-parameter Rust-level binding
(`local_device_ref`/`remote_device_ref`/`conversation_id`/`generation`) this mechanism
already has is materially stronger than the task brief's own framing assumed, and the
existing fail-closed unit tests at the Rust primitive level (`lib.rs:14855-14954`)
genuinely do extend "for free" to the four fixed-kind secrets, confirmed by tracing the
call graph rather than inferring it from the shared-function-name alone. One genuine
GENUINELY-VULNERABLE finding stands: within a single generation, the sealing context does
not encode chain position, and the physical storage (append-forever, last-line-wins) lets
an old-but-validly-sealed chain-key value be reintroduced — passively (already flagged by
`02_EXISTING_SEALED_SECRET_PRIMITIVES.md` §6b as a file-exposure risk) or actively (this
document's own addition: replaying an old NDJSON line back onto the live file rolls the
RUNNING session back, retroactively defeating forward secrecy for every message sent after
that position, without requiring the attacker to ever obtain the Master Seed for the
passive-exposure case). A second, narrower correctness gap — not a security hole, but a
real availability bug — sits in the ordering between the durable counter write and the
durable crypto-state checkpoint on both send and receive paths; a crash strictly between
them leaves the two disagreeing about which is current, which the existing
`03_RESTART_FAILURE_MODEL.md` crash-window analysis does not split out as its own
sub-case. The single most important invariant for whoever implements the write-ordering
guard (Agent M's stated scope) is INV-LSS-1: a live-state snapshot restore must be able to
prove its own freshness against the durably-known session state, not merely prove it
decrypts — "it decrypts" is necessary but was never sufficient, and today it is treated as
sufficient.
