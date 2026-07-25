# Known Issues

Purpose: let a real, new external finding be told apart from a
re-discovery of something already known and disclosed. Organized by
status. Every item traces to a specific source in
[`04_evidence_index.md`](04_evidence_index.md).

## Already fixed (cite these to avoid re-reporting stale findings)

- **Same-peer multi-conversation NIP-17 misrouting** — a message between
  two parties already sharing more than one conversation could land in
  the wrong thread, silently, with no error/warning/visual distinction.
  Closed via an authenticated route-binding field inside the encrypted
  Rumor content (Direct Conversation Route Binding Arc 7401-7480).
- **Archive Envelope metadata retention parity (Direct conversations)** —
  a "deleted" message's ciphertext was correctly gated on Archive
  export/restore, but its existence/timestamp/sender/recipient metadata
  was not. Closed at Arc 7481-7560 by extending the existing fail-closed
  `retentionAuthority` gate to Envelope collection, mirroring the Payload
  pattern. **Re-verify this still holds for every conversation kind on
  current `master`** — the fix's own scope was Direct-conversation
  specific at the time it landed.
- **Delivery Observation write-time O(T) replay** — every `putObservation()`
  call replayed the entire historical log, even on writes. Fixed via a
  lazy `#ensureIndex()` pattern (Arc 7881-7960) — **for this one backend
  only**, see the still-open item below.
- **No Settings screen / feature UI at all** — the packaged Beta app
  previously exposed only profile create/unlock/lock; every other backend
  capability was reachable only through the internal `fedosAcceptance`
  test bridge. Resolved at Alpha 8041-8120 via a real `window.fedosApp`
  navigation shell (Conversations, Search, Archive, Devices, Safety
  Center, Settings; Identity Replacement + Signed Deletion nested in
  Safety Center).
- **Device Pairing UI** — backend/IPC were real and wired, but no renderer
  code called them. Resolved at Alpha 8201-8280.
- **Stale-renderer build defect** — a `tsconfig.json` exclude-list gap
  could silently ship a CommonJS-wrapped renderer bundle that throws
  `Uncaught ReferenceError: exports is not defined` and hangs on the
  loading screen. Fixed at Alpha 8201-8280 (same defect class Alpha
  4101-4180 already fixed once for older spike scripts, not propagated to
  this later file at the time).

## Confirmed still open (do not re-report as new without adding value)

- **`window.fedosAcceptance` remains fully exposed, alongside `window.fedosApp`**,
  into the same isolated-world renderer via `contextBridge`. Gated behind
  `FEDOS_ELECTRON_BETA_AUTOTEST=acceptance` at two independent enforcement
  points and confirmed absent from an ordinary launch — but this is a
  **structurally permanent design choice**, verified by this codebase's
  own test suite, not an oversight awaiting a fix. Re-confirmed present as
  of current `master` (both bridge implementation files still reference
  it). This is rated the highest-value Tier-1 attack surface across every
  security-oriented review in this bundle's evidence set.
- **No double-submit guard on several destructive/decision buttons** —
  Identity-Transition accept/reject/defer and Deletion-Request
  approve/reject/Device-revoke lack a `setBusy()`-equivalent guard, unlike
  `onChatSend()` which has one. Combined with the next item, this is a
  real, precisely-located race-condition shape, not yet live-tested.
- **Identity-transition and deletion-request decision actions take zero
  arguments** — they act on an implicit, server-side "currently selected"
  item set by a separate `open()` call. A real open-A/open-B/decide race
  shape exists; exploitability depends on Boundary-layer sequencing not
  yet independently verified live (source-reading only to date).
- **Revealed-plaintext cache lifecycle vs. `lock()` not independently
  traced** — the renderer keeps an already-revealed message's plaintext
  visible across its 2-second live-update poll; whether `lock()` reliably
  clears this has not been verified by any prior review.
- **`recovery-required` profile state** — still exists as a distinct
  onboarding state/screen in current `master` (confirmed present via
  direct grep this session). Prior reviews (pre-8041-8120) found this a
  dead end with no resolution path in the lifecycle state machine. Not
  independently re-verified this session beyond confirming the state
  constant and screen still exist — **re-check current transition-table
  reachability before citing either "still a dead end" or "now resolved"
  as fact.**
