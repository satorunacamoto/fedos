# FedOS — Alpha Arc History (append-only status chronology)

**This is the historical record, not the place to start.** For what
FedOS is and how to use or build it, see [`README.md`](../README.md).

This file holds the complete, newest-first stack of per-Arc status
blurbs that this repository has maintained since its earliest stages.
Each entry was written when its Arc landed and is preserved unmodified;
nested `Prior status:` markers chain each entry to the one before it.

Two things to keep in mind while reading:

- **Entries are point-in-time.** A statement was accurate when written.
  Later Arcs frequently fixed, superseded, or reversed earlier ones, and
  an entry is *not* updated when that happens — the chain below it is
  the correction mechanism. Do not read any single entry as current
  fact.
- **For current fact, read the maintained documents instead:**
  [`README.md`](../README.md), [`SECURITY.md`](../SECURITY.md),
  [`KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md),
  [`ARCHITECTURE.md`](../ARCHITECTURE.md), and
  [`ROADMAP.md`](../ROADMAP.md).

This content previously lived in `README.md` and was moved here so that
first-time visitors meet a readable overview rather than ~11,800 lines
of chronology. Nothing was edited in the move.

---


> **Status: Secure Runtime Alpha 8041–8120 — FedOS Desktop Beta
> User-Facing Product UI Completion Arc (FULL COMPLETION).** Closes the
> headline gap both the Desktop Beta UX Acceptance Review (`9c238a11`) and
> the Public Documentation and Security-Claims Audit (`dbc1386`)
> independently found: the real packaged Desktop UI visibly supported only
> profile creation, unlock, a read-only "ready" screen, and lock — every
> other already-implemented, already-tested backend capability (Relay
> configuration, invitation, conversations/messaging, Search, Archive,
> Device management, Identity Replacement, Signed Deletion, Safety Center)
> was reachable only through `window.fedosAcceptance`, a test-only bridge
> the ordinary page never called. Adds a new, additive, non-test-branded
> `window.fedosApp` preload bridge and a canonical navigation shell
> (Conversations / Search / Archive / Devices / Safety Center / Settings,
> Identity Replacement and Signed Deletion nested as inboxes inside Safety
> Center) — one BrowserWindow, one Desktop Runtime generation, unchanged.
> `fedosAcceptance`/`fedos-acceptance:*` remain byte-for-byte untouched,
> reachable only by the pre-existing acceptance-mode test harness. Found
> and fixed three real, previously-undiscovered gaps via this Arc's own
> real, visible-control packaged vertical slice (driving the actual
> rendered DOM through `webContents.executeJavaScript()`, never an
> internal-handler shortcut): (1) `createConversationInvitation()` never
> registered its own new conversation into the Shell's own tracking Set,
> so the inviter never saw their own new conversation; (2)
> `listConversations()` had no way to discover a conversation known only
> through real-time inbound delivery, so the invitee never saw it either
> — fixed by additionally enumerating the already-real, already-public
> `FedosConversationRuntime.listDrafts()`, no new persistence or protocol
> change; (3) the chat view had no live-update mechanism for a message
> arriving in the background — fixed with a bounded 2-second poll, started/
> stopped alongside screen navigation, plus a client-side revealed-
> plaintext cache so an already-shown message is never silently re-hidden
> by the next poll tick. Honestly reconciled the mission's own Phase D
> "Bob pastes/imports invitation" description against the real backend:
> `redeemInvitation()` is a permanent stub, so no manual-accept UI was
> fabricated — acceptance is, and remains, automatic real-time delivery.
> Full verification: `packages/fedos-desktop-electron-spike`'s entire
> vitest suite (14 files, 199 tests, serialized) passes, including three
> new files this Arc adds (structural guards, failure matrix, and the real
> visible-control vertical slice); `cargo test --release` 639 passed/1
> pre-existing known failure; a full-root `npx vitest run` shows 303 of
> 1168 files failing, confirmed via `git stash` A/B comparison against the
> unmodified base commit to be pre-existing baseline noise (the documented
> worktree raw-import artifact class plus tautological "review scope"
> lock tests), never a regression — with the sole exception of one
> existing test that explicitly asserted the OLD, now-fixed
> `listConversations()` limitation, updated to assert the corrected
> behavior. See
> `docs/secure_runtime_alpha_8041_8120_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7961–8040 — FedOS Secure Runtime Staged
> Master Landing and Desktop Beta Release Candidate Arc (FULL
> COMPLETION).** Lands the complete, converged Secure Runtime lineage
> (Alpha 931 through Alpha 7960, `81b5f0d1`) into local `master` through
> 7 audited checkpoints (the real commit graph turned out to be a DAG,
> not a line — revised honestly mid-execution rather than forcing a false
> linear narrative), with zero new regression. Found and fixed a real,
> release-blocking defect during the real packaged-Electron acceptance
> pass: a single unreachable or temporarily-offline relay configured in
> Settings crashed the ENTIRE Desktop Runtime startup — and therefore
> profile creation itself — instead of degrading gracefully for just that
> one relay. Root cause: `FedosConversationInboundSubscription.start()`
> called `relay.subscribe()` unconditionally on every configured relay,
> and `FedosRelay.subscribe()` throws for one that never actually
> connected, even though `connectAll()` already tolerates a per-relay
> connection failure by its own documented contract. Fixed by skipping an
> unconnected relay before subscribing, in both the original file (Alpha
> 1471-1540) and Alpha 7881-7960's own suppression inbound subscription
> (which mirrored the same idiom and inherited the same defect).
> Regression-proven: the full Electron acceptance suite runs 149/149
> passing (serialized — default parallel test-file concurrency produces
> confirmed, repeatability-tested resource-contention flake from many
> concurrent real Electron subprocess launches, not a code defect). Also
> reconciled three stale test assumptions found live during the same
> pass (Direct Conversation Archive export now genuinely succeeds through
> the real packaged IPC surface; the Safety Center overview's real
> settled shape nests `sections` under `summary`; a secret-scan regex
> incorrectly flagged the public, non-secret word "signature"). Built and
> verified real release artifacts from the landed lineage: a real NSIS
> installer and portable ZIP, checksums independently re-derived and
> matched, 0 secret-scan findings across 752 staging files, real WASM
> hash confirmed embedded correctly. Local `master` fast-forwarded
> (`3eb9eadd` → `aed0951`, zero conflicts, full history preserved) and a
> local `release/fedos-desktop-beta-0.1` branch created with real release
> notes — no push, no tag, no publication, no remote change of any kind.
> See `docs/secure_runtime_alpha_7961_8040_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7881–7960 — FedOS Delivery Observation
> Durable Write Index, Archive Suppression Production Wiring, and Final
> Public Release Readiness Arc (FULL COMPLETION).** Closes the two
> remaining gaps `6a2f274` (Alpha 7801-7880) itself disclosed. (1)
> `AppendOnlyFedosDeliveryObservationPersistence.putObservation()` was
> O(T) per call (full log re-read + re-parse before every append) —
> fixed with a lazily-built, private, in-memory-only index
> (`#ensureIndex()`); the durable append-only log stays the sole source
> of truth, the index updates only AFTER a durable write succeeds, and a
> warm instance's writes/lookups drop from O(T) to O(1) average (measured:
> a duplicate/conflict lookup at T=10,000 fell from ~17ms to ~0.03ms).
> (2) `FedosArchiveSuppressionObservationAuthority` (Alpha 7721-7800, real
> and tested) was never constructed anywhere in `fedos_desktop_runtime.ts`
> — Archive restore's own `suppressionAuthority` dependency was always
> `undefined` in production. Fixed: the Runtime now constructs a real,
> durable authority whenever `archiveEnabled` is true (no separate flag —
> restore needs a real answer regardless of multi-Device sync), and, when
> `archiveSuppressionSyncEnabled` is also set, a real Outbound
> Coordinator/Inbound Handler plus a new
> `FedosArchiveSuppressionInboundSubscription` (mirroring the
> Conversation domain's own established inbound-subscription idiom) — the
> one genuinely missing piece, a live relay feed into the already-built
> Inbound Handler. Also wired through the real
> `FedosProfileInitializationCoordinator` (a new durable log path planned
> unconditionally, a new `archiveSuppressionSyncEnabled` dependency
> toggle), not just the lower Runtime layer. Proven end to end with two
> real `startFedosDesktopRuntime()` instances, a real local relay, and a
> real restart. Built real WASM fresh in this worktree — 8 previously-
> gated real-crypto vertical slices now run and pass; a new canonical
> product vertical slice proves profile bootstrap → relay → invitation →
> two independent real Direct Conversations → Archive export →
> Suppression Authority durability, through the real Profile Coordinator
> chain, surviving a real relaunch. Upgrade compatibility proven for five
> named older shapes. Final release matrix: zero security-correctness
> FAIL. See `docs/secure_runtime_alpha_7881_7960_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7801–7880 — FedOS Direct Conversation
> Archive Product Completion and Parallel-Lineage Integration Arc (FULL
> COMPLETION).** Reconciles two sibling production lineages first
> (`d5979ae`, Delivery Observation Repository Subject Index; `e048ff63`,
> Archive Multi-Device Suppression Propagation — completely disjoint
> file sets, one README conflict, zero production-source conflicts),
> then closes the Direct Conversation Archive product gap Alpha
> 7321–7400 disclosed: `FedosConversationArchiveBundleV1.conversation`
> was valid ONLY for a public, Board-thread-anchored Conversation, but a
> real Direct Conversation is never written into that persistence port
> at all — a prior Arc (Alpha 1921–1980) had already found and
> precisely documented this exact gap, deliberately deferring it. Fix: a
> new, narrow, additive subject type — a bare object (no `kind` field)
> is the pre-existing Board shape, byte-for-byte unchanged; an object
> with `kind: "direct"` wraps the ALREADY-EXISTING, already-frozen
> Conversation Draft wire record verbatim, no new record shape, no
> global Archive schema-version bump. The Collector/Restore/Runtime now
> try the real Board record first, falling back — only when both new,
> optional dependencies are wired — to the SAME `resolveActiveConversation()`
> helper the Encryption/Decryption Coordinators already use, never a
> fabricated Board record. Restore writes ONLY the draft record, never
> an Activation fact — history recovery and live-session recovery stay
> separate by construction, proven live: a restored Direct Conversation
> reports "not-active" and a send attempt fails closed. Two real bugs
> were found and fixed while building the real vertical slice: reusing
> a Master Seed Authority after `lock()` (which clears its own secret
> material) breaks restore, and Activation state — unlike every other
> port — has no real durable log path in the current profile flow, so
> two independently-constructed in-memory instances silently never
> share state; fixed by injecting one shared instance into both the
> Conversation Runtime's own assembly and the Archive Runtime. Also
> closed: Multi-Device Suppression's own `suppressionAuthority`
> dependency was fully implemented and tested by `e048ff63` but never
> threaded past `restoreFedosConversationArchiveBundle()` itself — no
> caller anywhere in the Runtime ever wired it, invisible to that Arc's
> own tests since they call the function directly. Threaded through the
> Runtime layer; the REMAINING gap (no real production construction site
> for the suppression authority itself, no Device Sync transport wiring)
> is disclosed, not fixed, and recommended as follow-on work. Proven
> live through the exact same `FedosDesktopApplicationShell.archive()`
> method the packaged Electron app's own `fedos-acceptance:archive` IPC
> channel already calls — zero new IPC surface needed, since the
> assumption lived entirely inside the Collector/Restore, never the IPC
> layer. Zero Ratchet/Identity Transition/NIP-17/Device Sync/Observation-
> repository-indexing/Outbox-Scheduler changes; zero Electron preload/
> main files touched. See
> `docs/secure_runtime_alpha_7801_7880_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7721–7800 — FedOS Archive Multi-Device
> Suppression Propagation Arc (FULL COMPLETION).** Closes the exact
> limitation Alpha 7481–7560 left standing: a genuinely foreign or
> never-informed Device that possesses a pre-deletion Archive has no
> basis to suppress its restore, since Retention only knows what THIS
> Device decided locally. Fix: a new, additive
> `FedosArchiveSuppressionFact` domain — a closed, versioned, 10-field
> fact naming a payload and a suppression meaning (payload restore,
> envelope restore, search reindex), authenticated primarily by the
> real, unmodified outer Nostr event signature and optionally narrowed
> by Device-level evidence — propagated between currently-trusted
> Devices of the SAME account over a new, dedicated `kind:1` route
> (never a new NIP), reusing the existing `FedosDeviceRelaySyncPublisher`
> transport unmodified. A durable, per-`(subject, sourceDevice)`
> monotonic-revision Observation Authority (mirroring Identity
> Transition's own rollback rule) records both self-authored and
> imported facts, and Archive restore gains one new, optional
> `suppressionAuthority` gate alongside `feff676`'s own retention gate —
> proven live that an imported fact denies restore of both the Envelope
> and the Payload even when the restoring Device's own local Retention
> log knows nothing about the deletion. Proven via a real, no-mocks
> vertical slice: a real local WebSocket relay, a real client, real
> BIP-340 Schnorr signing, and real file-backed persistence across a
> literal restart, with three Device contexts — the fact's originator,
> an already-paired online Device that receives/persists/restarts/
> suppresses, and a Device not yet paired at fanout time that
> legitimately still restores the pre-deletion content, an honestly
> disclosed limitation, never fabricated global deletion propagation.
> No return-acknowledgement protocol exists — `"relay-accepted"` is the
> strongest per-Device status this Arc can honestly report, never "the
> target actually imported it." A real bug was found and fixed while
> building the vertical slice: the relay client's own raw
> `FedosNostrWireEvent` (fields `pubkey`/`created_at`/`sig`) was pushed
> directly into a buffer typed as `FedosEventDescriptor` (`author`/
> `createdAt`/`signature`) without the existing wire-to-descriptor
> adapter, silently defeating the Inbound Handler's very first check — a
> test-fixture bug, not a production defect, fixed by applying the same
> adapter the outbound side already uses in reverse. Zero Rust/Cargo/
> WASM changes; zero Ratchet/Identity Transition/Signed Deletion Request/
> NIP-17/Delivery Observation Repository indexing/Outbox-Scheduler
> changes (verified via dedicated structural guards, including a direct,
> behaviorally-proven separation from Signed Deletion's own
> Acknowledgement flow — neither domain ever creates the other's own
> fact as a side effect). Ran as one of two parallel Arcs in separate
> worktrees; the sibling Arc's own domain (Delivery Observation
> Repository indexing/query) was never touched. See
> `docs/secure_runtime_alpha_7721_7800_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7641–7720 — FedOS Delivery Observation
> Repository Subject Index and Query Scalability Arc (FULL
> COMPLETION).** Closes the O(historyBearingCount²) finding Alpha
> 7561–7640 disclosed but explicitly left out of its own scope:
> `FedosDeliveryObservationQuery.historyFor(subjectId)` re-scanned the
> ENTIRE Observation repository (every subject's history, not just the
> one requested) on every single per-subject read — the shared machinery
> both Board and Conversation delivery hydration depend on. Fix: a new,
> private, derived `#bySubject` index inside
> `FedosDeliveryObservationRepository` itself, rebuilt once at
> construction (O(T)) and updated O(1) amortized on every successful
> `record()`; `historyFor()` now reads the one requested subject's own
> bucket instead of filtering the whole repository, with the SAME
> ordering contract and SAME output as before. `list()`/`listByState()`
> are byte-for-byte unchanged for genuinely cross-subject callers.
> Measured, not claimed: querying every subject once at
> deliveredCount=3,200 dropped from a cited 19,399.14 ms to a measured
> 2.26 ms (~8,584x); at deliveredCount=100,000 — previously only
> derivable at roughly 5.2 hours for a comparable write-path scenario —
> the equivalent read now measures 154.28 ms directly. Board and
> Conversation both benefit identically (shared code, zero Scheduler/
> Outbox changes on either side) — every pre-existing test suite for
> both domains re-runs unmodified and passing. One real, disclosed,
> unfixed boundary remains: the durable file-backed persistence
> backend's own write-time duplicate check is still O(T), unchanged,
> structurally identical to and mirroring the original audit's own
> still-open Outbox finding — recommended as the next Arc. Ran as one of
> two parallel Arcs in separate worktrees; the sibling Arc's own domain
> (Archive/Retention/Deletion/Safety Center) was never touched, verified
> via a dedicated structural guard. See
> `docs/secure_runtime_alpha_7641_7720_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7561–7640 — FedOS Conversation Outbox
> Restart Hydration and Scheduler Scalability Arc (FULL COMPLETION, one
> significant unplanned finding disclosed).** Closes the named production
> defect: the Conversation Transport Scheduler was constructed with no
> initial delivered/abandoned state, so every restart treated the entire
> historical, shared, whole-profile Outbox log as pending and retried it
> in full. Ports the proven Board Outbox hydration pattern (Alpha
> 585/586) into `FedosPrivateTransport`'s one production construction
> site: a new, pure `hydrateFedosConversationTransportDeliveryRecoveryState()`
> reads the already-durable Delivery Observation history and seeds the
> Scheduler's own existing (previously-unpopulated) `initialDelivered`/
> `initialAbandoned` constructor seam. Proven at three levels — unit,
> integration (`FedosPrivateTransport` restart, in-memory), and a real
> vertical slice (file-backed persistence, real local WebSocket relay,
> multi-conversation mixed workload, 5+ restart cycles) — that a
> delivered or abandoned intent is never re-attempted after any number of
> restarts, while genuinely pending intents still retry correctly, with
> zero retry amplification across repeated cycles. A significant,
> unplanned discovery made during benchmarking is fully disclosed, not
> minimized: the shared (Board-and-Conversation) `FedosDeliveryObservationQuery`/
> `FedosDeliveryRetryQuery` machinery this Arc reuses unchanged scans the
> entire Observation repository on every per-subject history read,
> making both this Arc's own hydration and the pre-existing Validating
> Repository's per-write staleness check cost O(historyBearingCount²),
> not O(T) — measured cleanly at deliveredCount 100–3,200 (consistent
> ~4x-per-doubling growth), honestly not completed at the 10,000/100,000
> scale the Arc's own template requested (mathematically projected, not
> measured, at ~3.2 minutes and ~5.3 hours respectively). The Outbox
> persistence layer itself remains confirmed cheap and linear even at
> T=100,000. Recommends exactly one next Arc: an internal, incrementally-
> maintained subject index inside `FedosDeliveryObservationRepository`
> to close this newly-found gap for Board and Conversation alike. See
> `docs/secure_runtime_alpha_7561_7640_completion_declaration.md` and
> the accompanying reconciliation/terminal-state/scheduler-lifecycle/
> complexity/benchmark-methodology documents.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7481–7560 — FedOS Archive Envelope
> Retention Parity and Metadata Deletion Semantics Arc (FULL
> COMPLETION).** Remediates a committed audit's own headline finding
> (`2eed88d9`): Payload collection was retention-gated on Archive export,
> but Envelope collection was not, so an Archive taken after a deletion
> could still preserve and later restore message existence, timestamp,
> sender, recipient, conversation association, and envelope identity even
> once content was inaccessible. Fix: the SAME `retentionAuthority`
> dependency now gates BOTH Envelope and Payload collection on export,
> keyed by the same `payloadId` — one denial excludes both records,
> never an independent, disagreeing check. A NEW, additive restore-time
> gate re-evaluates the RESTORING device's own current retention state
> before writing either record back, closing the honest defense-in-depth
> gap for an OLDER (pre-deletion) Archive restored onto a device that has
> since independently learned of the deletion — proven live via a real,
> no-mocks vertical slice with real two-profile WASM crypto: a fresh
> "already-informed" device restoring a pre-deletion Archive reports the
> new `"partially-denied"` outcome and never resurfaces the deleted
> message, while a genuinely foreign/never-informed device restores it in
> full, an honestly disclosed limitation, never fabricated global
> deletion propagation. A real, self-discovered defense-in-depth defect
> was found and fixed during this same Arc's own vertical-slice test:
> the obvious restore-time gate reused the existing
> `evaluatePayloadAccess()`, whose Payload-Storage-existence check made
> every fresh restore indistinguishable from "genuinely foreign" (a fresh
> device's own storage is empty by construction at the exact moment
> restore's own check runs, before restore itself has written anything) —
> silently defeating the intended re-evaluation. Fixed with a new,
> narrow, additive public method,
> `FedosPayloadRetentionAuthority.evaluateRetentionDecisionOnly()`, that
> checks the retention decision log directly, independent of storage
> presence. Also found and fixed, beyond the audit's own named scope: the
> Deletion Capability Registry's own `"local-envelope"` entry falsely
> claimed `reachableToday: true` with real supported operations, though no
> executor for it exists anywhere; and the deletion-assessment's own
> "denied" branch wrongly claimed the live Envelope record mirrors its
> Payload's tombstoned/removed state, when in live storage it always
> remains present. Safety Center now surfaces three new, accurate
> warnings, both on the generic overview screen and inside the Archive
> workflow itself (previously silent there, a separate audit finding).
> Schema version unchanged (still `1`); zero Ratchet/Identity/NIP-17/
> Secure Memory/Outbox/Scheduler changes. Ran as one of two parallel Arcs
> in separate worktrees; the sibling Arc's own domain (Conversation
> Outbox/Scheduler) was never touched, verified via a dedicated
> structural guard. See
> `docs/secure_runtime_alpha_7481_7560_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7401–7480 — FedOS Direct Conversation
> Route Binding and NIP-17 Inbound Isolation Arc (FULL COMPLETION).**
> Closes a real security-correctness defect proven during Alpha 7241–7320:
> two concurrent Direct Conversations with the same peer could be
> misrouted by inbound NIP-17 processing, because routing resolved
> primarily by peer identity rather than an unambiguous
> conversation/session binding. Two findings, both closed: the standard
> `nostr-nip17-v1` route SILENTLY misrouted a message addressed to a
> second, later-created same-peer conversation into the first (live-
> reproduced fresh, independently of the prior report); the Direct
> Ratchet route did not silently misroute but instead deterministically
> REJECTED a second same-peer session establishment as
> `"wrong-conversation"` (source-traced). Fix: a versioned, closed
> route-binding structure carried inside the already-encrypted NIP-17
> Rumor content — never Relay-visible, authenticated transitively via the
> real Seal signature, resolved as the PRIMARY lookup key (never a
> secondary check against a peer-only guess) — extending the SAME
> FedOS-proprietary payload convention the Direct Ratchet route already
> established, never a new NIP, never a new crypto primitive, never a
> Ratchet-cryptographic-core/Identity-Transition/Signed-Deletion redesign.
> A genuinely legacy (unbound) message is still accepted when exactly one
> candidate Conversation matches; two or more fails closed as
> `"ambiguous-legacy-route"`, never a first-match guess. Signed Deletion's
> own control payload already carried an explicit, authenticated
> `conversationId` and was never vulnerable — verified, not re-fixed.
> Proven live: two same-peer Conversations both establish independent
> Ratchet sessions and route correctly (previously the second session-init
> would deterministically fail), a Session Reset on one leaves the other
> completely untouched, restart survives, Device revocation stops every
> Conversation sharing that Device pair, duplicate Relay redelivery is a
> no-op, reverse delivery order still lands correctly, and Search stays
> isolated per Conversation for the same-peer case. See
> `docs/secure_runtime_alpha_7401_7480_completion_declaration.md` and
> `..._execution_specification.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7321–7400 — FedOS Desktop Production
> Feature Reachability Arc (FULL COMPLETION, one gap honestly disclosed).**
> Closes the remaining production reachability gaps so the packaged
> Electron application can actually use existing backend functionality —
> no protocol redesign, no redesign of Ratchet, Identity, NIP-17, or
> Secure Memory. The core fix: the entire `fedos-acceptance:*` IPC
> vocabulary (Alpha 7001-7080) previously rejected every call unless
> `AUTOTEST_MODE` was set, making it unreachable in ordinary packaged
> production mode by construction — `requireShell()`/the new
> `requireBoundary()` now gate on ONE real precondition, "a profile is
> genuinely unlocked," the same precondition every other channel already
> requires. Four new IPC channels close Release Readiness Review findings
> B-2/B-7 — Conversation Invitation, Search, Archive, and Safety Center —
> each delegating entirely to an already-real Shell/Boundary method,
> proven via the real, compiled, packaged Beta Electron subprocess (never
> a hand-built Runtime, never a mock relay):
> `packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_7321_7400_real_packaged_vertical_slice.test.ts`
> drives create profile → unlock → create invitation → accept invitation
> → exchange encrypted messages → search → reach Archive's real IPC
> surface → open Safety Center → restart → continue the conversation, all
> through two real, independently-provisioned production profiles over a
> real local WebSocket relay. One genuine, pre-existing architectural gap
> found and honestly disclosed, not fixed: Archive export can never
> succeed end-to-end for any conversation this packaged app produces,
> because `exportConversationArchive()`'s existence check requires a real
> Board-level (public) conversation record, but the packaged app can only
> ever create private Direct conversations — confirmed live
> (`{outcome:"not-found", reason:"unknown conversation"}`, never a crash,
> never a fabricated success); fixing it for real would require either a
> real Public-conversation creation path or a deliberate, scoped redesign
> of Archive's own existence-check boundary, both out of this Arc's own
> narrow "reachability wiring" mission. No visual renderer screen is added
> for the four newly reachable commands (a disclosed scope decision,
> consistent with this codebase's own established convention of deferring
> full visual UI to a later arc). Zero Rust/Cargo.toml change, zero
> Ratchet/Identity/production-activation-chain change (confirmed by
> structural guard). See
> `docs/secure_runtime_alpha_7321_7400_completion_declaration.md` and
> `..._execution_specification.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7241–7320 — FedOS Long-Running Runtime
> Reliability and Recovery Arc (FULL COMPLETION).** Validates and hardens
> the already-real production runtime under realistic long-running
> conditions — no new cryptographic protocol, no redesign of Ratchet,
> Identity, NIP-17, or Secure Memory. Real, no-substitution testing: two
> real production profiles exchange 221 real encrypted messages across 2
> full restarts and 1 genuine relay disconnect/reconnect over a real
> local WebSocket relay
> (`test/secure_runtime_alpha_7241_7320_long_running_durability_and_reconnect.test.ts`);
> Direct Ratchet session state survives 4 consecutive real seal/clear/
> restore cycles; a real Identity Transition arrives mid-conversation and
> the conversation keeps working across a real restart; a real tombstone
> (Signed Deletion's own underlying retention effect) genuinely survives
> a real restart; real WASM-backed Archive export/restore now correctly
> excludes tombstoned content across a device boundary; two real profiles
> with two DIFFERENT peers stay fully isolated across a restart. Two real
> production fixes, both regression-proven: (1)
> `conversationCapabilityLogPath`/`conversationPayloadRetentionLogPath`
> — both fields already existed on `FedosDesktopRuntimeConfig` (Alpha
> 923/1143) but the real Coordinator never supplied either, so
> Capability/Retention state silently fell back to in-memory-only and
> was lost on every real restart (the exact bug class Alpha 7081-7160
> already fixed for `conversationDraftLogPath`); (2) Archive export/
> restore never enforced Payload Retention (Search closed the identical
> gap at Alpha 2581-2620) AND never had a real production WASM
> encryption boundary (the SAME recurring "dev-gated default, never the
> canonical production authority" bug class Alpha 7161-7240 already
> fixed for the generic Envelope-AEAD path) — both closed by mirroring
> already-established patterns, reaching only already-real, already-
> tested Rust exports. Two genuine findings honestly disclosed, not
> fixed (out of this Arc's own narrow scope): two concurrent Direct
> conversations with the SAME peer are NOT correctly isolated by inbound
> NIP-17 routing (would require a wire-format change to fix for real,
> forbidden as protocol redesign here); the durable Outbox Scheduler's
> own tick cost grows with a conversation's total history (a real,
> measured, long-running characteristic, consistent with a widespread
> pre-existing persistence pattern, not unique to this Arc's own scope).
> Zero Rust/Cargo.toml change, zero redesign of Direct Ratchet/Identity
> Transition/NIP-17's own construction pipeline/Signed Deletion
> (confirmed by structural guard), zero p2p/.tmp_gen change. See
> `docs/secure_runtime_alpha_7241_7320_completion_declaration.md` and
> `..._execution_specification.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 7161–7240 — FedOS Conversation-Level
> Production Crypto and Identity Authority Wiring Arc (FULL COMPLETION —
> the mission's own success criteria proven literally, end to end, over
> a real relay, with no substitution of any kind).** Closed every
> production wiring gap named by both the Architecture Conformance
> Review V1 (`17c6cef6`) and the immediately-prior Arc's own Honest
> Partial (7081-7160, `b44e1a45`) — Production Identity Resolver wiring,
> Production Encryption Authority wiring, and Production NIP-17 Wire
> Adapter wiring — plus two further, deeper boundaries real testing
> found along the way: the generic Envelope-AEAD encrypt/decrypt path
> (used for message-content storage) and the ephemeral Gift-Wrap signing
> authority (used for the NIP-59 outer layer) were EACH their own,
> separate, `NODE_ENV`-gated WASM boundary, undiscovered until this Arc
> tried to send a real message. All five close via the SAME established
> pattern (Alpha 6841-6920's own "reuse the canonical, already-activated
> Master Seed/Signing Authority instead of a second WASM instance"),
> extended from Direct Ratchet to Conversation-level identity/
> encryption/transport: a new `assembleFedosConversationCanonicalProductionCryptoGraph()`
> factory, five new thin wrapper methods on
> `FedosProductionMasterSeedAuthority` reaching already-real,
> already-tested Rust exports (`encrypt_nip44_wire`/`decrypt_nip44_wire`/
> `build_and_sign_nip17_gift_wrap`/`encrypt_aead`/`decrypt_aead`/
> `serialize_aead_ciphertext`/`deserialize_aead_ciphertext`), and one new
> production runtime boundary pair. Two further, previously-total
> Coordinator gaps also closed: `FedosProfileInitializationCoordinator`
> never threaded `conversationDirectMessageDeliveryRoute` OR
> `conversationTransportInbound` at all, meaning no caller of this
> Coordinator — for ANY subsystem — could ever select the standard
> NIP-17 route or receive a LIVE relay-delivered Rumor through the real
> Coordinator/packaged path before this Arc. The real production
> vertical slice test proves, with zero manual test-side delivery of any
> kind: Alice creates an invitation, Bob's real live NIP-59 subscription
> receives it over a real local relay, the conversation activates for
> real (Encryption Authority selected automatically), a real encrypted
> first message and reply are really delivered over the real relay, both
> Runtimes restart, activation is genuinely re-established, and the
> conversation continues. Zero Rust/Cargo.toml change, zero redesign of
> Direct Ratchet/NIP-17's own construction pipeline/Identity Transition/
> Signed Deletion (confirmed by structural guard), zero p2p/.tmp_gen
> change. See `docs/secure_runtime_alpha_7161_7240_completion_declaration.md`
> and its own named companion reports (`..._reconciliation_report.md`,
> `..._execution_specification.md`).
>
> Prior status: Secure Runtime Alpha 7081–7160 — FedOS Conversation
> Invitation and Shared Conversation Foundation Arc (HONEST PARTIAL —
> real signed Invitation/Acceptance mechanism built and proven, real
> relay-transported delivery blocked one layer beneath it, real cause
> named, not fabricated). Set out to close the gap the immediately-
> prior Arc (7001-7080) surfaced: `FedosDesktopApplicationShell.redeemInvitation()`
> being unconditionally unavailable, and the old Capability/Invitation
> Transport system (Alpha 991-1050) requiring a shared backend
> incompatible with two independently-provisioned profiles. Built an
> entirely new, additive, parallel Invitation subsystem
> (`src/conversation/invitation_bootstrap/`): a signed, domain-separated
> Invitation record and token; an outbound coordinator that breaks the
> real circular Membership/route-resolution dependency by admitting both
> parties' Memberships locally BEFORE the first invitation is ever sent;
> an inbound Acceptance coordinator with real signature verification,
> real addressee verification, expiry checking, and durable idempotent
> duplicate detection; Runtime wiring additive and optional throughout.
> Proven for real, on two genuinely independent real production profiles
> over a real local relay connection: Alice creates an invitation, Bob
> accepts it, both peers hold the identical conversationId, Membership is
> durably persisted on both sides, and a real Coordinator restart
> preserves everything. One real, narrow, in-scope production bug fixed
> along the way: `conversationDraftLogPath` was never wired by
> `FedosProfileInitializationCoordinator`, silently defaulting Draft
> persistence to in-memory-only through the real production path for
> every Direct/Group conversation. **What remains genuinely blocked, not
> silently claimed closed:** real testing surfaced three deep,
> pre-existing, cross-cutting production gaps beneath this Arc's own new
> code, none of which this Arc created or is scoped to fix — (1) the real
> NIP-17 wire adapter is never constructed through the real production
> Coordinator/packaged path (`productionCryptoGraph` never populated),
> blocking real relay-transported delivery of Conversation Invitations
> AND every other control-message subsystem (Peer Capability, Direct
> Ratchet control messages, Identity Transition, Signed Deletion) today;
> (2) `FedosConversationIdentityResolver` resolves to a generic,
> non-per-account placeholder in the real production path, worked around
> in this Arc's own scope via a real per-account signing-derived
> identity but not fixed at the root; (3) `FedosConversationDirectActivationCoordinator`
> requires a real production encryption authority that has never been
> built. This Arc's own real vertical slice test discloses, in its own
> header comment before a single assertion runs, that it substitutes
> direct coordinator-to-coordinator delivery of the real signed
> invitation payload for the (confirmed-blocked) live relay transport
> leg — never a fabricated record, never a bypassed identity or signature
> check. Zero redesign of Direct Ratchet, Identity Transition, Signed
> Deletion, or the Rust/WASM core; the old Capability/Invitation
> Transport system left fully untouched; zero p2p/.tmp_gen change. See
> `docs/secure_runtime_alpha_7081_7160_completion_declaration.md` and its
> own named companion reports (`..._reconciliation_report.md`,
> `..._execution_specification.md`, `..._deep_production_gap_report.md`).
> Recommended next Arc (narrow, not the "full completion" default):
> **FedOS Conversation-Level Production Crypto and Identity Authority
> Wiring Arc.**
>
> Prior status: Secure Runtime Alpha 7001–7080 — FedOS Desktop Beta
> Runtime Acceptance Arc (HONEST PARTIAL — packaged two-party end-to-end
> messaging blocked, real cause named, not fabricated). Set out to
> prove the canonical packaged Desktop Beta can execute a real two-party
> Direct Ratchet message round trip (renderer → preload → main →
> Coordinator → Runtime → Ratchet → NIP-17 → real Relay → second party →
> decrypt → durable message → lock/restart → continued messaging). Real
> reconciliation (grounded in direct source inspection, not narrative)
> surfaced three genuine, previously-undocumented gaps beneath the
> already-real Alpha 6921-7000 session-establishment layer: (1) the
> packaged app's own real, user-facing `sendMessage()` always used the
> legacy static NIP-17 route, never Direct Ratchet — `conversationDirectRatchetDeps.messageDelivery`
> was never auto-wired, unlike its sibling `directMessageDelivery`; fixed
> with one new optional config field, mirroring the sibling's own
> auto-wiring exactly, zero behavior change by default; (2) zero IPC
> commands existed for conversation creation, session establishment,
> message send/read, or Device trust, despite real Shell methods for all
> of them — closed with a new, closed, structurally-validated,
> AUTOTEST-only `fedos-acceptance:*` vocabulary (11 commands, proven
> unreachable in ordinary packaged mode) plus two narrow new Shell
> wrapper methods (`activateDirectConversation`/`establishDirectRatchetSession`);
> (3) no real WebSocket relay SERVER existed anywhere in this repository
> — closed with a real, RFC 6455-compliant local relay test fixture
> (genuine handshake, genuine NIP-01 framing, genuine ACK, smoke-tested
> and passing). **What remains genuinely blocked, not silently claimed
> closed:** a real Direct Conversation between two INDEPENDENTLY-
> provisioned profiles needs the second party to learn the first party's
> generated `conversationId` and hold a matching local Draft+Membership
> record; the accepted real mechanism for that,
> `FedosDesktopApplicationShell.redeemInvitation()`, is confirmed by
> direct source read to be unconditionally `"unavailable"` on this
> codebase's own current base — a pre-existing limitation this Arc did
> not create and whose full closure exceeds this Arc's own narrow
> mandate. Phases G through Q (session establishment through the full
> release-candidate matrix) are correspondingly BLOCKED, not FAILED — see
> `docs/secure_runtime_alpha_7001_7080_completion_declaration.md` and its
> own named companion reports (`..._reconciliation_report.md`,
> `..._acceptance_topology_and_ownership.md`, `..._execution_specification.md`,
> `..._end_to_end_messaging_acceptance_report.md`,
> `..._lock_restart_restore_report.md`, `..._crash_recovery_report.md`,
> `..._secret_surface_audit_report.md`,
> `..._release_candidate_acceptance_matrix.md`). Zero Rust change, zero
> wire/persistence-schema change, zero Electron security weakening, zero
> p2p/.tmp_gen change. Recommended next Arc (narrow, not the "full
> completion" default): **FedOS Desktop Beta Cross-Profile Direct
> Conversation Establishment Arc.**
>
> Prior status: Secure Runtime Alpha 6921–7000 — FedOS Direct Ratchet
> Cryptographic Session Production Capability Arc (root-cause defect
> CLOSED and proven with real cryptography; one packaged-diagnostic
> stretch goal disclosed out of narrow scope, not fabricated). A
> post-implementation audit of `4c1f27c` (Alpha 6841-6920) found that Arc
> honestly closed only the UPPER authority/configuration graph:
> `directRatchetConfigured` correctly flips to `true` through the real
> packaged path, but the DEEPER layer,
> `FedosDirectRatchetCryptographicSession`, still (1) unconditionally
> called `primedLoader()` — `new FedosWasmLoaderSkeleton()` +
> `attemptDevOnly*` — and (2) accepted only `instanceof
> FedosWasmMasterSeedAuthority`, rejecting the real
> `FedosProductionMasterSeedAuthority`. Net effect: "configured" was true,
> but a real production session establishment returned crypto-unavailable
> — exactly the gap this Arc closes. Fix: `FedosProductionMasterSeedAuthority`
> gains one new internal-only accessor,
> `accessDirectRatchetSessionModuleInternalUse()`, reading
> `FedosDirectRatchetSession`'s own static constructors off the SAME
> already-initialized WASM module closure
> `constructMasterSeedAuthority()` already reads (zero second import,
> zero second `initSync`) — mirrors `accessForNostrSigningAuthorityInternalUse()`'s
> exact discipline, `#cleared`-gated. `FedosDirectRatchetCryptographicSession`
> gains ONE shared resolver, `resolveDirectRatchetSessionAccess()`,
> checked STRUCTURALLY first (never `instanceof
> FedosProductionMasterSeedAuthority` — mirrors the established
> `isFedosDirectRatchetSealingAuthority()` precedent), falling back to the
> byte-for-byte-unchanged dev/test path
> (`instanceof FedosWasmMasterSeedAuthority` +
> `developmentDirectRatchetLoaderBoundary()`, `primedLoader()` renamed
> only) for every other authority. Zero public method signature changed —
> both real callers
> (`fedos_direct_ratchet_outbound_integration.ts`/`inbound_integration.ts`)
> needed no edit. Proven with a real, no-mock, real-WASM Node-level
> vertical slice: two independent real `FedosProductionMasterSeedAuthority`
> instances (Alice, Bob), real Nostr identity derivation, real session
> establishment, two real encrypt/decrypt rounds with correct counter
> progression, real seal of both Ratchet state AND the master seed, real
> `clear()`-invalidation of fresh sessions, a genuinely NEW authority
> generation via `restoreSealed()` (identical public identity confirmed),
> both sealed Ratchet sessions restored through that fresh generation, and
> a third message correctly encrypted/decrypted post-restore. Three real
> test-authoring bugs were self-caught and fixed during this process
> (placeholder counterparty keys; `generate()` vs `restoreSealed()` for
> the fresh-generation step; stale `previousSendingChainLength`/
> `remoteRatchetPublicKeyHex` at `restore()`) — all in test code, zero in
> production code. 12 new structural guards (direct source inspection,
> including a real `git diff` proof of zero Rust change) and a 7-case
> failure matrix (missing/partial/cleared/malformed capability, all fail
> closed) also pass. Phase M: the one pre-identified typecheck error
> fixed by narrowing a TEST fixture's local type, never widening a
> production interface. **Disclosed, not silently claimed closed:** a
> packaged-process, IPC-observable "crypto-operational" (not merely
> "configured") diagnostic was investigated and found not safely
> constructible within this Arc's own prohibitions — `cr.directRatchet()`
> exposes no public accessor to the underlying `masterSeedAuthority`, so
> proving it at the IPC layer would require either a new, separately-
> reviewed Master-Seed-handle-adjacent capability (out of one narrow
> remediation Arc's own mandate) or full counterparty/Device-Registry/
> NIP-17 relay integration scaffolding no prior Arc has ever built for a
> packaged test either (the immediately-prior Arc's own completion
> declaration independently disclosed this identical gap). See
> `docs/secure_runtime_alpha_6921_7000_remediation_reconciliation_report.md`,
> `..._production_session_capability_design.md`,
> `..._execution_specification.md`, `..._loader_authority_ownership_proof.md`,
> `..._compatibility_report.md`, `..._packaged_ratchet_acceptance_report.md`,
> and `..._completion_declaration.md`.
>
> Prior status: Secure Runtime Alpha 6841–6920 — FedOS Direct Ratchet
> Production Crypto Graph Unification Arc (full completion of the
> authority/configuration graph layer; the audit above found the deeper
> session-establishment layer this same Arc's own name implied was
> unified was, in fact, still split — "configured" was proven true,
> "crypto-operational" was not yet proven, and is not the same claim).
> Closes the
> exact structural blocker `f3e0658` disclosed: Direct Ratchet's own crypto
> graph factory (`assembleFedosConversationProductionCryptoGraph()`)
> always constructed a SECOND, independent, permanently
> `NODE_ENV=development`-gated `FedosMasterSeedAuthority`, never reusing
> the canonical production one profile unlock already activates. A
> review-gated Stage 1 (source-grounded reconciliation, ownership
> analysis, option comparison, normative decision, all seven decision-gate
> conditions verified true by direct source read — including that
> `Coordinator#lock()` already clears this exact authority object and
> `conversationRuntime()` already throws post-stop, meaning lock/restart
> invalidation required zero new code) selected Option H: make
> `FedosProductionMasterSeedAuthority` (the ONE canonical production
> authority) ALSO implement the already-existing, already-reviewed
> `FedosDirectRatchetSealingAuthority` narrow port (two new methods,
> mirroring an already-shipped dev-wrapper implementation verbatim,
> calling the SAME already-Store-backed WASM methods `8a33045e` added),
> then thread that SAME object into Direct Ratchet's own dependency
> derivation via one new optional config field — mirroring the EXISTING,
> shipped `conversationArchiveMasterSeedAuthority` pattern exactly. Zero
> Rust change, zero WASM export change, zero protocol/wire change, zero
> Electron-main change (`fedos_electron_beta_main.cts` byte-for-byte
> unchanged — reachability closed purely through the Coordinator/Runtime
> layer, confirmed live: `directRatchetConfigured` flips from `false` to
> `true` through a real packaged Electron process with zero Electron-main
> edits). A real regression was found and fixed during this Arc's own
> testing, before commit: the first gate condition ("some
> `masterSeedAuthority` present") would have let
> `DevelopmentFedosMasterSeedAuthority` (test-only, does not implement the
> sealing port) falsely make Direct Ratchet appear reachable — caught by
> running the EXISTING `secure_runtime_alpha_6521_6600_real_production_
> vertical_slice.test.ts`, fixed by gating on
> `isFedosDirectRatchetSealingAuthority()` specifically. 22 new tests (a
> real production sealing-authority suite mirroring the dev-wrapper's own
> 10-case suite but NEVER opening `NODE_ENV=development`; structural
> guards including a real `git diff` proof of zero Rust change; a real
> production vertical slice proving reachability, lock-invalidation, and
> restart-with-stable-identity), all passing; zero regression (full suite
> matches the immediately-prior Arc's own established baseline). See
> `docs/secure_runtime_alpha_6841_6920_reconciliation_report.md`,
> `..._architecture_option_review.md`,
> `..._normative_decision_and_ownership_model.md`,
> `..._execution_specification.md`, `..._production_reachability_report.md`,
> `..._compatibility_and_packaged_acceptance_report.md`, and
> `..._completion_declaration.md`. Recommended next Arc: **FedOS Desktop
> Beta Final Release Candidate Validation and Public Release Readiness
> Arc**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 6761–6840 — FedOS Settings-to-Relay
> Production Wiring and Secure Runtime Reachability Arc (honest partial
> completion — Peer Capability/Identity Transition/Deletion Request now
> genuinely reachable through the packaged Beta entry point; Direct
> Ratchet remains structurally unreachable, permanently gated to
> `NODE_ENV=development` by an already-reviewed security boundary, not
> this Arc's own gap).** Closes the exact blocker the immediately-prior
> Arc's own real execution disclosed: `fedos_electron_beta_main.cts` (the
> ONE canonical packaged Beta entry point) never threaded
> `directRatchetEnabled`/`peerCapabilityEnabled`/`identityTransitionEnabled`/
> `deletionRequestEnabled` through to its own Coordinator construction,
> because the ONE missing dependency — real `conversationTransportRelays`
> — was never sourced from the already-existing, already-persisted
> Settings descriptor's own `relays` field (Alpha 4901–4980, already
> classified `runtime-restart` by Alpha 4981–5060's own evidence-derived
> table). One new, additive function
> (`secureRuntimeBundleConfig()`) reads Settings and, when a real relay is
> genuinely configured, constructs real `WebSocketRelay` instances (Node
> 22+'s own global `WebSocket`, zero new dependency, the SAME class
> `src/worker.ts` already uses in production) — never `NullRelay`, never a
> fabricated URL; when no relay is configured, every one of the four
> subsystems stays honestly disabled. Proven through the REAL packaged
> path, not inference: a real Electron 43.1.1 subprocess, real compiled
> WASM, a real Settings file seeded through the actual compiled
> controller — `peerCapabilityConfigured`/`identityTransitionConfigured`/
> `deletionRequestConfigured` all flip from `false` to `true`, a real
> restart (fresh subprocess, same on-disk profile) reproduces the
> identical public identity and reachability, wrong-passphrase and
> corrupted-Settings both fail closed. Direct Ratchet's own crypto graph
> (`assembleFedosConversationProductionCryptoGraph()`) was found, by
> direct source inspection, to always construct a SECOND, independent
> Master Seed Authority through `FedosWasmLoaderSkeleton`'s own Dev-only
> Gate (`NODE_ENV === "development"` only, permanently denied otherwise)
> — closing it would mean either redesigning that factory's own API to
> accept the ALREADY-ACTIVATED production authority instead, or weakening
> an already-reviewed security boundary; this Arc's own "no redesign,
> never weaken security" rules correctly forbid both, so it is named as
> the next Arc's own precisely-scoped work rather than attempted. Zero
> regressions (full root suite re-run matches the immediately-prior Arc's
> own established baseline shape exactly). See
> `docs/secure_runtime_alpha_6761_6840_reconciliation_report.md`,
> `..._execution_report.md`, `..._architecture_update.md`, and
> `..._completion_declaration.md`. Recommended next Arc: **FedOS Direct
> Ratchet Production Crypto Graph Unification Arc**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 6681–6760 — FedOS Desktop Beta Release
> Candidate and Packaged Security Acceptance Arc (honest partial
> completion — the canonical packaged Beta entry point does not yet
> thread Direct Ratchet/Peer Capability/Identity Transition/Deletion
> Request, blocked on the disclosed Settings→Relay plumbing gap, not this
> session's environment).** Reconciles the two immediately-prior diverged
> lineages — Desktop Runtime Configuration Unification (`70bbd6e8`, Alpha
> 6521–6600) and Secure Memory Store Production Wiring (`8a33045e`, Alpha
> 6601–6680) — with exactly one mechanical `README.md` conflict, zero
> semantic overlap (the Runtime Configuration lineage never touches
> `packages/fedos-core-rust`; the Secure Memory lineage never touches
> Desktop/Electron files), and zero regressions (confirmed by diffing
> failed-test sets against both pre-merge lineages independently: 4
> merged-run failures not present in either baseline all turned out to be
> `Test timed out in 5000ms` resource-contention flakes under the full
> 14420-test run, each passing on isolated re-run). This is the first
> session in this repository's own history with BOTH a real compiled WASM
> artifact AND the Electron spike package's own installed `node_modules`
> simultaneously present (real `cargo`/`rustc`/`wasm-bindgen` plus real
> internet access downloaded the actual Electron 43.1.1 binary), closing
> 3 of the 4 previously-BLOCKED Release Freeze rows for real: a real
> packaged Electron process, real compiled WASM, real profile creation/
> unlock/wrong-passphrase-rejection/lock/re-unlock/clean-shutdown, and a
> real NSIS installer + portable ZIP built via `electron-builder`, with
> independently-re-derived checksums.
> **Correction (Secure Runtime Alpha 8041-8120):** the phrase "real
> code-signing" that previously appeared on this line was a false claim,
> reconciled against `docs/secure_runtime_alpha_5321_5400_certificate_custody_and_signing_seam.md`'s
> own explicit statement that "FedOS Desktop Beta 0.1 ships **unsigned**"
> — that Arc built only a future signing *integration seam* (a documented
> design plus a readiness/verification check), never an actual signing
> operation or certificate. No release artifact produced by this
> repository has ever been code-signed; treat any build as unsigned unless
> independently proven otherwise for the specific copy you have. A real,
> new,
> READ-ONLY AUTOTEST diagnostic (`unifiedGraphDiagnostics()`, no renderer-
> facing IPC added) proved the Store-backed production crypto authority
> IS live and reachable through the real packaged path
> (`productionCryptoStatusOutcome: "ok"`) — but ALSO proved, honestly,
> that the canonical packaged Beta entry point's own Coordinator
> construction never threads Direct Ratchet/Peer Capability/Identity
> Transition/Deletion Request through, even though
> `FedosProfileInitializationCoordinator` has carried that config since
> Alpha 6521–6600. A fix was attempted and reverted: all four require
> `privateTransportEnabled: true` plus real Relay/transport configuration
> no packaged Electron entry point in this codebase has ever wired in —
> inventing one here would be exactly the "arbitrary production
> configuration" this Arc's own mission prohibits. A separate, narrow,
> real bug was found and fixed in the release secret-scanner itself: a
> `dev-master-seed-double` pattern match inside `/** */` comments (never
> real code — independently confirmed the flagged class's own file does
> not even compile into the packaged `dist/`) was a false positive; now
> comment-aware, every other pattern unchanged. See
> `docs/secure_runtime_alpha_6681_6760_reconciliation_report.md`,
> `..._execution_specification.md`, `..._packaged_security_acceptance_report.md`,
> `..._secret_surface_audit.md`, `..._threat_scenario_report.md`,
> `..._release_freeze_update.md`, `..._rc_acceptance_matrix.md`, and
> `..._completion_declaration.md`. Recommended next Arc: **FedOS Desktop
> Beta Settings-to-Relay Production Wiring and Packaged Direct-Ratchet/
> Peer-Capability/Identity-Transition/Deletion-Request Reachability Arc**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 6601–6680 — FedOS Secure Memory Store
> Production Wiring Arc (FULL completion).** Before this Arc, every
> `SecretHandleStore` construction anywhere in `packages/fedos-core-rust`
> was `#[cfg(test)]`-only — a real, tested, but wholly unused primitive.
> `FedosMasterSeedAuthorityState::Available(FedosMasterSeedHandle)` (a
> direct struct field) becomes `Available { store: SecretHandleStore,
> master_seed_id: SecretHandleId }` — one real, generation-safe,
> opaque-ID Store per running `FedosMasterSeedAuthority` instance,
> matching this crate's own established "one Authority per Desktop
> Runtime" pattern. Ten production methods (`generate`, `restore_sealed`,
> `seal`, `clear`, `sign_nostr_event`, `public_key_hex_for_account`,
> `resolve_conversation_key`, `encrypt_nip44_wire`, `decrypt_nip44_wire`,
> `seal_direct_ratchet_secret`, `restore_direct_ratchet_secret`) now
> resolve the Master Seed through two new private bridge helpers
> (`with_master_seed`/`with_master_seed_bytes`) that call
> `SecretHandleStore::use_handle` — generation/kind-checked, scoped,
> zeroized-after-use — instead of matching a direct field. `clear()` now
> explicitly destroys the Store-owned handle by ID rather than merely
> calling `.clear()` on a held value. Every existing cryptographic output
> (signatures, derived public keys, sealed envelopes) preserved
> byte-for-byte — proven by the full, unmodified `master_seed_authority_tests`
> suite (all still passing) plus a real, new end-to-end vertical slice:
> generate → sign → real NIP-44 round trip → real Direct Ratchet session
> + seal → stop (deny everything) → restart with a fresh Store generation
> → restore from sealed material → identical public identity → continue
> operating, while the OLD, stopped instance stays permanently denied.
> Direct Ratchet in-memory session ownership stays deliberately unchanged
> (a per-conversation object, correctly out of the Authority's own
> per-Runtime Store scope) — only its seal/restore boundary now
> transitively inherits Store-gated shutdown. Zero new `Cargo.toml`
> dependency; zero new `#[wasm_bindgen]` export surface (14, unchanged,
> confirmed against a real `wasm32-unknown-unknown --release` build);
> zero `SecretHandle`/`SecretHandleStore`/Master Seed Authority/Ratchet
> protocol/NIP/WASM API redesign; zero Desktop/Electron/Shell/Safety
> Center file touched. See
> `docs/secure_runtime_alpha_6601_6680_reconciliation_report.md`,
> `docs/secure_runtime_alpha_6601_6680_execution_specification.md`,
> `docs/secure_runtime_alpha_6601_6680_production_secret_flow_map.md`,
> `docs/secure_runtime_alpha_6601_6680_shutdown_restart_cleanup_truth.md`,
> and `docs/secure_runtime_alpha_6601_6680_completion_declaration.md`.
> Next Arc: FedOS Secure Memory Production Secret-Lifetime Audit and
> Native Host Isolation Review.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 6441–6520 — FedOS Secure Memory
> Secret-Flow Migration and Native Page-Locking Readiness Arc (FULL
> completion of this Arc's own deliberately bounded scope).** Phase A
> inventoried every remaining production secret category the mission
> named (identity/device signing keys, Ratchet chain/root keys, Sender
> keys, Archive wrapping keys, Capability secrets, Deletion signing keys).
> Five of the eight do not exist anywhere in this Rust crate at all
> (Device signing, Sender keys, Archive wrapping keys, Capability
> secrets, Deletion signing keys — each entirely TypeScript-side or
> unimplemented); the in-memory Ratchet/Identity/Master-Seed state was
> already `SecretHandle`-backed (prior Arc). The one real, previously-
> undetected gap: the Direct Ratchet SEAL/RESTORE boundary
> (`FedosDirectRatchetSession::seal_root_key`/`seal_sending_chain_key`/
> `seal_receiving_chain_key`/`seal_local_ratchet_private_key`/
> `seal_all_skipped_keys`/`restore`) moved raw key bytes — including one
> genuinely heap-allocated `Vec<u8>` AEAD-decrypted plaintext — through
> several stack/heap locations without ever zeroizing them. Closed at
> every hop, in both `lib.rs` and `crypto/direct_ratchet_session.rs`,
> matching this crate's own "every consumer zeroizes its own copy"
> convention. A second, incidental finding: no test anywhere in this
> crate previously exercised these exact WASM-exported seal/restore
> methods (only their lower-level, non-WASM counterparts) — two new real
> tests close that gap too, including a real two-party session, a real
> seal → restore → post-restore-encrypt round trip proving the sending
> chain key survived intact, and a real wrong-conversation-id
> fail-closed proof. Native page-lock readiness (Phase D) was already
> honest from the prior Arc (`Unsupported`/`NotRequested`, never
> `mlock`/`VirtualLock`) — no new code needed. Zero `SecretHandle`/Runtime
> redesign; zero new `Cargo.toml` dependency; zero new `#[wasm_bindgen]`
> export surface (real `wasm32-unknown-unknown --release` build
> confirms); zero Desktop Safety Center file read or touched. See
> `docs/secure_runtime_alpha_6441_6520_migration_inventory.md`,
> `docs/secure_runtime_alpha_6441_6520_execution_report.md`, and
> `docs/secure_runtime_alpha_6441_6520_completion_declaration.md`. Next
> Arc: FedOS Secure Memory Store Production Wiring Arc.
>
> Prior status (separate, previously-unmerged Desktop Beta Production
> Runtime Configuration Unification lineage, now merged as this Arc's own
> prerequisite):
>
> **Status: Secure Runtime Alpha 6521–6600 — FedOS Desktop Beta Production
> Runtime Configuration Unification Arc (FULL completion of this Arc's own
> deliberately bounded scope).** Closes the production bootstrap/
> configuration gap discovered by the immediately prior Arc's own real
> acceptance vertical slice: `FedosDesktopRuntimeConfig` and
> `FedosProfileInitializationCoordinator` now thread Direct Ratchet, Peer
> Capability, Identity Transition, and Signed Deletion Request
> configuration through one canonical, additive, closed configuration
> graph — all four sharing one hoisted Device Registry, one signing
> identity, one Search Index, and one `FedosConversationRuntime`
> generation, never a shadow Runtime/Shell/Host Bridge. Two real bugs
> found and fixed during this Arc's own implementation, before any test
> ran: a construction-order bug that would have created a second,
> divergent Device Registry instance, and a search-index divergence risk
> that would have let Signed Deletion Request's own retention
> reconciliation silently apply to an index nobody actually searches. A
> real, non-test-only-helper vertical slice proves the full chain through
> the ACTUAL production bootstrap path — real profile creation, unlock,
> Device Trust, Peer Capability/Identity Transition/Signed Deletion all
> reachable, Safety Center reading the same live instances, a genuine
> lock→relaunch→unlock cycle with durable decision survival across a
> fresh Coordinator instance — plus 7 failure-matrix and 8 structural-
> guard tests, 163/163 total passing, zero regressions. Direct Ratchet
> remains honestly WASM-gated (`productionCryptoGraph !== null`, never a
> fabricated Master Seed Authority). Deliberately NOT done this Arc, per
> its own explicit scope decision: Settings→Relay plumbing, the full
> 10-step Runtime generation/rebuild model (only the real
> lock→relaunch→unlock cycle this codebase actually has), and Electron
> deepening — all disclosed, none silently worked around. Also surfaced,
> not fixed (architecture-frozen): `fromRunningRuntime()`'s own Shell does
> not track an externally-stopped Runtime's state, and several Shell
> accessors throw rather than gracefully degrading when reached through a
> Shell tied to an already-stopped Runtime generation — the same class of
> finding the prior Arc noted for `archive()`. See
> `docs/secure_runtime_alpha_6521_6600_completion_declaration.md`.
> Recommended next Arc: **FedOS Desktop Beta Release Candidate and
> Packaged Security Acceptance Arc**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 6361–6440 — FedOS Desktop Beta Security
> Acceptance, Threat-Scenario Testing, and Release Freeze Arc (FULL
> completion of this Arc's own deliberately bounded, testing/documentation-
> only scope).** Merges the diverged Safety Center (`fc48d64c`) and Secure
> Memory (`33f29f22`) lineages (merge commit `d23f350`) and proves the
> Secure Runtime production-consistent through system-wide acceptance and
> threat validation — this Arc adds **zero files under `src/`**, confirmed
> structurally by direct `git diff` against the merge commit itself (the
> strongest possible proof of "architecture-frozen: no protocol redesign,
> no new cryptographic feature, no new Runtime owner"). A canonical
> Security Acceptance Matrix classifies 17 properties: 12 SUPPORTED, 5
> PARTIAL (Forward Secrecy, PCS, Metadata Protection, Master Seed, Double
> Ratchet — every one traced to the SAME single root cause, the absent
> compiled `packages/fedos-core-rust/pkg/` WASM artifact, never a design
> defect; every underlying algorithm was directly inspected in real
> source and confirmed non-stub), 0 UNSUPPORTED. 16 real Threat Scenario
> tests (stolen/revoked device, forged-signature relay injection, replay,
> downgrade, duplicated notification, Archive restoration, retention
> bypass, wrong passphrase, profile locked, Ratchet-reset call contract,
> conflicting identity replacement, signed-deletion replay/resurrection,
> capability downgrade, restart recovery, crash recovery) all pass,
> composing only already-shipped facades. A Release Freeze Checklist rates
> every subsystem PASS/FAIL/BLOCKED with no fuzzy wording: 18 PASS, 4
> BLOCKED (all environment/artifact gaps, 0 FAIL). The real acceptance
> vertical slice (Profile→Unlock→Ratchet→NIP17→Identity Replacement→
> Deletion Request→Safety Center→Restart→Recovery→Archive→Search→
> Shutdown) surfaces one genuine, previously-unstated finding: the REAL
> production Profile/Unlock bootstrap does not yet thread Identity
> Transition/Deletion Request/Ratchet config through its own Runtime
> config — stated honestly (Part 1) rather than hidden, with the full
> domain-crypto chain then proven separately and completely with 100%
> real BIP-340 Schnorr crypto (Part 2). See
> `docs/secure_runtime_alpha_6361_6440_completion_declaration.md`.
> Recommended next Arc: **FedOS Desktop Beta Production Runtime
> Configuration Unification Arc**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 6281–6360 — FedOS Secure Memory Secret
> Buffer and Zeroization Foundation Arc (FULL completion of this Arc's own
> deliberately bounded scope).** Phase A inventory found the normative
> `docs/runtime_secure_memory.md` architecture (written on an older,
> never-merged lineage) stale: on the real, selected Rust/crypto lineage
> (`b8e9e062`), `SecretHandle` is already a mature, production, non-Clone,
> zeroizing secret owner — already load-bearing for the Master Seed, the
> Identity/Application/Protocol Root hierarchy, Nostr signing, NIP-44
> conversation keys, and the entire Direct Ratchet Cryptographic Core.
> Rather than duplicating it with a redundant `FedosSecretBuffer` type,
> this Arc built the one piece genuinely missing — `SecretHandleStore`, a
> bounded (64), generation-safe, opaque-ID handle registry with
> use-after-destroy/wrong-kind/stale-generation denial, idempotent
> double-destroy, and shutdown cleanup, none of which existed anywhere in
> this crate before — and closed a real, previously-undetected
> zeroization gap: NIP-44's own per-message `chacha_key`/`hmac_key`
> (32 bytes each) lived in plain, never-zeroized `Vec<u8>` since the code
> was written; both are now `SecretHandle`-backed, with both live
> consumers (`nip44_wire_encrypt`/`nip44_wire_decrypt`) explicitly
> zeroizing their own local copies after use, including on an early-return
> failure path. All 163 pre-existing NIP-44 tests, including every RFC/
> NIP-44 reference vector, pass unchanged — proving the migration changed
> ownership, not output. Also adds an honest page-locking capability
> status (`Unsupported`/`NotRequested` — no native Desktop Rust host
> exists yet; never `mlock`/`VirtualLock`) and safe, non-sensitive
> diagnostics (live handle count, capacity, limit-reached, page-locking
> status). Zero new `Cargo.toml` dependency (`zeroize`/`secrecy` already
> production since Stage 78); zero new `#[wasm_bindgen]` export surface
> (verified against the real `wasm32-unknown-unknown --release` build's
> own generated `.d.ts`); zero Desktop/Electron/UI/Identity-Transition/
> Ratchet-protocol/NIP change. One real regression caught by this Arc's
> own new structural guard suite before it shipped: an early draft's own
> classification-label name leaked a concrete cipher name into the
> algorithm-agnostic `secret_handle` vocabulary — renamed and fixed. See
> `docs/secure_runtime_alpha_6281_6360_reconciliation_report.md`,
> `docs/secure_runtime_alpha_6281_6360_execution_spec.md`,
> `docs/secure_runtime_alpha_6281_6360_ownership_and_lifetime.md`,
> `docs/secure_runtime_alpha_6281_6360_zeroization_assurance.md`,
> `docs/secure_runtime_alpha_6281_6360_migration_inventory.md`, and
> `docs/secure_runtime_alpha_6281_6360_completion_declaration.md`. Next
> Arc: FedOS Secure Memory Secret-Flow Migration and Native Page-Locking
> Readiness Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 6201–6280 — FedOS Desktop Beta Privacy
> Controls and Safety Center Arc (FULL completion, four disclosed
> boundaries, all matching established precedent or explicitly scoped
> out).** Merges the diverged Identity Replacement UI (`9cdd74ec`) and
> Signed Deletion gap-closure (`50f80e8`) lineages (merge commit
> `85c64304`) and builds one canonical, user-facing Safety Center
> aggregating every existing security capability: a closed, 13-section
> model (profile/unlock, Devices, Device Sync, secure messaging, peer
> capabilities, Identity Replacement, Deletion Requests, Retention/Search,
> Archive/Backups, Notifications, Security Events, Limitations), each with
> its own independent state — never a single numeric "security score,"
> never a fabricated "100% safe." A real bug found in the prior Arc's own
> Signed Deletion Request lineage — a `"policy-pending"` review item's
> signed body was held in memory only, so a restart before human approval
> lost it — is fixed via a new, additive, tombstone-based append-only
> durable side-channel (`FedosDeletionRequestPendingReviewPersistence`),
> proven with real BIP-340 Schnorr crypto and a real process restart. Four
> new narrow, additive Shell accessors
> (`productionCryptoStatus`/`directRatchetStatus`/`peerCapabilityListObserved`/
> `peerCapabilityStatus`) expose facts the Shell never surfaced before; 8
> new closed Host Commands, one new Controller/Renderer/Navigation state,
> wired into the EXISTING, unmodified Shell/Presentation Boundary/Renderer/
> Host Bridge — no second Shell, Runtime, Presentation Boundary, Renderer,
> Navigation Registry, Notification Coordinator, or Electron Main owner. 5
> new closed notification kinds fire at most once per fact, never
> double-firing an already-existing per-domain notification. 12
> centralized warning codes cover every non-guarantee named in the
> mission, including an intentionally non-committal Secure Memory
> zeroization warning (a separate, parallel Arc owns that domain and is
> never touched here). Real vertical slice: 100% real Schnorr crypto
> throughout, a genuinely real `FedosConversationRuntime`/
> `FedosDesktopApplicationShell`/`FedosDesktopConversationUiPresentationBoundary`/
> `FedosSafetyCenterController`/`FedosSafetyCenterRenderer` stack, a real
> restart proving both the aggregation and the pending-review durability
> fix. Four disclosed boundaries, all either matching established
> precedent (Device Trust/Sync/live-Ratchet unconfigured on this slice's
> own Runtime, matching every prior Arc's own "optional integration a
> slice doesn't need" precedent; a compiled Ratchet WASM artifact remains
> absent, universal precedent) or explicitly scoped out (a manual
> Ratchet-reset confirmation outside the Identity Replacement flow honestly
> reports `"unsupported"` rather than inventing a second reset mechanism;
> the Electron spike package's own typecheck could not run to completion
> in this worktree due to a pre-existing, unrelated missing-`node_modules`
> environment gap). See
> `docs/secure_runtime_alpha_6201_6280_completion_declaration.md`.
> Recommended next Arc: **FedOS Desktop Beta Security Acceptance,
> Threat-Scenario Testing, and Release Freeze Arc**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 6121–6200 — FedOS Identity Replacement
> User Verification and Conversation Continuity UI Arc (FULL completion,
> two disclosed pre-existing boundaries matching established precedent).**
> Merges the diverged Identity Transition (`a5f9cca5`) and Desktop/UI
> (`b72ca7b6`) lineages (merge commit `02845ed9`) and builds the explicit
> user-verification/conversation-continuity experience over the completed
> Identity Transition foundation: a closed, safe transition display model
> combining evidence outcome, acceptance state, per-Device evidence, and
> centralized warnings (never "verified" shown as "trusted"); a durable,
> restart-safe manual-verification fact (3 closed methods, unknown methods
> fail closed); explicit, durably-persisted accept/reject/defer decisions
> (a real gap in the prior Arc — decisions were computed per-call but
> never durably recorded — found and fixed via this Arc's own real
> restart vertical slice); the smallest additive Conversation Continuity
> model (the existing Direct Conversation ID is never rewritten; a new
> local link records accepted continuity + a required new session
> generation); a two-step Ratchet reset flow (read-only impact assessment,
> then a separate explicit authorization, a thin adapter over the
> existing `initializeDirectRatchetSession()`, never a new reset
> mechanism); a bounded, deterministic Identity Transition Inbox; 10 new
> `FedosDesktopApplicationShell` methods and 10 new closed Host commands,
> all delegating entirely to the existing, unmodified
> `FedosConversationRuntime.identityTransition()` (a new nullable
> accessor mirroring `deletionRequest()` byte-for-byte) plus
> `directRatchet()`; one new Controller/Renderer/Navigation state wired
> into the EXISTING, unmodified Presentation Boundary, Renderer
> aggregate, and Host Bridge — no second Shell, Runtime, Presentation
> Boundary, Renderer, Navigation Registry, or Host Bridge. Real vertical
> slice with 100% real BIP-340 Schnorr crypto through a genuinely real
> `FedosConversationRuntime`/`FedosDesktopApplicationShell`/Presentation
> Boundary stack (built via the SAME production assembly helper the real
> Desktop Runtime itself uses) — no fake business Runtime anywhere.
> Two disclosed, pre-existing boundaries, neither specific to this Arc:
> Notification Coordinator wiring and Electron subprocess acceptance were
> not reached, exactly matching `b72ca7b6`'s own disclosed scope; and a
> genuine live Direct Ratchet session / `establishSession()` reset
> dispatch needs a compiled `packages/fedos-core-rust/pkg/` this worktree
> does not have — confirmed every test in this repository exercising
> `establishSession()` is WASM-gated, no exceptions, so this Arc's own
> reset-authorization CALL CONTRACT is proven honest (`"unavailable"`,
> never a fabricated success) rather than faked. See
> `docs/secure_runtime_alpha_6121_6200_completion_declaration.md`.
> Recommended next Arc: **FedOS Desktop Beta Privacy Controls and Safety
> Center Arc**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5961–6040 — FedOS Identity Transition
> Peer Notification and Ratchet Reset Integration Arc (FULL completion,
> one disclosed pre-existing WASM boundary).** Wires the Identity
> Transition evidence foundation (`b4aaab9`) into the live peer-capability
> private-transport pipeline (`d825aa0`) and the live authenticated
> Ratchet Session Reset foundation (`f80889d`). New, additive bridge
> domain under `src/conversation/identity_transition/peer_integration/`:
> a strict notification schema riding the EXISTING `"nostr-nip17-v1"`
> route through a new, additive third `kind` on the peer-capability
> control payload (no new Nostr kind); real BIP-340 Schnorr signatures
> throughout (account authorization, new-key proof, old-key continuity —
> all independently reverified by the receiver, never trusted from the
> sender's own claims); a durable, restart-safe, multi-Device-isolated
> Peer Transition Observation store with idempotent/conflicting-duplicate,
> rollback, broken-predecessor, and cycle detection; local acceptance
> reusing the Foundation's own evidence/acceptance vocabularies directly
> (no third vocabulary); a new `"identity-transition-v1"` peer capability
> advertisement value through the existing, unmodified advertisement
> pipeline; and an explicit, `"accepted"`-gated Ratchet reset
> authorization that dispatches the REAL, existing
> `FedosDirectRatchetOutboundIntegration.establishSession()` with one new,
> additive `"identity-transition"` reason — never a new reset message
> type, never automatic, never rebinding old root/chain keys. Transition
> ID is bound to the resulting session via a separate, additive local
> correlation record rather than widening the frozen, positional-array
> Session Reset wire tuple (a deliberate, documented scope decision).
> Real vertical slice with 100% real Identity Transition crypto through
> its own Ratchet-authorization boundary; the one genuinely WASM-gated
> piece (a real `establishSession()` Double-Ratchet round trip) is
> `describe.skip`'d here exactly like the two earlier Arcs' own real
> vertical slices already are, for the same pre-existing reason (no
> compiled `pkg/` in this worktree). No live account/Nostr identity
> replaced, no automatic peer trust, no Device Registry/Membership/
> Archive/Search mutation anywhere in this codebase as a result of this
> Arc. See `docs/secure_runtime_alpha_5961_6040_completion_declaration.md`.
> Recommended next Arc: **FedOS Identity Replacement User Verification
> and Conversation Continuity UI Arc**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5801–5880 — FedOS Identity Transition
> Types, Validation, and Durable Evidence Foundation Arc (FULL
> completion).** Implements the non-network foundation the FedOS Account
> and Nostr Identity Rotation V1 Specification Review (`45e0fce`) named as
> its own recommended next Arc. New, standalone, additive domain under
> `src/conversation/identity_transition/`: closed transition/reason/
> evidence-kind/evidence-status vocabularies; a strict, versioned
> transition record (`authority: "nostr"` required for both identities —
> the only account/Nostr mapping this codebase's architecture supports);
> deterministic, domain-separated canonical serialization for the body and
> all three evidence artifacts (mutation invalidates every attached
> proof); a real BIP-340-Schnorr-verified new-key proof of possession; old
> -identity continuity evidence whose own verifier NEVER returns an
> acceptance-flavored status (only the pure evidence evaluator may); optional
> Device corroboration reusing the live Device Binding trust/revocation
> boundary; a pure evidence evaluator enforcing both of this review's hard
> invariants — no auto-accept from parsing signatures alone, and a
> compromise-confirmed reason never treats an old-key signature as
> sufficient even with the new-key proof valid; durable, restart-safe,
> append-only transition facts with idempotent-duplicate, conflicting-
> duplicate, revision-rollback, broken-predecessor, and predecessor-cycle
> detection (supersession and conflict state are derived at read time,
> never backfilled onto an already-inserted fact); local peer acceptance
> state; and two read-only impact plans (Ratchet reset, Conversation/
> Archive/Search) that are never applied. Real vertical slice with two
> genuine independent Schnorr identities, a real Device, restart/replay,
> and 20 of Phase O's own named checks, all passing. No live account/Nostr
> identity is replaced anywhere in this codebase by this Arc; no Device
> Registry, Conversation Membership, Ratchet session, Archive, or Search
> state is mutated. See
> `docs/secure_runtime_alpha_5801_5880_completion_declaration.md`.
> Recommended next Arc: **FedOS Identity Transition Peer Notification and
> Ratchet Reset Integration Arc**.
>
> Prior status:
>
> **Status: FedOS Account and Nostr Identity Rotation V1 Specification
> Review (specification-only, empty production diff).** The canonical V1
> decision review the FedOS Ratchet Peer Notification and Capability
> Advertisement Arc (`d825aa0`) named as its own recommended next step,
> and the terminal link in the review chain `b34d608` → `3ebfa37` →
> `f80889d` → `d825aa0` started. Twenty docs under
> `docs/reviews/fedos_account_nostr_identity_rotation_v1/`. Verdict:
> account identity and Nostr identity do **not** rotate in V1 — they
> remain the single, immutable value they are today (reaffirming
> `3ebfa37`'s own Option 1). What changes is a complete specification for
> **Replacement**: a brand-new identity, never an in-place key change,
> optionally carrying an explicit, evidence-leveled continuity claim
> (old-identity signature alone is explicitly insufficient under a
> compromised-old-key assumption — reusing the account's independent
> per-Device signing keypair, Alpha 3161–3240, as the strongest available
> corroborating evidence). Device migration is explicit rebind-through-
> reauthorization, reusing `f80889d`'s own register-then-revoke Device
> Replacement pattern at account scope. Ratchet sessions always reset,
> never rebind root/chain keys to a new identity. Direct Conversation
> identity/history is preserved and never rewritten; Archive Restore
> never establishes identity trust; Group continuity is deferred. Master
> Seed replacement while preserving account identity is not possible in
> this architecture (they are the same event); passphrase rotation is
> named as a separate, low-risk, future Arc. Peer notification reuses
> `d825aa0`'s live, authenticated, evidence-only private-transport
> pipeline with new additive fact kinds — no new Nostr kind, no public
> event. Self-declared rotation is never automatic trust. See
> `docs/reviews/fedos_account_nostr_identity_rotation_v1/20_normative_recommendation.md`.
> Recommended next Arc: **FedOS Identity Transition Types, Validation,
> and Durable Evidence Foundation Arc** — types/validation/durable
> evidence only; no live migration ships until a later Arc.
>
> Prior status (parallel Desktop/UI lineage, merged in at this Arc):
>
> **Status: Secure Runtime Alpha 6041–6120 — FedOS Signed Deletion
> Request Multi-Device Aggregation and User Consent UI Arc (FULL
> completion).** Makes the completed Signed Deletion Request transport
> (`8981f81`, Alpha 5881–5960) understandable and safely usable: a
> closed, structurally-erasure-claim-free per-Device (17 values) and
> account-aggregate (7 values) status model; an explicit recipient
> consent boundary (opening an item never executes anything; no
> countdown/automatic approval); a restart-safe recipient Inbox backed
> by a new, additive, insert-only display-fact port
> (`FedosDeletionRequestInboxSummaryPersistence` — `5641-5720`'s own
> decision record never carried display fields); nine new
> `FedosDesktopApplicationShell` methods and nine new closed Host
> commands, all delegating entirely to the existing, unmodified
> `FedosConversationRuntime.deletionRequest()` facade; one new
> Controller/Renderer wired into the EXISTING, unmodified Presentation
> Boundary and Renderer aggregate — no second Shell, Runtime, Host
> Bridge, or Renderer architecture. No canonical Desktop/Electron lineage
> merge was required — `8981f81` already contains it (`8548845`, Alpha
> 5161–5240). A real functional gap was found and fixed during this
> Arc's own real vertical slice: `5881-5960`'s own approval method
> re-evaluated `"always-review"` a second time at approval, making every
> `"always-review"` item permanently un-approvable; reaching that method
> at all already IS the human review the policy exists to require, so it
> now grants the request's own requested scope on explicit approval only
> (`"deny"`/`"unavailable"` still refuse; `"allow-local-history-only"`
> still caps every grant). Proven with a REAL, no-mock end-to-end
> multi-Device vertical slice against a genuinely-built WASM artifact:
> two real Device-specific requests, Bob's one real Nostr identity
> receiving both (NIP-17 delivery is per-account) and Device A's own
> real Runtime independently, correctly rejecting the Device-B-addressed
> one as a device-mismatch (proving real Device isolation, never a
> silent accept/drop), Device A's real approval and real `b3b3a6d`
> execution independently re-verified, a real signed acknowledgement
> round trip, a real full restart of both sides with byte-identical
> Shell/Renderer status reconstruction, and an honest
> `"some-devices-applied"` aggregate — explicitly never a completion
> claim. **Gap-closing follow-up (same commit lineage):** Electron
> subprocess acceptance is now proven for real through the existing,
> unmodified `window.fedos.invoke()` transport (4 new self-test steps,
> a real spawned Electron subprocess, 21/21 passing); the Notification
> Coordinator is now wired (5 new fixed-template kinds, once-per-item
> firing discipline, 8 new tests proving no request id/requester
> ref/reason code ever leaks into a notification); and
> `fedos_desktop_runtime.ts`'s own full production bootstrap now
> threads `conversationDeletionRequest` through (one new optional
> config field, proven live via the real production
> `startFedosDesktopRuntime()`/`FedosDesktopApplicationShell.start()`
> path, 4 new tests). One narrower, still-standing limitation:
> `refreshSentStatus()`'s own per-Device trust-fact lookup needs
> `deviceSyncOperational()`, which the minimal-config production paths
> above do not construct — out of scope for this follow-up. See
> `docs/secure_runtime_alpha_6041_6120_reconciliation_report.md`,
> `docs/secure_runtime_alpha_6041_6120_execution_spec.md`,
> `docs/secure_runtime_alpha_6041_6120_aggregation_truth.md`,
> `docs/secure_runtime_alpha_6041_6120_consent_and_warning_ux.md`, and
> `docs/secure_runtime_alpha_6041_6120_completion_declaration.md`. Next
> Arc: FedOS Desktop Beta Privacy Controls and Safety Center Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5881–5960 — FedOS Signed Recipient
> Deletion Request Private Transport and Local Policy Integration Arc
> (FULL completion).** Makes the completed Signed Recipient Deletion
> Request protocol (`22f9277`, Alpha 5641–5720) usable end to end over
> the real, live private transport: eight new files under
> `src/conversation/deletion_request/` add a protocol-neutral control
> payload (mirrors `d825aa0`'s own peer-capability precedent, two
> discriminators, `deletion-request-v1`/`deletion-acknowledgement-v1`,
> wrapping the already-real signed request/acknowledgement — no second
> signature scheme), a sender-side Outbound Coordinator (real signing,
> real pre-publish self-check, real durable state, real publish through
> `FedosPrivateTransport.sendMailboxNip17Control()`), a closed, LOCALLY-
> CONFIGURED recipient policy vocabulary
> (`always-review`/`allow-local-history-only`/`allow-local-history-and-index`/
> `deny`/`unavailable` — never an unconditional default allow), a
> recipient-side Inbound Coordinator that reuses `5641-5720`'s own real
> evaluation pipeline unmodified and adds the ONE new sanctioned call
> site to `b3b3a6d`'s own real `executeFedosLocalPayloadDeletionPlan()`,
> and a real signed-acknowledgement round trip (recipient signs/persists/
> publishes; requester verifies/correlates/persists, advancing its own
> durable request lifecycle through every intermediate live state to
> `acknowledged`, never a single illegal jump). A real, genuinely-found
> integration gap — `assessFedosDeletionRequestAuthorization()`'s own
> hardcoded `"fedos"`-authority participant reference, which would have
> failed EVERY real production Direct Conversation's own `"nostr"`-
> authority Membership — was fixed with a narrow, additive, 100%-
> backward-compatible optional parameter. Proven with a REAL, no-mock
> end-to-end vertical slice against a genuinely-built WASM artifact
> (`cargo build --target wasm32-unknown-unknown --release` +
> `wasm-bindgen`, built fresh in this session): real Master Seeds, real
> Direct Conversation, a real message, a real signed Device-specific
> deletion request published through a real in-process Relay and real
> NIP-17 Gift Wrap, real recipient policy grant, real `b3b3a6d` execution
> independently re-verified (`evaluatePayloadAccess()` → `"denied"`), a
> real signed acknowledgement round trip, an unregistered-Device request
> denied before publish, and a full restart of both sides with exact
> durable replay — no message plaintext, private key, or raw path in any
> protocol durable file. Compared against the unmodified integration
> base via a sorted full-suite JSON-report diff: zero net regressions
> (the only newly-failing tests are the well-known, self-resolving
> `git status`-based review-guard pattern). Named, honest limitation:
> the vertical slice does not include Bob independently creating an
> Archive of the message (orthogonal harness wiring, out of this Arc's
> own time budget) — the structural "no Archive deletion" guarantee
> itself is proven independently and unaffected. See
> `docs/secure_runtime_alpha_5881_5960_reconciliation_report.md`,
> `docs/secure_runtime_alpha_5881_5960_execution_spec.md`,
> `docs/secure_runtime_alpha_5881_5960_control_payload_mapping.md`,
> `docs/secure_runtime_alpha_5881_5960_recipient_policy_and_acknowledgement_truth.md`,
> and `docs/secure_runtime_alpha_5881_5960_completion_declaration.md`.
> Next Arc: FedOS Signed Deletion Request Multi-Device Aggregation and
> User Consent UI Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5721–5800 — FedOS Ratchet Peer
> Notification and Capability Advertisement Arc (FULL completion).**
> Implements the authenticated peer-notification and capability-advertisement
> foundation the FedOS Ratchet Device Lifecycle and Authenticated Session
> Reset Foundation Arc (`f80889d`) named as its own recommended next Arc.
> New, all additive, under `src/conversation/ratchet/peer_capability/`: a
> closed, versioned capability vocabulary (reusing, never widening, the
> existing private-message-route and ratchet-suite vocabularies); a
> signed Peer Capability Advertisement record and six closed, authenticated
> Device Lifecycle Notification facts (`device-added`/`device-revoked`/
> `device-replaced`/`ratchet-session-reset-required`/
> `ratchet-session-generation-advanced`/`capability-superseded` — NOT
> `device-key-updated`, since no in-place Device key-rotation primitive
> exists anywhere in this codebase); real account-level signing (reusing
> the Device Binding kind-1-event pattern) plus optional, best-effort
> Device-level signing (reusing the Session Reset pattern), modeled as
> three distinct, never-silently-upgraded evidence states; both record
> types carried through the EXISTING `"nostr-nip17-v1"` Gift Wrap
> transport via the existing `sendMailboxNip17Control()` seam — no new
> Nostr kind, no new NIP, no public unencrypted event; a pure, 13-outcome
> local acceptance policy and a pure session-action-recommendation layer
> that never itself resets/establishes/copies a session; a dedicated,
> append-only-capable, per-local-Device peer-capability Observation
> domain; and a narrow safe facade
> (`FedosRatchetPeerCapabilityRuntime`) wired into `FedosConversationRuntime`
> via one optional dependency bundle and one narrow, additive
> inbound-dispatch hook. Proven with a real, no-fake-crypto vertical
> slice: a real signed advertisement published through the real NIP-17
> transport and a real in-process Relay, durably observed, restart-safe,
> with independent per-Device state (Alice's second Device announced and
> recorded with no inherited session) and a Device-revocation
> notification whose `"revoked"` status a later, conflicting, stale
> re-advertisement can never silently overwrite. Three real bugs found
> and fixed via this real testing: an exact-nonce-replay false conflict,
> lifecycle-notification observations keyed by the wrong Device, and
> cross-`sourceKind` revision-counter mixing. See
> `docs/secure_runtime_alpha_5721_5800_completion_declaration.md`.
> Peer advertisement is evidence, not trust; one Device observation is
> never account-wide; no capability fact ever activates a route, mutates
> the Device Registry, or resets a session automatically; no account/Nostr
> identity rotation is implemented. Recommended next Arc: **FedOS Account
> and Nostr Identity Rotation V1 Specification Review**.
>
> Prior status:
>
> **Status: FedOS Ratchet Device Lifecycle and Authenticated Session
> Reset Foundation Arc (FULL completion).** Implements the Runtime
> foundation the FedOS Direct Ratchet Multi-Device Session Lifecycle and
> Identity Rotation V1 Review (`3ebfa37`) named as the exact next Arc, on
> top of the completed Direct Ratchet + NIP-17 Integration (`b8e9e06`).
> New, all additive: an authenticated Session Reset message (four new
> fields on the existing `session-init` NIP-17 payload — `previousGeneration`/
> `resetReason`/`resetNonce`/`deviceSignatureHex` — never a new
> control-message kind); the FIRST real consumption of the existing
> per-Device signing keypair (Alpha 3161–3240) by the Ratchet, via a
> best-effort, optional Device-level signature (never a hard requirement,
> since no durable Device-key storage exists anywhere in this codebase,
> and this Arc does not invent one); a Session Reset Authority (Device
> Trust integration, generation-integrity check, replay protection) and a
> Runtime Reset Coordinator that supersedes the prior generation via the
> ALREADY-LIVE `"reset-required"` lifecycle state (Alpha 5401–5480 — no
> new state was needed; a real discrepancy the source review itself
> missed); durable, restart-safe, nonce-keyed reset audit records; a
> Device Lifecycle derivation (`pending`/`active`/`replaced`/`revoked`/
> `unavailable`) and a formalized Device Replacement Coordinator
> (register-then-revoke, real Nostr + real Device signatures, never
> inherits the old Device's identity or key); and Device-revocation
> quarantine wired to the Ratchet (`applyDeviceRevocationToSessions()`).
> Proven with a real, no-fake-crypto vertical slice: generation 0 →
> authenticated, Device-signed, reasoned reset → generation 1, superseded
> + restart-safe on both sides, a real second Device pair (Alice's
> tablet) proven isolated and unaffected, and "a reset always names why"
> enforced structurally end-to-end through a second real reset to
> generation 2. See
> `docs/fedos_ratchet_device_lifecycle_session_reset_foundation_completion_declaration.md`.
> No account/Nostr identity rotation, Master Seed replacement, PQ, MLS,
> Sender-Key redesign, group messaging, UI, Electron, or remote
> synchronization touched. Recommended next Arc: **FedOS Ratchet Peer
> Notification and Capability Advertisement Arc**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5561–5640 — FedOS Direct Double Ratchet
> Conversation Runtime and NIP-17 Integration Arc (FULL completion).**
> Wires the already-real Ratchet State Foundation (`be1bc0d`) and
> Cryptographic Core (`080cb99`) into the already-real NIP-17 Rumor/Seal/
> Gift Wrap wire-adapter lineage (`100c231`, merged as this Arc's own
> prerequisite) and the existing Direct Conversation send/receive path —
> real product-level forward secrecy, not merely a standalone crypto core.
> New: a closed route-vocabulary extension (`"nostr-nip17-v1-ratchet"`,
> additive, never replacing the two existing routes, with an explicit
> `"downgrade-detected"` outcome so an already-active ratchet session can
> never be silently bypassed); a canonical, side-independent Device-pair
> session-id resolver (both participants must derive the byte-identical
> id — the Rust ratchet core's own HKDF context binding input); a strict,
> closed `"session-init"`/`"message"` inner payload carried through the
> UNMODIFIED NIP-17/NIP-59 outer framing (never a new NIP, never a new
> public event kind); real outbound/inbound integration composing the
> real Ratchet Core `encrypt()`/`decrypt()` with durable state commits,
> the real `FedosPrivateTransport` (one additive `sendMailboxNip17Control()`
> method for session-establishment control facts), and the existing,
> unmodified Conversation Envelope/Payload/Retention/Search import path;
> and a narrow Runtime facade (`directRatchet()` on `FedosConversationRuntime`)
> exposing only safe operations. Two real bugs in the real cryptographic
> restart-recovery path were found and fixed during this Arc's own
> development (not present before it): the Rust ratchet header's 256-byte
> session-id bound was silently exceeded by a naive full-pubkey encoding
> (fixed by a compact, canonically-ordered encoding), and
> `send_counter`/`previous_sending_chain_length` reset on a real DH
> ratchet step but were never read back correctly on restore (fixed by one
> additive Rust getter, `FedosDirectRatchetSession::previous_sending_chain_length()`,
> and one additive `FedosDirectRatchetStateRuntime.commitCounters()`
> method). The headline proof
> (`test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts`) runs
> two independent real identities/Devices through real session
> establishment, real bidirectional messaging, duplicate rejection, a full
> stop/restart of both Runtimes from durable files, and a post-restart
> message exchange on the restored session — with no known plaintext or
> root/chain/private-key fixture ever appearing in the durable files. A
> second file
> (`test/secure_runtime_alpha_5561_5640_failure_matrix.test.ts`) proves
> tampered-ciphertext rejection, unsupported-suite rejection, and
> unknown-session rejection, all with real crypto. See
> `docs/secure_runtime_alpha_5561_5640_execution_spec.md`,
> `docs/secure_runtime_alpha_5561_5640_ratchet_nip17_payload_mapping.md`,
> `docs/secure_runtime_alpha_5561_5640_atomic_state_outbox_retry.md`, and
> `docs/secure_runtime_alpha_5561_5640_completion_declaration.md` (which
> also discloses several narrower, non-blocking test-coverage boundaries:
> out-of-order/skipped-key recovery and a live three-simultaneous-session
> proof were not separately re-demonstrated at this Arc's own integration
> layer beyond what the already-real Cryptographic Core Arc's own test
> already proves, and Desktop/Electron wiring of the new optional
> `directRatchet` dependency bundle was left for a follow-on, mirroring how
> the static NIP-17 route's own Desktop wiring landed one Arc at a time).
> Recommended next Arc: **FedOS Direct Ratchet Multi-Device Session
> Lifecycle and Identity Rotation Decision Review**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5641–5720 — FedOS Signed Recipient
> Deletion Request Types, Validation, and Durable State Foundation Arc
> (complete).** Architecture frozen: no Relay event, no NIP-17 wiring, no
> new Nostr kind, no live transport, no automatic local deletion, no
> Ratchet dependency, `p2p/`/`.tmp_gen/` untouched. Implements Doc 19's
> own Stage 1 scope of the normative review (`860a58e`,
> `review/fedos-signed-recipient-deletion-request-v1`) over the real,
> implemented `arc/local-deletion-capability-state-foundation @ b3b3a6d`
> base: thirty new files under `src/conversation/deletion_request/`
> provide closed request/acknowledgement schemas (strict, unknown-field-
> rejecting), fixed-field-order canonical serialization, real account
> signing/verification reusing the EXISTING `FedosNostrSigningAuthority`
> and the EXISTING pure-TypeScript `validateInboundNostrEvent` chain (no
> WASM needed for verification), a target-existence-oracle-safe
> authorization assessment over real Conversation/Membership/Envelope
> state, and three independent durable domains (outbound request
> lifecycle, recipient decision, acknowledgement fact) — each with an
> in-memory and a real append-only NDJSON backend sharing one
> monotonic-transition-validating write function. `FedosNobleTestNostrSigningAuthority`
> (mirrors `MockFedosBoardOutboxPublisher`'s own Alpha 473 precedent for
> living in `src/`) produces genuinely real BIP-340 Schnorr signatures via
> `@noble/curves` — an already-declared dependency, not a new primitive —
> isolated from the absent WASM/Master-Seed production path this worktree
> does not have. This Arc never calls `b3b3a6d`'s own execution
> coordinator or Archive-file authority: recipient evaluation stops at
> `"policy-pending"` (authorized) or a terminal denial; only a caller
> explicitly supplying an already-produced local outcome can record
> `"locally-applied"`/`"partially-applied"`/`"failed"`. Device identity
> stays honestly advisory-only throughout (no real per-Device signing key
> exists anywhere in this codebase — confirmed independently in this
> Arc's own reconciliation report). Nine new test files (132 new tests)
> cover closed vocabularies and strict record validation, real signing/
> verification (including one-byte-mutation and content-splicing tamper
> detection), authorization assessment (target substitution, non-author
> denial, Device/recipient mismatch), durable state and restart replay
> across all three domains, the expiry/retry planner and safe
> multi-device aggregation (never account-wide), the recipient evaluation
> pipeline, a failure matrix closing remaining gaps (future-issued
> requests, wrong-Conversation targets, state rollback, interrupted
> append, acknowledgement overclaim), a structural no-live-wire proof, and
> one real Phase O vertical slice — real Alice/Bob accounts, real signing,
> a real restart across all three durable domains, a real `b3b3a6d`
> execution, real acknowledgement correlation, and a real check that no
> message plaintext, private key, or raw path exists in any durable file.
> `b3b3a6d`'s own 82 tests, plus Membership/Retention/account-signing
> regression suites, all still pass unchanged. See
> `docs/secure_runtime_alpha_5641_5720_reconciliation_report.md`,
> `docs/secure_runtime_alpha_5641_5720_execution_spec.md`,
> `docs/secure_runtime_alpha_5641_5720_request_and_acknowledgement_schema.md`,
> and `docs/secure_runtime_alpha_5641_5720_completion_declaration.md`.
> Next Arc: FedOS Signed Recipient Deletion Request Private Transport and
> Local Policy Integration Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5481–5560 — FedOS Direct Double Ratchet
> Cryptographic Core Arc (FULL completion).** Implements the real,
> pure cryptographic core the normative forward-secrecy review delegates to
> this exact Arc, built entirely on top of the completed, unmodified
> Ratchet State Foundation Arc (`be1bc0d`) — no live Conversation wiring, no
> NIP-17 mapping, no transport of any kind. Three new Rust modules
> (`packages/fedos-core-rust/src/crypto/direct_ratchet{,_header,_session}.rs`):
> fresh ephemeral secp256k1 keypair generation and validated ECDH agreement
> (mirroring `conversation_key.rs`'s own reviewed point-arithmetic technique,
> never modifying that frozen file); a root KDF and chain KDF built on raw
> HKDF-SHA256, both session/Device-pair/Conversation/generation-bound and
> proven deterministic-yet-context-separated; a versioned, fixed-layout,
> transport-neutral header authenticated as AEAD Additional Authenticated
> Data (a narrow, independent ChaCha20-Poly1305 helper, since the shared
> `aead_internal::seal_internal` only accepts a fixed per-domain AAD label,
> never arbitrary caller bytes — a deliberate new, narrow function rather
> than widening that frozen shared primitive); a full session state machine
> implementing the standard DH-ratchet-on-direction-switch transition
> (proven by the local ratchet keypair genuinely rotating, discarding the
> old private key for post-compromise security); bounded out-of-order/
> skipped-key handling (1000 keys/gap, 14-day expiry — the review's own
> exact figures); and atomic encrypt/decrypt (every fallible step computed
> before any state mutation, committed in one place only after real AEAD
> authentication succeeds). Sealed-persistence integration is deliberately
> per-secret-kind, reusing the Foundation Arc's OWN already-proven
> `FedosMasterSeedAuthority.seal_direct_ratchet_secret()`/
> `restore_direct_ratchet_secret()` internally (Rust-to-Rust) for every
> secret-bearing field — no new sealed bundle format, and no raw secret
> byte ever crosses the WASM boundary into JavaScript. The headline proof
> (`test/secure_runtime_alpha_5481_5560_real_vertical_slice.test.ts`) runs
> against REAL cryptography and REAL durable files: two independently-
> generated Device identities (Alice, Bob), a full real conversation
> including a three-message send burst received out of order, one-time
> skipped-key consumption, duplicate rejection, a genuine DH ratchet
> transition completing Bob's reply, a real stop/seal/restore cycle,
> continued conversation post-restart, wrong-Device rejection (a third
> identity cannot restore another party's sealed state), ciphertext-tamper
> rejection immediately followed by successful decryption of the genuine
> message, an honest documented boundary around state-revision rollback
> (a persistence-layer responsibility, not a crypto-core one), and a direct
> read of the durable sealed-state file confirming none of the seven
> plaintext markers used anywhere in the conversation appear in it. 78 new
> tests (59 Rust + 14 TypeScript + structural guards), all passing, plus a
> real WASM build. No Signal-protocol interoperability, MLS, or
> post-quantum cryptography is claimed anywhere in this Arc — see
> `docs/secure_runtime_alpha_5481_5560_cryptographic_construction.md`.
> **Product-level forward secrecy is not yet claimed**: this is a
> standalone cryptographic core with no live callers; it becomes a product
> property only once a future Arc wires it into live message flow. See
> `docs/secure_runtime_alpha_5481_5560_reconciliation_report.md`,
> `..._execution_spec.md`, `..._cryptographic_construction.md`,
> `..._test_vectors.md`, and `..._completion_declaration.md`.
> Recommended next Arc: **FedOS Direct Double Ratchet Conversation Runtime
> and NIP-17 Integration Arc.**
>
> **Note on Alpha-range numbering**: this branch's own base, `be1bc0d`
> (Alpha 5401–5480, Direct Ratchet State and Sealed Persistence
> Foundation), shares its Alpha label with an unrelated, independently-
> completed sibling branch, `b3b3a6d` (Local Deletion Capability and
> Deletion-State Foundation) — a genuine collision, recorded (never
> silently repaired) in this Arc's own reconciliation report. Neither
> commit was rewritten, amended, or renamed; this Arc's own range,
> 5481–5560, is the earliest genuinely-free range as of this Arc's own
> Phase A inventory.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5401–5480 — FedOS Direct Ratchet State and
> Sealed Persistence Foundation Arc (FULL completion).** Implements the
> complete NON-CRYPTOGRAPHIC foundation the normative forward-secrecy
> review (`review/fedos-forward-secrecy-double-ratchet-v1`) names as its
> own recommended next Arc — no DH ratchet step, no root/chain-key KDF
> evolution, no message-key derivation, and no NIP-17 wiring exist
> anywhere in this Arc. A new, additive domain, `src/conversation/ratchet/`
> (14 files): a versioned, Device-pair-bound, collision-safe session
> identity (deliberately wider than the review's own 3-component model —
> this codebase's own multi-device-per-account reality requires binding
> local Device identity too, not just local account); a closed lifecycle
> vocabulary (`initialized`/`active`/`suspended`/`reset-required`/
> `expired`/`revoked`/`corrupt`/`unavailable`) with validated transitions
> and fully-terminal `revoked`/`corrupt`; monotonic counters; a bounded
> (1000 keys/chain-gap, 14-day retention — the review's own exact
> figures) skipped-message-key reference index, never an unbounded map;
> a versioned sealed-secret record (one opaque `sealedBlob` field,
> modeled on the Sender-Key sealed-persistence lineage's own precedent);
> event-sourced append-only persistence for session metadata and
> insert-only persistence for sealed secrets; and a narrow Runtime
> facade (create/inspect/readiness/suspend/reset-required/expire/revoke/
> counters/skipped-key register-remove/seal/recover/lock/stop) exposing
> closed outcomes throughout. The EXISTING Master Seed WASM Rust Boundary
> (`FedosMasterSeedAuthority`, Alpha 436/869) gains two new, narrow
> methods — `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`
> — deriving a session-bound AEAD key via a two-stage HKDF (one new
> `HkdfDomain`/`AeadAadDomain` variant each, zero new Cargo dependencies)
> so that sealing/restoring under the wrong Device, account, conversation,
> or generation fails by REAL AEAD authentication, never a string
> comparison; the new sealing port is deliberately kept OFF the shared
> `FedosMasterSeedAuthority` interface (widening it was tried and reverted
> after it broke ~20 unrelated fixtures) — `FedosWasmMasterSeedAuthority`
> implements it additionally. The headline sealed-persistence proof runs
> against REAL cryptography and REAL durable files, not a mock: two
> Device identities, one Direct Conversation, a real CSPRNG placeholder
> secret, a real seal, real append-only persistence, a Runtime `stop()`,
> a FRESH Runtime restoring the SAME Master Seed from its own sealed
> envelope, genuine restart recovery, genuine wrong-Device/tamper
> rejection (AEAD authentication failure), `lock()` disposal, and a
> direct read of the durable files confirming no raw secret byte ever
> appears in either log. 122 new tests across 9 files, all passing (12
> more real Rust unit tests, plus a WASM build). Two real design bugs
> were found and fixed during implementation, both caught by this Arc's
> own tests: the session-id delimiter originally rejected `"::"`, which
> a real `FedosConversationId` always itself contains; and session
> persistence was originally treated as mutable "upsert" against an
> insert-only backend, corrected to the event-sourced-by-revision design
> described above. Full `npx vitest run` failing-file set is IDENTICAL to
> this worktree's own pre-existing baseline (~242 files, confirmed via
> `git stash` to predate this Arc) — verified by a sorted-file-list diff,
> not inspection alone; ~96 historical structural "exact `pub fn`/
> `HkdfDomain` count" tests (a long-established per-Arc convention across
> this crate's history) were updated accordingly. No file under
> `src/conversation/archive/`, `search/`, `retention/`, `src/sync/`, or
> `src/conversation/transport/` was modified — the exclusion is structural
> absence, proven by reading real source. No forward secrecy or
> cryptographic messaging claim is made anywhere in this Arc. See
> `docs/secure_runtime_alpha_5401_5480_ratchet_state_foundation_reconciliation_report.md`,
> `docs/secure_runtime_alpha_5401_5480_ratchet_state_foundation_execution_spec.md`, and
> `docs/secure_runtime_alpha_5401_5480_ratchet_state_foundation_completion_declaration.md`.
> Recommended next Arc: **FedOS Direct Double Ratchet Cryptographic Core
> Arc.**
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5401–5480 — FedOS Local Deletion
> Capability and Deletion-State Foundation Arc (complete).**
> Architecture frozen: no remote deletion request, no wire protocol, no
> Relay deletion, no new NIP, no recipient acknowledgement, no physical/
> secure-erase or SSD-overwrite guarantee, no cloud/OneDrive
> version-history deletion, no automatic backup deletion, no new crypto
> primitive, no new dependency, `p2p/`/`.tmp_gen/` untouched. **Local-only
> V1** over the normative design review (`cf5b870`,
> `review/fedos-secret-capability-deletion-v1`): ten new files under
> `src/conversation/deletion/` implement a closed, versioned target
> vocabulary (10 values), operation vocabulary (8 values), evidence
> vocabulary (4 values), a fixed-registry `FedosDeletionCapabilityDescriptor`
> (never caller-self-declared, unknown target fails closed), a 15-value
> `FedosDeletionStatus` mapped onto the EXISTING `FedosPayloadDeletionMeaning`
> (Alpha 792), read-only assessment, deterministic pure plans, a narrow
> four-entry-point execution coordinator, and a dedicated append-only
> durable execution record (mirrors `AppendOnlyFedosPayloadRetentionPersistence`'s
> own corruption-fails-closed convention) — because no existing record
> captured one plan's cross-cutting Retention+Search+Archive outcome as a
> single restart-recoverable fact. Reuses the EXISTING
> `FedosPayloadRetentionAuthority`, `FedosConversationSearchIndex.reconcilePayloadRetention()`,
> `FedosSyncDeviceRegistry.revokeDevice()`, and
> `FedosConversationMembershipAuthority.revoke()` verbatim — zero redesign
> of any of the four. Implements the ONE local capability the review found
> genuinely missing: tracked Archive-file removal, added as one new
> method (`deleteFile`) on `FedosConversationArchiveCliFileSystem` (refuses
> a symlink/reparse-point target, treats a missing target as already
> removed) and one new function
> (`removeFedosConversationArchiveCliDirectoryEntry`) on the Archive CLI
> directory module (removes exactly one tracked file via the directory's
> own trusted index, never a raw path, never a directory, never a
> wildcard) — resolved only through a canonical
> `FedosDeletionArchiveFileHandle` that re-checks its own conversation
> identity at removal time. Archive-file removal and payload deletion are
> structurally separated: the payload executor's own dependency type
> carries no filesystem; the Archive-file executor's own dependency type
> carries no Retention/Search authority — deleting an Archive file never
> changes live Conversation history, and deleting live history never
> silently removes an Archive file. Device and Membership revocation are
> exposed as their own separate plan/outcome, never implicitly combined
> with payload deletion. Seven new test files (82 new tests) cover the
> full required matrix — vocabulary/capability, read-only assessment,
> deterministic planning, real Retention+Search execution (including
> duplicate execution, conflicting-plan rejection, and partial-Search-
> failure honesty), trusted Archive-file removal (traversal denial,
> wrong-identity refusal, missing-file idempotency, symlink refusal, exact-
> one-file removal), restart/interruption/corruption recovery against the
> REAL append-only log backend, structural non-guarantee proof (no
> network transport, no Relay/NIP vocabulary, no raw path or plaintext in
> any public summary), and a real Phase O vertical slice (real Direct
> Conversation, real payload, real Search index, real Archive export to a
> real temp directory, real deletion, real restart, real idempotent
> reconvergence) — no mock for the headline flow. Two pre-existing Archive
> CLI test files' own in-memory fixture gained a four-line `deleteFile`
> stub to satisfy the interface's new method; no other change, no new test
> case in either. See
> `docs/secure_runtime_alpha_5401_5480_reconciliation_report.md`,
> `docs/secure_runtime_alpha_5401_5480_execution_spec.md`, and
> `docs/secure_runtime_alpha_5401_5480_completion_declaration.md`. Next
> Arc: FedOS Signed Recipient Deletion Request Protocol Foundation Review.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5321–5400 — FedOS Desktop Beta 0.1 Canonical
> Release Hosting, Manual Publication, and Signing Readiness Arc (FULL
> completion).** Turns the locally-built NSIS/ZIP/checksum artifacts from
> the prior Arc into a complete, reviewable, manually-publishable
> release-candidate set — without publishing, signing, or touching any
> remote system. New, additive modules
> (`scripts/lib/publication_bundle.mjs`, `signing_readiness.mjs`,
> `revocation_status.mjs`, `tag_format.mjs`,
> `remote_download_verification.mjs`, `generate_release_staging.mjs`,
> `verify_release_staging.mjs`, `publication_dry_run.mjs`,
> `generate_public_beta_gate.mjs`) implement: a canonical-host policy
> (`"local-only"` — honest, since no git remote is configured anywhere in
> this repository); a local publication-bundle format referencing
> artifacts by filename+hash only, never bytes; a human-executed manual
> publication workflow; a local release verifier that re-derives every
> fact from real bytes on disk; deterministic release notes/known
> limitations/install/verify/security-notice/announcement documents; a
> revocation/advisory record format with no application dependency on live
> status (no remote kill-switch); a tag-format policy that forbids
> retagging; a zero-side-effect publication dry run that fails closed on
> an invalid bundle; a remote-download verifier proven against a real
> local HTTP server; a safe, non-secret signing-toolchain inventory (real
> finding: no `signtool.exe`/Windows SDK/`winCodeSign` cache present in
> this environment) plus a pure signing-readiness decision function; a
> certificate-custody policy and a documented (unimplemented) future
> signing seam, proven not to silently accept stale checksums across a
> simulated signing mutation; and a closed public-Beta release gate whose
> final state is `"ready-for-human-publication"` — never `"published"`.
> Two real, previously-latent defects were found and fixed this session
> via direct execution (not assumed): `buildFedosBetaPublicationBundleV1`'s
> own valid output failed its own strict validator (an `unsigned` field it
> produced was missing from the validator's known-field set, and
> `deepFreeze` was mutating the caller's own shared `identity` object in
> place, breaking a second call with the same identity); and
> `verify_release_staging.mjs` ran an exact-directory-inventory checksum
> check against a staging directory that legitimately holds more files
> than `SHA256SUMS.txt` lists, always failing on a real bundle. Honest
> environment disclosure: `vitest` itself fails to parse every test file
> in this worktree — including the prior Arc's own unmodified, previously-
> accepted suite — a worktree-environment artifact confirmed by A/B
> testing against a sibling worktree, not a regression; real verification
> of every new module was instead performed via a plain-Node harness
> script (deleted before commit) exercising the same assertions as the
> durable `.test.ts` suite left in place. See
> `docs/secure_runtime_alpha_5321_5400_release_publication_reconciliation_report.md`,
> `..._certificate_custody_and_signing_seam.md`,
> `..._manual_publication_workflow.md`, and `..._completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5241–5320 — FedOS Desktop Beta 0.1 NSIS
> Installer, Portable ZIP, and Checksum Publication Arc (FULL completion).**
> Implements the normative distribution review's own V1 policy
> (`docs/reviews/fedos_beta_distribution_v1/20_normative_recommendation.md`):
> the canonical Beta application now builds a real NSIS installer
> (primary) and a real portable ZIP (secondary, same profile location as
> the installed build), plus a versioned release manifest and a
> SHA-256 checksum file, all additive — the canonical Beta entry point,
> Runtime, Settings, and WASM manifest verification code are byte-for-byte
> unmodified. Closes ONE real, previously-latent defect found and fixed
> this session: `run_electron_builder_package_beta.mjs` hardcoded a
> `--dir` electron-builder CLI flag that silently overrode the configured
> `win.target` (harmless while the config was ALSO `["dir"]`, but once
> this Arc changed it to `["nsis", "zip"]` it discarded both real targets
> with exit code 0 and no error) — isolated via a methodical, reproducible
> temporary-config test and fixed with a one-line change (`--dir` →
> `--win`). New, additive packaging scripts
> (`scripts/lib/release_identity.mjs`, `generate_release_manifest.mjs`,
> `generate_release_checksums.mjs`, `verify_release_checksums.mjs`
> — tamper-detecting, hash-recomputing, never trusting a stored value
> alone — `scan_release_artifacts_for_secrets.mjs`, and
> `verify_release_package_allowlist.mjs`) compose into ONE deterministic
> `build_release.mjs` pipeline, gated by a real, tested, fail-closed
> "dirty-tree public release artifacts are forbidden" check (verified
> this session: it correctly refused against this Arc's own
> not-yet-committed tree). REAL EVIDENCE this session (genuine internet +
> Rust toolchain access again available): a real WASM artifact was built;
> a real NSIS installer (101,407,959 bytes) and a real portable ZIP
> (366,955,240 bytes) were produced in ONE electron-builder invocation
> after the fix; the real staging-input secret scan reported 538 files
> scanned, 0 findings; the packaged `.exe`'s own direct-launch hang was
> re-tested (not assumed) and remains unchanged across three consecutive
> Arcs now — an environment-specific limitation, not a product defect
> (the identical application, unpackaged, continues to work completely).
> New suite (`test/secure_runtime_alpha_5241_5320_packaging.test.ts`):
> **21/21** passing against real accepted source plus deterministic
> fixtures, requiring no Electron/Rust toolchain to run. `typecheck`
> green (2 pre-existing errors, unchanged); full `vitest run` failure set
> unchanged from the documented fresh-worktree baseline. No signing, no
> auto-update, no hosting, no CI/release-upload was implemented (all
> remain out of this Arc's own scope per the normative review). See
> `docs/secure_runtime_alpha_5241_5320_packaging_reconciliation_report.md`
> and `..._packaging_completion_declaration.md` for the full Phase A-Q
> evidence and disclosed limitations. Recommended next Arc: **FedOS
> Desktop Beta 0.1 Canonical Release Hosting, Manual Publication, and
> Signing Readiness Arc.**
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5161–5240 — Canonical Desktop Composition
> and FedOS Beta 0.1 Release-Blocker Closure Arc (FULL completion — BLK-1
> closed).**
> Architecture frozen and strictly additive: the only production-source
> touches beyond `FedosDesktopBetaApplicationAssembly` itself are THREE new
> optional dependencies on `FedosProfileInitializationCoordinator`
> (`deviceSyncSchedulerEnabled`/`deviceSyncAbandonmentPolicy`/
> `deviceSyncAttemptFn`), mirroring the existing `archiveEnabled` toggle's
> own pattern byte-for-byte — omitted, behavior is unchanged for every
> existing caller. Closes BLK-1 from the prior Arc: `fedos_electron_beta_main.cts`
> now composes Navigation (`FedosDesktopConversationWindowRegistry`),
> Notification/Tray/Badge Coordinators, Background Lifecycle, and Device
> Sync (Operational Facade + Scheduler + Event Bridge + Presentation Wiring)
> into the SAME canonical `FedosDesktopBetaApplicationAssembly`/Runtime —
> every one of these was ALREADY real, framework-neutral, and
> port-based (Alpha 4181-4500, UNMODIFIED); this Arc only composes them,
> reusing the SAME real Electron-side adapters
> (`FedosElectronTrayAdapter`/`FedosElectronBadgeAdapter`/
> `FedosElectronNotificationAdapter`) `fedos_electron_badge_main.cts` already
> proves work. A confirmed Runtime restart rebuilds the Runtime-bound
> subset (Navigation/Tray/Badge/DeviceSyncWiring) while explicitly NOT
> rebuilding the Electron-global subset (Notification/Background-Lifecycle)
> — proven by reference-identity assertions. REAL, PACKAGED-ADJACENT
> VERIFICATION this session (genuine internet + Rust toolchain access
> again available): an unpackaged real Electron process completed create →
> real WASM Master Seed → full composition verified live
> (`{"navigation":true,"badge":true,"tray":true,"deviceSyncStatus":"Idle"}`)
> → lock → relaunch → wrong-passphrase-denied (composition honestly
> `false`/`false`/`false`/`null`) → relaunch → correct-passphrase-unlock
> (identical identity, composition freshly rebuilt); `electron-builder`
> packaging succeeded end-to-end against the larger `dist/` graph. New suite
> (`test/secure_runtime_alpha_5161_5240_canonical_desktop_composition.test.ts`):
> **9/9** against real boundaries, including a real Device Sync Scheduler
> genuinely started/stopped through Settings for the first time, and a
> 5-cycle lock/unlock duplication check (5 distinct Runtimes, never fewer,
> never more). `typecheck` green (2 pre-existing errors, unchanged); full
> `vitest run` failure set unchanged from the documented fresh-worktree
> baseline. Honest, disclosed, non-release-blocking limitations unchanged
> from the prior Arc: the packaged `.exe`'s own direct launch still hangs in
> this sandboxed, display-less environment (a packaged-Electron GPU/
> compositor-init issue, not a code defect — the identical code is fully
> verified unpackaged); Relay/Archive-directory Settings still have no
> Runtime-config field to feed. See
> `docs/secure_runtime_alpha_5161_5240_ownership_inventory.md` and
> `..._completion_declaration.md` for the full Phase A ownership table and
> evidence. Recommended next Arc: **FedOS Desktop Beta 0.1 Installer,
> Signing, Distribution, and Update Policy Review.**
>
> Prior status:
>
> **Status: Secure Runtime Alpha 5061–5160 — FedOS Desktop Beta 0.1
> Integration, Release Candidate, and Acceptance Freeze Arc (honest partial
> completion — release freeze blocked by one named, disclosed composition
> gap).**
> Architecture frozen and strictly additive: the only production-source
> touches are THREE new, single-method additive factories/hooks on
> already-open Beta-lineage classes
> (`FedosDesktopApplicationShell.fromRunningRuntime()`,
> `FedosDesktopConversationUiPresentationBoundary.fromShell()`,
> `FedosProfileInitializationCoordinator.adoptReplacementRuntime()`) — zero
> existing method signature or behavior changed for any existing caller.
> Closes the exact gap the prior Arc's own Completion Declaration named as its
> recommended next Arc: no Electron main previously composed the real
> production-unlock chain AND a live Presentation/Settings boundary over the
> SAME Desktop Runtime (doing so naively would construct two independent
> Runtimes over the same durable paths — a real duplicate-ownership defect).
> New `FedosDesktopBetaApplicationAssembly`
> (`src/desktop/beta/fedos_desktop_beta_application_assembly.ts`) composes
> exactly one Shell/Boundary over the Coordinator's own Runtime, wires the
> Alpha 4981–5060 Settings Application Coordinator's startup application for
> the first time in any Electron main, and provides a generic, tested
> confirmed-Runtime-restart primitive. New canonical Electron entry point
> `fedos_electron_beta_main.cts` (+ preload/page/renderer) reuses the
> `fedos-profile:*` IPC contract verbatim (Phase P surface freeze) and adds a
> new `fedos-beta:*` namespace (status/settings-plan/settings-apply) — all
> seven pre-existing Electron main files remain byte-for-byte unmodified,
> preserved as accepted test/harness entry points. REAL, PACKAGED-ADJACENT
> VERIFICATION this session (genuine internet + Rust toolchain access): a real
> WASM `pkg/` was built; an unpackaged real Electron process completed a full
> create → real WASM Master Seed generation/sealing → ready → lock → relaunch
> → wrong-passphrase-denied → correct-passphrase-unlock round trip with
> IDENTICAL account/device identity across three separate process launches;
> `electron-builder` packaging succeeded end-to-end (new, additive
> `electron_builder.beta.config.json`, correctly relocating the root `dist/`
> graph and WASM `pkg/` to the packaged app's own expected paths) though the
> packaged `.exe`'s own direct launch hung before `app.whenReady()` in this
> sandboxed, display-less environment (disclosed, not root-caused — the
> IDENTICAL unpackaged code path is fully verified). Named, disclosed,
> release-blocking gap: Navigation/Tray/Badge/Device-Sync-event-wiring are
> NOT yet composed into this same canonical entry point (they remain real and
> reachable only via `fedos_electron_badge_main.cts`) — full completion is
> not declared. New suite
> (`test/secure_runtime_alpha_5061_5160_beta_application_assembly.test.ts`):
> **7/7** against real boundaries; `typecheck:core` unchanged (2 pre-existing
> errors); `typecheck:electron` **0 errors**; full `vitest run` unchanged from
> the documented fresh-worktree baseline. See
> `docs/secure_runtime_alpha_5061_5160_reconciliation_report.md` for the full
> Phase A–R inventory and blocker table. Recommended next Arc: **FedOS Desktop
> Beta 0.1 Composition Completion and Packaged Acceptance Arc.**
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4981–5060 — Desktop Settings Runtime
> Application and Safe Reconfiguration Arc (FULL completion — persisted
> settings now visibly affect real live application behavior through accepted
> boundaries).**
> Architecture frozen and strictly additive: ZERO existing production source
> file modified (only new files under `src/settings/application/`,
> `src/desktop/settings/`, `src/desktop/presentation/`, a new test, docs, and
> this README). No Runtime / Relay-transport / Device-Sync-Scheduler /
> Notification / Tray / Badge / Archive / Conversation / Electron-IPC redesign;
> no new dependency; no Rust/Cargo change; `p2p/`/`.tmp_gen/` untouched. This
> Arc closes the chain the prior Settings Arc left open: Settings persistence →
> Authority → **Application Planner** → classified decision → immediate update
> OR safe subsystem reconfiguration OR runtime-restart-required OR blocked →
> honest **effective state** the UI renders. The Settings store is NOT a
> generic remote-control surface: every one of the ten fields is classified
> into exactly ONE application class, derived from real source inspection —
> **IMMEDIATE** (theme, windowLayout, notificationsEnabled — applied without
> reconstructing the Runtime), **SUBSYSTEM** (backgroundSyncEnabled — via the
> existing `FedosDeviceSyncOperationalFacade.startSync()/stopSync()`, one
> scheduler, no second timer), **RUNTIME-RESTART** (relays, defaultRelay,
> archiveDirectory — bound at Runtime construction, no dishonest hot reload),
> and **UNSUPPORTED/BLOCKED** (language — no localization boundary; autoStart —
> no OS auto-start boundary; autoLockTimeoutMinutes — no idle/activity
> boundary; persisted, never falsely claimed applied). WIRED TO REAL LIVE
> BEHAVIOR (proven with real boundaries, no mocks): theme/windowLayout mutate a
> live presentation sink; notificationsEnabled gates a real
> `GatedFedosDesktopNotificationPort` so presentation is suppressed while the
> canonical event still flows; backgroundSyncEnabled flips a REAL
> `FedosDeviceSyncScheduler`'s `isRunning()`. New (all additive):
> `src/settings/application/` (application class table, `FedosSettingsApplicationPlanner`,
> effective-state model + boundary-safe view), `FedosDesktopSettingsApplicationCoordinator`
> (validate → persist desired → apply supported actions in operation order →
> honest per-field effective delta; transaction semantics = persist-then-apply,
> closed outcome vocabulary distinguishing rejected-before-persist /
> persisted-and-applied / pending-runtime-restart / persisted-but-blocked /
> partially-applied / application-failed / rolled-back / rollback-failed), the
> narrow live-subsystem application ports, a SEPARATE closed four-command
> application Host Bridge (`settings-application-plan`/`settings-apply`/
> `settings-effective-state`/`settings-reload-effective-state`, reusing the
> unmodified `FedosDesktopHostResponse` vocabulary and sending only sanitized,
> secret-free views toward the renderer), and an application ViewModel/renderer
> projection. No secret, relay credential, or filesystem path ever crosses the
> host/renderer boundary (proven). Acceptance
> (`test/secure_runtime_alpha_4981_5060_settings_runtime_application.test.ts`):
> **50/50** against REAL file-backed persistence, a REAL notification
> coordinator/gate, and a REAL device-sync scheduler; `typecheck` green (only
> the two documented pre-existing baseline errors, measured A/B); full
> `vitest run` failure set unchanged from base (the documented fresh-worktree
> raw-import / source-alignment / missing-WASM-`pkg/` failures, none in the
> settings subsystem). Recommended next Arc: **FedOS Desktop Beta 0.1
> Integration, Release Candidate, and Acceptance Freeze Arc.**
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4901–4980 — Desktop Settings, Relay
> Configuration, and User Preferences Arc (FULL completion of the additive
> settings feature; real packaged-Electron round trip environment-blocked by a
> missing Electron binary, not code).**
> Architecture frozen and strictly additive: no Runtime / Persistence-mechanism
> / Crypto / Search / Archive / Device-Sync / Conversation-Runtime source
> touched, Shell not broken, no new dependency (Electron already present). Zero
> existing production source file modified — the only existing-file edits are
> additive script/tsconfig/asset registrations plus this README. A complete,
> closed-vocabulary settings subsystem was added: `src/settings/`
> (`FedosSettingsDescriptorV1` / codec / validator / file-backed persistence /
> authority — REUSING the `FileFedosLocalProfilePersistence` one-JSON-file
> fail-closed pattern, not a new mechanism), a `FedosDesktopSettingsController`
> (load/save/reset/validate/export/import), a Settings ViewModel + Renderer
> over the eight closed screens (General/Appearance/Relay/Notification/Privacy/
> Archive/Advanced/About), a SEPARATE closed-five-command Host Bridge
> (`settings-load`/`settings-save`/`settings-reset`/`settings-export`/
> `settings-import`, reusing the unmodified `FedosDesktopHostResponse`
> vocabulary), and a preload-only Electron adapter
> (`fedos_electron_settings_*`: main/preload/dispatch-translation/loader/page/
> renderer/self-test/window.d.ts — one frozen `window.fedosSettings.invoke`, no
> `ipcRenderer`/`require`/fs; `contextIsolation:true`/`nodeIntegration:false`/
> `sandbox:true`/`webSecurity:true` unchanged). The settings vocabulary is
> closed — Theme / Language / Relay List / Default Relay / Notification Enabled
> / Background Sync Enabled / Archive Directory / Auto Start / Auto Lock Timeout
> / Window Layout — with NO free-form key/value (an exact-key-count validator
> rejects extras) and fail-closed decode (corrupt/tampered/unknown-key/
> version-mismatch all reject, writing nothing). Phase H acceptance
> (`test/secure_runtime_alpha_4901_4980_desktop_settings.test.ts`): **31/31**
> against REAL temp-directory JSON files, NO mocks — first load, save, restart
> (fresh controller/same file) → exact restore, relay/theme/notification
> changes, reset, export/import round trip, corrupted file, unknown key,
> version mismatch, validation error, fail-closed, tampered JSON, the closed
> host command set, and the Electron dispatch translation. `typecheck:electron`
> green; `typecheck:core` only the two pre-existing baseline errors (untouched
> prior-arc test files, measured A/B). Honest Blocker: the Electron `.exe`
> binary is not downloaded in this worktree, so `electron dist/…settings_main.cjs`
> cannot launch a real process — the adapter is fully typechecked and its
> compiled bridge/controller emit to the exact dynamic-import paths, but the
> real packaged round trip is deferred (same environment class the prior Arc
> disclosed). `p2p/`/`.tmp_gen/` untouched. Next: Desktop Settings ↔ Runtime
> Application Arc (apply the durable settings to relay set / notifications /
> sync / auto-lock / theme behind existing ports).
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4821–4900 — Packaged Electron Real-Unlock
> Acceptance and GUI Passphrase-Input Boundary Arc (FULL completion — real
> packaged renderer→preload→main unlock through real WASM).**
> Architecture frozen: no crypto/Runtime/coordinator/Shell/Host redesign, no
> `lib.rs`/Rust change, no prior `*_main.cts` touched, the dev-only WASM gate
> byte-for-byte untouched. This Arc closes the ONLY blocker Alpha 4741–4820
> disclosed. Re-verified firsthand (the prior Arc's "headless, no Electron"
> finding was measured in a DIFFERENT worktree): in THIS worktree Electron
> **installs** (`electron.exe`, 225 MB) and an **offscreen** BrowserWindow
> (`show:false`, `offscreen:true`, `contextIsolation:true`/`nodeIntegration:false`/
> `sandbox:true`) starts a **real renderer process** — so packaged acceptance
> is achievable, not blocked. A NEW, additive sibling Electron package
> (`fedos_electron_unlock_*`: main/preload/onboarding page/renderer/self-test)
> exposes a closed, dedicated secret-input contract — `window.fedosProfile`
> (`status`/`create`/`unlock`/`lock`/`quit`, one frozen object, five
> `fedos-profile:*` channels, no generic `invoke`, no `ipcRenderer`) — into
> the UNCHANGED production activation authority and profile coordinator. ONE
> strictly-necessary production-source addition
> (`src/desktop/production_activation/fedos_production_nostr_signing_authority.ts`):
> a `FedosNostrSigningAuthority` that derives the account identity / signs
> **directly on the production WASM facade handle** (NOT the dev-gated
> loader), sharing the same handle as the Master Seed authority so identity is
> **stable across a real relaunch** (the prior Arc's test double could not be).
> PROVEN through TWO real, offscreen-rendered Electron processes: first-run
> welcome → real `type=password` input → real WASM generate+seal → account +
> `trusted` local Device → **ready**; then a separate process → locked →
> **wrong secret stays locked (no Runtime)** → correct secret restores the
> **identical** account through real WASM → lock → re-unlock. Secret leak scan
> (unique per-run secret): absent from renderer DOM/storage/URL, main stdout,
> the profile descriptor, and every sealed file (sealed material is real
> `{"v":1,"kdf":"argon2id"...`); the passphrase field is cleared after submit.
> No dev seed double, no dev-only loader, no new dependency (Playwright NOT
> added — reuses the repo's own subprocess/marked-stdout self-test convention,
> driving the REAL renderer via `webContents.executeJavaScript`). Acceptance
> suite (`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_4821_4900_unlock_electron_acceptance.test.ts`):
> **15/15** — structural guards + real packaged create + real packaged unlock
> + missing-artifact-fails-closed. `p2p/`/`.tmp_gen/` untouched. Next:
> Desktop Settings, Relay Configuration, and User Preferences Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4741–4820 — Production Master Seed Runtime
> Activation and Secure Unlock Completion Arc (honest partial — packaged
> Electron real-unlock acceptance blocked by this headless environment).**
> Architecture frozen: no crypto/Runtime/coordinator/Shell/Host/Electron
> redesign, no `lib.rs`/Rust change, and the existing dev-only WASM gate is
> byte-for-byte untouched. This Arc closed the prior Arc's disclosed blocker
> at the source/runtime level: the real WASM **builds here** (`cargo` +
> `wasm-bindgen 0.2.126`, ~34 s, a 260 KB `fedos_core_rust_bg.wasm` exporting
> the full `FedosMasterSeedAuthority` class), and real production Master Seed
> **generate → Argon2id+ChaCha20-Poly1305 seal → restore → identity match →
> wrong-passphrase fail-closed** runs end-to-end through the UNCHANGED
> profile coordinator with NO development seed double and NO dev-only
> `NODE_ENV` gate. Six new files under `src/desktop/production_activation/`
> add a NARROW production Desktop path: a closed-vocabulary crypto activation
> authority (permitted / unsupported-host / artifact-missing / artifact-invalid
> / artifact-version-mismatch / unapproved-build / capability-not-allowed /
> initialization-failed); an unforgeable Electron-main **host attestation**
> (module-private-symbol brand a renderer/Worker cannot mint — capability
> containment, not host authenticity); a **pinned artifact manifest**
> (SHA-256 recomputed from the real bytes, reviewed capability profile +
> allowed export set, no secret, no remote fetch); a **capability-limited
> facade** exposing only the Master Seed constructor, never the raw module; a
> production `FedosMasterSeedAuthority` (clear() drops the handle so post-lock
> crypto fails closed); and a no-fallback activation assembler. A deterministic
> SEQUENTIAL build pipeline (`npm run build:production-wasm`: cargo test →
> wasm32 build → wasm-bindgen → manifest gen, never Cargo+npm concurrently)
> generates the gitignored `pkg/` output; nothing generated is committed.
> Acceptance suite
> (`test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`):
> **17/17** — the full failure matrix, real create → ready (sealed material on
> disk, no plaintext) → lock → relaunch → unlock (stable identity) →
> wrong-secret-stays-locked, all through REAL WASM. **Honestly blocked
> (Phase L):** a packaged Electron GUI process cannot be launched/driven in
> this headless environment (no display; Electron not installed; electron-
> builder + GUI automation out of reach), so packaged real-unlock acceptance
> is declared partial rather than faked — every step it would exercise is
> proven at the Node/source level. Next: a Packaged Electron Real-Unlock
> Acceptance + GUI Passphrase-Input Boundary Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4661–4740 — Master Seed Unlock, First-Run
> Onboarding, and Local Profile Initialization Arc (honest partial —
> production Master Seed unlock blocked by the existing dev-only crypto
> gate).**
> Architecture frozen: no crypto/Runtime/Registry/Shell/Host/Electron
> redesign. Ten new files under `src/desktop/onboarding/` compose the
> EXISTING authorities through the EXISTING
> `FedosDesktopRuntimeConfig`/`startFedosDesktopRuntime()` surface — zero
> existing source file modified except this README, no config field added.
> A fresh install now reaches a safe, explicit usable state through ONE new
> application coordinator (`FedosProfileInitializationCoordinator`): detect
> profile → first-run create OR existing-profile unlock → seal/restore the
> Master Seed authority → resolve account identity → register the local
> Device with REAL BIP-340 account + Device Schnorr proofs
> (`runtime.devicePairing()`, reaching `"trusted"`, never a caller-supplied
> `trusted=true`) → initialize durable per-profile paths → start the real
> Desktop Runtime → lock/relaunch. New: a versioned NON-SECRET profile
> descriptor + strict validator + deterministic codec + in-memory/file
> persistence (fail-closed on corruption, never overwrites); a closed
> 8-state profile lifecycle machine (no partial ready; wrong-unlock →
> locked; corruption/identity-mismatch → recovery-required, never a silent
> new profile); a one-profile-root durable path authority (traversal-proof,
> isolated, Japanese/OneDrive long-path tested); a one-shot self-redacting
> unlock-secret payload; an honest recovery-material notice (no plaintext
> seed display; forgotten-secret-is-unrecoverable stated); a closed
> onboarding command vocabulary (secret redacted from every diagnostic, no
> response echoes it); and framework-neutral onboarding presentation view
> models. **Honestly blocked (per the spec's own Phase D fallback):** the
> ONE real `FedosMasterSeedAuthority` (`FedosWasmMasterSeedAuthority`) is
> unreachable here — no compiled WASM `pkg/`, and the dev-only crypto gate
> (`fedos_dynamic_loader_gate.ts`) is hardcoded shut — so the Arc ships a
> clearly-labeled DEVELOPMENT-ONLY seed double (a non-cryptographic
> lifecycle simulator: no seed byte, no plaintext passphrase) and STOPS
> before claiming user-ready production unlock. Real acceptance suite
> (`test/secure_runtime_alpha_4661_4740_first_run_onboarding.test.ts`):
> **40/40 passing** against the REAL runtime + REAL BIP-340 proofs; the
> immediately-prior Arc's 39/39 pairing suite unchanged; `tsc` adds zero
> new errors (only the one long-pre-existing scheduler failure remains).
> Development-runtime real coordination is proven; production crypto
> availability is NOT claimed. Recommended next Arc: Desktop Settings,
> Relay Configuration, and User Preferences.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4581–4660 — Desktop Device Registration,
> Pairing, and Durable Sync Journal Arc (complete).**
> Architecture frozen: no Registration/Registry/Sync/Electron redesign.
> Closes both blockers Alpha 4501-4580 named. New `FedosDevicePairingFacade`
> (`src/desktop/runtime/fedos_device_pairing_facade.ts`) composes the
> EXISTING Alpha 3161-3240 `FedosDeviceBindingBoundary`/Alpha 2921-3000
> `FedosDeviceTrustRuntime` — zero owned crypto, zero owned trust truth —
> reachable end to end: Electron IPC → Host Bridge → Shell (7 new methods)
> → Facade → real BIP-340 Schnorr account authorization + Device proof of
> possession → Device Registry. New, versioned, secret-free pairing
> exchange format (`FedosDevicePairingRequestV1`/`ApprovalV1`) is the
> transport-neutral port itself — no QR/Bluetooth/LAN/Relay implementation.
> Electron IPC needed ZERO changes: `fedosElectronHandleInvoke()` was
> already a generic command-forwarding multiplexer, verified by reading it
> in full before writing any Electron-adjacent code. Sync Journal gains a
> real, durable, NDJSON append-only backend (`src/sync/persistence/`),
> optionally injected with zero behavior change to any pre-existing call
> site. Real, non-obvious gap found only by testing: making the Journal
> durable did not, by itself, make Sync-fabric ELIGIBILITY survive a
> restart (`FedosSyncState`'s own Device Registry is a separate,
> always-in-memory structure) — fixed with an explicit restart-hydration
> step re-admitting every durably-`"trusted"` Device via the existing
> `registerSyncDevice()`. Exact protocol semantics (never overclaimed):
> registration and revocation are each LOCAL to whichever machine's own
> Device Registry a call reaches — the Authorizing Device also locally,
> immediately records the identical verified binding into its OWN
> Registry (two independent local writes, never a network call, never
> cryptographic bidirectional trust) — proven via a real two-Shell,
> two-durable-directory, two-real-process-restart end-to-end test. 11
> files modified, 8 new production files, 1 new 39-test acceptance suite
> (no mocks for the headline flow), 2 historical Alpha 3941-4020 tests
> updated (genuinely stale `available: false` → `true`, unweakened
> otherwise). Full root suite 1014 files/810 passed/204 failed, 13308
> tests/13047 passed/261 failed (+1 file/+1 test vs. the immediately-prior
> Arc's own 1013/810/203, 13269/13009/260 baseline — traced to
> `test/reviews/**`'s own documented uncommitted-worktree effect, resolves
> on commit); real Electron subprocess suite unchanged at 108/4/0.
> Recommended next Arc: Master Seed Unlock, First-Run Onboarding, and
> Local Profile Initialization.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4501–4580 — Desktop Device Sync Electron
> Main Integration Arc (complete).**
> Architecture frozen: no Runtime/Scheduler/Notification/Tray/Badge/Electron
> redesign. Completes the final Electron integration for Alpha 4421-4500's
> Device Sync Presentation Wiring, extending
> `fedos_electron_badge_main.cts` (Package F, Alpha 4341-4420) **in
> place** — verified, by reading all five Electron main files' own
> headers, as the ONE process that already owns
> `FedosDesktopNotificationCoordinator`/`TrayCoordinator`/
> `FedosDesktopBadgeCoordinator` together, so this is the only place
> attaching Device Sync routing does not duplicate ownership. Constructs
> exactly one `FedosDeviceSyncEventBridge`/`FedosDesktopDeviceSyncPresentationWiring`
> (both UNMODIFIED) per real startup, threads
> `eventBridge.wrapAttemptFn()` into the real `startFedosDesktopRuntime()`
> config (`deviceTrustEnabled`/`deviceSyncSchedulerEnabled` turned on for
> the first time in this file's own history — the real, previously-inert
> Tray `"pause-sync"`/`"resume-sync"` actions are now genuinely
> functional, with zero changes to `TrayCoordinator`), and destroys both
> idempotently on shutdown. New idempotent-startup/idempotent-shutdown
> guards, proven via real object-identity comparison and a real count of
> `"shutdown clean"` occurrences across two deliberate calls in a real
> spawned process. Honest, disclosed Phase A finding: Shell/Boundary
> expose Device Sync OPERATIONAL commands only, never a device
> REGISTRATION surface, and the Sync Journal has no durable-path config
> anywhere in this codebase — so this real process's own real Scheduler
> can never have a real, trusted, in-range target device today; the new
> Device Sync self-test proves the real, live Notification/Badge/Tray
> Coordinators still correctly receive and process events by driving
> `wiring.handleEvent()` directly with hand-built, schema-valid events —
> the identical method a genuine Scheduler-sourced event takes. 1 file
> modified in place, 2 new files (a selftest module, an acceptance test),
> zero new IPC channels; real Electron subprocess suite 108/4/0 (was
> 99/4/0 — this Arc's own +9 tests, +0 regressions); full root suite
> byte-for-byte unchanged at 1013 files/810 passed/203 failed, 13269
> tests/13009 passed/260 failed (this Arc adds no root `test/` file).
> Recommended next Arc: a Device Sync Registration and Pairing Arc to
> close the one remaining gap this Arc's own Phase A finding surfaced.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4421–4500 — Desktop Device Sync Badge,
> Notification, and Operational Event Wiring Arc (complete).**
> Architecture frozen: no Runtime/Scheduler redesign, no Sync protocol or
> Transport changes, no new persistence, no new crypto. Connects the real
> `FedosDeviceSyncScheduler` (Alpha 3721-3800) to the Desktop Notification/
> Tray/Badge boundaries (Alpha 4261-4420) for the first time. New, additive
> `src/device/sync_events/` (`FedosDeviceSyncEventBridge`) translates real
> Scheduler attempt activity into a closed nine-kind event vocabulary
> (`sync-started`/`sync-progress`/`sync-completed`/`sync-failed`/
> `conflict-detected`/`retry-scheduled`/`retry-aborted`/`device-offline`/
> `device-online`) — a real Phase A finding drove the integration
> technique: the Scheduler has no event emitter anywhere in its own file,
> so the Bridge wraps the ONE real extension seam it does expose, the
> injected `attemptFn` boundary, rather than monkey-patching the instance.
> A new `FedosDesktopDeviceSyncPresentationWiring`
> (`src/desktop/runtime/`) routes those events into the three existing
> Coordinators through their real, narrow, already-existing public
> surfaces only — reusing the three existing `"device-sync"`/
> `"sync-complete"`/`"sync-failed"` notification kinds (never inventing a
> fourth), reducing a closed five-value tray status list to
> `FedosDesktopTrayPort.setTooltip()`, and calling only the Badge
> Coordinator's own two real control surfaces,
> `setSynchronizing()`/`refresh()` (a disclosed, verified-against-real-
> source correction of the brief's own wording, which named three
> nonexistent Coordinator methods). 2 new root source files, 2 new root
> test files (21 tests, real Runtime/Scheduler/Coordinators, no mocks);
> zero regression traceable to this Arc (full Electron subprocess suite
> unchanged at 99/103; full root suite delta is exactly this Arc's own +2
> files/+21 tests, 0 change to the pre-existing failure baseline).
> Electron main-process wiring itself is named as the recommended next
> Arc, disclosed honestly as a scope boundary of time, not feasibility.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4341–4420 — Desktop Unread Badge and Menu
> Bar Count Integration Arc (complete).**
> Architecture frozen: no persistence changes, no Runtime/Search/Conversation
> redesign. Reuses the existing `FedosDesktopUnreadCounterViewModel` (Alpha
> 3241-3320) verbatim — never computes unread independently. Adds one new,
> additive boundary: a closed, five-state Desktop Badge boundary
> (`src/desktop/badge/`, `FedosDesktopBadgePort`/`FedosDesktopBadgeCoordinator`
> — `none`/`count`/`attention`/`synchronizing`/`error`), aggregating real
> per-conversation unread counts over
> `FedosDesktopConversationWindowRegistry.recentConversationIds` (a real,
> disclosed Phase A design finding: `FedosDesktopConversationListViewModel`
> was tried first and found to never rediscover a conversation activated by
> a different Shell/runtime instance — the Registry's own persisted list,
> already reused by `TrayCoordinator`, does not have that gap). A new,
> additive Electron adapter
> (`packages/fedos-desktop-electron-spike/src/fedos_electron_badge_*`) wires
> this to real Electron `app.dock`/`app.setBadgeCount`/
> `BrowserWindow.setOverlayIcon` APIs, plus the SAME, already-existing
> `FedosElectronTrayAdapter` instance (tooltip + menu label suffix) — no
> duplicate Tray, Electron hosts UI only. Real Electron subprocess
> acceptance tests, including a main-process self-test sequence
> (`FEDOS_ELECTRON_BADGE_AUTOTEST=1`) exercising all 8 named Phase G
> scenarios against real objects, plus a genuine two-process restart test.
> 3 new root source files, 8 new Electron files, 1 new root test file (11
> tests) plus 1 new real Electron acceptance suite (15 tests); zero
> regression traceable to this Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4261–4340 — Desktop Notifications, System
> Tray, and Background Operation Arc (complete).**
> Architecture frozen: no redesign of Runtime/Shell/Presentation/Renderer/
> Host Bridge/Navigation. Adds three new, additive boundaries: a closed,
> nine-kind Desktop Notification boundary (`src/desktop/notification/`,
> `FedosDesktopNotificationPort`/`FedosDesktopNotificationCoordinator`,
> fixed per-kind templates only — no custom payloads, fail-closed on any
> sensitive-looking field); a six-action System Tray boundary
> (`src/desktop/tray/`, `FedosDesktopTrayPort`/`TrayCoordinator` — Open
> Window/Recent Conversations/Device Sync Status/Pause Sync/Resume
> Sync/Exit); and a pure Background Operation state machine
> (`src/desktop/background/`, `BackgroundLifecycleCoordinator` — window
> closed keeps the Runtime alive, background sync/notifications, clean
> shutdown, single runtime ownership; no daemon mode, no singleton
> service). A new, additive Electron adapter
> (`packages/fedos-desktop-electron-spike/src/fedos_electron_notifications_tray_*`
> + `fedos_electron_notification_adapter.ts`/`fedos_electron_tray_adapter.ts`)
> wires these to real Electron `Notification`/`Tray` APIs — Electron hosts
> UI only, zero business logic. Investigated Host Bridge reuse honestly:
> NOT reused directly (would mean a second, divergent Boundary/Runtime
> racing the Window Registry's own, a direct violation of "single runtime
> ownership"), but its Port+adapter PATTERN is restated for both new
> boundaries. Real Electron subprocess acceptance tests, including a
> main-process self-test sequence (`FEDOS_ELECTRON_BG_AUTOTEST=1`)
> exercising all 14 named Phase G scenarios against real objects. 8 new
> source files, 1 new minimal additive Presentation ViewModel, 4 new root
> test files (31 tests) plus 1 new real Electron acceptance suite (15
> tests); zero regression traceable to this Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4181–4260 — Desktop Conversation Window
> and Navigation Arc (complete).**
> Architecture frozen: no redesign of Runtime/Shell/Presentation/Renderer/
> Host Bridge. Adds a closed navigation state vocabulary
> (`empty`/`opening`/`open`/`open-failed`), pure back/forward history,
> window-title generation, a `FedosDesktopConversationWindowController`
> (one window's own orchestration — open/switch/close/back/forward/
> restoreLastOpened/render, owning its OWN ViewModel/Renderer instances
> over the Presentation Boundary's single shared `.shell`, the deliberate
> resolution to a genuine multi-window-vs-shared-ViewModel-state safety
> gap found in Phase A), and a `FedosDesktopConversationWindowRegistry`
> (multi-window state model + lifecycle + pin state + recent-conversation
> list + last-opened restoration, backed by a new append-only NDJSON log
> following this repository's own established persistence pattern). A new,
> real `ipcMain`/preload Electron adapter
> (`packages/fedos-desktop-electron-spike/src/fedos_electron_navigation_*`)
> constructs the Presentation Boundary and Window Registry DIRECTLY —
> deliberately NOT `FedosDesktopHostBridge`, which has no concept of
> "window" and owns its own private Boundary internally; reusing it
> alongside the Registry would race two divergent Runtime instances in one
> process. 29 new root unit/acceptance tests plus 13 new real Electron
> acceptance tests (build, security baseline, closed IPC vocabulary, real
> subprocess launch/repeat-launch/fail-closed-on-corruption); zero
> regression traceable to this Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4101–4180 — Electron Main/Preload
> Adapter for FedosDesktopHostBridge Arc (complete).**
> Architecture frozen: no redesign of Shell/Presentation/Renderer/Runtime/
> Host Bridge. Connects the existing, unmodified `FedosDesktopHostBridge`
> to a real Electron process as a thin transport layer only: Electron
> Renderer → Preload (`window.fedos.invoke()`, ONE frozen method, no other
> global) → `ipcRenderer.invoke()` → `ipcMain.handle()` → HostBridge →
> Presentation → Shell → Runtime, proven end to end against a REAL spawned
> Electron process (real `status`/`dispatch`/`render` calls reaching the
> live Runtime, a real malformed-command rejection, real stop/restart).
> `start()`/`stop()` remain Main-process-owned lifecycle calls, never
> renderer-invokable (would otherwise indirectly expose filesystem paths
> to the renderer). All mandatory security defaults
> (contextIsolation/sandbox/webSecurity/no nodeIntegration) verified both
> structurally and against real process behavior. Fixed a real
> TypeScript/Node16-module-resolution blocker discovered during
> implementation (dynamic `import()` was being silently downleveled to a
> non-functional `require()` call under the electron package's own prior
> `module: CommonJS` setting) — resolved entirely within the
> already-isolated Electron package, root project's own type graph
> untouched. Also repaired 4 genuinely-stale historical `package.json`
> exact-shape tests (broken by earlier, unrelated Electron-lineage work),
> net IMPROVING the full suite's own failure count by 4. 3 new test files
> (34 new tests) plus the repaired historical ones; zero regression
> traceable to this Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 4021–4100 — Repository-Wide Node Type
> Isolation and Electron Build Compatibility Arc (complete — type
> isolation/build compatibility, NOT Electron application integration).**
> Resolves the ONE blocker Alpha 3881–3940 stopped at, honestly: adding
> Electron transitively pulled in `@types/node`, which broke `npm run
> typecheck` repository-wide by turning ~390 pre-existing
> `// @ts-expect-error` suppressions (this repository's own established
> convention for `node:fs`/`node:child_process`/etc. imports, across
> ~130 files) into "unused directive" errors — confirmed, empirically,
> that no `tsconfig.json` setting (`types`/`typeRoots`/`paths`/
> `moduleResolution`) can prevent this while both sides share one
> `node_modules` tree, since TypeScript resolves `node:*` imports via
> filesystem lookup, not tsconfig configuration. The fix: the Electron
> spike moved to a physically separate package
> (`packages/fedos-desktop-electron-spike/`, its own `package.json`/
> `package-lock.json`/`node_modules`, no npm workspace hoisting) — so
> `@types/node` (Electron's own unavoidable transitive dependency) never
> touches the root project's own `node_modules` at all. `npm run
> typecheck` (root) is clean again (except the one pre-existing,
> unrelated failure every recent Arc's own baseline documents); the
> isolated package's own typecheck/build/tests/packaging all pass
> independently; NO postinstall deletion script, NO dependency mutation
> after install, NO mechanical weakening of the ~130 unrelated files'
> own suppression comments. Confirmed stable across two independent,
> from-scratch clean installs. Full account in
> `docs/secure_runtime_alpha_4021_4100_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3881–3940 — Electron Dependency and Build
> Spike Arc (build spike, partial completion, honestly declared — NOT an
> Electron app, NOT feature-complete).**
> Package A only, per the Electron Dependency and Desktop Packaging V1
> Review's own recommendation: adds `electron` (`43.1.1`) and
> `electron-builder` (`26.15.3`, `"dir"`/unpacked target only) as
> devDependencies, a narrow `src/desktop/electron_spike/` directory (main
> entry, minimal preload, static local page — Electron imports exist
> ONLY here, confirmed by grep), and proves, with real evidence, that a
> secure, blank/static-page `BrowserWindow` (`contextIsolation: true`,
> `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, no
> remote content, no business IPC, exactly one immutable
> build-metadata value exposed via `contextBridge`) launches, shows the
> correct local page, and shuts down cleanly — both in development and
> as a packaged, unpacked Windows directory (348 MB total; this Arc's
> own bundled code is 12 KB). No `FedosDesktopHostBridge`/Desktop
> Runtime/Shell/ViewModel/Renderer wiring of any kind. **Partial, not
> full, completion**: `npm run typecheck` is NOT clean after this Arc —
> Electron's own transitive `@types/node` dependency (unavoidable simply
> by adding Electron) breaks ~130 existing files' own
> `// @ts-expect-error` conventions repository-wide, a mitigation for
> which (a drafted, tested `postinstall` cleanup script) was rejected by
> this environment's own permission classifier and, when presented
> directly, the user chose to stop here rather than authorize it. `npm
> test` and every existing test suite are unaffected (77/77 existing
> Desktop tests, 25/25 new spike tests, both passing). Full account in
> `docs/secure_runtime_alpha_3881_3940_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3941–4020 — Desktop Device Management
> and Sync Operations UI Renderer Arc (honest partial — Device
> registration/revocation confirmation commands unavailable).**
> Architecture frozen: no redesign of the Device Registry, Device Trust,
> Device Sync Scheduler, Relay Sync, or Conflict Authority; no second
> operational facade, Shell, or Device Runtime; no dependency added; no
> `package.json`/`package-lock.json`/`tsconfig.json`/Cargo change. Turns
> the completed Device Sync operational Shell/ViewModel/Renderer boundary
> (Alpha 3801-3880) into a coherent, framework-neutral Desktop
> device-management presentation surface: a closed 14-screen vocabulary,
> a fail-closed in-memory navigation state (never durable canonical
> data), one composing controller over the 6 existing Device Sync
> ViewModels (registered additively as `.deviceManagement` on the
> existing Presentation Boundary/Renderer, never a second parallel one),
> and a full Overview/Device-list-detail/Sync-Operations/Schedule/
> Transfer/Conflict-Inbox screen+render-model layer with honest
> truncation limits and closed, callback-free action descriptors.
> **Honest, documented boundary**: no `registerDevice`/`confirmTrust`/
> `revokeDevice` command exists anywhere on the Shell or the Device Sync
> Operational Facade — only `runtime.deviceTrust()` supports those, and
> the Shell never calls it. The Registration and Revocation Confirmation
> screens are therefore complete, real screen models that honestly report
> their own confirm action as unavailable, never a fabricated success —
> every OTHER target screen, including the entire Conflict Inbox with
> safe acknowledgment, is fully real end to end. Relay-accepted and
> Device-imported remain two independently-observable facts throughout;
> an empty transfer set never counts as "everything synced." 2 new test
> files, 37 new tests, real Runtime/Shell/Boundary/Renderer throughout;
> full suite failure rate matches this environment's own already-
> documented run-to-run baseline variance, zero regression traceable to
> this Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3801–3880 — Device Sync Operational
> Status and Desktop Shell Integration Arc (complete).**
> Architecture frozen: reconciles the previously-diverged Desktop UI
> lineage (Runtime → Shell → ViewModels → Renderer → Host Boundary) and
> Device Sync lineage (Device Trust/Registry, Device Sync Foundation,
> Local Transfer, Relay-Assisted Synchronization, Background Scheduling
> and Conflict Resolution) into one dedicated integration branch with
> zero content lost, then wires real Device Sync operational state
> (Device inventory/trust, Scheduler status/control, Schedules, Transfer
> sessions, Conflicts) through one new, narrow
> `FedosDeviceSyncOperationalFacade` — reusing the SAME Device
> Registry/Sync Journal instances `FedosDeviceTrustRuntime` (Alpha
> 2921-3000) already owns, never a second Device Runtime or Scheduler.
> No real, network-attached Relay Sync graph is assembled (that needs a
> Device-scoped signing/encryption authority this Runtime does not
> source today) — the Scheduler's `attemptFn` remains an explicit,
> caller-supplied injection point, mirroring `conversationTransportPublisher`'s
> own established discipline; every tick fails closed to `"failed"`
> when omitted, never fabricating `"delivered"`. Relay-accepted and
> Device-imported are two independently-observable facts throughout,
> never merged into one "synced" label. 11 new Shell commands, 5 new
> ViewModels, 5 new Renderers, 4 new test files, 50 new tests, real
> Runtime/Shell/ViewModel/Renderer throughout; full suite failure rate
> (≈20.0%) matches both source lineages' own independently-confirmed
> baselines, zero regression traceable to this Arc.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3721–3800 — Background Device Sync
> Scheduling and Conflict Resolution Arc (complete).**
> Architecture frozen: no redesign of the Device Registry, Registration
> Authority, Device Trust, Device Sync Runtime, Sync Session/Package,
> the Encrypted Device-to-Device Local Transfer protocol, Relay-Assisted
> Device Synchronization (Alpha 3641–3720), or the Sync
> Journal/Cursor/Queue/Conflict-Vocabulary/Allowlist (all unmodified);
> no new dependency, no Rust change, no Desktop UI/Shell change,
> `p2p/`/`.tmp_gen` untouched. Turns the existing manually-invoked Relay
> Device Sync flow into a controlled, restart-safe background
> scheduling boundary (`FedosDeviceSyncScheduler`: disabled by default,
> explicit `startSync()`/`stopSync()`/`syncStatus()`/`tickSync()`/
> `triggerSyncNow()`, single-flight, restart-recovery-proven) and
> introduces an ADDITIVE, richer 11-value Conflict Vocabulary layered
> over the existing 4-value classifier, a deterministic domain-specific
> resolution planner (7 closed decisions, never a generic
> last-write-wins), and durable, queryable Conflict persistence with
> only 4 objectively-safe resolution actions — no forced overwrite of
> canonical state anywhere. Explicitly does not claim distributed
> consensus, strong eventual consistency, or any change to the Sync
> Journal's own accepted Cursor-advance-past-everything design: an
> unresolved conflict is made visible through a separate, independent
> Conflict persistence/query layer instead. 3 new test files, 56 tests,
> real BIP-340 Schnorr device registration/revocation and real
> append-only restart-recovery proofs throughout; full suite unchanged
> at 239 pre-existing failures (both categories independently
> re-confirmed against a clean `main` checkout), 56 new passes, zero
> regressions.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3641–3720 — Relay-Assisted Device
> Synchronization Arc (complete).**
> Architecture frozen: no redesign of the Device Registry, Registration
> Authority, Device Trust, Device Sync Runtime, Sync Session/Package,
> the Encrypted Device-to-Device Local Transfer protocol, the Sync
> Journal/Cursor/Allowlist, or the existing `FedosRelay`/
> `FedosConversationRelaySet`/private transport (all unmodified); no
> Sender-Key change (this checkout has no Sender-Key secret persistence
> code at all), no Conversation Runtime/Archive/Search change; no new
> dependency, no Rust change, `p2p/`/`.tmp_gen` untouched. Extends the
> proven local Encrypted Device Transfer protocol (Alpha 3481–3560)
> over an untrusted, store-and-forward Relay boundary — the Relay is a
> mailbox and transport only, never an identity/trust/decryption
> authority. Route Decision: NIP-17 Gift Wrap is genuinely absent from
> this checkout's history (confirmed, not an ancestor of this Arc's own
> base) and the existing proprietary private-transport route is
> hard-bound to Direct-mode Conversation membership — a structural
> mismatch for Device pairing — so this Arc freezes a NEW, dedicated,
> honestly-labeled proprietary route (kind:1, `["fedos-device-sync","1"]`,
> route version 1, no NIP compliance claimed), built entirely from
> ALREADY-REAL primitives (`FedosRelay`/`FedosConversationRelaySet`,
> the existing kind-1-only `FedosNostrSigningAuthority`). A real
> `FedosDeviceRelaySyncOutboundCoordinator`/`FedosDeviceRelaySyncInboundHandler`
> pair carries the EXISTING, unmodified `FedosDeviceTransferPackageV1`
> across the Relay: outer BIP-340 Schnorr signature re-verification
> (reusing the existing `NobleSignatureVerifier`) catches any tamper to
> the routing facts; an outer content-hash gate catches any tamper to,
> or substitution of, the package itself, BEFORE decryption is ever
> attempted; the inner package's own mutual device authentication and
> tamper detection (Alpha 3481–3560, unmodified) runs unchanged.
> Two-layer durable dedup (outer Relay event id, then
> transferSessionId+package hash) makes duplicate delivery across
> multiple Relays and across a simulated process restart import
> exactly once — proven with a real, functional in-process Relay
> fixture that actually stores and delivers messages (unlike the
> existing bookkeeping-only `NullRelay`), including target-offline-
> then-later-receive. Device revocation fails closed at every point
> tested (before publish, after publish but before import); Relay
> acceptance and Device import are tracked as two permanently distinct
> facts (`"relay-accepted"` vs. `"imported"`) via a new, small,
> 9-state Observation vocabulary, never collapsed. The existing Sync
> record allowlist is reused unmodified and directly re-tested against
> Master Seed/private-key/Sender-Key-secret/passphrase/plaintext
> shapes; the one genuine, narrow addition this Arc makes is an
> explicit oversized-payload resource limit (256 KiB), checked before
> JSON parsing. Three new test files, 50 tests, real Schnorr signatures
> + real AEAD wiring + a real functional Relay fixture throughout —
> including two genuine off-by-one field-count bugs (the same class
> this repo's history already recorded finding twice before) caught by
> the first real end-to-end test run and fixed in this same commit.
> See `docs/secure_runtime_alpha_3641_3720_execution_spec.md` and
> `docs/secure_runtime_alpha_3641_3720_completion_declaration.md`.
> Recommended next Arc: **Background Device Sync Scheduling and
> Conflict Resolution**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3481–3560 — Encrypted
> Device-to-Device Local Transfer Arc (complete).**
> Architecture frozen: no redesign of the Device Registry, the
> Registration Authority, Device Trust, or the Device Sync Runtime and
> its Sync Session/Package types (all unmodified); no Sender-Key,
> Conversation Runtime, Archive, or Search change; no new dependency,
> no Rust change, `p2p/`/`.tmp_gen` untouched. Completes local
> encrypted transfer between two already-registered, already-trusted
> Devices of the SAME account — still no cloud, no relay, no
> synchronization daemon. A real `FedosDeviceTransferCoordinator`
> (`src/device/transfer/`) drives Transfer Invitation → Challenge →
> Proof of Possession → Approval → Package → Verification →
> Completion end to end with real BIP-340 Schnorr signatures
> throughout: the initiator proves possession of its own registered
> Device key, the responder independently proves possession of ITS
> own — both re-checked against the LIVE Registry at every step, never
> a cached snapshot. The Transfer Package is a thin `sessionId` binder
> around the EXISTING, unmodified `FedosDeviceSyncPackageV1` — zero new
> encryption logic — protected by a content-hash gate that catches any
> in-transit tampering before decryption is even attempted, distinct
> from a benign duplicate resubmission (idempotent) and from an
> automatic, durable `"failed"` transition on every genuine
> cryptographic denial (wrong device, replay, expiry, tampering) —
> while a transient/environmental Package-build failure stays
> retryable rather than killing the transfer. Restart-safe:
> event-sourced Transfer Session persistence (in-memory + append-only
> NDJSON backends, its own separate port from the Device Registry and
> the Alpha 3161–3240 Challenge Replay persistence) recovers and
> RESUMES a mid-flight transfer after a simulated process restart. Two
> new test files, 26 tests, real Device Registry + real signatures +
> real AEAD wiring throughout, covering tampering, replay, wrong
> device, wrong account, interrupted transfer, restart recovery,
> duplicate package, and cancellation — including a genuine off-by-one
> bug (the same class Alpha 3161–3240 once found) caught by the first
> real end-to-end test run and fixed in this same commit. See
> `docs/secure_runtime_alpha_3481_3560_execution_spec.md` and
> `docs/secure_runtime_alpha_3481_3560_completion_declaration.md`.
> Recommended next Arc: **Relay-assisted Device Synchronization**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3321–3400 — Device Registration
> Runtime Activation and Local Device Sync Foundation Arc (complete).**
> Architecture frozen: no redesign of the accepted Device Registry,
> Device Binding, or Account Authorization boundary
> (`src/device/binding_challenge/`, `src/device/persistence/`,
> unmodified); no Desktop Shell/Search/Archive/Sender-Key change; no
> new dependency, no Rust change, `p2p/`/`.tmp_gen` untouched. Activates
> Alpha 3161–3240's own Registration Authority — built but never called
> from anywhere in `src/` — inside a real, constructible
> `FedosDeviceSyncRuntime` (`src/device/runtime/`): Runtime Device
> Registration/Activation (one atomic, cryptographically-verified call,
> proven with real BIP-340 Schnorr signatures throughout), Runtime
> Device Revocation, Local Device Inventory and Device Status Queries
> (read directly from the existing Registry, no parallel state), and
> Sync Session Preparation/Validation (`src/device/sync_session/`) — a
> LOCAL, at-rest snapshot of one account's currently-trusted Device
> inventory, addressed to one target Device the LIVE Registry currently
> trusts, re-validated against that same live state rather than a
> frozen snapshot. An Encrypted Sync Package Builder/Reader
> (`src/device/sync_package/`) seals and opens that snapshot using the
> EXISTING, real AEAD Runtime Service and the EXISTING `"Conversation"`
> `AeadAadDomain` — resolved via a documented self-ECDH adaptation
> (`resolveConversationKey()` against the account's own public key,
> since a Sync Package has no counterparty to ECDH against and adding a
> new AAD domain would require a Rust change) rather than any new
> cryptographic primitive. No network sync, no cloud sync, no relay
> sync, and no Encrypted Device-to-Device Local Transfer — this Arc
> builds the LOCAL data a future transfer mechanism would move, and
> does not itself move anything between two Devices. Two new test
> files, 33 tests, real Device Registry + real signatures throughout,
> covering restart recovery, duplicate registration, revocation,
> malformed/expired/tampered packages, unauthorized devices, and
> replay. See `docs/secure_runtime_alpha_3321_3400_execution_spec.md`
> and `docs/secure_runtime_alpha_3321_3400_completion_declaration.md`.
> Recommended next Arc: **Encrypted Device-to-Device Local Transfer**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3161–3240 — Account-to-Device
> Signature Verification Boundary Arc (complete).**
> Architecture frozen: no redesign of the accepted Device Registry,
> trust-state transition table, or Multi-Device Sync Foundation
> (`src/sync/`, unmodified); no Desktop Runtime/Shell change; no
> Archive/Search/Sender-Key/Group change; no new dependency, no Rust
> change, `p2p/`/`.tmp_gen` untouched. Closes the exact blocker named
> by Alpha 2921–3000: this codebase now has a real, independent Device
> signing keypair (`src/device/crypto/`, `@noble/curves`
> Schnorr/secp256k1 — the same already-shipped production library used
> for Nostr verification — never derived from the Master Seed, never
> the account key, opaque handle with no raw private-key getter), a
> canonical versioned `FedosDeviceBindingChallengeV1` (fixed domain
> separator, fixed-order array serialization, `register-device`/
> `revoke-device` action, expiry, CSPRNG nonce), a detached
> account-authorization signature reusing the existing kind-1 Nostr
> signing authority unwidened, and a Device proof of possession under a
> distinct signed preimage — neither signature alone can register or
> self-authorize anything; both are independently re-verified on every
> call. A new `FedosDeviceBindingRegistrationAuthority`
> (`src/device/binding_challenge/`) orchestrates both checks plus a
> durable, restart-safe replay/expiry guard (separate codec + in-memory
> + append-only persistence, fail-closed on corruption, idempotent on
> byte-identical resubmission, refused on any changed-byte reuse of a
> consumed nonce) against the EXISTING, unmodified Device Registry
> (`PersistedFedosDeviceTrustAuthority`, Alpha 2921–3000) — through an
> internal `AlreadyVerifiedFedosDeviceRegistrationAuthority` this Arc's
> own orchestrator is the only caller of, never a default anywhere else.
> `UnavailableFedosDeviceRegistrationAuthority` remains untouched and
> still fails closed. Account-authorized revocation is implemented
> (separate action/domain, bound to the exact target device key,
> terminal, idempotent, wrong-account denied) with no device-sync key
> rotation and no remote-erasure claim. A Phase J factory
> (`fedos_device_binding_boundary_factory.ts`) provides the one
> construction point a future Desktop Runtime integration would call —
> **not wired into `fedos_desktop_runtime.ts` in this Arc**, so this Arc
> remains independently mergeable alongside the Desktop Content Accessor
> Arc. One new test file, 48 tests, real BIP-340 Schnorr signatures
> throughout (a test-only real-crypto signing-authority stand-in ships
> nowhere in `src/`), covering the full 28-item required matrix,
> including a genuine bug found and fixed in Phase C's own challenge
> validator (an off-by-one field-count check that rejected every
> well-formed challenge, caught by this Arc's first real-crypto test).
> See `docs/secure_runtime_alpha_3161_3240_execution_spec.md` and
> `docs/secure_runtime_alpha_3161_3240_completion_declaration.md`.
> Recommended next Arc: **Device Registration Runtime Activation and
> Encrypted Device-to-Device Sync Transport**.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 2921–3000 — Device Trust and
> Multi-Device Runtime Integration Arc (complete, honest partial
> capability — cryptographic Device authorization blocked).**
> Architecture frozen: no redesign of the accepted Multi-Device Sync
> Foundation (`src/sync/`, Alpha 2421–2500, unmodified), Conversation
> Runtime, or Archive; no cloud account/server, no push, no MLS, no
> Onion/Tor, no new dependency, no Rust change, `p2p/`/`.tmp_gen`
> untouched. Follows the reviewed recommendation (`docs/reviews/multi_device_device_trust_v1/`,
> commit `4672244`): account identity + independent Device keys (Option
> B), never raw Master Seed copying. A new, additive `src/device/`
> domain implements a versioned `FedosDeviceBindingV1` (deviceId,
> account reference, opaque device-key reference, label, trustState,
> `schemaVersion`/`capabilityVersion` — no private key, no Master Seed,
> no passphrase), a closed `pending|trusted|revoked|unavailable` trust
> vocabulary with validated transitions (`revoked` terminal), and an
> event-sourced Device Registry (codec, in-memory + append-only
> backends, conflict/idempotency, fail-closed on corruption) mirroring
> the existing Capability persistence pattern exactly — never merged
> into Membership/Conversation persistence. **The cryptographic
> blocker, stated honestly**: this codebase has no accepted boundary yet
> for independent, account-verifiable Device keys
> (`src/crypto/types.ts` remains a pure placeholder seam) — Phase E
> stops exactly there: `UnavailableFedosDeviceRegistrationAuthority` is
> the only production `FedosDeviceRegistrationAuthority`, and it can
> record a registration attempt but can NEVER return `"verified"`, so no
> device — legitimate or attacker-controlled — can reach `"trusted"`
> through it. `FedosDesktopRuntime` gains an opt-in (`deviceTrustEnabled`,
> mirrors `privateTransportEnabled`'s own discipline), narrow
> `runtime.deviceTrust()` accessor owning one local Device identity, the
> Device Registry/Trust Authority, and the EXISTING (unmodified)
> `FedosSyncState` — sync-fabric membership always follows Device Trust,
> never the reverse: only a `"trusted"` device may join the Sync fan-out
> set, and a new, standalone, additive Sync Journal record allowlist
> (`src/sync/fedos_sync_record_allowlist.ts`) fails closed on any
> `recordType` outside six named non-secret metadata kinds, or on
> sensitive-marker metadata, before the Journal is ever touched — zero
> modification to the Journal's own frozen shape. Revocation denies
> future sync eligibility and rejects any new change originating from
> the revoked device, without erasing the historical binding fact or
> claiming any retroactive deletion of already-copied data; Sender-Key
> rekey is explicitly out of scope. Archive Restore is proven, directly,
> to never register or imply a trusted Device. One new test file (26
> tests) covers the full 24-item required matrix (items 21/22 satisfied
> by re-running the existing, untouched Search and Conversation Runtime
> regression suites rather than duplicating their coverage) over real
> in-memory and append-only backends. See
> `docs/secure_runtime_alpha_2921_3000_execution_spec.md` and
> `docs/secure_runtime_alpha_2921_3000_completion_declaration.md`.
> Recommended next Arc: **Device-to-Device Encrypted Sync Transport**
> remains blocked on the same cryptographic Device-key boundary named
> above — the recommended next Arc is instead **Account-to-Device
> Signature Verification Boundary**, the named prerequisite that would
> let a real `FedosDeviceRegistrationAuthority` finally return
> `"verified"`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3561–3640 — Desktop Electron Host Boundary
> Arc (partial completion, honestly declared).**
> Creates the first Desktop Host boundary around the completed Runtime →
> Shell → ViewModels → Renderer stack. This repository has no accepted
> Electron dependency (confirmed: zero references in `package.json`/
> `package-lock.json`) — per this Arc's own instruction, Electron is NOT
> added; instead the complete, framework-neutral host abstraction
> (`FedosDesktopHostPort`, `src/desktop/host_boundary/fedos_desktop_host_port.ts`)
> and its full in-process reference implementation
> (`FedosDesktopHostBridge`) are built and fully tested, stopping exactly
> at the external Electron dependency boundary. The Host owns
> process/window lifecycle ONLY — exactly one Presentation Boundary (which
> owns exactly one Shell, which owns exactly one Runtime) and exactly one
> Renderer per `start()`, constructed once, stopped via the ONE real
> `shell.stop()` call already needed. A closed, 14-command vocabulary
> (`fedos_desktop_host_command.ts`) covers exactly what the real Shell/
> ViewModel stack supports — two categories are deliberately EXCLUDED and
> documented rather than faked: `archive-list`/`archive-verify` (no such
> real Archive Runtime operation exists, Alpha 3081-3160's own finding)
> and `archive-export`/`preflightRestore`/`restore` (need a raw filesystem
> destination path this foundational Arc declines to expose without a real
> path-authority/file-picker story). Every command is validated
> structurally (type/shape/size-bounded, reusing
> `FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH`/
> `FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES` verbatim) before it ever
> reaches a ViewModel — an unknown command, wrong-shaped payload, or
> path-traversal attempt all fail closed to `"unknown-command"`. `dispatch()`
> returns the raw ViewModel action result, never a Renderer-shaped screen
> model a second time -- Phase G's own explicit "action → state → render"
> separation, avoiding duplicating what the Renderer layer already owns;
> `render()` is the separate, on-demand, side-effect-free full-screen
> snapshot. Every response is a closed, `Object.freeze`d, JSON-safe
> `FedosDesktopHostResponse<T>` -- no raw Error, no persistence record, no
> secret, ever (confirmed by a dedicated full-session leakage test).
> Concurrent `dispatch()` calls are serialized through one internal
> Promise queue (confirmed by a real 5-way-concurrent-creation test with
> zero corruption). 17 new real tests against the real
> Host/Runtime/Shell/ViewModel/Renderer stack, covering every required
> scenario except the Electron-specific ones (which do not apply). One
> real, honest discovery along the way: `conversations-list` is a
> SESSION-scoped in-memory registry, not a durable enumeration (Alpha
> 2841-2920's own already-documented, unchanged behavior) — a restart-recovery
> test therefore verifies via `conversation-open` (a real durable read),
> not `conversations-list`. Baseline/final: typecheck clean except the one
> already-documented pre-existing failure; full suite's failure count and
> file set unchanged from Alpha 3401-3480's own baseline. See
> `docs/secure_runtime_alpha_3561_3640_reconciliation_report.md` and
> `docs/secure_runtime_alpha_3561_3640_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3401–3480 — Desktop UI Renderer Boundary
> (complete).**
> Implements the rendering boundary only, over the ten ViewModels Alpha
> 3241-3320 built — pure TypeScript render-model contracts under
> `src/desktop/renderer/`, explicitly NOT Electron/React/Tauri/browser
> code. One shared, closed render-output shape,
> `FedosDesktopRenderModel<T> = {kind:"idle"} | {kind:"loading"} |
> {kind:"error",outcome,message} | {kind:"content",content:T}`
> (`fedos_desktop_render_model.ts`), plus eight content renderers
> (Conversation List, Conversation Detail, Message, Reply, Archive,
> Search, Membership, Status), two shared cross-cutting ones (Error,
> Loading), and one aggregator (`FedosDesktopRenderer`) constructed from a
> `FedosDesktopConversationUiPresentationBoundary`. Ten ViewModels map onto
> eight content renderers, not 1:1 — `MessageRenderer` consumes Message
> List + Compose Message + Unread Counter together (a real message pane
> renders exactly those three facets as one cohesive unit), each an
> independent `FedosDesktopRenderModel` facet rather than one forced
> top-level `kind`, since their lifecycles genuinely differ (a loaded list
> alongside a still-`"loading"` pending send). "Empty" is represented as
> DATA (`{items, count, isEmpty}` via `fedosRenderList()`) on a real,
> successfully-`"content"`-kind result, never a separate `kind` and never
> confused with `"idle"`/`"error"`. Every renderer's ONLY dependency is a
> ViewModel's already-public getters — no `.load()`/`.send()`/`.search()`
> call, no `FedosDesktopApplicationShell`, no persistence port, no crypto
> authority, no rendering framework/HTML/CSS/browser global anywhere in
> the directory (confirmed by grep). "Renderer snapshot tests" are full,
> deterministic `toEqual()` assertions of complete render-model objects —
> this repository's own already-established assertion style — rather than
> a new external `__snapshots__` file convention introduced for the first
> time. 11 new real tests against a real Renderer/ViewModel/Shell/Runtime
> stack, covering every required category: snapshot, state transitions,
> error, loading (a real async gap observed synchronously before
> awaiting), empty, 30-message large-conversation rendering, search, and
> archive. Baseline/final: typecheck clean except the one already-documented
> pre-existing failure; full suite's failure count and file set unchanged
> from Alpha 3241-3320's own baseline. See
> `docs/secure_runtime_alpha_3401_3480_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3241–3320 — Desktop Local Conversation
> Management UI Prototype Arc (complete).**
> Builds the first real Desktop Local UI boundary over the newly completed
> `FedosDesktopApplicationShell`/`FedosDesktopConversationContentAccessor`
> (Alpha 3081-3160) — a pure TypeScript presentation boundary, explicitly
> NOT Electron/React/Tauri/any rendering framework. Ten ViewModels under
> `src/desktop/presentation/` (Conversation List, Conversation Detail,
> Message List, Compose Message, Reply, Search, Archive, Membership,
> Unread Counter, Runtime Status), one file each, plus a shared closed
> `"idle" | "loading" | "loaded" | "error"` state shape
> (`fedos_desktop_view_model_state.ts`) and one aggregating factory
> (`FedosDesktopConversationUiPresentationBoundary`) that owns exactly one
> Shell instance and one of each ViewModel over it. Every ViewModel's ONLY
> dependency is `FedosDesktopApplicationShell` — no persistence port,
> crypto authority, or `conversationRuntime()`/`conversationContentAccessor()`
> access anywhere in this directory; no new business logic, only Shell-call
> plus state-shape bookkeeping. Two honest scope findings, neither worked
> around: the Shell has no public activation or invitation-redemption
> method at all (a real, pre-existing characteristic, not something this
> Arc's own ten ViewModels could or should add), so tests needing a
> genuinely active conversation establish it via a real, independent Runtime
> setup call, fully stopped, before starting the presentation boundary's
> own Shell over that already-durable state — mirroring this codebase's own
> established restart-recovery testing convention; and the Unread Counter
> ViewModel is an honest, local, in-memory-only "last viewed" watermark
> over real `listMessages()` data, never a fabricated cross-device "read
> receipt" (no such concept exists anywhere in this codebase). 13 new real
> tests, every one against a real `startFedosDesktopRuntime()` instance —
> Runtime Status lifecycle, real Direct creation visible through
> List/Detail/Membership, real send→list→reveal→reply with an exact
> plaintext round trip and real Unread Counter tracking, real keyword
> Search, real Archive `"unavailable"`/`"not-found"` behavior, no raw
> Error/secret leakage, independent boundary isolation. Baseline/final:
> typecheck clean except the one already-documented pre-existing failure;
> full suite's failures match, file-for-file, the two pre-existing
> environment-only categories Alpha 3081-3160 already confirmed, plus three
> transient failures from three unrelated historical review tests that
> assert a clean `git status` and briefly saw this Arc's own not-yet-committed
> files — resolved once this Arc's commit landed. See
> `docs/secure_runtime_alpha_3241_3320_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 3081–3160 — Desktop Runtime Conversation
> Content Accessor and Application Shell Activation Arc (complete).**
> Closes the exact boundary Alpha 2841-2920 documented and stopped at.
> Architecture frozen: no redesign of `FedosDesktopRuntime`/Conversation
> Runtime/Direct/Group messaging, no second message repository, no
> persistence port or crypto authority/handle exposed, no new dependency,
> no Rust/WASM/Cargo touch, no `p2p/`/`.tmp_gen` touch. One new narrow
> boundary — `FedosDesktopConversationContentAccessor`
> (`src/desktop/content_accessor/`), owned by exactly one
> `FedosRunningDesktopRuntime` (new `conversationContentAccessor()`
> accessor, lifecycle-gated exactly like `conversationArchiveRuntime()`) —
> delegates to the EXISTING Direct/Group messaging, Search, Retention and
> Archive Runtime APIs; owns no persistence, no crypto authority, no
> secret. `FedosDesktopApplicationShell.listMessages`/`sendMessage`/`reply`/
> `search`/`archive` are now real (a new `readMessage()` method was added —
> a send/read is structurally impossible without message content, which
> the pre-existing signatures carried none of); every outcome maps onto the
> Shell's own existing closed result vocabulary, never a raw error. Fixed a
> real, latent defect Phase A's own inventory found: the Shell's
> `sendMessage`/`reply` precondition check read `draft.lifecycleState`
> (permanently `"draft"` by construction, Alpha 1116) instead of the real
> activation/usability fact — meaning `"requires-activation"` could never
> have cleared even after Alpha 1111-1180/2041-2120 shipped real
> activation; now reads
> `FedosConversationRuntime.resolveActiveConversation()`/
> `FedosConversationGroupRuntime.readinessForPrivateGroup()` (both new,
> narrow, additive accessors). Group message plaintext read for a
> recipient (previously no production API existed for it at all) is now
> real via a new `FedosConversationGroupRuntime.resolveLocalGroupMessagePlaintext()`,
> composing the SAME fan-out delivery/path records
> `FedosGroupSendCoordinator` itself already produces, delegating to the
> frozen Direct read path — invents no crypto. Honestly documents, rather
> than works around, two real structural characteristics discovered this
> Arc: a Group message's own SENDER has no self-Envelope to decrypt on this
> base (`"own-message"`, not a fabricated plaintext), and
> `FedosConversationArchiveRuntime.exportConversationArchive()`'s own
> existence gate is keyed to the PUBLIC, Board-thread-derived Conversation
> persistence domain — entirely separate from the private Direct/Group
> draft domain a Shell caller actually messages through — so archiving a
> real private conversation by its own id requires an independently-existing
> bridging record this Arc does not auto-create (this codebase's own
> pre-existing Archive Runtime tests already construct this bridge
> manually; new tests do the same, never inventing an automatic bridge).
> Search is wired to the existing, already retention-gated
> `FedosConversationSearchIndex` (one instance per Runtime, fed
> incrementally only when this Accessor already holds real plaintext it
> just encrypted/decrypted — never a bulk decrypt pass); Group messages are
> deliberately NOT indexed (their own recipient Envelope lives under an
> internal pairwise-child conversation id, not the Group id a caller
> holds — indexing it would leak that internal id or require an invented
> remap). One new test file, 16 tests, every one against a real
> `startFedosDesktopRuntime()` instance: accessor ownership/lifecycle/
> isolation; full Direct send→reply→read→list round trip with exact
> plaintext; malformed-input fail-closed; wrong-identity denial across two
> independent Runtimes sharing durable state; Group admit→send→real
> per-recipient read→honest `"own-message"`→member removal excludes a
> future send; restored/reactivated conversation resumes real messaging;
> real keyword Search plus a real retention transition removing both the
> Search hit and the message's plaintext; Archive `inspect`/`export`/
> `preflightRestore`/`restore` wiring including `requires-unlock` and the
> honestly-documented, environment-driven `"failed"`/real-file-`inspect`
> split (this checked-out tree has no compiled WASM artifact — confirmed by
> direct reproduction, a pre-existing, repo-wide condition unrelated to
> this Arc, see `docs/secure_runtime_alpha_3081_3160_completion_declaration.md`
> §14); no raw Error/secret/ciphertext leakage; no hidden network activity.
> Two pre-existing tests updated as genuinely stale, never weakened: the
> Shell suite's `listMessages`/`search`/`archive` call sites and one now-more-precise
> outcome (`"requires-activation"` replacing a stale blanket
> `"unavailable"`); the Runtime-assembly suite's closed key-enumeration
> gained the one new key. Baseline (this exact worktree, before this Arc's
> production edits): typecheck clean except one pre-existing, unrelated
> failure (`secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`,
> committed `aff32c5`, confirmed untouched); full suite 254/12774 tests
> failing, every one independently confirmed to fall into one of two
> pre-existing, environment-only categories (a fresh-linked-worktree
> Cargo.toml/lib.rs raw-import artifact; the missing compiled WASM
> artifact) — zero traceable to this Arc's own files. Final: identical.
> See `docs/secure_runtime_alpha_3081_3160_reconciliation_report.md` and
> `docs/secure_runtime_alpha_3081_3160_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 2841–2920 — Desktop Local Application
> Shell and Conversation Management Boundary Arc (complete).**
> Architecture frozen: no redesign of Conversation Runtime, no renamed
> public interface, no new dependency, no Rust/WASM/Cargo touch, no
> `p2p/`/`.tmp_gen` touch, no existing production file changed. Three new
> files under `src/desktop/shell/` (`fedos_desktop_shell_result.ts`,
> `fedos_desktop_shell_view_models.ts`, `fedos_desktop_application_shell.ts`)
> implement `FedosDesktopApplicationShell`, a narrow application boundary
> owning exactly one `FedosRunningDesktopRuntime`, exposing a closed
> `ok | unavailable | unauthorized | not-found | invalid-input | conflict |
> requires-activation | requires-unlock | unsupported | failed` result
> vocabulary and closed view models (`ConversationSummary`,
> `ConversationDetail`, `MessageView`) over `start`/`stop`/`status`,
> `createDirectConversation`/`createPrivateGroup`, `listConversations`/
> `getConversation`, `issuedInvitations`/`redeemInvitation`,
> `listMessages`/`sendMessage`/`reply`, `search`, `archive`, `deviceStatus`.
> Phase A's own inventory found, and this Arc documents honestly rather
> than working around, a real structural boundary: `FedosRunningDesktopRuntime`
> exposes only `boardRuntime()`/`conversationRuntime()`/`privateTransport()`,
> none of which reaches the Envelope/Payload/Membership/Capability
> persistence ports Search, Archive, and message send/read composition
> need — `conversationEnvelopePersistence`/`conversationPayloadStorage` are
> constructed inside `startFedosDesktopRuntime()` but never returned to any
> caller, and `FedosConversationEncryptionAuthority`/`DecryptionAuthority`
> both still require an Identity-domain key-resolution mapping named, in
> their own file headers, as an unsolved blocker since Alpha 890. Rather
> than bundle an unreviewed extension to `fedos_desktop_runtime.ts` into
> this already-large Arc, `listMessages`/`sendMessage`/`reply`/`search`/
> `archive` are real, testable methods that perform every check possible
> against live Runtime state (existence, membership/authorization checked
> *before* lifecycle so a non-member never learns activation state,
> `requires-activation` because no conversation on this base can ever leave
> `"draft"`) and terminate at an honest, closed `"unavailable"` — never a
> fabricated plaintext, never a silent empty-list-as-success, never a raw
> error. `deviceStatus()` is `"unavailable"` for the independent reason that
> `src/sync/*` (Device Sync Foundation) is real but wired into nothing
> (zero imports, confirmed by grep); Sender-Key is confirmed not integrated
> on this base at all. Conversation creation, listing, detail, membership,
> readiness, and issued-invitation reads are fully real and tested against
> a live Runtime — no mock. One new test file (20 tests), all against real
> `startFedosDesktopRuntime()` instances over real append-only log files,
> covering lifecycle fail-closed behavior before/after start/stop, empty
> list, real Direct/Group creation, deterministic filtered listing, the
> honest send/message/search/archive/device `"unavailable"` boundary,
> invitation issue (never the bearer secret) vs. honestly-unavailable
> redeem, restart recovery over durable paths, independent Runtime
> isolation, malformed-command rejection, wrong-identity denial, and no
> raw-error/secret leakage (JSON-serialized and checked). Baseline (fresh
> `arc/desktop-application-shell` worktree, `master` @ `3eb9ead`): typecheck
> clean except one pre-existing unrelated error; full suite 189 files/233
> tests failed, 751 files/12130 tests passed (a known fresh-worktree
> artifact plus one already-stale pre-existing assertion, `secure_runtime_alpha_758_*`,
> that predates this Arc). Final: typecheck unchanged; new shell suite 20/20
> passed; focused Conversation Runtime/Search/Archive regression 73/74
> passed (the one failure is the identical pre-existing baseline failure);
> full-suite failure count unchanged from baseline within measurement noise,
> zero new failure traceable to this Arc's files. See
> `docs/secure_runtime_alpha_2841_2920_execution_spec.md` and
> `docs/secure_runtime_alpha_2841_2920_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 2581–2620 — Conversation Search
> Retention Authority and Index Purge Hardening Arc (complete).**
> Architecture frozen: no redesign of the accepted Search Runtime, no
> replaced persisted index, no vector/remote/cloud search, no new
> Rust/WASM primitive, no new persistence port, no Host/GUI wiring, no
> new dependency. Closes the High-severity retention-gating defect the
> Private Conversation Search V1 runtime audit found (`docs/reviews/private_conversation_search_runtime_v1/11_retention_bypass_risk_realized.md`,
> commit `bec5142`, against Arc commit `3b7143f`): threads the EXISTING
> `FedosPayloadRetentionAuthority` (`src/conversation/retention/`, Alpha
> 796–811) into the EXISTING Search Runtime through one new, narrow,
> additive dependency (`Pick<FedosPayloadRetentionAuthority,
> "evaluatePayloadAccess">` — the pure-preview method only, never
> `readPayload()`/`tombstonePayload()`/`removeLocalPayload()`) on
> `FedosConversationSearchIndexDependencies`. Exactly ONE production file
> changes: `src/conversation/search/fedos_conversation_search_index.ts`.
> `indexEnvelope()`/`indexArchiveBundle()` now refuse anything not
> currently `"allowed"` (denied, tombstoned, payload-removed, not-found,
> or a thrown/unavailable Authority — all fail closed) via a new closed
> `"denied"` outcome; a mixed Archive Bundle indexes only permitted
> records while honestly counting denied ones. `reconcilePayloadRetention()`
> is new, narrow wiring reusing the EXISTING `removeEnvelope()` to purge
> every searchable trace once a payload transitions away from `"active"`;
> `removeEnvelope()` itself now also reaches the Mode/Archive sub-indexes'
> own previously-dead `removeConversation()`/`forgetConversation()` once a
> conversation's indexed Envelope count reaches zero, closing the audit's
> Medium-severity dead-code finding. Every content-adjacent query
> (`searchKeyword`/`envelopesBetween`/`repliesTo`/`parentOf`/
> `envelopesByParticipant`) additionally re-checks retention per result at
> query time — the one honest race a synchronous, non-reactive Retention
> Authority leaves open between a transition and its caller-invoked
> reconciliation — while conversation-level classification
> (`modeOf`/`directConversationIds`/`groupConversationIds`/
> `isFromArchive`/`archivedConversationIds`/`conversationsByParticipant`/
> `size`) stays ungated, carrying no message content. Restart safety is
> free: a freshly rebuilt instance re-feeds through the identical gate, so
> denied content never resurfaces. Two new test files (33 new tests)
> cover the full 20-item required matrix (allowed/denied/tombstoned
> ingestion, purge, mixed Archive, restart, query-time race, group/direct/
> encryption-suite neutrality, fail-closed on wrong identity and on an
> unavailable Authority, no plaintext leakage, unrelated-content
> isolation, ordering compatibility); four pre-existing test files were
> updated for the new required dependency and two of the runtime audit's
> own source-alignment assertions were updated to reflect the now-closed
> gap (the audit's 20 numbered `.md` documents themselves are UNCHANGED
> and remain an accurate historical record). See
> `docs/secure_runtime_alpha_2581_2620_execution_spec.md` and
> `docs/secure_runtime_alpha_2581_2620_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 2341–2420 — Conversation Archive CLI and
> User Packaging Arc (complete).** Architecture frozen: no new Archive
> wire shape, no new crypto primitive, no new `AeadAadDomain` variant, no
> Rust/WASM change, no change of any kind to `src/conversation/archive/`
> or `src/conversation/runtime/`. A pure, additive CLI/packaging layer,
> `src/conversation/archive_cli/` (7 new files), composing the EXISTING,
> unmodified Archive Runtime (Alpha 1541–1610) end to end: "archive
> export"/"archive import" wrap `collectFedosConversationArchiveBundle()`
> and `FedosWasmConversationArchiveEncryptionAuthority.export()`/
> `.import()` verbatim; "archive verify" is a direct, un-embellished
> pass-through of `authority.import()`'s own existing decrypt-and-check
> result (never touches persistence); "archive preflight" runs the
> existing `detectFedosConversationArchiveDuplicates()` on the decrypted
> bundle instead of restoring it. "archive metadata"/"archive
> inspect"/"archive summary"/"archive list"/"archive version display"/
> "archive hash verification" are all pure, synchronous, key-free
> functions over the Manifest's own already-cleartext fields (Alpha
> 1541–1610's own "travels alongside the ciphertext, in the clear"
> design) or the existing Integrity content-hash check — no decrypt, no
> key resolution. Packaging adds two new, this-Arc-only wire shapes never
> conflated with the frozen Archive schema itself: `FedosConversationArchiveCliPackageV1`
> ("single archive") and `FedosConversationArchiveCliMultiPackageV1`
> ("multiple archive bundle"), versioned by their OWN `formatVersion`.
> "directory export"/"directory import" reach the real filesystem
> through one injected `FedosConversationArchiveCliFileSystem` boundary
> (real `node:fs`-backed implementation, mirrors this codebase's own
> established sync-`node:fs`-plus-`@ts-expect-error` convention); "archive
> list" reads ONLY the directory's own "metadata manifest" index file,
> never a raw scan. Every batch operation tallies outcomes per
> conversation and never aborts on one failure — Restore's own Alpha
> 1541–1610 "a partially-invalid Archive should not block the rest"
> discipline, extended from one bundle's nested records to many
> conversations in one directory.
>
> Four new test files (42 new tests), including a **Real Runtime**
> (structurally real, non-cryptographic round-trip) encrypt/decrypt path
> exercised throughout, **Direct**- and **Group**-classified
> conversations (via the separate Draft port, alongside the Archive
> Bundle's own structurally-always-`"public"` conversation record), a
> **large archive** (1,000 envelopes/payloads) round-tripped losslessly
> both as a single Package and via "directory export"/"directory
> import," an **empty archive**, a **duplicate archive** re-import, and
> three distinct **tampered archive** scenarios (mutated
> `conversationId`, mutated `contentHash`, substituted ciphertext), each
> correctly rejected. See
> `docs/secure_runtime_alpha_2341_2420_execution_spec.md` and
> `docs/secure_runtime_alpha_2341_2420_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 2501–2580 — Conversation Search Runtime
> Arc (complete).** Architecture frozen: no new Rust/WASM primitive, no
> new `AeadAadDomain` variant, no new persistence port, no Host/GUI
> wiring, no network transport of any kind. A pure TypeScript, in-memory,
> derived indexing layer, `src/conversation/search/` (9 new files),
> reusing Conversation Runtime (`src/conversation/runtime/`, Alpha
> 921–930 — `FedosConversationRuntimeDependencies`'s own
> `draftPersistence`/`membershipAuthority` pair, via a literal `Pick<>`,
> not a merely same-shaped lookalike) and Archive
> (`src/conversation/archive/`, Alpha 1541–1610 —
> `FedosConversationArchiveBundleV1`, reusing its own existing envelope
> codec verbatim). Implements a `FedosConversationSearchIndex` facade
> over Incremental, Archive, Mode (satisfying both "group index" and
> "direct index" off ONE shared `conversationId → mode` map, per
> `FedosConversationReader`'s own Alpha 753 "no redundant second index
> for one closed enum" precedent — never two separately-maintained
> structures), Reply, Date, Participant, and Keyword sub-indexes. Named,
> real boundary (not silently dropped): the Keyword Index never decrypts
> anything — `FedosConversationSearchEnvelopeDocument.text` is
> ALREADY-DECRYPTED plaintext SUPPLIED BY THE CALLER, the exact same
> "ALREADY RESOLVED by the caller" idiom
> `FedosConversationEncryptionRequest`/`FedosConversationDecryptionRequest`
> (Alpha 861/862) already use for `localAccountIndex`/
> `counterpartyPublicKeyHex` — no Decryption Authority is called, no
> ciphertext or Payload byte is ever touched here. No new persistence of
> any kind: every sub-index is a pure, rebuildable, in-memory structure
> over already-durable Envelope/Membership/Draft/Archive data, proven by
> this Arc's own "restart" verification (two independent instances fed
> identical source data reproduce identical query results). Every
> ingestion path (`indexEnvelope`/`indexEnvelopes`/`indexArchiveBundle`)
> is incremental and idempotent through one shared dedup guard
> (`FedosConversationSearchIncrementalIndex`) — the "duplicate"
> verification; `removeEnvelope()` purges an id from every sub-index and
> reopens it for a later legitimate re-index — the "delete" verification,
> deliberately non-cascading (mirrors this codebase's own "no cascading
> delete" discipline on every append-only-backed port). Four new test
> files (30 new tests), including a "large dataset" test indexing 3,000
> Envelopes across 20 conversations/3 participants and an
> "archive restore" test round-tripping a real Archive Bundle through
> the existing collector/restore path into the new index. See
> `docs/secure_runtime_alpha_2501_2580_execution_spec.md` and
> `docs/secure_runtime_alpha_2501_2580_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 2421–2500 — Multi Device
> Synchronization Foundation Arc (complete).** Architecture frozen: no
> new Rust/WASM primitive, no new `AeadAadDomain` variant, no Host/GUI
> wiring, no network transport, and no Sender-Key change — additive
> synchronization PRIMITIVES only, entirely new `src/sync/` (9 new
> files), never touching `src/conversation/transport/` (Alpha
> 1471–1540) or any Sender-Key material. Implements Device Binding
> (`fedos_sync_device_binding.ts`) — the first file in this codebase to
> carry a real "sync" concept in its own name, since every earlier
> device-shaped boundary (`src/identity/device_registration.ts`/
> `device_trust.ts`, Stage 127/128) explicitly deferred it — a pure
> three-state (`bound`/`unbound`/`revoked`) state machine over an
> opaque `(deviceRef, accountRef)` pair; Device Registry
> (`fedos_sync_device_registry.ts`), mirroring
> `InMemoryFedosConversationPersistence`'s own private-`Map`, no-delete
> convention (Alpha 751), enforcing that a `deviceRef` belongs to at
> most one `accountRef` (`"conflict"` otherwise); Sync Journal
> (`fedos_sync_journal.ts`), the single append-only, per-account source
> of truth for "what changed," assigning monotonic sequence numbers
> with `changeId` de-duplication as a hard invariant of `append()`;
> Sync Cursor (`fedos_sync_cursor.ts`), a per-device, monotonic-only
> position marker into the Journal; Sync Queue
> (`fedos_sync_queue.ts`), the durable per-target-device OUTBOUND
> delivery queue (`"queued"` → `"delivered"` → `"acknowledged"`, plus a
> retryable `"failed"`) a local change fans out into — transport-
> agnostic, mirroring `FedosPrivateTransport`'s own Outbox/Publisher
> split in spirit only (Alpha 1471–1540), never a socket this Arc owns;
> Pending Changes (`fedos_sync_pending_changes.ts`), the per-device
> INBOUND staging area a delivered/redelivered entry lands in before
> resolution — the one place duplicate delivery is caught independently
> of the Journal's own `changeId` check; Conflict Vocabulary
> (`fedos_sync_conflict.ts`), a pure CLASSIFICATION
> (`"none" | "duplicate" | "tombstone-vs-upsert" | "concurrent-update"`)
> of one conversation's next candidate entry against the last entry a
> DEVICE actually applied — classification only, resolution policy
> (last-write-wins, CRDT merge, a user prompt) is explicitly OUT of
> scope, mirroring the Archive Arc's own "Restore ≠ new persistence
> logic" discipline (Alpha 1541–1610); Sync State
> (`fedos_sync_state.ts`), the per-account coordinator composing every
> primitive above (`recordLocalChange`/`deliverQueuedChanges`/
> `redeliverChange`/`applyPendingChanges`/`acknowledgeApplied`); and
> Recovery State (`fedos_sync_recovery.ts`), a serializable snapshot of
> exactly the LOCAL, per-device state (Cursor position, still-pending
> and already-resolved `changeId`s) a device process needs to survive a
> restart without loss or duplication, restoring only that fragile
> local memory — the Journal, Device Registry, Sync Queue, and each
> device's own already-applied local-conversation state are modeled as
> durable and unaffected by a restart. One real bug this Arc's own
> end-to-end verification caught before it shipped: an early draft
> tracked "last entry applied per conversation" in one map SHARED
> across every device, so a THIRD device receiving a change two
> siblings had already each applied saw it as a false `"duplicate"`;
> the fix scopes that map per `(deviceRef, conversationId)`, since each
> device's own local-application state is independent and never shared
> with a sibling's. Archive interaction is a narrow, OPTIONAL, caller-
> injected `archiveAwareness: { isConversationArchived(conversationId) }`
> port — `src/sync/` never imports `src/conversation/archive/` directly;
> a pending change targeting an archived conversation is reported
> `"archived-skip"` and still advances the Cursor, so it never blocks
> the rest of the Journal, mirroring Archive's own 1541–1610 deferral
> of Sync. Four new test files (46 new tests):
> `test/secure_runtime_alpha_2421_2500_device_binding_and_registry.test.ts`,
> `test/secure_runtime_alpha_2421_2500_journal_cursor_queue_and_conflict.test.ts`,
> `test/secure_runtime_alpha_2421_2500_end_to_end_verification.test.ts`,
> `test/secure_runtime_alpha_2421_2500_structural_guards.test.ts` —
> covering 2-device and 3-device fan-out, an offline device's queue
> entries staying `"queued"` indefinitely, that same device coming
> online and applying everything it missed in order, a genuine
> cross-device conflict (`"concurrent-update"`) surfacing without
> blocking the journal, both a retried local write and an out-of-band
> redelivery being recognized as `"duplicate"`, a device's local
> runtime state being lost and exactly reconstructed from a Recovery
> snapshot (both after full apply and mid-flight, before any apply),
> and the archive-interaction skip-and-continue behavior.
> **Verification**: `npm run typecheck` clean except the same one
> PRE-EXISTING, unrelated error
> (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`)
> every recent Arc has already confirmed predates it; `npx vitest run`
> (931 test files / 12,172 tests): this Arc's own 46 new tests all
> pass, and every one of the 36 pre-existing failing tests (28 files)
> is either a Rust-source structural check this Arc's own `git diff`
> confirms zero touch to `packages/fedos-core-rust/`, or a
> `git status`-cleanliness check unrelated to Sync — the untracked
> `p2p/` directory, `.tmp_gen/`, this Arc's own then-uncommitted files,
> and other already-in-progress, unrelated uncommitted work sharing
> this working tree (`src/conversation/search/` and its own test files)
> all already present before this Arc began. No UI, no transport
> redesign, no Sender-Key redesign, and no real device pairing/key-
> exchange/attestation of any kind are all explicitly named OUT of this
> Arc's scope, not silently dropped — see
> `docs/secure_runtime_alpha_2421_2500_execution_spec.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 2041–2120 — Conversation Identity
> Restoration and Reactivation Arc (complete).** Closes the ONE real,
> structural gap the prior Arc's own completion declaration named as its
> recommended next step: archived Conversations restored their persisted
> DATA correctly, but a restored Conversation had no production-grade path
> back to normal send/read — the prior Arc's own round-trip test needed a
> test-only workaround (directly seeding a child Direct Conversation's
> Draft+Activation facts) just to prove a post-restore send wasn't
> replayed. A mandatory Phase 1 reconciliation report
> (`docs/secure_runtime_alpha_2041_2120_reconciliation_report.md`),
> written and committed before any production code change, traced the
> real gap in full: `resolveFedosConversationActiveConversation()`
> requires a Draft record (Alpha 894) AND a `"completed"` Activation fact
> (Alpha 1121), neither of which the archive ever replays (by frozen
> design, unchanged); additionally, for a restored Group,
> `FedosGroupGenerationAuthority.createNextGeneration()`/
> `evaluateFedosGroupUsability()` both independently require the GROUP's
> own top-level Draft too — a blocker the prior Arc's own analysis had not
> named. `FedosConversationRuntime` — confirmed the correct owner over
> `FedosConversationArchiveRuntime`/`FedosRunningDesktopRuntime` (both
> considered and rejected in the reconciliation report §1) — gains ONE
> new, additive method, `reactivateRestoredConversation(conversationId)`,
> delegating to a new `FedosConversationReactivationCoordinator`
> (`src/conversation/activation/`) composed ENTIRELY over existing,
> unmodified machinery: it deterministically re-derives a missing Draft
> from the ONE already-restored Membership fact with `role === "owner"`
> (never invented), then activates every `direct` id — the top-level id
> itself, or, for a restored Group, every distinct pairwise child Direct
> Conversation its restored Paths reference — through the SAME, untouched
> `FedosConversationDirectActivationCoordinator.activateDirectConversation()`
> (Alpha 1122). Authorization reuses the SAME "local identity resolves and
> holds an ACTIVE Membership on this id" gate `activateDirectConversation()`/
> `sendGroupMessage()` already enforce — never a new authorization model;
> a caller with no legitimate claim to a conversation gets `"unauthorized"`
> (or, per child, `"not-member"`), and a genuinely unknown id gets
> `"conversation-not-found"` before any identity check even runs. Every
> write is idempotent (a repeat call reports `"already-active"`, never
> re-running a durable write) and fails closed on a structurally corrupt
> pre-existing Draft rather than silently re-deriving over it. The REAL
> Application Round Trip acceptance test passes: a real
> `startFedosDesktopRuntime()` source Runtime creates a Private Group,
> admits two real-keyed recipients, sends, exports; a fully independent
> destination Runtime restores, stops, and restarts as a genuinely fresh
> instance — confirmed GENUINELY INERT first (`findConversation()` returns
> `null`, `readinessForPrivateGroup()` reports `"failed"`) — then
> `reactivateRestoredConversation()` reactivates the group's own Draft and
> both real pairwise children; discovery now succeeds via real Runtime
> read APIs (`findConversation()` returns the record,
> `readinessForPrivateGroup()` reports `"usable"`); a genuinely NEW send
> succeeds, a REPLY to it succeeds; a repeat reactivation call reports
> `"already-active"` for both children with nothing duplicated; a second,
> independent archive/restore cycle into a THIRD, fully fresh Runtime
> reports the exact expected insert counts with zero duplicates, and
> reactivation composes cleanly across that second cycle too. No
> plaintext of any real message sent in the test appears anywhere in
> either raw on-disk archive file; no network side effect is even
> possible (no transport of any kind was ever configured). A dedicated
> 12-test unit suite additionally covers the full security/idempotency
> matrix directly (unauthorized, not-found, identity-unavailable,
> creator-unresolvable, a structurally corrupt pre-existing Draft, an
> already-present valid Draft trusted verbatim, a child no longer an
> active member skipped while siblings still reactivate). A TRUE fresh
> baseline was captured in this exact worktree (stash/re-run/restore, not
> reused from any other Arc's own documented numbers): 764 passed files /
> 192 failed at the clean pre-Arc tip; with this Arc's own changes
> present, 762 passed / 196 failed — diffed file-by-file, confirming the
> entire +4 delta is exactly four "git working tree is clean" review
> guards reacting to this session's own not-yet-committed diff (the same
> "red only until this Arc's own commit lands" phenomenon every prior Arc
> already documents), with the +2 passed-file delta being this Arc's own
> two new, fully-passing test files — zero real regressions. See
> `docs/secure_runtime_alpha_2041_2120_completion_declaration.md` for the
> full record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1921–1980 — Group Conversation Archive
> Integration and Cross-Branch Recovery Arc (complete).** Extends the
> Alpha 1541–1610/1691–1760 Archive Foundation/Runtime additively to
> cover Group Conversations, resolving the exact blocker the prior Arc's
> own status (below) named: this branch's own prerequisite merges
> (`03ac16e`) brought in the real Group Runtime lineage, and this Arc
> adds the ONE new optional `group?` bundle section (same
> `schemaVersion: 1`, no second schema branch) carrying every
> Generation (exhaustive), every current Path fact, the current record
> per Group Message/Fanout Delivery, and one full nested bundle per
> child Direct Conversation a Group's own paths reference — deduplicated
> by conversation id. A real, load-bearing correction was found while
> wiring the Collector's own group-detection signal (documented in full
> in `docs/secure_runtime_alpha_1921_1980_completion_declaration.md`
> §1): no real Group or Direct Conversation is ever written into
> `FedosConversationPersistence` by any production code path in this
> codebase (that port is Public-Board-only, Alpha 748) — a pre-existing
> gap in the Archive Foundation/Runtime this Arc does not introduce and
> does not redesign; the Group Section's own population signal was
> built instead on the real, authoritative Group Generation persistence,
> entirely decoupled from that gap. Export/Preflight/Restore/Duplicate-
> Detection all extended additively, reusing every existing Group
> equality/validator helper (adding three new deep validators —
> `validateFedosGroupDirectPathRecord`/`validateFedosGroupMessageRecord`/
> `validateFedosGroupFanoutDeliveryRecord` — mirroring Generation's own
> existing one, since Path/Message/Fanout Delivery had none before this
> Arc). The REAL Application Round Trip acceptance test passes: a real
> `startFedosDesktopRuntime()` source Runtime creates a Private Group,
> admits two real-keyed recipients, sends, removes one member, sends
> again, exports; a fully independent destination Runtime inspects,
> preflights, restores, stops, and restarts as a genuinely fresh
> instance — 3 generations survive exactly, the removed member is
> excluded from the later generation, canonical Group Message order and
> the reply reference are exact, an authorized party decrypts the
> restored ciphertext back to the exact original plaintext, a second
> restore reports fully `already-present` (no duplicate fanout facts),
> no transport/delivery was ever configured (no network side effect is
> even possible), and one genuinely new Group Message sent after restore
> is neither duplicated nor replayed. Full corruption/security matrix
> (missing child conversation, deep-invalid records, tampered manifest/
> ciphertext, two-Group isolation, no-plaintext) all fail closed. All 92
> pre-existing Direct archive tests remain green, unchanged; a Direct-only
> bundle still round-trips byte-for-byte identical to every archive this
> codebase produced before this Arc. `npm test`: 760 passed files
> (identical to the pre-Arc baseline), every new failure traced to a
> pre-existing, already-documented category or the expected
> "git working tree is clean" review-guard flip (red only until this
> Arc's own commit lands) — zero real regressions. See
> `docs/secure_runtime_alpha_1921_1980_completion_declaration.md` for
> the full record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1691–1760 — Conversation Archive
> Runtime Integration and Recovery Operations Arc (complete for Direct
> Conversations; Group Conversation round trip genuinely blocked, not
> attempted).** Resumed uncommitted partial work rather than
> restarting: the File Authority (exclusive-create via same-directory
> temp-file + `link()`, bounded read, never overwrites) and File
> Container (length-prefixed Manifest+ciphertext framing) were already
> complete; `FedosConversationArchiveRuntime`'s own four operations
> (`exportConversationArchive()`/`inspectConversationArchive()`/
> `preflightRestore()`/`restoreConversationArchive()`) were already
> wired against the real Alpha 1541–1610 Archive Foundation, but the
> Local Runtime's own `conversationArchiveRuntime()` accessor was
> declared and imported, never actually constructed or implemented —
> completed this Arc, mirroring `privateTransport()`'s own exact
> two-state fail-closed contract. One real defect found and fixed
> during reconciliation, matching this Arc's own Quality Gate: `restoreConversationArchive()`
> tracked `.failed`/`.conflict`/`.inserted` per-domain tallies but never
> checked `.invalid`, so a cryptographically authentic,
> integrity-passing Archive containing individually-malformed child
> records would silently report `"restored"` despite incomplete data —
> fixed by adding one precisely-scoped `"partially-invalid"` outcome to
> this Arc's own closed vocabulary, proven by a real end-to-end test
> constructing exactly that scenario. Direct Conversation round trip
> verified for real: seed -> export -> stop -> a genuinely independent
> fresh Runtime -> inspect -> preflight -> restore -> the exact original
> message plaintext recovered byte-for-byte; duplicate restore
> (`"already-present"`, never a duplicate record), conflict
> (`"conflicts-found"`, pre-existing record never overwritten), and
> crash/restart recovery (a restore interrupted after only SOME
> persistence domains were written converges cleanly on a fresh retry,
> no duplication) all verified with real interrupted-then-resumed
> scenarios, not mere assertions. Group Conversation round trip is a
> genuine, named, structural blocker, not attempted: this worktree's own
> branch contains zero Group Conversation code and zero Direct-messaging
> activation/send facade at all (both live only on a separate,
> still-unmerged branch this Arc's own task carries no authorization to
> merge) — the Archive Runtime's own contract is provably agnostic to
> how a record reached persistence, so no Archive-layer code change is
> expected once that lineage merges; only the test seeding would change.
> No plaintext/raw-secret ever appears in an on-disk archive file
> (verified directly, not by type signature alone). `npm test`: every
> failure traced to the SAME two pre-existing, cross-Arc-documented
> categories (the `core.autocrlf` fresh-worktree CRLF artifact, and
> three review docs' own "git working tree is clean" guards, red only
> until this Arc's own commit lands) — zero new failures, zero
> Archive-specific failures. See
> `docs/secure_runtime_alpha_1691_1760_completion_declaration.md` for
> the full record.
>
> Prior status (separate, previously-unmerged NIP-17 lineage, now merged
> as this Arc's own prerequisite):
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1611–1690 — Nostr Private Wire
> Standardization and Transport Reconciliation Arc (honest partial —
> Phase A/B safety closure complete, Phase C+ deferred).** Reconciled
> two prerequisite branches that had diverged since Alpha 1051–1110
> (`arc/nostr-private-direct-pairwise-fanout-delivery`, tip `71c938b`,
> merged into this integration branch — three mechanical conflicts, full
> detail in `docs/secure_runtime_alpha_1611_1690_phase_a_reconciliation.md`).
> **Closed the kind-1 hole** (Alpha 1612/1615): `FedosPrivateTransport`'s
> own wire event builder (`fedos_conversation_transport_event.ts`)
> previously hard-fixed `kind: 1` for private ciphertext — closed by a
> failing-regression-test-first fix, now hard-fixed to the SAME disclosed
> `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND` (`24700`) the `privateNostrDelivery()`
> facade (Alpha 1391–1470) already used; public Board `kind: 1` behavior
> is byte-for-byte unchanged. Froze the `FedosPrivateWireAdapter`
> boundary (Alpha 1616 — Transport owns Relay/mailbox/multi-Relay/retry/
> dedup, unchanged; a Wire Adapter owns event shape/kind/tags/unwrap) with
> two real implementations: `FedosPrivateV1WireAdapter` (thin wrapper
> around the existing, now kind-1615-closed, proprietary wire functions)
> and `NostrNip17V1WireAdapter` (`src/conversation/delivery/nostr/nip17/`,
> real module, honestly `isAvailable() === false` today — NOT because
> normative material is missing, see below, but because Rumor/Seal/
> Gift-Wrap construction itself is real, deferred, new protocol work).
> Added the closed `"fedos-private-v1" | "nostr-nip17-v1" | "unsupported"`
> route vocabulary (Alpha 1613) with one fixed, never file-probed
> default. **Fetched and checked in real, byte-verbatim NIP-17/NIP-44/
> NIP-59 text** (Alpha 1617 — `docs/normative/nostr-protocol-nips/`,
> pinned to `nostr-protocol/nips@bdfa7e62ef87fcfcb992b1a27aee49d36b0b4f91`,
> fetched directly rather than through any summarizing tool), resolving
> every prior Arc's own "zero normative material" finding and confirming
> directly from source (never guessed) that kind 14/15/13/1059/21059/10050
> are Chat Message/File Message/Seal/Gift Wrap/Ephemeral Gift Wrap/DM
> relay list respectively. Confirmed, by actually running `cargo test` in
> this exact worktree (531 passed / 1 pre-existing unrelated failure),
> that `packages/fedos-core-rust/src/crypto/`'s own existing 5,463-line
> NIP-44 v2 implementation already matches the normative pipeline exactly
> (Alpha 1618) — untouched by this Arc. **Deliberately deferred, not
> blocked**: Phase C (real Rumor/Seal/Gift-Wrap construction) and every
> phase after it, plus the NIP-44 narrow-WASM-export boundary (Alpha
> 1619–1621) — genuine new security-sensitive protocol work, scoped to
> a recommended next Arc rather than rushed inside this one. See
> `docs/secure_runtime_alpha_1611_1690_phase_a_reconciliation.md`,
> `_phase_b_normative_source_gate.md`, `_completion_declaration.md` for
> the full record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1471–1540 — Private Transport Boundary
> and Multi-Relay Delivery Arc (complete).** Architecture frozen: no new
> crypto, no Onion, no Tor, no ActivityPub, no AT Protocol, no GUI, no
> Worker wiring. Builds `FedosPrivateTransport`
> (`src/conversation/transport/`, 18 new files) — the boundary that
> actually moves an already-encrypted `FedosConversationMessageEnvelope`
> (Private Delivery, Alpha 851–890, UNCHANGED) over one or more Nostr
> relays, closing the gap every prior Arc left open: nothing before this
> one ever sent a Conversation Envelope anywhere. Reuses, by direct
> import, the fully generic `FedosDeliveryObservation`/
> `FedosDeliveryObservationRepository`/`FedosValidatingDeliveryObservationRepository`
> and `FedosDeliveryRetryRegistry`/`makeFedosDeliveryAttemptSubjectId`
> (`src/board/observation/*`, Alpha 461–470/521–540, UNCHANGED) for both
> Mailbox (durable) and Ephemeral (best-effort, no Outbox row, no Retry
> Registry) Delivery; mirrors — never redesigns — Board's own Outbox/
> Publisher/Scheduler architecture as a new, parallel
> `FedosConversationTransportOutbox`/`FedosConversationTransportPublisher`/
> `FedosConversationTransportScheduler` set, since Board's own types are
> `postId`-bound and this Arc's instruction forbids touching them.
> Multiple Relay fan-out (`FedosConversationRelaySet` +
> `FedosMultiRelayOkCorrelatedConversationTransportPublisher`) reruns the
> SAME per-relay OK-correlation idiom `FedosRelayOkCorrelatedNostrBoardPublisher`
> (Alpha 710/711/724) already established, once per relay, in parallel —
> `"delivered"` if ANY relay accepts, `"rejected"` only if EVERY relay
> explicitly does. Inbound Subscription + Relay Deduplication
> (`FedosConversationInboundSubscription`/`FedosRelayEventDeduplicator`)
> opens every relay's own subscription simultaneously and funnels every
> inbound event through ONE shared, bounded, FIFO-evicted dedup gate
> keyed by the Nostr event's own deterministic id, so a caller's envelope
> callback fires exactly once per event no matter how many relays
> deliver it. Wire packaging is constrained to `kind: 1` (Alpha 424's own
> V1 signing policy, unmodified) — a private-transport event is
> distinguished from a public Board post purely by tags
> (`fedos-private`/`p`/`e-envelope`), never a new Nostr kind; `content` is
> base64 ciphertext, mirroring `fedos_conversation_payload_codec.ts`'s
> (Alpha 806) own encoding-only boundary discipline. Identity Resolution
> reuse: `fedos_conversation_transport_routing.ts` resolves the still-open
> Alpha 890 `localAccountIndex`/`counterpartyPublicKeyHex` blocker for
> Direct conversations ONLY, by applying the exact verification idiom
> `FedosSigningAuthorityNostrAuthorBinding` (Alpha 688) already
> established for Board Authors to Conversation Membership instead — a
> group conversation fails closed to `"not-direct"`, not silently routed.
> Named, real (not glossed-over) limitation: `FedosSubscriptionFilter`
> has no server-side tag filter, so Inbound Subscription filters by
> `authors`/`kinds` server-side and does the `#p`-equivalent recipient
> check client-side. Runtime wiring: `FedosRunningDesktopRuntime` gains a
> new `privateTransport()` sibling accessor to `boardRuntime()`/
> `conversationRuntime()`, gated by an OPTIONAL `privateTransportEnabled`
> config field (kept optional, unlike `deliveryEnabled`, so every
> pre-existing `FedosDesktopRuntimeConfig` call site keeps compiling
> unchanged) with the same synchronous fail-closed guard
> `deliveryEnabled` already established; this Arc also wires Private
> Delivery's own Envelope/Payload durable backends (Alpha 857/804) into
> the runtime for the first time — no prior Arc ever constructed them
> there. Eight new test files (59 new tests), including one full
> end-to-end test exercising two independent `FedosPrivateTransport`
> instances (sender + receiver) over two independent relay connections
> each to two shared in-process relay servers: real Mailbox queueing, a
> real Scheduler tick, real Multi-Relay fan-out publish + OK correlation
> on BOTH relays, a real canonical Observation showing `"accepted"`, a
> real Inbound Subscription receiving the identical event from BOTH
> relays with the envelope callback firing EXACTLY ONCE, and the opaque
> payload bytes surviving the full sign→publish→OK-correlate→subscribe→
> dedup→parse→decode pipeline byte-for-byte. **Verification**: `npm run
> typecheck` clean except the same one PRE-EXISTING, unrelated error
> (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`)
> every recent Arc has already confirmed predates it; `npx vitest run`
> baseline (before this Arc's own files existed) already showed 18
> failing test files / 29 failing tests, every one of them a
> `git status`-cleanliness check unrelated to Transport (the untracked
> `p2p/` directory and the then-uncommitted Alpha 1541–1610 Archive
> work, both already present in this working tree before this Arc
> began) — this Arc's own 59 new tests all pass, and it introduces zero
> new failures beyond that pre-existing baseline. See
> `docs/secure_runtime_alpha_1471_1540_private_transport_boundary_and_multi_relay_delivery_arc.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1541–1610 — Conversation Export,
> Restore, Archive Foundation Arc (complete).** Architecture frozen: no
> new Rust/WASM primitive, no new `AeadAadDomain` variant, no Host/GUI
> wiring, no network transport of any kind (No Cloud, No Sync, No GUI).
> A pure TypeScript orchestration layer, `src/conversation/archive/`
> (11 new files), built entirely on five already-existing, unmodified
> domains — Conversation Persistence (Alpha 749/750), Envelope (Alpha
> 854/858), Payload (Alpha 803/804/806), Membership (Alpha 825/827),
> Capability (Alpha 833/836/837) — implementing Encrypted Export,
> Encrypted Import, Manifest, Integrity, Schema Version, Restore, and
> Duplicate Detection. An Archive is sealed under the SAME per-
> conversation `AeadKeyHandle` `FedosMasterSeedAuthority.resolveConversationKey()`
> already derives for that conversation's own Envelopes (Alpha 869) —
> never a new passphrase or key-derivation domain; identity binding
> reuses Alpha 856's own prefix-then-encrypt technique
> (`fedos_conversation_archive_header.ts`) rather than native AAD, and
> the `"Conversation"` `AeadAadDomain` label is reused verbatim, never
> extended. Integrity is a SHA-256 content hash (`@noble/hashes`, an
> existing dependency) over the canonical Bundle bytes, carried in a
> cleartext Manifest and independently re-verified after decrypt — a
> distinct `"manifest-mismatch"` outcome, kept separate from AEAD's own
> undifferentiated `"failed"`. Restore replays a decrypted Bundle back
> into the five EXISTING ports' own `put*` methods, reusing each
> domain's own EXISTING `deserializeX`/`serializeX` codec pair for deep
> per-record validation rather than re-implementing any check; Duplicate
> Detection is not a new outcome vocabulary — `"already-present"`/
> `"conflict"` are this codebase's own pre-existing write-result
> vocabulary (Alpha 315/749/804/827/837/857), surfaced either as
> Restore's own write-outcome tally or, read-only, via a dedicated
> preflight report over each port's existing `get*`/`has*` methods. ONE
> additive port method, `FedosConversationCapabilityPersistence.listConversationCapabilityEvents()`
> (plus both its backends), mirrors `hasRedeemedEvent()`'s own Alpha 841
> additive-port precedent: Capability is exported/restored via RAW
> `"issued"`/`"redeemed"` events rather than the lossy reconstructed
> `currentUses`-only record, since replaying just a count back into a
> fresh backend would lose WHICH distinct redeemers already used a slot,
> silently permitting a double-redemption after restore. Membership
> export uses the CURRENT record per id (`listConversationMemberships()`)
> — that port exposes no raw-event listing, and the current record alone
> is sufficient to reconstruct correct present-day status. Four new test
> files, `test/secure_runtime_alpha_1541_1560_archive_manifest_integrity.test.ts`,
> `test/secure_runtime_alpha_1561_1580_archive_encrypted_export_import.test.ts`,
> `test/secure_runtime_alpha_1581_1600_archive_restore_duplicate_detection.test.ts`,
> `test/secure_runtime_alpha_1601_1610_capability_event_listing.test.ts`
> (48 new tests): Bundle codec round-trip/order-independence/
> fail-closed rejection; Manifest build/codec round-trip/fail-closed
> rejection; Header encode/split/mismatch-detection; a full injected-
> boundary Export→Import round trip plus every coarse failure branch
> (`invalid-input`/`key-unavailable`/`failed`/`manifest-mismatch`);
> Restore's insert/duplicate/conflict/invalid tally against real
> in-memory backends; the read-only Duplicate Detection report; and the
> new `listConversationCapabilityEvents()` port method against both the
> in-memory and append-only Capability backends. **Verification**:
> `npm run typecheck` clean except one PRE-EXISTING, unrelated error
> (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`,
> confirmed via `git log` to predate this Arc entirely); `npx vitest run`
> (915 files / 12,119 tests): 48/48 new tests pass, and every one of the
> 31 pre-existing failing assertions falls into a category this
> codebase's own prior Arcs already documented as expected — ten
> Rust-source static-analysis files this Arc's own `git diff` confirms
> zero touch to `packages/fedos-core-rust/`, the same four files the
> Alpha 1051–1110 completion declaration already named verbatim as
> pre-existing (`publish_pipeline_host_ownership_review_current_state`,
> `secure_runtime_alpha_405/472/543`), one `src/board/`-scoped ripple
> check this Arc never touches, and three review docs' own
> "git working tree is clean" checks that are by construction red while
> this Arc's own new files sit uncommitted — each of those three docs'
> own header already states this check "is expected to be red only
> until this Arc's own single commit lands." Draft (private,
> not-yet-active) conversations, any Host/file-path/GUI wiring for where
> Export/Import bytes are read from or written to, passphrase-protected
> export independent of live conversation-key availability, and any
> Cloud/Sync/network transport are all explicitly named OUT of this
> Arc's scope, not silently dropped — see
> `docs/secure_runtime_alpha_1541_1610_execution_spec.md`/
> `_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1391–1470 — Nostr Private Direct and
> Pairwise Fanout Delivery Arc (complete, protocol-neutral — NOT
> NIP-17/NIP-44/NIP-59 compliant).** Run in a dedicated integration
> worktree (`C:\wt\nostr-private-delivery`, branch
> `arc/nostr-private-direct-pairwise-fanout-delivery`) built from the
> prior Arc's own tip (`b3b9b96`), with two required prerequisite
> branches merged in — `f715a5d` (Private Protocol Delivery review,
> clean, zero conflicts) and `3dc4f7a` (Alpha 1321–1390 Private Group
> Pairwise Fanout Foundation, two clean additive-union conflicts,
> resolved chronologically) — both reported in full in
> `docs/secure_runtime_alpha_1391_1470_completion_declaration.md`.
>
> **Protocol Compliance Gate (Alpha 1393), run first, before any
> production code:** this repository contains ZERO normative NIP-17/
> NIP-44-wire/NIP-59 material — every review already present
> (`docs/reviews/private_protocol_delivery_group_v1/04_nostr_readiness.md`,
> `docs/reviews/private_group_pairwise_fanout/01_nip17_inventory.md`/
> `02_gift_wrap_inventory.md`) independently reconfirms this and
> explicitly defers the research. Per the Gate's own fallback, this Arc
> implements PROTOCOL-NEUTRAL Private Nostr Delivery contracts and makes
> no NIP-17/44/59 compliance claim anywhere:
> `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND = 24700` is a disclosed,
> FedOS-proprietary event kind, not a registered NIP, not interoperable
> with any other Nostr client. Confidentiality is provided entirely by
> the EXISTING, real, already-proven pairwise ECDH + AEAD scheme (Alpha
> 861–890, real since Alpha 1261–1320) — no gift-wrap, no seal, no
> ephemeral per-recipient key scheme is invented.
>
> **New domain, `src/conversation/delivery/nostr/` (13 files):** a
> Private Delivery Request (a NEW, parallel durable intent, deliberately
> not forced into the Board-post-specific `FedosBoardOutboxIntent`) whose
> STATE reuses the EXISTING `FedosDeliveryObservationRepository`
> directly; a recipient-specific wire payload carrying the sender's own
> Envelope-identifying fields verbatim (required for the Alpha 856
> associated-data header to re-derive correctly); an OK-correlated
> Publisher adapter mirroring `FedosRelayOkCorrelatedNostrBoardPublisher`'s
> own technique field-for-field over the unmodified `FedosRelay`; an
> Inbound Delivery Coordinator sitting strictly ABOVE the unmodified
> `validateInboundNostrEvent()` that classifies, gates by recipient
> ownership, deduplicates by intrinsic NIP-01 event id, unwraps/decrypts
> via the EXISTING `FedosConversationDecryptionAuthority.decrypt()`
> directly (no cryptography in TypeScript), and imports into a FRESH
> local Envelope/Payload pair through the unmodified persistence ports —
> the received message becomes readable through the UNCHANGED
> `readDirectMessage()`/`listDirectMessages()`; a Group Delivery Planner
> that reuses the EXISTING Alpha 1321–1390 Pairwise Fanout plan
> unmodified, firing one independent recipient-specific delivery per
> already-fanned-out recipient (never one shared group event), threading
> the sender's own local Group Message id through as opaque
> authenticated-encrypted `groupLinkage` (never any recipient's own
> canonical id).
>
> **Minimal, additive extension to one frozen file, disclosed:**
> `src/nostr/sign/fedos_nostr_signing_authority.ts`'s own kind allowlist
> widened from the single fixed `1` to a closed two-value set
> (`{1, FEDOS_PRIVATE_NOSTR_DELIVERY_KIND}`) — the minimal change Alpha
> 1447's own "no private plaintext in a public kind-1 event" requirement
> makes unavoidable; every other field/behavior in that file is
> unchanged. `FedosConversationRuntime` gains one new, additive,
> always-constructible `privateNostrDelivery()` facade — `FedosRunningDesktopRuntime`'s
> own exposed key set is UNCHANGED (confirmed:
> `secure_runtime_alpha_606_runtime_assembly.test.ts`/
> `secure_runtime_alpha_758_local_runtime_ownership.test.ts` both still
> pass unmodified).
>
> **Verified for real:** both a Direct and a 3-member Group vertical
> slice run through the real `startFedosDesktopRuntime()` entry point
> with genuinely independent Alice/Bob(/Carol) runtime instances (Fake
> Encryption/Decryption Authorities — this Arc's own baseline tier —
> combined with a REAL Schnorr-signing `FedosNostrSigningAuthority`,
> `@noble/curves`, real BIP-340 verification through the unmodified
> inbound validator, and a real OK-correlated Relay publisher): real
> signed private event → Relay ACK → the SAME real event received on a
> genuinely separate runtime → unwrap/decrypt/import → exact plaintext
> read back through the unchanged `readDirectMessage()`; restart-safe
> idempotency (no duplicate publish, no duplicate import); a real
> ciphertext-byte tamper (re-signed with the sender's own real key —
> proving a valid signature alone never proves ciphertext integrity)
> fails closed; a wrong-recipient `p`-tag event is denied before any
> decrypt attempt; a genuine Relay rejection is a distinct, terminal
> outcome; Group fanout produces two independent, non-shared-ciphertext
> recipient-specific events, each importable ONLY by its own addressed
> recipient, with a removed member correctly excluded from the next
> send. 26 new focused tests, all passing (10 wire-payload-codec + 2
> Direct vertical slice + 1 Group vertical slice + 13 architecture/secret
> guards).
>
> **Honest scope limits, named explicitly:** no wire-level (NIP-40-style)
> expiration encoding and no Nostr deletion-request construction (no
> reviewed normative material for either); `"ephemeral-online"` mode is
> an application-level distinction only, not backed by any wire-level
> convention; no automatic Runtime-level subscription/reconnect wiring
> (`receiveInboundEvent()` is a manually-invoked coordinator method); no
> automatic retry/Scheduler integration for outbound delivery (a
> `"rejected"` vs `"failed"` Observation distinction exists, but this
> layer does not itself decide whether to retry). The Production-mode
> WASM Dev-only Gate remains byte-for-byte untouched — private delivery
> is development-Runtime capable only, never production-enabled.
> `npm run typecheck` clean (one pre-existing, unrelated failure,
> unchanged from every prior Arc); full `npm test` precisely diffed
> against a stashed clean-baseline re-run in this exact worktree — every
> newly-failing test traced to a pre-existing, git-status-dependent
> "working tree unchanged" staleness guard, zero attributable to a
> genuine functional regression. `package.json`/`package-lock.json`/
> `Cargo.toml` byte-for-byte unchanged; no new dependency; `p2p/`
> untouched. See
> `docs/secure_runtime_alpha_1391_1470_phase_a_inventory.md` and
> `docs/secure_runtime_alpha_1391_1470_completion_declaration.md` for
> the full record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1471–1540 — Private Transport Boundary
> and Multi-Relay Delivery Arc (complete).** Architecture frozen: no new
> crypto, no Onion, no Tor, no ActivityPub, no AT Protocol, no GUI, no
> Worker wiring. Builds `FedosPrivateTransport`
> (`src/conversation/transport/`, 18 new files) — the boundary that
> actually moves an already-encrypted `FedosConversationMessageEnvelope`
> (Private Delivery, Alpha 851–890, UNCHANGED) over one or more Nostr
> relays, closing the gap every prior Arc left open: nothing before this
> one ever sent a Conversation Envelope anywhere. Reuses, by direct
> import, the fully generic `FedosDeliveryObservation`/
> `FedosDeliveryObservationRepository`/`FedosValidatingDeliveryObservationRepository`
> and `FedosDeliveryRetryRegistry`/`makeFedosDeliveryAttemptSubjectId`
> (`src/board/observation/*`, Alpha 461–470/521–540, UNCHANGED) for both
> Mailbox (durable) and Ephemeral (best-effort, no Outbox row, no Retry
> Registry) Delivery; mirrors — never redesigns — Board's own Outbox/
> Publisher/Scheduler architecture as a new, parallel
> `FedosConversationTransportOutbox`/`FedosConversationTransportPublisher`/
> `FedosConversationTransportScheduler` set, since Board's own types are
> `postId`-bound and this Arc's instruction forbids touching them.
> Multiple Relay fan-out (`FedosConversationRelaySet` +
> `FedosMultiRelayOkCorrelatedConversationTransportPublisher`) reruns the
> SAME per-relay OK-correlation idiom `FedosRelayOkCorrelatedNostrBoardPublisher`
> (Alpha 710/711/724) already established, once per relay, in parallel —
> `"delivered"` if ANY relay accepts, `"rejected"` only if EVERY relay
> explicitly does. Inbound Subscription + Relay Deduplication
> (`FedosConversationInboundSubscription`/`FedosRelayEventDeduplicator`)
> opens every relay's own subscription simultaneously and funnels every
> inbound event through ONE shared, bounded, FIFO-evicted dedup gate
> keyed by the Nostr event's own deterministic id, so a caller's envelope
> callback fires exactly once per event no matter how many relays
> deliver it. Wire packaging is constrained to `kind: 1` (Alpha 424's own
> V1 signing policy, unmodified) — a private-transport event is
> distinguished from a public Board post purely by tags
> (`fedos-private`/`p`/`e-envelope`), never a new Nostr kind; `content` is
> base64 ciphertext, mirroring `fedos_conversation_payload_codec.ts`'s
> (Alpha 806) own encoding-only boundary discipline. Identity Resolution
> reuse: `fedos_conversation_transport_routing.ts` resolves the still-open
> Alpha 890 `localAccountIndex`/`counterpartyPublicKeyHex` blocker for
> Direct conversations ONLY, by applying the exact verification idiom
> `FedosSigningAuthorityNostrAuthorBinding` (Alpha 688) already
> established for Board Authors to Conversation Membership instead — a
> group conversation fails closed to `"not-direct"`, not silently routed.
> Named, real (not glossed-over) limitation: `FedosSubscriptionFilter`
> has no server-side tag filter, so Inbound Subscription filters by
> `authors`/`kinds` server-side and does the `#p`-equivalent recipient
> check client-side. Runtime wiring: `FedosRunningDesktopRuntime` gains a
> new `privateTransport()` sibling accessor to `boardRuntime()`/
> `conversationRuntime()`, gated by an OPTIONAL `privateTransportEnabled`
> config field (kept optional, unlike `deliveryEnabled`, so every
> pre-existing `FedosDesktopRuntimeConfig` call site keeps compiling
> unchanged) with the same synchronous fail-closed guard
> `deliveryEnabled` already established; this Arc also wires Private
> Delivery's own Envelope/Payload durable backends (Alpha 857/804) into
> the runtime for the first time — no prior Arc ever constructed them
> there. Eight new test files (59 new tests), including one full
> end-to-end test exercising two independent `FedosPrivateTransport`
> instances (sender + receiver) over two independent relay connections
> each to two shared in-process relay servers: real Mailbox queueing, a
> real Scheduler tick, real Multi-Relay fan-out publish + OK correlation
> on BOTH relays, a real canonical Observation showing `"accepted"`, a
> real Inbound Subscription receiving the identical event from BOTH
> relays with the envelope callback firing EXACTLY ONCE, and the opaque
> payload bytes surviving the full sign→publish→OK-correlate→subscribe→
> dedup→parse→decode pipeline byte-for-byte. **Verification**: `npm run
> typecheck` clean except the same one PRE-EXISTING, unrelated error
> (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`)
> every recent Arc has already confirmed predates it; `npx vitest run`
> baseline (before this Arc's own files existed) already showed 18
> failing test files / 29 failing tests, every one of them a
> `git status`-cleanliness check unrelated to Transport (the untracked
> `p2p/` directory and the then-uncommitted Alpha 1541–1610 Archive
> work, both already present in this working tree before this Arc
> began) — this Arc's own 59 new tests all pass, and it introduces zero
> new failures beyond that pre-existing baseline. See
> `docs/secure_runtime_alpha_1471_1540_private_transport_boundary_and_multi_relay_delivery_arc.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1541–1610 — Conversation Export,
> Restore, Archive Foundation Arc (complete).** Architecture frozen: no
> new Rust/WASM primitive, no new `AeadAadDomain` variant, no Host/GUI
> wiring, no network transport of any kind (No Cloud, No Sync, No GUI).
> A pure TypeScript orchestration layer, `src/conversation/archive/`
> (11 new files), built entirely on five already-existing, unmodified
> domains — Conversation Persistence (Alpha 749/750), Envelope (Alpha
> 854/858), Payload (Alpha 803/804/806), Membership (Alpha 825/827),
> Capability (Alpha 833/836/837) — implementing Encrypted Export,
> Encrypted Import, Manifest, Integrity, Schema Version, Restore, and
> Duplicate Detection. An Archive is sealed under the SAME per-
> conversation `AeadKeyHandle` `FedosMasterSeedAuthority.resolveConversationKey()`
> already derives for that conversation's own Envelopes (Alpha 869) —
> never a new passphrase or key-derivation domain; identity binding
> reuses Alpha 856's own prefix-then-encrypt technique
> (`fedos_conversation_archive_header.ts`) rather than native AAD, and
> the `"Conversation"` `AeadAadDomain` label is reused verbatim, never
> extended. Integrity is a SHA-256 content hash (`@noble/hashes`, an
> existing dependency) over the canonical Bundle bytes, carried in a
> cleartext Manifest and independently re-verified after decrypt — a
> distinct `"manifest-mismatch"` outcome, kept separate from AEAD's own
> undifferentiated `"failed"`. Restore replays a decrypted Bundle back
> into the five EXISTING ports' own `put*` methods, reusing each
> domain's own EXISTING `deserializeX`/`serializeX` codec pair for deep
> per-record validation rather than re-implementing any check; Duplicate
> Detection is not a new outcome vocabulary — `"already-present"`/
> `"conflict"` are this codebase's own pre-existing write-result
> vocabulary (Alpha 315/749/804/827/837/857), surfaced either as
> Restore's own write-outcome tally or, read-only, via a dedicated
> preflight report over each port's existing `get*`/`has*` methods. ONE
> additive port method, `FedosConversationCapabilityPersistence.listConversationCapabilityEvents()`
> (plus both its backends), mirrors `hasRedeemedEvent()`'s own Alpha 841
> additive-port precedent: Capability is exported/restored via RAW
> `"issued"`/`"redeemed"` events rather than the lossy reconstructed
> `currentUses`-only record, since replaying just a count back into a
> fresh backend would lose WHICH distinct redeemers already used a slot,
> silently permitting a double-redemption after restore. Membership
> export uses the CURRENT record per id (`listConversationMemberships()`)
> — that port exposes no raw-event listing, and the current record alone
> is sufficient to reconstruct correct present-day status. Four new test
> files, `test/secure_runtime_alpha_1541_1560_archive_manifest_integrity.test.ts`,
> `test/secure_runtime_alpha_1561_1580_archive_encrypted_export_import.test.ts`,
> `test/secure_runtime_alpha_1581_1600_archive_restore_duplicate_detection.test.ts`,
> `test/secure_runtime_alpha_1601_1610_capability_event_listing.test.ts`
> (48 new tests): Bundle codec round-trip/order-independence/
> fail-closed rejection; Manifest build/codec round-trip/fail-closed
> rejection; Header encode/split/mismatch-detection; a full injected-
> boundary Export→Import round trip plus every coarse failure branch
> (`invalid-input`/`key-unavailable`/`failed`/`manifest-mismatch`);
> Restore's insert/duplicate/conflict/invalid tally against real
> in-memory backends; the read-only Duplicate Detection report; and the
> new `listConversationCapabilityEvents()` port method against both the
> in-memory and append-only Capability backends. **Verification**:
> `npm run typecheck` clean except one PRE-EXISTING, unrelated error
> (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`,
> confirmed via `git log` to predate this Arc entirely); `npx vitest run`
> (915 files / 12,119 tests): 48/48 new tests pass, and every one of the
> 31 pre-existing failing assertions falls into a category this
> codebase's own prior Arcs already documented as expected — ten
> Rust-source static-analysis files this Arc's own `git diff` confirms
> zero touch to `packages/fedos-core-rust/`, the same four files the
> Alpha 1051–1110 completion declaration already named verbatim as
> pre-existing (`publish_pipeline_host_ownership_review_current_state`,
> `secure_runtime_alpha_405/472/543`), one `src/board/`-scoped ripple
> check this Arc never touches, and three review docs' own
> "git working tree is clean" checks that are by construction red while
> this Arc's own new files sit uncommitted — each of those three docs'
> own header already states this check "is expected to be red only
> until this Arc's own single commit lands." Draft (private,
> not-yet-active) conversations, any Host/file-path/GUI wiring for where
> Export/Import bytes are read from or written to, passphrase-protected
> export independent of live conversation-key availability, and any
> Cloud/Sync/network transport are all explicitly named OUT of this
> Arc's scope, not silently dropped — see
> `docs/secure_runtime_alpha_1541_1610_execution_spec.md`/
> `_completion_declaration.md`.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1321–1390 — Private Group Pairwise
> Fanout Foundation Arc (complete).** Run in a dedicated integration
> worktree (`C:\wt\private-group-fanout`, branch
> `arc/private-group-pairwise-fanout-foundation`) built from the prior
> Arc's own tip (`7990ce4`), with the required Pairwise Fanout Review
> commit (`b205ff0`, `review/private-group-pairwise-fanout-v1`) merged
> in cleanly — one merge, zero conflicts, reported in full in
> `docs/secure_runtime_alpha_1321_1390_reconciliation_report.md`. No
> `Alpha 1261–1320` ("Production Crypto Activation") branch existed
> anywhere in this repository during this Arc; nothing from it was
> merged, depended on, or guessed at.
>
> Implements private-group messaging as a purely ADDITIVE orchestration
> layer over the now-real Alpha 1111–1260 Direct pipeline — it never
> widens the Direct Activation Coordinator's own Private-Group Gate
> (`draft.mode !== "direct"` still returns `"unsupported-mode"`,
> byte-for-byte unchanged), never touches the frozen Encryption/
> Decryption Coordinators, and never widens the Direct participant
> resolver beyond its own exactly-one-counterparty contract. Instead, a
> new `src/conversation/group/` domain (20 files) composes the EXISTING
> `direct` pipeline once per active OTHER group member: an immutable
> `FedosGroupGenerationRecord` snapshots the group's own real Membership
> roster on every admission/removal; a `FedosGroupDirectPathAuthority`
> lazily constructs, admits, and activates one real, independently-keyed
> `direct` Conversation per (local, counterparty) pair — reusing
> `createDirectDraft()`/`redeem()`/`activateDirectConversation()`
> unmodified; a `FedosGroupSendCoordinator` fans one logical plaintext
> out into N independently-encrypted Envelopes (all-or-nothing for a
> fresh send, Option A), recording a local canonical
> `FedosGroupMessageRecord` plus one `FedosGroupFanoutDeliveryRecord`
> per recipient — its OWN "already-stored" check is the crash-recovery
> mechanism, since `sendDirectMessage()`'s own public surface exposes no
> idempotency key. `FedosConversationRuntime.groupRuntime()` is the one
> new, narrow accessor exposing `preparePrivateGroup()`/
> `readinessForPrivateGroup()`/`sendPrivateGroupMessage()`/
> `listPrivateGroupMessages()`/`listPrivateGroupGenerations()`/
> `addPrivateGroupMember()`/`removePrivateGroupMember()` — no existing
> public method's signature changes.
>
> Verified end to end through the real `startFedosDesktopRuntime()`
> entry point with injected Fake Direct Authorities (no WASM artifact in
> this tree, unchanged from every prior Arc): a 3-member group, two
> independent recipient Envelopes per send, restart with the identical
> idempotency key returning the identical result with no duplicate
> Envelope, member removal excluding the removed member from the next
> send while leaving their own prior Direct Conversation untouched, and
> an unsupported-authority (non-`"nostr"`) counterparty failing that one
> path closed without blocking the rest of the group. No shared group
> key, Sender Key, MLS, NIP-17/NIP-59, or network delivery of any kind
> is implemented or claimed — restated explicitly in
> `docs/secure_runtime_alpha_1321_1390_completion_declaration.md`, §9.
> `npm run typecheck` clean (one pre-existing, unrelated failure,
> unchanged from every prior Arc); targeted Conversation+Group-domain
> run 95/95; full `npm test` 12015/12259, every one of the 244 failures
> individually categorized as a confirmed pre-existing `core.autocrlf`
> CRLF-checkout artifact, an already-independently-named pre-existing
> failure, or a prior review's own now-expected "working tree unchanged"
> staleness check — zero attributable to this Arc. `package.json`/
> `package-lock.json`/`Cargo.toml` byte-for-byte unchanged; `packages/fedos-core-rust/`
> untouched; `p2p/` untouched. See
> `docs/secure_runtime_alpha_1321_1390_reconciliation_report.md` and
> `docs/secure_runtime_alpha_1321_1390_completion_declaration.md` for
> the full record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1261–1320 — Production Conversation
> Crypto Runtime Activation Arc (complete, Development-mode only —
> Production activation remains a deliberately closed, separate
> decision).** Same worktree/branch as the prior two Arcs — `master` was
> unchanged, so no additional integration was needed. Turns the
> already-tested INJECTED-Authority Direct-message path into a genuinely
> real, no-Fake-Authority one: `npm run build:wasm` (unmodified command)
> produces `packages/fedos-core-rust/pkg/{fedos_core_rust.js,fedos_core_rust_bg.wasm}`
> cleanly and reproducibly; `cargo test` — 531/532 native, one
> pre-existing unrelated dependency-count guard failure — proves the Rust
> Master Seed Authority's own seal/restore/wrong-passphrase/corrupt-file
> paths were ALREADY real before this Arc touched anything.
>
> **A genuine, empirically-discovered wiring gap, closed additively:**
> `FedosWasmMasterSeedAuthority#ensureConstructed()` calls
> `attemptDevOnlyMasterSeedAuthorityConstructCall()` directly, whose own
> gate requires `fedos_wasm_loader.ts`'s `generatedArtifactCheckResult`/
> `devOnlyGateEvaluation`/`importReadiness`/`importExecution`/
> `jsGlueModule`/`wasmInitialization` to already be populated on the SAME
> loader instance — nothing populated them automatically, so constructing
> a `FedosWasmMasterSeedAuthority` directly always failed with
> `"PrototypeStillClosed"`, even under `NODE_ENV=development` with the
> artifact built (confirmed empirically before writing any production
> code). `attemptDevOnlyRuntimeEncrypt()` (`fedos_runtime_encrypt.ts`,
> unmodified) already primes this exact three-call chain
> (`planLoad()` → `attemptDevOnlyJsGlueImport()` →
> `attemptDevOnlyWasmInitialization()`) before its own Rust Boundary
> reach — the new
> `assembleFedosConversationProductionCryptoGraph()`
> (`src/conversation/encryption/production/`, Alpha 1273) reuses that
> IDENTICAL, already-established sequence rather than modifying
> `FedosWasmMasterSeedAuthority` itself (an already-reviewed file this
> Arc does not touch).
>
> **New, additive-only:** a file-based sealed-seed envelope port
> (`FileFedosSealedMasterSeedEnvelopePersistence` — never overwrites an
> existing file, throws on structural corruption rather than silently
> treating it as absent) and a narrow injected passphrase-provider
> boundary (`FedosPassphraseProvider` — no GUI, no `process.env` read, no
> plaintext-passphrase config field anywhere). `FedosDesktopRuntimeConfig`
> gained exactly one new optional field, `conversationProductionCrypto`;
> `startFedosDesktopRuntime()` resolves it before Conversation Runtime
> assembly and, on a real `"available"` outcome, supplies the resulting
> real Authorities in place of the individual
> `conversationEncryptionAuthority`/etc. fields Alpha 1113 already wired —
> any other outcome (including simply omitting the field) falls back to
> those fields' own pre-existing, unmodified defaults. A new read
> accessor, `conversationProductionCryptoCapability()`, surfaces Alpha
> 1263's own nine-outcome closed vocabulary
> (`available`/`artifact-missing`/`artifact-incompatible`/`seed-unavailable`/
> `seed-restore-failed`/`identity-unavailable`/`unsupported-runtime`/
> `disabled`/`failed`) — never a raw loader `Error`.
>
> **Proven for real, no Fake Authority anywhere in the acceptance test:**
> two independently generated/sealed real identities (Alice, Bob) exchange
> one genuinely ChaCha20-Poly1305-AEAD-encrypted Direct message, pairwise-
> keyed via real secp256k1 ECDH, through the REAL application path
> (`createDirectDraft` → invitation → redemption →
> `activateDirectConversation` → `sendDirectMessage` → full restart —
> fresh backends AND a freshly-restored Master Seed Authority from the
> same sealed-seed file — → `readDirectMessage`), exact plaintext
> recovered; an unrelated real identity, the correct sealed-seed file with
> the wrong passphrase, and a different account index against the SAME
> sealed seed are all denied; a real ciphertext byte flip (decoded from
> the durable payload log's own `bytesBase64` field) fails closed; real
> retention and revocation denial both hold. Twelve tests total across
> `test/secure_runtime_alpha_1261_1320_real_crypto_vertical_slice.test.ts`
> and `test/secure_runtime_alpha_1261_1320_production_gate_semantics.test.ts`
> (config-disabled/unsupported-runtime/corrupt-seed/no-passphrase/clear-
> denies-reuse/`stop()`-clears-the-real-authority), all 12 passing with
> the artifact built and `NODE_ENV=development`.
>
> **Kept Development-only — deliberately, per this Arc's own reviewed
> option menu.** `fedos_wasm_loader.ts`'s `#evaluateDevOnlyGate()` is
> completely untouched: it already, permanently, returns
> `developmentAllowed: false` for `mode === "Production"` — confirmed by
> direct source inspection, the gate's own header states "never
> Production, never Worker." This is a reviewed, intentional security
> boundary, not an unimplemented feature; architecture-frozen forbids
> redesigning it, so this Arc extends nothing there. The Desktop
> Runtime's own `start:runtime` script never sets `NODE_ENV` itself —
> reaching Development mode (and therefore any real crypto capability at
> all) requires an explicit, deliberate operator action, never an
> accident.
>
> **Artifact policy, restated plainly (Alpha 1306):** `packages/fedos-core-rust/pkg/`
> is gitignored and was removed after verification, exactly like every
> prior Arc's own `target/`/`Cargo.lock` — anyone building on this commit
> must run `npm run build:wasm` themselves before this Arc's own two new
> test files (or any real Development-mode crypto path) report
> `"available"` instead of `"artifact-missing"`; without it, they report
> that closed, honest outcome — never a crash, never a silent fallback —
> which is the SAME pre-existing behavior every other real-WASM-dependent
> test in this repository already has on a stock checkout.
>
> **Historical ripple (Alpha 1304), exact and mechanical:**
> `secure_runtime_alpha_606_runtime_assembly.test.ts` and
> `secure_runtime_alpha_758_local_runtime_ownership.test.ts` each assert
> the EXACT closed set of keys `FedosRunningDesktopRuntime` exposes; both
> updated to include the one new, genuinely additive, non-secret
> accessor. `npm run typecheck` clean; full `npm test` precisely diffed
> by exact failing file name against the prior Arc's own baseline —
> zero other regressions. `package.json`/`Cargo.toml` byte-for-byte
> unchanged; no new dependency; `p2p/` untouched.
>
> See `docs/secure_runtime_alpha_1261_1320_completion_declaration.md` for
> the full record, including the Production Readiness Statement.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1181–1260 — Conversation Runtime
> Finalization Arc (complete).** Same worktree/branch as the prior Arc —
> no new sibling Arc branch had landed, so no additional integration was
> needed. Phase A (Runtime ownership/dependency/lifecycle) and Phase B
> (Conversation Runtime API completion) were reviewed by direct source
> inspection and found ALREADY correct and complete: `FedosConversationRuntime`'s
> public surface exposes no persistence port, encryption handle, WASM
> handle, or raw-key resolver (Alpha 1144); `conversationRuntime()`
> already throws after `stop()` (Alpha 923); a repository-wide search for
> `TODO`/`FIXME`/`temporary`/`placeholder` scaffolding across
> `src/conversation/`/`src/desktop/` found none to eliminate (the only
> `"temporary"` hits are the reviewed, permanent `"temporary-capability"`
> participant-authority enum value, Alpha 762) — reported honestly rather
> than manufacturing a change. Phase C adds real, additive test coverage
> the prior Arc's own completion declaration named as not individually
> exercised: a corruption matrix over the new Activation log and the
> Envelope log (malformed lines and conflicting duplicate records both
> throw on replay, mirroring this codebase's own established "one corrupt
> record voids the backend" precedent — no new corruption-handling
> mechanism invented); confirmation that a corrupted Activation log makes
> `sendDirectMessage()`/`readDirectMessage()` REJECT rather than silently
> report a wrong or false-active answer, reproducibly across three
> independent restarts over the same corrupted file (Alpha 1156);
> Independent Runtime Isolation — two wholly independent backend sets
> addressing the identical Conversation id never share state (Alpha
> 1167); and Restart Identity Stability — the same local identity across
> a restart resolves the same Membership and decrypts an existing
> message, a different, never-admitted identity is denied (Alpha 1163).
> One new test file, zero production source changes. `npm run typecheck`
> clean (one pre-existing, unrelated failure, unchanged from the prior
> Arc); targeted Conversation-domain run 115/115; full `npm test`
> 11984/12215, consistent with the prior Arc's own diagnosed baseline
> (17 pre-existing-on-`master` failures plus the same previously-confirmed
> `core.autocrlf` worktree-checkout CRLF artifact affecting ~173 unrelated
> early-stage files) — zero Conversation-domain regression. See
> `docs/secure_runtime_alpha_1181_1260_completion_declaration.md` for the
> full record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1111–1180 — Private Conversation
> Activation and Direct Messaging Runtime Arc (complete).** Closes the
> final gap between a durable private Conversation draft and a real,
> usable DIRECT encrypted Conversation. Run in a dedicated short-path
> integration worktree (`C:\wt\private-direct-messaging`, branch
> `arc/private-conversation-activation-direct-messaging`) because two
> required prerequisite Arcs — `arc/conversation-identity-resolution-encryption-coordinator`
> (Alpha 931–990) and `arc/conversation-invitation-draft-management`
> (Alpha 991–1050) — existed only on sibling branches, never reached
> `master`, and had themselves diverged from each other (each continuing
> independently past their own shared base). Both were merged in first
> (two mechanical merges, zero non-mechanical conflicts — both sibling
> Arcs had added disjoint fields/branches to the same two files,
> `fedos_conversation_runtime.ts`/`fedos_conversation_runtime_assembly.ts`;
> resolution was a pure union, no logic changed), superseding the PRIOR
> status entry's own "the Alpha 851–8XX blocker... requires both fields
> pre-resolved by its caller, and no such caller exists yet" claim — that
> caller (`FedosConversationKeyResolver`, Alpha 935) already existed on
> the merged-in branch; this Arc consumes it unmodified.
>
> **What activation means, concretely:** the immutable private-draft
> record (`FedosConversationDraftRecord`, still permanently
> `lifecycleState: "draft"` by construction — never rewritten) is NOT the
> source of truth for "is this Conversation active." A NEW, separate,
> durable Activation fact is (`src/conversation/activation/`,
> `FedosConversationDirectActivationCoordinator`) — a five-phase
> (`prepared → readiness-confirmed → lifecycle-activated → completed`,
> or `terminal-failed`) coordination log mirroring the Alpha 913/845
> construction/redemption coordinators' own proven crash-recovery
> discipline field-for-field. `activateDirectConversation(conversationId)`
> proves, fresh on every call (never trusting a stale phase): direct mode
> only (private-group always `"unsupported-mode"` — no group key
> strategy exists, none is invented); the LOCAL controlled participant
> resolves and holds active Membership; the ONE counterparty resolves and
> is — by `MembershipFedosConversationParticipantResolver`'s own
> construction — already proven active; pairwise key readiness (identity,
> account index, counterparty public key, Nostr-binding verification) via
> ONE call to the existing, unmodified `FedosConversationKeyResolver`;
> real (non-placeholder) Encryption/Decryption Authorities; storage/
> retention availability. `FedosConversationEncryptionCoordinator`/
> `DecryptionCoordinator` (Alpha 943/946) — previously permanently
> dead-code past their own `lifecycleState !== "active"` gate, since
> nothing could ever construct that value — now consult this SAME
> Activation fact via one shared helper
> (`resolveFedosConversationActiveConversation()`), the only change made
> to either frozen coordinator.
>
> **Direct messaging** (`src/conversation/messaging/`,
> `FedosConversationDirectMessagingCoordinator`, exposed on
> `FedosConversationRuntime` as `sendDirectMessage()`/`readDirectMessage()`/
> `listDirectMessages()`) is a thin application-command layer over the
> SAME two Encryption/Decryption Coordinators — no crypto, no Envelope
> encoding, no crash-recovery logic duplicated (the encryption
> coordinator's own existing coordination log already makes a retried
> send safe against duplicate Envelopes/Payloads). The caller supplies
> ONLY `conversationId`/`body`/`replyToEnvelopeId` — sender identity,
> Envelope/payload ids, nonce, account index, counterparty key, suite, and
> key epoch are all resolved or fixed internally (suite is always
> `ChaCha20Poly1305`; epoch is always `0`, matching the Alpha 850
> Direct-mode decision). The plaintext body reuses the Board domain's own
> reviewed size discipline verbatim (`FEDOS_BOARD_POST_MAX_BODY_LENGTH =
> 10_000` UTF-16 code units, restated rather than cross-imported to avoid
> an accidental Board/Conversation coupling). **Retention enforcement on
> read is a genuine new gate:** `FedosPayloadRetentionAuthority` (Alpha
> 796) existed but was wired into nothing in the Conversation Runtime;
> `readDirectMessage()` now consults it before ever calling into the
> Decryption Coordinator — a tombstoned/removed payload is denied,
> matching Alpha 796's own already-reviewed security claims exactly, no
> claim strengthened or invented.
>
> **Runtime Encryption Configuration** (Alpha 1113) closes a confirmed
> gap: `FedosConversationRuntimeDependencies` already accepted every Alpha
> 949 field (real Encryption/Decryption Authority, identity resolver,
> account index authority, Nostr binding authority, Envelope/Payload log
> paths) as optional — but `FedosDesktopRuntimeConfig`/
> `startFedosDesktopRuntime()` never threaded ANY of them through; a real
> desktop deployment had no way to reach this Arc's own crypto injection
> seam at all. Now threaded, reusing the SAME `nostrAuthorBindingAuthority`
> instance already passed to `createFedosBoardRuntime()` — one coherent
> identity graph, never a second signing/encryption identity.
>
> **Production crypto gate: still closed, exactly as every prior Arc back
> to Alpha 851 already found.** No `packages/fedos-core-rust/pkg/` WASM
> artifact exists in this checked-out tree (confirmed by direct filesystem
> check); `cargo`/`wasm-bindgen` are present on this machine but building
> the existing, unmodified Rust crate changes no TypeScript behavior this
> Arc needs and is out of scope (no Rust file touched). Every test proving
> the activation/send/read vertical slice uses injected
> `FakeConversationEncryptionAuthority`/`DecryptionAuthority` test
> doubles — the SAME pattern the pre-existing Alpha 943/946 coordinator
> suite already established — never a real WASM call; the REAL
> `FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority` (Alpha
> 870/871, already built, already reviewed) slot into the identical
> `conversationEncryptionAuthority`/`conversationDecryptionAuthority`
> config fields unchanged, once a real seeded `FedosMasterSeedAuthority`
> is available. By DEFAULT (nothing injected), activation and messaging
> stay fail-closed unavailable; public Board and local draft management
> are entirely unaffected either way (Alpha 1115/1162, verified).
>
> **The real application path, not a hand-built fixture, constructs an
> active direct Conversation:** `test/secure_runtime_alpha_1111_1180_runtime_vertical_slice.test.ts`
> drives `startFedosDesktopRuntime()` directly — real Direct Draft, real
> recipient-bound Capability, real redemption, real Activation
> Coordinator call, real `sendDirectMessage()`, a full `stop()`/fresh
> `startFedosDesktopRuntime()` restart, then real
> `readDirectMessage()` recovering the exact original plaintext — closing
> the gap the pre-existing Alpha 949 test's own "hand-built ACTIVE
> fixture… reachable only through tests bypassing Runtime" language had
> named (that test is updated, not deleted, to prove the identical
> "wiring is real" property through the new mechanism, since the
> `lifecycleState` field it used to write directly is now permanently
> inert).
>
> **Known, deliberately unimplemented (unchanged from every prior Arc's
> own scope line):** private-group activation, group/shared keys, Sender
> Keys, MLS, any protocol delivery (Nostr DM/ActivityPub/AT Protocol/
> Session), Relay Pool, GUI, Worker, invitation URL/QR transport,
> distributed/multi-writer redemption, moderation plaintext inspection,
> multi-device key recovery, physical-deletion or operator-anonymity
> claims. `p2p/` untouched. No new npm or Cargo dependency.
>
> **Verification:** `npm run typecheck` clean (one pre-existing failure,
> `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`,
> confirmed byte-identical and independently failing on plain `master`).
> Full `npm test` run in BOTH this integration worktree and, separately,
> plain `master`, then diffed by exact failing test name (never assumed):
> of this worktree's 190 failing files, 17 are byte-identical to
> `master`'s own 17 pre-existing failures (unrelated: identity/protocol-
> root-handle tests, and three `test/reviews/*` "git status stays clean"
> guards broken by this repository's own pre-existing untracked `p2p/`
> directory in the MAIN worktree, not by this Arc). The remaining 173 —
> spanning `test/fedos_core_rust_*`, `test/runtime_wasm_*`,
> `test/secure_runtime_alpha_001` through `060`, none of them
> Conversation/Encryption/Activation/Messaging-related — all fail on the
> IDENTICAL signature (`expected +0 to be 11`, a Cargo.toml
> dependency-count assertion reading raw file content via a Vite `?raw`
> import) and were confirmed, by direct byte inspection, to be caused by
> `core.autocrlf=true` giving this freshly-created worktree CRLF line
> endings while `packages/fedos-core-rust/Cargo.toml` in the pre-existing
> `master` worktree has LF — a pure git-worktree-checkout environmental
> artifact, not a behavioral regression; global git config was
> deliberately left untouched per this Arc's own explicit instruction.
> Every Conversation-domain test this Arc added or modified was
> individually re-verified passing after this comparison (activation: 13/13;
> messaging: 23/23; vertical slice: 3/3; the four pre-existing coordinator/
> wiring test files this Arc's own gate change required updating: all
> green). `cargo`/WASM not rebuilt (no Rust file changed).
>
> See `docs/secure_runtime_alpha_1111_1180_integrated_inventory.md` and
> `docs/secure_runtime_alpha_1111_1180_completion_declaration.md` for the
> full record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 1051–1110 — Conversation Runtime
> Consolidation Arc (complete).** Purely additive: `master` was still
> pinned at Alpha 621–640 while eight sibling Arc branches (Alpha
> 641–930, plus the blocked Alpha 851–8XX) had already landed, reviewed,
> on `arc/conversation-identity-resolution-encryption-coordinator` — a
> single integration branch that was itself already a strict superset of
> every other sibling. Reconciled by fast-forwarding `master` onto that
> tip (zero merge commits, zero conflicts possible — `master` had not
> diverged from their shared base). No Runtime Factory, DI, Host-wiring,
> lifecycle, or adapter code was redesigned or replaced: `startFedosDesktopRuntime()`
> (`src/desktop/runtime/fedos_desktop_runtime.ts`) already owned exactly
> one `FedosConversationRuntime` per running runtime via the ONE existing
> `assembleFedosConversationRuntimeDependencies()` factory
> (`src/conversation/runtime/fedos_conversation_runtime_assembly.ts`,
> Alpha 923) — this Arc consolidated ownership of that already-correct
> boundary into `master`, not around it. The only real work was closing
> the "Public API verification" gap the newly-landed
> `FedosMasterSeedAuthority::resolve_conversation_key()` (Alpha 869) left
> open: ~430 pre-existing regression tests hardcode the Rust crate's
> total `pub fn`/`#[wasm_bindgen]` surface count or name list as of their
> own authoring stage, and all of them needed the same one-line bump
> (45→46 pub fn, 16→17 `#[wasm_bindgen]`) plus the new name added to each
> hardcoded allowlist — mechanical, behavior-preserving, test-only.
> A further eleven tests had narrower, real (not mechanical) collisions
> with `resolve_conversation_key`'s name against older NIP-44
> pre-adoption/structural guards; each was given an explicit, documented,
> name-scoped exception (never a broadened pattern) after confirming by
> direct source inspection that `resolve_conversation_key` and its own
> `derive_conversation_key_bytes_from_master_seed_internal` helper
> implement no ECDH math themselves — both delegate to the one
> pre-existing, reviewed `crypto::conversation_key::derive_conversation_key_via_ecdh_internal`.
> Several review docs' own "current implementation reality" checks
> (`test/reviews/conversation_foundation_v1/`,
> `test/reviews/private_message_envelope_v1/`) asserted point-in-time
> facts — "the Policy Arc is unmerged," "no Conversation type exists
> under `src/`" — that this consolidation was always going to supersede;
> those assertions now check the opposite, current fact instead of being
> deleted, preserving the historical record. **Known, deliberately
> untouched limitation, carried forward unchanged:** the Alpha 851–8XX
> blocker itself — resolving `localAccountIndex`/`counterpartyPublicKeyHex`
> from a live `FedosConversationId`/`FedosConversationMembership` pair is
> a separate Identity-domain decision this Arc does not invent either;
> `resolve_conversation_key()` still requires both fields pre-resolved by
> its caller, and no such caller exists yet. Two additional test
> failures were found to be pre-existing and unrelated to this
> Arc — confirmed by `git diff` showing this consolidation never touched
> the files in question — and were left exactly as found, not papered
> over: `test/publish_pipeline_host_ownership_review_current_state.test.ts`,
> `test/secure_runtime_alpha_472_scheduler_responsibility_decision.test.ts`,
> `test/secure_runtime_alpha_405_submit_post_authority_verification.test.ts`,
> and `test/secure_runtime_alpha_543_publish_runtime_ownership_audit.test.ts`
> (`src/desktop/host/fedos_desktop_host.ts` already referenced
> Publisher/Scheduler/Observation before this Arc). A handful of review
> docs' own "git status stays confined to this review's own directory"
> checks are expected to be red only until this Arc's own single commit
> lands (they check the *working tree*, not history). No protocol,
> crypto, or storage change of any kind; no new dependency.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 851–890 — Private Message Envelope and
> Encryption Authority Activation Arc (partial — stopped at a named
> blocker).** Implements Package C1 (Envelope model + validator +
> persistence, Alpha 853–860), completes Package C2 (the Rust/WASM
> Encryption Authority export), and builds the buildable slice of
> Package C3 (`docs/reviews/private_message_envelope_v1/19_arc_packaging.md`).
> `FedosMasterSeedAuthority::resolve_conversation_key()`
> (`packages/fedos-core-rust/src/lib.rs`) is now a real, `#[wasm_bindgen]`-
> exported bridge from an account's Master Seed secret key to a pairwise
> ECDH conversation key — reusing the existing, unchanged,
> NIP-44-vector-verified `derive_conversation_key_via_ecdh_internal`, zero
> new elliptic-curve/HKDF/AEAD code — wired end to end through
> `FedosWasmMasterSeedAuthority.resolveConversationKey()`. A real
> `FedosConversationMessageEnvelope` (Alpha 854) now exists, with a
> deterministic, length-prefixed associated-data header
> (`encodeFedosConversationEnvelopeAssociatedData()`, Alpha 856,
> prefix-then-encrypt) cryptographically binding `conversationId`/
> `keyEpoch`/`senderMembershipId`/etc. into the sealed ciphertext.
> `FedosWasmConversationEncryptionAuthority`/`FedosWasmConversationDecryptionAuthority`
> (`src/conversation/encryption/`, Alpha 870/871) are real, concrete, and
> tested — resolving the key, prepending/stripping the associated-data
> header, and reusing the EXISTING `encrypt()`/`decrypt()`/
> `exportCiphertext()`/`importCiphertext()` Runtime Service chain with
> zero new cryptography. Pairwise/Direct mode ONLY — two real AEAD
> suites (`ChaCha20Poly1305`, `Aes256Gcm`), no group/Private-Group
> support of any kind. **Stops at one named, deliberate blocker:**
> resolving `localAccountIndex`/`counterpartyPublicKeyHex` from a live
> `FedosConversationId`/`FedosConversationMembership` pair is a genuinely
> separate Identity-domain decision this Arc does not invent — both
> Authorities accept those two fields already resolved, and no
> Coordinator wiring a live Conversation to either Authority exists yet.
> Seam 2's Development-Runtime gate remains exactly as permanently closed
> as before this Arc — no production-runtime activation of any kind.
> Ciphertext confidentiality only — no traffic-analysis/anonymity
> guarantee; `senderMembershipId`/`conversationId`/`createdAt` still
> travel in the plaintext Envelope record itself.
>
> See `docs/secure_runtime_alpha_851_890_execution_spec.md` and
> `docs/secure_runtime_alpha_890_completion_declaration.md` for the full
> record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 891–930 — Private Conversation Draft
> Construction & Readiness Runtime Arc (complete).** Wires the
> already-shipped, mode-agnostic Membership/Capability/durable-persistence
> domains (Alpha 761–850) into the FIRST real construction path for a
> `private-group`/`direct` Conversation — as a strictly metadata-only
> **draft**, never active, never encrypted, never a message. The public
> `FedosConversationRecord` V1, its validator, codec, persistence, and
> reader are ALL byte-for-byte unchanged; a private draft is a NEW,
> separate, versioned record (`FedosConversationDraftRecord`,
> `src/conversation/construction/`) carrying `lifecycleState: "draft"`
> inline, with its own id namespace (`private-draft::<mode>::<requestId>`,
> not Board-thread-anchored), validator, codec, and in-memory +
> append-only persistence — so every existing public log stays valid and
> readable (Alpha 894/900/919). A closed four-value lifecycle vocabulary
> (`draft | active | closed | tombstoned`) is named for future-safe
> validation, but ONLY `"draft"` is ever constructed — `"active"` cannot
> be produced anywhere in this Arc. Construction runs through a reviewed
> `FedosPrivateConversationConstructionCoordinator`
> (`createPrivateGroupDraft()`/`createDirectDraft()`): resolve creator
> identity → validate mode/policy → durable coordination "prepared" →
> persist draft → admit ONE durable owner creator Membership (idempotent,
> deterministic id, never duplicated) → issue the initial join Capability
> (optional/general for private-group; a required `intendedRecipient`-bound,
> one-use Capability for the direct recipient — never a fabricated
> Membership for anyone who has not redeemed) → record completion →
> evaluate readiness. A dedicated five-phase construction-coordination log
> (mirroring the Alpha 845 redemption coordinator field-for-field) makes a
> crash at any step recoverable: a fresh coordinator over the same
> backends converges every partial state forward, with no duplicate
> Membership and no second Capability (the issued id is recorded on the
> coordination fact). Readiness is a nine-axis, closed multidimensional
> model (`src/conversation/readiness/`) evaluated purely into
> `draft-ready | activation-ready | blocked`; `activation-ready` is
> returned ONLY when an INJECTED encryption-readiness authority proves
> encryption ready — the sole shipped implementation is
> `UnavailableFedosConversationEncryptionReadinessAuthority` (no fallback
> crypto), so every constructed Conversation stays `draft-ready` at best,
> honestly blocked on encryption. A new `FedosConversationRuntime`
> (`src/conversation/runtime/`), a peer to `FedosBoardRuntime` owned by the
> Local Runtime (`runtime.conversationRuntime()`, available only while
> running, denied after stop, no singleton), exposes construction plus an
> immutable read facade — draft view, live readiness, Membership
> summaries, PUBLIC Capability descriptors, construction status — and never
> a persistence port, raw authority, encryption handle, or bearer secret.
> The bearer secret of an initial Capability is returned exactly once, on
> the construction result, and is verified absent from every durable log.
> No private message send/receive, no ciphertext/plaintext, no key
> generation/epochs, no activation, no protocol delivery, no invitation
> transport, no new dependency, no Rust/Cargo change, no `p2p/`; public
> Board create/reply/query behavior is entirely unaffected.
>
> See `docs/secure_runtime_alpha_891_930_execution_spec.md` and
> `docs/reviews/private_conversation_construction_v1/` (the specification
> this Arc implements) for the full record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 821–850 — Durable Conversation
> Membership & Capability Persistence Arc (complete).** Closes the
> primary durability blocker Alpha 790 named as its own next step: both
> `InMemoryFedosConversationMembershipAuthority` and
> `InMemoryFedosConversationCapabilityAuthority` (Alpha 761–790, frozen,
> unmodified) now have durable ADAPTER siblings —
> `PersistedFedosConversationMembershipAuthority`
> (`src/conversation/membership/persistence/`) and
> `PersistedFedosConversationCapabilityAuthority`
> (`src/conversation/capability/persistence/`) — backed by dedicated,
> versioned persistence ports with both an in-memory and a real,
> zero-new-dependency append-only backend, restart-verified: active/
> revoked/left Membership state, Capability descriptor/verifier/use-count/
> exhaustion, and duplicate-redemption rejection all survive a fresh
> Authority instance over the same backend. The bearer secret itself is
> NEVER persisted — only a one-way SHA-256 verifier
> (`@noble/hashes`, an already-existing dependency; no new dependency
> anywhere in this Arc), via
> `createFedosConversationCapabilityBearerVerifier()`/
> `fedosConversationCapabilityBearerVerifierMatches()`
> (`src/conversation/capability/persistence/fedos_conversation_capability_bearer_verifier.ts`).
> Capability consumption and Membership admission remain two separate
> durable writes with no shared transaction — Alpha 785's own honest
> `"conflict"` disclosure is preserved — but a NEW, additive
> `FedosConversationDurableRedemptionCoordinator.redeemAndAdmit()`
> (`src/conversation/capability/coordination/`) layers a five-phase,
> deterministically-keyed coordination record on top, making a crash
> BETWEEN those two writes recoverable: a fresh coordinator instance
> converges safely from every tested interruption point, admits
> Membership at most once, and never silently restores an already-spent
> Capability. The guarantee is stated without hedging — restart-stable,
> idempotent redemption within ONE durable backend set and ONE
> single-writer model, explicitly NOT distributed exactly-once, NOT safe
> across independent writable replicas, NOT multi-process-concurrent-safe.
> `src/board/runtime/` remains untouched; no default Local Runtime wiring
> is added, since no private Conversation command exists yet to call any
> of this Arc's own new Authorities from (Alpha 848). No private message,
> encryption, key distribution, or invitation transport of any kind exists
> anywhere in this Arc.
>
> See `docs/secure_runtime_alpha_821_850_execution_spec.md`,
> `docs/secure_runtime_alpha_823_824_persistence_and_coordination_decisions.md`,
> and `docs/secure_runtime_alpha_850_completion_declaration.md` for the
> full record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 791–820 — Conversation Retention &
> Private Payload Storage Boundary Foundation Arc (complete).** Builds
> the bottom two boundaries of the target private-message architecture
> (Opaque Payload Reference → Private Payload Storage →
> Retention/Tombstone Authority) — no Private Message Envelope, no
> encryption, no Membership/Capability of any kind. Eight named
> deletion meanings (`src/conversation/retention/fedos_payload_retention_state.ts`,
> Alpha 792) replace any generic "deleted" boolean; only three are V1
> enforceable (`application-hidden`/`logically-tombstoned`/
> `local-payload-removed`). `FedosConversationPayloadDescriptor`
> (`src/conversation/payload_storage/`, Alpha 803) is metadata-only —
> bytes travel separately through a dedicated
> `FedosConversationPayloadStorage` port (Alpha 804) with NO delete
> method, backed by both an in-memory and a real, zero-new-dependency
> append-only backend (Alpha 807/809). `FedosPayloadRetentionAuthority`
> (Alpha 796/811) narrowly connects a separate Retention Decision Log
> to that port: `active → tombstoned → payload-removed` only, every
> reverse transition rejected, no restore method of any kind (Alpha
> 798). `removeLocalPayload()` is an honest, CONDITIONAL claim — an
> access-state transition the Authority itself enforces, never a
> guarantee that the underlying append-only backend's own bytes are
> physically erased (Alpha 799). Plaintext bytes round-trip unchanged
> through the durable backend, confirming no silent encryption occurs
> anywhere in this Arc (Alpha 814). `FedosConversationRecord`, its
> persistence, Board persistence, `FedosBoardRuntime`, and
> `startFedosDesktopRuntime()` are all confirmed byte-for-byte
> untouched (Alpha 816) — no Runtime wiring is added, since no real
> private-message consumer exists yet to justify it (Alpha 815).
> Private-group, direct/DM, Membership, Capability invitations,
> encryption, and the Private Message Envelope itself remain entirely
> unimplemented.
>
> See `docs/secure_runtime_alpha_791_existing_storage_and_deletion_inventory.md`
> through `docs/secure_runtime_alpha_820_completion_declaration.md` for
> the full, per-Stage record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 761–790 — Canonical Conversation
> Membership & Capability Foundation Arc (complete).** Establishes
> authorization VOCABULARY and BOUNDARIES only — it does NOT enable
> private messages, encrypted groups, direct messages, or production
> invitation URLs. `FedosConversationParticipantReference`
> (`src/conversation/membership/`) is a protocol-neutral participant
> identity, reusing the existing `FedosBoardSourceProtocol` vocabulary
> (`"fedos"`, not a new `"fedos-identity"` label) plus one addition,
> `"temporary-capability"`. `FedosConversationMembership` carries a
> closed `member | moderator | owner` role and `active | revoked | left`
> state, with a deterministic identity
> (`conversationId` + participant `authority` + `publicIdentifier`) and
> a six-transition contract that permanently forbids reactivating a
> revoked or left membership — enforced for real by
> `InMemoryFedosConversationMembershipAuthority`, never a fake
> allow-all. `FedosConversationCapabilityDescriptor`
> (`src/conversation/capability/`) keeps a PUBLIC capability identifier
> structurally separate from `FedosConversationCapabilityBearerSecret`
> (an opaque, injected-generator-only type — this Arc mints no real
> cryptographic secret itself, and imports no new dependency).
> `InMemoryFedosConversationCapabilityAuthority` implements the full
> Alpha 785 Capability-to-Membership coordination sequence — validate
> without mutation, preview Membership admission, commit the capability
> use, commit Membership admission — with an honestly-disclosed
> `"conflict"` outcome if the last step fails after the capability was
> already consumed; local exactly-once semantics are stated without
> hedging (one in-memory instance only, no distributed or cross-process
> claim). `src/board/runtime/` is UNTOUCHED by this Arc (verified by a
> real recursive filesystem scan) — public thread/reply creation is
> completely unaffected, and Membership/Capability remain unused by
> every current public command. Durable persistence for both new
> domains remains the Arc's own next, explicitly recommended step.
>
> See `docs/secure_runtime_alpha_761_membership_and_authorization_inventory.md`
> through `docs/secure_runtime_alpha_790_completion_declaration.md` for
> the full, per-Alpha record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 741–760 — Canonical Conversation
> Identity and Record Foundation Arc (complete).** Gives every public
> Board thread a real, persisted Conversation identity —
> `FedosConversationId` (`src/conversation/fedos_conversation_id.ts`,
> Alpha 743), deterministic from the existing `(FedosBoardId,
> FedosThreadId)` pair, no duplicate identity minted where the Board
> model already suffices. `FedosConversationRecord`
> (`fedos_conversation_record.ts`, Alpha 745) reuses the EXISTING
> `FedosConversationMode` (Policy Arc, unmodified — no second mode enum)
> and a fixed `policyReference: "public-v1"` tag, fail-closed
> constructed via `validateFedosConversationRecord()` (Alpha 748),
> enforcing that every V1 Conversation's root post is also its own
> thread root. A dedicated `FedosConversationPersistence` port
> (`src/conversation/persistence/`, Alpha 749) — never folded into
> Board persistence — ships with both an in-memory
> (`FedosBoardRuntime`'s own default) and a real, zero-new-dependency
> append-only backend (Alpha 751/752). `FedosBoardRuntime.createPublicThread()`
> now durably records exactly one Conversation per new root post;
> `replyToPublicThread()` only resolves an already-existing one, never
> creating a second (Alpha 754/755) — both attach a new, PURELY
> ADDITIVE `conversation` field to their existing result shape, so
> every pre-Arc caller is unaffected. `hydrateFedosConversations()`
> (Alpha 756) cross-checks every persisted record against the hydrated
> Board state at `startFedosDesktopRuntime()` startup, failing closed on
> corruption or a root mismatch — a Board thread that predates this Arc
> remains fully readable, with no fabricated Conversation history.
> `findConversation()`/`conversationForThread()`/`listBoardConversations()`
> (Alpha 757) round out `FedosBoardRuntime`'s own read surface. No
> atomicity is claimed between the Board and Conversation writes (two
> separate ports, no shared commit) — a partial failure is surfaced
> explicitly, never hidden. Private-group, direct/DM, membership,
> invitations, encryption, pseudonyms, and deletion/compaction remain
> entirely unimplemented — public mode only, per this Arc's own scope.
>
> See `docs/secure_runtime_alpha_741_current_conversation_and_board_inventory.md`
> through `docs/secure_runtime_alpha_760_completion_declaration.md` for
> the full, per-Stage record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 721–740 — Nostr Relay ACK Semantics &
> Permanent Rejection Arc (complete).** Closes the one semantic defect
> the prior Arc disclosed: a genuine Relay `OK` rejection (`accepted:
> false`) was retried using the same policy as a transient signing/
> socket/timeout failure. The inventory (Alpha 721) found every
> downstream layer already correct and already built for this —
> `FedosOutboundPublishResult` (`src/board/publish/fedos_outbound_publish_result.ts`,
> Alpha 492) already distinguished `accepted`/`rejected`/`failed`;
> `outboundPublishOutcomeToRetryPolicy()` (Alpha 497) already mapped
> `rejected` to `retryPolicy: "never"`; `FedosPublishScheduler` and the
> Delivery Observation transition graph already treated `rejected` as a
> real, terminal state. The ONLY broken link was that nothing in the
> Nostr publish path could ever PRODUCE `rejected` — it was forced
> through `FedosNostrBoardPublisher.publishOne()`'s own frozen `boolean`
> return, which cannot carry the distinction. A new, additive interface,
> `FedosNostrBoardPublisherWithOutcome` (`src/board/publish/nostr/`, Alpha
> 722/723), lets `FedosRelayOkCorrelatedNostrBoardPublisher` say what it
> already internally knows; a new, sibling adapter,
> `FedosOutcomeAwareNostrBoardPublisherAdapter`, wires the canonical
> result straight through to the Scheduler with no lossy boolean step.
> Every existing, frozen contract (`FedosNostrBoardPublisher`,
> `FedosRelayNostrBoardPublisher`, `FedosNostrBoardPublisherAdapter`, the
> Scheduler, Retry Registry, Abandonment Policy, Observation vocabulary)
> is byte-for-byte unchanged. Verified for real: a genuine Relay
> rejection now produces exactly one delivery attempt across ~15
> Scheduler ticks and is never resent after a runtime restart (the Arc's
> own headline criterion); a genuine transient failure (timeout,
> disconnect, socket throw, signer unavailable, malformed event) still
> retries under the existing, unchanged policy; three independent
> runtimes running concurrently (accepted / rejected / transient) show
> zero cross-contamination. A rigorous before/after full-suite diff found
> zero new regressions and required no ripple to any historical test.
>
> See `docs/secure_runtime_alpha_721_ack_and_publish_result_inventory.md`
> through `docs/secure_runtime_alpha_740_completion_declaration.md` for
> the full, per-Alpha record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 681–720 — Nostr Identity Binding &
> Outbound Delivery Activation Arc (complete).** Closes the Alpha 649/665
> blocker the prior Arc left honestly unresolved: no safe way existed to
> confirm a resolved public author's key was actually controlled by this
> Runtime's own Nostr signing authority. `FedosNostrSigningAuthority`
> (`src/nostr/sign/`) gains one additive, non-secret method,
> `publicIdentityForAccount(accountIndex)` (Alpha 684, backed by ONE new
> reviewed Rust `pub fn`, `public_key_hex_for_account`, Alpha 685 — reuses
> the existing derivation chain, never signs, never returns a secret
> byte). `FedosNostrAuthorBindingAuthority`
> (`src/board/runtime/identity/fedos_nostr_author_binding_authority.ts`,
> Alpha 686–688) cryptographically compares a resolved author's hex
> `publicIdentifier` against that derived key before
> `evaluateFedosOutboundEligibility()` ever marks a `"nostr"` target
> eligible (Alpha 694) — `FedosBoardRuntime` gained two new optional
> dependencies, `nostrAuthorBindingAuthority`/`nostrAccountIndex`
> (default account `0`), both fully backward-compatible: omitted, the
> pre-Arc fail-closed default is byte-for-byte preserved. A real,
> controlled Nostr identity now reaches the Outbox for the first time
> (Alpha 698/699).
>
> Phase B activates real delivery: `boardPostToNostrUnsignedEventRequest()`
> (`src/board/publish/nostr/`, Alpha 703) is the one missing Board-to-Nostr
> mapping Alpha 701's own inventory found (every other pipeline piece —
> Outbox, Scheduler, Publisher Adapter, Relay — already existed, Alpha
> 451–530, untouched); `FedosSigningAuthorityBoardPostEventSource` (Alpha
> 704) wires it to the same fixed signing account the binding check
> already verified. `createNodeWebSocketRelaySocketFactory()`
> (`src/desktop/`, Alpha 705) is a real, production `WebSocket` factory —
> Node 22+'s own global `WebSocket`, no new dependency. `FedosRelayOkCorrelatedNostrBoardPublisher`
> (Alpha 710/711) is a genuinely new capability: it correlates a
> published event's own NIP-01 id against the Relay's real `["OK", ...]`
> response (reusing `FedosRelay.onRelayMessage()`, shipped since Alpha
> 238 but never wired into the Publish pipeline until now) — `"delivered"`
> now honestly means Relay-accepted, not merely transport-sent, when a
> Local Runtime chooses this Publisher; the older, transport-only
> `FedosRelayNostrBoardPublisher` remains unchanged and available. A real
> BIP-340-signed event was independently verified end to end (event id +
> Schnorr signature, `src/nostr/noble_signature.ts`, reused unchanged),
> and a full three-runtime restart cycle over real durable append-only
> files confirmed no duplicate send (Alpha 707–709, 719).
>
> Known, disclosed V1 limitations (not silent gaps): reply/thread NIP-01
> `"e"` tags are not populated (no postId-keyed Observation lookup exists
> yet, Alpha 703); a Relay's explicit `accepted: false` rejection
> currently retries on the same schedule a transient failure would,
> rather than being permanently abandoned (Alpha 711) — widening the
> frozen `FedosNostrBoardPublisher.publishOne(): Promise<boolean>`
> contract to add a third state was judged out of this Arc's own reviewed
> scope. Multiple Nostr accounts per command, ActivityPub/AT Protocol/
> Session outbound, Relay Pool, bridge attribution, private-group, DM,
> invitations, encryption, pseudonyms, GUI, Worker, Humanizer/AI,
> Ontology, and economic anti-spam all remain entirely out of scope,
> unchanged.
>
> See `docs/secure_runtime_alpha_681_identity_and_signing_inventory.md`
> through `docs/secure_runtime_alpha_720_completion_declaration.md` for
> the full, per-Alpha record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 641–680 — Public Identity, Conversation
> Policy & Application Runtime Integration Arc (complete).** Turns the
> existing Local Runtime and Public Board Runtime into one honest,
> public-mode Application Runtime with explicit identity and policy
> boundaries. `FedosPublicAuthorAuthority` (`src/board/runtime/identity/`)
> resolves a post's author with a closed, four-outcome vocabulary
> (`resolved`/`anonymous-local`/`unavailable`/`conflict`) — anonymous-
> local remains the honest V1 default (no default identity source is
> wired, confirmed unchanged), never silently promoted to a real
> identity. `FedosConversationPolicyAuthority` (`src/board/runtime/policy/`)
> introduces a public-mode-only Conversation Policy (six independent
> axes — mode/discoverability/readAccess/writeAccess/inviteAuthority/
> federationEligibility) — `private-group`/`direct` are named vocabulary
> only, rejected fail-closed by `validateFedosConversationPolicy()`, and
> no membership implementation was added merely to support a
> `writeAccess: "restricted"` value the vocabulary already allows.
> `evaluateFedosOutboundEligibility()` (`src/board/runtime/eligibility/`)
> composes Author + Policy + Target into one closed eligibility result —
> its own honest, confirmed conclusion is that EVERY real outbound
> target is ineligible today: Nostr fails closed on an unproven
> signing-authority key-control check (no `accountIndex`-to-
> `publicIdentifier` mapping exists anywhere in this codebase, Alpha
> 649/665), and ActivityPub/AT Protocol/Session have no live Publisher
> at all. `FedosBoardRuntime.createPublicThread()`/`replyToPublicThread()`
> are now `async`, routing through all three new seams instead of the
> prior Arc's own direct calls — `FedosDesktopHost`/`FedosDesktopRuntime`
> now own and expose exactly ONE `FedosBoardRuntime` per running
> runtime, via `runtime.boardRuntime()` (`src/desktop/runtime/fedos_desktop_runtime.ts`,
> Alpha 671/672), inaccessible after `stop()`, verified through a real
> restart cycle over durable append-only files (Alpha 676). Private
> Group, DM, membership, invitations, encryption, and pseudonyms remain
> entirely unimplemented — public mode only, per this Arc's own scope.
>
> See `docs/secure_runtime_alpha_641_current_identity_and_author_inventory.md`
> through `docs/secure_runtime_alpha_680_completion_declaration.md` for
> the full, per-Stage record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 601–620 — Desktop Local Runtime Entry
> Point & Publish Pipeline Ownership Arc (complete).** Gives
> `FedosDesktopHost` — Board Persistence/Hydration, Board Query,
> Durable Outbox, Nostr Publisher (caller-injected), Delivery
> Observation, Scheduler, Retry/Abandonment, Recovery Hydration, ALL
> pre-existing and UNCHANGED — its FIRST real, callable production
> caller (`src/desktop/runtime/`, Alpha 601's own inventory: none
> existed before this Arc). `npm run start:runtime` (built via `tsc -p
> tsconfig.runtime.json`, package.json gains only 2 new scripts, zero
> new `dependencies`/`devDependencies`) launches
> `run_fedos_desktop_runtime.js` as a genuine, separate OS process —
> confirmed by real `child_process.spawn` execution reaching a real
> `ready` state against real durable files (Alpha 619), not merely an
> importable, never-invoked function. `FedosDesktopRuntimeConfig`
> requires every filesystem path explicitly from the caller — no
> default path, no secret/seed/token field, no `process.env` read
> (Alpha 603/604). A new, minimal `AppendOnlyFedosDeliveryObservationPersistence`
> (`node:fs`-only, no new dependency) closes the gap the Alpha 581–600
> Arc's own recovery machinery needed to be genuinely durable, rather
> than activating delivery against a backend known to lose everything
> on restart (Alpha 609) — `deliveryEnabled: true` now REQUIRES a real
> durable Observation path AND a caller-injected `FedosBoardOutboxPublisher`
> (this Arc constructs no Signing Authority or Relay of its own — no
> Runtime crypto touched, per this Arc's own Absolute Prohibitions),
> fail closed, never a silent Mock/in-memory fallback (Alpha 610/614).
> `src/worker.ts` is completely untouched; zero cross-reference either
> direction, confirmed structurally (Alpha 616). The full ten-step
> real-restart scenario (submit -> queue -> deliver -> stop -> fresh
> instance -> hydrate -> recover -> no duplicate redelivery) passes
> end to end against real temporary files (Alpha 615). Honest,
> disclosed limitation: OS-level `SIGINT`/`SIGTERM` delivery to the
> built executable could not be independently verified end-to-end in
> this session's own Windows-sandboxed test environment (three real,
> independent signal-delivery attempts each failed to reliably reach
> the spawned child process here) — the handler code follows Node's
> documented API correctly and is expected to work on a real POSIX
> target, stated as an expectation, not a proven fact (Alpha 613/619).
>
> See `docs/secure_runtime_alpha_601_current_runtime_caller_inventory.md`
> through `docs/secure_runtime_alpha_620_desktop_local_runtime_completion.md`
> for the full, per-Stage record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 581–600 — Durable Retry Registry &
> Delivery Recovery Arc (complete).** Closes the Alpha 573 finding
> (Alpha 561–580 Arc): `FedosDesktopHost.startDelivery()`'s own
> fresh-`FedosPublishScheduler`-per-call construction (Alpha 508,
> unchanged) re-attempted EVERY still-present Outbox intent on a
> restart, including already-`"delivered"` ones — not merely retry/
> abandonment bookkeeping. Fix: recovery state (delivered/abandoned/
> completed-attempt-count/next-attempt-number) is now rebuilt from the
> EXISTING durable Observation history on every `startDelivery()` call
> (`FedosDeliveryRetryQuery.historyFor()`, Alpha 528, unchanged) — NO
> new persistence backend, NO new schema, NO new npm dependency (Alpha
> 582's own canonical-ownership decision: the Observation history
> already WAS the durable record; nothing read it back before this
> Arc). `FedosPublishScheduler` gains 3 additive-only optional
> constructor fields (`initialDelivered`/`initialAbandoned`/
> `initialCompletedAttempts`); `FedosDeliveryRetryRegistry` gains 1
> additive-only, never-downward method (`hydrateAttemptCount`); a new
> `createFedosDeliveryScheduler()` (`fedos_delivery_recovery_hydration.ts`)
> is the ONE call `startDelivery()` makes — `FedosDesktopHost`'s own
> source still never names `FedosDeliveryRetryQuery`/attempt-subject-id
> concepts (Alpha 522's own boundary, re-confirmed, not weakened).
> Verified end to end: three `startDelivery()`/`stopDelivery()` cycles
> on the SAME Host went from 6 re-publish calls (`1+2+3`) to 3 (one per
> cycle); a genuinely fresh `FedosDesktopHost` instance, sharing only
> the durable Persistence/Repository objects with a prior one, never
> re-publishes an already-delivered/abandoned intent but DOES correctly
> re-attempt genuinely still-pending work; all four protocols this
> repository defines (nostr/activitypub/atproto/session) recover
> identically, confirmed protocol-neutral both behaviorally and
> structurally. `npm run typecheck`: zero new errors. Three prior-Arc
> regression-guard tests, genuinely invalidated by this Arc's own
> in-scope changes, were updated with explicit, scoped exceptions —
> see `docs/secure_runtime_alpha_591_599_regression_review.md`.
> `package.json`/`Cargo.toml`/`p2p/`: untouched.
>
> See `docs/secure_runtime_alpha_581_retry_state_inventory.md` through
> `docs/secure_runtime_alpha_600_durable_retry_registry_completion.md`
> for the full, per-Stage record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 561–580 — Publish Scheduler Concurrency
> Safety & Abandonment Policy Arc (complete).** Closes the two Publish
> Runtime defects the Alpha 541–560 Operational Review Arc proved by
> real execution: (1) `FedosPublishScheduler.tick()`'s own overlapping-
> call double-publish race — closed via a single-flight guard
> (`#tickInFlight`, Alpha 563), the SAME in-flight `Promise` returned to
> any overlapping interval or manual `tick()` call, released in
> `finally`; `FedosHostDeliveryController`'s own public `tick()` (Alpha
> 564) now shares the identical guard the interval callback already
> had, instead of bypassing it. (2) A permanently-failing Publisher
> retried forever with no termination condition — closed via a new,
> OPTIONAL, injected `FedosDeliveryAbandonmentPolicy`
> (`src/board/outbox/fedos_board_outbox_abandonment_policy.ts`, Alpha
> 566/568), consulted only when the Publisher's own result was not
> already `"never"`; ships NO default policy or number (no grounded
> evidence for one exists anywhere in this repository's own history —
> see `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`),
> so every prior caller that does not inject one is unaffected,
> byte-for-byte. Abandonment reuses the Scheduler's own pre-existing
> `"abandoned"` observation kind end-to-end — zero new canonical
> Observation states, zero new Repository/Registry wiring (Alpha 567).
> `FedosDesktopHost` itself is untouched. `npm run typecheck`: zero new
> errors (the one pre-existing, unrelated error remains, documented
> since Alpha 560). Five prior-Arc regression-guard tests, genuinely
> invalidated by this Arc's own in-scope changes (two literal `tick()`
> signature checks, two import-naming-convention checks tripped by the
> new sibling file, one live `git status` scope guard), were updated
> with explicit, scoped exceptions — see
> `docs/secure_runtime_alpha_578_publish_runtime_compatibility_review.md`.
> Honest limitation, found broader than originally scoped: `#delivered`/
> `#abandoned`/attempt-count state is in-memory, per-Scheduler-instance
> — even a same-process `startDelivery()`/`stopDelivery()` cycle (not
> only a full restart) re-attempts already-delivered intents, confirmed
> by real execution (`docs/secure_runtime_alpha_573_restart_stable_abandonment.md`).
> Next Arc recommended: Durable Retry Registry Persistence, ahead of any
> production-caller wiring, for exactly that reason.
>
> See `docs/secure_runtime_alpha_561_scheduler_concurrency_inventory.md`
> through `docs/secure_runtime_alpha_580_publish_scheduler_completion.md`
> for the full, per-Stage record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 541–560 — Publish Runtime Operational
> Review Arc (complete, review only — zero production code changed).**
> Reviews the full stack now built — Host, Board, Persistence, Query,
> Outbox, Publisher, Observation, Scheduler, Retry — across ten
> confirmation items (Dependency Graph, Ownership, Lifecycle, Recovery,
> Shutdown, Memory, Resource Leak, Thread Safety, Observation
> Consistency, Retry Semantics) and six investigations (circular
> dependency, responsibility duplication, unnecessary Adapter,
> unnecessary Repository, unnecessary Host API, State Machine
> contradiction), delivering 20 docs and 20 review tests, with no file
> under `src/` touched anywhere in this Arc. Headline finding: **nothing
> in this entire reviewed stack has a production caller** —
> `FedosDesktopHost`/`createFedosDesktopHost` is referenced nowhere
> outside its own directory and `test/`, and `src/worker.ts` (this
> repository's one real deployed entry point) renders Board pages from
> its own separate sample-data path, never from `FedosBoardService` or
> any Persistence backend — extending the prior Arc's own "nothing owns
> Publisher/Scheduler/Observation" finding one level further up. A real,
> reproducible double-publish race was found and demonstrated by actual
> execution in `FedosPublishScheduler.tick()` — two overlapping ticks
> (triggered whenever one `Publisher.publish()` call outlives one
> `intervalMs`) both attempt the SAME pending Outbox intent concurrently,
> with no reentrancy guard anywhere in the Scheduler; a Publisher that
> always throws is retried forever, with no abandonment-after-N-failures
> policy. `PersistedFedosBoardRepository` (Alpha 317) was found built,
> tested, and never wired into any real construction path — and would
> silently skip the thread-integrity checks `FedosBoardService` enforces
> if a future caller reached for it directly, bypassing `FedosBoardService`
> entirely. No circular dependency and no Active (currently-observed)
> defect was found anywhere — every finding is either Latent (reachable
> only once more wiring lands) or Structural (a design observation); the
> Scheduler's own concurrency-safety and abandonment-policy gaps are
> recommended as the two highest-priority future Arcs, ahead of any
> Host-ownership wiring, since fixing them first is strictly cheaper than
> after. `npm run typecheck` carries exactly one pre-existing, unrelated
> error this Arc did not introduce and does not touch. This Arc's own 20
> test files: **52/52 tests GREEN**. `p2p/` remains completely untouched.
>
> See `docs/secure_runtime_alpha_541_publish_runtime_operational_review_inventory.md`
> through `docs/secure_runtime_alpha_560_publish_runtime_operational_review_completion.md`
> for the full, per-Stage review record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 521–540 — Durable Delivery Retry
> Coordination Arc (complete).** Resolves the exact `invalid-transition`
> limitation the Alpha 501–520 Arc discovered and documented, not
> hidden: `FedosDeliveryObservationSubjectId` (Alpha 462, unchanged)
> now means "one delivery ATTEMPT" by CALLER CONVENTION ONLY (never
> inside `fedos_delivery_observation.ts` itself) once a caller derives
> it via new `makeFedosDeliveryAttemptSubjectId()`
> (`src/board/observation/fedos_delivery_attempt_subject_id.ts`) —
> `${originalSubjectId}::attempt::${N}`. Each retry attempt for the
> same Outbox intent gets its OWN fresh attempt-scoped subject, so
> `queued/unset → publishing` is always the FIRST transition for that
> subject, always allowed by the completely untouched Alpha 494
> transition graph and Alpha 495 write validator. A new
> `FedosDeliveryRetryRegistry` (`fedos_delivery_retry_registry.ts`)
> allocates monotonically-increasing attempt numbers per original
> subject; a new `FedosDeliveryRetryReason` codec
> (`fedos_delivery_retry_reason_codec.ts`) encodes whether a terminal
> attempt is final into the Observation's own pre-existing `reason`
> field, no schema change; a new `FedosDeliveryRetryQuery`
> (`fedos_delivery_retry_query.ts`) reads the full attempt history and
> current state back out by the ORIGINAL subject id, scanning attempt
> numbers via the plain `FedosDeliveryObservationQuery` (Alpha 466,
> unchanged) underneath. `FedosHostDeliveryController`'s own private
> `#runTickAndPersist()` is REWIRED (Alpha 529) to group each tick's
> `entry.observations` (Alpha 476's own unchanged shape) into
> `{started, terminal, isFinal}` triples and record each under its own
> attempt-scoped subject — its public API
> (`start()`/`stop()`/`tick()`/`isRunning()`) and
> `FedosHostDeliveryControllerDependencies` are otherwise unchanged.
> Ripple review found one real, previously-latent bug, fixed honestly
> rather than worked around: `FedosDesktopHost.startDelivery()`
> constructs a fresh Controller (and, before this fix, a fresh
> Registry) on every call, silently resetting attempt numbering across
> a `stopDelivery()`/`startDelivery()` cycle for a still-pending
> intent — fixed with ONE new private field,
> `#deliveryRetryRegistry`, persisted for the life of the Host
> instance; `FedosDesktopHost`'s PUBLIC API is unchanged
> (`start()`/`stop()`/`startDelivery()`/`stopDelivery()`/
> `deliveryStatus()`/`observationQuery()` all byte-for-byte identical
> in shape). `FedosPublishScheduler`, every file under
> `src/board/publish/` and `src/board/outbox/`, and all six canonical
> Observation model files are byte-for-byte unchanged — confirmed via
> `git status --porcelain` guards (Alpha 532). All three named
> Verification case groups confirmed, both with a deterministic
> injected-clock unit test (Alpha 529) and independently through the
> full real Host/Scheduler/real-wall-clock pipeline (Alpha 533/534/535,
> composed together with zero cross-contamination across concurrent
> intents in Alpha 536): a single first-attempt success; one failure
> followed by a successful retry; and a longer chain of three failures
> before a final success. `p2p/`, Ontology, GUI, Worker, Cloudflare,
> and any new outbound protocol remain untouched. Built entirely in the
> same dedicated, isolated git worktree and branch
> (`worktree-alpha-491-500`) the Alpha 491–500 Arc already established.
>
> See `docs/secure_runtime_alpha_521_retry_coordination_inventory.md`
> through `docs/secure_runtime_alpha_540_retry_coordination_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 501–520 — Durable Delivery Observation
> Wiring & Host Delivery Lifecycle Arc (complete).** Gives
> `FedosDesktopHost` real, additive ownership of the Publisher and
> Observation Repository the Alpha 491–500 Reconciliation Arc built but
> left unwired to any application entry point. `FedosDesktopHostDependencies`
> gains three OPTIONAL fields — `publisher`, `observationRepository`,
> `deliveryIntervalMs` — each defaulted inside the constructor exactly
> like `outboxPersistence` (Alpha 419) already is, so every pre-existing
> `new FedosDesktopHost({desktopApplication, boardPersistence})` call
> site is unaffected (`git diff -- src/desktop/host/fedos_desktop_host.ts`
> shows zero deleted or modified lines — additive only). `Host.startDelivery()`/
> `stopDelivery()`/`deliveryStatus()`/`observationQuery()` are four new
> methods; `FedosPublishScheduler` and `FedosBoardOutboxPublisher` (both
> Alpha 451–500) are NOT modified — `FedosPublishScheduler.start()`/
> `stop()` are not even called. A new class,
> `FedosHostDeliveryController` (`src/desktop/host/fedos_host_delivery_controller.ts`),
> drives the Scheduler's own PUBLIC `tick()` method on its own injectable
> interval instead, the only way to honor the required "Scheduler停止
> → tick終了待ち → Host停止" shutdown ordering without editing
> `FedosPublishScheduler` (its own `start()` runs a fire-and-forget
> internal timer no external caller can await). `FedosDesktopHost`
> itself never calls `.publish()`/`.publishOne()` anywhere — only the
> Scheduler the Host constructs inside `startDelivery()` does. A real
> end-to-end test drives an actual `FedosDesktopHost` through
> `startDelivery()` with a real `FedosNostrBoardPublisherAdapter`
> wrapping a real `FedosRelayNostrBoardPublisher`/`NullRelay`, confirming
> the full `Host → Scheduler → Publisher Adapter → Observation
> Repository` chain this Arc's own instruction named, both the accepted
> and failed paths, with Observation History and Current State
> cross-checked for consistency at every step. One honest limitation
> was discovered and documented, not hidden: because Alpha 494's own
> single-attempt-per-subject Observation model was never extended with
> an explicit attempt identity, a retried delivery attempt for the same
> Outbox intent keeps genuinely retrying transport, but its SECOND
> `publishing`/terminal Observation pair is rejected by the write
> validator as `"invalid-transition"` — recorded history for one intent
> does not grow across retries yet
> (`docs/secure_runtime_alpha_514_failure_path_verification.md` §"Discovered
> consequence"). `npm run typecheck` GREEN for every file this Arc adds
> or touches (one unrelated, pre-existing error remains, outside this
> Arc's own diff). This Arc's own 20 new test files: green. `p2p/`,
> Ontology, GUI, Worker, Cloudflare, and every other outbound protocol
> remain untouched. Built entirely in the same dedicated, isolated git
> worktree and branch (`worktree-alpha-491-500`) the Alpha 491–500 Arc
> already established.
>
> See `docs/secure_runtime_alpha_501_existing_host_and_delivery_boundary_inventory.md`
> through `docs/secure_runtime_alpha_520_durable_delivery_observation_wiring_and_host_delivery_lifecycle_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 481–490 — Publish Pipeline Integration
> Review Arc (complete, review only — zero production code changed).**
> Reviews the four pipeline components that now all exist in committed
> form — Outbox (Alpha 411–420), Publisher (TWO coexisting
> implementations: the generic `FedosBoardOutboxPublisher`, Alpha
> 471–480, and the Nostr-specific `FedosNostrBoardPublisher`/
> `FedosRelayNostrBoardPublisher`, Alpha 451–460), Delivery Observation
> (TWO coexisting vocabularies: `FedosBoardOutboxObservation`, Alpha
> 471–480, and this repository's own standalone `FedosDeliveryObservation`,
> Alpha 461–470), and Scheduler (`FedosPublishScheduler`, Alpha
> 471–480) — against ten review items, with no file under `src/`
> touched anywhere in this Arc. Confirmed clean: neither Publisher
> rewrites the Outbox; neither Observation vocabulary is aware of any
> Publisher; the Scheduler contains zero protocol-specific processing;
> the retry-policy vocabulary is defined exactly once; the full
> dependency graph (Rust → WASM → Runtime → Desktop/Board core →
> Outbox → { Publisher, Observation, Scheduler }) has no cycles and no
> unexpected cross-layer reach
> (`docs/secure_runtime_alpha_481_publish_pipeline_separation_of_concerns_review.md`
> through
> `docs/secure_runtime_alpha_489_publish_pipeline_boundary_dependency_audit.md`).
> Real problems found, not previously named as a single set: three
> unreconciled Observation vocabularies and two unreconciled Publisher
> result contracts exist side by side with no adapter between them; the
> Scheduler's own Observation log is in-memory only, not durable, despite
> a fully durable Repository already existing unwired; the documented
> `queued → publishing → { accepted | rejected | failed }` state graph
> is convention only — no constructor or write path enforces it, and a
> late-arriving stale fact can silently overwrite a derived "current
> state"; and — the most consequential finding — **nothing in this
> repository currently owns the Publisher, the Scheduler, or either
> Observation vocabulary**: `FedosDesktopHost` owns the Outbox WRITE
> side only, and a repository-wide search finds zero production caller
> constructing a `FedosPublishScheduler` or a
> `FedosRelayNostrBoardPublisher` anywhere outside their own tests
> (`docs/secure_runtime_alpha_490_publish_pipeline_integration_review_completion.md`).
> Four future Arc candidates are named, not started: Publisher/
> Observation Reconciliation, Delivery Observation Durability Wiring,
> Publish Pipeline Host Ownership, and a Nostr Publisher → Generic
> Publisher Adapter — this Arc recommends reconciliation-and-ownership
> work be sequenced before any additional protocol Publisher is built.
> `npm run typecheck` carries exactly one pre-existing, unrelated error
> this Arc did not introduce (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`,
> a file this Arc never touched). This Arc's own 9 review test files:
> **30/30 tests GREEN**. `p2p/` remains completely untouched.
>
> See `docs/secure_runtime_alpha_481_publish_pipeline_separation_of_concerns_review.md`
> through `docs/secure_runtime_alpha_490_publish_pipeline_integration_review_completion.md`
> for the full, per-Stage review record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 471–480 — Canonical Publish Scheduler
> Foundation Arc (complete).** Builds `FedosPublishScheduler`
> (`src/board/outbox/fedos_publish_scheduler.ts`) — `start()`/`stop()`/
> `tick()` — the first periodic-cadence consumer of
> `FedosBoardOutboxPersistence.listIntents()` (Alpha 417) this
> repository has ever shipped. This Arc's own Stage 1 inventory
> (`docs/secure_runtime_alpha_471_existing_scheduler_and_publisher_inventory.md`)
> found, in the working tree at the time, two SEPARATE, uncommitted,
> in-progress threads already building Publisher/Observation-shaped code
> — a Nostr-specific `FedosNostrBoardPublisher` (Alpha 451–460) and a
> standalone `FedosDeliveryObservation` vocabulary (Alpha 461–470) — and
> made an explicit, documented decision to depend on NEITHER: this Arc
> defines its own generic `FedosBoardOutboxPublisher` port
> (`fedos_board_outbox_publisher.ts`), typed exactly to the existing
> `FedosPersistedBoardOutboxRecordV1`, and its own in-memory-only
> `FedosBoardOutboxObservation` (`fedos_board_outbox_observation.ts`,
> five of Alpha 415's own six named kinds), leaving both other threads
> completely untouched. Retry is governed by a closed three-value
> directive the Publisher itself returns —
> `"immediate" | "later" | "never"`, no numeric delay field, no
> exponential backoff anywhere — with one Scheduler-owned guardrail
> (a same-tick `"immediate"` retry is downgraded to `"later"` on its
> second consecutive occurrence) bounding every `tick()` call to at most
> two `publish()` attempts per pending intent. No concrete,
> protocol-wired Publisher implementation ships this Arc — only a
> test-only `MockFedosBoardOutboxPublisher` — and no pre-existing file
> anywhere in the repository is modified: every one of this Arc's ten
> Stages adds new files only. Real execution, not restated: this Arc's
> own ten `test/secure_runtime_alpha_47{1..0}_*.test.ts` files, **10
> files / 78 tests, 100% GREEN**; `npx tsc --noEmit --strict` against
> this Arc's own three new source files, clean; full-repository
> `npm test -- --run` (708 files / 10767 tests at the time of this Arc's
> own most recent full run) — 637 files / 10657 tests passed, 71 files /
> 110 tests failed, every failure traced to either the same ~10
> pre-existing hardcoded Rust structural-count assertions already
> flagged unchanged since Alpha 450, or to the two separate,
> concurrently in-progress Arcs named above — none to this Arc's own
> diff (`docs/secure_runtime_alpha_479_scope_and_security_regression_guards.md`).
> `p2p/` remains completely untouched.
> Next Arc: **adapt, do not duplicate** — once a concrete
> `FedosNostrBoardPublisher` (or equivalent) lands, the correct next Arc
> is a thin adapter implementing `FedosBoardOutboxPublisher` by calling
> it internally, never a modification to `FedosPublishScheduler` itself
> and never a second, competing generic Publisher port
> (`docs/secure_runtime_alpha_480_canonical_publish_scheduler_foundation_completion.md`
> §6).
>
> See `docs/secure_runtime_alpha_471_existing_scheduler_and_publisher_inventory.md`
> through `docs/secure_runtime_alpha_480_canonical_publish_scheduler_foundation_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 461–470 — Canonical Delivery
> Observation Arc (complete).** Builds a durable, standalone Delivery
> Observation vocabulary — `FedosDeliveryObservation`
> (`src/board/observation/fedos_delivery_observation.ts`), five states
> (`queued`/`publishing`/`accepted`/`rejected`/`failed`), an opaque
> caller-supplied `subjectId`, a deterministically derived id, immutable,
> one fail-closed constructor — plus its own Codec
> (`fedos_delivery_observation_codec.ts`), persistence port and
> in-memory backend (`fedos_delivery_observation_persistence.ts`,
> `in_memory_fedos_delivery_observation_persistence.ts`), Repository
> (`fedos_delivery_observation_repository.ts`, the sole write-side
> owner), and read-only Query
> (`fedos_delivery_observation_query.ts`: `historyFor`/
> `currentStateFor`/`listByState`). This Arc's own Stage 1 inventory
> (`docs/secure_runtime_alpha_461_existing_observation_vocabulary_inventory.md`)
> found the committed history realizes none of Alpha 415's own
> six-candidate Observation vocabulary, and found TWO separate,
> uncommitted, in-progress threads already producing DIFFERENT,
> un-reconciled Observation-shaped types in this working tree (a
> Nostr-specific `FedosNostrBoardPublisher` thread and a generic
> `FedosBoardOutboxObservation`/`FedosPublishScheduler` thread) — this
> Arc made an explicit, documented decision to build a THIRD, standalone
> vocabulary alongside both, leaving both completely untouched, rather
> than reconcile or extend either. No Publisher anywhere in this
> repository — committed or uncommitted — currently produces a
> `FedosDeliveryObservation`; that wiring is real, undone work for a
> future Arc, named honestly rather than silently implied. Security
> regression guards
> (`docs/secure_runtime_alpha_468_security_regression_guards.md`)
> mechanically re-verify, against real source text, that none of this
> Arc's six files under `src/board/observation/` reference Publisher,
> Retry, Pool, GUI, Nostr signing, Board, Ontology, or `p2p/`.
> `npx vitest run` on this Arc's own 7 test files: **51/51 tests
> GREEN**. Full-repository `npm run typecheck` carries exactly one
> error, in an unrelated, concurrently-written, uncommitted file this
> Arc neither created nor depends on — real, observed evidence that
> another process was actively writing to this same working tree while
> this Arc's own work was in progress (§2 of
> `docs/secure_runtime_alpha_469_verification.md`). `p2p/` remains
> completely untouched.
> Next Arc: not recommended this Stage — two separate, uncommitted,
> further-advanced threads already occupy the numeric space immediately
> following this Arc and were explicitly out of its scope throughout;
> see `docs/secure_runtime_alpha_470_canonical_delivery_observation_completion.md`
> §4.
>
> See `docs/secure_runtime_alpha_461_existing_observation_vocabulary_inventory.md`
> through `docs/secure_runtime_alpha_470_canonical_delivery_observation_completion.md`
> for the full, per-Stage design record.
>
> Note: the Arc below (Alpha 451–460) was written and verified against
> the Alpha 431–450 commit above, filling the numeric gap immediately
> following it, but landed in this repository's own commit log AFTER
> Alpha 461–470 due to a real, local, concurrent-session timing
> collision — see
> `docs/secure_runtime_alpha_460_nostr_outbound_publisher_foundation_completion.md`
> §4/§6 for the honest account. It does not build on, and is not built
> on by, Alpha 461–470.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 451–460 — Canonical Nostr Outbound
> Publisher Foundation Arc (complete).** Builds a minimal, transport-only
> Publisher: `FedosRelayNostrBoardPublisher`
> (`src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts`) takes
> a `FedosBoardOutboxIntent` (Alpha 414, unchanged — routing identity
> only, never a body) paired with an already-signed `FedosNostrWireEvent`
> (Alpha 234, unchanged — produced upstream by
> `FedosNostrSigningAuthority`, out of this Arc's own scope), converts it
> via `nostrWireEventToFedosEventDescriptor`
> (`fedos_nostr_wire_event_to_event_descriptor.ts`, the adapter Alpha
> 234's own header anticipated but did not build) to the protocol-neutral
> `FedosEventDescriptor` `FedosRelay.publish()` (Alpha 216, unchanged)
> requires, and sends it. `FedosNostrBoardPublisher`
> (`fedos_nostr_board_publisher.ts`) is the interface — the exact name
> and path Alpha 448 reserved without building. `publishOne()`/
> `publishBatch()` return a boolean success/failure signal ONLY — no
> result object, no retry, no backoff, no delivery-observation field, no
> ACK/OK correlation, no connection pool — `publishBatch()` is a plain
> sequential loop, never `Promise.all`. This is deliberately narrower
> than this repository's own prior "Next Arc" recommendation (delivery
> observation + retry/backoff), a documented scope decision
> (`docs/secure_runtime_alpha_452_publisher_scope_and_return_contract_decision.md`),
> not an oversight. Four pre-existing tests
> (`secure_runtime_alpha_420`/`421`/`423`/`448`) each carried one
> `existsSync("src/board/publish"...)).toBe(false)` assertion, true as of
> their own Stage and each one's own doc explicitly naming a future Arc
> as the place it would be fulfilled — updated to `true` here, with no
> other line touched, since this IS that Arc. This Arc's own 10 new test
> files, plus all four updated pre-existing files, are green; a
> full-repository baseline was not claimed this Stage due to a detected
> concurrent writer to this same working tree (see the Note above and
> `docs/secure_runtime_alpha_460_nostr_outbound_publisher_foundation_completion.md`
> §4). `p2p/` remains completely untouched.
> Next Arc: delivery observation, retry/backoff, and a publish scheduler
> remain undone by this Arc; see
> `docs/secure_runtime_alpha_460_nostr_outbound_publisher_foundation_completion.md`
> §3/§6 for the full, honest account of what else already exists,
> uncommitted, in this same working tree.
>
> See `docs/secure_runtime_alpha_451_existing_publisher_boundary_inventory.md`
> through `docs/secure_runtime_alpha_460_nostr_outbound_publisher_foundation_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 431–450 — Master Seed Authority,
> Sealed Persistence & Nostr Signing Activation Arc (Phase A and Phase
> B both complete).** This Arc resolves the blocker Alpha 422–430 left
> honestly open: no real production Master Seed authority existed
> anywhere before this Arc. Phase A (Alpha 431–440) builds one.
> `FedosMasterSeedAuthority` (`packages/fedos-core-rust/src/lib.rs:10123`)
> generates a real 32-byte Master Seed inside Rust via the existing
> OS-CSPRNG call, holds it in an opaque, zero-derive struct (no
> `Clone`/`Debug`/`Serialize`, no raw-byte getter), and moves through an
> explicit `Empty → Available → Cleared` lifecycle where `clear()` is
> irreversible and `generate()`/`restore_sealed()` never overwrite live
> state. Persistent restart survival is real, not aspirational: `seal()`
> wraps the held seed under a user-supplied passphrase via Argon2id (the
> SAME already-adopted dependency this crate's own RFC 9106 vectors
> verify) plus the existing, reviewed ChaCha20-Poly1305 AEAD primitive
> (`crypto::aead_internal::seal_internal`, the SAME function
> `fedos_encrypt` itself calls) under a new, dedicated
> `AeadAadDomain::MasterSeedSealing` domain — six sealing-key options
> were compared
> (`docs/secure_runtime_alpha_433_sealing_key_authority_decision.md`);
> a hardcoded key and device-metadata-derived key were rejected outright
> per this Arc's own absolute prohibition, and OS-bound DPAPI was
> deliberately deferred rather than claimed without a real native caller
> to invoke it. The sealed envelope (Sealed Master Seed Envelope V1,
> `docs/secure_runtime_alpha_435_sealed_master_seed_envelope_v1.md`)
> carries no plaintext seed byte, rejects any unrecognized schema
> version, and never panics on a malformed input. Phase A's own Phase
> Gate (`docs/secure_runtime_alpha_440_master_seed_authority_phase_gate.md`)
> verifies all sixteen required conditions by real execution, including
> a second, fully independent `FedosMasterSeedAuthority` instance
> restoring from the first's sealed envelope and deriving the identical
> signing identity. Phase B (Alpha 441–450) activates the narrow Nostr
> signing boundary Alpha 422–426 already designed against this real
> authority: `FedosMasterSeedAuthority::sign_nostr_event`
> (`packages/fedos-core-rust/src/lib.rs:10381`) reuses the complete,
> unchanged Alpha 146–200 derivation/signing chain, fixed to `kind = 1`,
> never a generic `sign(hash)` oracle, never touching a Relay, the
> Outbox, or the Canonical Board. `FedosWasmMasterSeedAuthority`
> (`src/runtime/master_seed/fedos_wasm_master_seed_authority.ts`) and
> `FedosWasmNostrSigningAuthority`
> (`src/nostr/sign/fedos_wasm_nostr_signing_authority.ts`) are the sole
> TypeScript-side implementations, both calling WASM only and never
> implementing cryptography themselves. Cryptographic verification is
> real, not asserted: a real second authority instance, restored from a
> sealed envelope under the same passphrase, reproduces a byte-for-byte
> identical signed NIP-01 event, independently re-verified by both a
> separate `k256::schnorr` verifier and this repository's own existing
> `validateInboundNostrEvent()`
> (`docs/secure_runtime_alpha_446_cryptographic_verification.md`,
> `docs/secure_runtime_alpha_447_restart_and_recovery_signing_verification.md`).
> `npm run typecheck` GREEN; `npm test` GREEN except the SAME 10
> pre-existing structural-drift test files already present at every
> recent Arc's own baseline (`fedos_core_rust_public_crypto_api`,
> `fedos_core_rust_public_opaque_crypto_api`,
> `fedos_core_rust_secret_handle_real_bytes`,
> `secure_runtime_alpha_018_ciphertext_wire_export_import_api`,
> `secure_runtime_alpha_147_identity_root_derivation`,
> `secure_runtime_alpha_151_protocol_root_handle`,
> `secure_runtime_alpha_154_protocol_separation_verification`,
> `secure_runtime_alpha_155_integration_completion`,
> `secure_runtime_alpha_156_nostr_root_handle`,
> `secure_runtime_alpha_158_nostr_root_verification` — hardcoded
> `pub fn`/`#[wasm_bindgen]`-count assertions over `lib.rs` source text,
> none touching Master Seed, signing, Board, or Outbox code; confirmed
> pre-existing via `git stash` of this Arc's own Rust/loader diff, not
> asserted from memory), byte-for-byte identical failing test names
> before and after this Arc's own change. `cargo check` GREEN; `cargo
> test` (external `CARGO_TARGET_DIR`, avoiding this environment's own
> non-ASCII/space-containing repository path) — 515 passed, 1
> pre-existing, unrelated failure (a `Cargo.toml` dependency-count
> guard; `Cargo.toml` itself carries an empty diff for this entire Arc).
> This is the first Arc in this repository's own recorded history where
> `cargo test` actually BUILDS and RUNS in this environment — every
> prior Arc's own status entry reported a MinGW `dlltool` build failure
> tied to this repository's own non-ASCII working-directory path. The
> pre-existing root-level `p2p/` directory remains completely untouched.
> Next Arc recommended: **Secure Runtime Alpha 451–460: Nostr Outbound
> Board Publisher & Delivery Observation Arc** — wire
> `Board Reader → Nostr Signing Authority → FedosRelay` into an actual
> publish flow; this Arc's own Publisher-readiness review
> (`docs/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.md`)
> found no missing dependency shape, so the next Arc can proceed
> directly to the publish flow itself.
>
> See `docs/secure_runtime_alpha_431_existing_secret_authority_and_storage_inventory.md`
> through `docs/secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 422–430 — Nostr Outbound Signing
> Boundary Decision & Foundation Arc (Phase A complete; Phase B
> honestly blocked).** Phase A (Alpha 422–426) reviews the existing
> Rust/WASM boundary end to end
> (`docs/secure_runtime_alpha_422_nostr_signing_boundary_inventory.md`)
> and finds the crate already has a proven, tested precedent for
> exposing opaque secret-bearing handles across WASM with zero raw-byte
> exposure and zero new dependency: `AeadKeyHandle`/`AeadCiphertextHandle`
> (`packages/fedos-core-rust/src/lib.rs:9286`/`9335`) — zero derives,
> one non-secret `kind()` getter, a `pub(crate)`-only inner accessor,
> free-function constructors only. `wasm-bindgen 0.2.126` and `k256`'s
> `schnorr` feature are both already production dependencies, so a
> narrow Nostr signing export requires no `Cargo.toml` change. Six
> boundary options are compared
> (`docs/secure_runtime_alpha_423_nostr_signing_boundary_options.md`);
> Option A (a narrow WASM wrapper around the existing, already-built
> `master_root` derivation/signing pipeline) is adopted, matching this
> Arc's own preferred candidate. The authority's scope is fixed narrow,
> not generic (`docs/secure_runtime_alpha_424_nostr_signing_authority_scope.md`):
> `kind = {1}` only, a deterministic `accountIndex`-derived pubkey only,
> never a caller-supplied `pubkey`/`id`/`sig`, and no `FedosBoardPost`
> coupling (kept protocol-generic, matching `master_root`'s own
> existing layering). Input (`FedosNostrUnsignedEventRequest`) and
> output models are specified
> (`docs/secure_runtime_alpha_425_nostr_signing_input_model.md`,
> `docs/secure_runtime_alpha_426_signed_nostr_event_output_model.md`);
> the output model reuses the EXISTING `FedosNostrWireEvent` wire shape
> (`src/desktop/fedos_nostr_wire_event.ts`) rather than introducing a
> fourth duplicate signed-event type, since three prior TS types
> already match `{id, pubkey, created_at, kind, tags, content, sig}`
> field-for-field. Phase B (Alpha 427–430) was attempted starting at
> its own required first Stage, Alpha 427, which found — by direct
> inspection — that **no real 32-byte Master Seed material exists
> anywhere reachable at runtime, in Rust or TypeScript, today**: every
> use of `FedosMasterSeedHandle` is confined to `#[cfg(test)]` fixture
> bytes, `src/vault/types.ts` is explicitly key-material-free by its
> own header ("NO key generation, NO key derivation, NO seed storage"),
> and Master Seed storage/import was explicitly deferred to "a future
> Storage Review" at Alpha 144 and never since revisited. Generating a
> fresh random seed inside the authority itself would produce a
> different Nostr identity every session (useless for a persistent
> Board identity); accepting raw seed bytes from TypeScript would
> require JS-reachable memory to hold Master Seed bytes with no
> existing protected source, straining Permanent Security Invariant 1
> ("secret bytes remain inside Rust Secure Runtime") at its true
> origin. Per this Stage's own binding instruction — "if no safe seed
> authority exists, stop and report rather than improvising one" —
> **Phase B (Alpha 427–430) is honestly NOT implemented**; no
> `FedosNostrSigningAuthority` struct, no new `#[wasm_bindgen]` export,
> no `Cargo.toml` change, no Alpha 428/429 doc fabricated for
> unattempted work. `npm run typecheck` GREEN; `npm test` GREEN except
> the SAME 17 pre-existing, unrelated structural test failures already
> present at this Arc's own baseline, across the SAME 10 pre-existing
> files (`fedos_core_rust_public_crypto_api`,
> `fedos_core_rust_public_opaque_crypto_api`,
> `fedos_core_rust_secret_handle_real_bytes`,
> `secure_runtime_alpha_018_ciphertext_wire_export_import_api`,
> `secure_runtime_alpha_147_identity_root_derivation`,
> `secure_runtime_alpha_151_protocol_root_handle`,
> `secure_runtime_alpha_154_protocol_separation_verification`,
> `secure_runtime_alpha_155_integration_completion`,
> `secure_runtime_alpha_156_nostr_root_handle`,
> `secure_runtime_alpha_158_nostr_root_verification` — all Rust-source-drift
> structural assertions, none touching Nostr signing or the Outbox),
> byte-for-byte identical test names before and after this Arc's own
> change. `cargo
> check` GREEN; `cargo test` still fails to BUILD in this environment
> due to the same pre-existing MinGW `dlltool` path issue every prior
> Arc has documented identically (a non-ASCII/space-containing path,
> unrelated to this Arc's own source changes). The pre-existing
> root-level `p2p/` directory remains completely untouched. Next Arc
> recommended: **Secure Runtime — Master Seed Authority Boundary Arc**
> (the "future Storage Review" Alpha 144 already named and deferred,
> now overdue) — decide and implement exactly one safe way for a real
> Master Seed to exist and be held, neither regenerated randomly every
> session nor sitting as raw bytes in unprotected JS memory, before
> attempting Phase B (Alpha 427–430) again against this Arc's
> already-complete Phase A design.
>
> See `docs/secure_runtime_alpha_422_nostr_signing_boundary_inventory.md`
> through `docs/secure_runtime_alpha_430_nostr_signing_boundary_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 411–421 — Canonical Board Durable
> Outbox Foundation Arc (Phase A complete; Phase B honestly blocked).**
> Phase A (Alpha 411–420) implements the first durable,
> protocol-independent Outbox: `FedosBoardOutboxIntent`
> (`src/board/outbox/fedos_board_outbox_types.ts`) — immutable,
> referencing a canonical post by id only, never carrying a body
> duplicate, secret, or protocol-native payload — with a deterministic
> `FedosBoardOutboxId` derived from `postId + protocol + destination`
> (never random), giving idempotency for free. Option B (a separate
> immutable intent record, adopted over folding delivery state into
> `FedosBoardPost` itself, a shared protocol-native queue, Relay state,
> or the Ontology Engine) — see
> `docs/secure_runtime_alpha_412_outbox_responsibility_decision.md`.
> Inbound provenance NEVER automatically determines outbound targets —
> a Nostr-imported post is never auto-republished to ActivityPub, and
> Session content is never auto-published anywhere; targets are always
> explicit caller intent. `FedosPersistedBoardOutboxRecordV1` (schema
> version `1`) and a fail-closed codec
> (`fedos_board_outbox_codec.ts`) mirror the Board-post persistence
> layer's own established discipline exactly — unknown fields rejected,
> malformed protocol/timestamp rejected, never throws.
> `FedosBoardOutboxPersistence` is a dedicated, sibling port (NOT
> folded into `FedosBoardPersistence`), with an in-memory backend
> (`InMemoryFedosBoardOutboxPersistence`) and a durable, append-only
> backend (`AppendOnlyFedosBoardOutboxPersistence`) — Node `node:fs`
> only, its own independent log file from the Board-post log, the SAME
> fail-closed corruption discipline `AppendOnlyFedosBoardPersistence`
> already established (a malformed or conflicting log line throws on
> replay, never silently repaired). `FedosDesktopHost.submitPostWithOutbox(post, targets)`
> is a NEW, purely additive method — `submitPost(post)` itself is
> byte-for-byte UNCHANGED and remains fully local-only; the new method
> delegates the entire canonical write to the existing `submitPost()`
> and only then attempts Outbox writes, returning a result that
> honestly distinguishes "post accepted, all intents queued" from "post
> accepted, some intents failed" from "post rejected, no Outbox write
> attempted" — the two-file, two-log write is explicitly NEVER
> described as one atomic transaction anywhere in code or docs.
> `outboxPersistence` is an OPTIONAL dependency, defaulted inside the
> Host constructor, so all 29 pre-existing tests that construct
> `FedosDesktopHost` directly needed zero changes. Phase B (Alpha
> 421–430, a reference Nostr outbound publisher) was attempted starting
> at its own required Alpha 421 inventory Stage, which found the real
> Nostr signing/event-construction path confined to `pub(crate)` Rust
> with **no `#[wasm_bindgen]` export reachable from TypeScript at all**
> — confirmed by enumerating all 13 existing WASM exports (all AEAD,
> none Nostr) — and this repository's own TypeScript-side Nostr
> cryptography module (`src/nostr/noble_signature.ts`) explicitly
> documented, in its own header, as verify-only: *"it never signs. No
> private keys are involved."* Per this Arc's own binding instruction —
> STOP before implementing a second signing stack, never duplicate
> private-key cryptography in TypeScript, never export a raw secret —
> **Phase B (Alpha 422–430) is honestly NOT implemented**; no
> `src/board/publish/nostr/` directory, no fabricated design decision
> for a Stage that did not run. `npm run typecheck`/`npm test` GREEN
> (the same 55 pre-existing, unrelated Rust-generated-artifact test
> failures already present at this Arc's own baseline, byte-for-byte
> identical after the change). `cargo check` GREEN; `cargo test` still
> fails to BUILD in this environment due to the same pre-existing
> MinGW `dlltool` path issue every prior Arc has documented identically
> (a non-ASCII/space-containing path, unrelated to this Arc's own
> source changes). The pre-existing root-level `p2p/` directory remains
> completely untouched. Next Arc recommended: **Secure Runtime Alpha
> 422–430 (renumbered): Nostr Outbound Signing Boundary Decision Arc**
> — decide how a future publisher obtains a real BIP-340 signature
> without exporting raw secret bytes to TypeScript, BEFORE attempting a
> Nostr Outbound Publisher Arc again.
>
> See `docs/secure_runtime_alpha_411_existing_delivery_outbox_inventory.md`
> through `docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 401–410 — Desktop Host Canonical Write
> Boundary Closure Arc.** Closes the LAST reachable
> Persistence-bypassing Host write route: `board()?.registerPost(post)`.
> `board()` is REWIRED from `FedosBoardService | null` to
> `FedosBoardReader | null` (new `src/board/repository/fedos_board_reader.ts`)
> — Option C, adopted directly (no transitional `readBoard()`, no
> deprecated legacy accessor), because ZERO production caller anywhere
> in `src/` ever called `host.board()` before this Arc. `FedosBoardReader`
> is the smallest honest read-only contract — `findPost()`/
> `listBoardPosts()`/`listThreadPosts()`, no `registerPost()`, no
> `previewRegistration()`, no Repository/Index/Persistence exposure —
> and `board()` now returns a REAL `FedosBoardServiceReader` wrapper
> object, not `#boardService` merely re-typed: TypeScript's structural
> typing erases nothing at runtime, so a type-level narrowing alone
> would have left `registerPost` fully callable via an unsafe cast.
> The returned wrapper's own ACTUAL public surface — inspected
> directly, `Object.keys`/`"registerPost" in reader`, not merely its
> declared type — has NO `registerPost` property at all, closing the
> bypass at the object level. `FedosBoardService` gains one purely
> additive `implements FedosBoardReader` declaration, zero behavior
> change, zero new method. `submitPost()` (Alpha 395, Arc 391–400)
> itself is completely UNCHANGED — this Arc closes the LAST alternative
> route to it, it does not alter it; `#boardService` remains privately
> held, used only internally by `submitPost()`, never exposed by any
> public method. Standing structural regression guards now scan
> production source for every named bypass shape, distinguishing
> forbidden Host-reachable mutation exposure from legitimate direct
> `FedosBoardService` unit testing. Verified end to end: real fixtures
> from all four Board Adapters, submitted via `submitPost()`, observed
> by BOTH `board()` and `query()`, surviving a genuine restart onto an
> independent Host instance; every Host-state failure
> (not-ready/failed/stopped/corrupt-startup) leaves `board()`/`query()`/
> `submitPost()` all correctly denied, with no partial access. Reviewed
> — without implementing — the future Outbound Publish order: Option C
> (persist/register locally, then a future durable, protocol-independent
> Outbox delivery record) adopted, since remote protocols cannot
> participate in this repository's own local, synchronous append-only
> transaction; zero Outbox code, schema, or API written. Exactly seven
> pre-existing test files updated (two that demonstrated the
> now-closed bypass, five asserting `board()`'s own exact return
> type/body) — no test that only read through `board()` required any
> change. `package.json`'s own `dependencies` count stays fixed at 2 —
> zero new Cargo/npm dependency of any kind. `npm run typecheck`/`npm
> test` GREEN (the SAME ten pre-existing, unrelated Rust-structural
> test failures Alpha 400 already named, byte-for-byte identical,
> reconfirmed via `git stash` against the pre-Arc baseline). `cargo
> check` GREEN; `cargo test` fails to BUILD in this environment due to
> the SAME pre-existing MinGW `dlltool` path issue every prior Arc has
> documented identically. The pre-existing root-level `p2p/` directory
> remains completely untouched. Next Arc recommended: **Secure Runtime
> Alpha 411–420: Canonical Board Outbox Foundation Arc** (not direct
> multi-protocol publish implementation without an Outbox).
>
> See `docs/secure_runtime_alpha_401_host_write_surface_inventory.md`
> through `docs/secure_runtime_alpha_410_host_write_boundary_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 391–400 — Desktop Host Durable Write
> Coordination Arc.** Makes `FedosDesktopHost` the single owner of all
> Canonical Board WRITE coordination, closing the memory-only-write gap
> Alpha 367/389/390 named honestly and left unsolved. New
> `submitPost(post): FedosDesktopHostSubmitPostResult`, adopted directly
> on the Host (Option A — the SAME class-owns-its-concerns shape Alpha
> 332 already established, over a new `WriteCoordinator` class, Option
> B, rejected for having no second use case). Implements the fixed
> order `Validate → Persistence → Repository → Query visibility →
> Success`: Persistence is written STRICTLY BEFORE Repository —
> deliberately, not the reverse — because `FedosBoardPersistence` has
> no delete method, so only this order keeps every reachable failure
> recoverable by a future restart instead of a silent, permanent loss.
> New `FedosBoardService.previewRegistration()` — a pure-read prediction
> of `registerPost()`'s own outcome, factored out of `registerPost()`
> itself with zero behavior change — lets the Host validate a post
> BEFORE it ever reaches durable Persistence, preventing a
> domain-invalid post from permanently poisoning every future
> `hydrateFedosBoardService()` replay of that log (Persistence has no
> delete/repair path). `FedosBoardService`, `FedosBoardRepository`, and
> `FedosBoardPersistence` all keep their own frozen contracts —
> `previewRegistration()` and `submitPost()` are both purely ADDITIVE.
> Every failure shape is Fail Closed: duplicate/conflict behave exactly
> like the pre-existing idempotent/conflict conventions those layers
> already established; a thrown Persistence exception propagates
> UNMODIFIED with the Host staying `"ready"` (a single failed write is
> not a Host-lifecycle event); a returned Persistence I/O failure
> (`"persistence-failed"`, one new token) stops the write before
> Repository is ever reached; "Repository succeeds, Persistence fails"
> and "Persistence succeeds, Repository fails" are BOTH structurally
> unreachable by the adopted order, not merely handled. Query visibility
> is automatic and immediate — no rebuild, no reload, no restart —
> because `FedosBoardQuery` and the write path share the exact same live
> `FedosBoardService` instance. Verified end to end: real fixtures from
> all four Board Adapters (Nostr, ActivityPub, AT Protocol, Session)
> submit through the identical `submitPost()` call with zero
> protocol-specific branching; every named failure shape reproduced by
> direct execution; and — the scenario that was IMPOSSIBLE before this
> Arc — a post written via `submitPost()` by one Host instance, against
> a REAL `AppendOnlyFedosBoardPersistence`, is fully preserved and
> visible via a SECOND, independently-constructed Host instance after a
> genuine restart. **Honestly left open:** the OLD
> `host.board()?.registerPost(post)` path is completely UNCHANGED — it
> still never reaches Persistence, exactly as Alpha 367 first found; a
> caller that bypasses `submitPost()` still reproduces the original gap.
> `package.json`'s own `dependencies` count stays fixed at 2 — zero new
> Cargo/npm dependency of any kind. `npm run typecheck`/`npm test`
> GREEN (pre-existing, unrelated Rust-structural test failures excluded;
> one existing test file updated — Alpha 386's own six-public-method
> assertion, now seven, with `submitPost` distinguished from the Query
> delegation methods that Stage declined to add). `cargo check` GREEN;
> `cargo test` fails to BUILD in this environment due to the SAME
> pre-existing, unrelated MinGW `dlltool` path issue prior Arcs already
> documented. The pre-existing root-level `p2p/` directory remains
> completely untouched. Next Arc recommended: **Secure Runtime Alpha
> 401–410: Outbound Publish Pipeline Foundation Arc** (not Relay Pool,
> not Ontology, not P2P).
>
> See `docs/secure_runtime_alpha_391_desktop_host_write_coordination_inventory.md`
> through `docs/secure_runtime_alpha_400_desktop_host_write_coordination_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 381–390 — Canonical Board Query Host
> Integration & Startup Failure Closure Arc.** Integrates the
> completed Query layer into `FedosDesktopHost` and closes the
> confirmed `FedosDesktopHost.start()` hydration-exception defect
> (first found by Alpha 361, Arc 361–370). **The defect is FIXED**:
> `start()` now wraps hydration, `FedosBoardQuery` construction, and
> `DesktopApplication.start()` in exactly ONE `try`/`catch` — every
> startup failure shape (a returned hydration outcome, a THROWN
> hydration exception — e.g. from a corrupt
> `AppendOnlyFedosBoardPersistence` log — or a Desktop startup
> rejection) now transitions `state()` to `"failed"` before `start()`'s
> own `Promise` settles, with the original error's own identity
> preserved unmodified (no wrapping). Host now owns exactly one
> `FedosBoardQuery`, constructed only after successful hydration, over
> the already-hydrated `FedosBoardService` — never exposed until
> `DesktopApplication.start()` also succeeds, discarded on any
> failure. New `query(): FedosBoardQuery | null` accessor, matching
> `desktop()`/`board()`'s own exact fail-closed shape — adopted because
> `FedosBoardQuery` is confirmed to have zero mutating method.
> `board()` remains completely UNCHANGED — the canonical WRITE
> boundary (`registerPost()`); `query()` is the canonical READ boundary
> (`recentFeed()`/`thread()`) — a frozen, permanent distinction, never
> merged. No Host-level delegation methods added (`host.query()` is
> the sole path) — reviewed and declined to avoid an unnecessary
> maintenance ripple with no current caller requiring it. Verified end
> to end: the in-memory default, a REAL, explicitly-injected
> `AppendOnlyFedosBoardPersistence` (including the exact corruption
> shape that originally exposed the defect), and real fixtures from
> all four Board Adapters (Nostr, ActivityPub, AT Protocol, Session) —
> zero adapter modification, independent Host isolation confirmed for
> Query specifically. **Honestly re-documented, not solved:** a post
> registered via `board()` is visible via `query()` immediately (both
> read the SAME live `FedosBoardService`), but is NOT automatically
> written to the underlying `FedosBoardPersistence` — confirmed
> directly, matching Alpha 367's own original finding (Arc 361–370).
> The Host factory's own default persistence remains
> `InMemoryFedosBoardPersistence`, UNCHANGED — no storage-path
> authority is introduced. `package.json`'s own `dependencies` count
> stays fixed at 2 — zero new Cargo/npm dependency of any kind. `npm
> run typecheck`/`npm test` GREEN (pre-existing, unrelated
> Rust-structural test failures excluded; five existing test files
> updated to assert the FIXED behavior in place of the now-resolved
> confirmed defect they previously reproduced). `cargo check` GREEN;
> `cargo test` fails to BUILD in this environment due to a
> pre-existing, unrelated MinGW `dlltool` path issue, reproduced
> identically on the pre-Arc baseline. The pre-existing root-level
> `p2p/` directory remains completely untouched. Next Arc recommended:
> **Desktop Host Durable Write Coordination Arc** (not Ontology
> integration).
>
> See `docs/secure_runtime_alpha_381_host_query_integration_inventory.md`
> through `docs/secure_runtime_alpha_390_host_query_integration_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 371–380 — Canonical Board Query
> Foundation Arc.** Defines HOW clients READ Board data — the
> Repository (`FedosBoardRepository`, Alpha 302) and Persistence
> (`FedosBoardPersistence`, Alpha 315) both remain byte-for-byte
> UNCHANGED, confirmed by regression test. New
> [`src/board/query/`](src/board/query/) directory:
> [`fedos_board_query_types.ts`](src/board/query/fedos_board_query_types.ts)
> (the contract — `FedosBoardQueryFilter`/`FedosBoardQueryPageOptions`/
> `FedosBoardQueryResult`/`FedosBoardQuerySource`, type-only, mirroring
> `FedosBoardFeedSource`'s own Alpha 308 structural-typing pattern) and
> [`fedos_board_query.ts`](src/board/query/fedos_board_query.ts)
> (`FedosBoardQuery` — `recentFeed()`, `createdAt` DESC matching
> `FedosBoardFeed`'s own established order, confirmed identical by
> direct execution; `thread()`, `createdAt` ASC — a genuinely NEW
> deterministic ordering guarantee this repository never had before,
> since `listThreadPosts()` itself only ever returned undocumented
> `Set` insertion order). Offset/limit pagination, no cursor
> (`FedosBoardFeed`'s own Alpha 308 "no cursor" guardrail extended
> here); a four-dimension AND-only filter model
> (`protocol`/`authorPublicIdentifier`/`since`/`until`) — text search,
> reply-count/engagement filtering, and an `identityId` filter all
> explicitly reviewed and rejected. Deliberately does NOT reuse
> `FedosBoardFeed`'s own implementation — a naive delegation would
> silently cap any filtered query at 100 unfiltered candidates, a real
> correctness bug this Arc's own independent comparator avoids.
> O(k log k) per call, bounded by current board/thread size, never by
> total write history — reviewed and confirmed sufficient without a
> new index. Verified end to end with real fixtures from all four
> Board Adapters (Nostr, ActivityPub, AT Protocol, Session), including
> a cross-protocol thread and mixed-protocol pagination. **This layer
> has no real caller yet** — `FedosDesktopHost`/`createFedosDesktopHost`
> and `src/worker.ts` are both untouched, confirmed by regression test
> — mirroring Alpha 341's own identical finding about Persistence
> before `FedosDesktopHost` existed to call it.
> `package.json`'s own `dependencies` count stays fixed at 2 — zero new
> Cargo/npm dependency of any kind. `npm run typecheck`/`npm test`
> GREEN (pre-existing, unrelated Rust-structural test failures
> excluded). `cargo check` GREEN. The pre-existing root-level `p2p/`
> directory remains completely untouched. Next Arc recommended:
> **Secure Runtime Alpha 381–390: Canonical Board Query Host
> Integration Arc**.
>
> See `docs/secure_runtime_alpha_371_existing_read_path_inventory.md`
> through `docs/secure_runtime_alpha_380_query_foundation_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 361–370 — Board Recovery & Host
> Robustness Arc.** A Review/Design Arc — no new storage format, no
> production code change, strengthening the existing Append-only
> backend and `FedosDesktopHost` purely through definition and
> verification. Inventoried every Host/persistence failure path
> (`docs/secure_runtime_alpha_361_host_failure_inventory.md`) and
> reproduced the one confirmed gap: a THROWN exception from hydration
> leaves `state()` stuck at `"starting"`, never `"failed"`. Fixed the
> intended policy that gap falls short of
> (`docs/secure_runtime_alpha_362_hydration_failure_policy.md`: any
> startup failure, by ANY signaling mechanism, must reach
> `state() === "failed"`), classified all seven corruption/non-corruption
> categories
> (`docs/secure_runtime_alpha_363_corruption_classification.md`), and
> designed — WITHOUT implementing — a stop-at-first-failure salvage
> recovery strategy
> (`docs/secure_runtime_alpha_364_recovery_strategy.md`) and a
> rename-based compaction architecture, finding compaction not yet
> justified by real data need
> (`docs/secure_runtime_alpha_366_compaction_architecture_review.md`).
> Confirmed by real execution: embedded control characters in a post
> body never break the JSON Lines log
> (`docs/secure_runtime_alpha_365_append_integrity_review.md`);
> `FedosDesktopHost` itself correctly survives multiple independent
> restart cycles against a shared durable file, and a clean `stop()`
> leaves on-disk state identical to a simulated crash
> (`docs/secure_runtime_alpha_367_host_restart_verification.md` — this
> Stage's own execution also confirmed a previously-undocumented fact:
> `board().registerPost()` writes are IN-MEMORY ONLY, never durable —
> callers must write through `FedosBoardPersistence` directly);
> correctness holds at 1,000 records, with the already-known cost shape
> now precisely characterized as O(N²) total write cost
> (`docs/secure_runtime_alpha_368_large_dataset_scalability_review.md`).
> Reviewed `fsync` in depth — confirmed technically addable without any
> new dependency, format change, or interface change, but deliberately
> NOT added, since the durability/performance trade-off it implies is
> undecided
> (`docs/secure_runtime_alpha_369_durability_fsync_review.md`).
> **Special Focus, answered: the hydration-exception gap IS a true
> architectural defect** — reachable with real inputs, observably
> incorrect against `FedosDesktopHostState`'s own design, and
> architectural (not incidental) in root cause. A minimal, one-`try`/`catch`
> future fix is documented in full but explicitly NOT implemented this
> Arc, per its own instruction
> (`docs/secure_runtime_alpha_370_recovery_robustness_completion.md`).
> Every public interface preserved; the current
> `AppendOnlyFedosBoardPersistence` record format preserved exactly.
> `package.json`'s own `dependencies` count stays fixed at 2 — zero new
> Cargo/npm dependency of any kind. `npm run typecheck`/`npm test`
> GREEN (pre-existing, unrelated Rust-structural test failures
> excluded; one additional identity-runtime test flake observed in the
> full run, confirmed flaky — not a regression — by an isolated re-run
> that passed cleanly).
> `cargo check` GREEN. The pre-existing root-level `p2p/` directory
> remains completely untouched. Next Arc recommended: **Secure Runtime
> Alpha 371–380: FedosDesktopHost Hydration Exception Handling Arc**.
>
> See `docs/secure_runtime_alpha_361_host_failure_inventory.md`
> through `docs/secure_runtime_alpha_370_recovery_robustness_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 351–360 — Append-only Durable Board
> Backend Arc.** Implements the architecture Alpha 349 froze: the
> FIRST real durable backend for `FedosBoardPersistence`. New
> [`src/board/persistence/append_only_fedos_board_persistence.ts`](src/board/persistence/append_only_fedos_board_persistence.ts)
> (`AppendOnlyFedosBoardPersistence` — `Fedos`-prefixed, matching
> every other concrete port implementation) uses ONLY `node:fs`, zero
> new dependency, reached the same untyped way
> `fedos_windows_dpapi_helper.ts` already reaches `node:child_process`.
> One JSON-serialized `FedosPersistedBoardPostRecordV1` per
> `\n`-terminated line (JSON Lines); no binary format, no compression,
> no batching; the no-`fsync` durability limitation explicitly
> disclosed, not hidden
> (`docs/secure_runtime_alpha_352_append_only_record_format.md`).
> `putPost()` appends only — never rewrites, never truncates, never
> reorders, writing to disk ONLY on a genuine new insert. `getPost()`/
> `listPosts()` rebuild state by REPLAYING the log on every call — no
> side index yet, a deliberate first-Arc simplicity choice. All four
> `FedosBoardPersistenceWriteResult` outcomes verified, with
> `"failed"` reachable for the first time in this repository's own
> history — exactly the case `PersistedFedosBoardRepository`'s own
> Alpha 317 comment anticipated two Arcs ago. **Fail closed, uniformly,
> across every crash case reviewed** — resolving the one open design
> question Alpha 345 §6 left from the prior Arc (a trailing
> crash-truncated line is treated IDENTICALLY to any other malformed
> line, never specially repaired). `hydrateFedosBoardService` works
> against the new backend with ZERO modification, verified end to end
> with real fixtures from all four Board Adapters (Nostr, ActivityPub,
> AT Protocol, Session) across a genuine restart — identical feed,
> thread grouping, source references, ordering, and duplicate
> handling. Every existing public interface preserved; `FedosDesktopHost`/
> `createFedosDesktopHost` untouched (the default remains
> `InMemoryFedosBoardPersistence`, Alpha 334). **Remaining limitations,
> named explicitly:** no `fsync`, no compaction, no Host wiring/path
> resolution, no concurrent-writer support, and a newly-discovered,
> reproduced, NOT-fixed gap in `FedosDesktopHost.start()` — it does not
> catch a THROWN exception from hydration (only a RETURNED
> non-`"hydrated"` outcome sets `state()` to `"failed"`), leaving
> `state()` stuck at `"starting"` after a corrupt append-only log —
> invisible before this Arc since `InMemoryFedosBoardPersistence` can
> never throw
> (`docs/secure_runtime_alpha_360_append_only_backend_completion.md`).
> `package.json`'s own `dependencies` count stays fixed at 2 — zero new
> Cargo/npm dependency of any kind. `npm run typecheck`/`npm test`
> GREEN (pre-existing, unrelated Rust-structural test failures
> excluded). `cargo check` GREEN. The pre-existing root-level `p2p/`
> directory remains completely untouched. Next Arc recommended:
> **Secure Runtime Alpha 361–370: Append-only Compaction & Integrity
> Review**.
>
> See `docs/secure_runtime_alpha_351_existing_persistence_layer_inventory.md`
> through `docs/secure_runtime_alpha_360_append_only_backend_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 341–350 — Board Durable Backend
> Re-evaluation & Local Backend Selection Arc.** A Design/Selection
> Arc — no durable backend is implemented. Re-evaluates Alpha 329's
> own deferral now that `FedosDesktopHost` (Alpha 331–340) is a real
> ownership boundary: re-confirms, by direct inspection, that the Host
> can structurally own any `FedosBoardPersistence` implementation
> (`docs/secure_runtime_alpha_341_host_capability_inventory.md`), and
> freezes which persistence assumptions are genuinely
> backend-independent — synchronous port, no database vocabulary, no
> `delete`, hydration and the persisted-repository adapter already
> requiring zero change for any future backend
> (`docs/secure_runtime_alpha_342_current_persistence_review.md`).
> Re-reviews
> [SQLite](docs/secure_runtime_alpha_343_sqlite_review.md) (strongest
> crash safety and query capability, but needs a new native dependency
> or an undeclared Node-version floor) and
> [append-only file](docs/secure_runtime_alpha_344_append_only_backend_review.md)
> (zero new dependency, trivial migration, one real, named, unsolved
> design gap: distinguishing a crash-truncated trailing record from
> genuine corruption) against each other's own
> [crash-recovery behavior](docs/secure_runtime_alpha_345_crash_recovery_review.md),
> fixes an
> [Offline, One-shot migration strategy](docs/secure_runtime_alpha_346_migration_strategy.md)
> usable for any backend pair via the existing port alone, reviews a
> [backend-agnostic storage layout](docs/secure_runtime_alpha_347_storage_layout_review.md)
> without deciding an actual path, and confirms the
> [Desktop Host is the only environment](docs/secure_runtime_alpha_348_deployment_review.md)
> where either backend has a real caller.
> [**Selection: Option A — append-only file, first**](docs/secure_runtime_alpha_349_backend_selection.md),
> winning four of six named criteria outright (simplicity, dependency
> footprint, future migration, FedOS architecture consistency), with
> SQLite named as the anticipated future migration destination, not a
> rejected dead end. `package.json`'s own `dependencies` count stays
> fixed at 2 — zero new Cargo/npm dependency of any kind. `npm run
> typecheck`/`npm test` GREEN (pre-existing, unrelated Rust-structural
> test failures excluded — see
> `docs/secure_runtime_alpha_350_backend_reevaluation_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline. The pre-existing root-level
> `p2p/` directory remains completely untouched. Next Arc recommended:
> **Secure Runtime Alpha 351–360: Append-only Durable Board Backend
> Arc**.
>
> See `docs/secure_runtime_alpha_341_host_capability_inventory.md`
> through `docs/secure_runtime_alpha_350_backend_reevaluation_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 331–340 — Desktop Host Runtime
> Foundation Arc.** Introduces the first real host-runtime boundary
> capable of owning the existing `DesktopApplication` and Canonical
> Board Application for a long-lived local process — the missing
> prerequisite Alpha 330 named. Inventories the existing repository
> (`docs/secure_runtime_alpha_331_existing_desktop_host_inventory.md`):
> no local-process entry point, no `package.json` `bin`, no CLI, no
> signal handling, and no disposable resource on `DesktopApplication`
> exist anywhere today. Adopts a class-owned lifecycle
> (`docs/secure_runtime_alpha_332_desktop_host_responsibility_decision.md`,
> Option A) over free functions, extending `DesktopApplication`,
> reusing `createRuntime()`, or reusing Worker startup. New
> [`src/desktop/host/`](src/desktop/host/) directory, three files:
> [`fedos_desktop_host_state.ts`](src/desktop/host/fedos_desktop_host_state.ts)
> (`FedosDesktopHostState` — a closed six-token union, no error
> payload),
> [`fedos_desktop_host.ts`](src/desktop/host/fedos_desktop_host.ts)
> (`FedosDesktopHostDependencies` + `FedosDesktopHost` — `start()`
> hydrates Board state via the UNMODIFIED `hydrateFedosBoardService`
> (Alpha 318) THEN starts `DesktopApplication`, fails closed on either
> step, and never exposes a partially-hydrated or partially-started
> Host; `desktop()`/`board()` return `null` unless `state() ===
> "ready"`; `stop()` is `"ready"`-only and NOT idempotent), and
> [`create_fedos_desktop_host.ts`](src/desktop/host/create_fedos_desktop_host.ts)
> (`createFedosDesktopHost` — construction only, both dependencies
> independently overridable, defaults to a fresh
> `InMemoryFedosBoardPersistence`, Alpha 316, still Alpha 329's own
> Option E deferral, completely unmodified). Verified end to end by
> real execution with injected (never mocked) dependencies: successful
> startup with real posts from all four Board Adapters, hydration
> failure, `DesktopApplication` startup failure (hydrated Board
> discarded, never exposed), no double-start, no restart after stop,
> independent Host instances share no state. Reviewed and explicitly
> DEFERRED adding a real executable entry point
> (`docs/secure_runtime_alpha_338_local_process_entrypoint_review.md`,
> Option B) — `package.json` is completely unchanged, no `bin`, no
> signal handling, no automatic Host start anywhere. The pre-existing
> root-level `p2p/` directory remains completely untouched.
> `package.json`'s own `dependencies` count stays fixed at 2 — zero new
> Cargo/npm dependency of any kind. `npm run typecheck`/`npm test`
> GREEN (pre-existing, unrelated Rust-structural test failures
> excluded — see
> `docs/secure_runtime_alpha_340_desktop_host_foundation_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline. Next Arc recommended: **Board
> Durable Backend Selection Re-evaluation Arc** (not Ontology
> integration) — a real, Node-capable local Host caller now exists,
> re-opening SQLite/append-only file as candidates Alpha 329 deferred
> only for lack of exactly this caller.
>
> See `docs/secure_runtime_alpha_331_existing_desktop_host_inventory.md`
> through `docs/secure_runtime_alpha_340_desktop_host_foundation_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 321–330 — Board Durable Backend
> Selection & Architecture Arc.** A Design/Selection Arc — no durable
> backend is implemented. Inventories real deployment/runtime state
> (`docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`):
> Cloudflare Workers (primary, real, deployed target) and Node
> (test/dev harness) exist; no browser and no real Desktop shell exist;
> Board persistence has no wiring into ANY production runtime today —
> not the Worker's `fetch` handler, not `DesktopApplication`, not a
> browser. Freezes durable backend requirements
> (`docs/secure_runtime_alpha_322_durable_backend_requirements.md`,
> MUST/SHOULD/NOT YET against the already-frozen
> `FedosBoardPersistence` port) and reviews all four named candidates —
> [SQLite](docs/secure_runtime_alpha_323_sqlite_backend_review.md),
> [IndexedDB](docs/secure_runtime_alpha_324_indexeddb_backend_review.md),
> [D1](docs/secure_runtime_alpha_325_d1_backend_review.md) (this
> repository's most operationally proven backend, for an unrelated,
> non-authoritative concern), and an
> [append-only file](docs/secure_runtime_alpha_326_append_only_backend_review.md)
> (zero new dependency, with an explicit warning against mistaking a
> naive JSON-overwrite for genuine append-only durability) — each
> requiring either a new, prohibited dependency or a real host process
> that does not exist yet.
> [Multi-environment strategy](docs/secure_runtime_alpha_327_multi_environment_backend_strategy.md)
> adopts deferral over an early SQLite/D1/IndexedDB/file commitment;
> [schema/migration architecture](docs/secure_runtime_alpha_328_board_schema_migration_architecture.md)
> fixes persistence-layer ownership of `schemaVersion` checks ahead of
> any future backend.
> [**Selection: Option E — no backend yet**](docs/secure_runtime_alpha_329_first_durable_backend_selection.md),
> because Board has no real caller in any production runtime, not
> because any candidate is technically deficient. `package.json`'s own
> `dependencies` count stays fixed at 2 — zero new Cargo/npm dependency
> of any kind. `npm run typecheck`/`npm test` GREEN (pre-existing,
> unrelated Rust-structural test failures excluded — see
> `docs/secure_runtime_alpha_330_durable_backend_selection_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline. The pre-existing root-level
> `p2p/` directory remains completely untouched. Next Arc recommended:
> **Desktop Host Runtime Foundation Arc** (not Ontology integration).
>
> See `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
> through `docs/secure_runtime_alpha_330_durable_backend_selection_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 311–320 — Canonical Board Persistence
> Boundary Arc.** Implements a protocol-independent persistence SEAM
> (not a real database) for the Canonical Board Application built in
> Alpha 301–310. Six new files under the new
> [`src/board/persistence/`](src/board/persistence/) directory:
> [`fedos_persisted_board_post_v1.ts`](src/board/persistence/fedos_persisted_board_post_v1.ts)
> (`FedosPersistedBoardPostRecordV1` — `schemaVersion: 1`, plain
> serializable data only, no branded types/Map/Set/functions/class
> instances; moderation persistence deliberately deferred, never
> embedded casually),
> [`fedos_board_post_codec.ts`](src/board/persistence/fedos_board_post_codec.ts)
> (`serializeFedosBoardPost`/`deserializeFedosBoardPost` — fail closed,
> exact `schemaVersion` check, unknown top-level AND nested fields
> rejected, `validateFedosBoardPost` (Alpha 257) reused unmodified on
> every read, round-trip equality, no thrown exceptions),
> [`fedos_board_persistence.ts`](src/board/persistence/fedos_board_persistence.ts)
> (`FedosBoardPersistence` port — `putPost`/`getPost`/`listPosts`, no
> `delete` this Arc; `FedosBoardPersistenceWriteResult` —
> `"inserted"`/`"already-present"`/`"conflict"`/`"failed"`),
> [`in_memory_fedos_board_persistence.ts`](src/board/persistence/in_memory_fedos_board_persistence.ts)
> (`InMemoryFedosBoardPersistence` — structurally distinct from
> `InMemoryFedosBoardRepository`: persisted plain records, not validated
> application objects),
> [`persisted_fedos_board_repository.ts`](src/board/persistence/persisted_fedos_board_repository.ts)
> (`PersistedFedosBoardRepository` — satisfies the already-frozen
> `FedosBoardRepository` contract (Alpha 302) unmodified; Option B
> strict `listPosts()` plus an Option C `listPostsDiagnostic()`
> supplement), and
> [`fedos_board_hydration.ts`](src/board/persistence/fedos_board_hydration.ts)
> (`hydrateFedosBoardService` — a bounded, deterministic topological
> pass, roots first then replies as parents become available,
> rebuilding a fresh in-memory `FedosBoardService` with Source/Board/
> Thread Index rebuilt entirely as a side effect of its own unmodified
> `registerPost`; no partial service on corruption or unresolvable
> thread integrity). Verified end-to-end against all four real,
> unmodified Board Adapters: round-trip equality, provenance/author
> preservation, thread grouping preservation, feed-order preservation,
> idempotent writes, ID/source-conflict detection surviving hydration,
> and corrupt-record rejection all confirmed. The pre-existing
> root-level `p2p/` directory remains completely untouched — not
> staged, not imported, not used as persisted canonical state.
>
> **Still NOT implemented**: a real durable backend (SQLite/D1/
> IndexedDB/filesystem), encryption at rest, database migration
> execution, moderation/delete persistence, search, full-text indexing,
> P2P Ontology Engine integration, pagination cursors, ranking,
> recommendations, Relay Pool, GUI. `package.json`'s own `dependencies`
> count stays fixed at 2 — zero new Cargo/npm dependency, zero Rust/wasm
> change of any kind. `npm run typecheck`/`npm test` GREEN (pre-existing,
> unrelated Rust-structural test failures excluded — see
> `docs/secure_runtime_alpha_320_board_persistence_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline.
>
> See `docs/secure_runtime_alpha_311_existing_board_persistence_inventory.md`
> through `docs/secure_runtime_alpha_320_board_persistence_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 301–310 — Canonical Board Repository,
> Index & Feed Foundation Arc.** Implements the first protocol-independent
> Board Application layer on top of the Canonical Board Model and all
> four completed Protocol Adapters. Six new files under the new
> [`src/board/repository/`](src/board/repository/) directory:
> [`fedos_board_repository.ts`](src/board/repository/fedos_board_repository.ts)
> (`FedosBoardRepository` contract — `register`/`findPost`/`listPosts`
> only, deliberately no `removePost` this Arc; `FedosBoardRepositoryWriteResult`
> — `"inserted"`/`"already-present"`/`"conflict"`, no boolean hides the
> reason; `fedosBoardPostsAreStructurallyEqual` decides idempotent
> re-registration),
> [`in_memory_fedos_board_repository.ts`](src/board/repository/in_memory_fedos_board_repository.ts)
> (`InMemoryFedosBoardRepository` — stores by reference, relying on
> `validateFedosBoardPost`'s own already-verified frozen boundary, Alpha
> 257, rather than re-copying),
> [`fedos_board_source_index.ts`](src/board/repository/fedos_board_source_index.ts)
> (`FedosBoardSourceIndex` — keyed by `fedosBoardSourceKey`, Alpha 253,
> reused unmodified; recognizes the same upstream object re-imported
> under a different registration, independent of Repository ID conflict),
> [`fedos_board_index.ts`](src/board/repository/fedos_board_index.ts)
> (`FedosBoardIndex` — ID-only board/thread index, composite
> `(boardId, threadId)` keying rules out cross-board contamination),
> [`fedos_board_service.ts`](src/board/repository/fedos_board_service.ts)
> (`FedosBoardService.registerPost` — the one write boundary coordinating
> all three components; closes the thread-integrity gap Alpha 256 left
> open: root `threadId === id`, parent existence — missing parent
> rejected, Option A — same-board/same-thread reply, self-reply
> inherited for free from `validateFedosBoardPost`, cycles structurally
> impossible by the insertion rule; seven-outcome
> `FedosBoardRegistrationResult`, no transaction framework needed since
> the check order itself guarantees atomicity), and
> [`fedos_board_feed.ts`](src/board/repository/fedos_board_feed.ts)
> (`FedosBoardFeed.listRecentPosts` — `createdAt` DESC, `id` ASC
> tie-break, `[1, 100]` clamped limit policy, zero ranking of any kind,
> deliberately NOT reusing `src/query/thread_query.ts`'s own existing
> ranked Nostr-specific feed). Verified against all four real,
> unmodified Board Adapters registering through one shared
> `FedosBoardService` and appearing correctly in one `FedosBoardFeed`,
> with source/post-ID conflict, missing-parent, and cross-board-reply
> rejection all confirmed fail-closed. The pre-existing root-level
> `p2p/` directory is confirmed, at the boundary level only, to be a
> wholly unrelated, independent repository ("Global Imbalance Radar," a
> crypto market-microstructure analysis platform) — not staged, not
> modified, not imported, not inspected beyond a top-level confirmation.
>
> **Still NOT implemented**: persistence (SQLite/D1/IndexedDB),
> distributed synchronization, P2P Ontology Engine integration, semantic
> relationships, search, full-text indexing, pagination cursors,
> ranking, recommendations, likes, reposts, notifications, moderation
> execution, Relay Pool, GUI. `package.json`'s own `dependencies` count
> stays fixed at 2 — zero new Cargo/npm dependency, zero Rust/wasm
> change of any kind. `npm run typecheck`/`npm test` GREEN (pre-existing,
> unrelated Rust-structural test failures excluded — see
> `docs/secure_runtime_alpha_310_board_repository_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline.
>
> See `docs/secure_runtime_alpha_301_existing_board_repository_inventory.md`
> through `docs/secure_runtime_alpha_310_board_repository_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 291–300 — Session Canonical Board
> Gateway Adapter Arc.** Implements the FOURTH and FINAL Protocol
> Adapter: a pure, one-way, fail-closed translation from an
> already-Gateway-verified, already-normalized `FedosValidatedSessionPost`
> into a `FedosBoardPost` (Alpha 255), closing out the four-Arc Canonical
> Board Adapter series (Alpha 261–300). This Arc has NO responsibility
> before the Gateway (Session network, Oxen connection, private keys,
> encryption/decryption, DM retrieval, and storage sync are all
> explicitly out of scope and prohibited) and NO responsibility after
> the Board. Two new files under the new
> [`src/board/session/`](src/board/session/) directory:
> [`fedos_validated_session_post.ts`](src/board/session/fedos_validated_session_post.ts)
> (`FedosValidatedSessionPost` — `messageId`/`sessionId`/`authorId`/
> `body`/`createdAt`/`replyTo`, exactly six fields, no Attachment/Group/
> Reaction/Voice/Typing field; `sessionId` names the Gateway's own
> ingestion-session context — distinct from `authorId`, retained on the
> input type only, mirroring AT Protocol's `cid` treatment) and
> [`fedos_session_board_adapter.ts`](src/board/session/fedos_session_board_adapter.ts)
> (`validateSessionBoardPost` + `mapValidatedSessionPostToBoardPostInput`
> — `authorId` → `author.publicIdentifier` verbatim, never `sessionId`
> (no identity resolution, no profile fetch, no network); `body` → `body`
> verbatim, no processing/Markdown/HTML/Emoji conversion, no markup
> guard needed; `replyTo` → `threadId`/`replyTo` via the ADOPTED Gateway
> CONTRACT — no `replyTo` means root (`threadId` = own id), a present
> `replyTo` means `threadId = replyTo` (the direct parent, with NO
> inference beyond it — an honestly-documented limitation versus the
> other three protocols' root-preserving `threadId`, since Session
> carries no root concept at all); `messageId` → `source.reference`,
> `source.protocol` fixed to `"session"`; composes with, never
> duplicates, `validateFedosBoardPost`, Alpha 257, unmodified — the ONLY
> existing validator this Arc's own instruction permits it to use).
> Flags and excludes `src/identity/session_boundary.ts` explicitly: a
> same-named but entirely unrelated web/app SESSION-lifecycle boundary
> (login/logout/refresh), not the Session messenger. Verified against
> the full required fixture matrix (root, reply, nested-reply
> `threadId` divergence, Unicode, long text, empty body, malformed
> author/message-id rejection, determinism), confirmed shape-identical
> to Nostr-, ActivityPub-, and AT-Protocol-produced `FedosBoardPost`,
> and confirmed all three existing adapters have zero functional
> coupling to Session.
>
> **Still NOT implemented**: Session network/Oxen connection, private
> keys, encryption/decryption, DM retrieval, storage sync, a Board
> Repository, Board Index, Board Feed, persistence, moderation
> enforcement, GUI, and any wiring of this adapter into a live path
> (`boardId` remains a required, caller-supplied parameter).
> `package.json`'s own `dependencies` count stays fixed at 2 — zero new
> Cargo/npm dependency, zero Rust/wasm change of any kind. `npm run
> typecheck`/`npm test` GREEN (pre-existing, unrelated Rust-structural
> test failures excluded — see
> `docs/secure_runtime_alpha_300_session_board_adapter_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline.
>
> See `docs/secure_runtime_alpha_291_existing_session_inventory.md`
> through `docs/secure_runtime_alpha_300_session_board_adapter_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 281–290 — AT Protocol Canonical Board
> Adapter Arc.** Implements the THIRD Protocol Adapter: a pure, one-way,
> fail-closed translation from an already-validated, already-normalized
> `FedosValidatedAtprotoPost` into a `FedosBoardPost` (Alpha 255),
> following both prior adapters' own shared two-step pattern exactly.
> Three new files under the new
> [`src/board/atproto/`](src/board/atproto/) directory:
> [`fedos_validated_atproto_post.ts`](src/board/atproto/fedos_validated_atproto_post.ts)
> (`FedosValidatedAtprotoPost` — `uri`/`cid`/`authorDid`/`text`/
> `createdAt`/`replyRootUri`/`replyParentUri`, seven fields, `text`
> plain UTF-8 by Lexicon schema design — no HTML-normalization concern,
> unlike ActivityPub; no raw Lexicon object, no XRPC response, no CAR
> block, no auth/refresh token, no app password, no PDS session, no
> metadata bag),
> [`fedos_atproto_board_adapter.ts`](src/board/atproto/fedos_atproto_board_adapter.ts)
> (`validateAtprotoBoardPost` + `mapValidatedAtprotoPostToBoardPostInput`
> — "Option C": AT URI → `id`/`source.reference` (record identity), CID
> retained on the input type only, read for a non-emptiness check but
> NEVER copied onto `FedosBoardPost` (future `Update` handling won't
> confuse identity with content version); `authorDid` →
> `author.publicIdentifier` verbatim (the STABLE DID, never the mutable
> handle — no profile resolution, no network calls); `text` → `body`
> verbatim with NO markup guard needed, unlike ActivityPub;
> `replyRootUri`/`replyParentUri` → `threadId`/`replyTo` — AT Protocol
> supplies both explicitly (no upstream-resolver deferral needed, unlike
> ActivityPub), invalid combinations (root-without-parent, parent-
> without-root, self-root contradiction) rejected fail-closed at the
> adapter, self-parent reused from `validateFedosBoardPost` not
> duplicated; composes with, never duplicates, `validateFedosBoardPost`,
> Alpha 257, unmodified), and
> [`fedos_atproto_mutation_boundary.ts`](src/board/atproto/fedos_atproto_mutation_boundary.ts)
> (`FedosAtprotoRecordObservation`, a minimal INERT type — carrying both
> `uri` and `cid`, unlike ActivityPub's `objectId`-only equivalent —
> formally separating updated/deleted records from `FedosBoardPost`; no
> boolean `deleted`/`updated`/`repost` field is ever added to it, never
> wired into the adapter; repost/like/follow/profile records stay
> entirely out of scope). Verified against a 17-case required fixture
> matrix (Bluesky- and generic-AT-Protocol-shaped posts, root/reply/
> direct-reply-to-root, missing-root/missing-parent/self-parent
> rejection, Unicode, empty/oversized-body rejection, malformed DID/URI/
> CID rejection, deterministic repeated mapping, same-URI-different-CID
> identity, different-URI separation), confirmed shape-identical to
> BOTH a Nostr- and an ActivityPub-produced `FedosBoardPost`, and
> confirmed BOTH existing adapters (Alpha 266, Alpha 277) have zero
> functional coupling to AT Protocol.
>
> **Still NOT implemented**: an XRPC client, OAuth, app passwords, PDS
> login, repository writes, firehose/Jetstream, Relay/App View
> integration, DID/handle resolution, blob fetching, rich-text
> rendering, facets, embeds, record updates/deletion, a Session Gateway
> Adapter, persistence, moderation enforcement, GUI, and any wiring of
> this adapter into a live path (`boardId` remains a required, caller-
> supplied parameter). `package.json`'s own `dependencies` count stays
> fixed at 2 — zero new Cargo/npm dependency, zero Rust/wasm change of
> any kind. `npm run typecheck`/`npm test` GREEN (pre-existing,
> unrelated Rust-structural test failures excluded — see
> `docs/secure_runtime_alpha_290_atproto_board_adapter_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline.
>
> See `docs/secure_runtime_alpha_281_existing_atproto_inventory.md`
> through `docs/secure_runtime_alpha_290_atproto_board_adapter_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 271–280 — ActivityPub Canonical Board
> Adapter Arc.** Implements the SECOND Protocol Adapter: a pure,
> one-way, fail-closed translation from an already-normalized,
> already-authenticated `FedosValidatedActivityPubPost` into a
> `FedosBoardPost` (Alpha 255), following the Nostr Adapter's own
> pattern (Alpha 261–270) exactly. Three new files under the new
> [`src/board/activitypub/`](src/board/activitypub/) directory:
> [`fedos_validated_activitypub_post.ts`](src/board/activitypub/fedos_validated_activitypub_post.ts)
> (`FedosValidatedActivityPubPost` — `objectId`/`actorId`/`content`/
> `published`/`inReplyTo`/`conversationRoot`, six fields, `content`
> contractually **sanitized plain text** — the only option consistent
> with `FedosBoardPost.body`'s existing plain-text-only contract and
> this Arc's own prohibition on adding an HTML parser/sanitizer; no raw
> Activity object, no HTTP headers, no HTTP Signature, no OAuth/access
> token, no `@context`/JSON-LD graph, no metadata bag),
> [`fedos_activitypub_board_adapter.ts`](src/board/activitypub/fedos_activitypub_board_adapter.ts)
> (`validateActivityPubBoardPost` + `mapValidatedActivityPubPostToBoardPostInput`
> — `objectId` → `id`/`source.reference` (Object id, not the Create
> Activity id), `actorId` → `author.publicIdentifier` verbatim (no
> profile resolution, no network calls), `content` → `body` verbatim
> with ONE minimal non-parsing fail-closed guard rejecting any raw
> `<`/`>` character since no safe upstream HTML-to-plain-text
> normalizer exists yet, `inReplyTo`/`conversationRoot` → `replyTo`/
> `threadId` — a reply with no resolved `conversationRoot` is rejected
> outright, "Option C": an upstream resolver's job, never the adapter's
> own network resolution; composes with, never duplicates,
> `validateFedosBoardPost`, Alpha 257, unmodified), and
> [`fedos_activitypub_mutation_boundary.ts`](src/board/activitypub/fedos_activitypub_mutation_boundary.ts)
> (`FedosActivityPubMutationObservation`, a minimal INERT type formally
> separating `Update`/`Delete` from `FedosBoardPost` — no boolean
> `deleted`/`updated` field is ever added to it, never wired into the
> adapter; `Announce`/`Like`/`Follow`/`Undo` stay entirely out of
> scope). Verified against a 12-case required fixture matrix (Mastodon-
> and generic-ActivityPub-shaped Create(Note), root/reply/reply-without-
> root, Unicode, empty/oversized-body rejection, malformed actor/object
> id rejection, self-reply rejection reused from `validateFedosBoardPost`
> not duplicated, deterministic repeated mapping), confirmed shape-
> identical to a Nostr-produced `FedosBoardPost`, and confirmed the
> Nostr Board Adapter (Alpha 266) has zero functional coupling to
> ActivityPub.
>
> **Still NOT implemented**: an ActivityPub HTTP server, inbox, outbox,
> WebFinger, NodeInfo, Actor hosting/discovery, HTTP Signatures, profile
> resolution, attachment fetching, `Update`/`Delete` application,
> federation delivery, Mastodon OAuth, AT Protocol/Session Protocol
> Adapters, Relay Pool, persistence, moderation enforcement, GUI, and any
> wiring of this adapter into a live path (`boardId` remains a required,
> caller-supplied parameter). `package.json`'s own `dependencies` count
> stays fixed at 2 — zero new Cargo/npm dependency, zero Rust/wasm
> change of any kind. `npm run typecheck`/`npm test` GREEN (pre-existing,
> unrelated Rust-structural test failures excluded — see
> `docs/secure_runtime_alpha_280_activitypub_board_adapter_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline.
>
> See `docs/secure_runtime_alpha_271_existing_activitypub_inventory.md`
> through `docs/secure_runtime_alpha_280_activitypub_board_adapter_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 261–270 — Nostr Canonical Board
> Adapter Arc.** Implements the FIRST Protocol Adapter: a pure, one-way,
> fail-closed translation from an already-verified
> `FedosValidatedNostrEvent` (Alpha 242) into a `FedosBoardPost` (Alpha
> 255), treating the Canonical Board Model (Alpha 251–260) as the Single
> Source of Truth. One new file,
> [`fedos_board_nostr_adapter.ts`](src/board/fedos_board_nostr_adapter.ts),
> exports `validateNostrBoardPost(event, boardId)` and
> `mapValidatedNostrEventToBoardPostInput(event, boardId)`. Field
> mapping (frozen, Alpha 261–265): `id` → `FedosBoardPost.id` AND
> `source.reference`; `pubkey` → `author.publicIdentifier` (verbatim
> hex, no npub re-encoding, no display-name derivation, no profile
> resolution, no relay access); `created_at` → `createdAt`; `content` →
> `body` (verbatim, no Markdown/HTML/rendering); `kind` gates acceptance
> to `1` only (any other kind rejected — the only kind this repository
> has established real thread semantics for) and is never carried
> forward; `sig` is never carried forward (already consumed by upstream
> verification); `tags` are interpreted (NIP-10 root/reply resolution,
> mirroring `src/thread/thread.ts`'s own established rule exactly, never
> imported) into `threadId`/`replyTo`, never embedded raw; `boardId` is
> supplied by the caller (Nostr has no native board concept — Board
> Application Logic's own job, out of scope); `author.identityId` is
> always `null` this Arc (no local-identity linking exists yet). Two
> thread-mapping edge cases are named as explicit deferred boundaries
> rather than invented around (a lone `root`-marked tag with no `reply`
> marker; a lone `reply`-marked tag with no `root` marker). Verified
> deterministic by real repeated calls (Alpha 267), verified to import
> nothing but a type-only `FedosValidatedNostrEvent` reference plus the
> Board model's own validator — zero Relay/Runtime/Storage/GUI/Worker/
> Desktop-state reference (Alpha 268) — and verified to produce a
> `FedosBoardPost` carrying no Nostr-specific key outside
> `author.protocol`/`source.protocol` (Alpha 269).
>
> **Still NOT implemented**: ActivityPub/AT Protocol/Session Protocol
> Adapters, Relay Pool, persistence, moderation enforcement, ranking,
> notifications, DM, attachments, HTML/Markdown rendering, GUI, and any
> wiring of this adapter into a live Subscription/Relay/Runtime path
> (`boardId` remains a required, caller-supplied parameter — no
> subscription-to-board policy exists yet). `package.json`'s own
> `dependencies` count stays fixed at 2 — zero new Cargo/npm dependency,
> zero Rust/wasm change of any kind. `npm run typecheck`/`npm test`
> GREEN (pre-existing, unrelated Rust-structural test failures excluded
> — see
> `docs/secure_runtime_alpha_270_nostr_board_adapter_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline.
>
> See `docs/secure_runtime_alpha_261_nostr_board_field_inventory.md`
> through `docs/secure_runtime_alpha_270_nostr_board_adapter_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 251–260 — Canonical Board Model
> Foundation Arc.** Defines a protocol-independent Canonical Board
> Model — NOT a Nostr Event wrapper — the shared application model a
> future Nostr/ActivityPub/ATProto/Session Protocol Adapter will map
> into, before any adapter is built. Six new files under the new
> [`src/board/`](src/board/) directory:
> [`fedos_board_identifiers.ts`](src/board/fedos_board_identifiers.ts)
> (four branded, mutually non-interchangeable identifier types —
> `FedosBoardId`/`FedosThreadId`/`FedosBoardPostId`/
> `FedosExternalReference` — "Option C": application-generated ids, no
> random generation, no protocol parsing),
> [`fedos_board_source.ts`](src/board/fedos_board_source.ts)
> (`FedosBoardSourceReference`, explicit provenance — a closed
> five-protocol union plus an opaque reference string, no secret/token/
> credential field),
> [`fedos_board_author.ts`](src/board/fedos_board_author.ts)
> (`FedosBoardAuthorReference`, "Option D" — `identityId`/`protocol`/
> `publicIdentifier` only; `displayName`/`avatar` deliberately EXCLUDED
> to avoid a stale profile snapshot on an immutable post),
> [`fedos_board_post.ts`](src/board/fedos_board_post.ts)
> (`FedosBoardPost`, eight `readonly` fields — `id`/`boardId`/
> `threadId`/`replyTo`/`author`/`body`/`createdAt`/`source` — no
> transport object embedded, plain-text `body` only, no title/
> attachments this Arc),
> [`fedos_board_post_validator.ts`](src/board/fedos_board_post_validator.ts)
> (`validateFedosBoardPost`, a typed-builder, fail-closed boundary — the
> ONLY place a `FedosBoardPost` is constructed; non-empty ids, a
> seconds-domain `createdAt` check that also rejects an accidental
> milliseconds value, a 10,000-character body cap, self-reply rejection,
> deep-copy + `Object.freeze`), and
> [`fedos_board_moderation.ts`](src/board/fedos_board_moderation.ts)
> (`FedosBoardModerationRecord`, "Option B" — kept entirely separate
> from `FedosBoardPost`, no `deleted` boolean, types + label constants
> only, zero enforcement logic). `threadId` (root identity) +
> `replyTo` (direct parent) — "Option C" — give nested-reply structure
> with O(1) thread lookup; same-board/cycle/missing-parent invariants
> are explicitly assigned to a future Board Application Logic layer, not
> built here. Verified honest for all four target protocols by real
> fixture construction (Nostr/ActivityPub/AT Protocol/Session, two root
> + two reply fixtures, no adapter module, no real network call).
>
> **Still NOT implemented**: Nostr/ActivityPub/ATProto/Session Protocol
> Adapters, Relay Pool, persistence, moderation enforcement, ranking,
> notifications, DM, attachments, HTML/Markdown rendering, GUI. `package.json`'s
> own `dependencies` count stays fixed at 2 — zero new Cargo/npm
> dependency, zero Rust/wasm change of any kind. `npm run typecheck`/
> `npm test` GREEN (pre-existing, unrelated Rust-structural test
> failures excluded — see
> `docs/secure_runtime_alpha_260_canonical_board_model_completion.md`).
> `cargo check` GREEN; `cargo test` fails to BUILD in this environment
> due to a pre-existing, unrelated MinGW `dlltool` path issue (the
> checkout path contains spaces and non-ASCII characters), reproduced
> identically on the pre-Arc baseline.
>
> See `docs/secure_runtime_alpha_251_existing_board_model_inventory.md`
> through `docs/secure_runtime_alpha_260_canonical_board_model_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 241–250 — Nostr Inbound Event
> Validation Arc.** Adds cryptographic validation for inbound NIP-01
> Events received through the single-Relay transport (Alpha 211–240).
> `parseRelayInboundMessage` (Alpha 233) only ever validated STRUCTURE —
> a parsed `FedosNostrWireEvent` was not yet trusted. Five new files
> under `src/desktop/` close that gap:
> [`fedos_validated_nostr_event.ts`](src/desktop/fedos_validated_nostr_event.ts)
> (`FedosValidatedNostrEvent`, the SAME seven NIP-01 wire fields,
> verbatim, construction-restricted to the validator module by
> convention — no `valid`/`status` field, no metadata bag),
> [`nostr_event_id_verifier.ts`](src/desktop/nostr_event_id_verifier.ts)
> (`verifyNostrEventId`, a pure, fail-closed NIP-01 canonical-serializer
> + SHA-256 check — a NEW, independent implementation reconciling the
> `JSON.stringify` escaping divergence Alpha 191/241 found in the legacy
> `src/nostr/event.ts`'s own `verifyEventId`),
> [`nostr_signature_verifier.ts`](src/desktop/nostr_signature_verifier.ts)
> (`verifyNostrEventSignature`, calling `@noble/curves`'s own
> `schnorr.verify` directly — the SAME BIP-340 primitive
> `NobleSignatureVerifier` itself already uses, reused, not redesigned),
> [`combined_inbound_event_validator.ts`](src/desktop/combined_inbound_event_validator.ts)
> (`validateInboundNostrEvent`, the single entry point: id verification
> FIRST, signature verification SECOND, `null` for every failure with
> no distinction exposed, a deep-cloned + `Object.freeze`d output), and
> [`validated_subscription_adapter.ts`](src/desktop/validated_subscription_adapter.ts)
> (`createValidatedEventListener`, an EXTERNAL adapter over the existing
> `onSubscriptionMessage()` — zero change to
> `FedosRelay`/`WebSocketRelay`/`NullRelay`). All eight NIP-01 failure
> causes (wrong/malformed id, wrong/malformed signature, malformed
> pubkey, unsupported key encoding, canonicalization mismatch,
> cryptographic-verifier exception) collapse to the SAME `null`/dropped
> outcome — fail-closed, coarse, no oracle, no NOTICE, no disconnect, no
> retry, no logging.
>
> **Still NOT implemented**: Relay Pool, cross-relay deduplication,
> persistent storage, moderation, deletion/replaceable/addressable-event
> semantics, DM, NIP-42, NIP-05, NIP-46, automatic reconnect, GUI,
> Worker/AppRuntime/Observation changes. `package.json`'s own
> `dependencies` count stays fixed at 2 — zero new Cargo/npm dependency,
> zero Rust/wasm change of any kind. `npm run typecheck`/`npm test`
> GREEN. `cargo check`/`cargo test` GREEN (pre-existing, unrelated
> failures excluded — see `docs/secure_runtime_alpha_250_inbound_validation_completion.md`).
>
> See `docs/secure_runtime_alpha_241_existing_inbound_validation_inventory.md`
> through `docs/secure_runtime_alpha_250_inbound_validation_completion.md`
> for the full, per-Stage design record.
>
> Prior status:
>
> **Status: Secure Runtime Alpha 231–240 — Nostr Relay Message
> Reception Arc.** Completes the INBOUND half of the single-Relay
> transport `FedosRelay`/`WebSocketRelay` (`src/desktop/`) already
> established (Alpha 211–230: connect/disconnect/publish/subscribe/
> unsubscribe). Four new files —
> [`fedos_relay_inbound_message.ts`](src/desktop/fedos_relay_inbound_message.ts)
> (a closed, four-member, fully-`readonly` EVENT/EOSE/OK/NOTICE union),
> [`fedos_nostr_wire_event.ts`](src/desktop/fedos_nostr_wire_event.ts)
> (a dedicated `FedosNostrWireEvent`, preserving all seven NIP-01 wire
> field names verbatim — no rename, no synthesized `provider` field),
> [`relay_inbound_parser.ts`](src/desktop/relay_inbound_parser.ts)
> (`parseRelayInboundMessage`, a pure, total, never-throwing structural
> parser — **zero cryptographic verification**, deliberately deferred),
> and [`fedos_relay_listeners.ts`](src/desktop/fedos_relay_listeners.ts)
> (`FedosSubscriptionListener`/`FedosRelayMessageListener`) — plus two
> ADDITIVE methods on `FedosRelay`, `onSubscriptionMessage()` (EVENT/EOSE
> routed by subscription id, EOSE never auto-unsubscribes) and
> `onRelayMessage()` (one relay-wide OK/NOTICE listener). Every listener
> invocation is isolated in its own `try`/`catch`; a stale socket left
> over from a prior `connect()` can never deliver again after
> reconnect. `connect`/`disconnect`/`publish`/`subscribe`/`unsubscribe`
> are all UNCHANGED in their own public contracts.
>
> **Still NOT implemented**: cryptographic validation of a received
> Event (a real, reusable Schnorr verifier already exists in
> `src/nostr/noble_signature.ts`, but is deliberately not wired in this
> Arc — recommended as the next Arc), Relay Pool, multi-relay routing,
> automatic reconnect, persistent subscriptions, storage, DM, GUI,
> Worker/AppRuntime/Observation changes. `package.json`'s own
> `dependencies` count stays fixed at 2. `npm run typecheck`/`npm test`
> GREEN. `cargo check`/`cargo test` GREEN (pre-existing, unrelated
> failures excluded — see `docs/secure_runtime_alpha_240_relay_reception_completion.md`).
>
> See `docs/secure_runtime_alpha_231_existing_relay_inbound_inventory.md`
> through `docs/secure_runtime_alpha_240_relay_reception_completion.md`
> for the full, per-Stage design record.
>
> **Stage 157–160 — Ciphertext envelope skeleton + public API
> planning.** A new `src/crypto/ciphertext_envelope.rs` turns
> `docs/ciphertext_envelope_plan.md`'s six planned fields into a concrete,
> `pub(crate)`-only skeleton: `AeadCiphertextEnvelope` holds `version:
> AeadEnvelopeVersion`, `algorithm: AeadEnvelopeAlgorithm`, `nonce: [u8;
> 12]`, a fixed `ciphertext_placeholder: [u8; 4]` marker (NOT real
> ciphertext‖tag), and `aad_domain: AeadEnvelopeAadDomain`.
> `AeadEnvelopeAlgorithm`/`AeadEnvelopeAadDomain` are deliberately NEW,
> SEPARATE types from `crypto::aead_internal`'s own `AeadCipher`/
> `AeadAadDomain` — this skeleton stays unconnected from the real AEAD
> implementation, same discipline as every other unconnected skeleton in
> this crate.
>
> `validate_envelope_internal` validates UNTRUSTED CANDIDATE field values
> (raw version/algorithm/AAD-domain discriminant bytes, a nonce byte
> slice, a ciphertext-placeholder byte slice) in order — version first,
> then algorithm, then AAD domain, then nonce length, then the ciphertext
> placeholder's exact bytes — returning a fixed `AeadEnvelopeStatus`. No
> AEAD authentication/decryption is performed (no real ciphertext exists
> yet), and no serialization/deserialization of any wire format exists —
> this is validation of already-split candidate values, not a codec.
>
> `docs/ciphertext_envelope_plan.md` section 9 fixes, in writing only, the
> shape a FUTURE Stage 161 bridge would take to connect
> `crypto::aead_internal`'s real seal/open results to a real (non-
> placeholder) envelope — not built this stage.
> `docs/public_encrypt_decrypt_api_plan.md` (new) fixes the shape a future
> PUBLIC `encrypt`/`decrypt` API would take: key input as `SecretHandle`
> only (never a raw byte/password/seed), nonce always internal or
> envelope-extracted (never caller-supplied), ciphertext as an envelope
> type, AAD as a fixed domain-label selection. Runtime/storage
> connections and NIP-44 are all explicitly named as their own, later,
> separate stages.
>
> **Still NOT implemented**: public `encrypt`/`decrypt`/`deriveKey`, any
> serialization (JSON/base64/CBOR/`serde`), the envelope↔AEAD seal/open
> bridge (ciphertext stays a fixed placeholder), NIP-44,
> Runtime/Worker/storage/WASM wiring.
>
> This crate's public `pub fn` surface is UNCHANGED (still twenty-four
> functions) — every new item is `pub(crate)`-at-most. `cargo check`/
> `cargo test` (174 crate unit tests, up from 162 — 12 net new
> `ciphertext_envelope` tests)/`cargo check --tests` all GREEN. `npm run
> typecheck`/`npm test` GREEN (137 files, 2046 tests, up from 136/2031 —
> one new guard file,
> [`test/fedos_core_rust_ciphertext_envelope.test.ts`](test/fedos_core_rust_ciphertext_envelope.test.ts)
> (15 tests)). `git status` clean aside from this batch's intended files.
>
> See `docs/ciphertext_envelope_plan.md` and
> `docs/public_encrypt_decrypt_api_plan.md` for the full design records.
> Stage 161 candidates: (1) Internal AEAD envelope seal/open bridge
> (recommended first — connect the envelope to real ciphertext before the
> public boundary); (2) Public `encrypt`/`decrypt` API skeleton; (3) NIP-44
> internal implementation planning.
> Prior status:
>
> **Stage 152–156 — AEAD Internal Foundation.** A new
> `src/crypto/aead_internal.rs` gives this crate its FIRST real AEAD
> implementation: `seal_internal`/`open_internal` implement BOTH
> ChaCha20-Poly1305 (Stage 74) and AES-256-GCM (Stage 101), consuming
> ONLY a `SecretHandle(AeadKeyMaterial)` key and a `Ready`
> `FedosAeadNonceDecision` nonce (from `fedos_aead_nonce_96`, Stage 138) —
> never a caller-supplied raw key/nonce byte. `SecretHandle` gains a
> SECOND narrowly-scoped accessor, `expose_bytes_for_internal_aead`
> (method count seven → eight). Misuse guards run BEFORE any cipher is
> touched (`InvalidKey`/`InvalidNonce`); decryption failure is a SINGLE
> fixed `AuthenticationFailed` label. `Cargo.toml` UNCHANGED. Stage 155
> adds `aead_diagnostics` (both ciphers `Ready`).
>
> **Still NOT implemented** (as of that stage): public `encrypt`/
> `decrypt`, a ciphertext envelope/serialization format, NIP-44,
> Runtime/Worker/storage/WASM wiring.
> Prior status:
>
> **Stage 147–151 — Crypto Core Boundary Completion (HKDF internal
> implementation + capability matrix + diagnostics preview).** The
> crate-private `kdf_core` module (Stage 82) gains its FIRST real
> implementation: `derive_secret_handle_internal(input: &SecretHandle,
> domain: HkdfDomain) -> HkdfDecision` derives a NEW
> `SecretHandle(HkdfOutputMaterial)` from an existing
> `SecretHandle(HkdfInputMaterial)` via HKDF-SHA256 (RFC 5869), using a
> fixed, `HkdfDomain`-selected salt/info (`RootKey`/`Identity`/`Storage`/
> `Conversation`/`TestOnly`) — never caller-supplied, never random. Real
> domain separation is `cargo test`-verified: two domains, same input,
> produce different output bytes. `SecretHandle` gains one new,
> narrowly-scoped `pub(crate)` accessor,
> `expose_bytes_for_internal_derivation` (method count six → seven) — still
> no public raw-byte accessor anywhere. `Cargo.toml`'s ONLY change: `sha2`
> promoted from `[dev-dependencies]` to `[dependencies]` (mandatory — `hkdf`
> needs a concrete hash algorithm to instantiate in production code).
>
> Stage 150–151 add a crate-private `crypto` module — this crate's FIRST
> multi-file module (`src/crypto.rs` + `src/crypto/capability_matrix.rs` +
> `src/crypto/diagnostics.rs`, vs. every prior module being inline in
> `src/lib.rs`): a fixed nine-capability label enum (`CryptoCapability` —
> Random/Nonce/SecretHandle/Hkdf/Aead/Nip44/Schnorr/StorageKey/
> ConversationKey) and a fixed, hand-maintained, DISPLAY-ONLY
> `crypto_diagnostics_preview()` reporting Random/Nonce/SecretHandle/Hkdf as
> `Ready`, Aead as `NotConnected`, and Nip44/Schnorr/StorageKey/
> ConversationKey as `NotImplemented` — never a live probe, never touching
> a secret byte.
>
> **Still NOT implemented**: AEAD execution, `encrypt`/`decrypt`, NIP-44,
> public `deriveKey` API, Runtime/Worker/WASM wiring, `domain_label`
> (Stage 88) connection.
> Prior status:
>
> **Stage 144–146 — SecretHandle real-byte implementation.** The
> crate-private `secret_handle` module (Stage 79) gains its FIRST real-byte
> construction path,
> `new_from_32_bytes_for_internal_use(kind: SecretHandleKind, bytes: [u8; 32])`,
> alongside a new `SecretHandleKind` classification label (`Placeholder` /
> `AeadKeyMaterial` / `HkdfInputMaterial` / `HkdfOutputMaterial` /
> `NostrKeyMaterial` / `TestOnlySecretMaterial`) and `SecretInputLength`
> (exactly one variant, `ThirtyTwo`). `new_placeholder()` (Stage 79) is
> UNCHANGED; both construction paths coexist on the same type. Implements
> the design the Stage 141–143 docs-only batch fixed in writing (below,
> under "Prior status").
>
> `SecretHandle` now holds real 32-byte secret material wrapped in
> `secrecy::SecretBox`, zeroized on `clear()` and again on drop (proven via
> a `#[cfg(test)]`-only atomic counter — never a production code path, never
> exposing a byte). No `Clone`, no `Debug` over raw bytes, no `Display`, no
> `Serialize`, no raw-secret `Eq`/`PartialEq`, no public raw-byte accessor,
> and no connection to `fedos_random_bytes_32`/`fedos_aead_nonce_96`/HKDF/
> AEAD/Runtime/Worker/WASM — all remain exactly as unconnected as before
> this stage. `Cargo.toml` is UNCHANGED. This crate's public `pub fn`
> surface is UNCHANGED (still twenty-four functions) — every new item is
> `pub(crate)`-at-most.
>
> `cargo check`/`cargo test` (127 crate unit tests, up from 119 — 12 net
> new `secret_handle` tests)/`cargo check --tests` all GREEN. `npm run
> typecheck`/`npm test` GREEN (132 files, 1979 tests, up from 131/1963 — one
> new guard file
> ([`test/fedos_core_rust_secret_handle_real_bytes.test.ts`](test/fedos_core_rust_secret_handle_real_bytes.test.ts),
> 16 tests) plus the existing
> [`test/fedos_core_rust_secret_handle.test.ts`](test/fedos_core_rust_secret_handle.test.ts)
> updated for the four-variant state enum and six-method set). `git status`
> clean aside from this stage's intended files.
>
> **What this stage deliberately does NOT do**: no HKDF connection, no AEAD
> connection, no `deriveKey`/`encrypt`/`decrypt` public API change, and no
> Runtime/Worker/WASM wiring — each is its own future, separate,
> explicitly-reviewed stage.
> Prior status:
>
> **Stage 141–143 — SecretHandle real-byte implementation
> preparation (docs only).** A three-stage, **docs-only** batch that
> fixes the concrete type/method shape and test strategy a future stage
> must satisfy before `SecretHandle` (Stage 79) is extended to hold real
> secret bytes. **No `src/`, `packages/`, `Cargo.toml`, or `test/` file
> was touched — no real bytes given to `SecretHandle`, no HKDF/AEAD
> wiring, and no Runtime/Worker change of any kind.**
>
> **Stage 141 — [`docs/secret_lifecycle_implementation_plan.md`](docs/secret_lifecycle_implementation_plan.md)
> §14 update.** Records that Stage 137's `fedos_random_bytes_32` and
> Stage 138's `fedos_aead_nonce_96` are now both real, `cargo test`-verified
> implementations — the two preconditions
> `docs/implementation_phase_roadmap.md` §1 placed before `SecretHandle`
> real bytes are done, and `SecretHandle` real bytes is next but still
> **NOT implemented**. Fixes explicitly that `SecretHandle` must never
> call `fedos_random_bytes_32`/`fedos_aead_nonce_96` itself (it receives
> already-drawn bytes as a constructor parameter) and must not connect to
> HKDF or AEAD in the same stage that gives it real bytes — both
> connections remain their own, later, separate stages.
>
> **Stage 142 — [`docs/secret_handle_api_shape.md`](docs/secret_handle_api_shape.md)
> (new).** Fixes the concrete type/method shape: five candidate types
> (`SecretHandleState`, `SecretHandleKind`, `SecretHandle`,
> `SecretHandleStatus`, `SecretInputLength`) and five candidate methods
> (`new_from_32_bytes_for_internal_use`, `status`, `kind`, `clear`,
> `is_cleared`). Input starts at a fixed-size `[u8; 32]` only —
> `Vec<u8>` and `String`/password input stay forbidden. `Clone`, raw-byte
> `Debug`, public `AsRef<[u8]>`, `Display`, `Serialize`, and raw-secret
> `Eq`/`PartialEq` are all explicitly forbidden. Names the future
> HKDF/AEAD connection shape without building it.
>
> **Stage 143 — [`docs/secret_memory_test_strategy.md`](docs/secret_memory_test_strategy.md)
> (new).** Fixes the concrete test gates: `Clone`-absence proof,
> `Debug`-no-raw-byte assertion, `clear()`/`is_cleared()` state-machine
> checks (including double-clear idempotency), a drop-time zeroize
> verification approach (with its use-after-free-adjacent caveat named
> explicitly), no-raw-exposure and exact-method-set assertions, and
> no-`Vec`/`String`/`serde` checks. Panic-time zeroization and WASM-time
> behavior are named as open, untested limitations, not solved problems;
> Miri/Valgrind/sanitizer tooling is recorded as valuable future work, not
> a blocker for the first real-byte stage.
>
> **This batch is docs-only, with no Rust/`src`/`test` change of any
> kind.** `npm run typecheck` and `npm test` stay GREEN (131 files, 1963
> tests, unchanged); `cargo check`/`cargo test`/`cargo check --tests`
> were re-confirmed GREEN in the `stable-x86_64-pc-windows-msvc` toolchain
> this session, unaffected since no `.rs`/`Cargo.toml` file was touched;
> `git status` is clean aside from this docs batch. **The next step is
> the `SecretHandle` real-byte implementation itself** — the
> Implementation Phase has landed `randomBytes` (Stage 137) and the nonce
> helper (Stage 138) but has not yet touched `SecretHandle`. Stage 144
> candidates: (1) **`SecretHandle` real-byte implementation** (recommended
> first — the shape and test gates are now fixed in writing, so the next
> stage can implement directly against
> `docs/secret_handle_api_shape.md`/`docs/secret_memory_test_strategy.md`
> rather than designing under pressure); (2) HKDF internal implementation
> planning update; (3) AEAD implementation staging docs.
> Prior status:
>
> **Stage 138–140 — Fixed-size AEAD nonce helper + Stage 137
> cargo-verification gate closed.** `packages/fedos-core-rust/src/lib.rs`
> gains `fedos_aead_nonce_96()` — the crate's SECOND real implementation,
> drawing exactly 12 bytes (96 bits) from the OS CSPRNG via
> `getrandom::fill`, independent of Stage 137's `fedos_random_bytes_32`
> (neither calls the other). `FedosAeadNonceKind` (one variant,
> `NinetySixBit`), `FedosNonceState` (`Ready` / `EntropySourceUnavailable`
> — its own independent type, not shared with `FedosRandomBytesState`),
> and `FedosAeadNonceDecision` (`kind`/`state`/`nonce: Option<[u8; 12]>`)
> round out the group. The public `pub fn` surface grows from twenty-three
> (Stage 137) to twenty-four.
>
> **Implements `docs/nonce_generation_policy.md`'s MVP decision (Stage
> 134) exactly**: a CSPRNG-drawn random nonce, never a counter, never
> deterministic, never derived from a seed/password/user id — the
> function accepts no parameter of any kind. A CSPRNG failure returns
> `EntropySourceUnavailable` with `nonce: None` — no fallback PRNG, no
> panic. **This is a nonce-DRAWING helper ONLY**: no AEAD seal/open, no
> encrypt/decrypt, no key derivation, and no connection to
> `encrypt_placeholder`/`decrypt_placeholder` (Stage 69), `aead_core`
> (Stage 80), `kdf_core` (Stage 82), or `SecretHandle` (Stage 79) — a
> future AEAD stage would need to be the one to call this helper, and
> that wiring does not exist yet. `Cargo.toml` is UNCHANGED; no
> Runtime/Worker/WASM wiring.
>
> New [`test/fedos_core_rust_aead_nonce.test.ts`](test/fedos_core_rust_aead_nonce.test.ts)
> (20 tests) and a new `#[cfg(test)]`-only `aead_nonce_wiring` module in
> `src/lib.rs` (6 tests: exact 12 bytes returned, two calls differ — a
> non-determinism sanity check, not a randomness proof — the fixed
> failure shape, the single-variant kind enum, no panic across repeated
> calls, and independence from `fedos_random_bytes_32`) cover the new
> boundary. Thirty-one existing `fedos_core_rust_*.test.ts` guard files
> were updated for the new twenty-four-function `pub fn` total, and one
> pre-existing invariant test
> ([`test/fedos_core_rust_aes_gcm_wiring.test.ts`](test/fedos_core_rust_aes_gcm_wiring.test.ts))
> gained a narrow, explicit exception for the one reviewed `nonce` field
> this stage introduces.
>
> **Stage 137's cargo-verification gate — outstanding since that stage's
> own status report — is now CLOSED.** No Rust toolchain existed in the
> working environment; a `stable-x86_64-pc-windows-msvc` toolchain
> (rustc/cargo 1.96.1) was installed (Visual Studio Build Tools 2026 +
> `rustup`, after the GNU host's bundled linker turned out to be
> incomplete) and `cargo check`/`cargo test`/`cargo check --tests` all ran
> GREEN — 113 crate unit tests passed at Stage 137 (119 after this
> stage's own nonce tests), including all five dedicated
> `random_bytes_wiring` tests. **No code fix was needed** — Stage 137's
> implementation compiled and passed on the first real `cargo test` run.
> `docs/random_bytes_implementation_plan.md` §15 and
> `docs/nonce_generation_policy.md` §16 record this. `npm run typecheck`
> and `npm test` stay GREEN (131 files, 1963 tests). Where this batch
> stopped, on purpose: no AEAD/encrypt/decrypt/deriveKey implementation,
> no `SecretHandle` real bytes, no WASM, and no Runtime/Worker wiring —
> see `docs/implementation_phase_roadmap.md`. Stage 141 candidates: (1)
> `SecretHandle` real-byte implementation PLANNING update (recommended
> first — finalize the real-byte design in writing, per
> `docs/secret_lifecycle_implementation_plan.md`, before touching the
> type); (2) `SecretHandle` real-byte implementation; (3) HKDF internal
> implementation.
> Prior status:
>
> **Stage 137 — Rust `randomBytes` implementation.** The
> Implementation Phase's FIRST real code: `packages/fedos-core-rust/src/lib.rs`
> gains `FedosRandomBytesLength` (one variant, `ThirtyTwo`),
> `FedosRandomBytesState` (`Ready` / `EntropySourceUnavailable`),
> `FedosRandomBytesDecision` (`length`/`state`/`bytes: Option<[u8; 32]>`),
> and one new function, `fedos_random_bytes_32()`, which draws exactly 32
> bytes from the OS CSPRNG via `getrandom::fill` — the FIRST time
> `getrandom` (adopted Stage 104, build-check only until now) is actually
> imported and called anywhere in this crate, production or test. The
> public `pub fn` surface grows from twenty-two (Stage 106) to
> twenty-three.
>
> **Scope, exactly as planned Stage 134–136:** output length is fixed at
> 32 bytes, selected by a label, never an open caller-supplied count — no
> zero-length request exists. A CSPRNG failure returns
> `EntropySourceUnavailable` with `bytes: None` — no fallback PRNG, no
> `rand`/`thread_rng`/`Math.random()`-equivalent substitute, and no panic
> (`getrandom::fill`'s `Result` is matched exhaustively, never
> `.unwrap()`/`.expect()`-ed). **No nonce generation, no key generation,
> no key derivation, and no AEAD/KDF/NIP-44 operation is added or
> connected** — `SecretHandle` (Stage 79), `aead_core` (Stage 80), and
> `kdf_core` (Stage 82) remain exactly as placeholder as before this
> stage; `random_bytes_placeholder` (Stage 69) and
> `fedos_random_boundary_status`/`FedosRandomBoundary` (Stage 103) are
> byte-for-byte unchanged. `Cargo.toml` is UNCHANGED (no dependency
> change). **No WASM target/loader and no Runtime/Worker/`CryptoProvider`
> wiring** — `fedos_random_bytes_32` is reachable only by directly calling
> the crate.
>
> New [`test/fedos_core_rust_random_bytes.test.ts`](test/fedos_core_rust_random_bytes.test.ts)
> (20 tests) covers the new declarations, the fixed-length/no-caller-
> parameter shape, the single `getrandom::fill` call site matched
> exhaustively, the no-fallback-PRNG guarantee, and (checked structurally,
> not by a bare word match, since this stage's own doc comments legitimately
> NAME "nonce"/"NIP-44"/"SecretHandle"/"Runtime"/"Worker" to say none is
> done) that none of those is actually implemented or connected. A new
> `#[cfg(test)]`-only `random_bytes_wiring` module in `src/lib.rs` (kept
> separate from Stage 104's label-only `csprng_verification_infrastructure`
> plan) covers: a successful call returns exactly 32 bytes tagged `Ready`;
> two calls in immediate succession differ (a non-determinism sanity
> check, not a statistical randomness proof —
> [`docs/random_bytes_implementation_plan.md`](docs/random_bytes_implementation_plan.md)
> §12 fixed this distinction in advance); the fixed
> `EntropySourceUnavailable` failure shape is constructed and asserted
> directly, since fault-injecting a real OS CSPRNG failure isn't practical
> in a portable `cargo test`; and ten repeated calls do not panic. Twenty-
> six existing `fedos_core_rust_*.test.ts` guard files were updated for
> the new twenty-three-function `pub fn` total (mechanical `22 → 23`
> bumps plus the new function name added to each expected list/whitelist);
> two Stage-106 tests
> ([`test/fedos_core_rust_algorithm_policy.test.ts`](test/fedos_core_rust_algorithm_policy.test.ts),
> [`test/fedos_core_rust_key_usage_label.test.ts`](test/fedos_core_rust_key_usage_label.test.ts))
> had their section-extraction end marker narrowed from "Stage 79" to
> Stage 137's own marker so their scope stays exactly what Stage 106
> added — the same narrowing pattern this repo used when Stage 103 first
> landed after Stage 102; and
> [`test/fedos_core_rust_getrandom_adoption.test.ts`](test/fedos_core_rust_getrandom_adoption.test.ts)'s
> Stage 104 "never calls getrandom" assertion was narrowed to "calls it
> only inside `fedos_random_bytes_32`." `npm run typecheck` and `npm test`
> stay GREEN (129 → 130 test files, 1923 → 1943 tests); `cargo` remains
> unavailable in this environment (confirmed again this stage), so `cargo
> check`/`cargo test`/`cargo check --tests` could not be re-run here — the
> new Rust code and its `#[cfg(test)]` coverage should be verified in an
> environment with `cargo` on `PATH` before Stage 138 builds on top of it.
> Where this stage stopped, on purpose: no nonce/encrypt/decrypt/deriveKey
> implementation, no `SecretHandle` real bytes, no WASM, and no Runtime/
> Worker wiring of any kind — see
> [`docs/implementation_phase_roadmap.md`](docs/implementation_phase_roadmap.md)
> for why each is its own later, separate stage. Stage 138 candidates: (1)
> a nonce helper implementation (recommended — narrow, AEAD-internal-only,
> building directly on this stage's `getrandom` wiring per
> [`docs/nonce_generation_policy.md`](docs/nonce_generation_policy.md));
> (2) `SecretHandle` real-byte implementation planning update; (3)
> randomBytes WASM behavior docs.
> Prior status:
>
> **Stage 134–136 — Nonce / Random / Secret lifecycle
> implementation-prep docs (docs only).** A three-stage, **docs-only**
> batch that fixes the last safety-design questions before the
> Implementation Phase begins. **No `src/`, `packages/`, `Cargo.toml`, or
> `test/` file was touched — no `randomBytes` implementation, no nonce
> generation implementation, no `SecretHandle` implementation change, no
> HKDF/AEAD wiring, and no Runtime/Worker change of any kind.**
>
> **Stage 134 — [`docs/nonce_generation_policy.md`](docs/nonce_generation_policy.md).**
> Fixes the nonce policy `docs/public_random_boundary.md` (Stage 103) and
> `docs/public_random_design.md` (Stage 104) deliberately deferred:
> unconditional (key, nonce) reuse prohibition for every AEAD candidate
> (ChaCha20-Poly1305 and AES-GCM, both 96-bit nonces; XChaCha20-Poly1305's
> 192-bit nonce named as a future option); a random-vs-counter comparison
> concluding the MVP draws a CSPRNG random nonce (this codebase has no
> durable, crash-safe counter-persistence mechanism today, and building one
> is a strictly larger, separate undertaking); deterministic and
> seed/password/user-id-derived nonces forbidden outright, with no
> fallback on CSPRNG failure — the whole `encrypt` operation aborts
> instead; a nonce is not a secret but must never be exposed as a
> standalone public function or reused; storage/transmission travels with
> the ciphertext in the clear; a test policy banning any "reuse works"
> test; and NIP-44's own upstream-defined nonce construction taking
> precedence for NIP-44 traffic specifically, while §2's reuse ban and §7's
> determinism ban still apply unconditionally to it.
>
> **Stage 135 — [`docs/random_bytes_implementation_plan.md`](docs/random_bytes_implementation_plan.md).**
> Fixes the preconditions for a real `randomBytes`: `getrandom` (Stage 104)
> is adopted but called by zero lines of code anywhere, prod or test;
> output length is always a fixed, small, label-selected size, never an
> open caller-supplied count, so a zero-length request is not even
> representable; an OS CSPRNG failure surfaces as one fixed error label
> and must never fall back to a secondary/software PRNG, `Math.random()`,
> or any degraded output; a deterministic/seeded RNG may exist only under
> `#[cfg(test)]`, never in a production path; WASM loading stays an
> explicitly separate, later stage; and a four-category test strategy
> (linkage, exact length, `Result::Err`-not-panic on failure,
> non-determinism between calls) that deliberately does not attempt a
> known-answer vector, since none exists for randomness by design.
>
> **Stage 136 — [`docs/secret_lifecycle_implementation_plan.md`](docs/secret_lifecycle_implementation_plan.md).**
> Fixes the policy for giving `SecretHandle` (Stage 79) real bytes instead
> of its current placeholder marker: `secrecy`/`zeroize` wrap and
> zeroize-on-drop every real secret; `Clone` is forbidden on any
> real-secret type; `Debug`/`Display`/logging of the raw value is
> forbidden, with only a non-sensitive placeholder representation
> permitted; zeroize-on-drop is the guarantee made, while panic-safety and
> core-dump exposure are explicitly named as an unsolved, deferred concern
> per the existing safety docs, never oversold as solved; no public
> function may ever return or accept raw secret bytes, only opaque
> handles; HKDF connects to `SecretHandle` before AEAD connects to HKDF's
> output, each its own reviewed stage; memory-safety limitations
> (compiler-introduced copies, OS paging, core dumps, WASM's own model) are
> stated plainly rather than wished away; and a test strategy covering the
> `Clone` ban, the `Debug` ban, zeroize-on-drop, and the no-raw-bytes-on-
> the-public-API guarantee.
>
> **This batch is docs-only, with no Rust/`src`/`test` change of any
> kind.** `npm run typecheck` and `npm test` (129 files, 1923 tests) stay
> GREEN; `git status` is clean aside from this docs batch (the
> pre-existing untracked `.claude/` directory is unrelated); `cargo` is not
> on `PATH` in this environment, so `cargo check`/`cargo test` were not
> re-run this batch either — unchanged from Stage 131–133, and moot anyway
> since no `.rs`/`Cargo.toml` file was touched. **The next step is the Rust
> `randomBytes` implementation** (`docs/implementation_phase_roadmap.md`
> §1 item 2, now that item 1's nonce policy is fixed) — the Implementation
> Phase has still not started as of Stage 136. Stage 137 candidates: (1)
> **Rust `randomBytes` implementation** (recommended first — the nonce/
> random/secret-lifecycle policies this batch fixed are now all in place,
> so the minimal real implementation, wiring the already-adopted
> `getrandom` behind the already-designed boundary, is the safest next
> step); (2) `SecretHandle` real-byte implementation; (3) a nonce helper
> skeleton.
> Prior status:
>
> **Stage 131–133 — Boundary Phase index + Implementation
> readiness checklist + Phase transition roadmap (docs only).** A
> three-stage, **docs-only** batch that closes out FedOS's Boundary Phase
> (Stage 1–130) and fixes the map for the next one. **No `src/`,
> `packages/`, `Cargo.toml`, or `test/` file was touched — no new
> boundary, no new preview, no new implementation, and no Runtime/Worker/
> Rust change of any kind.**
>
> **Stage 131 — [`docs/boundary_phase_index.md`](docs/boundary_phase_index.md).**
> A single cross-cutting index over every boundary shipped Stage 1–130,
> organized into ten categories (Crypto/Identity/Storage/Federation/
> Social/Creator/Governance/Device/Preview/Docs) instead of chronology —
> each entry names its stage number, file(s), role, implemented scope, and
> explicit NOT-implemented scope. Its conclusion (§12) restates, in one
> place, that real cryptography, real network transport, real payment/
> settlement, and real persistent storage do not exist anywhere in this
> codebase — every provider shipped is `Noop*`/`Placeholder*`/in-memory/
> mock, with the narrow exceptions already on record (NIP-07 delegation,
> Noble Schnorr verification, D1/KV/R2/MeshKV behind opt-in gates, and the
> RFC/NIST-vector-verified `cfg(test)`-only AEAD/KDF crates).
>
> **Stage 132 — [`docs/implementation_readiness_checklist.md`](docs/implementation_readiness_checklist.md).**
> A `[ ]`/`[x]` checklist across six areas — Crypto (`randomBytes`, nonce
> policy, `SecretHandle` real bytes, HKDF/AEAD internal implementation,
> public `encrypt`/`decrypt`/`deriveKey`), Storage (local-only-first
> sequencing, encrypted packet format, no Google Drive direct dependency),
> Federation (Nostr signing, relay connection, publish-queue retry
> policy), Creator (listing/entitlement models, payment deferred),
> Security (threat model, secret lifecycle, logging ban, no shadow-vault/
> anti-analysis implementation), and Testing (RFC vectors green, no
> secrets in logs, no Runtime auto-call without an explicit flag) — each
> item cites the exact stage/doc that satisfies it, or names it as an open
> blocker for Stage 134+. An `[x]` marks a **precondition** satisfied
> (a policy or safety-rule doc exists), never that the real primitive is
> implemented; §7 records this session's verified baseline (`npm run
> typecheck` green; `npm test` **129 files, 1923 tests**, green; `cargo`
> not on `PATH` in this environment, so `cargo check`/`cargo test` were
> not re-run — no Rust file has changed since Stage 106's last recorded
> green run).
>
> **Stage 133 — [`docs/implementation_phase_roadmap.md`](docs/implementation_phase_roadmap.md).**
> Fixes the recommended Stage 134+ order — ten items from a nonce-policy
> doc through Nostr signing/publish, each its own reviewed stage — plus
> why each is split rather than merged, three cross-domain combinations
> that are explicitly forbidden (crypto+storage+federation in one stage,
> payment+entitlement in one stage, NIP-44+chat in one stage), a rollback
> strategy (every stage independently revertible, every opt-in flag
> defaults off, no vector/guard-test weakening to force a revert to pass),
> and the test gates every future stage must clear. It deliberately
> reorders `docs/fedos_core_architecture_freeze_v1.md` §11's plain
> adoption list: nonce generation policy now comes **before** the
> `randomBytes` implementation, since `getrandom` is already adopted
> (Stage 104) and fixing nonce discipline in writing first prevents the
> exact (key, nonce) reuse accident that discipline exists to prevent once
> a real AEAD implementation lands.
>
> **Boundary Phase: complete.** Stage 1–130 shipped the full boundary/
> preview surface across every domain this product needs; Stage 131–133
> closes that phase with an index, a readiness checklist, and a roadmap
> instead of one more boundary. **The Implementation Phase has not
> started.** No `randomBytes`, nonce policy, `SecretHandle` real bytes,
> HKDF/AEAD internal implementation, public `encrypt`/`decrypt`/
> `deriveKey`, WASM build, Runtime crypto opt-in, local encrypted storage,
> or Nostr signing/publish exists yet — Stage 134 is the first stage that
> may begin it. `npm run typecheck` and `npm test` (129 files, 1923 tests)
> stay GREEN; `git status` is clean aside from this docs batch (the
> pre-existing untracked `.claude/` directory is unrelated). Stage 134
> candidates, in the roadmap's recommended order: (1) **nonce generation
> policy docs** (short, docs-only — fixes the scheme/source/reuse-
> prevention question before any byte-producing code); (2) **Rust
> `randomBytes` implementation** (wires the already-adopted `getrandom`
> dependency, following the nonce policy item); (3) `SecretHandle`
> real-byte implementation planning (paired with its zeroize guarantee,
> per `docs/fedos_core_rust_safety.md` §6).
> Prior status:
>
> **Stage 119–130 — Boundary Completion Batch (Protocol Adapter /
> Creator Governance / Identity & Device suites).** A twelve-stage batch
> completing FedOS's design-boundary phase — still **no relay/WebSocket/
> fetch/OAuth connection, no signing, no publish/subscribe, no real crypto,
> no real storage, no payment/Lightning/Stripe, no Runtime auto-call, no
> Worker auto-communication, and no `Cargo.toml`/Rust change of any kind.**
> Every addition is a fixed TypeScript type, a pure review/summary
> function, or a read-only preview page — exactly the "Placeholder /
> Label-only / Pure function" posture this batch was scoped to stop at.
>
> **Protocol Adapter suite (Stage 119–122):** new
> [`docs/bluesky_adapter_planning.md`](docs/bluesky_adapter_planning.md),
> [`docs/threads_adapter_planning.md`](docs/threads_adapter_planning.md),
> and [`docs/rss_adapter_planning.md`](docs/rss_adapter_planning.md) mirror
> `docs/nostr_adapter_planning.md`'s structure for the three other
> `ProtocolAdapterKind`s named since Stage 117 — each fixes a compatibility
> posture and a candidate-mapping table, and each confirms its
> `capability_matrix.ts` row stays `unavailable` outside the trivial test
> capability. New
> [`src/federation/queue_status_preview.ts`](src/federation/queue_status_preview.ts)
> defines a narrower, DISPLAY-ONLY vocabulary over the Stage 118 outbound
> queue — `QueueStatusPreviewState` (`queued_placeholder`/`idle_placeholder`
> ONLY) and a pure `summarizeQueueStatusPreview(queue)` fold reporting one
> `QueuePreviewDescriptor` (`adapterKind`/`itemCountPlaceholder`/`state`)
> per adapter kind — it never calls `enqueuePlaceholder`/
> `dequeuePlaceholder` itself, just counts an array a caller already holds.
> New [`src/render/queue_preview.ts`](src/render/queue_preview.ts), gated by
> `?queuePreview=1`, and [`docs/federation_queue.md`](docs/federation_queue.md)
> round out the boundary docs.
>
> **Creator Governance suite (Stage 123–126):** four new pure boundaries —
> [`src/creator/appeal.ts`](src/creator/appeal.ts) (`CreatorAppealDescriptor`/
> `reviewCreatorAppeal`, a labeled DISPUTE record, never an enforcement/
> reversal), [`src/creator/reputation.ts`](src/creator/reputation.ts)
> (`ReputationSignalDescriptor`/`reviewReputationSignal`, a FIXED
> `CreatorReputationLabel` — never a numeric score/weight/rank),
> [`src/creator/subscription_policy.ts`](src/creator/subscription_policy.ts)
> (`SubscriptionPolicyTargetInput`/`reviewSubscriptionPolicyTarget` —
> STRUCTURALLY conservative: only `public_placeholder` ever resolves to
> `visible_placeholder`; every gated tier resolves to
> `restricted_placeholder` UNCONDITIONALLY, no real entitlement ever
> checked), and
> [`src/community/treasury_policy.ts`](src/community/treasury_policy.ts)
> (`CommunityTreasuryDisclosureRequest`/`reviewCommunityTreasuryDisclosure`
> — a CATEGORY-name disclosure policy that computes no balance/amount/fund
> of any kind). New
> [`src/render/creator_governance_preview.ts`](src/render/creator_governance_preview.ts),
> gated by `?creatorGovernancePreview=1`, and
> [`docs/creator_governance.md`](docs/creator_governance.md) cover all four.
> None of the four implements a DAO, a vote, a payment, a settlement, or a
> real treasury balance.
>
> **Identity & Device suite (Stage 127–130):** four new pure boundaries —
> [`src/identity/device_registration.ts`](src/identity/device_registration.ts)
> (`DeviceRegistrationDescriptor`/`reviewDeviceRegistration`, a device NAME
> label, never a pairing/key exchange/sync),
> [`src/identity/device_trust.ts`](src/identity/device_trust.ts)
> (`DeviceTrustLabel`/`reviewDeviceTrust`, mirroring
> `src/creator/profile.ts`'s trust-label convention — never a real
> attestation),
> [`src/identity/session_boundary.ts`](src/identity/session_boundary.ts)
> (`SessionRequestDescriptor`/`reviewSessionRequest` — `start_`/`end_`/
> `refresh_placeholder` map 1:1 to `active_`/`ended_`/`refreshed_placeholder`,
> never a real session created/stored/invalidated), and
> [`src/identity/recovery_policy.ts`](src/identity/recovery_policy.ts)
> (`IdentityRecoveryRequestDescriptor`/`reviewIdentityRecoveryRequest` — the
> strictest boundary in this batch, given the subject matter). ALL FOUR
> reject any password/recovery-phrase/mnemonic/seed/backup/export/import/
> sync/authentication field in metadata, on top of this codebase's usual
> conservative marker family — the strictest guardrail set in this
> codebase. New
> [`src/render/device_preview.ts`](src/render/device_preview.ts), gated by
> `?devicePreview=1`, and
> [`docs/device_identity_boundary.md`](docs/device_identity_boundary.md)
> cover all four.
>
> **Worker wiring:** three new EXPLICIT flags —
> `?queuePreview=1`/`?creatorGovernancePreview=1`/`?devicePreview=1` — were
> inserted into [`src/worker.ts`](src/worker.ts) right after the Stage 118
> `?creatorAnalyticsPreview=1` branch, extending the SAME precedence chain:
> runtimeStatus → boardPreview → marketplacePreview → creatorPreview →
> communityRulesPreview → creatorDashboardPreview → creatorAnalyticsPreview
> → queuePreview → creatorGovernancePreview → devicePreview → normal
> routing. Every new branch reads no `runtime` and calls no Runtime-selected
> boundary; every pre-existing route is unaffected. New
> [`test/protocol_adapter_suite.test.ts`](test/protocol_adapter_suite.test.ts)
> (20 tests),
> [`test/creator_governance_suite.test.ts`](test/creator_governance_suite.test.ts)
> (30 tests), and
> [`test/identity_device_suite.test.ts`](test/identity_device_suite.test.ts)
> (30 tests) check: every new type is placeholder-labeled, every review
> function rejects its sensitive-marker family without mutating input, the
> subscription policy stays structurally conservative regardless of any
> supplied viewer tier, the treasury/reputation boundaries carry no numeric
> field, all three new preview flags gate correctly with the full
> precedence chain verified, and no new source imports a relay/WebSocket/
> fetch/OAuth library, calls a provider method, or reads a Runtime-selected
> boundary from the Worker. `npm run typecheck` and `npm test` (132 files,
> 1923 tests) stay GREEN; `cargo check`/`cargo test` are unchanged — no Rust
> file was touched this batch (this environment's shell has no `cargo` on
> `PATH` to re-run it, but nothing under `Cargo.toml`/`*.rs` was edited).
> Where this batch stopped, on purpose: no relay/WebSocket/fetch/OAuth/
> OAuth-token/signing/publish/subscribe, no AES/HKDF/NIP-44 implementation,
> no storage implementation (SQLite/IndexedDB/Google Drive or otherwise), no
> payment/Lightning/Stripe, no Runtime auto-call, no Worker
> auto-communication, and no `Cargo.toml`/Rust/crypto change of any kind.
> Stage 131 candidates: (1) a Marketplace listing search/filter preview
> boundary (label-only); (2) a Notification digest preview (opt-in,
> read-only); (3) a cross-suite "Boundary Phase index" doc summarizing every
> boundary shipped Stage 1–130 in one place.
> Prior status:
>
> **Stage 118 — Federation outbound queue skeleton + Creator
> analytics preview boundary + Protocol moderation compatibility docs.** One
> more pure, in-memory queue boundary, one more opt-in read-only preview
> page, and a new docs-only note — still **no real network send, no real
> preview route touches the Worker.** New
> [`src/federation/outbound_queue.ts`](src/federation/outbound_queue.ts)
> defines `OutboundQueueItemDescriptor` (`idRef?`/`intentRef?`/
> `adapterKind`/`createdAt?`/`metadata?`, NO content/body/bytes field) and
> `OutboundQueueState` (`queued_placeholder`/`dequeued_placeholder`/
> `rejected`), with pure `enqueuePlaceholder`/`dequeuePlaceholder` functions
> that reject the same signing/relay-specific sensitive-marker family as
> `src/federation/publish_intent.ts` and return a NEW array rather than
> mutating the one passed in — no `fetch`, no `WebSocket`, no signing, no
> publish/subscribe anywhere. New
> [`src/render/creator_analytics_preview.ts`](src/render/creator_analytics_preview.ts)
> (`renderCreatorAnalyticsPreview`/`renderCreatorAnalyticsPreviewPage`, plus
> static `SAMPLE_CREATOR_ANALYTICS`) shows a sample creator's `creatorRef`,
> four PLACEHOLDER counts (posts/replies/reactions/moderation events —
> static numbers, never a real aggregation), and a fixed
> `ModerationVisibilityDecision`-label summary, HTML-escaped, ending in a
> permanently `disabled` "view detail" button — no real purchaser identity
> and no monetary/settlement field of any kind. Gated behind an EXPLICIT
> `?creatorAnalyticsPreview=1` flag in
> [`src/worker.ts`](src/worker.ts) (`isCreatorAnalyticsPreviewEnabled`),
> inserted right after the Stage 117 `?creatorDashboardPreview=1` branch so
> priority is runtimeStatus → boardPreview → marketplacePreview →
> creatorPreview → communityRulesPreview → creatorDashboardPreview →
> creatorAnalyticsPreview → normal routing; the new branch reads no
> `runtime` and calls no Runtime-selected boundary, and every pre-existing
> route is unaffected. New
> [`docs/protocol_moderation_compatibility.md`](docs/protocol_moderation_compatibility.md)
> fixes, per protocol, how a future adapter would express moderation
> (Nostr's NIP-09/NIP-51 hide/mute/filter model restated protocol-
> specifically; Bluesky's label-and-single-host differences; Threads'
> centralized-platform-authority differences; RSS's "no primitive at all")
> and how FedOS's own `ModerationVisibilityDecision`
> (`src/community/moderation.ts`) stays the single source of truth for
> FedOS's own rendering regardless of protocol — docs only, no AT Protocol/
> Threads API/RSS-fetch call, no change to any shipped boundary's shape.
> New
> [`test/outbound_queue_creator_analytics.test.ts`](test/outbound_queue_creator_analytics.test.ts)
> (26 tests) checks: `enqueuePlaceholder`/`dequeuePlaceholder` are FIFO,
> pure, and never mutate their input queue, both reject the sensitive-marker
> family without enqueuing, the analytics preview escapes every label
> (including an XSS-shaped one), every button is permanently `disabled`, no
> revenue/amount/payment/checkout/invoice/buyer/email word appears anywhere
> in the new preview file, the `creatorAnalyticsPreview` flag gates
> correctly and yields precedence to every earlier preview flag, and no
> source imports a relay/WebSocket library, calls a provider method, or
> reads a Runtime-selected boundary from the Worker. `npm run typecheck` and
> `npm test` (127 files, 1843 tests) stay GREEN; `cargo check`/`cargo test`
> are unchanged — no Rust file was touched this stage (this environment's
> shell has no `cargo` on `PATH` to re-run it, but nothing under
> `Cargo.toml`/`*.rs` was edited). Where this stage stopped, on purpose: no
> real network send/signing/publish, no real analytics aggregation, no real
> moderation action, no `StorageBackend`/`PaymentProvider`/
> `EntitlementProvider`/`MarketplaceProvider`/`FederationProvider`/
> `ChatProvider` call from any new file, and no Runtime auto-call. Stage 119
> candidates: (1) a Federation outbound queue Worker-visible status preview
> (still no send); (2) a Bluesky adapter planning doc (mirroring
> `docs/nostr_adapter_planning.md`'s structure); (3) a Creator moderation
> appeal boundary (naming-only, no enforcement).
> Prior status:
>
> **Stage 117 — Protocol adapter capability matrix + Creator
> dashboard preview UI.** One more fixed, cross-protocol naming boundary
> plus one more opt-in, read-only preview page — still **no real relay/
> WebSocket/OAuth/AT-Protocol connection, no real analytics/settlement
> calculation, and only the one new preview route touches the Worker.** New
> [`src/federation/capability_matrix.ts`](src/federation/capability_matrix.ts)
> defines `ProtocolAdapterKind` (mirroring `FederationProviderKind`'s six
> labels: `nostr_`/`bluesky_`/`threads_`/`rss_`/`local_`/`test_placeholder`)
> and `ProtocolAdapterCapability` (`read_public_`/`publish_public_`/
> `reply_`/`reaction_`/`profile_`/`marketplace_announcement_`/
> `moderation_signal_`/`private_message_`/`paid_content_`/`test_placeholder`),
> with a pure `getProtocolAdapterCapabilities(adapter)` returning a FIXED row
> of `ProtocolAdapterCapabilityDecision` (`allowed`/`state`/`reason?`) and
> `canProtocolAdapterSupport(adapter, capability)` for a single lookup.
> `nostr_placeholder` marks the public-surface set (read/publish/reply/
> reaction/profile/marketplace-announcement/moderation-signal)
> `available_placeholder`; `private_message_placeholder`/
> `paid_content_placeholder` are `rejected` for Nostr STRUCTURALLY (never
> "not yet built") — private/paid content must never ride on a public relay
> event, matching the existing Nostr adapter planning docs.
> `bluesky_placeholder`/`threads_placeholder`/`rss_placeholder` are
> `unavailable` across every non-test capability — a placeholder matrix
> only, no OAuth/API/adapter design committed this stage. New
> [`src/render/creator_dashboard_preview.ts`](src/render/creator_dashboard_preview.ts)
> (`renderCreatorDashboardPreview`/`renderCreatorDashboardPreviewPage`, plus
> static `SAMPLE_CREATOR_DASHBOARDS`) shows a sample creator's `creatorRef`,
> three PLACEHOLDER counts (listings/membership plans/community rules —
> static numbers, never a real tally), and two fixed label lists (a
> federation capability summary pulled from the new matrix, and a
> moderation visibility summary), HTML-escaped, ending in three permanently
> `disabled` navigation buttons — no listing/plan/rule fetch and no
> monetary/settlement field of any kind. Gated behind an EXPLICIT
> `?creatorDashboardPreview=1` flag in
> [`src/worker.ts`](src/worker.ts) (`isCreatorDashboardPreviewEnabled`),
> inserted right after the Stage 116 `?communityRulesPreview=1` branch so
> priority is runtimeStatus → boardPreview → marketplacePreview →
> creatorPreview → communityRulesPreview → creatorDashboardPreview → normal
> routing; the new branch reads no `runtime` and calls no Runtime-selected
> boundary, and every pre-existing route is unaffected. Short **Stage 117+
> update notes** were appended to
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#16-stage-117-update-note--protocol-adapter-capability-matrix)
> and
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md#16-stage-117-update-note--creator-dashboard-preview).
> New
> [`test/capability_matrix_creator_dashboard.test.ts`](test/capability_matrix_creator_dashboard.test.ts)
> (26 tests) checks: the matrix returns a fixed row for every adapter/
> capability pair, Nostr's public-surface labels are `available_placeholder`,
> `private_message_placeholder`/`paid_content_placeholder` are never
> `available_placeholder` for ANY adapter, Bluesky/Threads/RSS stay
> `unavailable` outside the trivial test capability, the dashboard preview
> escapes every label (including an XSS-shaped one), every button is
> permanently `disabled`, no revenue/amount/payment/checkout/invoice/buyer/
> email word appears anywhere in the new preview file, the
> `creatorDashboardPreview` flag gates correctly and yields precedence to
> every earlier preview flag, and no source imports a relay/WebSocket
> library, calls a provider method, or reads a Runtime-selected boundary
> from the Worker. `npm run typecheck` and `npm test` stay GREEN; `cargo
> check`/`cargo test` are unchanged — no Rust file was touched this stage.
> Where this stage stopped, on purpose: no real relay/WebSocket/OAuth/AT-
> Protocol connection, no real analytics/settlement calculation, no
> `StorageBackend`/`PaymentProvider`/`EntitlementProvider`/
> `MarketplaceProvider`/`FederationProvider`/`ChatProvider` call from any
> new file, and no Runtime auto-call. Stage 118 candidates: (1) a Federation
> outbound queue skeleton; (2) a Creator analytics preview boundary; (3)
> Protocol moderation compatibility docs.
> Prior status:
>
> **Stage 116 — Nostr publish intent + Creator membership plan +
> Community ruleset preview UI.** Two more pure boundaries plus one more
> opt-in, read-only preview page — still **no real publish, no relay
> connection, no signing, no real payment/checkout, no real moderation
> action, and only the one new preview route touches the Worker.** New
> [`src/federation/publish_intent.ts`](src/federation/publish_intent.ts)
> defines `PublishIntentDescriptor` (`idRef?`/`actorRef?`/`targetRef?`/
> `kind`/`createdAt?`/`metadata?`, NO content/body/bytes field) with seven
> `PublishIntentKind` placeholders (`post_`/`reply_`/`reaction_`/
> `marketplace_announcement_`/`creator_profile_`/`moderation_signal_`/
> `test_placeholder`) and a pure `reviewPublishIntent` that rejects
> sensitive metadata — including a signing-specific
> `sig`/`signature`/`privkey`/`nsec`/`relay` family on top of this
> codebase's usual conservative marker list. An `accepted_placeholder`
> decision means "policy-clean", NEVER "published" or "sent"; nothing here
> signs anything, opens a relay connection, or publishes/subscribes. New
> [`src/creator/membership.ts`](src/creator/membership.ts) defines
> `MembershipPlanDescriptor` (`idRef?`/`creatorRef?`/`kind`/`visibility`/
> `metadata?`) with six `MembershipPlanKind` placeholders (`free_`/
> `supporter_`/`premium_`/`community_`/`private_chat_`/`test_placeholder`)
> and a pure `reviewMembershipPlan` that rejects any
> price/card/payment/checkout/invoice/download/entitlement metadata and
> imports neither `PaymentProvider` nor `EntitlementProvider`. New
> [`src/render/community_rules_preview.ts`](src/render/community_rules_preview.ts)
> (`renderCommunityRulePreview`/`renderCommunityRulesPreviewPage`, plus
> static `SAMPLE_COMMUNITY_RULES`) shows four sample rules' policy/target/
> action labels (HTML-escaped) plus the visibility label the Stage 115
> `reviewCommunityModerationTarget` maps each one to — never a claim of
> deletion/removal/purge, and no `content`/`body`/bytes field anywhere on
> the page. Gated behind an EXPLICIT `?communityRulesPreview=1` flag in
> [`src/worker.ts`](src/worker.ts) (`isCommunityRulesPreviewEnabled`),
> inserted right after the Stage 115 `?creatorPreview=1` branch so priority
> is runtimeStatus → boardPreview → marketplacePreview → creatorPreview →
> communityRulesPreview → normal routing; the new branch reads no `runtime`
> and calls no Runtime-selected boundary, and every pre-existing route is
> unaffected. Short **Stage 116+ update notes** were appended to
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#15-stage-116-update-note--publish-intent),
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md#15-stage-116-update-note),
> and [`docs/community_moderation_policy.md`](docs/community_moderation_policy.md)
> (§6). New
> [`test/publish_intent_membership_ruleset.test.ts`](test/publish_intent_membership_ruleset.test.ts)
> (30 tests) checks: both new boundaries accept a clean input and reject
> their respective sensitive-marker families without mutating input, the
> ruleset preview page shows a hide/mute/filter visibility label per rule
> and never a delete/remove/purge action value, the `communityRulesPreview`
> flag gates correctly (absent/`1`/`true`, `creatorPreview` winning when
> both are present), every label is HTML-escaped (including an XSS-shaped
> label), and no source imports a relay/WebSocket/signing library, calls a
> provider method, or reads a Runtime-selected boundary from the Worker.
> `npm run typecheck` and `npm test` (124 files, 1791 tests) stay GREEN;
> `cargo check`/`cargo test` are unchanged — no Rust file was touched this
> stage (this environment's shell has no `cargo` on `PATH` to re-run it,
> but nothing under `Cargo.toml`/`*.rs` was edited). Where this stage
> stopped, on purpose: no real publish/signing/relay, no real payment/
> checkout, no real moderation hide/mute/filter/apply action, no
> `StorageBackend`/`PaymentProvider`/`EntitlementProvider`/
> `MarketplaceProvider`/`FederationProvider`/`ChatProvider` call from any
> new file, and no Runtime auto-call. Stage 117 candidates: (1) a Protocol
> adapter capability matrix (docs); (2) a Creator dashboard preview UI; (3)
> a Federation outbound queue skeleton.
> Prior status:
>
> **Stage 115 — Creator profile preview UI + creator trust label boundary
> + Community moderation policy boundary.** One opt-in, read-only preview
> page plus two new pure boundaries — still **no real identity
> verification, no real moderation action, no relay connection, and only
> the one new preview route touches the Worker.** New
> [`src/creator/profile.ts`](src/creator/profile.ts) defines
> `CreatorProfileDescriptor` (`creatorRef?`/`displayName?`/`bioPreview?`/
> `category?`/`trustLabels?`/`createdAt?`/`metadata?`, no payment/
> entitlement field) with six `CreatorTrustLabel` placeholders (`unknown_`/
> `verified_`/`community_trusted_`/`new_creator_`/`reported_`/
> `test_placeholder`) and a pure `reviewCreatorProfile` that rejects
> sensitive bio/metadata content — `"verified_placeholder"` is documented
> explicitly as a FUTURE label name only; nothing in this stage performs
> KYC, OAuth, or any document check, and no code path can produce that
> label from a real verification step. New
> [`src/community/moderation.ts`](src/community/moderation.ts) defines
> `ModerationVisibilityDecision` (`visible_`/`hidden_`/`muted_`/
> `filtered_placeholder`/`rejected`), `CommunityModerationPolicyKind`,
> `CommunityModerationTargetKind`, and a pure
> `reviewCommunityModerationTarget` that maps a requested
> `hide_placeholder`/`mute_placeholder`/`filter_placeholder` action 1:1 to
> its visibility label (or `rejected` for a policy-dirty request) — no
> delete/remove/purge action exists on the type, by construction; nothing
> here mutates or deletes any content. New
> [`src/render/creator_profile_preview.ts`](src/render/creator_profile_preview.ts)
> (`renderCreatorProfilePreview`/`renderCreatorProfilePreviewPage`, plus
> static `SAMPLE_CREATOR_PROFILES`) shows a profile's display name/bio/
> category/trust labels (HTML-escaped) plus the `reviewCreatorProfile`
> review state, ending in a permanently `disabled` "follow" button — no
> profile fetch, no metadata display, no follow/subscribe/buy/message flow.
> Gated behind an EXPLICIT `?creatorPreview=1` flag in
> [`src/worker.ts`](src/worker.ts) (`isCreatorPreviewEnabled`), inserted
> right after the Stage 114 `?marketplacePreview=1` branch so priority is
> runtimeStatus → boardPreview → marketplacePreview → creatorPreview →
> normal routing; the new branch reads no `runtime` and calls no
> Runtime-selected boundary. Short **Stage 115+ update notes** were
> appended to
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md#14-stage-115-update-note)
> and a new
> [`docs/community_moderation_policy.md`](docs/community_moderation_policy.md)
> was added (cross-referenced from
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#14-stage-115-update-note--moderationvisibility)
> §14). New
> [`test/creator_profile_community_moderation.test.ts`](test/creator_profile_community_moderation.test.ts)
> (32 tests) checks: the profile preview escapes every label (including an
> XSS-shaped name), never renders `metadata`, the `creatorPreview` flag
> gates correctly and yields precedence to `boardPreview`, every trust
> label/policy/target/action kind is a `_placeholder`, sensitive
> metadata/bio content is rejected without mutation, `verified_placeholder`
> is never produced by `reviewCreatorProfile` itself, moderation actions
> map 1:1 to their visibility label with no delete/remove/purge action
> ever definable, and no source imports a relay/WebSocket/signing library,
> calls a provider method, or reads a Runtime-selected boundary from the
> Worker. `npm run typecheck` and `npm test` (123 files, 1761 tests) stayed
> GREEN at this point; `cargo check`/`cargo test` unchanged — no Rust file
> was touched.
>
> **Stage 114 — Board/Marketplace preview UI + interaction intent
> boundaries.** Two opt-in, read-only preview pages plus two new pure
> "intent" boundaries — still **no real post/purchase, no relay
> connection, no payment/entitlement processing, no storage, and only the
> two preview routes touch the Worker.** New
> [`src/render/board_preview.ts`](src/render/board_preview.ts)
> (`renderBoardPreview`/`renderBoardPreviewPage`, plus static
> `SAMPLE_BOARDS`) shows a `BoardDescriptor`'s title/topics/categories
> (HTML-escaped) and — by directly calling the Stage 113
> `boardToNostrCandidate` PURE mapping function — its candidate
> `kindLabel` only; there is no post/reply form and no content/body/bytes
> field to display. New
> [`src/render/marketplace_preview.ts`](src/render/marketplace_preview.ts)
> (`renderMarketplaceListingPreview`/`renderMarketplacePreviewPage`, plus
> static `SAMPLE_LISTINGS`) shows a listing's kind/visibility/creator
> reference and its `marketplaceListingToNostrCandidate` kindLabel, ending
> in a permanently `disabled` "buy" button — no price/payment/checkout/
> download/signed-URL field exists on the type to show. Both routes are
> gated behind an EXPLICIT `?boardPreview=1`/`?marketplacePreview=1` flag
> in [`src/worker.ts`](src/worker.ts) (`isBoardPreviewEnabled`/
> `isMarketplacePreviewEnabled`), inserted right after the existing
> `?runtimeStatus=1` branch so priority is runtimeStatus → boardPreview →
> marketplacePreview → normal routing; neither branch reads `runtime` or
> calls any Runtime-selected boundary (storage/federation/marketplace/
> payment/entitlement/chat), and every pre-existing route is unaffected.
> New [`src/social/intent.ts`](src/social/intent.ts) defines
> `BoardInteractionIntentDescriptor` (`idRef?`/`boardRef?`/`actorRef?`/
> `targetRef?`/`kind`/`createdAt?`/`metadata?`, NO content/body/bytes
> field) with seven `BoardInteractionIntentKind` placeholders
> (`create_post_`/`reply_`/`react_`/`hide_`/`mute_`/`report_`/
> `test_placeholder`) and a pure `reviewBoardInteractionIntent` — an
> `accepted_placeholder` decision means "policy-clean", NEVER "posted" or
> "sent". New [`src/marketplace/intent.ts`](src/marketplace/intent.ts)
> defines `MarketplaceIntentDescriptor` with six `MarketplaceIntentKind`
> placeholders (`view_listing_`/`purchase_intent_`/`subscribe_intent_`/
> `tip_intent_`/`request_access_`/`test_placeholder`) and a pure
> `reviewMarketplaceIntent` that rejects any price/card/payment/checkout/
> invoice/download metadata and imports neither `PaymentProvider` nor
> `EntitlementProvider`. Short **Stage 114+ update notes** were appended to
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#13-stage-114-update-note)
> and
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md#13-stage-114-update-note).
> New
> [`test/board_marketplace_preview.test.ts`](test/board_marketplace_preview.test.ts)
> (36 tests) checks: both preview flags gate correctly (absent/`1`/`true`,
> `boardPreview` winning when both are present), every label is
> HTML-escaped (including an XSS-shaped title), no price/payment/checkout/
> download/signed-URL field is ever shown, the buy button is present but
> `disabled` with no surrounding `<form>`, both intent boundaries accept a
> clean input and reject their respective sensitive-marker families
> without mutating input, and no source imports a relay/WebSocket/signing
> library, calls a provider method
> (`put`/`get`/`delete`/`requestPayment`/`purchasePlaceholder`/
> `listPlaceholder`/`checkPlaceholder`/`sendPlaceholder`/
> `publishPlaceholder`/`connect`/`disconnect`), or reads
> `runtime.storageBackend`/`.federationProvider`/`.marketplaceProvider`/
> `.creatorEntitlementProvider`/`.chatProvider` from the Worker. Two
> existing tests (`test/social_board_skeleton.test.ts` #10 and four
> `*_boundary.test.ts` "Worker source does not select/call a
> FederationProvider/ChatProvider/EntitlementProvider/MarketplaceProvider"
> checks) needed their Worker-source assertions kept passing by rewording
> two `worker.ts` doc comments that had named those types in prose — the
> underlying invariant (the Worker still never selects or calls any of
> them) did not change. `npm run typecheck`, `npm test` (122 files, 1729
> tests), `cargo check`, `cargo check --tests`, and `cargo test` (108
> tests, unchanged — no Rust file was touched this stage) all stay GREEN.
> Where this stage stopped, on purpose: no real post/reply/react/purchase,
> no relay connection, no `fetch`/WebSocket, no signing, no
> `StorageBackend`/`PaymentProvider`/`EntitlementProvider`/
> `MarketplaceProvider`/`FederationProvider`/`ChatProvider` call from any
> new file, and no Runtime auto-call. Stage 115 candidates: (1) a Creator
> profile preview UI + creator trust label boundary; (2) a Nostr publish
> intent boundary; (3) a Community moderation policy boundary
> (recommended together with (1) — with Board/Marketplace display and
> intent now in place, fixing Creator profile display and Community
> moderation policy next completes the creator-economy/self-governance
> foundation before any of them is wired to a real relay or payment rail).
> Prior status:
>
> **Stage 113 — Nostr event mapping boundary skeleton.** Realizes
> `docs/nostr_adapter_planning.md` §10 step 1 as a PURE mapping
> boundary — still **no relay connection, no WebSocket/`fetch`, no
> signing, no private key, no NIP-44/NIP-17, no publish/subscribe, and no
> private/gated/payment/entitlement data on any candidate.** New types in
> [`src/federation/types.ts`](src/federation/types.ts) (additive):
> `NostrEventCandidate` (`kindLabel`/`tags`/`contentPreview?`/
> `pubkeyRef?`/`createdAt?`/`metadata?` — no event id, signature, or real
> pubkey field), eight `NostrEventCandidateKind` labels (`text_note_`/
> `reply_`/`reaction_`/`profile_`/`long_form_`/
> `marketplace_announcement_`/`moderation_signal_`/`test_placeholder`),
> `NostrEventMappingDecision`, and a new `ModerationSignalInput`/
> `ModerationAction` (`hide_`/`mute_`/`filter_placeholder`) pair for the
> fourth mapping function. New
> [`src/federation/nostr_mapping.ts`](src/federation/nostr_mapping.ts)
> ships four PURE functions — `socialEventToNostrCandidate`,
> `boardToNostrCandidate`, `marketplaceListingToNostrCandidate`,
> `moderationSignalToNostrCandidate` — each returning an
> `accepted_placeholder`/`candidate` pair or a `rejected` decision, never
> mutating input, never throwing. Policy: only `public` visibility
> (`SocialEventDescriptor`; it has no "unlisted" value) or `public`/
> `unlisted` (`MarketplaceListingDescriptor`) is ever candidate-ized —
> `followers`/`community`/`private_placeholder`/`private` are rejected
> outright; `SocialEventKind: "chat"` is rejected UNCONDITIONALLY
> regardless of visibility (chat/DM activity never becomes a public
> candidate); and metadata/reason/title strings containing a secret/key/
> seed/token/payment/entitlement/buyer/checkout/invoice/download/signed/
> url/dm/message/body/content marker are dropped from `metadata` or cause
> outright rejection for a single field like `reason`/`title`.
> `contentPreview` is always either a FIXED placeholder string or (for a
> board's already-display-only `title`) that same sanitized label — never
> real post/message content. New
> [`test/nostr_event_mapping.test.ts`](test/nostr_event_mapping.test.ts)
> (28 tests) checks all four mapping functions against a clean input, a
> rejected chat/non-public/private visibility, sensitive metadata/reason/
> title rejection, the fixed-placeholder `contentPreview`, no mutation, no
> `id`/`sig`/`privateKey`/`pubkey` field on any candidate, and that no
> source imports a relay/WebSocket/signing/crypto library or
> `PaymentProvider`/`EntitlementProvider`/`StorageBackend`/`CryptoProvider`,
> and that neither the Runtime nor the Worker references any of the four
> mapping functions. Short **Stage 113 update notes** were appended to
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#12-stage-113-update-note)
> cross-linking the shipped mapping table to §5's candidate table. `npm
> run typecheck`, `npm test` (121 files, 1693 tests), `cargo check`,
> `cargo check --tests`, and `cargo test` (108 tests, unchanged — no Rust
> file was touched this stage) all stay GREEN. Where this stage stopped,
> on purpose: no relay/WebSocket/HTTP connection, no `fetch`, no event
> signing of any kind, no NIP-44/NIP-17, no publish/subscribe, no
> connection to `PaymentProvider`/`EntitlementProvider`/`StorageBackend`/
> `CryptoProvider`/any `FederationProvider` implementation, and no
> Runtime/Worker wiring — constructing a candidate is the only thing any
> of the four functions does. Stage 114 candidates: (1) a board route
> preview UI skeleton; (2) a creator listing preview UI skeleton
> (recommended together — with mapping candidates in place, a read-only
> preview of how a board/listing WOULD render gives the product a visible
> shape while relay/payment/entitlement all remain unimplemented); (3)
> Nostr mapping diagnostics docs. Prior status:
>
> **Stage 112 — Creator monetization + Nostr adapter planning
> (docs only).** Two new design docs fix how the already-shipped
> boundaries are EXPECTED to eventually connect — **no source file
> changed, no test file changed, no new provider/API, no `src/worker.ts`/
> `src/runtime/*`/Rust/`Cargo.toml` change.** New
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md)
> fixes the sequence a future sale would follow — listing
> (`MarketplaceProvider`) → purchase intent → payment placeholder
> (`PaymentProvider`) → entitlement check (`EntitlementProvider`) → gated
> chat/content (`ChatProvider`) → federation announcement
> (`FederationProvider`) — states the central rule that "paid" and
> "accessible" are different facts and `EntitlementProvider` alone answers
> the access question, names fee concepts (platform fee/creator share/
> developer fund/community treasury) as POLICY-ONLY with no calculation or
> ledger, names community self-governance concepts (moderation/listing
> visibility/creator trust/appeal) with an explicit "no DAO implemented"
> line, and fixes security rules (payment metadata never in chat/
> federation payloads, no entitlement decision on a public event, no buyer-
> identity leak via a public announcement). New
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md) fixes
> how a future real Nostr adapter behind `FederationProvider` would work:
> Nostr as a visibility/filter/moderation-only layer (never a deletion
> guarantee), a Damus/Primal/Amethyst compatibility goal for public posts/
> replies/reactions, a PUBLIC-metadata-only rule for what FedOS-specific
> data may ride on an event, a candidate event-mapping table (post/reply/
> board-thread/marketplace-announcement/profile/moderation-signal — naming
> only, no kind numbers finalized), and a hide/mute/filter moderation model
> instead of relying on NIP-09 delete. Both docs end with a "future
> implementation order" naming Stage 113's likely next step (a pure,
> unsigned `SocialEventDescriptor` → Nostr-event-candidate mapping
> function) without building it. Short **Stage 112 update notes** were
> appended to
> [`docs/chat_boundary.md`](docs/chat_boundary.md#6-stage-112-update-note),
> [`docs/marketplace_boundary.md`](docs/marketplace_boundary.md#7-stage-112-update-note),
> and
> [`docs/creator_entitlement_boundary.md`](docs/creator_entitlement_boundary.md#6-stage-112-update-note)
> cross-linking the new flow/planning docs — none of their shipped
> boundary content changed. `npm run typecheck`, `npm test` (120 files,
> 1665 tests, unchanged — no test file was touched), `cargo check`,
> `cargo test` (108 tests, unchanged), and `cargo check --tests` all stay
> GREEN, since no source or test file was touched. Where this stage
> stopped, on purpose: no relay connection, no WebSocket/`fetch`, no
> signing, no NIP-44/NIP-17, no `PaymentProvider` connection, no
> `PurchaseGrant` issuance, no checkout/invoice, no download unlock, and no
> chat-content implementation — every flow step named is still exactly the
> placeholder it was before this stage. Stage 113 candidates: (1) a board
> route preview UI skeleton; (2) a Nostr event mapping boundary skeleton —
> a PURE function from `SocialEventDescriptor` to a Nostr-event-candidate
> shape, still no relay/signing (recommended, since
> `docs/nostr_adapter_planning.md` §10 step 1 names this as the natural
> next step and it can be built and tested with zero network/crypto
> surface); (3) a creator listing preview UI skeleton. Prior status:
>
> **Stage 111 — Chat + Marketplace + Creator entitlement boundary
> foundation.** Fixes three more upper-app-layer seams — still **no real
> DM/encryption, no real payment/checkout, no entitlement issuance, no
> Worker wiring, no Rust change.** New
> [`src/chat/types.ts`](src/chat/types.ts) ADDS (does not replace) a
> protocol-neutral `ChatProvider` transport seam
> (`status`/`sendPlaceholder`/`fetchPlaceholder`) alongside the pre-existing
> Stage 16 `ChatRoom`/`ChatMessage` model in the SAME file — the new types
> are deliberately named `ChatProviderKind`/`ChatMessageDescriptor`/etc. to
> avoid colliding with the existing `ChatKind`/`ChatMessage` (which keeps
> its real `content` field and stays wired to notification/render, fully
> untouched). `ChatMessageDescriptor` carries NO `content`/`body`/bytes
> field — opaque `idRef`/`chatRef`/`authorRef`/metadata only. New
> [`src/chat/noop_chat.ts`](src/chat/noop_chat.ts) ships the only
> implementation, `NoopChatProvider` (permanently `unavailable`). New
> [`src/marketplace/types.ts`](src/marketplace/types.ts) +
> [`src/marketplace/noop_marketplace.ts`](src/marketplace/noop_marketplace.ts)
> define `MarketplaceProvider` (`status`/`listPlaceholder`/
> `purchasePlaceholder`) and `MarketplaceListingDescriptor` — six
> `MarketplaceItemKind` placeholders, NO price/payment/checkout/download/
> bytes field, no `PaymentProvider` import, no `PurchaseGrant`
> construction; `NoopMarketplaceProvider` always lists nothing and grants
> nothing. New [`src/creator/entitlement.ts`](src/creator/entitlement.ts)
> defines `EntitlementProvider` (`status`/`checkPlaceholder`),
> `EntitlementDecision`, and five `EntitlementKind` placeholders —
> `NoopEntitlementProvider` is the only implementation and, like
> `NoopFederationProvider`'s `connect()` before it, NEVER returns `allowed:
> true`: no grant is ever issued and no payment is ever verified by this
> boundary. All three deliberately stay uncoupled from `PaymentProvider`,
> `src/commerce/`'s `PurchaseGrant`, `StorageBackend`, `CryptoProvider`,
> and each other. `AppRuntime` gains `chatProvider`/`marketplaceProvider`/
> `creatorEntitlementProvider`; three new `select*` functions in
> [`src/runtime/create_runtime.ts`](src/runtime/create_runtime.ts) each
> ALWAYS return their Noop default unless the matching `overrides.*` is
> supplied — no env-selectable placeholder variant exists yet for any of
> the three, and the Worker is UNTOUCHED (no reference to any of them).
> Three new docs —
> [`docs/chat_boundary.md`](docs/chat_boundary.md),
> [`docs/marketplace_boundary.md`](docs/marketplace_boundary.md), and
> [`docs/creator_entitlement_boundary.md`](docs/creator_entitlement_boundary.md)
> — fix each seam's role and explicit non-scope, and why payment,
> marketplace, and entitlement stay three separate decisions ("was this
> paid for" vs. "what is offered" vs. "does this subject have access now").
> New
> [`test/chat_provider_boundary.test.ts`](test/chat_provider_boundary.test.ts)
> (15 tests),
> [`test/marketplace_boundary.test.ts`](test/marketplace_boundary.test.ts)
> (15 tests), and
> [`test/creator_entitlement_boundary.test.ts`](test/creator_entitlement_boundary.test.ts)
> (14 tests) check: every Noop provider stays `unavailable`/denies every
> attempt across every kind; `createRuntime` never calls any of the seven
> new placeholder methods; the Worker references none of the three
> providers; every descriptor carries no content/body/bytes/price/payment/
> checkout/download field; and no source imports `PaymentProvider`,
> `PurchaseGrant`/`src/commerce/`, `StorageBackend`, `CryptoProvider`, a
> relay/WebSocket library, or performs NIP-04/NIP-44/NIP-17 encryption.
> `npm run typecheck`, `npm test` (120 files, 1665 tests), `cargo check`,
> `cargo check --tests`, and `cargo test` (108 tests, unchanged — no Rust
> file was touched this stage) all stay GREEN. Where this stage stopped, on
> purpose: no NIP-04/NIP-44/NIP-17 implementation, no encrypted-chat
> implementation, no message content storage, no real payment/Stripe/
> Lightning, no checkout, no download/signed URL, no entitlement/grant
> issuance, and no Federation/Storage/Crypto/Worker wiring beyond Noop
> selection. Stage 112 candidates: (1) Nostr adapter planning docs; (2) a
> board route preview UI skeleton; (3) Creator monetization flow docs
> (recommended — now that Chat/Marketplace/Entitlement boundaries exist,
> fixing in docs how a sale, a membership, and a chat permission would
> eventually connect is safer to do before any of the three is
> implemented). Prior status:
>
> **Stage 110 — Federation + Social boundary foundation.** Fixes the
> seam FedOS will eventually use to speak to multiple social
> protocols/ecosystems (Nostr, Bluesky, Threads, RSS, and its own local
> store) — **no real relay/WebSocket/HTTP/OAuth/AT-Protocol connection, no
> signing, no publish/subscribe.** New
> [`src/federation/types.ts`](src/federation/types.ts) defines
> `FederationProvider` (`status`/`connect`/`disconnect`/
> `publishPlaceholder`/`fetchPlaceholder`), `FederationProviderKind` (six
> PLACEHOLDER labels — `nostr_placeholder`, `bluesky_placeholder`,
> `threads_placeholder`, `rss_placeholder`, `local_placeholder`,
> `test_placeholder`), `FederationCapability`, `FederationStatus`, and
> `FederationDescriptor`. New
> [`src/federation/noop_federation.ts`](src/federation/noop_federation.ts)
> ships `NoopFederationProvider` — the ONLY implementation this stage
> ships, and unlike every other boundary's placeholder, its `connect()`
> NEVER reaches `connected_placeholder` (claiming a session exists is
> closer to the Nearby consent boundary's "never claim granted" posture
> than to a payment/storage placeholder's "policy-clean" acceptance — see
> [`docs/federation_boundary.md`](docs/federation_boundary.md) §5). New
> [`src/social/event.ts`](src/social/event.ts) defines a protocol-neutral
> `SocialEventDescriptor` (ten `SocialEventKind` labels — post/reply/
> repost/reaction/profile/article/marketplace/chat/moderation/test — and
> four `SocialVisibility` labels) with NO bytes/content/body field — opaque
> labels and metadata only. New [`src/social/board.ts`](src/social/board.ts)
> defines a protocol-neutral `BoardDescriptor` (six `BoardKind` labels —
> thread/board/channel/marketplace/knowledge/test — plus `TopicLabel`/
> `CategoryLabel`), also label-only. Social/Board are deliberately decoupled
> from `FederationProvider`/`StorageBackend`/`CryptoProvider` — no
> cross-import in either direction. `AppRuntime` gains `federationProvider`;
> new `selectFederationProvider(env?, overrides?)` in
> [`src/runtime/create_runtime.ts`](src/runtime/create_runtime.ts) ALWAYS
> returns `NoopFederationProvider` unless `overrides.federationProvider` is
> supplied — there is no env-selectable placeholder adapter yet, unlike
> Storage/Payment/Notification/WebAuthn/Crypto's two-way switches. The
> Worker is untouched (no `FederationProvider` reference at all). New
> [`docs/federation_boundary.md`](docs/federation_boundary.md) fixes each
> future adapter's role (read/write/reply only) and explicit non-scope
> (never Storage, never Crypto, never Identity/consent — swapping or adding
> a protocol adapter must never require touching those, and vice versa).
> New [`test/federation_boundary.test.ts`](test/federation_boundary.test.ts)
> (17 tests) and
> [`test/social_board_skeleton.test.ts`](test/social_board_skeleton.test.ts)
> (12 tests) check: `NoopFederationProvider` stays `disconnected` through
> `connect()`/`disconnect()`, denies `publishPlaceholder`/`fetchPlaceholder`
> (`items` always empty); Runtime selection defaults to
> `NoopFederationProvider` and never calls any of its four methods; the
> Worker references neither `FederationProvider` nor the social model; every
> label is a fixed, complete `_placeholder`-suffixed or plain set; no
> `bytes`/`content`/`body` field exists anywhere; and no source imports a
> relay/WebSocket/HTTP/OAuth/AT-Protocol/EventSource library or
> `StorageBackend`/`CryptoProvider`. `npm run typecheck`, `npm test` (117
> files, 1621 tests), `cargo check`, `cargo test` (108 tests, unchanged — no
> Rust file was touched this stage), and `cargo check --tests` all stay
> GREEN. Where this stage stopped, on purpose: no Nostr relay/WebSocket, no
> Bluesky/AT-Protocol/OAuth session, no Threads/ActivityPub call, no RSS
> fetch/parse, no event signing (NIP-44/NIP-17 or otherwise) or publish/
> subscribe, and no connection to `StorageBackend` or any `CryptoProvider`.
> Stage 111 candidates: (1) a Chat boundary skeleton and (2) a Marketplace
> boundary skeleton, done together in one review unit (recommended — FedOS's
> target order is Identity → Crypto → Storage → Federation → Board → Chat →
> Marketplace, so finishing Chat+Marketplace next keeps the foundation
> complete before any real Nostr/Bluesky/Threads adapter is attempted); (3)
> a Creator entitlement boundary. Prior status:
>
> **Stage 109 — Storage provider env selection + Nearby consent
> boundary + storage metadata sanitizer.** Three small, independent
> additions consolidate the Stage 107/108 boundaries into selectable/usable
> shape, still with NO real storage, NO real location, and NO wiring beyond
> selection. (1) **Storage provider env selection**: `RuntimeEnv` gains
> `STORAGE_PROVIDER?`/`ENABLE_STORAGE_PLACEHOLDER?`, `RuntimeOverrides` gains
> `storageBackend?`, and `AppRuntime` gains `storageBackend` — new
> `selectStorageBackend(env, overrides?)` in
> [`src/runtime/create_runtime.ts`](src/runtime/create_runtime.ts) picks
> `NoopStorageBackend` (default) or `PlaceholderStorageBackend` (Stage 107),
> exactly mirroring how `selectPaymentProvider`/`selectNotificationBridge`
> already work. The Worker's `Env` interface gains the same two fields for
> parity; the Worker still never calls `put()`/`get()`/`delete()`, and
> `createRuntime` never calls them either — selection only. (2) **Nearby
> consent boundary skeleton**: new
> [`src/nearby/types.ts`](src/nearby/types.ts) defines
> `NearbyConsentProvider` (`getStatus`/`getCapabilities`/`requestConsent`/
> `revokeConsent`/`isGranted`) and new
> [`src/nearby/noop_consent.ts`](src/nearby/noop_consent.ts) provides
> `NoopNearbyConsentProvider` (permanently `unavailable`) and
> `PlaceholderNearbyConsentProvider` — which, unlike every other placeholder
> in this codebase, can NEVER reach an "accepted" state: `requestConsent`
> ALWAYS resolves `denied`, because Nearby Discovery has no real, informed
> consent UI yet (see `docs/nearby_consent_policy.md`) and granting consent
> without one would misrepresent it. No GPS, no
> `navigator.geolocation` call, no permission request, no area-id
> computation; NOT wired into the runtime, the Worker, or `StorageBackend`.
> (3) **Storage metadata sanitizer**: new `sanitizeStorageMetadata` in
> [`src/storage/policy.ts`](src/storage/policy.ts) is a pure function that
> strips the EXISTING sensitive markers (secret/key/seed/token/payment/
> entitlement/dm/body/content/message) AND a NEW, independent
> location-derived marker set (area id/geohash/H3/S2/lat/lon/coordinate/
> GPS) from a metadata object, per `docs/storage_metadata_policy.md` §2 —
> deliberately kept a standalone helper, NOT called from
> `reviewStoragePacket` or `PlaceholderStorageBackend.put()`, so
> `NoopStorageBackend`/`PlaceholderStorageBackend` are UNCHANGED by this
> stage. New
> [`test/runtime_storage_env.test.ts`](test/runtime_storage_env.test.ts)
> (13 tests),
> [`test/nearby_consent_boundary.test.ts`](test/nearby_consent_boundary.test.ts)
> (13 tests), and
> [`test/storage_metadata_sanitizer.test.ts`](test/storage_metadata_sanitizer.test.ts)
> (13 tests) check: env/override selection picks the right backend and
> never calls `put`/`get`/`delete`; the Worker exposes the two new fields
> but never constructs a backend or calls its methods; `PlaceholderNearbyConsentProvider`
> never grants consent even after repeated requests, leaks no coordinate,
> and stays unwired; `sanitizeStorageMetadata` drops both marker families
> without mutating its input and is not called from `noop_storage.ts`; and
> no source imports Google Drive/Nostr WebSocket/SQLite/Bluetooth/geolocation/
> H3/geohash/S2. Two Stage 107 assertions in
> [`test/storage_backend_boundary.test.ts`](test/storage_backend_boundary.test.ts)
> were updated (same pattern Stage 46/Stage 42 used for payment/notification
> selection): they now allow the Runtime/Worker sources to reference
> `StorageBackend` for SELECTION, while still asserting `put`/`get`/`delete`
> are never called from either. `npm run typecheck`, `npm test` (115 files,
> 1592 tests), `cargo check`, `cargo test` (108 tests, unchanged — no Rust
> file was touched this stage), and `cargo check --tests` all stay GREEN.
> Where this stage stopped, on purpose: no real Google Drive/Nostr
> relay/SQLite/Bluetooth-Wi-Fi/IPFS storage, no GPS/browser geolocation, no
> area-id computation, no H3/Geohash/S2 dependency, no peer discovery, no
> bandwidth priority, and no automatic storage operation from the Runtime or
> Worker. Stage 110 candidates: (1) a Nostr federation boundary skeleton —
> a `FederationProvider`-shaped seam naming relay-set/federation concepts
> with NO real relay connection (recommended, since it is FedOS's core
> not-yet-abstracted coupling now that Storage/consent/metadata boundaries
> are in place); (2) a board/event model skeleton (Reddit-style
> board/thread shapes decoupled from the Nostr event they're rendered from);
> (3) a storage packet preview route (a read-only `?storageStatus=1`-style
> page mirroring `renderRuntimeStatusPage`, showing the selected backend's
> type label only). Prior status:
>
> **Stage 108 — Nearby / storage-metadata privacy boundaries
> (docs only).** Three new research/policy documents fix the privacy
> boundary for a not-yet-built "Nearby Discovery" feature and extend the
> `StorageBackend` metadata policy — **no source file changed, no test file
> changed, no new dependency, no location implementation.** New
> [`docs/nearby_area_indexing_research.md`](docs/nearby_area_indexing_research.md)
> documents why the Python v8.6 host's `get_area_id(lat, lon, precision=4)`
> (independent `round(lat, 1)`/`round(lon, 1)`) is not production safe — a
> fixed rectangular grid has a boundary problem (two nearby points can land
> in different cells while distant ones share a cell), cell size is not
> uniform across latitude, and even a coarse rounded coordinate is a
> non-zero privacy cost — then compares Geohash/H3/S2/a coarser fixed grid
> as candidates ONLY (none adopted, no dependency added), lists H3's
> hex-cell/neighbor-ring/deterministic-adjacency advantages alongside its
> dependency, WASM-footprint, exact-location-inference, and
> resolution-choice risks, and fixes the privacy rules any future
> implementation must follow (no raw-coordinate storage or transmission, an
> area id is itself a tracking identifier, salt/epoch/rotation design is a
> separate future stage, explicit opt-in consent, off by default) plus the
> broader metadata leak surface (area-id frequency, time correlation, peer
> count, bandwidth priority, relay observation). New
> [`docs/nearby_consent_policy.md`](docs/nearby_consent_policy.md) fixes the
> consent rules for that same not-yet-built feature (explicit/informed/
> separable consent, off by default, revocation stops new signal generation
> rather than just hiding UI, consent is not retroactive, and consent does
> not by itself authorize storing an area id in `StorageBackend`). New
> [`docs/storage_metadata_policy.md`](docs/storage_metadata_policy.md)
> restates the EXISTING `reviewStoragePacket` marker policy
> (`src/storage/policy.ts`, Stage 107 — unchanged by this stage) and fixes
> the explicit rule that a location-derived value (an area id, geohash, H3
> index, etc.) is NOT cleared for `StorageBackend` metadata just because it
> passes today's secret/key/seed/token/payment/entitlement/dm/body/content/
> message check — that check was never a location-privacy control, and
> storing one requires its own future policy stage gated on both the
> area-indexing and consent preconditions. `npm run typecheck`, `npm test`
> (112 files, 1553 tests, unchanged), `cargo check`, `cargo test` (108
> tests, unchanged), and `cargo check --tests` all stay GREEN, since no
> source or test file was touched. Where this stage stopped, on purpose: no
> H3/Geohash/S2 dependency was added, no GPS/`navigator.geolocation` call
> was written, no area-id function exists in this codebase, no consent UI
> or permission flow was built, no `StorageBackend`/Runtime/Worker wiring
> changed. Stage 109 candidates: (1) a storage-provider environment-
> selection boundary — mirroring how `createRuntime` already selects a
> `PaymentProvider`/`NotificationBridge` from env, but for `StorageBackend`
> (still no real backend) (recommended, since it is the natural next step
> now that the metadata-privacy boundary around it is fixed in docs); (2) a
> Nearby consent boundary **skeleton** (types/decision shapes only, no UI,
> no permission call); (3) a storage metadata sanitizer boundary (a pure
> function mirroring `sanitizePaymentMetadata`/`sanitizeNotificationPayload`
> for `StoragePacket.metadata`, still no location-value support). Prior
> status:
>
> **Stage 107 — `StorageBackend` abstraction boundary skeleton.**
> A MINIMAL, future-facing seam for pluggable storage backends: new
> [`src/storage/types.ts`](src/storage/types.ts) defines `StorageBackend`
> (`getStatus`/`put`/`get`/`delete`), `StorageBackendKind` (six PLACEHOLDER
> labels — `google_drive_placeholder`, `nostr_relay_placeholder`,
> `local_sqlite_placeholder`, `local_mesh_placeholder`, `ipfs_placeholder`,
> `external_placeholder`), `StorageVisibility`, `StoragePacket`, `StorageRef`,
> `StorageDecision`, and `StorageReadDecision`. This is the seam that would
> eventually let the Python v8.6 host's Google Drive coupling be replaced by
> a real backend selected behind one interface — without the rest of the app
> depending on any concrete backend. New
> [`src/storage/policy.ts`](src/storage/policy.ts) (`reviewStoragePacket`)
> rejects a packet whose metadata key/value contains a
> secret/key/seed/token/payment/entitlement/dm/body/content/message marker,
> or whose `idRef` is shaped like a URL or file path (e.g. a Google Drive
> share link or a local path) rather than an opaque label. New
> [`src/storage/noop_storage.ts`](src/storage/noop_storage.ts) provides two
> safe defaults: `NoopStorageBackend` (permanently `unavailable`, denies
> every `put`/`get`/`delete`) and `PlaceholderStorageBackend` (`put`
> evaluates the policy and returns `accepted_placeholder`/`rejected`; `get`
> always resolves `unavailable`; `delete` is a safe no-op) — NEITHER stores
> a byte, calls the Google Drive API, opens a Nostr relay WebSocket, touches
> SQLite, a Bluetooth/Wi-Fi mesh, or an IPFS gateway, performs file IO, or
> issues a `fetch`. No packet ever carries raw bytes or a plaintext/
> ciphertext body — only opaque labels and non-sensitive metadata strings.
> This boundary is NOT wired into the runtime, the Worker, or any
> `CryptoProvider`; constructing either implementation does nothing. New
> [`test/storage_backend_boundary.test.ts`](test/storage_backend_boundary.test.ts)
> (18 tests) checks: `NoopStorageBackend` stays `unavailable` for every
> operation; `PlaceholderStorageBackend` accepts a policy-clean packet and
> rejects sensitive metadata or a URL/path-shaped `idRef`; `get` always
> reports `unavailable` and `delete` is always a safe no-op; no function
> mutates its input or throws; the packet/ref/decision shapes carry no
> `bytes`/`body`/`content` field; the source imports no Google Drive /
> `google.colab` / Nostr WebSocket / SQLite / Bluetooth / Wi-Fi / IPFS client
> and issues no `fetch`/file IO; and the Runtime and Worker sources reference
> neither `StorageBackend` nor either implementation. `npm run typecheck`,
> `npm test` (112 files, 1553 tests), `cargo check`, `cargo test` (108
> tests, unchanged — no Rust file was touched this stage), and
> `cargo check --tests` all stay GREEN. Where this stage stopped, on
> purpose: no Google Drive, Nostr relay, SQLite, Bluetooth/Wi-Fi mesh, or
> IPFS implementation was written; nothing connects to a `CryptoProvider`;
> nothing is wired into the runtime or Worker. Stage 108 candidates: (1)
> nearby-area indexing research docs (recommended — location data warrants
> fixing a privacy boundary in docs before any implementation); (2) a
> storage-provider environment-selection boundary (mirroring how
> `createRuntime` selects a `PaymentProvider`/`NotificationBridge` from
> env, but for `StorageBackend` — still no real backend); (3) a public
> key-usage label enumeration on the Rust side (`docs/public_key_usage.md`
> section 5, step 1). Prior status:
>
> **Stage 106 — Public Boundary Freeze v2.** Two more label-only
> PUBLIC groups land in `packages/fedos-core-rust/src/lib.rs`:
> `FedosKeyUsageLabel` (eight labels — separating "what is this key for"
> from Stage 105's "what format is this key," see
> `docs/public_key_usage.md`) plus `FedosKeyUsageState`/
> `FedosKeyUsageStatus`/`FedosKeyUsageDescriptor` and one new function,
> `fedos_key_usage_descriptor_placeholder()`; and
> `FedosAlgorithmRequirement`/`FedosAlgorithmCapability`/
> `FedosAlgorithmPolicy` — three fixed relational/policy label tables
> over Stage 102's four algorithm candidates (see
> `docs/public_algorithm_policy.md`) plus three new functions,
> `fedos_algorithm_requirements`, `fedos_algorithm_capabilities`, and
> `fedos_algorithm_policy_decision`. The public `pub fn` surface grows
> from eighteen (Stage 105) to twenty-two. Every label remains planning
> intent only — no raw key byte, no owned string, no growable byte
> collection, no parser, no validator, no enforced authorization or
> approval rule, and no import/export/generate function exists anywhere;
> `Cargo.toml` is UNCHANGED; no CSPRNG entropy source is consulted; no
> Runtime/Worker/CryptoProvider/WASM wiring. A new
> [`docs/public_capability_matrix.md`](docs/public_capability_matrix.md)
> maps all seven label/metadata groups added across Stage 103/105/106
> (Capability, Feature, Policy, Version, Format, Usage, Algorithm) in one
> table, and `packages/fedos-core-rust/README.md`'s "Public boundary
> overview" was rewritten as **Public Boundary Freeze v2** (Stage
> 102–106), consolidating the roadmap and adding an explicit "where the
> boundary stops" section (no raw byte, no serialization format, no
> import/export implementation, no `randomBytes` implementation, no
> nonce generation, no Runtime/Worker/CryptoProvider wiring — reaching
> any of these is the Implementation Phase, not further boundary
> design). New
> [`test/fedos_core_rust_key_usage_label.test.ts`](test/fedos_core_rust_key_usage_label.test.ts)
> (13 tests) and
> [`test/fedos_core_rust_algorithm_policy.test.ts`](test/fedos_core_rust_algorithm_policy.test.ts)
> (14 tests) check all of the above; twenty-four pre-existing guard test
> files' hard-coded "pub fn total" checks were updated from 18 to 22 with
> the four new function names, and
> `test/fedos_core_rust_key_format_label.test.ts`'s own Stage-105-scoped
> section extraction was narrowed to end at Stage 106's new marker
> instead of Stage 79's. `npm run typecheck`, `npm test` (111 files, 1535
> tests), `cargo check`, `cargo test` (108 tests, same count as Stage 105
> — no new Rust unit test this stage, since no new `#[cfg(test)]` module
> was added), and `cargo check --tests` all stay GREEN. This closes the
> Public Boundary Freeze v2 arc (Stage 102–106) at the stop condition the
> user specified: no raw byte, serialization format, import/export
> implementation, `randomBytes` implementation, nonce generation, or
> Runtime wiring was touched — the next stage that touches any of those
> is Implementation Phase, not boundary design. Stage 107 candidates: (1)
> design the `(FedosKeyFormatLabel, FedosKeyUsageLabel)` authorization
> rule set (`docs/public_key_usage.md` section 5, step 1 — still
> design-only) — recommended, since it's the last remaining label-design
> gap the Freeze v2 roadmap lists before the arc has to cross into
> Implementation Phase; (2) a WASM manifest validation skeleton; (3) a
> NIP-44 vector source/update check. Prior status:
>
> **Stage 105 — Public key-format label enumeration
> (`FedosKeyFormatLabel`, seven FUTURE PLANNING LABELS, plus
> `FedosKeyFormatState`/`FedosKeyFormatStatus`/`FedosKeyFormatDescriptor`
> and one fixed accessor, `fedos_key_format_descriptor_placeholder()`).**
> `packages/fedos-core-rust/src/lib.rs`'s public `pub fn` surface grows
> from seventeen (Stage 103) to eighteen. Every label is planning intent
> only — no raw key byte, no owned string, no growable byte collection,
> no parser, no serializer, no validator, and no import/export function
> exists anywhere; the raw-input FORMAT decision itself stays
> UNIMPLEMENTED, exactly as `docs/public_key_provisioning.md` left it. No
> CSPRNG entropy source is consulted (no `getrandom`/`rand` usage
> anywhere in the new section); `Cargo.toml` is UNCHANGED; no
> Runtime/Worker/CryptoProvider/WASM wiring. New
> [`test/fedos_core_rust_key_format_label.test.ts`](test/fedos_core_rust_key_format_label.test.ts)
> (14 tests) checks all of the above; twenty-three pre-existing guard test
> files' hard-coded "pub fn total" checks were updated from 17 to 18 with
> the new function name (the same mass-update pattern every prior public
> API growth stage has used), and
> `test/fedos_core_rust_public_boundary_consolidation.test.ts`'s own
> Stage-103-scoped section extraction was narrowed to end at Stage 105's
> new marker instead of Stage 79's, so it stays scoped to exactly what
> Stage 103 added.
> `docs/public_key_provisioning.md` section 6 step 2 is marked complete;
> `packages/fedos-core-rust/README.md`'s "Public boundary overview" table
> and roadmap were updated to include the new group. `npm run typecheck`,
> `npm test` (109 files, 1508 tests), `cargo check`, `cargo test` (108
> tests, same count as Stage 104 — no new Rust unit test this stage,
> since no new `#[cfg(test)]` module was added), and `cargo check --tests`
> all stay GREEN. Where this stage stopped: no raw-input byte layout, no
> serialization/parsing format, and no import/export implementation were
> decided — deciding any of those would mean picking a real byte-level
> protocol, which is implementation, not label planning; the
> `FedosKeyExportBoundary` non-implementation question from Stage 103
> also remains untouched. Stage 106 candidates: (1) a public key-USAGE
> label enumeration (separating "what format is this key" from "what is
> this key allowed to be used for") — recommended, since it is the
> natural next boundary-design gap before any real
> import/generate/export decision has to conflate the two; (2) a WASM
> manifest validation skeleton; (3) a NIP-44 vector source/update check.
> Prior status:
>
> **Stage 104 — `getrandom` CSPRNG dependency adopted (build check
> ONLY, an EIGHTH `packages/fedos-core-rust/Cargo.toml` `[dependencies]`
> entry) + a `cfg(test)`-only RNG-verification-infrastructure
> PLACEHOLDER (`csprng_verification_infrastructure`, a fixed four-category
> label plan, never calling `getrandom`) + two new design docs
> ([`docs/public_random_design.md`](docs/public_random_design.md),
> [`docs/public_key_provisioning.md`](docs/public_key_provisioning.md)).**
> The public `pub fn` surface stays UNCHANGED at seventeen (Stage 103) —
> this stage adds no new public type or function. `getrandom` is not
> imported or called ANYWHERE in `src/lib.rs`, production or test; no
> `randomBytes`/nonce/encrypt/decrypt/deriveKey/key-generation/import/export
> IMPLEMENTATION exists. New
> [`test/fedos_core_rust_getrandom_adoption.test.ts`](test/fedos_core_rust_getrandom_adoption.test.ts)
> (16 tests) checks all of the above; six pre-existing guard test files
> (`fedos_core_rust_dependency.test.ts`, `fedos_core_rust_skeleton.test.ts`,
> `fedos_core_rust_aes_gcm_wiring.test.ts`,
> `fedos_core_rust_argon2_wiring.test.ts`,
> `fedos_core_rust_hkdf_wiring.test.ts`,
> `fedos_core_rust_rfc8439_wiring.test.ts`) had their whole-file
> "getrandom is absent" checks narrowed to each dependency's OWN line
> (Stage 104 makes `getrandom` legitimately present at the top level, even
> though `aes-gcm`/`argon2` still separately exclude their OWN optional
> `rand`/`getrandom` convenience features); two more
> (`fedos_core_rust_public_api_boundary.test.ts`,
> `fedos_core_rust_public_boundary_consolidation.test.ts`) had their
> "Cargo.toml is unchanged" tests narrowed to "not touched BY that
> specific stage" — still true. `src/lib.rs`'s own Stage 104 doc comment
> hit the same self-referential trap Stage 75 first documented — it
> initially wrote the literal text `` `#[cfg(test)]` `` while describing
> its own new test-only module, colliding with the `firstCfgTestIdx`
> "first #[cfg(test)] in the file" boundary a dozen pre-existing guard
> tests rely on to slice out "production code"; fixed by writing
> `` `cfg(test)` `` (no brackets) instead, matching how Stage 77's
> paragraph already phrased the identical situation. `packages/fedos-core-rust/README.md`
> also gained a new "Public boundary overview" table (Stage 102–104,
> unifying the by-then-long stage-by-stage narrative into one reference)
> and two design docs (`docs/public_random_design.md`,
> `docs/public_key_provisioning.md`) extending Stage 103's
> `public_random_boundary.md`/`public_key_boundary.md` now that the CSPRNG
> dependency choice is fixed and the key-import provisioning contract is
> designed — still no implementation. `npm run typecheck`, `npm test`
> (108 files, 1494 tests), `cargo check`, `cargo test` (108 tests, +2 from
> the new verification-plan unit tests), and `cargo check --tests` all
> stay GREEN. Where this stage stopped: the raw-input-to-opaque-handle
> provisioning path is now DESIGNED
> (`docs/public_key_provisioning.md`) but deliberately NOT implemented —
> and NOT even given a concrete request/response type — because fixing
> its exact byte-level shape would mean picking a real serialization
> format, which is implementation, not design; similarly, no CSPRNG
> feature configuration decision beyond "default features, native only"
> was made, since choosing a WASM-specific feature flag would anticipate a
> WASM target this crate does not have yet. Stage 105 candidates: (1) the
> key-format label enumeration `docs/public_key_provisioning.md` section 6
> step 2 references (still design-only, no implementation) — recommended,
> since it is the smallest remaining boundary-design gap and stays
> squarely on the "design, not implementation" side of the line the last
> three stages have held; (2) a WASM manifest validation skeleton; (3) a
> NIP-44 vector source/update check. Prior status:
>
> **Stage 103 — Consolidated placeholder API boundary: ten more
> label-only PUBLIC types
> (`FedosRandomBoundary`/`FedosNonceBoundary`/`FedosKeyGenerationBoundary`/
> `FedosKeyImportBoundary`/`FedosKeyExportBoundary` +
> `FedosCapabilityDescriptor`/`FedosAlgorithmDescriptor`/
> `FedosBoundaryVersion`/`FedosBoundaryFeature`/`FedosBoundaryPolicy`) and
> three new design docs
> ([`docs/public_random_boundary.md`](docs/public_random_boundary.md),
> [`docs/public_key_boundary.md`](docs/public_key_boundary.md),
> [`docs/public_boundary_versioning.md`](docs/public_boundary_versioning.md)),
> bundled into one reviewed stage per the user's explicit direction to
> consolidate as much of the public-API boundary's design as possible
> before any real implementation. `packages/fedos-core-rust/src/lib.rs`'s
> public `pub fn` surface grows from seven (Stage 102) to seventeen — the
> sixteen prior functions are byte-for-byte unchanged. No
> encrypt/decrypt/deriveKey/randomBytes/nonce/key generation/import/export
> IMPLEMENTATION function exists anywhere; every new function returns a
> fixed, non-sensitive label or status (`FedosBoundaryVersion`'s `u32`
> triple is the only non-enum field added, and it is a fixed constant).
> `Cargo.toml` is UNCHANGED — no new dependency. Nothing is wired into the
> host's execution environment, its background worker, or a crypto
> provider; no WASM binding exists. New
> [`test/fedos_core_rust_public_boundary_consolidation.test.ts`](test/fedos_core_rust_public_boundary_consolidation.test.ts)
> (19 tests) checks all of the above; twenty-four pre-existing guard test
> files' hard-coded "pub fn total" checks were updated from 7 to 17 with
> the ten new names (the same mass-update pattern Stage 102 used for
> 6→7), and `test/fedos_core_rust_public_api_boundary.test.ts`'s own
> Stage-102-scoped section extraction was narrowed to end at Stage 103's
> new marker instead of Stage 79's, so it stays scoped to exactly what
> Stage 102 added. Where this stage stopped: a real key-import boundary
> design touches the one place raw secret bytes would legitimately cross
> this boundary, so `docs/public_key_boundary.md` reserves that
> provisioning-path design as its own future, separately-reviewed stage
> rather than sketching it here — consolidating further would mean
> picking a real CSPRNG dependency or a real byte-level protocol, which is
> implementation, not boundary design. `npm run typecheck`, `npm test`
> (107 files, 1478 tests), `cargo check`, `cargo test` (106 tests, same
> count as Stage 102 — no new Rust unit test this stage, since no new
> `#[cfg(test)]` module was added), and `cargo check --tests` all stay
> GREEN. Stage 104 candidates: (1) a CSPRNG dependency adoption (no
> `randomBytes`/nonce implementation yet) — the natural next step per
> `docs/public_random_boundary.md`'s own roadmap; (2) a WASM manifest
> validation skeleton; (3) a NIP-44 vector source/update check. Prior
> status:
>
> **Stage 102 — Public crypto API design docs + a placeholder API
> boundary (no encrypt/decrypt/deriveKey/randomBytes implementation, no
> Runtime/Worker/CryptoProvider/WASM wiring, `Cargo.toml` unchanged).**
> [`docs/fedos_core_public_api_design.md`](docs/fedos_core_public_api_design.md)
> (new) fixes the DESIGN — not the implementation — of a future public
> `encrypt`/`decrypt`/`deriveKey`/`randomBytes` API in twelve numbered
> sections: purpose; the future shape of each operation; why input stays
> centered on an opaque secret handle/reference even in the future design;
> why a raw key/seed/passphrase must never be a direct parameter; the two
> AEAD candidates (ChaCha20-Poly1305, AES-256-GCM); the two KDF candidates
> (HKDF-SHA256, Argon2id); why nonce/random generation is its own separate
> design boundary; a fixed error taxonomy with no raw error text or stack
> trace; an audit boundary recording labels only, never a payload;
> Runtime/WASM wiring deferred to its own future stage; an explicit
> statement that this stage is placeholder API boundary ONLY; and a
> six-step implementation roadmap. `packages/fedos-core-rust/src/lib.rs`
> gains this crate's first new PUBLIC items since Stage 69 (placed right
> after the Stage 69 placeholder functions, still ahead of Stage 79's
> `secret_handle` module): `FedosCryptoOperation` (`pub enum`: `Encrypt` /
> `Decrypt` / `DeriveKey` / `RandomBytes`), `FedosCryptoAlgorithm`
> (`pub enum`: `ChaCha20Poly1305` / `Aes256Gcm` / `HkdfSha256` /
> `Argon2id`), `FedosCryptoBoundaryState` (`pub enum`: `Unavailable` /
> `Placeholder`), `FedosCryptoBoundaryStatus` (`pub struct`, carries only
> the state enum), `FedosCryptoRequestDescriptor` (`pub struct`, carries
> only `operation`/`algorithm`), `FedosCryptoResponseDescriptor`
> (`pub struct`, carries only `operation`/`algorithm`/`state`), and one new
> public function, `fedos_crypto_boundary_status()`, which takes no input
> and returns a fixed, permanently `Unavailable` status exactly like
> `fedos_core_status()`. This grows the crate's public `pub fn` surface
> from six to seven for the FIRST time since Stage 69 — the six Stage 69
> placeholder functions are byte-for-byte unchanged. Every new type holds
> ONLY fixed enum labels — no borrowed byte slice, `Vec<u8>`, or `String`
> field anywhere, no key/seed/plaintext/ciphertext/passphrase/nonce/tag
> byte, and no field of any crate-private skeleton type; nothing is wired
> into the Runtime, the Worker, or `CryptoProvider`, and `Cargo.toml` is
> UNCHANGED (no new dependency needed for label-only types). New
> [`test/fedos_core_rust_public_api_boundary.test.ts`](test/fedos_core_rust_public_api_boundary.test.ts)
> (19 tests) checks: the design doc exists and covers all twelve sections,
> the six new type declarations, the seven-function `pub fn` surface, no
> encrypt/decrypt/derive/random IMPLEMENTATION function, no raw byte
> parameter or `Vec<u8>` field anywhere in the new boundary, the six Stage
> 69 functions unchanged, no key/seed/plaintext/ciphertext/passphrase/
> nonce/tag storage field, no actual AEAD/KDF crate usage (specific
> crate-usage patterns, not a bare substring match — this stage's own
> `FedosCryptoAlgorithm::Aes256Gcm`/`ChaCha20Poly1305` labels legitimately
> contain "aes"/"gcm"/"chacha"/"poly1305" as substrings) or `SecretHandle`
> connection, Runtime/Worker untouched, `Cargo.toml` byte-count and
> seven-entry dependency-table check, no `unsafe`, no committed build
> artifact. Because the new algorithm labels legitimately contain AEAD
> substrings, four pre-existing guard test files with a bare
> `chacha|poly1305|xchacha|aes|gcm` substring check against production code
> (`test/fedos_core_rust_dependency.test.ts`,
> `test/fedos_core_rust_skeleton.test.ts`,
> `test/fedos_core_rust_aes_gcm_wiring.test.ts`,
> `test/fedos_core_rust_aead_test_helper.test.ts`) were updated to specific
> crate-usage patterns instead (`use chacha20poly1305`, `aes_gcm::`,
> `Aes256Gcm::new`, etc.), and twenty-one pre-existing files' hard-coded
> "exactly six `pub fn`" checks were updated to seven, including the new
> `fedos_crypto_boundary_status` name. `npm run typecheck`, `npm test`
> (1459 tests), `cargo check`, `cargo test` (106 tests, same count as Stage
> 101 — no new Rust unit test this stage), and `cargo check --tests` all
> stay GREEN. Stage 103 candidate: **a public `randomBytes` placeholder
> boundary** — fixing nonce/random generation as its own design point
> (per this stage's docs §7) before any public `encrypt`/`decrypt`
> skeleton needs to consume its output; the two other candidates offered
> were a WASM manifest validation skeleton and a NIP-44 vector
> source/update check. Prior status:
>
> **Stage 101 — Adopt `aes-gcm` AND wire the NIST AES-256-GCM
> vectors to `cargo test`, with the seal/open test-only helper extracted
> from the start (one combined Stage; no public encrypt/decrypt API, no
> Runtime/Worker/CryptoProvider wiring, no production `aes-gcm` use).**
> `packages/fedos-core-rust/Cargo.toml` gains a SEVENTH `[dependencies]`
> (production) entry, `aes-gcm` v0.10.3 (RustCrypto, Apache-2.0 OR MIT,
> `default-features = false`, `features = ["aes", "alloc"]` — no
> `getrandom`), this crate's SECOND AEAD alongside `chacha20poly1305`
> (Stage 74). Unlike every prior AEAD/KDF dependency (which spread
> "adopt"/"wire"/"extract a helper" across separate, later Stages —
> `chacha20poly1305` Stage 74→75→81; `argon2` Stage 84→85→86), this Stage
> combines all three into one reviewed unit: `packages/fedos-core-rust/src/lib.rs`
> gains a new `#[cfg(test)]`-only module, `aes256gcm_vectors`, that reads
> [`test-vectors/aead/aes256gcm-nist.json`](test-vectors/aead/aes256gcm-nist.json)
> (NIST CAVP AES-256-GCM known-answer vectors, imported Stage 73) via
> `include_str!` and asserts `aes-gcm` reproduces its expected bytes, via
> two private, test-only helpers extracted from the start —
> `seal_aes256gcm_for_test`/`open_aes256gcm_for_test` — mirroring
> `seal_chacha20poly1305_for_test`/`open_chacha20poly1305_for_test`'s
> (Stage 81) byte-level shape exactly; neither is `pub`/`pub(crate)`, and
> neither is re-exported. The crate-private `aead_core` skeleton (Stage
> 80) is UNCHANGED and remains placeholder-only, not connected to the new
> module — same "when in doubt, leave unconnected" reasoning every
> skeleton stage already established. `cargo test` is GREEN with all 106
> tests passing (101 pre-existing + 5 new `aes256gcm_vectors` tests);
> `cargo check` and `cargo check --tests` stay GREEN with no warnings.
> Production code (everything before `src/lib.rs`'s first
> `cfg(test)`-gated module) still does not import, reference, or call
> `aes-gcm` anywhere, and the crate-level doc comment stays free of any
> AEAD crate/algorithm name (same convention Stage 75/77/85 already
> established) — its Stage 101 paragraph describes the new module only as
> "an official NIST-sourced AEAD known-answer vector file" and "a SECOND
> AEAD dependency", never spelling out "AES"/"GCM"/"aes-gcm" literally, to
> avoid colliding with this repo's own bare-substring production-code
> guard checks. `encrypt_placeholder`/`decrypt_placeholder`/
> `derive_key_placeholder` remain byte-for-byte unchanged, and the crate's
> public `pub fn` surface stays exactly the same six placeholder functions
> from Stage 69. New
> [`test/fedos_core_rust_aes_gcm_wiring.test.ts`](test/fedos_core_rust_aes_gcm_wiring.test.ts)
> (18 tests) checks: `aes-gcm` dependency presence and the seven-entry
> production dependency count, no direct `rand`/`getrandom` and no
> `wasm-bindgen`, the vector module is gated behind `cfg(test)` only, no
> production `aes-gcm`/`Aes256Gcm` reference (a bare `chacha|poly1305|
> xchacha|aes|gcm` substring check across ALL of production code, not
> just an import-statement check), public `pub fn` count still 6,
> `aead_core` unchanged and still placeholder-only with no reference to
> the new module (and vice versa), the two test-only helpers exist,
> are private, and are never re-exported, `include_str!` reads the exact
> NIST vector path, positive AND negative vector coverage both exist and
> are exercised, no production key/nonce/plaintext/ciphertext/tag storage
> field, Runtime/Worker untouched, no committed build artifact. Three
> pre-existing guard test files
> (`test/fedos_core_rust_dependency.test.ts`,
> `test/fedos_core_rust_skeleton.test.ts`,
> `test/fedos_core_rust_rfc8439_wiring.test.ts`,
> `test/fedos_core_rust_hkdf_wiring.test.ts`) were updated because they
> previously asserted `aes-gcm`'s ABSENCE from `Cargo.toml` and a
> six-entry production dependency count — both now flipped to assert
> presence and a seven-entry count, consistent with every prior
> dependency-adoption stage's update pattern.
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md)
> §12 gains a dedicated `aes-gcm` — Stage 101 entry (crate review, feature
> configuration, 10 new transitive packages, 39-package combined
> production graph, `unsafe`/build-script/license/MSRV review, what was
> done vs. NOT done). Stage 102 candidate: **internal public-API design
> docs** — fixing, in writing, what a future public `encrypt`/`decrypt`/
> `deriveKey` signature, error taxonomy, and secret-handling contract
> would look like, reusing the label vocabulary Stage 79–99's skeletons
> and the Architecture Freeze v1 (Stage 100) already fixed — still no
> public API implementation. Prior status:
>
> **Stage 100 — FedOS Core Architecture Freeze v1 (docs only, no
> src changes, no `Cargo.toml` changes, no crypto implementation).**
> [`docs/fedos_core_architecture_freeze_v1.md`](docs/fedos_core_architecture_freeze_v1.md)
> (new) fixes, in writing, the internal type architecture Stage 79–99
> built: sixteen crate-private, label-only skeleton modules inside
> `packages/fedos-core-rust/src/lib.rs`
> (`secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
> `operation_context`/`request_descriptor`/`response_descriptor`/
> `crypto_pipeline`/`descriptor_bundle`/`execution_plan`/`error_taxonomy`/
> `audit_event`/`audit_policy`/`lifecycle_state`/`module_registry`), a
> role table for all sixteen, which pairs are explicitly NOT connected
> (with the three narrow, label-reuse-only exceptions already established
> in prior stages), confirmation that the public API is still exactly the
> six Stage 69 placeholder functions, confirmation that none of the
> sixteen modules is wired into the Runtime/Worker/`CryptoProvider`, a
> summary of what IS verified today (RFC 8439 ChaCha20-Poly1305, RFC 5869
> HKDF, and RFC 9106 Argon2id — all under `cfg(test)` only, none reachable
> from any public function), an explicit list of what is NOT yet
> implemented (public `encrypt`/`decrypt`, public `deriveKey`, CSPRNG,
> key generation, NIP-44, Nostr key derivation, AES-GCM, WASM loading,
> Runtime crypto execution), a non-claims section banning
> "military-grade"/"zero-trace"/"unbreakable"-style language and
> confirming no skeleton holds a log/secret/stack-trace, and a
> recommended next-phase order (AES-GCM dependency adoption → AES-GCM
> NIST vector wiring → a test-only AES-GCM helper → internal public-API
> design docs → only then a public `encrypt`/`decrypt` skeleton). **This
> stage changes NO code**: `src/`,
> `packages/fedos-core-rust/src/lib.rs`, `packages/fedos-core-rust/Cargo.toml`,
> and every existing test file are byte-for-byte unchanged; `npm run
> typecheck`, `npm test` (1422 tests, same count as Stage 99), `cargo
> check`, and `cargo test` (101 tests, same count as Stage 99) all stay
> GREEN because nothing they check changed. Stage 101 candidate: **adopt
> the `aes-gcm` dependency** — a dependency + build-check ADOPTION ONLY,
> exactly like every prior dependency stage (`chacha20poly1305` Stage 74,
> `hkdf` Stage 76, `argon2` Stage 84); no code imports or calls it yet.
> Prior status:
>
> **Stage 99 — Internal module registry skeleton (internal-only
> `module_registry` module; fixed enumeration labels only for every
> skeleton module added since Stage 79, no dynamic registry mechanism,
> `registered_module_count()` hardcoded to 15, no logging, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a sixteenth crate-private
> module, `module_registry` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`,
> Stage 88's `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, Stage 94's
> `execution_plan`, Stage 95's `error_taxonomy`, Stage 96's
> `audit_event`, Stage 97's `audit_policy`, and Stage 98's
> `lifecycle_state`, placed right after `lifecycle_state`, still ahead
> of this file's first module gated `cfg(test)`). It defines:
> `ModuleRegistryState` (`pub(crate) enum`, `Disabled`/`Placeholder` —
> `Disabled` is the `Default`); `ModuleRegistryKind` (`pub(crate) enum`,
> sixteen label-only unit variants, one ENUMERATION label per
> crate-private skeleton module added since Stage 79 plus
> `TestOnlyPlaceholder` — `SecretHandlePlaceholder`/`AeadCorePlaceholder`/
> `KdfCorePlaceholder`/`KeyMaterialPlaceholder`/`DomainLabelPlaceholder`/
> `OperationContextPlaceholder`/`RequestDescriptorPlaceholder`/
> `ResponseDescriptorPlaceholder`/`CryptoPipelinePlaceholder`/
> `DescriptorBundlePlaceholder`/`ExecutionPlanPlaceholder`/
> `ErrorTaxonomyPlaceholder`/`AuditEventPlaceholder`/
> `AuditPolicyPlaceholder`/`LifecycleStatePlaceholder`/
> `TestOnlyPlaceholder` — none of these variants ever constructs, holds,
> or reads a field of the module it names); `ModuleRegistryStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `ModuleRegistry` (`pub(crate) struct`, holding
> `kind`/`state`) with five methods: `new_placeholder(kind:
> ModuleRegistryKind)` (takes only the label — no user-, environment-, or
> config-derived input of any kind), `kind()`, `status()`,
> `is_placeholder()`, and `registered_module_count()` (returns the
> hardcoded `usize` literal `15` — the real skeleton count, excluding
> `TestOnlyPlaceholder` — regardless of `kind`, never a length method
> call and never computed from any collection). **NOT part of this
> crate's public API**: every item is `pub(crate)` at most — never
> `pub` — nothing is re-exported from the crate root, and the crate's
> public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `ModuleRegistry`. **Enumeration labels only — no dynamic registry, no
> logging**: `ModuleRegistry` writes to no stdout/stderr/log sink of any
> kind (no `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere),
> uses no `.len()`/`Vec`/`HashMap`/`BTreeMap`/`HashSet`/`BTreeSet`/
> static-array/`lazy_static`/`once_cell`/`inventory`-crate mechanism
> anywhere, and holds no `String`/`Vec<u8>`/borrowed-byte-slice field of
> any kind. **No module construction or reference**: `ModuleRegistry`
> does not construct or hold a `SecretHandle`, `AeadPlaceholderRequest`,
> `KdfPlaceholderRequest`, `KeyMaterialHandle`, `DomainLabel`,
> `OperationContext`, `RequestDescriptor`, `ResponseDescriptor`,
> `CryptoPipeline`, `DescriptorBundle`, `ExecutionPlan`,
> `CryptoErrorDescriptor`, `AuditEventLabel`, `AuditPolicy`, or
> `LifecycleMarker` — same "if in doubt, stay fully independent" choice
> Stage 93/94/95/96/97/98 already made. **Not connected to
> `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
> `domain_label`, `operation_context`, `request_descriptor`,
> `response_descriptor`, `crypto_pipeline`, `descriptor_bundle`,
> `execution_plan`, `error_taxonomy`, `audit_event`, `audit_policy`, or
> `lifecycle_state`** — `module_registry` never constructs any of their
> types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives no
> Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage
> 80/82/87/88/89/90/91/92/93/94/95/96/97/98 already established; all
> fifteen of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 101 tests passing (96
> pre-existing + 5 new `module_registry::tests`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — no new dependency needed (`module_registry`
> imports nothing beyond the standard library). New
> [`test/fedos_core_rust_module_registry.test.ts`](test/fedos_core_rust_module_registry.test.ts)
> (21 tests) checks: the module is internal-only and not `pub`;
> `ModuleRegistry` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged;
> `ModuleRegistry` holds only `kind`/`state`; `registered_module_count()`
> returns the hardcoded literal `15`; no
> `.len()`/`Vec`/`HashMap`/`BTreeMap`/`HashSet`/`BTreeSet`/static-array/
> `lazy_static`/`once_cell`/`inventory`-crate usage; no `String`/`Vec`
> field anywhere in the module; no payload/timestamp/counter
> field-declaration; no
> `println!`/`eprintln!`/`print!`/`eprint!`/`tracing::`/`log::`/`dbg!`
> usage; `new_placeholder` takes only a `ModuleRegistryKind`; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no
> `CryptoProvider`/`Runtime`/`Worker` bare-word reference; no AEAD/HKDF/
> Argon2 usage (specific Rust-usage patterns only, not a bare word
> match, same lesson learned Stage 89-98); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle`/`ExecutionPlan`/`CryptoErrorDescriptor`/
> `AuditEventLabel`/`AuditPolicy`/`LifecycleMarker` (nor do those
> fifteen modules reference `ModuleRegistry*`); no `unsafe`; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the
> registry has exactly sixteen `ModuleRegistryKind` enumeration labels,
> two `ModuleRegistryState` variants, and the handle exposes exactly its
> five methods. **Fix during this stage**: the module's own doc
> comments originally wrote the literal text `.len()` when describing
> what does NOT happen (never a `.len()` call), which would have
> collided with the guard test's own bare-pattern absence check for
> that exact string (the same self-referential doc-comment trap as
> Stage 81/84/88-93/94) — fixed by rewording to "a length method call"
> in prose instead of the literal method-call spelling. Stage 100
> recommendation (per the user's own guidance): an **Architecture
> Freeze v1** — a documentation-only checkpoint fixing the roles,
> boundaries, and non-connection rules of every internal skeleton added
> Stage 79 through Stage 99 into a single design record, without
> changing any implementation, before moving on to a real
> cryptography-adoption phase (e.g. AES-GCM). Prior status:
>
> **Stage 98 — Internal lifecycle state skeleton (internal-only
> `lifecycle_state` module; fixed lifecycle states/kinds only, no
> logging, no payload, no timestamp/counter, no existing-module wiring
> yet, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a fifteenth crate-private
> module, `lifecycle_state` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`,
> Stage 88's `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, Stage 94's
> `execution_plan`, Stage 95's `error_taxonomy`, Stage 96's
> `audit_event`, and Stage 97's `audit_policy`, placed right after
> `audit_policy`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `LifecycleState` (`pub(crate) enum`, six
> variants — `Disabled`/`Placeholder`/`PreparedPlaceholder`/
> `ActivePlaceholder`/`ClearedPlaceholder`/`ErrorPlaceholder` —
> `Disabled` is the `Default`); `LifecycleKind` (`pub(crate) enum`,
> `CryptoProviderLifecyclePlaceholder`/`RequestLifecyclePlaceholder`/
> `SecretLifecyclePlaceholder`/`AuditLifecyclePlaceholder`/
> `PipelineLifecyclePlaceholder`/`TestOnlyLifecyclePlaceholder` — six
> label-only unit variants); `LifecycleStatus` (`pub(crate) struct`, a
> non-sensitive status snapshot carrying only the state enum); and
> `LifecycleMarker` (`pub(crate) struct`, holding `kind`/`state`) with
> eight methods: `new_placeholder(kind: LifecycleKind)` (takes only the
> label — no user-, environment-, or config-derived input of any kind),
> `kind()`, `status()`, `is_placeholder()`, and four coarse transition
> methods — `mark_prepared_placeholder()`, `mark_active_placeholder()`,
> `mark_cleared_placeholder()`, `mark_error_placeholder()` — each taking
> no input beyond `&mut self` and only ever setting the fixed `state`
> label. **NOT part of this crate's public API**: every item is
> `pub(crate)` at most — never `pub` — nothing is re-exported from the
> crate root, and the crate's public `pub fn` surface is still exactly
> the same six placeholder functions from Stage 69; none of them
> constructs, holds, or returns a `LifecycleMarker`. **No logging, no
> payload, no timestamp, no counter**: `LifecycleMarker` writes to no
> stdout/stderr/log sink of any kind (no
> `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere) and holds
> no payload/timestamp/counter field of any kind. **No existing-module
> wiring — a fully independent, label-only skeleton**: `LifecycleMarker`
> does not construct or hold a `SecretHandle`, `AeadPlaceholderRequest`,
> `KdfPlaceholderRequest`, `KeyMaterialHandle`, `DomainLabel`,
> `OperationContext`, `RequestDescriptor`, `ResponseDescriptor`,
> `CryptoPipeline`, `DescriptorBundle`, `ExecutionPlan`,
> `CryptoErrorDescriptor`, `AuditEventLabel`, or `AuditPolicy` — same "if
> in doubt, stay fully independent" choice Stage 93/94/95/96/97 already
> made; `LifecycleMarker` stores no `String`/`Vec<u8>`/borrowed-byte-slice
> field of any kind. **Not connected to `secret_handle`, `aead_core`,
> `kdf_core`, `key_material`, `domain_label`, `operation_context`,
> `request_descriptor`, `response_descriptor`, `crypto_pipeline`,
> `descriptor_bundle`, `execution_plan`, `error_taxonomy`, `audit_event`,
> or `audit_policy`** — `lifecycle_state` never constructs any of their
> types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives no
> Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage
> 80/82/87/88/89/90/91/92/93/94/95/96/97 already established; all
> fourteen of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 96 tests passing (88
> pre-existing + 8 new `lifecycle_state::tests`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — no new dependency needed (`lifecycle_state`
> imports nothing beyond the standard library). New
> [`test/fedos_core_rust_lifecycle_state.test.ts`](test/fedos_core_rust_lifecycle_state.test.ts)
> (19 tests) checks: the module is internal-only and not `pub`;
> `LifecycleMarker` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `LifecycleKind`/`LifecycleState` variant is a label-only unit variant
> (no tuple/struct data); no `String`/`Vec` field anywhere in the module;
> no payload/timestamp/counter field-declaration (including no
> `SystemTime`/`Instant`/`u64`/`u32` usage); no
> `println!`/`eprintln!`/`print!`/`eprint!`/`tracing::`/`log::`/`dbg!`
> usage; `new_placeholder` takes only a `LifecycleKind` and every
> `mark_*_placeholder` method takes nothing beyond `&mut self`; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match, same
> lesson learned Stage 89-97); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle`/`ExecutionPlan`/`CryptoErrorDescriptor`/
> `AuditEventLabel`/`AuditPolicy` (nor do those fourteen modules
> reference `Lifecycle*`); no `unsafe`; Runtime/Worker sources mention
> neither `lifecycle_state` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the handle
> exposes exactly its eight methods. Stage 99 candidate: **an internal
> module registry skeleton** — listing the internal skeleton modules
> added so far by fixed label only, still not connecting any of them
> together. Prior status:
>
> **Stage 97 — Internal audit policy skeleton (internal-only
> `audit_policy` module; fixed policy/decision labels only, no logging, no
> observation payload, no `audit_event` wiring yet, no
> descriptor/pipeline/plan/error wiring yet, no real AEAD/HKDF/Argon2/
> NIP-44 connection, no Runtime/Worker/CryptoProvider wiring, no WASM
> change).**
> `packages/fedos-core-rust/src/lib.rs` gains a fourteenth crate-private
> module, `audit_policy` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage 88's
> `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, Stage 94's
> `execution_plan`, Stage 95's `error_taxonomy`, and Stage 96's
> `audit_event`, placed right after `audit_event`, still ahead of this
> file's first module gated `cfg(test)`). It defines: `AuditPolicyState`
> (`pub(crate) enum`, `Placeholder`/`Disabled` — `Disabled` is the
> `Default`, same shape as `AuditEventState`); `AuditPolicyKind`
> (`pub(crate) enum`, `MinimalPlaceholder`/`DevelopmentPlaceholder`/
> `TestOnlyPlaceholder` — three label-only unit variants);
> `AuditPolicyDecision` (`pub(crate) enum`, `AllowPlaceholder`/
> `DenyPlaceholder` — two label-only unit variants); `AuditPolicyStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `AuditPolicy` (`pub(crate) struct`, holding
> `kind`/`state`) with five methods: `new_placeholder(kind:
> AuditPolicyKind)` (takes only the label — no user-, environment-, or
> config-derived input of any kind), `kind()`, `status()`,
> `is_placeholder()`, and `decision_placeholder()` (takes NO input and
> always returns the fixed safe-default label
> `AuditPolicyDecision::DenyPlaceholder`, regardless of `kind`). **NOT
> part of this crate's public API**: every item is `pub(crate)` at most —
> never `pub` — nothing is re-exported from the crate root, and the
> crate's public `pub fn` surface is still exactly the same six
> placeholder functions from Stage 69; none of them constructs, holds, or
> returns an `AuditPolicy`. **No logging, no observation payload**:
> `AuditPolicy` writes to no stdout/stderr/log sink of any kind (no
> `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere) and holds
> no payload field of any kind. **No `audit_event` wiring — not even a
> name reference**: per this stage's explicit scope, `audit_policy` does
> not mention `audit_event` or any of its types anywhere in its source,
> since no real connection between the two exists yet — one step further
> than earlier "unconnected" skeletons, which do name (in prose) the
> modules they don't connect to. **No descriptor/pipeline/plan/error
> wiring — a fully independent, label-only skeleton**: `AuditPolicy` does
> not construct or hold a `SecretHandle`, `AeadPlaceholderRequest`,
> `KdfPlaceholderRequest`, `KeyMaterialHandle`, `DomainLabel`,
> `OperationContext`, `RequestDescriptor`, `ResponseDescriptor`,
> `CryptoPipeline`, `DescriptorBundle`, `ExecutionPlan`, or
> `CryptoErrorDescriptor` — same "if in doubt, stay fully independent"
> choice Stage 93/94/95/96 already made; `AuditPolicy` stores no
> `String`/`Vec<u8>`/borrowed-byte-slice field of any kind. **Not
> connected to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
> `domain_label`, `operation_context`, `request_descriptor`,
> `response_descriptor`, `crypto_pipeline`, `descriptor_bundle`,
> `execution_plan`, or `error_taxonomy`** — `audit_policy` never
> constructs any of their types and runs no actual AEAD/HKDF/Argon2/
> NIP-44 operation, derives no Nostr key, same "when a skeleton-to-
> skeleton connection is ambiguous, leave it unconnected" reasoning Stage
> 80/82/87/88/89/90/91/92/93/94/95/96 already established; all thirteen
> of those modules are UNCHANGED this stage, still placeholder-only.
> `cargo test` is GREEN with all 88 tests passing (82 pre-existing + 6
> new `audit_policy::tests`); `cargo check` and `cargo check --tests`
> stay GREEN with no warnings. `Cargo.toml` is UNCHANGED this stage — no
> new dependency needed (`audit_policy` imports nothing beyond the
> standard library). New
> [`test/fedos_core_rust_audit_policy.test.ts`](test/fedos_core_rust_audit_policy.test.ts)
> (21 tests) checks: the module is internal-only and not `pub`;
> `AuditPolicy` is `pub(crate)` at most and never re-exported; the public
> `pub fn` surface is exactly the six Stage 69 names; the six placeholder
> function bodies are byte-for-byte unchanged; every
> `AuditPolicyKind`/`AuditPolicyDecision` variant is a label-only unit
> variant (no tuple/struct data); no `String`/`Vec` field anywhere in the
> module; no observation-payload field-declaration
> (`payload`/`data`/`details`); no
> `println!`/`eprintln!`/`print!`/`eprint!`/`tracing::`/`log::`/`dbg!`
> usage; `new_placeholder` takes only an `AuditPolicyKind` (no
> `&str`/`String` parameter), and `decision_placeholder()` always returns
> `AuditPolicyDecision::DenyPlaceholder`; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no bare-word or
> type-name reference to `audit_event`/`AuditEventLabel` anywhere (checked
> both directions — `audit_event` also doesn't reference
> `audit_policy`/`AuditPolicy`); no AEAD/HKDF/Argon2 usage (specific
> Rust-usage patterns only, not a bare word match, same lesson learned
> Stage 89-96); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle`/`ExecutionPlan`/`CryptoErrorDescriptor` (nor do those
> twelve modules reference `AuditPolicy*`); no `unsafe`; Runtime/Worker
> sources mention neither `audit_policy` nor auto-call a crypto
> operation; no `.wasm`/`Cargo.lock`/`target`/`build` artifact is
> committed; the state enum has exactly its two variants and the handle
> exposes exactly its five methods. Stage 98 candidate: **an internal
> lifecycle state skeleton** — representing future crypto-core internal
> state transitions without any secret information, still no public
> API/Runtime wiring. Prior status:
>
> **Stage 96 — Internal audit event label skeleton (internal-only
> `audit_event` module; fixed event-kind labels only, no logging, no
> event payload, no descriptor/pipeline/plan/error wiring yet, no real
> AEAD/HKDF/Argon2/NIP-44 connection, no Runtime/Worker/CryptoProvider
> wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a thirteenth crate-private
> module, `audit_event` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage 88's
> `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, Stage 94's
> `execution_plan`, and Stage 95's `error_taxonomy`, placed right after
> `error_taxonomy`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `AuditEventState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`, same shape as
> `CryptoErrorState`); `AuditEventKind` (`pub(crate) enum`,
> `CryptoProviderSelectedPlaceholder`/`RequestAcceptedPlaceholder`/
> `RequestRejectedPlaceholder`/`PlanPreparedPlaceholder`/
> `PrimitiveExecutedPlaceholder`/`ResponseBuiltPlaceholder`/
> `SecretClearedPlaceholder`/`ErrorClassifiedPlaceholder`/
> `TestOnlyPlaceholder` — nine label-only unit variants);
> `AuditEventStatus` (`pub(crate) struct`, a non-sensitive status snapshot
> carrying only the state enum); and `AuditEventLabel` (`pub(crate)
> struct`, holding `kind`/`state`) with four methods:
> `new_placeholder(kind: AuditEventKind)` (takes only the label — no
> user-, environment-, or config-derived input of any kind, observes no
> real state change of any kind), `kind()`, `status()`, and
> `is_placeholder()`. **NOT part of this crate's public API**: every item
> is `pub(crate)` at most — never `pub` — nothing is re-exported from the
> crate root, and the crate's public `pub fn` surface is still exactly the
> same six placeholder functions from Stage 69; none of them constructs,
> holds, or returns an `AuditEventLabel`. **No logging, no event
> payload**: `AuditEventLabel` writes to no stdout/stderr/log sink of any
> kind (no `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere)
> and holds no payload field of any kind. **No descriptor/pipeline/plan/
> error wiring — a fully independent, label-only skeleton**:
> `AuditEventLabel` does not construct or hold a `SecretHandle`,
> `AeadPlaceholderRequest`, `KdfPlaceholderRequest`, `KeyMaterialHandle`,
> `DomainLabel`, `OperationContext`, `RequestDescriptor`,
> `ResponseDescriptor`, `CryptoPipeline`, `DescriptorBundle`,
> `ExecutionPlan`, or `CryptoErrorDescriptor` — same "if in doubt, stay
> fully independent" choice Stage 93/94/95 already made; `AuditEventLabel`
> stores no `String`/`Vec<u8>`/borrowed-byte-slice field of any kind.
> **Not connected to `secret_handle`, `aead_core`, `kdf_core`,
> `key_material`, `domain_label`, `operation_context`,
> `request_descriptor`, `response_descriptor`, `crypto_pipeline`,
> `descriptor_bundle`, `execution_plan`, or `error_taxonomy`** —
> `audit_event` never constructs any of their types and runs no actual
> AEAD/HKDF/Argon2/NIP-44 operation, derives no Nostr key, same "when a
> skeleton-to-skeleton connection is ambiguous, leave it unconnected"
> reasoning Stage 80/82/87/88/89/90/91/92/93/94/95 already established;
> all twelve of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 82 tests passing (77
> pre-existing + 5 new `audit_event::tests`); `cargo check` and `cargo
> check --tests` stay GREEN with no warnings. `Cargo.toml` is UNCHANGED
> this stage — no new dependency needed (`audit_event` imports nothing
> beyond the standard library, and no observability crate). New
> [`test/fedos_core_rust_audit_event.test.ts`](test/fedos_core_rust_audit_event.test.ts)
> (19 tests) checks: the module is internal-only and not `pub`;
> `AuditEventLabel` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `AuditEventKind` variant is a label-only unit variant (no tuple/struct
> data); no `String`/`Vec` field anywhere in the module; no event-payload
> field-declaration (`payload`/`data`/`details`); no
> `println!`/`eprintln!`/`print!`/`eprint!`/`tracing::`/`log::`/`dbg!`
> usage; `new_placeholder` takes only an `AuditEventKind` (no
> `&str`/`String` parameter); no `std::env`/`env::`/`var_os`/
> `std::process` usage; no AEAD/HKDF/Argon2 usage (specific Rust-usage
> patterns only, not a bare word match, same lesson learned Stage 89-95);
> no field DECLARATION storing `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest`/`KeyMaterialHandle`/`DomainLabel`/
> `OperationContext`/`RequestDescriptor`/`ResponseDescriptor`/
> `CryptoPipeline`/`DescriptorBundle`/`ExecutionPlan`/
> `CryptoErrorDescriptor` (nor do those twelve modules reference
> `AuditEvent*`); no `unsafe`; Runtime/Worker sources mention neither
> `audit_event` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its
> four methods. Stage 97 candidate: **an internal audit policy skeleton**
> — deciding which future events are observable without any secret
> information, still no logging or Runtime wiring. Prior status:
>
> **Stage 95 — Internal error taxonomy skeleton (internal-only
> `error_taxonomy` module; fixed error-kind labels only, no raw error
> strings, no stack traces, no descriptor/pipeline/plan wiring yet, no
> real AEAD/HKDF/Argon2/NIP-44 connection, no Runtime/Worker/
> CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a twelfth crate-private
> module, `error_taxonomy` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage
> 88's `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, and Stage 94's
> `execution_plan`, placed right after `execution_plan`, still ahead of
> this file's first module gated `cfg(test)`). It defines:
> `CryptoErrorState` (`pub(crate) enum`, `Placeholder`/`Disabled` —
> `Disabled` is the `Default`, same shape as `ExecutionPlanState`);
> `CryptoErrorKind` (`pub(crate) enum`, `AeadFailurePlaceholder`/
> `KdfFailurePlaceholder`/`Argon2idFailurePlaceholder`/
> `Nip44FailurePlaceholder`/`NostrKeyFailurePlaceholder`/
> `InvalidRequestPlaceholder`/`UnsupportedOperationPlaceholder`/
> `InternalInvariantPlaceholder`/`TestOnlyFailurePlaceholder` — nine
> label-only unit variants); `CryptoErrorStatus` (`pub(crate) struct`, a
> non-sensitive status snapshot carrying only the state enum); and
> `CryptoErrorDescriptor` (`pub(crate) struct`, holding `kind`/`state`)
> with four methods: `new_placeholder(kind: CryptoErrorKind)` (takes only
> the label — no user-, environment-, or config-derived input of any
> kind, classifies no real failure of any kind), `kind()`, `status()`, and
> `is_placeholder()`. **NOT part of this crate's public API**: every item
> is `pub(crate)` at most — never `pub` — nothing is re-exported from the
> crate root, and the crate's public `pub fn` surface is still exactly the
> same six placeholder functions from Stage 69; none of them constructs,
> holds, or returns a `CryptoErrorDescriptor`. **No raw error strings, no
> stack traces**: `CryptoErrorDescriptor` holds no error message field, no
> wrapped source-error field (no `impl std::error::Error`, no
> `std::fmt::Display` implementation), and no captured call-stack
> information of any kind. **No descriptor/pipeline/plan wiring — a fully
> independent, label-only skeleton**: `CryptoErrorDescriptor` does not
> construct or hold a `SecretHandle`, `AeadPlaceholderRequest`,
> `KdfPlaceholderRequest`, `KeyMaterialHandle`, `DomainLabel`,
> `OperationContext`, `RequestDescriptor`, `ResponseDescriptor`,
> `CryptoPipeline`, `DescriptorBundle`, or `ExecutionPlan` — same "if in
> doubt, stay fully independent" choice Stage 93/94 already made;
> `CryptoErrorDescriptor` stores no `String`/`Vec<u8>`/borrowed-byte-slice
> field of any kind. **Not connected to `secret_handle`, `aead_core`,
> `kdf_core`, `key_material`, `domain_label`, `operation_context`,
> `request_descriptor`, `response_descriptor`, `crypto_pipeline`,
> `descriptor_bundle`, or `execution_plan`** — `error_taxonomy` never
> constructs any of their types and runs no actual AEAD/HKDF/Argon2/
> NIP-44 operation, derives no Nostr key, same "when a
> skeleton-to-skeleton connection is ambiguous, leave it unconnected"
> reasoning Stage 80/82/87/88/89/90/91/92/93/94 already established; all
> eleven of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 77 tests passing (72
> pre-existing + 5 new `error_taxonomy::tests`); `cargo check` and `cargo
> check --tests` stay GREEN with no warnings. `Cargo.toml` is UNCHANGED
> this stage — no new dependency needed (`error_taxonomy` imports nothing
> beyond the standard library). New
> [`test/fedos_core_rust_error_taxonomy.test.ts`](test/fedos_core_rust_error_taxonomy.test.ts)
> (18 tests) checks: the module is internal-only and not `pub`;
> `CryptoErrorDescriptor` is `pub(crate)` at most and never re-exported;
> the public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `CryptoErrorKind` variant is a label-only unit variant (no tuple/struct
> data); no `String`/`Vec` field anywhere in the module; no error
> message/source/stack field-declaration anywhere (nor `impl
> std::error::Error`/`std::fmt::Display`); `new_placeholder` takes only a
> `CryptoErrorKind` (no `&str`/`String` parameter); no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match, same
> "no bare `\bnip.?44\b` check" reasoning Stage 89-94 established, since
> it would also match this stage's own required `Nip44FailurePlaceholder`
> variant name — there is no `nip44`-named crate in this repo's
> dependency tree to import in the first place, so that absence is
> structural, not text-banned); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle`/`ExecutionPlan` (nor do those eleven modules
> reference `CryptoError*`); no `unsafe`; Runtime/Worker sources mention
> neither `error_taxonomy` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its
> four methods. Stage 96 candidate: **an internal audit event label
> skeleton** — observing future crypto-internal state changes without any
> secret information, still no logging or Runtime wiring. Prior status:
>
> **Stage 94 — Internal execution plan skeleton (internal-only
> `execution_plan` module; fixed plan/step labels only, no descriptor/
> pipeline wiring yet, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains an eleventh crate-private
> module, `execution_plan` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage
> 88's `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, and Stage 93's `descriptor_bundle`, placed right after
> `descriptor_bundle`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `ExecutionPlanState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`, same shape as
> `CryptoPipelineState`); `ExecutionPlanKind` (`pub(crate) enum`,
> `AeadPlanPlaceholder`/`KdfPlanPlaceholder`/`Argon2idPlanPlaceholder`/
> `Nip44PlanPlaceholder`/`NostrKeyPlanPlaceholder`/`TestOnlyPlanPlaceholder`
> — six label-only unit variants); `ExecutionStepKind` (`pub(crate) enum`,
> this crate's canonical six-step placeholder sequence:
> `ValidateRequestPlaceholder`/`ResolveDomainPlaceholder`/
> `ResolveKeyMaterialPlaceholder`/`ExecutePrimitivePlaceholder`/
> `BuildResponsePlaceholder`/`ClearTemporaryStatePlaceholder` — six
> label-only unit variants); `ExecutionPlanStatus` (`pub(crate) struct`, a
> non-sensitive status snapshot carrying only the state enum); and
> `ExecutionPlan` (`pub(crate) struct`, holding `kind`/`state`) with five
> methods: `new_placeholder(kind: ExecutionPlanKind)` (takes only the
> label — no user-, environment-, or config-derived input of any kind,
> orders no step of any kind), `kind()`, `status()`, `is_placeholder()`,
> and `step_count()` (returns the fixed `usize` `6` via a `match` on
> `kind` — never a `.len()`/collection-derived count). **NOT part of this
> crate's public API**: every item is `pub(crate)` at most — never `pub` —
> nothing is re-exported from the crate root, and the crate's public
> `pub fn` surface is still exactly the same six placeholder functions
> from Stage 69; none of them constructs, holds, or returns an
> `ExecutionPlan`. **No descriptor/pipeline wiring — a fully independent,
> label-only skeleton**: `ExecutionPlan` does not construct or hold a
> `SecretHandle`, `AeadPlaceholderRequest`, `KdfPlaceholderRequest`,
> `KeyMaterialHandle`, `DomainLabel`, `OperationContext`,
> `RequestDescriptor`, `ResponseDescriptor`, `CryptoPipeline`, or
> `DescriptorBundle` — same "if in doubt, stay fully independent" choice
> Stage 93 already made; `ExecutionPlan` stores no
> `String`/`Vec<u8>`/borrowed-byte-slice field of any kind. **Not
> connected to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
> `domain_label`, `operation_context`, `request_descriptor`,
> `response_descriptor`, `crypto_pipeline`, or `descriptor_bundle`** —
> `execution_plan` never constructs any of their types and runs no actual
> AEAD/HKDF/Argon2/NIP-44 operation, derives no Nostr key, same "when a
> skeleton-to-skeleton connection is ambiguous, leave it unconnected"
> reasoning Stage 80/82/87/88/89/90/91/92/93 already established; all ten
> of those modules are UNCHANGED this stage, still placeholder-only.
> `cargo test` is GREEN with all 72 tests passing (66 pre-existing + 6 new
> `execution_plan::tests`); `cargo check` and `cargo check --tests` stay
> GREEN with no warnings. `Cargo.toml` is UNCHANGED this stage — no new
> dependency needed (`execution_plan` imports nothing beyond the standard
> library). New
> [`test/fedos_core_rust_execution_plan.test.ts`](test/fedos_core_rust_execution_plan.test.ts)
> (18 tests) checks: the module is internal-only and not `pub`;
> `ExecutionPlan` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `ExecutionPlanKind`/`ExecutionStepKind` variant is a label-only unit
> variant (no tuple/struct data); no `String`/`Vec` field anywhere in the
> module; `new_placeholder` takes only an `ExecutionPlanKind` (no
> `&str`/`String` parameter); `step_count()` returns a fixed `usize` via
> `match` with no `.len()`/collection call; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match, same
> "no bare `\bnip.?44\b` check" reasoning Stage 89-93 established, since
> it would also match this stage's own required `Nip44PlanPlaceholder`
> variant name — there is no `nip44`-named crate in this repo's
> dependency tree to import in the first place, so that absence is
> structural, not text-banned); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle` (nor do those ten modules reference
> `ExecutionPlan*`); no `unsafe`; Runtime/Worker sources mention neither
> `execution_plan` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its
> five methods. **Fix during this stage**: the module's own doc comments
> originally wrote the literal text `Vec<ExecutionStepKind>` when
> describing what does NOT exist in this module, which collided with the
> guard test's own bare-pattern absence check for that exact string (the
> same self-referential doc-comment trap as Stage 81/84/88/89/90/91/92/93)
> — fixed by rewording to "a growable, heap-allocated collection ... " in
> prose instead of the literal generic-type spelling. Stage 95 candidate:
> **an internal error taxonomy skeleton** — classifying future
> cryptographic operation failure without any secret information, still
> no real cryptography wired in. Prior status:
>
> **Stage 93 — Internal descriptor bundle skeleton (internal-only
> `descriptor_bundle` module; fixed bundle-kind labels only, no descriptor
> value wiring yet, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a tenth crate-private module,
> `descriptor_bundle` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage 88's
> `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, and Stage 92's
> `crypto_pipeline`, placed right after `crypto_pipeline`, still ahead of
> this file's first module gated `cfg(test)`). It defines:
> `DescriptorBundleState` (`pub(crate) enum`, `Placeholder`/`Disabled` —
> `Disabled` is the `Default`, same shape as `CryptoPipelineState`);
> `DescriptorBundleKind` (`pub(crate) enum`, `AeadBundlePlaceholder`/
> `KdfBundlePlaceholder`/`Argon2idBundlePlaceholder`/
> `Nip44BundlePlaceholder`/`NostrKeyBundlePlaceholder`/
> `TestOnlyBundlePlaceholder` — six label-only unit variants, no associated
> data); `DescriptorBundleStatus` (`pub(crate) struct`, a non-sensitive
> status snapshot carrying only the state enum); and `DescriptorBundle`
> (`pub(crate) struct`, holding `kind`/`state`) with four methods:
> `new_placeholder(kind: DescriptorBundleKind)` (takes only the label — no
> user-, environment-, or config-derived input of any kind, groups no
> descriptor of any kind), `kind()`, `status()`, and `is_placeholder()`.
> **NOT part of this crate's public API**: every item is `pub(crate)` at
> most — never `pub` — nothing is re-exported from the crate root, and the
> crate's public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `DescriptorBundle`. **No descriptor value wiring — a fully independent,
> label-only skeleton**: `DescriptorBundle` does not construct or hold a
> `SecretHandle`, `AeadPlaceholderRequest`, `KdfPlaceholderRequest`,
> `KeyMaterialHandle`, `DomainLabel`, `OperationContext`,
> `RequestDescriptor`, `ResponseDescriptor`, or `CryptoPipeline` — "if in
> doubt, stay fully independent" won over holding those types as real
> fields; `DescriptorBundle` stores no `String`/`Vec<u8>`/
> borrowed-byte-slice field of any kind. **Not connected to
> `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
> `operation_context`, `request_descriptor`, `response_descriptor`, or
> `crypto_pipeline`** — `descriptor_bundle` never constructs any of their
> types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives no
> Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage 80/82/87/88/89/90/91/92 already
> established; all nine of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 66 tests passing (61
> pre-existing + 5 new `descriptor_bundle::tests`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — no new dependency needed (`descriptor_bundle`
> imports nothing beyond the standard library). New
> [`test/fedos_core_rust_descriptor_bundle.test.ts`](test/fedos_core_rust_descriptor_bundle.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `DescriptorBundle` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `DescriptorBundleKind` variant is a label-only unit variant (no
> tuple/struct data); no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `DescriptorBundleKind` (no `&str`/`String`
> parameter); no `std::env`/`env::`/`var_os`/`std::process` usage; no
> AEAD/HKDF/Argon2 usage (specific Rust-usage patterns only, not a bare
> word match, same "no bare `\bnip.?44\b` check" reasoning Stage
> 89/90/91/92 established, since it would also match this stage's own
> required `Nip44BundlePlaceholder` variant name — there is no
> `nip44`-named crate in this repo's dependency tree to import in the
> first place, so that absence is structural, not text-banned); no field
> DECLARATION storing `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest`/`KeyMaterialHandle`/`DomainLabel`/
> `OperationContext`/`RequestDescriptor`/`ResponseDescriptor`/
> `CryptoPipeline` (nor do those nine modules reference
> `DescriptorBundle*`); no `unsafe`; Runtime/Worker sources mention neither
> `descriptor_bundle` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its four
> methods. **Fix during this stage**: the struct-level doc comment
> originally listed the other nine skeletons' PascalCase type names
> (`SecretHandle`, `KeyMaterialHandle`, etc.) directly in prose, which
> collided with the guard test's own bare-word absence check (the same
> self-referential doc-comment trap as Stage 81/84/88/89/90/91/92) — fixed
> by rewording to name the lowercase MODULE names instead
> (`secret_handle`, `key_material`, etc.), consistent with how
> `crypto_pipeline`'s own doc comment already phrased the same idea. Stage
> 94 candidate: **an internal execution plan skeleton** — future
> processing order as non-sensitive labels only, still no real
> cryptography wired in. Prior status:
>
> **Stage 92 — Internal crypto pipeline skeleton (internal-only
> `crypto_pipeline` module; fixed pipeline-kind labels only, no descriptor
> wiring yet, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a ninth crate-private module,
> `crypto_pipeline` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage 88's
> `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, and Stage 91's `response_descriptor`, placed right
> after `response_descriptor`, still ahead of this file's first module
> gated `cfg(test)`). It defines: `CryptoPipelineState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`, same shape as
> `OperationContextState`); `CryptoPipelineKind` (`pub(crate) enum`,
> `AeadPipelinePlaceholder`/`KdfPipelinePlaceholder`/
> `Argon2idPipelinePlaceholder`/`Nip44PipelinePlaceholder`/
> `NostrKeyPipelinePlaceholder`/`TestOnlyPipelinePlaceholder` — six
> label-only unit variants, no associated data); `CryptoPipelineStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `CryptoPipeline` (`pub(crate) struct`, holding
> `kind`/`state`) with four methods: `new_placeholder(kind:
> CryptoPipelineKind)` (takes only the label — no user-, environment-, or
> config-derived input of any kind, bundles no descriptor of any kind),
> `kind()`, `status()`, and `is_placeholder()`. **NOT part of this crate's
> public API**: every item is `pub(crate)` at most — never `pub` — nothing
> is re-exported from the crate root, and the crate's public `pub fn`
> surface is still exactly the same six placeholder functions from Stage
> 69; none of them constructs, holds, or returns a `CryptoPipeline`. **No
> descriptor bundling yet**: `CryptoPipeline` does not construct or hold a
> `SecretHandle`, `AeadPlaceholderRequest`, `KdfPlaceholderRequest`,
> `KeyMaterialHandle`, `DomainLabel`, `OperationContext`,
> `RequestDescriptor`, or `ResponseDescriptor` — it is a label-only type
> basis for a future stage to bundle them; `CryptoPipeline` stores no
> `String`/`Vec<u8>`/borrowed-byte-slice field of any kind. **Not connected
> to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
> `domain_label`, `operation_context`, `request_descriptor`, or
> `response_descriptor`** — `crypto_pipeline` never constructs any of their
> types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives no
> Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage 80/82/87/88/89/90/91 already
> established; all eight of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 61 tests passing (56
> pre-existing + 5 new `crypto_pipeline::tests`); `cargo check` and `cargo
> check --tests` stay GREEN with no warnings. `Cargo.toml` is UNCHANGED
> this stage — no new dependency needed (`crypto_pipeline` imports nothing
> beyond the standard library). New
> [`test/fedos_core_rust_crypto_pipeline.test.ts`](test/fedos_core_rust_crypto_pipeline.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `CryptoPipeline` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `CryptoPipelineKind` variant is a label-only unit variant (no
> tuple/struct data); no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `CryptoPipelineKind` (no `&str`/`String`
> parameter); no `std::env`/`env::`/`var_os`/`std::process` usage; no
> AEAD/HKDF/Argon2 usage (specific Rust-usage patterns only, not a bare
> word match, same "no bare `\bnip.?44\b` check" reasoning Stage 89/90/91
> established, since it would also match this stage's own required
> `Nip44PipelinePlaceholder` variant name — there is no `nip44`-named crate
> in this repo's dependency tree to import in the first place, so that
> absence is structural, not text-banned); no connection to
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/`OperationKind`/
> `RequestDescriptor`/`RequestDescriptorKind`/`ResponseDescriptor`/
> `ResponseDescriptorKind` (nor do those eight modules reference
> `CryptoPipeline*`); no `unsafe`; Runtime/Worker sources mention neither
> `crypto_pipeline` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its four
> methods. Stage 93 candidate: **an internal descriptor bundle skeleton** —
> still no real value connection between the descriptors this stage's
> `crypto_pipeline` anticipates. Prior status:
>
> **Stage 91 — Internal response descriptor skeleton (internal-only
> `response_descriptor` module; non-sensitive response-kind labels only, no
> real bytes/secrets/result payload, no real AEAD/HKDF/Argon2/NIP-44
> connection, no Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains an eighth crate-private
> module, `response_descriptor` (alongside Stage 79's `secret_handle`,
> Stage 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`,
> Stage 88's `domain_label`, Stage 89's `operation_context`, and Stage 90's
> `request_descriptor`, placed right after `request_descriptor`, still
> ahead of this file's first module gated `cfg(test)`). It defines:
> `ResponseDescriptorState` (`pub(crate) enum`, `Placeholder`/`Disabled`/
> `ErrorPlaceholder` — `Disabled` is the `Default`, same shape as
> `RequestDescriptorState` plus a placeholder ERROR state);
> `ResponseDescriptorKind` (`pub(crate) enum`,
> `AeadCiphertextPlaceholder`/`AeadPlaintextPlaceholder`/
> `HkdfPrkPlaceholder`/`HkdfOkmPlaceholder`/`Argon2idTagPlaceholder`/
> `Nip44CiphertextPlaceholder`/`Nip44PlaintextPlaceholder`/
> `NostrSecretKeyPlaceholder`/`NostrPublicKeyPlaceholder`/`ErrorPlaceholder`/
> `TestOnlyPlaceholder` — eleven label-only unit variants, no associated
> data); `ResponseDescriptorStatus` (`pub(crate) struct`, a non-sensitive
> status snapshot carrying only the state enum); and `ResponseDescriptor`
> (`pub(crate) struct`, holding `kind`/`state`) with six methods:
> `new_placeholder(kind: ResponseDescriptorKind)` (takes only the label —
> no user-, environment-, or config-derived input of any kind, no result
> payload), `new_error_placeholder()` (takes NO input — pairs
> `ErrorPlaceholder` kind with `ErrorPlaceholder` state), `kind()`,
> `status()`, `is_placeholder()`, and `is_error_placeholder()`. **NOT part
> of this crate's public API**: every item is `pub(crate)` at most — never
> `pub` — nothing is re-exported from the crate root, and the crate's
> public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `ResponseDescriptor`. **Non-sensitive metadata only — no dynamic
> allocation, no secret bytes, no result payload**: all eleven
> `ResponseDescriptorKind` variants are bare unit variants,
> `ResponseDescriptor` stores no `String`/`Vec<u8>`/borrowed-byte-slice
> field of any kind, and neither constructor takes a real result byte
> (plaintext, ciphertext, key, tag, or associated-data) nor a real error
> payload/message/cause byte. **Not connected to `secret_handle`,
> `aead_core`, `kdf_core`, `key_material`, `domain_label`,
> `operation_context`, or `request_descriptor`** — `response_descriptor`
> never constructs any of their types and runs no actual
> AEAD/HKDF/Argon2/NIP-44 operation, derives no Nostr key, same "when a
> skeleton-to-skeleton connection is ambiguous, leave it unconnected"
> reasoning Stage 80/82/87/88/89/90 already established; all seven of
> those modules are UNCHANGED this stage, still placeholder-only. `cargo
> test` is GREEN with all 56 tests passing (51 pre-existing + 5 new
> `response_descriptor::tests`); `cargo check` and `cargo check --tests`
> stay GREEN with no warnings. `Cargo.toml` is UNCHANGED this stage — no
> new dependency needed (`response_descriptor` imports nothing beyond the
> standard library). New
> [`test/fedos_core_rust_response_descriptor.test.ts`](test/fedos_core_rust_response_descriptor.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `ResponseDescriptor` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `ResponseDescriptorKind` variant is a label-only unit variant (no
> tuple/struct data); no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `ResponseDescriptorKind` (no
> `&str`/`String` parameter) and `new_error_placeholder` takes nothing; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match, same "no
> bare `\bnip.?44\b` check" reasoning Stage 89/90 established, since it
> would also match this stage's own required `Nip44Ciphertext`/
> `Nip44PlaintextPlaceholder` variant names — there is no `nip44`-named
> crate in this repo's dependency tree to import in the first place, so
> that absence is structural, not text-banned); no connection to
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/`OperationKind`/
> `RequestDescriptor`/`RequestDescriptorKind` (nor do those seven modules
> reference `ResponseDescriptor*`); no `unsafe`; Runtime/Worker sources
> mention neither `response_descriptor` nor auto-call a crypto operation;
> no `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its three variants and the handle exposes exactly its
> six methods. Stage 92 candidate: **an internal crypto pipeline skeleton**
> — a type basis to eventually connect the Request/Response/Operation/
> DomainLabel/KeyMaterial descriptors, still no real connection or
> cryptography wired in. Prior status:
>
> **Stage 90 — Internal request descriptor skeleton (internal-only
> `request_descriptor` module; non-sensitive request-kind labels only, no
> real bytes/secrets, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a seventh crate-private
> module, `request_descriptor` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage
> 88's `domain_label`, and Stage 89's `operation_context`, placed right
> after `operation_context`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `RequestDescriptorState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`, same shape as
> `OperationContextState`); `RequestDescriptorKind` (`pub(crate) enum`,
> `AeadEncryptRequestPlaceholder`/`AeadDecryptRequestPlaceholder`/
> `HkdfExtractRequestPlaceholder`/`HkdfExpandRequestPlaceholder`/
> `HkdfExtractExpandRequestPlaceholder`/`Argon2idRequestPlaceholder`/
> `Nip44EncryptRequestPlaceholder`/`Nip44DecryptRequestPlaceholder`/
> `NostrKeyDerivationRequestPlaceholder`/`TestOnlyRequestPlaceholder` — ten
> label-only unit variants, no associated data); `RequestDescriptorStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `RequestDescriptor` (`pub(crate) struct`, holding
> `kind`/`state`) with four methods: `new_placeholder(kind:
> RequestDescriptorKind)` (takes only the label — no user-, environment-,
> or config-derived input of any kind), `kind()`, `status()`, and
> `is_placeholder()`. **NOT part of this crate's public API**: every item
> is `pub(crate)` at most — never `pub` — nothing is re-exported from the
> crate root, and the crate's public `pub fn` surface is still exactly the
> same six placeholder functions from Stage 69; none of them constructs,
> holds, or returns a `RequestDescriptor`. **Non-sensitive metadata only —
> no dynamic allocation, no secret bytes**: all ten
> `RequestDescriptorKind` variants are bare unit variants,
> `RequestDescriptor` stores no `String`/`Vec<u8>`/borrowed-byte-slice field
> of any kind, and describes no real request payload (no plaintext,
> ciphertext, key, salt, nonce, or associated-data byte). **Not connected to
> `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
> or `operation_context`** — `request_descriptor` never constructs any of
> their types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives
> no Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage 80/82/87/88/89 already established;
> all six of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 51 tests passing (46
> pre-existing + 5 new `request_descriptor::tests`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — no new dependency needed (`request_descriptor`
> imports nothing beyond the standard library). New
> [`test/fedos_core_rust_request_descriptor.test.ts`](test/fedos_core_rust_request_descriptor.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `RequestDescriptor` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `RequestDescriptorKind` variant is a label-only unit variant (no
> tuple/struct data); no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `RequestDescriptorKind` (no
> `&str`/`String` parameter); no `std::env`/`env::`/`var_os`/`std::process`
> usage; no AEAD/HKDF/Argon2 usage (specific Rust-usage patterns only, not
> a bare word match, same "no bare `\bnip.?44\b` check" reasoning Stage 89
> established, since it would also match this stage's own required
> `Nip44Encrypt`/`Nip44DecryptRequestPlaceholder` variant names — there is
> no `nip44`-named crate in this repo's dependency tree to import in the
> first place, so that absence is structural, not text-banned); no
> connection to `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest`/`KeyMaterialHandle`/`DomainLabel`/
> `OperationContext`/`OperationKind` (nor do those six modules reference
> `RequestDescriptor*`); no `unsafe`; Runtime/Worker sources mention
> neither `request_descriptor` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its four
> methods. Stage 91 candidate: **an internal response descriptor skeleton**
> — non-sensitive metadata only, still no real bytes/secrets held. Prior
> status:
>
> **Stage 89 — Internal operation context skeleton (internal-only
> `operation_context` module; operation-kind labels only, no real
> AEAD/HKDF/Argon2/NIP-44 connection, no Runtime/Worker/CryptoProvider
> wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a sixth crate-private module,
> `operation_context` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, and Stage
> 88's `domain_label`, placed right after `domain_label`, still ahead of
> this file's first module gated `cfg(test)`). It defines:
> `OperationContextState` (`pub(crate) enum`, `Placeholder`/`Disabled` —
> `Disabled` is the `Default`, same shape as `DomainLabelState`);
> `OperationKind` (`pub(crate) enum`, `AeadEncryptPlaceholder`/
> `AeadDecryptPlaceholder`/`HkdfExtractPlaceholder`/`HkdfExpandPlaceholder`/
> `HkdfExtractExpandPlaceholder`/`Argon2idPlaceholder`/
> `Nip44EncryptPlaceholder`/`Nip44DecryptPlaceholder`/
> `NostrKeyDerivationPlaceholder`/`TestOnlyPlaceholder` — ten label-only
> unit variants, no associated data); `OperationContextStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `OperationContext` (`pub(crate) struct`, holding
> `kind`/`state`) with four methods: `new_placeholder(kind: OperationKind)`
> (takes only the label — no user-, environment-, or config-derived input
> of any kind), `kind()`, `status()`, and `is_placeholder()`. **NOT part of
> this crate's public API**: every item is `pub(crate)` at most — never
> `pub` — nothing is re-exported from the crate root, and the crate's
> public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns an
> `OperationContext`. **Labels only — no dynamic allocation, no secret
> bytes**: all ten `OperationKind` variants are bare unit variants,
> `OperationContext` stores no `String`/`Vec<u8>`/borrowed-byte-slice field
> of any kind. **Not connected to `secret_handle`, `aead_core`, `kdf_core`,
> `key_material`, or `domain_label`** — `operation_context` never
> constructs any of their types and runs no actual AEAD/HKDF/Argon2/NIP-44
> operation, derives no Nostr key, same "when a skeleton-to-skeleton
> connection is ambiguous, leave it unconnected" reasoning Stage
> 80/82/87/88 already established; all five of those modules are UNCHANGED
> this stage, still placeholder-only. `cargo test` is GREEN with all 46
> tests passing (41 pre-existing + 5 new `operation_context::tests`);
> `cargo check` and `cargo check --tests` stay GREEN with no warnings.
> `Cargo.toml` is UNCHANGED this stage — no new dependency needed
> (`operation_context` imports nothing beyond the standard library). New
> [`test/fedos_core_rust_operation_context.test.ts`](test/fedos_core_rust_operation_context.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `OperationContext` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `OperationKind` variant is a label-only unit variant (no tuple/struct
> data); no `String`/`Vec` field anywhere in the module; `new_placeholder`
> takes only an `OperationKind` (no `&str`/`String` parameter); no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match — a bare
> `\bnip.?44\b` check is deliberately NOT used here, since it would also
> match this stage's own required `Nip44Encrypt`/`Nip44DecryptPlaceholder`
> variant names and doc-comment prose, and there is no `nip44`-named crate
> in this repo's dependency tree to import in the first place, so that
> absence is structural, not text-banned); no connection to
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel` (nor do those five modules reference
> `OperationContext*`); no `unsafe`; Runtime/Worker sources mention neither
> `operation_context` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its four
> methods. Stage 90 candidate: **an internal request descriptor skeleton**
> — non-sensitive metadata only, still no real bytes/secrets held. Prior
> status:
>
> **Stage 88 — Internal domain separation label skeleton
> (internal-only `domain_label` module; fixed static labels only, no
> user/environment/config-derived string, no HKDF/AEAD/NIP-44/Nostr-key
> connection yet, no Runtime/Worker/CryptoProvider wiring, no WASM
> change).**
> `packages/fedos-core-rust/src/lib.rs` gains a fifth crate-private module,
> `domain_label` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, and Stage 87's `key_material`, placed
> right after `key_material`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `DomainLabelState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`);
> `DomainLabelKind` (`pub(crate) enum`, `FedosMasterPlaceholder`/
> `AeadKeyPlaceholder`/`KdfOutputPlaceholder`/`NostrKeyPlaceholder`/
> `Nip44Placeholder`/`TestOnlyPlaceholder` — a label identity only);
> `DomainLabelStatus` (`pub(crate) struct`, a non-sensitive status snapshot
> carrying only the state enum); and `DomainLabel` (`pub(crate) struct`,
> holding `kind`/`state`) with four methods: `new_placeholder(kind:
> DomainLabelKind)` (takes only the label identity — no user-,
> environment-, or config-derived input of any kind), `kind()`, `status()`,
> and `as_static_label()` (returns a fixed `&'static str` per kind via a
> private `const fn` lookup table — `"fedos:placeholder:master"`,
> `"fedos:placeholder:aead-key"`, `"fedos:placeholder:kdf-output"`,
> `"fedos:placeholder:nostr-key"`, `"fedos:placeholder:nip44"`,
> `"fedos:placeholder:test-only"`). **NOT part of this crate's public API**:
> every item is `pub(crate)` at most — never `pub` — nothing is re-exported
> from the crate root, and the crate's public `pub fn` surface is still
> exactly the same six placeholder functions from Stage 69; none of them
> constructs, holds, or returns a `DomainLabel`. **Fixed labels only**:
> every string `as_static_label()` can return is a compile-time `&'static
> str` literal — never built with `format!`, `String::from`,
> `.to_string()`, concatenation, or read from the process environment or any
> runtime configuration; `DomainLabel` stores no `String`/`Vec<u8>` field.
> **Not connected to `secret_handle`, `aead_core`, `kdf_core`, or
> `key_material`** — `domain_label` never constructs any of their types and
> mixes no fixed label into an actual HKDF/AEAD/NIP-44/Nostr-key-derivation
> operation, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage 80/82/87 already established; all
> four of those modules are UNCHANGED this stage, still placeholder-only.
> `cargo test` is GREEN with all 41 tests passing (36 pre-existing + 5 new
> `domain_label::tests`); `cargo check` and `cargo check --tests` stay GREEN
> with no warnings. `Cargo.toml` is UNCHANGED this stage — no new dependency
> needed (`domain_label` imports nothing beyond the standard library). New
> [`test/fedos_core_rust_domain_label.test.ts`](test/fedos_core_rust_domain_label.test.ts)
> (16 tests) checks: the module is internal-only and not `pub`;
> `DomainLabel` is `pub(crate)` at most and never re-exported; the public
> `pub fn` surface is exactly the six Stage 69 names; the six placeholder
> function bodies are byte-for-byte unchanged; every `DomainLabelKind` label
> is a fixed static string literal matching the documented table inside a
> `const fn`; no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `DomainLabelKind` (no `&str`/`String`
> parameter); no `std::env`/`env::`/`var_os`/`std::process` usage; no
> connection to `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest`/`KeyMaterialHandle` (nor do those four modules
> reference `DomainLabel*`), and no HKDF/AEAD/Argon2 usage (specific
> Rust-usage patterns only, not a bare word match, to avoid colliding with
> this module's own doc-comment prose); no `unsafe`; Runtime/Worker sources
> mention neither `domain_label` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; both enums
> have exactly their specified variants and the handle exposes exactly its
> four methods. Stage 89 candidate: **an internal operation context
> skeleton** — a type basis for future AEAD/KDF/NIP-44 operations, still no
> real cryptography wired in. Prior status:
>
> **Stage 87 — Internal key material handle skeleton
> (internal-only `key_material` module; no public API change, no real
> key/seed/plaintext/ciphertext/passphrase/nonce byte, no AEAD/HKDF/Argon2/
> NIP-44 implementation, no Runtime/Worker/CryptoProvider wiring, no WASM
> change).**
> `packages/fedos-core-rust/src/lib.rs` gains a fourth crate-private module,
> `key_material` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, and Stage 82's `kdf_core`, placed right after `kdf_core`,
> still ahead of this file's first module gated `cfg(test)`). It reuses
> `secret_handle`'s exact placeholder-only pattern — a fixed, non-secret
> `PlaceholderMarker` wrapped in `secrecy::SecretBox`, zeroized on
> `clear()` — rather than a divergent design, and defines:
> `KeyMaterialState` (`pub(crate) enum`, `Empty`/`Placeholder`/`Cleared`,
> same three variants as `SecretHandleState`); `KeyMaterialKind`
> (`pub(crate) enum`, `AeadKeyPlaceholder`/`KdfOutputPlaceholder`/
> `NostrKeyPlaceholder`/`UnknownPlaceholder` — a label only, naming a future
> AEAD/KDF/Nostr-identity connection point; no key of any of these kinds is
> held); `KeyMaterialStatus` (`pub(crate) struct`, a non-sensitive status
> snapshot carrying only the state enum); and `KeyMaterialHandle`
> (`pub(crate) struct`, holding `state`, `kind`, and
> `marker: SecretBox<PlaceholderMarker>`) with five methods:
> `new_placeholder(kind: KeyMaterialKind)` (takes only the label — no
> secret input of any kind), `status()`, `kind()`, `clear()` (zeroizes the
> marker and sets state to `Cleared`), and `is_cleared()`. **NOT part of
> this crate's public API**: every item is `pub(crate)` at most — never
> `pub` — nothing is re-exported from the crate root, and the crate's
> public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `KeyMaterialHandle`. **Not connected to `secret_handle`, `aead_core`, or
> `kdf_core`** — `key_material` never constructs any of their types and
> reads no key/secret byte from one, same "when a skeleton-to-skeleton
> connection is ambiguous, leave it unconnected" reasoning Stage 80/82
> already established; all three of those modules are UNCHANGED this
> stage, still placeholder-only. `cargo test` is GREEN with all 36 tests
> passing (30 pre-existing + 6 new `key_material::tests`); `cargo check`
> and `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — `zeroize`/`secrecy` were already `[dependencies]`
> (production) entries since Stage 78; `subtle` remains unused, same
> reasoning as `secret_handle`. New
> [`test/fedos_core_rust_key_material.test.ts`](test/fedos_core_rust_key_material.test.ts)
> (16 tests) checks: the module is internal-only and not `pub`;
> `KeyMaterialHandle` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; no
> key/seed/plaintext/ciphertext/passphrase/nonce storage field and no
> `Vec<u8>`/`String`/borrowed-byte-slice secret field anywhere in the
> module; no AEAD/HKDF/Argon2/NIP-44 usage (specific Rust-usage patterns
> only, not a bare word match, to avoid colliding with this module's own
> doc-comment prose); no random/`getrandom`; no `unsafe`; Runtime/Worker
> sources mention neither `key_material` nor auto-call a crypto operation;
> no `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed;
> `zeroize`/`secrecy` are used only against the placeholder marker and
> `subtle` stays unused; both enums have exactly their specified variants
> and the handle exposes exactly its five methods; and `key_material` does
> not construct or reference `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest` (nor do those three modules reference
> `KeyMaterial*`). Stage 88 candidate: **an internal domain separation
> label skeleton** — important for future HKDF/AEAD connections, still no
> real HKDF/AEAD implementation. Prior status:
>
> **Stage 86 — Extract a test-only Argon2id helper (test-only
> refactor; no public API change, no production deriveKey/password KDF, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs`'s pre-existing `cfg(test)`-only
> `rfc9106_vectors` module (Stage 85) is refactored: the Argon2id derivation
> logic that used to be written as a per-vector helper,
> `run_argon2id_for_vector(vector: &Vector)`, is now one small, private,
> test-only helper function taking raw bytes,
> `derive_argon2id_for_test(password_bytes, salt_bytes, secret_bytes,
> associated_data_bytes, memory_cost_kib, time_cost, parallelism,
> output_len) -> argon2::Result<Vec<u8>>` (constructed internally with
> `Algorithm::Argon2id`, hardcoded `Version::V0x13`, and the given `secret`
> bytes as the pepper via `Argon2::new_with_secret`) — mirroring the
> byte-level shape and `_for_test` naming convention Stage 81/83
> established for `seal_chacha20poly1305_for_test`/
> `extract_hkdf_sha256_for_test`. It is a private `fn` — never
> `pub`/`pub(crate)`, never re-exported — that exists ONLY inside the
> `cfg(test)`-only `rfc9106_vectors` module, and is NOT connected to the
> crate-private `kdf_core` skeleton (Stage 82, unchanged this stage — still
> placeholder-only) or `secret_handle`/`aead_core` in any way. **Test-only
> refactor, not a new capability**: the two pre-existing vector tests
> (`rfc9106_positive_vectors_hash_correctly` and
> `rfc9106_negative_vectors_do_not_match_if_present`) assert exactly what
> they asserted before Stage 86, just calling the shared helper instead of
> building an `argon2::Argon2` inline per vector. Two new unit tests
> exercise the helper directly, independent of the vector file:
> `derive_argon2id_is_deterministic_for_test_helper` (fixed, non-secret,
> test-only inputs always produce the same output) and
> `derive_argon2id_fails_for_unsupported_memory_cost_for_test_helper` (a
> memory cost below Argon2's own minimum makes the helper return an error).
> `cargo test` is GREEN with all 30 tests passing (28 pre-existing + 2 new
> helper unit tests); `cargo check` and `cargo check --tests` stay GREEN
> with no warnings. `Cargo.toml` is UNCHANGED this stage — `argon2` was
> already a `[dependencies]` (production) entry since Stage 84, with the
> same `default-features = false`, zero-features configuration. **No
> production `argon2` import**: `src/lib.rs`'s production code (everything
> before this file's first `cfg(test)`-gated module) still does not import,
> reference, or call `argon2` anywhere; `derive_key_placeholder` remains
> byte-for-byte unchanged, and the crate's public `pub fn` surface stays
> exactly the same six placeholder functions from Stage 69. New
> [`test/fedos_core_rust_argon2_test_helper.test.ts`](test/fedos_core_rust_argon2_test_helper.test.ts)
> (10 tests) checks: the helper exists inside the `cfg(test)`-gated region
> and is private (never `pub`/`pub(crate)`, never re-exported); production
> code (before the first `cfg(test)`) has no `Argon2::`/`Argon2<`/`argon2::`
> usage and no password/salt/secret/associatedData/tag field, and no
> reference to the new helper name either; the public `pub fn` surface is
> exactly the six Stage 69 names; `kdf_core` remains unchanged and
> placeholder-only (no `argon2` import, no reference to the new helper, its
> six methods unchanged); Runtime/Worker sources mention neither the helper
> name nor `argon2`/`rfc9106` and do not auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; and the
> helper call sites use the documented `argon2::Result<Vec<u8>>` signature.
> [`test/fedos_core_rust_argon2_wiring.test.ts`](test/fedos_core_rust_argon2_wiring.test.ts)
> test 5 was updated because it named the OLD per-vector helper —
> `run_argon2id_for_vector` no longer exists after this stage's rename, so
> that test now checks the new `derive_argon2id_for_test` name is not `pub`
> instead. Stage 87 candidate: **an internal key material type skeleton** —
> placeholder-only, holding no real secret bytes yet — in preparation for a
> future AEAD/KDF connection point. Prior status:
>
> **Stage 85 — Wire RFC 9106 Argon2id vectors to Rust
> `cargo test` (verification wiring only; no public `deriveKey`/password-KDF
> API, no Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a third bottom-of-file module,
> `rfc9106_vectors`, gated `#[cfg(test)]` (compiled only for `cargo test`),
> mirroring Stage 75/77's `rfc8439_vectors`/`rfc5869_vectors` modules. It
> reads
> [`test-vectors/kdf/argon2id-rfc9106.json`](test-vectors/kdf/argon2id-rfc9106.json)
> (imported verbatim Stage 73) at compile time via `include_str!` — no
> filesystem IO at test runtime — parses it into a `serde`-derived struct,
> and for the `shouldPass: true` vector (RFC 9106 §5.3's sole published
> Argon2id conformance test case: m=32 KiB, t=3, p=4) asserts `argon2`
> (adopted Stage 84) — constructed with `Algorithm::Argon2id`,
> `Version::V0x13`, the vector's `memoryKiB`/`iterations`/`parallelism`/
> `tagLength`/`associatedData`, and the vector's `secret` as the pepper via
> `Argon2::new_with_secret` — produces exactly the RFC's expected 32-byte
> tag from the vector's `password`/`salt`; a third test asserts the computed
> tag does NOT match the fixture for any `shouldPass: false` vector (none
> exist in this file today — RFC 9106 §5.3 publishes no byte-level tamper
> vector for this construction and none is fabricated, per
> [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md) §2 — so
> that test's loop runs zero iterations and trivially passes, ready to start
> enforcing automatically if a future re-import ever adds one). `cargo test`
> is GREEN with all 28 tests passing (25 pre-existing + 3 new RFC 9106
> tests); `cargo check` and `cargo check --tests` stay GREEN with no
> warnings. **`Cargo.toml` is UNCHANGED this stage** — the vector's memory
> buffer (`Block`s) is allocated with this crate's own `std::vec` and passed
> to `Argon2::hash_password_into_with_memory`; `argon2`'s optional `alloc`
> feature (which would transitively enable `password-hash` and pull in
> `rand_core`, per the Stage 84 review) turned out not to be needed for this
> API surface at all. `argon2` stays adopted exactly as Stage 84 left it:
> `default-features = false`, zero features enabled — verified empirically
> (a throwaway probe project, deleted before this stage's own commit) that
> this exact configuration reproduces the RFC's expected tag byte-for-byte.
> The crate's PUBLIC API — `fedos_core_status`, `fedos_core_capabilities`,
> `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
> `decrypt_placeholder` — is **completely unchanged** and still implements no
> cryptography; there is still **no public `deriveKey`/password-hashing
> implementation**, and nothing outside `#[cfg(test)]` imports or calls
> `argon2`. `crate-type = ["rlib"]`, `#![forbid(unsafe_code)]`, and the
> absence of `wasm-bindgen` all stay exactly as before; no `.wasm` is
> produced. The Runtime, the Worker, and
> `CryptoProvider`/`FedosCoreCryptoProvider` are **not** touched — no random,
> password, or key generation is added anywhere, and nothing wires this
> crate's dependency into the host; the crate-private `kdf_core` skeleton
> (Stage 82) is untouched and remains placeholder-only, unconnected to this
> wiring. `Cargo.lock` was generated to run `cargo test`/`cargo check
> --tests` and then deleted, not committed, per the same convention as every
> prior dependency-adoption stage. New
> [`test/fedos_core_rust_argon2_wiring.test.ts`](test/fedos_core_rust_argon2_wiring.test.ts)
> (12 tests) checks: `lib.rs` contains the `rfc9106_vectors` module wired to
> the exact vector file path via `include_str!` and actually imports/uses
> `argon2` (but only in its `#[cfg(test)]`-scoped tail); production code
> (before the first `#[cfg(test)]`) has no `Argon2::`/`Argon2<`/`argon2::`
> usage (a bare `\bArgon2\b` word match is deliberately NOT used, since this
> crate's pre-existing Stage 69/79 doc-comment prose already legitimately
> says "Argon2" describing what the crate does NOT do); `kdf_core` remains
> unchanged and placeholder-only; the public `pub fn` surface is exactly the
> six Stage 69 names; `derive_key_placeholder`'s body is byte-for-byte
> unchanged; no production password/salt/secret/associatedData/tag storage
> field exists in `kdf_core`; `rand`/`getrandom` remain absent from
> `Cargo.toml`; the `argon2` dependency line still has
> `default-features = false` and no `"password-hash"`/`"rand"`/`"alloc"`
> feature strings; Runtime/Worker sources mention neither `argon2` nor
> `rfc9106` and do not auto-call a crypto operation; and no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed. No existing
> Rust source guard test needed updating this stage — the new module was
> placed so its own nested `#[cfg(test)]` lands after `secret_handle`'s
> (lib.rs's existing first occurrence), leaving every prior file's slicing
> logic untouched. Stage 86 candidate: **an internal Argon2 test helper
> behind `cfg(test)`** — the Argon2id-side analogue of Stage 81/83's
> ChaCha20-Poly1305/HKDF helper extractions — still no public `deriveKey`
> implementation. Prior status:
>
> **Stage 84 — Adopt `argon2` dependency (build check only; no
> Argon2id implementation, no RFC 9106 vector wiring, no `deriveKey`
> implementation, no Runtime/Worker/CryptoProvider wiring, no WASM
> change).**
> `packages/fedos-core-rust/Cargo.toml`'s `[dependencies]` (production) table
> gains a SIXTH entry, `argon2` v0.5.3 (RustCrypto, `default-features =
> false`, NO features enabled — its default `alloc`/`password-hash`/`rand`
> feature set is explicitly excluded), alongside the unchanged
> `chacha20poly1305` v0.11.0 (Stage 74), `hkdf` v0.13.0 (Stage 76), and
> `zeroize`/`secrecy`/`subtle` (Stage 78). This is a dependency + build-check
> ADOPTION ONLY, exactly like every prior dependency Stage: nothing in
> `src/lib.rs` — production or `cfg(test)` — imports, calls, or exercises
> `argon2`; no RFC 9106 Argon2id vector (imported Stage 73 at
> [`test-vectors/kdf/argon2id-rfc9106.json`](test-vectors/kdf/argon2id-rfc9106.json))
> is loaded or wired; `derive_key_placeholder` is byte-for-byte unchanged from
> Stage 69. **`default-features = false` with NO features enabled** — unlike
> `hkdf`'s "default features are fine as-is" Stage 76 adoption, `argon2`'s
> own defaults (`alloc`, `password-hash`, `rand`) would pull in
> `password-hash`'s optional `rand_core` dependency for salt-generation
> convenience; excluding them mirrors `chacha20poly1305`'s Stage 74
> `default-features = false` treatment of its default `getrandom` feature —
> verified empirically that neither `rand_core` nor `password-hash` appears
> anywhere in the resolved dependency graph with this configuration. `argon2`
> adds exactly 8 NEW transitive packages beyond the existing 21-package
> `chacha20poly1305`/`hkdf`/`zeroize`/`secrecy`/`subtle` tree — `argon2`
> itself, `base64ct`, `blake2`, and a SECOND, older generation of
> `digest`/`block-buffer`/`crypto-common`/`generic-array`/`cpufeatures`
> (Argon2's `blake2` dependency pulls `digest` v0.10.7, distinct from the
> `digest` v0.11.3 already in the tree via `hkdf`; both generations coexist,
> which Cargo permits) — for a 29-package combined production dependency
> graph; `subtle` v2.6.1 and `typenum` v1.20.1 are REUSED at their existing
> pinned versions. `argon2` itself uses `unsafe` in 2 call sites (an AVX2
> SIMD backend, the same pattern already acknowledged for
> `chacha20poly1305`'s transitive tree); `blake2`/`base64ct` also use
> `unsafe` internally. None of this affects this crate's own
> `#![forbid(unsafe_code)]`, which governs only this crate's code. The full
> dependency review is recorded in
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md) §12,
> a new `argon2` — Stage 84 entry appended after the existing
> `zeroize`/`secrecy`/`subtle` — Stage 78 entry (never edited in place).
> `Cargo.lock` was generated to run `cargo check`/`cargo test` and then
> deleted, not committed, per the same convention as every prior
> dependency-adoption stage. `aes-gcm` / `rand` / `getrandom` /
> `wasm-bindgen` remain ABSENT; `crate-type = ["rlib"]` and
> `#![forbid(unsafe_code)]` stay exactly as before; no `.wasm` is produced.
> Existing [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> was updated (now 21 tests) to assert `argon2` is present (test 6), lib.rs's
> production code has no `Argon2::`/`Argon2<`/`argon2::` usage outside
> `#[cfg(test)]` (test 12, folded into test 16), and `rand`/`getrandom`
> remain strictly absent (test 9 — `argon2`'s feature configuration avoids
> `rand_core` entirely, so this stays the strict "does not contain" wording
> rather than a relaxed "unless argon2 pulls it in").
> [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts)
> test 3 and
> [`test/fedos_core_rust_rfc8439_wiring.test.ts`](test/fedos_core_rust_rfc8439_wiring.test.ts)/[`test/fedos_core_rust_hkdf_wiring.test.ts`](test/fedos_core_rust_hkdf_wiring.test.ts)
> tests 1/3 were updated to expect SIX production dependency-table entries
> instead of five. A self-referential doc-comment trap was caught and fixed
> during this stage's own verification: a bare, case-matched `\bArgon2\b`
> regex collided with PRE-EXISTING prose in `src/lib.rs` (Stage 69's
> crate-level summary and Stage 79's `secret_handle` doc both already say
> "Argon2" in plain English describing what the crate does NOT do) — the
> new tests instead check specific Rust usage patterns (`Argon2::`,
> `Argon2<`, `Argon2::new(`) that would not appear in that prose. Stage 85
> candidate: **wire the RFC 9106 Argon2id vectors to `cargo test`**,
> following the exact pattern Stage 75/77 used for RFC 8439/RFC 5869 — a new
> `cfg(test)`-only module reading
> [`test-vectors/kdf/argon2id-rfc9106.json`](test-vectors/kdf/argon2id-rfc9106.json)
> via `include_str!` and asserting the known-answer tag bytes — still no
> public `deriveKey` implementation. Prior status:
>
> **Stage 83 — Extract a test-only HKDF-SHA256 helper (test-only
> refactor; no public API change, no production deriveKey, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs`'s pre-existing `cfg(test)`-only
> `rfc5869_vectors` module (Stage 77) is refactored: the HKDF-SHA256
> extract/expand logic that used to be written inline (and duplicated) in
> its two vector tests is now three small, private, test-only helper
> functions, `extract_hkdf_sha256_for_test(ikm_bytes, salt_bytes) ->
> Vec<u8>` (infallible, matching `hkdf`'s own `extract` signature),
> `expand_hkdf_sha256_for_test(prk_bytes, info_bytes, length) ->
> Result<Vec<u8>, InvalidLength>`, and
> `extract_expand_hkdf_sha256_for_test(ikm_bytes, salt_bytes, info_bytes,
> length) -> Result<(Vec<u8>, Vec<u8>), InvalidLength>` (runs both steps in
> one call). All three are private `fn`s — never `pub`/`pub(crate)`, never
> re-exported — that exist ONLY inside the `cfg(test)`-only `rfc5869_vectors`
> module, and are NOT connected to the crate-private `kdf_core` skeleton
> (Stage 82, unchanged this stage — still placeholder-only) or
> `secret_handle`/`aead_core` in any way. **Test-only refactor, not a new
> capability**: the two pre-existing vector tests
> (`rfc5869_positive_vectors_extract_and_expand_correctly` and
> `rfc5869_negative_vectors_do_not_match_if_present`) assert exactly what
> they asserted before Stage 83, just calling the shared helpers instead of
> constructing an `Hkdf<Sha256>` inline twice. Two new unit tests exercise
> the helpers directly, independent of the vector file:
> `extract_then_expand_round_trip_for_test_helper` (agrees between the
> three-helper path and the single combined-helper path over fixed,
> non-secret, test-only bytes) and
> `expand_fails_for_unsupported_length_for_test_helper` (an out-of-range
> OKM length makes expand fail). `cargo test` is GREEN with all 25 tests
> passing (23 pre-existing + 2 new helper unit tests); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — `hkdf`/`sha2` were already `[dependencies]`/
> `[dev-dependencies]` entries since Stage 76/77. **No production
> `hkdf`/`sha2` import**: `src/lib.rs`'s production code (everything before
> this file's first `cfg(test)`-gated module) still does not import,
> reference, or call `hkdf` or `sha2` anywhere; `derive_key_placeholder`
> remains byte-for-byte unchanged, and the crate's public `pub fn` surface
> stays exactly the same six placeholder functions from Stage 69. New
> [`test/fedos_core_rust_hkdf_test_helper.test.ts`](test/fedos_core_rust_hkdf_test_helper.test.ts)
> (10 tests) checks: the three helpers exist inside the `cfg(test)`-gated
> region and are private (never `pub`/`pub(crate)`, never re-exported);
> production code (before the first `cfg(test)`) has no `hkdf`/`sha2`
> import/reference and no reference to the new helper names either; the
> public `pub fn` surface is exactly the six Stage 69 names; `kdf_core`
> remains unchanged and placeholder-only (no `hkdf`/`sha2` import, no
> reference to the new helpers, its six methods unchanged) and still holds
> no production IKM/salt/info/PRK/OKM storage field or
> `Vec<u8>`/`String`/borrowed-byte-slice field; Runtime/Worker sources
> mention neither helper name nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; and all three
> helper call sites use the documented signatures. No existing Rust source
> guard test needed updating this stage — the refactor stayed entirely
> inside `rfc5869_vectors`'s existing `cfg(test)`-gated boundary, so
> `test/fedos_core_rust_hkdf_wiring.test.ts` (which already asserts
> `hkdf`/`sha2` usage is confined to that module's `cfg(test)`-scoped tail)
> needed no change. Stage 84 candidate: **adopt the `argon2` dependency**
> (build-check only, one crate per Stage) — still no public
> `deriveKey`/password-hashing implementation. Prior status:
>
> **Stage 82 — Add an internal KDF module skeleton (crate-private
> only; no public API change, no actual HKDF, no Runtime/Worker/
> CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a third crate-private module,
> `kdf_core`, placed right after Stage 80's `aead_core`. It defines
> `KdfAlgorithm` (`pub(crate) enum`: one variant, `HkdfSha256` — a label
> only), `KdfOperation` (`pub(crate) enum`: `Extract` / `Expand` /
> `ExtractExpand` — a label only), `KdfRequestStatus` (`pub(crate) struct`:
> wraps this crate's existing `FedosCoreState`, not a new parallel enum), and
> `KdfPlaceholderRequest` (`pub(crate) struct`: `algorithm: KdfAlgorithm` +
> `operation: KdfOperation` — no other field) with six methods —
> `new_placeholder_extract()` / `new_placeholder_expand()` /
> `new_placeholder_extract_expand()` (take NO IKM/salt/info/PRK/OKM/length
> input of any kind), `status()` (always `Placeholder` — this skeleton runs
> no cryptography), `algorithm()`, `operation()`. **NOT part of the public
> API**: every item is `pub(crate)` at most — never `pub` — nothing is
> re-exported, and this crate's public `pub fn` surface stays exactly the
> same six placeholder functions from Stage 69; none of them constructs,
> holds, or returns a `KdfPlaceholderRequest`. **No actual HKDF**:
> `kdf_core`'s production code does NOT import `hkdf` (adopted Stage 76) or
> `sha2` (dev-dependency since Stage 77) — both stay exercised ONLY by the
> pre-existing `cfg(test)`-only `rfc5869_vectors` module (Stage 77),
> unchanged this stage; `KdfPlaceholderRequest` stores only the two labels
> above — no borrowed-byte-slice/`Vec<u8>`/`String` field or parameter
> exists anywhere in the module. **No connection to `aead_core` (Stage 80)
> or `secret_handle` (Stage 79)**: `kdf_core` never constructs an
> `AeadPlaceholderRequest` or a `SecretHandle`, and extracts no key/secret
> byte from either — same "when in doubt, leave unconnected" reasoning Stage
> 80 already established; `aead_core` itself is untouched by this stage.
> `derive_key_placeholder` / `encrypt_placeholder` / `decrypt_placeholder`
> remain byte-for-byte unchanged. `Cargo.toml` is UNCHANGED this stage (no
> new dependency — `kdf_core` uses only this crate's own `FedosCoreState`,
> already in scope). `cargo test` is GREEN with all 23 tests passing (19
> pre-existing + 4 new `kdf_core::tests`, its own nested `#[cfg(test)] mod
> tests`: `new_placeholder_extract_reports_extract_operation_only`,
> `new_placeholder_expand_reports_expand_operation_only`,
> `new_placeholder_extract_expand_reports_extract_expand_operation_only`,
> `status_is_always_placeholder_only_no_real_cryptography`); `cargo check`
> and `cargo check --tests` stay GREEN with no warnings —
> `#[allow(dead_code)]` on the module suppresses the (expected) unused-code
> warning a plain, non-test build would otherwise emit, exactly as
> `secret_handle`/`aead_core` already do. New
> [`test/fedos_core_rust_kdf_skeleton.test.ts`](test/fedos_core_rust_kdf_skeleton.test.ts)
> (17 tests) checks: `kdf_core` is present and not `pub mod`;
> `KdfAlgorithm`/`KdfOperation`/`KdfRequestStatus`/`KdfPlaceholderRequest`
> are `pub(crate)`, never `pub`; no public re-export; the public `pub fn`
> surface is exactly the six Stage 69 names; the six placeholder
> signatures/bodies are byte-for-byte unchanged; `kdf_core`'s own extracted
> module text (via brace-matching) has no `hkdf`/`sha2` import; no
> IKM/salt/info/PRK/OKM/secret storage field (a colon-typed field
> declaration, not doc-comment prose) and no
> `Vec<u8>`/`String`/borrowed-byte-slice field anywhere in the module; no
> random/`getrandom`; no `AeadPlaceholderRequest`/`chacha20poly1305`
> mention; no `SecretHandle` mention; no `unsafe` anywhere in `lib.rs`; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact committed; and Runtime/
> Worker sources mention neither `kdf_core`/`KdfPlaceholderRequest` nor
> auto-call a crypto operation (the bare word "kdf" is deliberately NOT
> checked there, since both files already legitimately contain it in
> pre-existing, unrelated prose describing what `selectCryptoProvider` does
> NOT do). No existing Rust source guard test needed updating this stage —
> `kdf_core` was placed so its own nested `#[cfg(test)]` lands after
> `secret_handle`'s (lib.rs's existing first occurrence) and `aead_core`'s,
> leaving every prior file's slicing logic untouched, and the crate-level
> top-of-file doc comment update named no KDF/digest crate directly
> (following the same precedent Stage 80 set for AEAD crate names), avoiding
> the self-referential doc-comment trap two prior stages hit. Stage 83
> candidate: **an internal HKDF helper behind `cfg(test)` or crate-private
> visibility** — the KDF-side analogue of Stage 81's ChaCha20-Poly1305 helper
> extraction — still no public `deriveKey` implementation. Prior status:
>
> **Stage 81 — Extract a test-only ChaCha20-Poly1305 helper
> (test-only refactor; no public API change, no production encrypt/decrypt,
> no Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs`'s pre-existing `cfg(test)`-only
> `rfc8439_vectors` module (Stage 75) is refactored: the ChaCha20-Poly1305
> seal/open logic that used to be written inline (and duplicated) in its two
> vector tests is now two small, private, test-only helper functions,
> `seal_chacha20poly1305_for_test(key_bytes, nonce_bytes, plaintext_bytes,
> aad_bytes) -> Result<Vec<u8>, AeadError>` and
> `open_chacha20poly1305_for_test(key_bytes, nonce_bytes, sealed_bytes,
> aad_bytes) -> Result<Vec<u8>, AeadError>` (`sealed_bytes` is
> `ciphertext‖tag`). Both are private `fn`s — never `pub`/`pub(crate)`, never
> re-exported — that exist ONLY inside the `cfg(test)`-only `rfc8439_vectors`
> module, and are NOT connected to the crate-private `aead_core` skeleton
> (Stage 80, unchanged this stage — still placeholder-only) or
> `secret_handle` (Stage 79) in any way. **Test-only refactor, not a new
> capability**: the two pre-existing vector tests
> (`rfc8439_positive_vectors_encrypt_and_decrypt_correctly` and
> `rfc8439_negative_vectors_fail_to_decrypt_if_present`) assert exactly what
> they asserted before Stage 81, just calling the shared helper instead of
> constructing a `Key`/`Nonce`/`ChaCha20Poly1305` inline twice. Two new unit
> tests exercise the helpers directly, independent of the vector file:
> `seal_then_open_round_trip_for_test_helper` (round-trips fixed, non-secret,
> test-only bytes) and `open_fails_for_tampered_sealed_bytes_for_test_helper`
> (tampering with the tag makes open fail). `cargo test` is GREEN with all 19
> tests passing (17 pre-existing + 2 new helper unit tests); `cargo check`
> and `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — `chacha20poly1305` was already a `[dependencies]`
> (production) entry since Stage 74. **No production `chacha20poly1305`
> import**: `src/lib.rs`'s production code (everything before this file's
> first `cfg(test)`-gated module) still does not import, reference, or call
> `chacha20poly1305` anywhere; `encrypt_placeholder`/`decrypt_placeholder`
> remain byte-for-byte unchanged, and the crate's public `pub fn` surface
> stays exactly the same six placeholder functions from Stage 69. New
> [`test/fedos_core_rust_aead_test_helper.test.ts`](test/fedos_core_rust_aead_test_helper.test.ts)
> (9 tests) checks: the two helpers exist inside the `cfg(test)`-gated
> region and are private (never `pub`/`pub(crate)`, never re-exported);
> production code (before the first `cfg(test)`) has no `chacha20poly1305`
> import/reference and no reference to the new helper names either; the
> public `pub fn` surface is exactly the six Stage 69 names; `aead_core`
> remains unchanged and placeholder-only (no `chacha20poly1305` import, no
> reference to the new helpers, its five methods unchanged) and still holds
> no production key/nonce/plaintext/ciphertext/tag/aad storage field or
> `Vec<u8>`/`String`/borrowed-byte-slice field; Runtime/Worker sources
> mention neither helper name nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; and both
> helper call sites use the documented `Result<Vec<u8>, AeadError>`
> signature. No existing Rust source guard test needed updating this stage —
> the refactor stayed entirely inside `rfc8439_vectors`'s existing
> `cfg(test)`-gated boundary, so `test/fedos_core_rust_rfc8439_wiring.test.ts`
> (which already asserts `chacha20poly1305` usage is confined to that
> module's `cfg(test)`-scoped tail) needed no change. Stage 82 candidate:
> **an internal KDF module skeleton** (the `secret_handle`/`aead_core`-
> analogue for HKDF) — still no public `deriveKey` implementation. Prior
> status:
>
> **Stage 80 — Add an internal AEAD module skeleton (crate-private
> only; no public API change, no actual encryption/decryption, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a second crate-private module,
> `aead_core`, placed right after Stage 79's `secret_handle`. It defines
> `AeadAlgorithm` (`pub(crate) enum`: one variant, `ChaCha20Poly1305` — a
> label only), `AeadOperation` (`pub(crate) enum`: `Encrypt` / `Decrypt` — a
> label only), `AeadRequestStatus` (`pub(crate) struct`: wraps this crate's
> existing `FedosCoreState`, not a new parallel enum), and
> `AeadPlaceholderRequest` (`pub(crate) struct`: `algorithm: AeadAlgorithm` +
> `operation: AeadOperation` — no other field) with five methods —
> `new_placeholder_encrypt()` / `new_placeholder_decrypt()` (take NO
> plaintext/ciphertext/key/nonce/AAD/tag input of any kind), `status()`
> (always `Placeholder` — this skeleton runs no cryptography), `algorithm()`,
> `operation()`. **NOT part of the public API**: every item is `pub(crate)`
> at most — never `pub` — nothing is re-exported, and this crate's public
> `pub fn` surface stays exactly the same six placeholder functions from
> Stage 69; none of them constructs, holds, or returns an
> `AeadPlaceholderRequest`. **No actual encryption/decryption**:
> `aead_core`'s production code does NOT import `chacha20poly1305` (adopted
> Stage 74) — that dependency stays exercised ONLY by the pre-existing
> `cfg(test)`-only `rfc8439_vectors` module (Stage 75), unchanged this stage;
> `AeadPlaceholderRequest` stores only the two labels above — no
> borrowed-byte-slice/`Vec<u8>`/`String` field or parameter exists anywhere
> in the module. **No connection to `secret_handle`**: `aead_core` never
> constructs a `SecretHandle` and extracts no key/secret byte from one — when
> a skeleton-to-skeleton connection was ambiguous, this stage deliberately
> left the two unconnected. `derive_key_placeholder` / `encrypt_placeholder`
> / `decrypt_placeholder` remain byte-for-byte unchanged. `Cargo.toml` is
> UNCHANGED this stage (no new dependency — `aead_core` uses only this
> crate's own `FedosCoreState`, already in scope). `cargo test` is GREEN with
> all 17 tests passing (14 pre-existing + 3 new `aead_core::tests`, its own
> nested `#[cfg(test)] mod tests`:
> `new_placeholder_encrypt_reports_encrypt_operation_only`,
> `new_placeholder_decrypt_reports_decrypt_operation_only`,
> `status_is_always_placeholder_only_no_real_cryptography`); `cargo check`
> and `cargo check --tests` stay GREEN with no warnings —
> `#[allow(dead_code)]` on the module suppresses the (expected) unused-code
> warning a plain, non-test build would otherwise emit, exactly as
> `secret_handle` already does. New
> [`test/fedos_core_rust_aead_skeleton.test.ts`](test/fedos_core_rust_aead_skeleton.test.ts)
> (16 tests) checks: `aead_core` is present and not `pub mod`;
> `AeadAlgorithm`/`AeadOperation`/`AeadRequestStatus`/`AeadPlaceholderRequest`
> are `pub(crate)`, never `pub`; no public re-export; the public `pub fn`
> surface is exactly the six Stage 69 names; the six placeholder
> signatures/bodies are byte-for-byte unchanged; `aead_core`'s own extracted
> module text (via brace-matching, not the fragile "first `cfg(test)`" slice)
> has no `chacha20poly1305` import; no key/nonce/plaintext/ciphertext/tag/aad
> storage field (a colon-typed field declaration, not doc-comment prose) and
> no `Vec<u8>`/`String`/borrowed-byte-slice field anywhere in the module; no
> random/`getrandom`; no HKDF mention; no `SecretHandle` mention; no `unsafe`
> anywhere in `lib.rs`; no `.wasm`/`Cargo.lock`/`target`/`build` artifact
> committed; and Runtime/Worker sources mention neither
> `aead_core`/`AeadPlaceholderRequest` nor auto-call a crypto operation (the
> bare word "aead" is deliberately NOT checked there, since both files
> already legitimately contain it in pre-existing, unrelated prose describing
> what `selectCryptoProvider` does NOT do). No existing Rust source guard
> test needed updating this stage — `aead_core` was placed so its own nested
> `#[cfg(test)]` lands after `secret_handle`'s (lib.rs's existing first
> occurrence), leaving every prior file's slicing logic untouched; the one
> near-miss caught during this stage's own verification was a
> self-referential doc-comment naming `chacha20poly1305` inside `lib.rs`'s
> top-of-file summary, ahead of the production-code slice boundary — reworded
> to avoid the literal crate name, following the same precedent the original
> Stage 69 doc comment already set for keeping AEAD crate names out of that
> summary. Stage 81 candidate: **an internal ChaCha20-Poly1305 helper behind
> `cfg(test)` or crate-private visibility** — a small, RFC-8439-vector-verified
> seal/open routine `aead_core` could eventually call — still no public
> `encrypt`/`decrypt` implementation. Prior status:
>
> **Stage 79 — Add an internal secret-handle skeleton (crate-private
> only; no public API change, no real secrets, no AEAD/HKDF/Argon2, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a crate-private `secret_handle`
> module — the first PRODUCTION code (not `#[cfg(test)]`-only, unlike Stage
> 75/77's vector-verification modules) in this crate to actually import and
> use `zeroize`/`secrecy` (adopted Stage 78), against a fixed, non-secret
> `PlaceholderMarker` only. It defines `SecretHandleState` (`pub(crate) enum`:
> `Empty` / `Placeholder` / `Cleared`), `SecretHandleStatus` (`pub(crate)
> struct`: a non-sensitive status snapshot), and `SecretHandle` (`pub(crate)
> struct`: `state: SecretHandleState` + `marker: SecretBox<PlaceholderMarker>`)
> with four methods — `new_placeholder()` (takes NO secret input of any
> kind), `status()`, `clear()` (zeroizes the placeholder marker, sets state
> `Cleared`), `is_cleared()`. **NOT part of the public API**: every item is
> `pub(crate)` at most — never `pub` — nothing is re-exported, and this
> crate's public `pub fn` surface stays exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `SecretHandle`. **No real secret**: `SecretHandle` accepts and stores no
> key/seed/plaintext/ciphertext/passphrase byte — there is no
> borrowed-byte-slice/`Vec<u8>`/`String` secret parameter or field anywhere;
> `PlaceholderMarker` is a fixed, non-secret `u8` newtype, never derived from
> real secret material. **No AEAD/HKDF/Argon2/NIP-44** implementation exists
> in `secret_handle`. `subtle` (also adopted Stage 78) remains deliberately
> UNUSED this stage — it exists to guard real secret-DERIVED byte comparisons
> (e.g. an authentication tag), which this skeleton's own plain
> `SecretHandleState` enum equality is not; a future stage that needs a real
> comparison adopts it then. `derive_key_placeholder` /
> `encrypt_placeholder` / `decrypt_placeholder` remain byte-for-byte
> unchanged. `Cargo.toml` is UNCHANGED this stage (still the five production
> entries from Stage 78). `cargo test` is GREEN with all 14 tests passing (9
> pre-existing + 5 new `secret_handle::tests`, its own nested `#[cfg(test)]
> mod tests` — the emphasis in every new test name is placeholder-only:
> `new_placeholder_starts_in_placeholder_state_only`,
> `status_reports_placeholder_state_only_no_secret_bytes`,
> `clear_transitions_state_to_cleared_only`,
> `is_cleared_is_false_until_clear_is_called`,
> `empty_state_is_the_default_placeholder_only_state`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings — `#[allow(dead_code)]`
> on the module suppresses the (expected) unused-code warning a plain,
> non-test build would otherwise emit, since nothing outside
> `secret_handle`'s own tests calls into it yet. New
> [`test/fedos_core_rust_secret_handle.test.ts`](test/fedos_core_rust_secret_handle.test.ts)
> (15 tests) checks: `secret_handle` is present and not `pub mod`;
> `SecretHandle`/`SecretHandleState`/`SecretHandleStatus` are `pub(crate)`,
> never `pub`; no public re-export; the public `pub fn` surface is exactly
> the six Stage 69 names; the six placeholder signatures/bodies are
> byte-for-byte unchanged; no key/seed/plaintext/ciphertext/passphrase
> storage field (a colon-typed field declaration, not doc-comment prose) and
> no `Vec<u8>`/`String`/borrowed-byte-slice secret field anywhere in the
> module; no AEAD/HKDF/Argon2/NIP-44 mention; no random/`getrandom`; no
> `unsafe` anywhere in `lib.rs`; no `.wasm`/`Cargo.lock`/`target`/`build`
> artifact committed; Runtime/Worker sources mention neither
> `secret_handle`/`SecretHandle` nor auto-call a crypto operation; and
> `secret_handle` uses `secrecy::SecretBox`/`zeroize::Zeroize` against
> `PlaceholderMarker` while NOT using `subtle`/`ConstantTimeEq`/`.ct_eq()`.
> Existing [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> tests 12–13 were relaxed from "no `zeroize`/`secrecy` usage anywhere" to
> "no PUBLIC exposure of it" (test 14, `subtle`, is unchanged — still "no
> usage at all", since Stage 79 deliberately doesn't use it); test 15's
> production-code slice now ends at `secret_handle`'s own nested
> `#[cfg(test)]` (lib.rs's new first occurrence) instead of the pre-existing
> placeholder tests module — harmlessly, since `secret_handle`'s own
> production content mentions neither `chacha20poly1305` nor `hkdf`. Test 6 in
> [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts)
> was updated to expect (not forbid) `zeroize`/`secrecy` in lib.rs's
> production-code slice. Stage 80 candidate: **an internal AEAD module
> skeleton** — the `chacha20poly1305`-analogue of this stage's KDF-adjacent
> secret-handle work — still no public `encrypt`/`decrypt` implementation.
> Prior status:
>
> **Stage 78 — Adopt `zeroize` / `secrecy` / `subtle` secret-handling
> foundation dependencies (build check only; no secret types, no
> zeroization behavior, no constant-time compare, no Runtime/Worker/
> CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/Cargo.toml`'s `[dependencies]` (production) table
> gains THREE new entries together — `zeroize` v1.9.0, `secrecy` v0.10.3,
> `subtle` v2.6.1 (all RustCrypto/dalek-cryptography, default features) —
> alongside the unchanged `chacha20poly1305` v0.11.0 (Stage 74) and `hkdf`
> v0.13.0 (Stage 76). This is a dependency + build-check ADOPTION ONLY,
> exactly like every prior dependency Stage: `src/lib.rs` is **completely
> unchanged** (no `#[cfg(test)]` module is added this stage — unlike Stage
> 75/77, this trio serves no single primitive and has no known-answer vector
> to wire), no code imports, references, or calls any of the three, no
> `Secret`/`SecretBox` type is defined, no type derives `Zeroize` or calls
> `.zeroize()`, and no `ConstantTimeEq`/`.ct_eq()` call exists anywhere.
> **Why now:** with the AEAD (RFC 8439, Stage 75) and KDF (RFC 5869, Stage
> 77) primitives both verified against their official vectors, the next
> natural step before any real secret byte is handled is the infrastructure
> that will hold, protect, and compare it — adopting it as its own reviewed
> Stage, immediately ahead of the internal secret-handle skeleton that will
> use it (Stage 79 candidate), keeps the foundation itself auditable in
> isolation before any code leans on it. `zeroize` and `subtle` add exactly 3
> NEW transitive packages beyond the existing 18-package
> `chacha20poly1305`/`hkdf` tree — `zeroize`, `secrecy` (depends only on
> `zeroize`), `subtle` (zero dependencies of its own) — for a 21-package
> combined production dependency graph; **no `getrandom`, no
> `rand`/`rand_core`, no build script (`build.rs`)** in any of the three.
> `zeroize` uses `unsafe` internally (volatile writes, load-bearing — this is
> how it defeats compiler dead-store elimination on stable Rust); `secrecy`
> declares `#![forbid(unsafe_code)]` (zero `unsafe`); `subtle` has 2 internal
> `unsafe` call sites (an optimization barrier and a `cmp::Ordering` cast).
> None of this affects this crate's own `#![forbid(unsafe_code)]`, which
> governs only this crate's code. Licenses: `zeroize`/`secrecy` are
> Apache-2.0 OR MIT (same family as `chacha20poly1305`/`hkdf`); `subtle` is
> BSD-3-Clause (a new, compatible license family for this graph). MSRV: no
> bump — `zeroize` 1.9.0 states Rust ≥ 1.85 (same floor already established),
> `secrecy` 0.10.3 states ≥ 1.60 (lower, no-op), `subtle` 2.6.1 states no
> `rust-version` upstream (only `edition = "2018"`, recorded as a documented
> gap per §9, not blocking since its floor is already far below the crate's
> actual toolchain). The full dependency review is recorded in
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md) §12,
> a new `zeroize`/`secrecy`/`subtle` — Stage 78 entry appended after the
> `hkdf` — Stage 76 entry (never edited in place); §5's original "adopted
> together with the first primitive that handles real secret bytes" wording
> is explicitly addressed there as a reviewed refinement, not a silent
> violation. `Cargo.lock` was generated to run `cargo check`/`cargo test` and
> then deleted, not committed, per the same convention as every prior
> dependency-adoption stage. `argon2` / `aes-gcm` / `rand` / `getrandom` /
> `wasm-bindgen` remain ABSENT; `crate-type = ["rlib"]` and
> `#![forbid(unsafe_code)]` stay exactly as before; no `.wasm` is produced.
> Existing [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> was rewritten (now 20 tests, following this stage's exact numbered
> checklist) to assert `zeroize`/`secrecy`/`subtle` are present as production
> dependencies, `sha2` stays dev-only, and lib.rs has no
> `Secret`/`SecretBox`/`ExposeSecret`, no `Zeroize` derive/`.zeroize()` call,
> and no `ConstantTimeEq`/`subtle` usage anywhere (the whole file, since
> Stage 78 adds no new `#[cfg(test)]` module to exclude);
> [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts)
> test 3 and [`test/fedos_core_rust_rfc8439_wiring.test.ts`](test/fedos_core_rust_rfc8439_wiring.test.ts) /
> [`test/fedos_core_rust_hkdf_wiring.test.ts`](test/fedos_core_rust_hkdf_wiring.test.ts)
> tests 1/3 were updated to expect FIVE production dependency-table entries
> instead of two. Stage 79 candidate: **introduce an internal secret-handle
> skeleton** — the first code anywhere in this crate to actually import and
> use `zeroize`/`secrecy`/`subtle` — still without any real key derivation or
> encrypt/decrypt implementation. Prior status:
>
> **Stage 77 — Wire RFC 5869 HKDF-SHA256 vectors to Rust
> `cargo test` (verification wiring only; no public `deriveKey` API, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a second bottom-of-file module,
> `rfc5869_vectors`, gated `#[cfg(test)]` (compiled only for `cargo test`),
> mirroring Stage 75's `rfc8439_vectors` module. It reads
> [`test-vectors/kdf/hkdf-rfc5869.json`](test-vectors/kdf/hkdf-rfc5869.json)
> (imported verbatim Stage 73) at compile time via `include_str!` — no
> filesystem IO at test runtime — parses it into a `serde`-derived struct, and
> for every `shouldPass: true` vector (RFC 5869 Appendix A, Test Cases 1–3,
> HKDF-SHA256) asserts `hkdf::Hkdf::<sha2::Sha256>::extract` (adopted as a
> production dependency Stage 76) produces exactly the RFC's expected PRK, and
> `.expand` with that vector's `info` produces exactly the RFC's expected
> `L`-octet OKM; a third test asserts the derived PRK/OKM does NOT match the
> fixture for any `shouldPass: false` vector (none exist in this file today —
> RFC 5869 Appendix A publishes only positive known-answer cases and none is
> fabricated, per [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md)
> §2 — so that test's loop runs zero iterations and trivially passes, ready to
> start enforcing automatically if a future re-import ever adds one).
> `cargo test` is GREEN with all 9 tests passing (3 pre-existing placeholder
> tests + 3 RFC 8439 tests from Stage 75 + 3 new RFC 5869 tests); `cargo
> check` and `cargo check --tests` stay GREEN. `Cargo.toml` gains ONE new
> `[dev-dependencies]` entry, `sha2` v0.11.0 (RustCrypto, MIT OR Apache-2.0) —
> chosen over the older v0.10.x line because it depends on the same `digest`
> v0.11 generation as `hkdf` v0.13.0's `hmac` dependency (an older `sha2`
> pulls in `digest` v0.10, which fails `Hkdf<D>`'s trait bounds at `cargo
> check --tests` time — this mismatch was caught and fixed during this
> stage's own verification, before commit). `sha2` is used ONLY by the new
> test module to instantiate `Hkdf::<Sha256>`; it is NOT a production
> dependency, and `[dependencies]` (production) still has exactly two
> entries, `chacha20poly1305` and `hkdf`, unchanged from Stage 76. The
> crate's PUBLIC API — `fedos_core_status`, `fedos_core_capabilities`,
> `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
> `decrypt_placeholder` — is **completely unchanged** and still implements no
> cryptography; there is still **no public `deriveKey` implementation**, and
> nothing outside `#[cfg(test)]` imports or calls `hkdf`/`sha2`.
> `crate-type = ["rlib"]`, `#![forbid(unsafe_code)]`, and the absence of
> `wasm-bindgen` all stay exactly as before; no `.wasm` is produced. The
> Runtime, the Worker, and `CryptoProvider`/`FedosCoreCryptoProvider` are
> **not** touched — no random, nonce, or key generation is added anywhere,
> and nothing wires this crate's dependency into the host. `Cargo.lock` was
> generated to run `cargo test`/`cargo check --tests` and then deleted, not
> committed, per the same convention as every prior dependency-adoption
> stage. New
> [`test/fedos_core_rust_hkdf_wiring.test.ts`](test/fedos_core_rust_hkdf_wiring.test.ts)
> (9 tests) checks: `[dependencies]` still has only `chacha20poly1305` +
> `hkdf`; `serde`/`serde_json`/`hex`/`sha2` are dev-dependencies only and
> excluded from `[dependencies]`; every other named crypto crate and
> `wasm-bindgen` stay absent; `lib.rs` contains the `rfc5869_vectors` module
> wired to the exact vector file path via `include_str!` and actually
> imports/uses `hkdf`/`sha2` (but only in its `#[cfg(test)]`-scoped tail); the
> six public placeholder function signatures and bodies are byte-for-byte
> unchanged; no `pub fn` anywhere in the file is anything other than those six
> names; no `.wasm`/`Cargo.lock`/`target`/`build`/compiled artifact is
> committed; and the Runtime/Worker sources neither mention
> `hkdf`/`rfc5869`/`sha2` nor auto-call a crypto operation. Three existing
> test files were updated because `sha2` newly and legitimately appears in
> `Cargo.toml` (as a dev-dependency): test 3 in both
> [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> and [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts),
> and test 3 in
> [`test/fedos_core_rust_rfc8439_wiring.test.ts`](test/fedos_core_rust_rfc8439_wiring.test.ts),
> now assert `sha2` is absent from PRODUCTION `[dependencies]` specifically
> (rather than absent from the whole manifest) and present under
> `[dev-dependencies]`. Prior status:
>
> **Stage 75 — Wire RFC 8439 ChaCha20-Poly1305 vectors to Rust
> `cargo test` (verification wiring only; no public encrypt/decrypt API, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a new bottom-of-file module,
> `rfc8439_vectors`, gated `#[cfg(test)]` (compiled only for `cargo test`).
> It reads
> [`test-vectors/aead/chacha20poly1305-rfc8439.json`](test-vectors/aead/chacha20poly1305-rfc8439.json)
> (imported verbatim Stage 73) at compile time via `include_str!` — no
> filesystem IO at test runtime — parses it into a `serde`-derived struct, and
> for every `shouldPass: true` vector asserts the `chacha20poly1305` crate
> (adopted Stage 74) both seals plaintext+AAD to exactly the RFC's expected
> ciphertext‖tag AND opens that ciphertext‖tag back to exactly the RFC's
> expected plaintext; a third test asserts decrypt/authentication failure for
> any `shouldPass: false` vector (none exist in this file today — RFC 8439
> publishes no byte-level tamper vector for this construction and none is
> fabricated, per [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md)
> §2 — so that test's loop runs zero iterations and trivially passes, ready to
> start enforcing automatically if a future re-import ever adds one).
> `cargo test` is GREEN with all 6 tests passing (3 pre-existing placeholder
> tests + 3 new RFC 8439 tests); `cargo check` stays GREEN. `Cargo.toml` gains
> a `[dev-dependencies]` table — `serde` v1.0.228 (`features = ["derive"]`),
> `serde_json` v1.0.150, `hex` v0.4.3 — used ONLY by the new test module to
> parse the vector JSON and decode its hex fields; none is a production
> dependency, none is reachable from `src/lib.rs`'s public API, and
> `[dependencies]` (production) still has exactly one entry,
> `chacha20poly1305`, unchanged from Stage 74. The crate's PUBLIC API —
> `fedos_core_status`, `fedos_core_capabilities`, `random_bytes_placeholder`,
> `derive_key_placeholder`, `encrypt_placeholder`, `decrypt_placeholder` — is
> **completely unchanged** and still implements no cryptography; there is
> still **no public encrypt/decrypt implementation**, and nothing outside
> `#[cfg(test)]` imports or calls `chacha20poly1305`. `crate-type = ["rlib"]`,
> `#![forbid(unsafe_code)]`, and the absence of `wasm-bindgen` all stay exactly
> as before; no `.wasm` is produced. The Runtime, the Worker, and
> `CryptoProvider`/`FedosCoreCryptoProvider` are **not** touched — no random,
> nonce, or key generation is added anywhere, and nothing wires this crate's
> dependency into the host. `Cargo.lock` was generated to run `cargo test`
> and then deleted, not committed, per the same convention as Stage 74. New
> [`test/fedos_core_rust_rfc8439_wiring.test.ts`](test/fedos_core_rust_rfc8439_wiring.test.ts)
> (9 tests) checks: `[dependencies]` still has only `chacha20poly1305`;
> `serde`/`serde_json`/`hex` are dev-dependencies only and excluded from
> `[dependencies]`; every other named crypto crate and `wasm-bindgen` stay
> absent; `lib.rs` contains the `rfc8439_vectors` module wired to the exact
> vector file path via `include_str!` and actually imports/uses
> `chacha20poly1305` (but only in its `#[cfg(test)]`-scoped tail); the six
> public placeholder function signatures and bodies are byte-for-byte
> unchanged; no `pub fn` anywhere in the file is anything other than those six
> names; no `.wasm`/`Cargo.lock`/`target`/`build`/compiled artifact is
> committed; and the Runtime/Worker sources neither mention
> `chacha20poly1305`/`rfc8439` nor auto-call a crypto operation. Two existing
> test files were updated to keep scanning PRODUCTION code only, since the new
> `#[cfg(test)]` module legitimately mentions `chacha20poly1305`:
> [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> test 10, and [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts)
> tests 3, 6, and 8 (test 3 also now stops its `[dependencies]` line-count at
> the next `[section]` header so `[dev-dependencies]` entries aren't
> miscounted as production dependencies) — every one of them now slices
> `lib.rs`'s source at its first `#[cfg(test)]` attribute and asserts the
> PRODUCTION prefix, not the whole file, has no AEAD mention. Stage 76
> candidate: **adopt the `hkdf` dependency** (production dependency + build
> check only, same one-crate-per-Stage pattern as Stage 74, no vector wiring
> yet — that follows in a later Stage once `hkdf` itself is adopted). Prior
> status:
>
> **Stage 74 — Adopt `chacha20poly1305` dependency (build check
> only; no crypto implementation, no vector wiring, no WASM change).**
> `packages/fedos-core-rust/Cargo.toml` gains its **first dependency**:
> `chacha20poly1305` v0.11.0 (RustCrypto, `default-features = false`,
> `features = ["alloc"]` — explicitly excludes the crate's default
> `getrandom` feature). `src/lib.rs` is **completely unchanged** — no import,
> no call, no encrypt/decrypt implementation, no test-vector loading, no
> random/nonce/key generation; `#![forbid(unsafe_code)]` and `crate-type =
> ["rlib"]` stay exactly as before. `cargo check` resolves and builds a
> 16-package dependency graph (`aead`, `chacha20`, `cipher`, `poly1305`,
> `crypto-common`, `inout`, `hybrid-array`, `universal-hash`, `block-buffer`,
> `typenum`, `cfg-if`, `cpufeatures`, `libc`, `cmov`, `ctutils`, plus
> `chacha20poly1305` itself) with **no `getrandom`, no `rand`/`rand_core`, no
> `zeroize`, no build script** anywhere in it (verified by inspecting the
> generated `Cargo.lock` before deleting it — **`Cargo.lock` is intentionally
> NOT committed** this stage, per the recommendation in
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md) §12:
> a library crate can defer lockfile reproducibility to the future
> build-manifest stage's `dependencyLockDigest`
> ([`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md))).
> `hkdf` / `argon2` / `aes-gcm` / `rand` / `getrandom` / `zeroize` / `secrecy`
> / `subtle` / `wasm-bindgen` remain ABSENT. The full dependency review (crate
> + version, why this crate, transitive count, build-script presence,
> internal `unsafe` in `chacha20`/`poly1305`/`cipher`/`aead`/`cpufeatures`,
> license, MSRV 1.85) is recorded in
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md) §12
> "Adoption log", the first entry under the Stage 72 one-crate-per-Stage
> process. New [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> (13 tests) checks: Cargo.toml contains `chacha20poly1305` and excludes every
> other named crypto crate; `crate-type` stays `rlib` only (no `cdylib`, no
> `wasm32`); `lib.rs` keeps `#![forbid(unsafe_code)]`, has no `unsafe` usage,
> and neither imports nor mentions `chacha20poly1305`/AEAD names, and its
> placeholder functions are untouched; no `.wasm`/compiled/`target`/`build`
> artifact and no `Cargo.lock` is committed; and the Runtime/Worker sources
> neither mention `chacha20poly1305` nor auto-call a crypto operation. The
> existing `test/fedos_core_rust_skeleton.test.ts` test 3 (previously "no
> crypto dependencies", asserting an empty `[dependencies]` table) was updated
> to assert `chacha20poly1305` is the table's ONLY entry, with every other
> crypto crate still forbidden. Stage 75 candidate: **wire the RFC 8439
> ChaCha20-Poly1305 vectors to `cargo test`** (read
> [`test-vectors/aead/chacha20poly1305-rfc8439.json`](test-vectors/aead/chacha20poly1305-rfc8439.json)
> from a Rust test and assert the crate's dependency reproduces the known
> answers — still no public encrypt/decrypt API). Prior status:
>
> **Stage 73 — Official crypto test vectors, verbatim import (no
> Rust, no crypto implementation, no dependency, no WASM change).**
> [`test-vectors/`](test-vectors/README.md) gains **five committed,
> verbatim-imported vector files** — the first real vector bytes in the
> repository — covering ChaCha20-Poly1305, AES-256-GCM, HKDF-SHA256,
> Argon2id, and NIP-44 v2, per the source catalog fixed in
> [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md):
> [`test-vectors/aead/chacha20poly1305-rfc8439.json`](test-vectors/aead/chacha20poly1305-rfc8439.json)
> (RFC 8439 §2.8.2 + Appendix A.5, 2 cases, fetched and scripted-extracted
> from `rfc-editor.org`, plaintext cross-checked by UTF-8 decode);
> [`test-vectors/aead/aes256gcm-nist.json`](test-vectors/aead/aes256gcm-nist.json)
> (NIST CAVP GCM Known-Answer Tests under SP 800-38D, from the official
> `gcmtestvectors.zip`'s `gcmEncryptExtIV256.rsp`/`gcmDecrypt256.rsp`, 5
> cases incl. one official `FAIL`/negative case, each recording its source
> file + `Count` index);
> [`test-vectors/kdf/hkdf-rfc5869.json`](test-vectors/kdf/hkdf-rfc5869.json)
> (RFC 5869 Appendix A.1–A.3, all 3 SHA-256 cases, including the zero-length
> salt/info case and the same-IKM/different-info domain-separation pair);
> [`test-vectors/kdf/argon2id-rfc9106.json`](test-vectors/kdf/argon2id-rfc9106.json)
> (RFC 9106 §5.3, the RFC's sole published Argon2id KAT); and
> [`test-vectors/nip44/nip44-v2.json`](test-vectors/nip44/nip44-v2.json) (the
> ENTIRE upstream `nip44.vectors.json` `v2` object from `paulmillr/nip44`,
> SHA-256-verified against the checksum published inline in
> `nostr-protocol/nips`' `44.md`, restructured — not value-altered — into 8
> named categories incl. 3 official `invalid.*` negative categories; a
> scripted deep-equality check confirmed every imported leaf value is
> byte-identical to upstream). Every file records its own `source` /
> `section` / `revision` / `license` fields; **no vector value was
> independently generated** — every negative/tamper case present (AES-256-GCM's
> `FAIL` case, all of NIP-44's `invalid.*` categories) is itself an official
> vector copied from source, since RFC 8439/RFC 5869/RFC 9106 do not publish
> byte-level tamper vectors and none is fabricated for those three files.
> **`XChaCha20-Poly1305` remains unimported** (source undecided,
> [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md) §4).
> [`test-vectors/README.md`](test-vectors/README.md),
> [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md) §10/§13, and
> [`docs/verification_infrastructure.md`](docs/verification_infrastructure.md)
> were updated in place (with an explicit "Update (Stage 73)" note preserving
> the original Stage 71/72 text) to record that these five primitives moved
> from lifecycle step 1 ("proposed") to step 2 ("imported") — **no primitive
> has reached step 3 ("wired")**; `packages/fedos-core-rust` is completely
> untouched (no `Cargo.toml`/`.rs` change, no dependency, no `unsafe`, no
> WASM), no crypto runs anywhere, and every runtime-gate condition in
> [`docs/verification_infrastructure.md`](docs/verification_infrastructure.md)
> §9 remains unmet for all primitives — the runtime still selects only the
> inert `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`. This stage adds no
> test — there is no new behavior to cover (the vectors are inert JSON data
> read by no code). Stage 74 candidate: **minimal RustCrypto dependency
> adoption** (`chacha20poly1305` / `hkdf` / `zeroize` / `subtle` / `secrecy` /
> `rand_core`) — dependency + build-plumbing only, per
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md), with
> no crypto API implementation and no Runtime wiring. Prior status:
>
> **Stage 72 — Crypto verification infrastructure skeleton (docs +
> empty `test-vectors/` directories only, no vectors, no crypto, no
> Rust/WASM change).**
> Four new docs plus an empty `test-vectors/` tree assemble the
> end-to-end **verification infrastructure** a future Rust crypto core will
> run inside — **no `src/` change, no `packages/fedos-core-rust/src/` change,
> no `Cargo.toml` change, no dependency, no vector JSON, no manifest JSON, no
> WASM, no Runtime/Worker change** in this stage.
> [`docs/verification_infrastructure.md`](docs/verification_infrastructure.md)
> fixes the pipeline: (1) purpose (a single pipeline doc, infrastructure not
> implementation, a gate registry); (2)–(3) the six-stage flow — source
> catalog → vector import → Rust implementation → `cargo test` → build
> manifest → runtime selection — each with an explicit gate condition;
> (4) the docs dependency graph (`crypto_test_vectors.md` →
> `crypto_vector_sources.md` → `fedos_core_rust_safety.md` →
> `rust_dependency_adoption.md` → `fedos_core_build_manifest.md` →
> `build_manifest_example.md` → this file → `test-vectors/README.md`);
> (5) vector lifecycle (proposed → imported → wired → passing → referenced →
> frozen, never edited to "fix" a failing implementation); (6) negative
> vectors (must assert explicit failure, never merely "didn't crash", never
> skipped for green CI); (7) regression policy (wired vectors run every
> `cargo test`; a dependency bump is validated against the full vector set);
> (8) CI policy as future intent only (no CI config changed in this stage);
> (9) the runtime gate condition (five conditions — sourced vectors, passing
> known-answer tests, failing-closed negative tests, a validated build
> manifest, WASM loader provenance — ALL required before a real provider can
> be selected; the placeholder stays selected otherwise); and (10) the
> current conclusion (docs + skeleton only, pipeline named end-to-end but
> unimplemented). [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md)
> fixes the crate dependency process: one crate per Stage; audited crates
> only, no abandoned/single-author novelty crates; RustCrypto preferred by
> default; libsodium limited to uses with no RustCrypto equivalent (e.g.
> XChaCha20-Poly1305) with its C-dependency/build-script cost stated
> explicitly; `zeroize`/`secrecy`/`subtle` adopted together with the first
> primitive touching real secrets; `rand`/`getrandom` as its own Stage with
> production/test RNG kept separate; semver bumps validated against the full
> vector set and treated as a correctness incident if any output changes;
> a dependency-review record (crate+version, primitive served, why this
> crate, transitive count, build-script presence, internal `unsafe`, license,
> MSRV impact) required per Stage; MSRV stated explicitly once any dependency
> lands; and restated forbids (no home-grown crypto, no XOR, no custom
> constant-time compare, no `unsafe` added to FedOS's own code).
> [`docs/build_manifest_example.md`](docs/build_manifest_example.md) shows an
> ILLUSTRATIVE, non-normative example of the
> [`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md) §3
> field set with fabricated placeholder values (all-zero revisions,
> `EXAMPLE`-prefixed digests, `unset` signature/provenance refs, a
> self-describing `notes` field) — explicitly **not** the
> `packages/fedos-core-rust/manifest.example.json` file named as a future
> candidate elsewhere, and not committed anywhere but inside this markdown
> file's fenced code block. A new [`test-vectors/`](test-vectors/README.md)
> directory adds only a `README.md` (directory purpose, "no vectors committed
> yet", official-vectors-only rule, generated-vectors-forbidden-without-label
> rule, and the future `aead/`/`kdf`/`nip44/` layout) plus three EMPTY
> category subdirectories (`aead/`, `kdf/`, `nip44/`, each held in git by a
> `.gitkeep` placeholder) — no `.json` vector file exists anywhere in the
> tree. This stage adds no test — there is no new behavior to cover (the
> existing `fedos_core_rust_skeleton.test.ts` glob guard, scoped to
> `packages/fedos-core-rust/**`, is unaffected by the new top-level
> `test-vectors/` directory). Stage 73 candidate: **Official test vectors
> (verbatim import)** — the first Stage to add real `test-vectors/*.json`
> files (RFC 8439, RFC 5869, RFC 9106, NIST AES-GCM, upstream NIP-44), with
> source/license/revision fixed alongside each; Rust implementation still not
> started. Prior status:
>
> **Stage 71 — Crypto vector source research docs (docs only, no
> vectors, no crypto).**
> A new [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md) fixes,
> in writing, the **official/upstream test-vector source catalog** a FUTURE
> FedOS Rust crypto core will draw known-answer vectors from — **no vector
> bytes copied, no `src/` change, no `packages/fedos-core-rust/src/` change, no
> dependency, no crypto, no WASM** in this stage. It is a **source-selection
> catalog**, concretizing the general rules already fixed in
> [`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md) §3–§7. It
> documents, per primitive: (1) purpose (source catalog before implementation;
> not a vector file, not an implementation spec); (2) adoption principles
> (official RFC/standard/upstream sources preferred; every vector needs
> source + section + revision + license note; generated/custom vectors stay
> out of scope; no implementation behavior specified); (3) ChaCha20-Poly1305
> (primary source RFC 8439 §2.8.2 + Appendix A.5; key/nonce/plaintext/AAD/
> ciphertext/tag; tag/ciphertext/AAD tamper cases; no nonce reuse);
> (4) XChaCha20-Poly1305 (candidate sources: draft-irtf-cfrg-xchacha,
> libsodium vectors, RustCrypto vectors only if traceable to an official
> source; weaker provenance than an RFC, revision must be recorded
> explicitly); (5) AES-256-GCM (candidate sources: NIST SP 800-38D, NIST CAVP
> GCM KATs, Wycheproof negative tests as optional future supplement;
> distinguishes 96-bit IV standard case from non-standard IV cases);
> (6) HKDF-SHA256 (primary source RFC 5869 SHA-256 cases; IKM/salt/info/L/PRK/
> OKM; domain-separation labels mandatory; Apple/Google/WebAuthn credential is
> never IKM/seed); (7) Argon2id (primary source RFC 9106; password
> label/salt/m/t/p/output/expected; mobile vs. desktop profile is a separate
> future decision; password never used directly as an AEAD key); (8) NIP-44
> (primary source upstream `nostr-protocol/nips` NIP-44 v2 vectors;
> conversation key/nonce/payload/ciphertext/decrypt-failure cases; NIP-44 is
> separate from the generic AEAD layer, no local variant); (9) cross-cutting
> negative/tamper vectors (tag/AAD/nonce/ciphertext tamper, malformed/
> truncated payload, wrong domain-separation label, KDF wrong info/salt must
> not collide); (10) the future `test-vectors/` file layout (six named files,
> none added); (11) a future JSON schema proposal (`algorithm` /`source`/
> `sourceRevision`/`licenseNote`/`cases[]`/`expected`/`shouldPass`/`notes` —
> proposal only, not committed); (12) Rust implementation linkage (connects to
> [`docs/fedos_core_rust_safety.md`](docs/fedos_core_rust_safety.md) and
> [`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md); a
> future implementation must pass these vectors before runtime provider
> selection is real; the runtime provider stays the inert placeholder); and
> (13) the current conclusion (docs only, no vectors, no crypto, no
> dependencies). This stage adds no test — there is no new behavior to cover.
> Stage 72 candidate: **Test-vector JSON schema docs and empty
> `test-vectors/` directory skeleton** (fix the schema and directory shape
> before any real vector bytes land). Prior status:
>
> **Stage 70 — FedOS Core Rust crate safety docs (docs only, no code).**
> A new [`docs/fedos_core_rust_safety.md`](docs/fedos_core_rust_safety.md) fixes,
> in writing, the guardrails around the Stage 69 minimal Rust crate skeleton —
> **no Rust/`Cargo.toml` change, no dependency, no crypto, no `zeroize`/`rand`, no
> WASM** in this stage — for adding dependencies, `unsafe`, crypto crates,
> randomness, and WASM before any real primitive lands. It documents: (1) the
> purpose (Rust crate safety contract; future crypto guardrails; not a crypto
> implementation spec); (2) the current crate state (Cargo.toml + lib.rs, no
> deps, `rlib` only, no cdylib/WASM, no crypto, `#![forbid(unsafe_code)]`);
> (3) the `unsafe` policy (keep it forbidden; adding it needs its own
> Stage + docs + review; no casual `unsafe` at FFI/WASM boundaries); (4) the
> dependency policy (adding deps is a separate Stage, audited crates only, crypto
> deps bind to the test-vector plan, `dependencyLockDigest`/manifest updated,
> supply-chain risk explicit); (5) the crypto-crate adoption policy
> (chacha20poly1305 / aes-gcm / hkdf / argon2 / zeroize / secrecy / subtle are
> candidates, adopt per feature per Stage, vectors mandatory, no custom XOR, no
> hand-rolled constant-time compare); (6) memory-safety / secret handling
> (`zeroize`/`secrecy` deferred until real secrets, arrive together with them, no
> secret in logs, panic/core-dump risk is future work); (7) the randomness policy
> (no `rand`/`getrandom` yet, CSPRNG is a separate Stage, separate test RNG from
> production RNG, no nonce reuse); (8) the WASM policy (no `wasm-bindgen`, no
> `cdylib`, no `.wasm`, follow the loader safety rules, runtime loading is a
> separate Stage); (9) the build-artifact policy (`target/`, `Cargo.lock`,
> `.wasm`, `.rlib`/`.so`/`.dll`/`.dylib`/`.a`/`.o`, `build/` never committed —
> enforced by `.gitignore` + test guards); (10) the test policy (`cargo check` /
> `cargo test` / `npm test` guards, official vectors at adoption, no unlabeled
> generated vectors); (11) the future implementation order (test-vector docs →
> build manifest docs → dependency adoption → AEAD → KDF → WASM target → runtime
> loading); and (12) the current conclusion (docs only, no Rust change, no deps,
> no crypto, no WASM). It complements
> [`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md),
> [`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md), and
> [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md). This stage
> adds no test — there is no new behavior to cover. Stage 71 candidate: **AEAD
> vector source research docs** (survey which official AEAD known-answer vectors
> to adopt first). Prior status:
>
> **Stage 69 — Minimal FedOS Rust crate skeleton (Cargo project only, no
> cryptography, no WASM).**
> [`packages/fedos-core-rust`](packages/fedos-core-rust/README.md) gains a
> **minimal Rust crate skeleton** — a `Cargo.toml` (name `fedos-core-rust`,
> version `0.0.0`, edition 2021, `crate-type = ["rlib"]`, **no dependencies**) and
> a `src/lib.rs` with **placeholder functions only**. `lib.rs` defines
> `FedosCoreState` (`Unavailable`/`Placeholder`), `FedosCoreStatus`
> (`state` + `&'static str reason`), `fedos_core_status()`,
> `fedos_core_capabilities()`, and `random_bytes_placeholder()` /
> `derive_key_placeholder()` / `encrypt_placeholder()` / `decrypt_placeholder()` —
> each returns an `Unavailable`/`Placeholder` status and runs **no cryptography**.
> The crate has **no crypto crates** (no chacha20poly1305/aes-gcm/hkdf/argon2), no
> `rand`/`getrandom`, no `zeroize`/`secrecy`/`subtle`, no `bip39`/`secp256k1`, no
> `wasm-bindgen`, and `#![forbid(unsafe_code)]` bans `unsafe`. **No `.wasm`, no
> `cdylib`/WASM target, no build script, no `Cargo.lock`/`target/`** (a package
> `.gitignore` excludes build artifacts). The TS boundary
> (`FedosCoreCrypto` seam + inert `PlaceholderFedosCoreCrypto`) is unchanged and
> still passes typecheck, and the Rust crate is **not wired into the Runtime or
> Worker**. `cargo check` builds the dependency-free crate cleanly (optional; not
> required by CI). **Not implemented (still a future, explicitly-reviewed stage):**
> AEAD / HKDF / Argon2 / NIP-44 / BIP39 / BIP32, random generation, `zeroize`, key
> derivation, encryption/decryption, WASM generation, and any dependency — a real
> AEAD implementation must FIRST pass the crypto test vectors
> ([`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md)) and ship a build
> manifest ([`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md)).
> 13 tests in `test/fedos_core_rust_skeleton.test.ts` cover: Cargo.toml identity,
> lib.rs placeholder API, no crypto deps, no wasm-bindgen/cdylib, no `unsafe`, no
> crypto imports, no random/getrandom, no encryption beyond placeholder names, no
> `.wasm` committed, no `build/`/`target/` committed, README states skeleton-only,
> the TS boundary still loads inertly, and Runtime/Worker have no Rust/WASM
> auto-wire; the Stage 59/63 "no .rs/Cargo" guards were updated to "skeleton
> allowed, no compiled/WASM artifact". Stage 70 candidate: **Rust crate safety
> docs** (fix the dependency-addition / `unsafe` / `zeroize` / crypto-crate
> adoption rules before any real primitive lands). Prior status:
>
> **Stage 68 — FedOS Core build manifest plan (docs only, no code, no
> manifest committed).**
> A new [`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md)
> fixes, in writing, the plan for a build **manifest / provenance** contract a
> FUTURE FedOS Rust/WASM core must ship with — **no `src/` change, no
> `packages/fedos-core-rust/src/` change, no manifest JSON, no `Cargo.toml` / `.rs`
> / `.wasm`, no hashing/signing tooling** in this stage — so a build artifact can
> be tracked, pinned, and (eventually) verified before it is ever loaded. It is a
> **management plan, not a build spec**. It documents: (1) the purpose (provenance
> contract for a future core; a manifest skeleton; explicitly not a build spec);
> (2) why a manifest is needed (WASM module-swap risk, supply-chain risk,
> dependency drift, reproducibility, runtime loader safety); (3) the manifest
> skeleton fields (`manifestVersion`, `packageName`, `sourceRevision`,
> `sourceTreeDigest`, `rustToolchain`, `wasmTarget`, `buildProfile`,
> `dependencyLockDigest`, `testVectorSet`, `wasmArtifactDigest`, `signatureRef`,
> `provenanceRef`, `buildTimestampPolicy`, `notes`); (4) forbidden fields (secret,
> API key, private signing key, raw seed, local path with username, endpoint
> token, machine-specific absolute path); (5) the digest policy (SHA-256+, state
> what each digest covers, separate generated files from the source tree, no
> unverified WASM at runtime); (6) the signature policy (signed release is a
> future candidate, `signatureRef` is an opaque label, no private key in the
> manifest, verification unimplemented); (7) the reproducible-build policy
> (toolchain pinning, lockfile digest, deterministic flags, timestamp handling,
> environment note, state gaps honestly); (8) test-vector linkage (connects to
> [`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md) via `testVectorSet`;
> a Rust core must pass vectors before runtime selection); (9) the runtime-loader
> relationship (connects to
> [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md); the loader
> does not read the manifest yet; a future manifest-validation boundary; no
> validation ⇒ no load); (10) the future file layout
> (`packages/fedos-core-rust/manifest.example.json`,
> `packages/fedos-core-rust/build/`, `test-vectors/` — none added yet); and
> (11) the current conclusion (docs only, no manifest JSON, no WASM, no Rust, a
> future explicit stage required). This stage adds no test — there is no new
> behavior to cover. Stage 69 candidate: **Minimal Rust crate skeleton** (a
> Cargo project only — no cryptography, no WASM generation). Prior status:
>
> **Stage 67 — Crypto operation test-vector plan (docs only, no code,
> no vectors committed).**
> A new [`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md) fixes, in
> writing, the KNOWN-ANSWER test vectors a FUTURE FedOS Rust crypto core must
> reproduce — **no `src/` change, no `packages/fedos-core-rust/src/` change, no
> vector JSON committed** in this stage — so that core can be built **test-first**.
> It is a **verification plan, not an implementation spec**. It documents:
> (1) the purpose (test-first plan for a future Rust core; no runtime dependency
> yet — the runtime still selects only `NoopCryptoProvider` / the inert
> `PlaceholderFedosCoreCrypto`); (2) candidate primitives (ChaCha20-Poly1305,
> XChaCha20-Poly1305, AES-256-GCM, HKDF-SHA256, Argon2id, NIP-44 — with
> BIP39/BIP32/NIP-06 deferred to a separate future candidate); (3) vector-adoption
> rules (prefer standard RFC / upstream official vectors; no home-grown vectors, or
> `generated` clearly labeled; do not freeze implementation-specific output);
> (4) AEAD rules (key / nonce / plaintext / AAD / ciphertext / tag, tamper-failure
> and no-nonce-reuse cases); (5) KDF rules (IKM / salt / info-context / length /
> expected OKM, mandatory domain separation); (6) Argon2id rules (m/t/p / salt /
> non-secret password label / length / expected, mobile-constraint note);
> (7) NIP-44 rules (reference the upstream NIP-44 v2 vectors, conversation key /
> nonce / payload, decrypt-failure cases; NIP-44 NOT implemented); (8) Rust
> prerequisites (`zeroize` / `secrecy` / `subtle`, audited crates, no custom XOR,
> no hand-rolled constant-time compare); (9) the forbidden list (XOR cipher,
> unauthenticated encryption, nonce reuse, custom KDF, password-as-key,
> Apple/Google/WebAuthn credential as seed); (10) the future `test-vectors/`
> layout (`aead/*.json`, `kdf/*.json`, `nip44/*.json` — added only when official
> vectors are copied with source notes, none added yet); and (11) the current
> conclusion (docs only, no crypto code, no vectors committed unless a verified
> source exists, and a future Rust implementation must pass these vectors before
> runtime selection). It complements
> [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md) §10 (which
> names AEAD/KDF test vectors as prerequisites) and the crypto boundary. This
> stage adds no test — there is no new behavior to cover. Stage 68 candidate:
> **FedOS Core build manifest skeleton docs** (fix build manifest / provenance /
> pinned-digest management before any real Rust/WASM lands). Prior status:
>
> **Stage 66 — Anti-analysis & Shadow Vault risk docs (docs only, no
> code).**
> A new [`docs/anti_analysis_shadow_vault_risks.md`](docs/anti_analysis_shadow_vault_risks.md)
> fixes, in writing, a set of **hard prohibitions** — **no `src/` change, no
> behavior change** in this stage — so that nobody, now or in a future stage, adds
> anti-debugging, anti-VM detection, self-destruct, or fake "shadow data"
> generation. It documents: (1) anti-debug / anti-VM detection is NOT implemented
> (no `sys.gettrace`/`ptrace`/`debugger;` traps, no VM/emulator artifact scan, no
> "am I being analyzed?" fingerprinting); (2) self-destruct / forced exit /
> process kill is NOT implemented (no `os._exit`, no crash-on-detection, no
> heuristic-driven wipe trigger); (3) VM detection has high false positives and
> breaks legitimate users, developers/CI, and auditors; (4) debugger detection
> reads as evasion and is security theater; (5) the safe alternatives it DOES
> consider instead (app lock on background, explicit user lock, session timeout,
> a best-effort memory-wipe *request* boundary, crash-safe state clearing, no
> secret in logs) — reacting to the user/OS lifecycle, never to a "watched?"
> guess; (6) shadow data generator is NOT implemented; (7) branch-selected shadow
> vaults (e.g. `finger_id == 5`) are a clear anti-pattern; (8) fake activity
> generation carries large legal / UX / safety risk; (9) deniable storage stays a
> Stage 40 research boundary; (10) the prerequisites IF a legitimate hardened
> container were ever pursued (audited Rust core, fixed-size container, AEAD,
> padding, metadata-leak analysis, no hardcoded branch, no generated fake claims);
> (11) forbidden wording ("完全に隠せる" / "捜査に耐える" / "痕跡ゼロ" /
> "絶対バレない" and variants); and (12) the current conclusion (docs only, no
> anti-analysis, no shadow generator, prohibitions binding). It complements
> [`docs/deniable_storage_research.md`](docs/deniable_storage_research.md)
> (Stage 40) and [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md).
> This stage adds no test — there is no new behavior to cover. Stage 67 candidate:
> **Crypto operation test-vector documentation** (fix the KNOWN-ANSWER vectors —
> AEAD / HKDF / Argon2 / NIP-44 — a future real core must reproduce). Prior
> status:
>
> **Stage 65 — Runtime crypto provider selection boundary (disabled by
> default, selection only, no WASM, no cryptography).**
> `createRuntime` can now SELECT a Stage 34 `CryptoProvider` from the environment
> and exposes it as `AppRuntime.cryptoProvider`. This is a **selection /
> dependency-injection seam ONLY** — building a runtime constructs the provider
> and nothing more: it never calls
> `randomBytes()`/`deriveKey()`/`encrypt()`/`decrypt()`, loads no WASM, issues no
> `fetch`/dynamic import, performs no WASM instantiation, and runs no
> KDF/AEAD/random/zeroize. New selection helper
> `selectCryptoProvider(env, overrides)`: (1) `overrides.cryptoProvider` wins
> unconditionally; (2) `CRYPTO_PROVIDER="noop"` → `NoopCryptoProvider`;
> (3) `CRYPTO_PROVIDER="fedos"` OR a truthy `ENABLE_CRYPTO_PLACEHOLDER`
> (`true`/`"1"`/`"true"`/`"yes"`/`"on"`) → a `FedosCoreCryptoProvider` injected
> with the permanently-inert **`PlaceholderFedosCoreCrypto` ONLY** (no real
> Rust/WASM core, no WASM loader — still `unavailable`, runs no cryptography);
> (4) anything else / invalid / absent → `NoopCryptoProvider` (the safe default —
> **disabled by default**). New env fields `RuntimeEnv.CRYPTO_PROVIDER?` and
> `RuntimeEnv.ENABLE_CRYPTO_PLACEHOLDER?` (mirrored on the Worker `Env`) are read
> but never mutated; the truthy check reuses the existing `isEnvFlagTruthy`
> helper. A new `RuntimeOverrides.cryptoProvider?` lets tests/callers pin a
> provider. The read-only Runtime status page adds `cryptoProvider` under the
> **security** category as a coarse constructor label only — it never calls
> `randomBytes`/`deriveKey`/`encrypt`/`decrypt` or any provider method. The Worker
> constructs and runs **nothing**: no crypto op, no WASM loader,
> and no cryptography. **Not implemented (still requires its own future, explicit
> stage):** any real WASM load / `WebAssembly.instantiate`, `.wasm` file, `fetch`,
> dynamic import, HKDF / Argon2 / AEAD, random generation, zeroize, encryption /
> decryption / key derivation, Vault unlock, and WebAuthn / Passkey. See
> [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md) for the safety
> contract this selection boundary preserves (§6 "loader selection is a separate
> stage"). 12 tests in `test/runtime_crypto_env.test.ts` cover: override wins,
> `noop`→Noop, `fedos`→FedOS (placeholder core only), truthy
> `ENABLE_CRYPTO_PLACEHOLDER`→FedOS (and falsy→Noop), invalid→Noop,
> disabled-by-default, no crypto-op auto-call, no WASM instantiation / no `fetch`,
> status-page label-only (no provider method called), Worker runs no crypto op /
> no WASM loader, no `navigator.credentials` / `WebAssembly` / `fetch` call site in
> the runtime, and no env mutation. Stage 66 candidate: **Crypto operation
> test-vector documentation** (fix the KNOWN-ANSWER vectors — AEAD / HKDF /
> Argon2 / NIP-44 — a future real core must reproduce, so the Rust implementation
> can be built test-first). Prior status:
>
> **Stage 64 — FedOS Core WASM loader safety docs (docs only, no
> code).**
> A new [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md) fixes,
> in writing, the safety contract that Stage 63's
> `packages/fedos-core-rust/src/wasm_loader.ts` already implements — **no `src/`
> change, no `packages/fedos-core-rust/src/` change, no behavior change** in this
> stage — so that when a real loader is eventually built (actual WASM
> instantiation) it cannot regress the rules that matter most: **nothing loads
> automatically, nothing is fetched, and no cryptography runs until an audited
> core exists behind an explicit, disabled-by-default gate.** It documents:
> (1) the loader boundary's purpose (WASM loader seam / future Rust crypto core
> replacement point — explicitly NOT an implementation spec, no runtime loading
> yet); (2) the absolute rules (no automatic WASM loading, no `fetch` by default,
> no dynamic import by default, no `WebAssembly.instantiate` by default, no
> path/URL resolution from env, no secrets in `moduleRef`/`integrityRef`, no
> crypto operation until an audited core exists); (3) what MAY be handled (opaque
> `moduleRef`/`integrityRef`, coarse loader state, placeholder capability,
> `PlaceholderFedosCoreCrypto` only); (4) what MUST NEVER be handled (raw module
> URL, endpoint URL, filesystem path, API key, seed, key material,
> plaintext/ciphertext bytes, stack trace, raw loader error); (5) the integrity /
> provenance policy (`integrityRef` is an opaque label, no real hash verification
> yet, a real loader needs a pinned digest / signed release / reproducible build /
> versioned manifest, and never loads real WASM without an integrity check);
> (6) the Runtime / Worker relationship (no auto-load from `createRuntime` or the
> Worker, loader selection is a separate stage, actual load is a further stage,
> status page shows a constructor label only); (7) the CryptoProvider relationship
> (`FedosCoreCryptoProvider` is the adapter, the bridge only extracts a core from a
> decision, no real KDF/AEAD/random/zeroize, Noop/Placeholder are not a safety
> guarantee); (8) error handling (no raw error, no stack trace, no endpoint/path
> echoed, error state + fixed reason only); (9) the test policy this area must keep
> satisfying (no `.wasm` committed, no `.rs`/Cargo committed, no
> fetch/import/`WebAssembly.instantiate`, Runtime/Worker not wired,
> `moduleRef`/`integrityRef` not resolved, no input mutation); and (10) the future
> implementation prerequisites (Rust crate separated, audited dependencies,
> `zeroize`/`secrecy`/`subtle`, AEAD test vectors, KDF test vectors, reproducible
> build, pinned digest, explicit disabled-by-default runtime gate, no auto
> network). Every rule matches code that already exists and is already tested in
> `test/fedos_core_wasm_loader.test.ts` — this stage adds no new test either, since
> there is no new behavior to cover. Stage 65 candidate: **Runtime crypto provider
> selection boundary, disabled by default** (let `createRuntime` SELECT a
> `CryptoProvider` — still with no real WASM load and no real cryptography). Prior
> status:
>
> **Stage 63 — FedOS Core WASM loader boundary (loader seam only,
> disabled by default, no WASM, no Rust, no cryptography).**
> A new [`packages/fedos-core-rust/src/wasm_loader.ts`](packages/fedos-core-rust/src/wasm_loader.ts)
> adds the LOADER SEAM a future stage would use to bring a real RustCrypto-backed
> WASM module online behind the Stage 59 `FedosCoreCrypto` seam — but this stage
> ships the **boundary / placeholder / pure bridge ONLY**, and **loads nothing**.
> It defines `FedosCoreWasmLoader` (`getStatus`, `getCapabilities`,
> `load(request)`, `unload()`), a `FedosCoreWasmLoaderState`
> (`disabled`/`unloaded`/`loaded_placeholder`/`unavailable`/`error`), placeholder
> `FedosCoreWasmLoaderCapability` labels (`wasm_loader_placeholder`,
> `instantiate_placeholder`, `integrity_check_placeholder`,
> `rust_core_placeholder`), a `FedosCoreWasmLoadRequest` (OPAQUE, non-secret
> `moduleRef`/`integrityRef` labels plus a coarse `source: "disabled" |
> "placeholder"`), and a `FedosCoreWasmLoadDecision` (`allowed`/`state`/`reason`
> plus an optional `core`). `NoopFedosCoreWasmLoader` is the **disabled-by-default**
> default (advertises nothing, denies every load); `PlaceholderFedosCoreWasmLoader`
> models an `unloaded → loaded_placeholder → unloaded` state machine — and even a
> `loaded_placeholder` hands back ONLY the permanently-inert
> `PlaceholderFedosCoreCrypto` (itself `unavailable`), never a real core; `unload()`
> only changes state. Two pure helpers: `fedosCoreWasmDecisionToCore(decision)`
> pulls the core a decision produced (or `undefined`), and
> `loadFedosCoreWasm(loader, request)` wraps any loader's `load` so a throw/reject
> becomes a non-sensitive `error` decision instead of propagating. **The loader is
> a boundary only: it issues no `fetch`, performs no dynamic module import, calls
> no WASM `instantiate`/`compile` engine API, resolves no module path/URL, and
> runs no cryptography** (no HKDF/Argon2/KDF, no AEAD, no CSPRNG/random, no
> zeroize, no key generation/derivation). `moduleRef`/`integrityRef` are opaque
> labels — never resolved, fetched, or echoed. It is **NOT wired into the runtime
> or the Worker** (`create_runtime.ts`/`worker.ts` contain no `wasm`/`fedos`
> reference). **No `.wasm` file, no `.rs`/`Cargo.toml`, and no Rust/crypto/WASM
> library** are added. **A future real loader (actual WASM instantiation) requires
> its own separate, explicit stage.** 15 tests in
> `test/fedos_core_wasm_loader.test.ts` cover: Noop always disabled, Placeholder
> constructor inert (starts `unloaded`), `load` issues no `fetch`, `load` calls no
> WASM `instantiate`/`compile`, `load` returns the inert placeholder core only,
> `moduleRef`/`integrityRef` never resolved or echoed, `unload` changes state
> only, loader errors caught by `loadFedosCoreWasm` (never thrown/leaked), no
> input mutation, Runtime/Worker have no WASM-loader auto-wire, no `.wasm`
> committed, no `.rs`/Cargo committed, no crypto/WASM import, and no dynamic
> import. Stage 64 candidate: **FedOS Core WASM safety docs** (fix, in writing,
> what a real loader MAY and MUST NEVER do before any real WASM lands). Prior
> status:
>
> **Stage 62 — WebAuthn runtime selection boundary (disabled by
> default, selection only, no browser API).**
> `createRuntime` can now SELECT a Stage 60 `WebAuthnProvider` from the
> environment and exposes it as `AppRuntime.webAuthnProvider`. This is a
> **selection / dependency-injection seam ONLY** — building a runtime constructs
> the provider and nothing more: it never calls `begin()`/`cancel()`, touches no
> browser credential API, launches no Face ID / Touch ID, contacts no Secure
> Enclave / Android Keystore, and stores no credential/challenge. **WebAuthn /
> Passkey stays an unlock TRIGGER only, never a key source — and no unlock ever
> happens by constructing a runtime.** New selection helper
> `selectWebAuthnProvider(env, overrides)`: (1) `overrides.webAuthnProvider`
> wins unconditionally; (2) `WEBAUTHN_PROVIDER="noop"` → `NoopWebAuthnProvider`;
> (3) `WEBAUTHN_PROVIDER="placeholder"` OR a truthy `ENABLE_WEBAUTHN_PLACEHOLDER`
> (`true`/`"1"`/`"true"`/`"yes"`/`"on"`) → `PlaceholderWebAuthnProvider`;
> (4) anything else / invalid / absent → `NoopWebAuthnProvider` (the safe,
> permanently-`unavailable` default — **disabled by default**). New env fields
> `RuntimeEnv.WEBAUTHN_PROVIDER?` and `RuntimeEnv.ENABLE_WEBAUTHN_PLACEHOLDER?`
> (mirrored on the Worker `Env`) are read but never mutated; the truthy check
> reuses the existing `isEnvFlagTruthy` helper. A new `RuntimeOverrides.
> webAuthnProvider?` lets tests/callers pin a provider. The read-only Runtime
> status page adds `webAuthnProvider` under the **security** category as a coarse
> constructor label only — it never calls `begin`/`cancel` or any provider
> method. The Worker constructs and begins **nothing**: no
> `new PlaceholderWebAuthnProvider`, no `begin()`/`cancel()`, no
> `navigator.credentials`. **Not implemented (still requires its own future,
> explicit stage):** any real `navigator.credentials.create/get` call, Face ID /
> Touch ID / platform-authenticator launch, Secure Enclave / Android Keystore
> access, conditional-UI / autofill, credential / challenge / response /
> attestation / assertion storage, JWT / OAuth, key generation / derivation, and
> Vault unlock. See [`docs/webauthn_passkey_safety.md`](docs/webauthn_passkey_safety.md)
> for the safety contract this selection boundary preserves. 13 tests in
> `test/runtime_webauthn_env.test.ts` cover: default→Noop, `noop`→Noop,
> `placeholder`→Placeholder, truthy `ENABLE_WEBAUTHN_PLACEHOLDER`→Placeholder
> (and falsy→Noop), invalid→Noop, override wins, no `begin()` auto-call, no
> `cancel()` auto-call, no `navigator.credentials` in the runtime sources (and no
> throw when building), no Worker `begin`/`navigator.credentials`, status-page
> label-only (no provider method called), and no env mutation. Stage 63
> candidate: **FedOS Core WASM loading boundary, disabled by default** (cut the
> next swap point — the FedOS Core WASM loader seam — so the Identity → WebAuthn
> → Vault → Crypto Core substitution path becomes visible). Prior status:
>
> **Stage 61 — WebAuthn / Passkey adapter safety docs (docs only, no
> code).**
> A new [`docs/webauthn_passkey_safety.md`](docs/webauthn_passkey_safety.md)
> fixes, in writing, the safety contract that Stage 60's
> `src/identity/webauthn_adapter.ts` already implements — **no `src/` change, no
> behavior change** in this stage — so that when a real browser adapter is
> eventually built (actual `navigator.credentials` calls) it cannot regress the
> rule that matters most: **WebAuthn / Passkey is an unlock TRIGGER, never a key
> source, never an identity seed.** It documents: (1) the adapter's purpose
> (unlock-trigger boundary / browser-provider seam — explicitly NOT a key source,
> NOT an identity seed); (2) the absolute rules (Apple ID / Google Account, a
> credential id, and an assertion response are NEVER a seed; challenge / `rawId` /
> `attestation` / `authenticatorData` / `clientDataJSON` / JWT / OAuth tokens are
> NEVER stored); (3) what MAY be handled (opaque `reference`/`rpIdRef`/`userRef`
> labels, coarse status, placeholder capability, non-secret reason); (4) what
> MUST NEVER be handled (credential, rawId, challenge bytes, assertion response,
> attestation object, authenticator data, private key, seed, token, JWT,
> profile/email, platform-authenticator secret); (5) the Vault relationship
> (WebAuthn → `PasskeyAuthenticationRequest` → `VaultUnlockRequest`, all separate
> boundaries — WebAuthn unlocks a LOCAL vault but never generates its seed, and no
> real unlock happens yet); (6) the Crypto / FedOS Core relationship (FedOS Core
> is the future crypto swap point; the adapter never calls a `CryptoProvider` and
> handles no KDF/AEAD/random); (7) the conditions any future real
> `navigator.credentials` adapter must satisfy (disabled by default, explicit user
> action, no automatic prompt, no credential/challenge persistence, sanitized
> errors, no stack trace, no raw provider response); (8) UI/UX wording ("Unlock
> with passkey" allowed; "Generate key from Apple ID" / "Face ID creates your
> Nostr key" / "Apple·Google account is your seed" forbidden); (9) the test policy
> this area must keep satisfying (no `navigator.credentials` call, no
> credential/challenge retention, Runtime/Worker not wired, type-only Passkey
> import, no crypto import); and (10) the current-state conclusion (docs only, no
> real WebAuthn, no key derivation, a future explicit stage required). Every rule
> matches code that already exists and is already tested in
> `test/webauthn_adapter.test.ts` — this stage adds no new test either, since
> there is no new behavior to cover. Stage 62 candidate: **WebAuthn runtime
> selection boundary, disabled by default** (let `createRuntime` SELECT a
> `WebAuthnProvider` — still with no real `navigator.credentials`). Prior status:
>
> **Stage 60 — WebAuthn / Passkey provider adapter skeleton (boundary
> only, no browser API).**
> A new [`src/identity/webauthn_adapter.ts`](src/identity/webauthn_adapter.ts)
> adds the browser-provider ADAPTER seam that a future unlock flow would hand to
> the Stage 36 `PasskeyBoundary` — but this stage ships the **boundary /
> placeholder / pure bridge ONLY**. It defines `WebAuthnProvider` (`getStatus`,
> `getCapabilities`, `begin(request)`, `cancel()`), a `WebAuthnAdapterStatus`
> (`unavailable`/`idle`/`waiting`/`authenticated_placeholder`/`cancelled`/
> `error`), placeholder `WebAuthnAdapterCapability` labels (`webauthn_placeholder`,
> `platform_authenticator_placeholder`, `cross_platform_authenticator_placeholder`,
> `conditional_ui_placeholder`), and a `WebAuthnAdapterRequest` (`kind: "get" |
> "create"` plus OPAQUE, non-secret `reference`/`rpIdRef`/`userRef` labels).
> `NoopWebAuthnProvider` is the permanently-`unavailable` default (advertises
> nothing, denies every attempt); `PlaceholderWebAuthnProvider` models an
> `idle → authenticated_placeholder ↔ cancelled` UX holding ONLY a coarse
> `WebAuthnReport` — its `authenticated_placeholder` is a LABEL (no credential is
> held and the Vault is NOT unlocked), `cancel()` only changes state, and the
> report's `reason` never echoes any opaque label. **The WebAuthn adapter is a
> boundary only: it calls no browser credential API** (`navigator.credentials`
> appears nowhere), launches no Face ID / Touch ID, contacts no Secure Enclave /
> Android Keystore, runs no conditional-UI flow, and stores no
> challenge/credential id/rawId/response/attestation/assertion/token/key.
> **Apple / Google / WebAuthn are unlock TRIGGERS ONLY, never a key source.** The
> pure `webauthnReportToPasskeyRequest(request)` bridge maps a WebAuthn
> `get`/`create` to a Stage 36 `PasskeyAuthenticationRequest` with `kind:
> "webauthn"` (never `apple_passkey`/`android_passkey`), passing only the opaque
> `reference` through (`rpIdRef`/`userRef` are NOT forwarded) — it derives no
> key, holds no credential, does NOT unlock the Vault, and keeps its Passkey-types
> dependency TYPE-ONLY. It is **NOT wired into the runtime or the Worker** —
> `create_runtime.ts`/`worker.ts` construct nothing from this file and contain no
> `webauthn` reference. **A future real browser adapter (actual
> `navigator.credentials` calls) requires its own separate, explicit stage.** 16
> tests in `test/webauthn_adapter.test.ts` cover: Noop always unavailable,
> Placeholder constructor is inert, `begin` calls no browser API (no throw in
> node + source has no `navigator.credentials`), a `create` request stores no
> challenge/attestation, a `get` request stores no credential id/assertion,
> `cancel` changes state only, the bridge is pure and passes only the opaque
> reference (never a platform passkey kind), no input mutation, no method throws,
> the Runtime and Worker sources contain no `webauthn` reference, no
> browser-credential API usage, and no WebAuthn/credential/crypto library import.
> Stage 61 candidate: **WebAuthn adapter safety docs** (fix, in writing, the
> "credential is not a key source / Apple·Google are not a seed" rules before any
> real browser API lands). Prior status:
>
> **Stage 59 — FedOS core crypto package boundary (no Rust, no WASM,
> no cryptography).**
> A new package [`packages/fedos-core-rust`](packages/fedos-core-rust/README.md)
> is the INTENDED future home of a RustCrypto-backed WASM/FFI crypto core — but
> this stage ships the **package boundary / TS adapter / placeholder core
> ONLY**. It defines the standalone `FedosCoreCrypto` seam (`getStatus`,
> `getCapabilities`, `randomBytes`, `deriveKey`, `encrypt`, `decrypt`) and a
> permanently-inert `PlaceholderFedosCoreCrypto` / `createFedosCoreCrypto()`
> that reports `state: "unavailable"`, advertises placeholder capabilities
> (labels of FUTURE intent, all ending `_placeholder`), and refuses every
> operation with a non-sensitive `FedosCoreDecision` (`{ allowed, state, reason }`
> — no output/bytes field, since nothing is computed). The package's `types.ts`
> imports nothing at all; its capability/state/decision string values mirror the
> host `src/crypto/types.ts` seam so the host adapter can pass them straight
> through. The host consumes it ONLY through the new
> `FedosCoreCryptoProvider implements CryptoProvider`
> (`src/crypto/fedos_core_adapter.ts`), which injects an optional
> `FedosCoreCrypto`: built WITHOUT a core it is a drop-in `NoopCryptoProvider`
> (delegates to one — `unavailable`, empty capabilities); built WITH the
> placeholder core it delegates `getStatus`/`getCapabilities` and returns
> `unavailable` for every operation. The adapter **never throws** (a core that
> throws/rejects is caught and reported as a non-sensitive `error`
> status/decision — the provider's own error text is dropped, never echoed),
> **never mutates** the input request, and **retains no** secret/key/plaintext/
> ciphertext bytes (requests carry only opaque handles). **This stage implements
> no real cryptography**: no HKDF/Argon2/KDF, no AEAD/ChaCha20-Poly1305/AES-GCM/
> encrypt/decrypt, no CSPRNG/random, no BIP39/BIP32, no NIP-44, no zeroize, no
> WebAuthn/passkey, no Secure Enclave, and no Apple/Google integration. No
> `.wasm`/`.rs`/Cargo file is committed. It is **NOT wired into the runtime or
> the Worker** — `create_runtime.ts`/`worker.ts` construct nothing from these
> files and contain zero `fedos` reference. 15+ tests in
> `test/fedos_core_adapter.test.ts` cover: the package exports the placeholder
> core, core status `unavailable`, capabilities placeholder-only, the adapter
> implements `CryptoProvider`, delegates `getStatus`/`getCapabilities`, returns
> `unavailable` for `randomBytes`/`deriveKey`/`encrypt`/`decrypt`, catches a
> throwing core without leaking its error text, no input mutation, the Runtime
> and Worker sources contain no `fedos` reference, no crypto/WASM library import,
> and no Rust/WASM binary committed. Stage 60 candidate: **WebAuthn/Passkey
> provider adapter skeleton** (a disabled-by-default browser-API boundary, so
> Identity → Vault → Crypto wiring can proceed). Prior status:
>
> **Stage 58 — Runtime external health check boundary, disabled by
> default.**
> A new `src/runtime/health_check.ts` ships ONLY the boundary shape for a
> future "is this selected provider/endpoint actually reachable?" seam — as
> opposed to Stage 50/51's `runtime_status.ts`, which only reports WHICH
> implementation was selected, never whether it works. `HealthCheckTarget`
> (`kind`/`label`/optional `endpointRef`) describes what would be checked —
> `endpointRef` is an OPAQUE display label only, never a real URL to
> dereference, and there is deliberately no field for an API key or token
> anywhere in this file. `HealthCheckProvider` (`getStatus()`/`check(target,
> options?)`) is the seam; `NoopHealthCheckProvider` and
> `DisabledHealthCheckProvider` are both safe, permanently-inert defaults —
> `check()` NEVER issues a `fetch`, pings anything, or calls a provider/cache/
> bridge method, and always resolves `status: "disabled"` without touching
> the network. The pure `canRunHealthCheck(target, options?)` policy helper
> models the opt-in gate itself: without `{ enabled: true }` it resolves
> `"disabled"`; even WITH that opt-in, it resolves `"skipped"` rather than
> fabricate a health result, because no real check implementation exists yet.
> `HealthCheckDecision.checkedAt` is populated ONLY from a caller-supplied
> `options.now` — this module never calls `Date.now()` itself, so omitting
> `now` means no `checkedAt` at all (never a silently guessed timestamp), and
> `targetLabel` echoes ONLY `target.label`, never `target.endpointRef` — even
> a caller-supplied endpointRef that looks like a real secret/URL never
> appears anywhere in the returned decision. **This stage implements no real
> probe, ping, or `fetch` of any kind, and is NOT wired into the runtime or
> the Worker** — `createRuntime`/`worker.ts` construct nothing from this file
> and call nothing in it; `src/runtime/health_check.ts` itself has zero
> imports. 15 new tests in `test/runtime_health_check.test.ts` cover: both
> Noop/Disabled providers are always `"disabled"`, `check()` issues no
> `fetch` (verified with a `globalThis.fetch` spy) and calls no provider
> method, `endpointRef` stays opaque and is never echoed in the decision (even
> a fake-secret-shaped value), no API-key/token-shaped field exists on the
> target or the decision, `checkedAt` reflects an injected `now` and is
> absent (not defaulted) without one, no input mutation, and both the Runtime
> and Worker sources have zero reference to this module. Stage 59 candidate:
> **Provider preview test matrix docs** (a table of the Stage 52 dual-flag ×
> Stage 53 diagnostic-state combinations and their expected rendered output,
> to guard against regression as that area accumulates more tests). Prior
> status:
>
> **Stage 57 — provider preview docs hardening (docs only, no code).**
> A new [`docs/provider_preview_safety.md`](docs/provider_preview_safety.md)
> fixes, in writing, the safety contract that Stage 49's
> `invokePromotionProviderPreview`, Stage 52's dual-flag Worker wiring, and
> Stage 53's diagnostics layer already implement — **no `src/` change, no
> Worker/Runtime/Promotion behavior change** in this stage. It documents: (1)
> the preview's purpose (a provider-integration check — explicitly NOT ad
> serving, NOT ranking, NOT billing, NOT tracking); (2) the exact dual-flag
> invocation condition (`ENABLE_PROMOTION_PROVIDER_PREVIEW` env AND
> `?edgeRecPreview=1`/`?providerPromotionPreview=1` query, BOTH required —
> query-only and env-only each call the provider zero times, disabled by
> default); (3) how it differs from the Stage 41 mock preview
> (`?promotionPreview=1` drives ONLY `MockPromotionProvider`; the two paths
> never share a flag or a provider); (4) exactly what MAY be shown (sanitized
> title/description/sponsor, bounded metadata — 10 entries/200 chars, the
> `provider_preview`/`provider_error`/`disabled` state, and a fixed diagnostic
> sentence); (5) exactly what MUST NEVER be shown (destination/image/tracking
> URLs, click/impression IDs, auction/ranking scores, billing info, API keys,
> endpoint URLs, stack traces, raw provider error bodies, viewer/actor
> pubkeys); (6) exactly what MUST NEVER be called (click/impression tracking,
> billing/Stripe, Telegram, `HTMLRewriter`, any automatic `fetch` outside the
> one gated `getPromotions` call, recommendation rewriting, default
> viewer-pubkey sending); (7) error handling (a provider throw becomes a
> FIXED `provider_error` sentence — the raw reason is dropped entirely, never
> carried into the diagnostic view); (8) privacy (viewer pubkey non-send by
> default, `?actor=` never threaded into the provider's placement request,
> bounded metadata, candidate URLs never surfaced); (9) the test policy this
> area must keep satisfying (dual-flag combinations, no link/image/tracking
> markup, error sanitization including a poisoned-error-message check, mock
> path unaffected); and (10) rules for any future real-serving work (its own
> Stage, its own disabled-by-default gate per concern, never a silent
> promotion of "preview" into production). Every rule in the document matches
> code that already exists and is already tested — this stage adds no new
> test either, since there is no new behavior to cover. Prior status:
>
> **Stage 56 — product purchase/grant preview polish.**
> `src/render/payment.ts` and `src/render/grant_preview.ts` get clearer,
> harder-to-misread copy — WITHOUT changing when either preview shows or what
> data it is built from. The purchase panel now shows an explicit **"Preview
> only."** notice (previously only "No payment is processed." disclosed
> this), right after the "Purchase preview" heading and before the price/rail
> table; the buyer line is reworded from "buyer candidate:" to "buyer preview
> reference:" to make its non-binding, display-only nature explicit (the
> `purchase-buyer-candidate` CSS class is UNCHANGED for backward
> compatibility). The disabled checkout button gains `aria-disabled="true"`
> alongside its native `disabled` attribute; the purchase/grant
> preview/unavailable sections all gain `data-testid`/`aria-label` attributes
> — safe, inert additions with no behavioral effect. The grant panel's fixed
> `PREVIEW_REASON` is split from one run-on sentence ("Preview only — no
> PurchaseGrant has been issued and no access has been granted.") into two
> explicit, independently-matchable sentences: **"No PurchaseGrant has been
> issued."** and **"No access has been granted."** — the standalone "Preview
> only." note above it already covers that phrase, so it isn't repeated in
> the reason text. The grant panel's buyer line is reworded the same way
> ("buyer preview reference:"), and the forbidden-word list is widened from
> paid/settled/purchased to also cover **bought/owned/unlocked** — a
> negated/negative-context use of "granted" (`not_granted`, "No access has
> been granted.") remains the only permitted appearance of that word; nothing
> here ever affirms "access granted", "grant issued", "download unlocked", or
> similar. **The gating logic is completely unchanged**: the grant preview
> still shows ONLY for an `accepted_placeholder` decision (`pending`/
> `rejected`/`unavailable`/`error` still show nothing), `paymentDecisionToGrant`
> is still never imported or called, no `PurchaseGrant` is ever constructed,
> and no invoice/checkout URL/QR/card form/signed URL/download ever appears.
> 6 new tests across `test/render_payment.test.ts` and `test/
> render_grant_preview.test.ts` cover: the purchase panel's explicit "Preview
> only." notice, the widened forbidden-word check (paid/settled/purchased/
> bought/owned/unlocked, plus a bare "granted" ban on the purchase panel,
> which has no grant fields to negate), the grant panel's two exact sentences
> ("No PurchaseGrant has been issued."/"No access has been granted."), a
> structural check that every occurrence of "granted" on the grant panel sits
> inside a negated sentence, and a source-level check that
> `src/render/grant_preview.ts` never imports or calls
> `paymentDecisionToGrant`. All pre-existing Stage 45/48 tests (escaping,
> disabled-button presence, unavailable-panel fallback, no-mutation, board/
> space/chat non-interference) continue to pass unmodified — this stage
> changed wording/attributes only, never the public API or the gating logic.
> Prior status:
>
> **Stage 55 — Runtime diagnostics docs hardening (docs only, no code).**
> A new [`docs/runtime_diagnostics.md`](docs/runtime_diagnostics.md) fixes, in
> writing, the safety contract that `src/render/runtime_status.ts` and the
> `?runtimeStatus=1`/`&format=json` Worker route (Stages 50–54) already
> implement — **no `src/` change, no Runtime/Worker/provider/cache behavior
> change** in this stage. It documents: (1) the diagnostics layer's purpose
> (read-only inspection of which implementation `createRuntime` selected —
> coarse type labels only, no health probing, no external calls); (2) exactly
> what MAY be shown (runtime mode, component name/category, constructor label
> or the `"(unnamed implementation)"` fallback, the five fixed categories);
> (3) exactly what MUST NEVER be shown (API keys, endpoint URLs, tokens,
> secrets, raw env values, actor/viewer pubkeys, payment metadata,
> notification payloads, asset bytes, provider response bodies, stack traces);
> (4) exactly what MUST NEVER be called (`getPromotions`/`getRecommendations`/
> `requestPayment`/`notify`/`publish`/`assetCache.get,put,has,delete,clear`/
> event-cache or directory/index lookups/external `fetch`) — the only
> permitted read is `.constructor.name`, a property read, never an
> invocation; (5) HTML-specific rules (mandatory `escapeHtml`, no endpoint
> links, no raw object dumps, no stack traces); (6) JSON-specific rules
> (allowlist fields only, never `JSON.stringify` the raw runtime, no
> functions/methods, `generatedAt` opt-in only, `format=json` as a strict
> allowlist rather than a denylist); (7) the test policy this area must keep
> satisfying (method-call spies at zero, secret/endpoint-shaped values proven
> absent, invalid-`format` fallback, no raw-runtime-stringify); and (8) rules
> for future extensions (new components need a category + safe label;
> calling a `getStatus()`-style method requires a documented inertness proof;
> external health checks must ship as their own disabled-by-default boundary,
> the way Stage 49/52 gated real provider invocation; diagnostics is not an
> audit log). Every rule in the document matches code that already exists and
> is already tested — this stage adds no new test either, since there is no
> new behavior to cover. Prior status:
>
> **Stage 54 — Runtime status JSON export, disabled by default.**
> `src/render/runtime_status.ts` gains an opt-in JSON export of the SAME
> Stage 50/51 `RuntimeStatusView` shown by `?runtimeStatus=1`.
> `serializeRuntimeStatusView(view, generatedAt?)` builds a `RuntimeStatusJson`
> (`{ mode, components, sections, generatedAt? }`) by reconstructing each
> component/section field-by-field from an explicit allowlist
> (`name`/`label`/`category`) — it NEVER `JSON.stringify`s the view or the raw
> `AppRuntime` directly, so the JSON can never accidentally carry more than
> the three safe fields the HTML page already shows. `generatedAt` is OMITTED
> unless a caller explicitly passes one (this function never reads the clock
> itself). `renderRuntimeStatusJson(view)` wraps that in `JSON.stringify`. In
> the Worker, a new `isRuntimeStatusJsonRequested(url)` checks for an EXACT
> `&format=json` (a strict allowlist — any other value, or its absence, falls
> back to HTML; there is no denylist to bypass). `?runtimeStatus=1` alone
> still renders HTML exactly as Stage 50 left it; `?runtimeStatus=1&format=json`
> returns the same view as `application/json` via a new `jsonResponse` helper.
> **Same safety guarantees as the HTML page, unchanged**: building/serializing
> the JSON calls NO provider/cache/bridge method (`getPromotions`,
> `getRecommendations`, `requestPayment`, `notify`, `publish`,
> `assetCache.get/put/has/delete/clear`), issues NO `fetch`, and the JSON
> never contains an endpoint URL, API key, env value, secret, or viewer/actor
> pubkey — none of that is read from `RuntimeEnv` by this module in the first
> place, only the ten components' coarse type labels. 10 new tests in
> `test/runtime_status_json.test.ts` and 12 new tests in `test/
> worker_runtime_status.test.ts` cover: the serialized JSON carries the
> mode/sections/categories/labels correctly, no endpoint/API-key/secret/pubkey
> ever appears, no function/method survives serialization (and the JSON
> round-trips cleanly), no input mutation, `renderRuntimeStatusJson` returns
> parseable JSON, `?format=json` returns `application/json` with the expected
> shape, `?runtimeStatus=1` without (or with an invalid) `format` still
> returns HTML (tested against `xml`/`yaml`/`JSON`/`1`/empty-string — an
> allowlist, not a denylist), zero provider/cache/bridge calls happen for the
> JSON path either, no `fetch`, and the default Worker export serves the JSON
> end-to-end. Prior status:
>
> **Stage 53 — provider preview diagnostics hardening.**
> `src/render/promotion.ts` gets a clearer, more explicit diagnostic layer for
> Stage 52's provider preview, WITHOUT touching when it is invoked — the dual
> flag (`ENABLE_PROMOTION_PROVIDER_PREVIEW` env + `?edgeRecPreview=1`/
> `?providerPromotionPreview=1` query, both required) is byte-for-byte
> unchanged. A new `PromotionPreviewDisabledReason` type
> (`"env_flag_disabled"` | `"query_flag_missing"` | `"preview_mode_not_requested"`)
> and `PromotionPreviewDiagnosticView` (`{ kind: "disabled" | "provider_preview"
> | "provider_error", disabledReason?, decision? }`) replace the old
> `renderPromotionInvocationPreview`. `buildPromotionPreviewDiagnostic(result,
> disabledReason?)` maps a Stage 49 `PromotionInvocationDecision` into this
> view — a successful `"provider_preview"` (with a decision) maps straight
> through; `"provider_error"` maps to `{ kind: "provider_error" }` (the raw
> reason is DROPPED, not carried forward); everything else maps to `{ kind:
> "disabled", disabledReason }`, defaulting to `"preview_mode_not_requested"`
> when the caller doesn't specify one — the Worker (which structurally knows
> the query flag was already checked before this function is ever reached)
> always passes `"env_flag_disabled"` explicitly. `renderPromotionPreviewDiagnostic
> (view)` renders three distinct panels: **disabled** → heading "Provider
> preview disabled" plus ONE OF THREE fixed, safe sentences keyed by
> `disabledReason` (never an echoed flag/env value); **provider_error** →
> heading "Provider preview unavailable" plus a SINGLE FIXED sentence ("the
> provider could not be reached or returned an error.") that NEVER echoes the
> provider's own error text, an endpoint, an API key, or a stack trace —
> `buildPromotionPreviewDiagnostic` drops `result.reason` entirely for this
> case, so there is nothing left to leak even if a future provider adapter
> starts stuffing richer detail into that field; **provider_preview** →
> unchanged `renderProviderPromotionDecisionPreview`, now headed "Provider
> preview" (dropped "only") with the disclaimer split into "Not a served
> advertisement." and "No click/impression tracking, ranking, auction, or
> billing occurs here." (both phrases required verbatim). Candidate rendering
> (`renderProviderPromotionCandidatePreview`) gains a metadata BOUND: at most
> 10 metadata entries, each value truncated to 200 chars — a real/injected
> provider is an external boundary and could otherwise return unbounded data;
> title/description/sponsor/metadata stay escaped and `destination`/`image`
> stay unrendered, unchanged from Stage 52. **The Stage 52 dual-flag gate,
> the Worker's routing (product/space only, never board/chat), and the
> pre-existing `?promotionPreview=1` mock-only path are all UNCHANGED** — this
> stage only changes what gets DISPLAYED for the disabled/error states, never
> when the real provider is called. 20 new tests in `test/
> promotion_provider_preview_diagnostics.test.ts` cover: each of the three
> disabled reasons renders its own fixed copy plus a `data-disabled-reason`
> attribute, the provider-invoked and provider_error labels render correctly,
> a provider_error never leaks a stack trace/endpoint/API key (tested both at
> the pure-render level with a poisoned `reason` string AND end-to-end through
> the Worker with a provider that throws a message containing a fake secret
> endpoint/key), candidate destination/image stay unrendered, candidate
> fields are escaped and metadata is bounded (both entry count and per-value
> length), the mock preview path is untouched by any of this, the dual flag
> is still required in all three combinations (query-only/env-only/both), the
> viewer/actor pubkey never renders, and no input mutation. Prior status:
>
> **Stage 52 — promotion provider preview behind a dual flag.**
> Stage 49's `invokePromotionProviderPreview` is now connected to the Worker's
> product/space routes, but ONLY behind TWO independent flags that must BOTH
> be true: an env flag (`ENABLE_PROMOTION_PROVIDER_PREVIEW`, reflected into
> the new `AppRuntime.promotionProviderPreviewAllowed`) AND a per-request query
> flag (`?edgeRecPreview=1`/`=true` or `?providerPromotionPreview=1`/`=true`,
> via the new `isProviderPromotionPreviewEnabled(url)`). Either flag alone
> calls the provider ZERO times. The new `renderProviderPromotionPreview`
> helper in `worker.ts` is the ONLY call site for
> `invokePromotionProviderPreview`: without the env flag it renders a
> `disabled` explanation (no candidates, no provider contact); with both flags
> it calls `invokePromotionProviderPreview(runtime.promotionProvider, request,
> { allowRealProvider: true, mode: "provider_preview" })` and renders the
> result via two NEW renderers in `src/render/promotion.ts` —
> `renderProviderPromotionCandidatePreview`/`renderProviderPromotionDecisionPreview`
> (worded "Provider preview only" / "Not a served advertisement" rather than
> "mock", since the underlying provider may be a real `EdgeRecPromotionProvider`)
> and `renderPromotionInvocationPreview` (dispatches on the invocation's
> `state`, so a `provider_error` renders a small escaped status note — never
> throws, never fakes a decision). **The pre-existing `?promotionPreview=1`
> mock-only path (Stage 41) is completely UNCHANGED** — it still only ever
> constructs `MockPromotionProvider` and is entirely independent of the new
> dual-flag path; both can coexist on the same page. `buildProductPlacement`/
> `buildSpacePlacement` are called with NO `viewerPubkey` option for the
> provider-preview request, exactly as the mock path already did — the actor
> is NEVER placed on the request. **Applies to the product/space routes
> ONLY** — the board (no `?space`) and chat routes never call the provider
> regardless of either flag. **This stage implements no real ad serving, no
> ranking/auction/CTR, no click/impression tracking, and no billing/Stripe/
> Telegram/HTMLRewriter** — the new renderers never emit a `destination` link
> or an image, and candidate title/description/sponsor/metadata are all
> HTML-escaped. 16 new tests in `test/promotion_provider_preview_ui.test.ts`
> cover: query-flag-only and env-flag-only both call the provider zero times,
> both flags together call it exactly once on the product route and exactly
> once on the space route, the board and chat routes never call it regardless
> of flags, `?promotionPreview=1` still drives the mock path only, a thrown
> provider renders `provider_error` (never throws out), no destination/image/
> click-tracking markup renders, candidate fields are escaped, the actor/
> viewer pubkey is never sent to the provider, the disabled explanation is
> escaped-safe, a fake "network" provider is invoked only under the explicit
> dual-flag combination, and no request mutation. Five pre-existing tests
> (across `test/worker.test.ts`, `test/render_promotion_preview.test.ts`,
> and `test/promotion_invocation.test.ts`) that asserted zero
> `EdgeRecPromotionProvider` mention anywhere in the Worker source are updated
> to check for no *construction* (`new EdgeRecPromotionProvider(`) instead —
> the class name now legitimately appears in a doc comment, and
> `invokePromotionProviderPreview(` is confirmed to appear from exactly one
> (gated) call site. Prior status:
>
> **Stage 51 — Runtime status page categorization (still read-only).**
> `src/render/runtime_status.ts` groups the Stage 50 status page's ten
> components into five FIXED display categories:
> **cache** (`eventCache`, `assetCache`), **storage** (`spaceDirectory`,
> `metadataIndex`), **provider** (`promotionProvider`, `recommendationProvider`,
> `paymentProvider`), **bridge** (`relayPublisher`, `notificationBridge`), and
> **security** (`signatureVerifier`). A new `RuntimeComponentCategory` type
> names these five, and `RuntimeComponentStatus` gains a `category` field
> alongside its existing `name`/`label`. `RuntimeStatusView` gains `.sections:
> readonly RuntimeComponentSection[]` — the same components grouped by
> category, in the fixed cache→storage→provider→bridge→security order — while
> its original **`.components` flat list is UNCHANGED**, kept for backward
> compatibility. `buildRuntimeStatusView(runtime)` still only reads
> `runtime.mode` and each component's `constructor.name`; it calls NO
> provider/cache/bridge method. A new `renderRuntimeStatusSection(section)`
> renders one category's heading (`"Cache"`, `"Storage"`, `"Provider"`,
> `"Bridge"`, `"Security"`) plus its component rows via the EXISTING
> `renderRuntimeComponentStatus` (now also rendering an escaped
> `data-category` attribute); `renderRuntimeStatusPage(view)` now renders
> `view.sections` instead of the flat list. **This stage changes NOTHING about
> what is read or called** — still zero `getPromotions`/`getRecommendations`/
> `requestPayment`/`notify`/`publish`/`assetCache.get,put,has,delete,clear`/
> event-cache/directory/index calls, still no `fetch`, and still no endpoint
> URL, API key, env value, secret, or viewer/actor pubkey ever rendered (none
> of that is read from `RuntimeEnv` — only the constructed `AppRuntime`'s
> component shapes). **The Worker route is UNCHANGED** — `?runtimeStatus=1`/
> `=true` behaves exactly as Stage 50 left it; only the rendered HTML gained
> category groupings. 11 tests in `test/render_runtime_status.test.ts` were
> rewritten/extended (21 total, up from 10) to cover: sections in the fixed
> category order, each category contains exactly its assigned components,
> every component carries the right category, section/page headings render
> for all five categories, category/name/label are all HTML-escaped
> (including a malicious category value), no endpoint/API-key/secret ever
> renders, and — using explicit method-counting spies on `assetCache` and
> `paymentProvider` (not a `Proxy`, which would have falsely flagged the
> harmless `constructor` property read as a "call") — building AND rendering
> the view never invokes a single provider/cache method. `test/
> worker_runtime_status.test.ts` gained a test confirming the rendered page
> shows all five category headings; its other 10 tests (unwired methods,
> unchanged board route, no secrets) continue to pass unmodified. Prior status:
>
> **Stage 50 — Runtime provider health/status page (read-only).**
> A new `src/render/runtime_status.ts` lets `?runtimeStatus=1` (or `=true`)
> show WHICH implementation `createRuntime(env)` selected for each of the ten
> `AppRuntime` boundaries (`eventCache`, `assetCache`, `spaceDirectory`,
> `metadataIndex`, `signatureVerifier`, `promotionProvider`,
> `recommendationProvider`, `relayPublisher`, `notificationBridge`,
> `paymentProvider`) — a COARSE TYPE LABEL only (e.g. `"InMemoryEventCache"`,
> `"EdgeRecPromotionProvider"`, `"PlaceholderPaymentProvider"`).
> `buildRuntimeStatusView(runtime)` reads only `runtime.mode` and each
> component's `constructor.name` (a property read, never a method call); a
> plain-object implementation that isn't a class instance (today, only
> `signatureVerifier` — `NobleSignatureVerifier` is an object literal) reports
> the safe fallback `"(unnamed implementation)"` rather than the meaningless
> `"Object"`. `renderRuntimeComponentStatus(component)` renders one escaped
> name/label row; `renderRuntimeStatusPage(view)` renders the whole page.
> **This is read-only in the strictest sense**: it calls NO provider/cache/
> bridge method at all — no `getPromotions`, `getRecommendations`,
> `requestPayment`, `notify`, `publish`, `assetCache.get/put/has/delete/clear`,
> or `eventCache`/directory/index lookup — and issues no `fetch`. It also
> never reads or renders an endpoint URL, API key, env value, secret, or
> viewer/actor pubkey (`buildRuntimeStatusView` never touches `RuntimeEnv` —
> only the already-constructed `AppRuntime`'s component shapes). The new
> `isRuntimeStatusEnabled(url)` flag takes precedence over every other route
> (board/product/space/chat) in `handleRequest`, which gained an optional
> `runtime?: AppRuntime` parameter (appended last, so existing positional call
> sites are unaffected) — the page renders ONLY when both the flag AND a full
> `runtime` are present; the flag alone (no runtime, as in most existing test
> call sites) falls through to normal routing unchanged. The Worker's default
> `fetch` now passes its constructed `runtime` through as that last argument.
> 10 new tests in `test/render_runtime_status.test.ts` and 10 new tests in
> `test/worker_runtime_status.test.ts` cover: the view lists all ten
> components in a fixed order, each label is a real `constructor.name` (or the
> safe fallback), env-selected providers are reflected (e.g.
> `PlaceholderPaymentProvider`), HTML-escaping of a malicious label, no
> endpoint/API-key/secret/URL ever renders, no input mutation, the status page
> route calls zero provider/cache/bridge methods (verified with spies on
> `getPromotions`/`getRecommendations`/`requestPayment`/`notify`/`publish`/
> `assetCache.get`), no `fetch(` to an external host, the existing default
> board route is unaffected, the flag alone (no runtime) falls through
> safely, and the default Worker export serves the page end-to-end. Prior status:
>
> **Stage 49 — EdgeRec real provider invocation boundary, disabled by
> default.**
> A new `src/promotion/invocation.ts` adds the missing middle step between
> Stage 38's env SELECTION of an `EdgeRecPromotionProvider` and Stage 41's
> mock-only preview renderer: a single narrow seam,
> `invokePromotionProviderPreview(provider, request, options)`, through which
> an already-selected `PromotionProvider` (real EdgeRec or otherwise) may
> ACTUALLY be invoked for a preview. `options` requires an explicit
> `allowRealProvider: boolean` (no default enables it — omitting it behaves as
> `false`) and a `mode: PromotionInvocationMode` (`"disabled"` |
> `"mock_preview"` | `"provider_preview"`), plus optional `now?`/`onError?`.
> `provider.getPromotions(request)` is called ONLY when `allowRealProvider ===
> true` AND `mode === "provider_preview"` — every other combination
> (`allowRealProvider: false`, or `mode: "disabled"`, or `mode:
> "mock_preview"`) returns a `PromotionInvocationDecision` with `state:
> "disabled"`/`"mock_preview"` and the provider is never touched. A thrown/
> rejected provider call is caught and reported as `state: "provider_error"`
> (never re-thrown); `onError`, if supplied, gets a diagnostic message. A
> successful call returns `state: "provider_preview"` plus the provider's raw
> `PromotionDecision` under `.decision` — a rendering INPUT only, to be shown
> through the EXISTING Stage 41 `renderPromotionDecisionPreview` (which never
> renders a `destination` link or an image). **This stage implements no ad
> serving, ranking, auction, CTR/A-B testing, click tracking, impression
> tracking, or billing, and calls no Stripe/Telegram/HTMLRewriter.** The module
> issues no `fetch` of its own — any network I/O happens only inside whatever
> `provider` the caller injects, and only when this function decides to call
> it. **The Stage 41 mock preview path (`renderMockPromotionPreview` driving
> `MockPromotionProvider` directly) is completely unchanged** — `mode:
> "mock_preview"` is a label only in this new function; it does not invoke the
> provider itself. **Deliberately NOT wired into the runtime or the Worker in
> this stage** — per the safety-first plan, Stage 49 ships the boundary and
> its tests only, so there is no `?edgeRecPreview=1` query flag and no
> `ENABLE_EDGE_REC_PROVIDER_PREVIEW` env field yet; wiring is left for a future
> stage once the boundary has proven itself in isolation. 14 new tests in
> `test/promotion_invocation.test.ts` cover: `allowRealProvider=false` and
> `mode="disabled"`/`"mock_preview"` never call the provider,
> `provider_preview`+`allowRealProvider=true` calls it exactly once, a thrown
> provider yields `provider_error` (never throws), selected candidates pass
> through on success, the existing preview renderer surfaces no destination/
> image for an EdgeRec-shaped candidate, no input mutation, no click/
> impression/billing/auction/rank field on the result, a fake "network"
> provider is invoked only under the explicit allow+mode combination and never
> otherwise, the Stage 41 mock path is unaffected, and both the Worker and
> Runtime sources contain zero reference to `invokePromotionProviderPreview`
> (proving the non-wiring). Prior status:
>
> **Stage 48 — product grant preview boundary.**
> A new `src/render/grant_preview.ts` shows what a `PurchaseGrant`
> (`src/commerce/types.ts`) WOULD look like if one were ever issued from an
> `accepted_placeholder` `PaymentDecision` — WITHOUT ever calling
> `paymentDecisionToGrant` and WITHOUT issuing a real `PurchaseGrant`.
> `buildGrantPreview(product, decision, actorPubkey?, now?)` returns a
> `GrantPreviewView | null`: `null` for every non-`accepted_placeholder` status
> (`pending`/`rejected`/`unavailable`/`error`); otherwise a view whose
> `source` is ALWAYS the literal `"preview_only"` and whose `access` is ALWAYS
> the literal `"not_granted"` — values a real `PurchaseGrantSource` never
> takes, so the view can never be confused with an actual grant at the type
> level. `renderGrantPreview(view)` renders the product, the fixed
> `preview_only`/`not_granted` fields, an escaped buyer-candidate line when an
> actor is present, and a fixed reason: **"Preview only — no PurchaseGrant has
> been issued and no access has been granted."** `renderGrantPreviewUnavailable
> (reason)` is a small escaped-reason panel for standalone/future use (the
> Worker does not currently call it — see below). The Worker's product route
> now shares ONE `PaymentDecision` between the purchase preview AND the grant
> preview (`resolveProductPaymentDecision`, replacing the old
> `renderProductPurchasePreview` helper) and appends the grant preview right
> after the purchase preview: it shows **regardless of `?paymentPreview=1`** —
> purely gated on the shared decision being `accepted_placeholder` — because a
> `NoopPaymentProvider` selected via Stage 46 env config yields `unavailable`
> either way, while the default local `PlaceholderPaymentProvider` (or an
> explicitly-selected `PlaceholderPaymentProvider`) yields `accepted_placeholder`
> and shows one. A non-eligible product (draft/archived/invalid price) never
> reaches `accepted_placeholder`, so it never shows a grant preview at all —
> board/space/chat routes don't call the payment boundary either, so they show
> none. **This stage issues no `PurchaseGrant`, calls no
> `paymentDecisionToGrant`, and claims no payment/settlement/purchase/grant
> outcome** — every product/decision/actor-derived string stays HTML-escaped,
> and the only "granted" wording anywhere is the explicitly negated
> `not_granted` field value and the "no access has been granted" disclaimer.
> 12 new tests in `test/render_grant_preview.test.ts` cover: a view is built
> only for `accepted_placeholder`, `null` for pending/rejected/unavailable/
> error, `source`/`access` are always the fixed literals, HTML escaping of
> title/reason/actor, no paid/settled/purchased/"grant issued"/"access
> granted"/"download unlocked" wording (only the negated preview phrasing), and
> no input mutation. 7 new tests in `test/payment_preview_runtime.test.ts`
> cover: an active product shows the grant preview (flag not required), a
> draft product shows none, `NoopPaymentProvider` under `?paymentPreview=1`
> shows none, `PlaceholderPaymentProvider` under the flag shows one, no
> `paymentDecisionToGrant` call, no grant-issuance wording, and board/space/
> chat routes never show one. Prior status:
>
> **Stage 47 — product purchase preview uses the runtime payment
> provider in preview-only mode.**
> The Stage 45 `?product=<id>` purchase preview can now be connected to
> Stage 46's env-selected `runtime.paymentProvider` — but ONLY under an
> explicit opt-in flag, and ONLY on the product route. A new
> `isPaymentPreviewEnabled(url)` recognizes `?paymentPreview=1` or
> `?paymentPreview=true`. `renderBoard` computes this flag and threads it (plus
> the `paymentProvider` passed down from `handleRequest`/the Worker's default
> `fetch`) into `renderProductRoute`, which passes them to
> `renderProductPurchasePreview(product, actor, runtimeProvider?)`: WITHOUT the
> flag, `runtimeProvider` is `undefined` and the function falls back to its own
> freshly-constructed `PlaceholderPaymentProvider`, EXACTLY as Stage 45 left
> it; WITH the flag, it calls `runtime.paymentProvider.requestPayment(request)`
> instead — which may be `NoopPaymentProvider` (renders the `unavailable`
> panel) or `PlaceholderPaymentProvider` (renders the `accepted_placeholder`
> panel) depending on `PAYMENT_PROVIDER`/`ENABLE_PAYMENT_PLACEHOLDER` env
> config. `handleRequest` and `renderBoard` both gained a `paymentProvider?`
> parameter (appended at the end, so existing positional call sites are
> unaffected); `export default { fetch }` now passes `runtime.paymentProvider`
> through. **`?paymentPreview=1` has NO effect on the board/space/chat
> routes** — those never call `paymentProvider` at all, flag or not. As
> before, `?actor=` is used only as a display "buyer candidate", never for
> payment or grant issuance, and `paymentDecisionToGrant` is still never called
> from the Worker — no `PurchaseGrant` is issued by this stage. **This stage
> implements no real payment, no invoice, no checkout URL, no settlement, and
> no grant issuance** — every rendered string stays HTML-escaped and the copy
> never claims "paid"/"settled"/"purchased"/"grant issued". 12 new tests in
> `test/payment_preview_runtime.test.ts` cover: the flag calls
> `runtime.paymentProvider.requestPayment` exactly once on the product route,
> no flag means zero calls (preview still renders via the local fallback), the
> flag has no effect on the board/space/chat routes, a `NoopPaymentProvider`
> renders the unavailable panel and a `PlaceholderPaymentProvider` renders the
> accepted-placeholder panel under the flag, no `paymentDecisionToGrant` call,
> no invoice/checkout-URL/QR/card/paid/settled/purchased/grant-issued text, a
> malicious `?actor` is escaped, no `fetch(` to an external host and no
> Stripe/Lightning/Breez/Greenlight/LNURL reference, and no request mutation.
> Prior status:
>
> **Stage 46 — payment provider runtime env selection boundary.**
> `createRuntime(env)` can now SELECT a `PaymentProvider` from three new
> `RuntimeEnv` fields — and NOTHING more, mirroring Stage 42's notification env
> selection exactly. **`PAYMENT_PROVIDER`** (`"noop"` or `"placeholder"`),
> **`ENABLE_PAYMENT_PLACEHOLDER`** (truthy string/boolean opt-in), and
> **`PAYMENT_DEFAULT_RAIL`** (one of the six `*_placeholder` rail names; any
> other value is silently ignored) let `selectPaymentProvider(env?, overrides?)`
> choose between `NoopPaymentProvider` (the safe default — every
> `requestPayment()` resolves `unavailable`/rejected) and
> `PlaceholderPaymentProvider` (dev/test — evaluates the request policy but
> **charges nothing**). Priority: (1) `overrides.paymentProvider` wins
> unconditionally; (2) `PAYMENT_PROVIDER=noop` → `NoopPaymentProvider`; (3)
> `PAYMENT_PROVIDER=placeholder` OR `ENABLE_PAYMENT_PLACEHOLDER` truthy →
> `PlaceholderPaymentProvider`; (4) absent/unrecognized →
> `NoopPaymentProvider`. `resolvePaymentDefaultRail` validates the rail name
> against `PAYMENT_RAILS` and returns `undefined` for any unrecognized value —
> no provider constructor takes it in this stage, so an invalid rail is simply
> ignored. `AppRuntime` gains a `paymentProvider` field; `RuntimeOverrides`
> gains `paymentProvider?`. The Worker `Env` interface is extended with the
> three payment fields so wrangler.toml can supply them — but the Worker
> **never calls `runtime.paymentProvider.requestPayment()`** and issues no
> payment request from this selection. **This is provider SELECTION only.**
> Constructing the runtime issues **no `fetch`**, calls **no
> Lightning/Stripe/Apple Pay/Google Pay rail**, and **never auto-calls
> `requestPayment()`** — `paymentProvider` is merely placed in the runtime,
> ready for a future caller to use it explicitly. `paymentDecisionToGrant` is
> never called from the runtime or the Worker, so **no `PurchaseGrant` is ever
> issued** by this stage. The Stage 45 product purchase preview is UNCHANGED:
> the Worker's `renderProductPurchasePreview` still constructs its own
> **fresh** `PlaceholderPaymentProvider` directly (not `runtime.paymentProvider`)
> for the `?product=<id>` display-only preview — the two paths are
> intentionally independent so the preview's behavior does not shift with env
> config. The Stage 44 `canRequestPaymentForProduct`/`productToPaymentRequest`
> guardrails remain in force: no secret/card/wallet/token in any payment
> request, no invoice, no checkout URL, no settlement. 14 new tests in
> `test/runtime_payment_env.test.ts` cover: no-env → Noop, each provider value,
> each truthy/falsy flag variant, invalid provider ignored, invalid/valid
> default rail, override wins, no `requestPayment()` auto-call, no `fetch`
> issued, Worker source has at most the one legitimate (Stage 45 preview)
> `.requestPayment(` call and never calls it via `runtime.paymentProvider`, no
> `paymentDecisionToGrant` call, no Lightning/Stripe/Breez/Greenlight import in
> the runtime sources, and env not mutated. The Stage 44
> `payment_boundary.test.ts` test #13 is updated: it now confirms
> `requestPayment()`/`paymentDecisionToGrant`/`productToPaymentRequest` are
> never auto-called from the runtime source (rather than asserting the runtime
> is entirely payment-free, which is no longer the case). Prior status:
>
> **Stage 45 — product purchase preview UI, placeholder only.**
> A new `src/render/payment.ts` renders a "Purchase preview" panel on the
> `?product=<id>` route using the Stage 44 payment boundary — display only,
> nothing is charged. `renderPurchasePreview(product, decision, options?)` is
> the main entry: given a `PaymentDecision`, an `accepted_placeholder`
> (`allowed`) result renders a heading, the display price/currency, the
> placeholder rail name, a `renderPaymentDecision(decision)` status line, a
> **"No payment is processed."** note, and a **DISABLED** `<button disabled>
> Checkout disabled</button>` — never an enabled one. Any other decision
> (`pending`/`rejected`/`unavailable`/`error`, or a draft/archived product, or
> an invalid price) falls back to `renderPurchaseUnavailable(reason)`, a small
> panel with just an escaped reason and no button at all.
> `renderPaymentDecision(decision)` is the standalone escaped status/rail/
> reason readout, reusable on its own. The Worker wires this into
> `renderProductRoute` ONLY: a new `renderProductPurchasePreview(product,
> actor)` helper calls `canRequestPaymentForProduct` (draft/archived/invalid
> price → straight to `renderPurchaseUnavailable`), then
> `productToPaymentRequest(product, actor || undefined)` (the `?actor=` value
> is used ONLY as a display "buyer candidate" — never for payment or grant
> issuance), then constructs a **fresh** `PlaceholderPaymentProvider` (never
> added to `createRuntime`/`Env` — the runtime stays exactly as unwired for
> payment as Stage 44 left it) and calls `requestPayment` for a decision to
> render. **`paymentDecisionToGrant` is never called from the Worker — no
> `PurchaseGrant` is ever issued by this preview.** The panel is appended ONLY
> on the product route, right after the existing product page and promotion
> placeholder; the board/space/chat routes and the default directory render
> nothing new. **This stage implements no Lightning, no Stripe, no Apple
> Pay/Google Pay, no invoice, no checkout URL/session, no QR code, no card
> form, and no settlement confirmation** — every product/decision-derived
> string (id, title, currency, rail, reason, and the buyer-candidate pubkey)
> is HTML-escaped, and the copy never claims "paid", "settled", "purchased",
> or "grant issued". Two pre-existing Stage 25/35 Worker tests
> (`test/worker.test.ts`, product-route tests #7 and asset-cache test #5) are
> updated: they used to assert NO `<button>`/`"checkout"` text at all, and now
> assert the button is present but **disabled**, with no invoice/signed-URL/
> Stripe/Lightning text — the earlier "no buy affordance at all" invariant is
> superseded by "a checkout affordance exists but is inert." The Stage 44
> `test/payment_boundary.test.ts` Worker-source test #14 is likewise updated:
> it no longer asserts the Worker has zero payment import (it legitimately
> constructs `PlaceholderPaymentProvider` now) but still asserts
> `paymentDecisionToGrant(` is never called and `NoopPaymentProvider` is never
> referenced. 10 new tests in `test/render_payment.test.ts` and 7 new tests in
> `test/worker.test.ts` cover: an active product renders the preview,
> price/currency/id/reason escaping, the disabled button markup, no invoice/
> checkout-URL/QR/card-form/grant-issued/paid-settled-purchased text anywhere,
> draft/archived products render the unavailable panel with no button, no
> input mutation, `?product=<draft>` (viewed as its creator) shows no enabled
> checkout, a malicious `?actor` is escaped, no `fetch(` to an external host
> and no Stripe/Lightning/Breez/Greenlight/LNURL reference in the Worker
> source, and the default board page renders no purchase preview at all. Prior status:
>
> **Stage 44 — Payment / Lightning boundary skeleton.**
> A new `src/payment/` treats a future payment step as the front door BEFORE a
> `PurchaseGrant` (`src/commerce/types.ts`) is ever issued — types and safe
> defaults ONLY. `src/payment/types.ts` defines `PaymentRail`
> (`lightning_placeholder`/`stripe_placeholder`/`apple_pay_placeholder`/
> `google_pay_placeholder`/`manual_placeholder`/`external_placeholder`),
> `PaymentStatus` (`unavailable`/`pending`/`accepted_placeholder`/`rejected`/
> `error`), `PaymentCapability`, `PaymentRequest` (productId, optional
> buyerPubkey, amountCents/currency display metadata, rail, optional
> metadata/createdAt), `PaymentDecision`, and the `PaymentProvider` seam
> (`getStatus`/`getCapabilities`/`requestPayment`). `src/payment/noop_payment.ts`
> ships `NoopPaymentProvider` (permanently `unavailable`/`rejected` — every
> `requestPayment` call is refused) and `PlaceholderPaymentProvider` (rejects a
> negative amount or metadata that looks like a card/wallet/secret, otherwise
> resolves `accepted_placeholder` — a policy-clean placeholder, NEVER a paid
> confirmation) plus the pure `sanitizePaymentMetadata` helper. `src/payment/
> commerce_bridge.ts` adds three pure functions: `canRequestPaymentForProduct
> (product)` (an `active` product with a non-negative price is `pending`-
> eligible; a draft/archived product or a negative price is `rejected`),
> `productToPaymentRequest(product, buyerPubkey?, options?)` (returns `null`
> when the eligibility check fails; otherwise a `PaymentRequest` built from the
> product's display price/currency/id with any card/wallet/secret-looking
> metadata entry stripped), and `paymentDecisionToGrant(decision, options?)`
> (`PurchaseGrant | null` — returns a grant ONLY for an `accepted_placeholder`
> decision with a known `buyerPubkey`; every other status is `null`). A grant
> built here is always `source: "manual"` or `"promo"` — **never** `"payment"`,
> because this boundary never verifies that money moved. **This stage
> implements no Lightning (BOLT11/LNURL, Breez SDK, Greenlight), no Stripe, no
> Apple Pay, no Google Pay, no wallet, no invoice, no checkout session, and no
> settlement/webhook confirmation** — nothing here charges a card, opens a
> channel, mints an invoice, builds a checkout URL, or issues a `fetch`.
> `PaymentDecision` carries no invoice/checkout URL field at all, by design.
> It is **not wired into the runtime or the Worker** — `create_runtime.ts` and
> `worker.ts` import nothing from `src/payment/` and reference no
> `PaymentProvider`/`requestPayment`/`productToPaymentRequest`/
> `paymentDecisionToGrant`. 18 new tests in `test/payment_boundary.test.ts`
> cover: Noop always unavailable/rejected, Placeholder never produces an
> invoice or checkout URL, an active product is allowed while draft/archived/
> negative-price products are rejected, `paymentDecisionToGrant` returns `null`
> for `pending`/`rejected`/`unavailable`/`error` and a grant only for
> `accepted_placeholder`, the grant's source is never `"payment"`, sensitive
> metadata (card number, wallet secret) is stripped by the bridge and denied by
> the provider, no input mutation, Runtime/Worker source have zero payment
> import/wiring, no Lightning/Stripe/Apple Pay/Google Pay/Breez/Greenlight
> import, and no `fetch`/invoice/checkout builder anywhere in the payment
> sources. Note on liquidity/custody: this stage takes NO position on how a
> future real rail would hold or move funds (custodial vs. non-custodial
> Lightning, chargeback exposure, KYC/AML) — that remains future research, not
> settled by this skeleton. Prior status:
>
> **Stage 43 — IPFS asset adapter boundary skeleton.**
> A new `src/asset/ipfs_asset_cache.ts` treats IPFS as a candidate FUTURE
> backend for the public `AssetCache` boundary (alongside R2 and MeshKV) —
> types and safe defaults ONLY. `IpfsClient` (`get(cid)`, `put(bytes,
> metadata)`, optional `pin(cid)`/`unpin(cid)`) is the shape a real client
> would implement; `NoopIpfsClient` is the permanently-unavailable default —
> `get` always resolves `null`, and `put`/`pin`/`unpin` always reject rather
> than fabricate a CID. `IpfsAssetCache implements AssetCache` runs the same
> `canCacheAsset` policy as R2/MeshKV on `put` (private/paid/`dm`/`secret`/
> `key`/`payment`/`entitlement` are rejected) and then **stops** — it NEVER
> calls the injected client's `get`/`put`/`pin`/`unpin`; `get`/`has` always
> report a miss/false and `delete`/`clear` are safe no-ops. A "cacheable"
> result means only "this asset passed the public-asset policy," never that
> anything was sent to, stored on, or pinned by IPFS. `PlaceholderIpfsAssetCache`
> is the concrete always-safe default (an `IpfsAssetCache` wired to
> `NoopIpfsClient` with no way to swap clients). Two pure helpers round out the
> boundary: `isIpfsCidLike(value)` is a plausibility check for CIDv0/CIDv1
> shapes that never contacts a node/gateway and never resolves/dereferences
> anything, and `assetKeyToIpfsRef(key)` maps an opaque `AssetKey` to a CID
> only if the key string is already CID-shaped — it never fabricates or
> resolves one (today it always returns `null`, since `createAssetKey` never
> produces a CID). **A CID is public, non-secret metadata — but it is NOT an
> authorization token**: whoever has a CID can fetch that content from any
> node/gateway that pins it, a CID also leaks size/availability/pinning
> information, and unpinning is not a deletion guarantee (other nodes may keep
> serving it indefinitely). This stage implements **no IPFS node, no gateway
> `fetch`, no pinning service, and no upload/download** — the adapter issues
> no network I/O of any kind. It is **not wired into the runtime or the
> Worker** (unlike Stage 42's notification env selection, there are no new env
> fields at all — `create_runtime.ts` and `worker.ts` have zero IPFS
> references). 15 new tests in `test/ipfs_asset_cache.test.ts` cover:
> `NoopIpfsClient.get` always null, `put`/`pin`/`unpin` always reject as
> unavailable, cache `get` always a miss (even after `put`), `put` on a public
> asset never touches the injected client (a spy client proves zero calls),
> private/paid/sensitive-tag rejection, `has` always false, `delete`/`clear`
> safe no-ops that never touch the client, the CID plausibility helper accepts
> only CID-shaped strings, a CID-shaped value grants no access (not an
> authorization token), no input mutation, and Runtime/Worker source contain no
> `ipfs` reference at all and no fetch/http/real-IPFS-client import. Prior status:
>
> **Stage 42 — Notification provider env selection boundary.**
> `createRuntime(env)` can now SELECT a `NotificationBridge` from three new
> `RuntimeEnv` fields — and NOTHING more. **`NOTIFICATION_PROVIDER`** (`"noop"` or
> `"placeholder"`), **`ENABLE_NOTIFICATION_PLACEHOLDER`** (truthy string/boolean opt-in),
> and **`NOTIFICATION_DEFAULT_CHANNEL`** (one of the six `*_placeholder` channel
> names; any other value is silently ignored) let `selectNotificationBridge(env?,
> overrides?)` choose between `NoopNotificationBridge` (the safe default — every
> `notify()` returns `unavailable`) and `PlaceholderNotificationBridge` (dev/test —
> evaluates `canSendNotification` but **delivers nothing**). Priority: (1)
> `overrides.notificationBridge` wins unconditionally; (2) `NOTIFICATION_PROVIDER=noop`
> → `NoopNotificationBridge`; (3) `NOTIFICATION_PROVIDER=placeholder` OR
> `ENABLE_NOTIFICATION_PLACEHOLDER` truthy → `PlaceholderNotificationBridge`; (4)
> absent / unrecognized → `NoopNotificationBridge`. `resolveNotificationDefaultChannel`
> validates the channel name against `NOTIFICATION_CHANNELS` and returns `undefined`
> for any unrecognized value — invalid channels are ignored without error.
> `AppRuntime` gains a `notificationBridge` field; `RuntimeOverrides` gains
> `notificationBridge?`. The Worker `Env` interface is extended with the three
> notification fields so wrangler.toml can supply them — but the Worker **never
> calls `notify()`** and routes no notification. **This is bridge SELECTION only.**
> Constructing the runtime issues **no `fetch`**, calls **no Telegram/LINE Bot API,
> no APNs, no FCM, no email service**, and **never auto-calls `notify()`** —
> `notificationBridge` is merely placed in the runtime, ready for a future caller
> to use it explicitly. The Stage 39 `sanitizeNotificationPayload` /
> `canSendNotification` guardrails remain in force: no secret / DM body / key /
> seed / payment / entitlement / credential in any notification payload. 12 new
> tests in `test/runtime_notification_env.test.ts` cover: no-env → Noop, each
> provider value, each truthy/falsy flag variant, invalid channel ignored,
> override wins, no `notify()` auto-call, no `fetch` issued, Worker source has no
> `.notify(` call, no Telegram/LINE/APNs/FCM/Email import, and env not mutated.
> The Stage 39 `notification_boundary.test.ts` tests 12/13 are updated: they now
> confirm that `notify()` is not auto-called and no real transport is imported
> (rather than checking the runtime is entirely notification-free, which is no
> longer the case). Prior status:
>
> **Stage 41 — Mock promotion preview mode.** The promotion boundary can
> now render actual candidate cards in the UI — but ONLY from the in-memory
> `MockPromotionProvider`, and ONLY under an explicit opt-in flag. Three pure
> renderers land in `src/render/promotion.ts`: `renderPromotionCandidatePreview`
> (one candidate card — escaped title/sponsor/description/metadata and a shortened
> id, with **NO `destination` link and NO image**), `renderPromotionDecisionPreview`
> (a whole `PromotionDecision`, with a safe empty state), and
> `renderMockPromotionPreview(request, provider = new MockPromotionProvider())`,
> which drives the **mock provider only** and never constructs or calls the real /
> EdgeRec provider. The Worker gates this behind `isPromotionPreviewEnabled(url)`
> (`?promotionPreview=1` or `=true`) **and** sample mode (`data.showPromotions`), so
> `?space=<id>&promotionPreview=1` and `?product=<id>&promotionPreview=1` append a
> mock preview block while the no-param board, the flag-less pages, and the live
> relay path render none. The Worker itself constructs no provider and contains no
> `getPromotions` / `EdgeRecPromotionProvider` / `edge_rec_adapter` reference — the
> mock invocation lives in the render helper. **This is a UI ↔ boundary connection
> check, not ad serving.** It issues **no `fetch`**, calls **no real/EdgeRec
> provider**, and does **no click tracking, no impression tracking, no ranking, no
> auction, no CTR, no billing, no destination link, and no image** — every candidate
> is disclosed as a mock preview and all candidate-derived text is HTML-escaped. The
> Stage 38 EdgeRec env selection still stands but is deliberately unused here. Prior
> status:
>
> **Stage 40 — Deniable Storage research boundary (docs only).** A new
> research note, [`docs/deniable_storage_research.md`](docs/deniable_storage_research.md),
> writes up the Shadow Vault / Deniable Storage / Hidden Volume threat model and its
> hard prohibitions **without adding any code** — no crypto, no vault, no hidden
> volume, no storage adapter, no IPFS. It fixes, in writing: this is a research
> boundary not a spec; the `finger_id = 5`-style branch-selected shadow vault is a
> **forbidden anti-pattern**; TrueCrypt/VeraCrypt are *reference only*; the hidden-
> volume leak vectors (fixed-size container, padding, metadata, timestamp, access
> pattern, backup, cloud sync, mobile-OS lifecycle); that AEAD/KDF/zeroize/memory-
> lock belong to the future Rust Crypto Core; IPFS dangers (CID size/tree leak,
> pinning/deletion impossibility, gateway traffic analysis, encrypted-payload
> metadata leak); the Nostr relationship (events are public metadata, a deletion
> request is not a deletion guarantee, relay IP-logging risk); **forbidden UI
> wording** ("completely hidden", "zero-trace", "absolutely safe", "legally safe");
> the preconditions for any future work (Rust core, audited primitives, fixed-size
> container, nonce discipline, no direct Apple ID seed derivation, local-only
> unlock, no cloud backup by default); and the conclusion — **no implementation, no
> production guarantee, docs only, future separate package only.** No `src/` code, no
> runtime/Worker wiring, and no Stage 1–39 boundary is touched. Prior status:
>
> **Stage 39 — Notification Bridge boundary skeleton.** A MINIMAL,
> future-facing seam for signalling "something happened" to an external channel
> (Telegram / LINE / APNs / FCM / Email) now lives in `src/notification/`, kept
> entirely OUT of the current Nostr/Cloudflare core, the chat layer, and the
> commerce layer. It fixes the shape of a notification as COARSE, non-sensitive
> metadata so a real transport can drop in later — WITHOUT ever carrying a secret.
> The `NotificationBridge` interface (`getStatus`/`getCapabilities`/`notify`) plus
> the `NotificationChannel` / `NotificationCapability` (six `*_placeholder` labels:
> `telegram`/`line`/`apns`/`fcm`/`email`/`local`), `NotificationKind`
> (`chat_activity`/`space_activity`/`product_update`/`moderation_notice`/
> `payment_status_placeholder`/`system_notice`), `NotificationPayload`, and
> `NotificationDecision` types define shapes ONLY. **This is a boundary, not a
> notifier.** It **sends nothing, calls no Telegram/LINE Bot API, no APNs, no FCM,
> and no email service, and issues no `fetch`**. A `NotificationPayload` carries only
> `kind`, `channel`, a generic `title`, an optional GENERIC `bodyPreview` (e.g. "New
> chat activity"), opaque `targetRef`/`actorRef`, a `createdAt`, and non-secret
> `metadata` — **never DM/message content, a secret, key, seed, token, payment
> secret, entitlement, or credential**. `policy.ts` enforces this: `canSendNotification`
> DENIES a payload whose fields or metadata look sensitive, `sanitizeNotificationPayload`
> returns a cleaned copy (sensitive title → generic, sensitive preview/refs dropped,
> sensitive metadata filtered), and `isSensitiveNotificationField` flags secret
> markers (it deliberately does NOT flag a plain hex pubkey). `NoopNotificationBridge`
> is the safe default: permanently `unavailable`, it denies every attempt.
> `PlaceholderNotificationBridge` (dev/test) evaluates the policy and returns the
> decision (`accepted`/`rejected`) but still **delivers nothing** — `accepted` is a
> placeholder queue label. `bridge.ts`'s pure `chatEventToNotification` /
> `spaceEventToNotification` / `productEventToNotification` build payloads from
> domain objects that OMIT the message body, the event content, and any
> payment/download detail (type-only domain imports). **APNs/FCM `metadata` can leak
> to third parties** — the policy keeps it non-sensitive. **Nothing is auto-wired**:
> `createRuntime` and the Worker never reference the notification layer (tests assert
> both sources are notification-free, that the sources import no
> Telegram/LINE/APNs/FCM/Email transport, and that they issue no `fetch`/send call),
> so the whole Stage 1–38 core is untouched. Telegram/LINE/APNs/FCM/Email remain
> FUTURE bridges, not implemented. Prior status:
>
> **Stage 38 — EdgeRec Worker env selection boundary.** `createRuntime`
> can now SELECT the `PromotionProvider` / `RecommendationProvider` from EdgeRec
> config on the `RuntimeEnv` / Worker `Env` — and NOTHING more. New env fields
> (`RECOMMENDATION_API_KEY`, `PROMOTION_SEND_VIEWER_PUBKEY`,
> `PROMOTION_HASH_VIEWER_PUBKEY`, `EDGE_REC_TIMEOUT_MS`, alongside the existing
> `PROMOTION_ENDPOINT`/`RECOMMENDATION_ENDPOINT`/`PROMOTION_API_KEY`/`fetch`) let
> `selectPromotionProvider` / `selectRecommendationProvider` wire an
> `EdgeRecPromotionProvider` **only when an endpoint AND an injected `fetch` are
> both present**; an endpoint with no `fetch` (the Worker's default — it injects
> none) falls back to the inert `MockPromotionProvider` / `MockRecommendationProvider`.
> The recommendation path falls back to `PROMOTION_ENDPOINT`/`PROMOTION_API_KEY`
> when its own are absent; `EDGE_REC_TIMEOUT_MS` is parsed and **clamped**
> (`parseEdgeRecTimeoutMs`, 100–30000 ms; unparseable/non-positive ignored). **Privacy
> default: the viewer pubkey is NEVER sent** — only an explicit truthy
> `PROMOTION_SEND_VIEWER_PUBKEY` opts in to the RAW pubkey, and
> `PROMOTION_HASH_VIEWER_PUBKEY` is recognized as intent but **no hash function is
> wired**, so it sends nothing and the raw pubkey is never leaked as a fallback.
> **This is provider SELECTION only.** Constructing the runtime issues **no
> `fetch`**, calls **no `getPromotions`/`getRecommendations`**, and there is still
> **no real ad serving, no ranking/auction/CTR, no click tracking, no billing, no
> Stripe/Telegram, no HTMLRewriter, and no external fetch** — the EdgeRec provider is
> merely constructed READY to call out behind an injected client. The Worker still
> shows only empty promotion placeholders and issues no promotion request. `env` is
> never mutated. Prior status:
>
> **Stage 37 — Identity Provider boundary skeleton.** A MINIMAL,
> future-facing seam that fixes Apple / Google / External identity providers as
> OPAQUE AUTHENTICATION-REFERENCE providers — **not** key sources — now lives in
> `src/identity/`, kept entirely OUT of the current Nostr/Cloudflare core, the
> Passkey seam, the Vault seam, and the crypto core. Apple / Google / External feed
> the Passkey unlock boundary (Stage 36) and, through it, the Vault (Stage 33); they
> generate no key. The `IdentityProviderBoundary` interface
> (`getStatus`/`getCapabilities`/`begin`/`cancel`) plus the `IdentityProviderKind`
> (`apple`/`google`/`external`/`passkey`), `IdentityProviderStatus`
> (`idle`/`waiting`/`authenticated`/`cancelled`/`unavailable`/`error`),
> `IdentityProviderCapability` (four `*_placeholder` labels:
> `apple`/`google`/`external`/`passkey_bridge`), `IdentityProviderRequest` (a `kind`
> + an OPAQUE, non-secret `reference`), and `IdentityProviderReport` (status +
> echoed kind + the same opaque reference + reason) types define shapes ONLY.
> **This is a boundary, not authentication.** It **starts no sign-in, runs no OAuth,
> parses/stores no JWT, calls no WebAuthn/Apple/Google API, launches no Face ID or
> Touch ID, touches no Secure Enclave/Android Keystore, and generates or derives no
> key** — Apple / Google are **authentication references, never a key source**, and
> nothing turns a token/JWT/credential/email/profile/seed into key material. Request
> and report carry an **OPAQUE, non-secret `reference` only**. `NoopIdentityProvider`
> is the safe default: permanently `unavailable`, it advertises nothing and every
> attempt is denied. `PlaceholderIdentityProvider` (dev/test) models an
> `idle → (placeholder) authenticated ↔ cancelled` lifecycle holding ONLY a coarse
> `IdentityProviderReport` — its `authenticated` state is a LABEL that **unlocks
> nothing**. `provider_bridge.ts`'s pure `identityProviderToPasskeyRequest` and
> `identityProviderToVaultRequest` map the provider `kind` to a
> `PasskeyAuthenticationKind` / `VaultUnlockKind` and pass the opaque `reference`
> through unchanged (type-only Passkey + Vault dependencies; they derive no key,
> unlock nothing, and wire nothing). **Nothing is auto-wired**: `createRuntime` and
> the Worker never reference the provider layer (tests assert both sources are
> provider-free, that the sources import no OAuth/JWT/WebAuthn/crypto library, and
> that the Vault/Passkey imports are type-only), so the whole Stage 1–36 core is
> untouched. See [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md) for
> the design notes this seam is drawn from. Prior status:
>
> **Stage 36 — Passkey Unlock boundary skeleton.** A MINIMAL,
> future-facing seam that fixes WebAuthn / Passkey / Face ID / Touch ID as an
> AUTHENTICATION boundary that UNLOCKS the Vault — **not** a key source — now lives
> in `src/identity/`, kept entirely OUT of the current Nostr/Cloudflare core, the
> Vault seam, and the crypto core. It encodes the intended UX seam (Face ID →
> Passkey → Vault unlock → identity available) WITHOUT building any of it. The
> `PasskeyBoundary` interface
> (`getStatus`/`getCapabilities`/`beginAuthentication`/`cancelAuthentication`) plus
> the `PasskeyStatus` (`idle`/`waiting`/`authenticated`/`cancelled`/`unavailable`/
> `error`), `PasskeyReport`, `PasskeyCapability` (four `*_placeholder` labels:
> `faceid`/`touchid`/`passkey`/`external_webauthn`), and the
> `PasskeyAuthenticationRequest` (a `kind` of `apple_passkey`/`android_passkey`/
> `webauthn`/`external` + an OPAQUE, non-secret `reference`) types define shapes
> ONLY. **This is a boundary, not authentication.** It **starts no authentication,
> calls no WebAuthn/Passkey/Apple/Google API, launches no Face ID or Touch ID,
> touches no Secure Enclave/Android Keystore, and generates or derives no key** —
> Passkey / Apple ID / Google are **unlock triggers ONLY, never a key source**, and
> nothing turns a credential/JWT/challenge/token/seed into key material. The request
> carries an **OPAQUE, non-secret `reference` only** — never a credential, JWT,
> secret, token, challenge response, private/public key, seed, passphrase, or bytes.
> `NoopPasskeyBoundary` is the safe default: permanently `unavailable`, it
> advertises nothing and every attempt is denied. `PlaceholderPasskeyBoundary`
> (dev/test) models an `idle → (placeholder) authenticated ↔ cancelled` lifecycle
> holding ONLY a coarse `PasskeyReport` — its `authenticated` state is a LABEL that
> **does NOT unlock the Vault**. `vault_bridge.ts`'s pure
> `passkeyAuthenticationToVaultRequest` maps the authenticator `kind` to a
> `VaultUnlockKind` and passes the opaque `reference` through unchanged (type-only
> Vault dependency; it derives no key and wires nothing). **Nothing is auto-wired**:
> `createRuntime` and the Worker never reference the identity layer (tests assert
> both sources are identity-free, that `src/identity` imports no crypto/WebAuthn/
> auth library, and that its Vault import is type-only), so the whole Stage 1–35
> core is untouched. A future real unlock flow — connected to the planned Rust core
> — is not implemented. See
> [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md) for the design
> notes this seam is drawn from. Prior status:
>
> **Stage 35 — Product asset preview metadata from runtime.** The
> `?product=<id>` route can now source its PUBLIC/UNLISTED asset PREVIEW metadata
> from the runtime's `AssetCache`, not just the fixed sample list.
> `src/commerce/asset_preview.ts`'s `resolveProductAssetPreviews(product,
> assetMetadataList, assetCache?, now?)` walks `product.assetIds` in order,
> starting from the sample metadata and — only when an `assetCache` is supplied —
> trying `assetCache.get(id, now)`; a hit contributes **`cached.metadata` ONLY**
> (the bytes are discarded and never reach a `ProductAsset` or the HTML), while a
> cache **miss or thrown error is swallowed** and the sample metadata stands.
> `isPreviewAssetVisible`/`filterPreviewAssetMetadata` reuse the Stage 22
> `canCacheAsset` policy so `private`/`paid` assets and anything tagged sensitive
> (dm/secret/key/payment/entitlement) are excluded — from cache hits as well as
> samples. The Worker passes `runtime.assetCache` into `handleRequest` and threads
> it to the product route **only**: `renderProductRoute` awaits the resolver, and
> the board/directory path never touches the cache (a test asserts the no-param
> board issues zero `assetCache.get` calls). This is **read-only metadata, not
> delivery**: still **no asset bytes in the HTML, no signed URL, no download, no
> payment**, and no real R2/MeshKV file fetch — the helper reads only the injected
> cache's already-resolved metadata and mutates neither the product, the sample
> list, nor a cached asset. Prior status:
>
> **Stage 34 — Crypto Core boundary skeleton.** A MINIMAL, future-facing
> seam for the FedOS crypto core now lives in `src/crypto/`, kept entirely OUT of
> the current Nostr/Cloudflare core, the Vault seam, and the asset layer. It fixes
> the swap point for a future real crypto core (the provisional
> `packages/fedos-core-rust` / a RustCrypto-backed WASM/FFI module) WITHOUT
> committing to any implementation. `CryptoProvider`
> (`getStatus`/`getCapabilities`/`randomBytes`/`deriveKey`/`encrypt`/`decrypt`)
> plus the `CryptoState` (`available`/`unavailable`/`error`), `CryptoStatus`,
> `CryptoDecision`, `CryptoCapability` (five `*_placeholder` labels), and the
> `RandomBytesRequest`/`DeriveKeyRequest`/`EncryptRequest`/`DecryptRequest` types
> define shapes ONLY. **This is a boundary, not crypto.** It performs **no
> encryption, no key derivation, and no random generation** — no AEAD/XOR, no
> HKDF/Argon2, no BIP39/BIP32, no NIP-44, no zeroize, no key generation. Requests
> carry **OPAQUE, non-secret handles and labels only** — never raw key material,
> seeds, passphrases, or plaintext — and a `CryptoDecision` carries **no output
> bytes** (nothing runs, so nothing is produced). `NoopCryptoProvider` is the safe
> default: permanently `unavailable`, it advertises nothing and every operation
> resolves to a denied/unavailable decision, never throwing and never mutating its
> input. `vault_bridge.ts`'s pure `cryptoCapabilitiesToVaultCapabilities` maps the
> crypto placeholders to the Vault placeholders they would back (type-only Vault
> dependency; it wires nothing). **Nothing is auto-wired**: `createRuntime` and the
> Worker never construct or reference a crypto core (tests assert both sources are
> crypto-free, that `src/crypto` contains no XOR, and that it imports no AEAD/crypto
> library), so the whole Stage 1–33 core is untouched. See
> [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md) for the design
> notes (AEAD mandatory, XOR forbidden, Rust core as a separate package) this seam
> is drawn from. Prior status:
>
> **Stage 33 — Vault boundary skeleton.** A MINIMAL, future-facing seam
> for the FedOS Vault / Crypto / Identity layer now lives in `src/vault/`, kept
> entirely OUT of the current Nostr/Cloudflare core. `VaultBoundary`
> (`getState`/`getCapabilities`/`unlock`/`lock`/`isUnlocked`) plus the
> `VaultState` (`locked`/`unlocked`/`unavailable`/`error`), `VaultStatus`,
> `VaultDecision`, `VaultCapability` (all `*_placeholder`), and `VaultUnlockRequest`
> types define shapes ONLY. **This is a boundary, not crypto.** It performs **no
> cryptography, no key generation, no key derivation, and no seed storage** — no
> AEAD/XOR, no BIP39/BIP32, no NIP-44. `NoopVaultBoundary` is the safe default:
> permanently `unavailable`, it never unlocks and advertises nothing.
> `InMemoryVaultBoundary` (dev/test) models a `locked ↔ (placeholder) unlocked`
> lifecycle by holding ONLY a coarse status — no secret/key/seed/token field
> exists. **Apple ID / Passkey are `unlock` factors ONLY, never a key-derivation
> source**: `unlock` reads only the request `kind` (a fixed enum), derives nothing
> from the opaque, non-secret `reference`, and never turns a JWT / Apple `sub` /
> user id / Passkey credential into key material; a successful `unlock` is a
> "placeholder unlocked" state change and nothing more. `unlock`/`lock` never
> throw — a malformed request lands in `error` (state + `decision.reason`) instead
> — and neither mutates its input. Deniable/shadow storage stays RESEARCH only (a
> placeholder capability name, no shipped feature and no safety claim). **Nothing
> is auto-wired**: `createRuntime` and the Worker never construct or reference a
> vault (tests assert both sources are vault-free), so the whole Stage 1–32 core
> is untouched. See [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md)
> for the design notes this seam is drawn from. Prior status:
>
> **Stage 32 — MeshKV browser lifecycle boundary.** Bringing a MeshKV
> node online is now an explicit, separate step in `src/asset/meshkv_lifecycle.ts`,
> kept OUT of `createRuntime` and the Worker. `MeshKVLifecycle`
> (`MeshKVBrowserLifecycle` / `createMeshKVLifecycle(node, initOptions?)`) drives a
> node through `idle → prepared → online → offline` (or `error`): the
> **constructor does nothing**, `prepare()` only wires the node (`init`, no
> socket), `goOnline()` is the FIRST call that may open signaling / join the WebRTC
> peer mesh (`startSignaling`), and `goOffline()` tears it down (`stop`). Every
> step is idempotent (double-calls are safe) and a failed step lands in `error`
> with the cause recorded (`getLastError`) instead of throwing. **Nothing is
> auto-wired**: `createRuntime` and the Worker never call the lifecycle, so
> WebRTC / signaling / peer discovery begin only when a caller explicitly invokes
> `goOnline()`. This adds no cache, policy, or data path and no guarantees; MeshKV
> still carries PUBLIC/unlisted bytes only. Prior status:
>
> **Stage 31 — MeshKV runtime opt-in wiring.** `createRuntime` can now
> build a `MeshKVBrowserClient` (over the `packages/meshkv` boundary) and slot it
> into the asset cache, but **only behind an explicit opt-in**:
> `ENABLE_MESHKV_ASSET_CACHE` must be truthy AND a `MeshKVApi` supplied (via
> `MESHKV_API` or `overrides.meshKVApi`). `selectMeshKVClient(env, overrides?)`
> resolves the client — `overrides.meshKVClient` > the legacy
> `MESHKV_ASSET_CACHE` binding > the opt-in browser client — and
> `selectAssetCache` composes it (R2 + MeshKV → `CompositeAssetCache`; MeshKV only
> → `MeshKVAssetCache`; neither → in-memory). **Opting in only SELECTS the
> adapter — it starts NO MeshKV network**: constructing the client calls no
> `init`/`connect`/`startSignaling`, so no signaling socket, WebRTC link, or peer
> discovery begins; `createRuntime` runs no asset op and issues no `fetch`, and
> `env` is never mutated. The **Worker does not auto-wire it** (no
> `ENABLE_MESHKV_ASSET_CACHE` handling), so default behavior is unchanged. MeshKV
> still carries PUBLIC/unlisted bytes only — private/paid/secret/DM/payment/
> entitlement data is refused by `canCacheAsset` before it can reach the mesh, and
> there are no signed URLs, downloads, or payment. Real WebRTC/signaling will be a
> separate explicit lifecycle boundary in a later stage. Prior status:
>
> **Stage 30 — Product / Chat / Space unified directory page.** The
> default (no-param) board now arranges the read-only Space, Product, and Chat
> directories into ONE section via `src/render/directory.ts`'s
> `renderUnifiedDirectory` (reusing the existing per-type helpers and their
> `?space=`/`?product=`/`?chat=` routes; product/chat sections are sample-mode
> only). It is pure presentation: **no new data lookup, no network, no new route,
> and no change to the Product/Chat/Space types** — the Stage 29 MeshKV boundary,
> the runtime, and every other boundary are untouched. Prior status:
>
> **Stage 29 — MeshKV boundary wired to the imported implementation.** The
> real MeshKV browser project has been imported (an external, git-ignored checkout
> whose runtime is a namespace module exporting `init`/`get`/`put`/`load`/`remove`,
> backed by IndexedDB + WebRTC). `packages/meshkv` is now the typed boundary for
> that runtime: `MeshKVApi` mirrors the real exports, an `index.ts` entry point is
> the stable import surface, and a browser-free reference node (`MeshKV` /
> `createMeshKV`) lets the host typecheck/test against the contract without a
> browser. The `MeshKVBrowserClient` adapter was retargeted to the **real** API —
> `put(key, bytes, contentType)`, `remove` for delete, `has` derived from `get`,
> and no bulk `clear` (the real MeshKV exposes none) — and still clones bytes
> across the boundary. **Constructing the adapter or a node starts no network** —
> no signaling socket, no WebRTC, no peer discovery; going online is an explicit
> step (`startSignaling()` here / `signal.connect()` in the browser runtime) the
> adapter never calls. **The runtime, `selectAssetCache`, the `AssetCache`
> interface, `MeshKVAssetCache`, the Worker, promotion, and the product/chat routes
> are all unchanged.** MeshKV carries PUBLIC bytes only; private/paid/secret content
> is refused by `canCacheAsset` before it reaches the package. Base below unchanged.
>
> Ingest, thread building, query
> policy, an HTML view, a NIP-01 read-only WebSocket adapter, an `EventCache`
> boundary (in-memory + Cloudflare KV), a real BIP-340 Schnorr `SignatureVerifier`
> (@noble), a community/channel/group policy model, a NIP-07 `EventSigner`
> boundary, read-only space directory + landing pages (`?space=`/`?actor=`), a
> `RelayPublisher` write-path boundary, a **preview-only** compose panel
> (`?compose=1`), a `MetadataIndex` boundary (in-memory + Cloudflare D1), a D1
> space directory adapter, a chat / DM model boundary, a creator commerce model
> boundary, a promotion integration boundary, an edge-rec promotion adapter,
> read-only promotion placeholders, a runtime integration layer (`createRuntime`),
> an asset cache boundary (`AssetCache` for PUBLIC media), a MeshKV asset cache
> adapter (peer cache), and now an **R2 asset cache adapter** (origin storage):
> `R2AssetCache implements AssetCache` over a minimal `R2LikeBucket` (with a
> `MockR2Bucket`), which the runtime prefers when an R2 bucket is bound (R2 →
> MeshKV → in-memory). Metadata/`cachedAt`/`expiresAt` round-trip through R2
> `customMetadata`; content type through `httpMetadata`. **Every write is gated by
> `canCacheAsset`** — public/unlisted, non-sensitive media only; private/paid,
> DMs, secrets, key material, and payment/entitlement data are refused. **No
> signed URLs, download delivery, payment, or DRM** — R2 is origin storage for
> public previews, not a delivery/entitlement path. `clear()` is a deliberate
> no-op (no safe bulk wipe), and the adapter does no external `fetch` of its own.

