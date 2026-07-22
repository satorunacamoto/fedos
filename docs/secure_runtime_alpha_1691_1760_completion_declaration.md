# Secure Runtime Alpha 1691–1760 — Completion Declaration
## Conversation Archive Runtime Integration and Recovery Operations Arc

**Resumed, not restarted.** This session resumed uncommitted partial work
already present in `C:\wt\conversation-archive-runtime`
(`arc/conversation-archive-runtime-integration-recovery`, HEAD `8c48c95`
— identical to `master`'s own tip; no sibling Arc landed while this
worktree sat idle). The partial implementation was inspected, not
discarded: every file already present was read in full before any edit.

## 1. Partial-work reconciliation (produced before any edit, per this
Arc's own first-action requirement)

Inherited, complete, unmodified beyond a single type-narrowing fix:
- `src/conversation/archive/fs/fedos_conversation_archive_file_authority.ts`
  — exclusive-create via same-directory temp-file + `link()` (fails
  `EEXIST` on collision, never a racy pre-check), bounded read (checked
  via `stat` before any content byte is read), never overwrites, temp
  file always cleaned up. One real defect found and fixed: three call
  sites (`handle.write`/`.sync`/`.close`) failed `tsc --noEmit` under
  strict null checks because assigning an untyped (`any`, via this
  file's own necessary `node:fs` `@ts-expect-error`) return value does
  not narrow away `undefined` — fixed with three narrow, commented `!`
  non-null assertions of a value the immediately-preceding line already
  assigned.
- `src/conversation/archive/fs/fedos_conversation_archive_file_container.ts`
  — length-prefixed Manifest-JSON + ciphertext-string framing, two-stage
  schema-version detection distinguishing `"malformed"` from
  `"unsupported-version"`. No defect found.
- `src/conversation/archive/runtime/fedos_conversation_archive_runtime_assembly.ts`
  — thin wiring function. No defect found.
- `src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts`
  — all four Runtime operations (`exportConversationArchive`/
  `inspectConversationArchive`/`preflightRestore`/`restoreConversationArchive`),
  correctly wired against the real Alpha 1541–1610 Foundation's actual
  `export()`/`import()`/`restoreFedosConversationArchiveBundle()`/
  `detectFedosConversationArchiveDuplicates()` signatures (verified
  directly against Foundation source, not assumed). **One real defect
  found and fixed**, matching the Quality Gate's own named concern
  "partial restore falsely reported as complete": `restoreConversationArchive()`
  read `.failed`/`.conflict`/`.inserted` off each domain's restore
  tally but never checked `.invalid` — a Bundle whose content-hash
  integrity check passed but which contained individually-malformed
  child records (a real, reachable case: integrity binds ciphertext
  bytes to the Manifest, never each record's own domain-specific
  structural validity) would silently report `"restored"`/
  `"already-present"` despite some records never having been written.
  Fixed by adding ONE new, precisely-scoped outcome,
  `"partially-invalid"`, to this Arc's own closed
  `FedosConversationArchiveRestoreOutcome` vocabulary (this type exists
  entirely within this Arc's own new file — extending it is completing
  this Arc's own work, not touching the frozen Foundation), backed by a
  real, passing end-to-end test
  (`test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts`,
  "partially-invalid outcome" describe block) that constructs a
  cryptographically authentic, integrity-passing archive with one
  deep-invalid membership record and confirms every valid record is
  still restored while the invalid one is skipped and honestly
  reported.

Newly completed this session:
- `src/desktop/runtime/fedos_desktop_runtime.ts` — the diff stopped
  mid-wiring: `conversationArchiveRuntime()` was declared on the
  `FedosRunningDesktopRuntime` interface and
  `assembleFedosConversationArchiveRuntime` was imported, but no
  `FedosConversationArchiveRuntime` instance was ever constructed and
  the accessor was never implemented on the returned object. Completed:
  constructed exactly once per running Runtime (mirrors
  `privateTransportInstance`'s own identical construction-guard shape),
  gated by `config.archiveEnabled`, over the SAME
  `conversationPersistence`/`conversationEnvelopePersistence`/
  `conversationPayloadStorage` instances this Runtime already owns plus
  two newly-constructed Membership/Capability port instances over the
  SAME log paths the Conversation Runtime's own Alpha 923 assembly
  already uses, `isRuntimeRunning: () => !stopped` closing over the
  SAME `stopped` flag `boardRuntime()`/`privateTransport()` already
  gate on. The accessor mirrors `privateTransport()`'s own exact
  two-state fail-closed contract (`"not enabled"` /
  `"inaccessible after stop"`). No Archive-specific `stop()` step was
  needed — the Archive Runtime has no background timer/connection of
  its own; `!stopped` alone is sufficient.
- `src/desktop/runtime/fedos_desktop_runtime_config.ts` — already
  complete (`archiveEnabled`, `conversationArchiveMasterSeedAuthority`,
  `conversationArchiveBounds`, plus the synchronous fail-closed guard);
  untouched this session beyond what was already there.
- Four new test files (below), and two pre-existing tests
  (`secure_runtime_alpha_606_runtime_assembly.test.ts`,
  `secure_runtime_alpha_758_local_runtime_ownership.test.ts`) updated to
  include `conversationArchiveRuntime` in their own
  `Object.keys(runtime)` assertions — while there, a SECOND,
  independent pre-existing gap was found and fixed in the SAME two
  lines: `privateTransport` (added by Alpha 1471–1540, this worktree's
  own HEAD commit) had never been added to either assertion either, a
  fact only discoverable because this Arc already had to touch that
  exact line for its own reason.

## 2. Runtime API (as completed)

```
runtime.conversationArchiveRuntime(): FedosConversationArchiveRuntime
  .exportConversationArchive(request)   -> exported | already-exists | unauthorized |
                                            conversation-not-found | crypto-unavailable |
                                            storage-unavailable | too-large | write-failed | failed
  .inspectConversationArchive(path)     -> inspected | not-found | invalid | too-large | failed
  .preflightRestore(request)            -> previewed | not-found | invalid-archive | integrity-failed |
                                            identity-mismatch | unsupported-version | too-large | failed
  .restoreConversationArchive(request)  -> restored | already-present | conflicts-found |
                                            partially-invalid | invalid-archive | integrity-failed |
                                            identity-mismatch | unsupported-version |
                                            partial-recovery-required (never produced today, reserved) |
                                            persistence-failed | failed
```

No persistence port, raw Authority, key handle, or Host internal is
exposed by any operation — every field on every result is a manifest
(record counts + a content hash, never plaintext), a duplicate/restore
tally, or a closed-vocabulary outcome string.

## 3. File-boundary behavior (verified by real, passing tests over a
real temp directory, real `node:fs` — 16 tests,
`test/secure_runtime_alpha_1691_1760_archive_file_authority.test.ts`)

Exclusive create never overwrites (a pre-existing file's exact bytes
are preserved, verified byte-for-byte); a concurrent double
exclusive-create race resolves to exactly one `"written"` and one
`"already-exists"`, never a corrupted/interleaved file; every
`createArchiveExclusive` outcome (success, collision, or any other
failure) leaves zero leftover `.fedos-archive-tmp-*` files; a
too-large source is rejected via `stat` before any content byte is
read into memory; a missing parent directory is reported, never
silently created.

## 4. Export / Inspection / Preflight / Restore behavior (24 tests,
`test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts`)

Export: unauthorized without an active local Membership (checked BEFORE
any collection/encryption/file write); conversation-not-found;
crypto-unavailable when the Master Seed Authority cannot resolve a key;
already-exists never overwrites; too-large rejected before any file
write, from the collected bundle's own record count. Inspect: not-found
/ invalid (garbage, truncated, or a directory) / too-large, all
computed without ever attempting decryption. Preflight/Restore share
one staging pipeline (read -> decode -> schema-check -> decrypt ->
bounds-check, in that order, never writing anything) covering:
not-found, truncated/malformed bytes, a manifest-only-visible
schema-version mismatch, identity-mismatch (a receiver whose Master
Seed Authority cannot resolve the exact same conversation key — checked
BEFORE any persistence write, confirmed by asserting the target
Conversation record is absent afterward), a tampered cleartext
manifest (`contentHash` corrupted -> `integrity-failed`, never a silent
restore), a tampered ciphertext byte (fails closed, never partial
plaintext), and an oversized record count claimed by the CLEARTEXT
manifest rejected before decrypt is ever attempted (defense in depth,
the bound is checked twice — once from the manifest, once from the
decrypted bundle).

## 5. Direct Conversation round trip — verified; Group Conversation —
genuine, named blocker

**Direct**, verified end to end: seed a Direct Conversation directly
into persistence (see §7 below for why "directly" rather than via live
activation/send) -> export -> stop the sending Runtime -> a completely
independent, freshly-constructed receiving Runtime over empty ports ->
inspect -> preflight (duplicate report: everything `"new"`) -> restore
(`"restored"`) -> the exact original message plaintext bytes are
recovered byte-for-byte via the receiver's own
`payloadPersistence.getPayload()`, decoded back to the exact original
UTF-8 string. Duplicate restore: a second restore of the identical
archive reports `"already-present"`, with an exact per-domain
`{inserted:0, duplicate:1, ...}` tally — never a duplicate record
(confirmed: still exactly one envelope/payload afterward). Conflict:
a receiver holding a DIFFERENT pre-existing record at the same id
reports `"conflicts-found"` and the pre-existing record is left
untouched (never silently overwritten). Crash/restart recovery: a
receiver simulating "the Conversation+Membership were already durably
written by an interrupted prior restore attempt, Envelope/Payload were
never reached" converges cleanly on a fresh retry (Conversation/
Membership report `duplicate`, Envelope/Payload report `inserted`,
overall `"restored"`), and a second fresh retry after THAT reports
fully `"already-present"` — no dedicated recovery step needed, exactly
the Foundation's own Phase D design already claimed and this Arc now
proves with a real interrupted-then-resumed scenario, not merely an
assertion.