- **Append-only persistence O(T)-per-call, repo-wide** — only
  `AppendOnlyFedosDeliveryObservationPersistence` has an in-memory index;
  ~52 of 53 other append-only backends still do a full read+parse+rebuild
  on every read AND write, by explicit documented design ("no in-memory
  cache held between calls" is stated in the files themselves). Measured:
  a single full replay costs ~8.35ms/95.62ms/648.32ms at n=1k/10k/100k
  records. Compounds in Archive Collector/Restore, Group fanout send, and
  the Outbox/Scheduler steady-state tick.
- **Conversation Outbox/Scheduler steady-state tick remains O(T)-per-tick**
  even though the restart-replay path was separately fixed (ported the
  Board Outbox's Alpha 585/586 hydration pattern at Arc 7561-7640). Every
  real restart replays the entire historical log once at startup
  (bounded), but each subsequent tick still scales with total historical
  intent count, not pending count.
- **Device Relay Sync has zero production wiring** — a fully-built,
  fully-tested Outbound Coordinator/Inbound Handler exists in
  `src/device/relay_sync/` with zero references anywhere in production
  code; the real production construction site still defaults its
  `attemptFn` to always-fail.
- **A crash mid-append leaves a truncated final NDJSON line that bricks
  the affected subsystem's store** until manual repair — every
  append-only reader throws on any unparseable line, including a
  crash-truncated trailing write. Disclosed as an intentional fail-closed
  design trade-off (not a bug), but a real availability/data-loss risk
  under a hard crash.
- **Version rollback during a pilot is blocked by a real structural
  fact** — `Cargo.lock` is deliberately not committed
  (`docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md`)
  and no schema-migration code exists for on-disk profile/settings/archive
  formats. There is currently no tested path back to an older on-disk
  schema after a pilot participant has run a newer build. Operational
  mitigation: back up a profile directory before upgrading; treat
  "upgrade forward only" as the real constraint.
- **Group Messaging has no receive-side implementation at all** — worse
  than a missing UI: a group message lands on a recipient's device as an
  ordinary 1:1 message; only the sender's own device can render a group
  thread. This is why no Group UI was built (would misrepresent a feature
  that doesn't work for anyone but its creator) — this is a deliberate,
  disclosed omission, not an oversight.
- **An orphaned Sender-Key rotation prototype exists but was never
  adopted** — `rotateSenderKeyEpoch()` (Alpha 2121-2200 lineage,
  continued through a Rotation V1 review) is a real, tested prototype with
  a disclosed CSPRNG flaw (`Math.random()`, not a cryptographically secure
  RNG, for key material) and zero production callers even on its own
  unmerged branch. `master`'s own `src/` has zero occurrences of
  `rotateSenderKeyEpoch`/`SenderKeyAuthority`. Needs a human decision
  before any future arc revives or supersedes it.
- **Per-Device signing keys are checked only during Ratchet session
  reset, best-effort, not during initial session establishment.**
- **No `mlock`/`VirtualLock`-equivalent memory-pinning anywhere** —
  secrets in process memory may be paged to disk under memory pressure
  like any ordinary application.
- **Relay-visible metadata correlation is unmitigated** — see Threat
  Model §7; disclosed in `SECURITY.md` directly.

## Disputed / needs re-verification before citing as fact

- **Release-artifact code-signing status** — the sharpest single
  discrepancy found across this bundle's evidence set: a prior version of
  `README.md` (per the Public Docs Security-Claims Audit, citing line 732
  at the time) claimed artifacts were built "via `electron-builder` with
  real code-signing," directly contradicted by a separate internal
  document (`docs/reviews/fedos_beta_distribution_v1/05_code_signing_inventory.md`)
  stating every artifact "has been, and remains, completely unsigned"
  (one prior signed `.exe` used only an ad hoc local `signtool.exe`
  self-signing pass). **`SECURITY.md` as currently written on `master`
  states artifacts are unsigned unless independently verified otherwise
  for the specific artifact obtained** — this appears to already resolve
  the contradiction in the safer direction, but an auditor should
  independently confirm the actual signing status of whatever specific
  release artifact they are given, rather than trusting either document's
  prose.
- **Real-crypto test-suite claims depend on a build precondition** — the
  compiled Rust/WASM artifact (`pkg/`) is not committed to this
  repository; a fresh clone's test run will show the affected suites as
  skipped or fail-closed, never a silently-fabricated pass. This is now
  disclosed directly in `docs/desktop_beta_known_limitations.md` item 4 —
  treat any "zero FAIL" claim in a completion document as scoped to
  "security-correctness failures only, given the artifact was actually
  built for that run," not an unconditional guarantee.
- **The old "Stage 1-133" prototype documentation** describes a product
  with no real cryptography at all ("nothing that touches money, the
  network, or ciphertext is real anywhere in this codebase") — accurate
  for that historical prototype snapshot, inaccurate for the current
  build. `docs/desktop_beta_known_limitations.md` item 13 already flags
  this; an auditor who reads an old doc in isolation without checking its
  date/Stage range could be misled into either over- or under-estimating
  the current system.

## Intentional, disclosed, not defects

- Deletion is access-control, not erasure — no secure-overwrite, no SSD
  erasure, no cloud-backup deletion, no remote/peer-side deletion is
  performed or claimed.
- No return-acknowledgement for Archive Suppression facts — the
  strongest obtainable status is "reached a relay," never confirmation a
  specific Device received or applied it.
- A Device not yet paired when a suppression fact was broadcast will
  legitimately still restore pre-deletion content from an Archive taken
  before that point — disclosed on the restore screen itself.
- No independent external security audit has been performed on this
  codebase — every existing claim is internal, source/test-based, not a
  third-party finding.