**Group Conversation — genuinely blocked, not attempted, not faked.**
This worktree's branch (`arc/conversation-archive-runtime-integration-recovery`,
based on `master` @ `8c48c95`) contains **zero** Group Conversation code
of any kind (`find src/conversation -iname "*group*"` returns nothing)
and **zero** Direct-messaging activation/send facade
(`FedosConversationRuntime` exposes no `sendMessage`/`readMessage`/
`activateDirectConversation` method on this branch at all — confirmed
by direct inspection, not assumed). Both live only on the separate,
still-unmerged `arc/nostr-private-direct-pairwise-fanout-delivery`/
`arc/private-group-pairwise-fanout-foundation` lineage. Unlike a prior
Arc's own task (which carried an explicit PRECONDITIONS section
authorizing exactly this kind of prerequisite merge), THIS Arc's own
task carries no such authorization, and the session's own explicit
instruction is "do not create another branch or worktree" / "never
touch unrelated layers." Merging that lineage into this worktree to
unlock Group testing would itself be exactly the kind of scope-broadening
this Arc is told not to do. This is reported here as the one genuine,
structural blocker per "if a task becomes impossible because of a
missing prerequisite, complete every implementable part and stop
precisely at the blocker" — every OTHER implementable part (export,
inspect, preflight, restore, duplicate detection, identity mismatch,
corruption, crash recovery, file safety, lifecycle wiring, for a Direct
Conversation) was completed and verified in full. The Archive Runtime's
own contract is provably agnostic to how a record reached persistence
(the Foundation's own Collector/Restore/Duplicate-Detection code never
distinguishes Direct from Group, or live-sent from directly-seeded) —
once the messaging/Group lineage is eventually merged into this
branch, this Arc's own Archive Runtime requires NO further change to
cover a live-activated Direct or Group vertical slice; only the TEST
seeding needs to switch from direct `put*` calls to a real
`conversationRuntime()` activation/send/read call, over the identical
Runtime API this Arc already ships.

## 6. Identity/conflict/corruption results

See §4/§5 above for the concrete assertions; every corruption/identity/
conflict case fails BEFORE any persistence write is attempted, verified
directly (not merely by outcome string) by asserting the target
Conversation record is absent from the receiving Runtime's own
persistence afterward, in every failing case tested.

## 7. Plaintext/secret guards

No raw key, seed, or passphrase field exists on any Runtime request/
result type (`conversationArchiveMasterSeedAuthority` is an opaque
Authority object, never bytes; every crypto operation happens behind
`FedosMasterSeedAuthority.resolveConversationKey()`/the existing
`encrypt`/`decrypt`/`exportCiphertext`/`importCiphertext` Runtime
Service functions, unmodified). Verified directly, not just by type
signature: the on-disk archive file's own raw bytes (read back as
`latin1` to catch any encoding) never contain the plaintext message
substring. The "directly seeded" Direct Conversation substitution used
throughout this Arc's own tests (§5) is itself a plaintext/secret guard
demonstration in miniature — the SAME plaintext bytes, once sealed
through the real (fake-crypto-tier, per the Foundation's own established
testing convention) encryption pipeline, are unrecoverable from the
file without the matching key.

## 8. Baseline/final verification (this exact worktree)

- `npm install` (fresh worktree, no prior `node_modules`) — 48 packages,
  `package.json`/`package-lock.json` byte-unchanged.
- `npm run typecheck` — clean except the one pre-existing,
  cross-Arc-documented failure
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`)
  present before this session touched anything.
- Focused Archive Foundation/Runtime/fs tests: 16 + 12 + 24 + 7 = 59 new
  tests across 4 new files, all passing; the 2 updated pre-existing
  tests, 6/6 and 6/6 passing.
- `npm test` (full suite), run at the end of this session: 927 files /
  12,237 tests — 737 passed files / 190 failed files, 12,001 passed
  tests / 236 failed tests. **Every failing file traced to the SAME
  two pre-existing, cross-Arc-documented categories every prior
  integration worktree in this repository has already hit**: (a) the
  `core.autocrlf=true` fresh-worktree CRLF-vs-LF artifact (confirmed
  again directly: 293 `\r` bytes in this worktree's own
  `packages/fedos-core-rust/Cargo.toml`, identical count to the OTHER
  integration worktree checked this same day), and (b) three review
  docs' own "git working tree is clean" guards, red only until this
  Arc's own single commit lands (`test/reviews/conversation_foundation_v1/boundary_invariants.test.ts`,
  `test/reviews/private_conversation_security/boundary_guards.test.ts`,
  `test/reviews/private_message_envelope_v1/specification_consistency.test.ts`).
  **Zero new failures beyond these two documented categories. Zero
  Archive-specific test failures.**
- `cargo` was NOT run — `packages/fedos-core-rust/` has zero diff this
  session (confirmed via `git status --short`), and this Arc's own
  instructions say not to run it without a Rust diff.

## 9. Dependencies, `p2p/`, `.tmp_gen/`

`package.json`/`package-lock.json`/`Cargo.toml` byte-unchanged
(confirmed via `git status --short`) — no new dependency. `p2p/` and
`.tmp_gen/` do not appear anywhere in this worktree's own `git status`
output (they are the MAIN worktree's own untracked directories, never
part of this integration branch) — untouched, confirmed.

## 10. Temporary artifact cleanup

`dist/` (gitignored, present from an earlier `npm install`/build in
this worktree, unrelated to this session's own commands) removed. No
`.archive`/temp test file was ever left inside the worktree itself —
every test's own temp directory is created under the OS temp directory
(`node:os` `tmpdir()`) and removed in its own `afterEach`, confirmed
empty by a final `find` sweep.

## 11. Recommended next Arc

**Alpha 1761–1830 (suggested numbering): Group Conversation Archive
Round Trip, once the messaging/Group lineage is merged** — this Arc's
own Archive Runtime API needs NO change; the next Arc's job is (a)
merge (or wait for `master` to already contain)
`arc/private-group-pairwise-fanout-foundation`'s own Group Container/
generations/canonical Group Message model, then (b) add ONE new
vertical-slice test exercising `exportConversationArchive()`/
`restoreConversationArchive()` over a REAL, live-activated Group
Conversation (three participants, one canonical Group Message, child
Direct Envelopes/payloads, a removal-history generation) — proving §5's
own claim that no Archive-layer code change is required, not merely
asserting it. The Phase A reconciliation report from the sibling Alpha
1611–1690 Arc's own §9 (two independent Outbox/Publisher stacks both
emitting the same proprietary Nostr kind) is unrelated to this Arc and
not revisited here.
