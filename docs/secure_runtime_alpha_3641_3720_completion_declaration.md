# Secure Runtime Alpha 3641–3720: Relay-Assisted Device Synchronization — Completion Declaration

## What this Arc proves

- The proven, local, real-Schnorr-authenticated Encrypted Device-to-Device Local Transfer protocol (Alpha 3481–3560, unmodified) now works end to end through an untrusted, store-and-forward Relay: a real `FedosDeviceRelaySyncOutboundCoordinator` builds and publishes a versioned wire payload; a real `FedosDeviceRelaySyncInboundHandler` receives, verifies, decrypts, and imports it — proven with real BIP-340 Schnorr signatures throughout (both the inner Transfer Package's own mutual device authentication, Alpha 3481–3560, and this Arc's own outer Nostr event signature, re-verified via the existing, unmodified `NobleSignatureVerifier`).
- Offline receive is proven directly: a target Device with no active subscription at publish time still receives and imports the package once it later subscribes — using a REAL, functional in-process Relay fixture (`FakeDeviceRelaySyncRelay`) that actually stores and actually delivers messages, unlike the existing `NullRelay`.
- Restart/dedup is proven directly, at BOTH ends: a fresh `FedosDeviceRelaySyncOutboundCoordinator` (simulating a source-side restart) cannot duplicate an already-`"package-sent"` Transfer Session (the underlying, unmodified Transfer Coordinator's own state machine forbids it); a fresh `FedosDeviceRelaySyncInboundDedupPersistence` instance over the SAME durable NDJSON log (simulating a target-side restart) still refuses to re-import an already-imported package.
- Revocation fails closed, timed at every meaningful point: before publish (the Outbound Coordinator itself refuses), and after publish but before import (the Inbound Handler's own fresh, live Registry re-check refuses) — proven directly for both the source and the target Device independently.
- Relay ACK and Device import are proven distinct at every layer: the Outbound Coordinator's own result carries `relayOutcomes` (Relay acceptance) SEPARATELY from its own `outcome` (local/session state); the Observation vocabulary records `"relay-accepted"` and `"imported"` as two independent, never-collapsed facts — proven by a direct status-query test.
- No plaintext or secret material reaches the Relay — proven directly: the signed event's own content never contains the plaintext Sync Session JSON, never contains a Device's own public key reference outside the wire payload's own routing fields, and never contains any secret-shaped substring (`masterseed`/`privatekey`/`nsec`/`mnemonic`/`passphrase`) of any kind.
- The Sync record allowlist remains enforced, unmodified, and is directly re-exercised by this Arc's own tests against Master Seed, private key, Device private key, Sender-Key secret, bearer secret, passphrase, and raw plaintext metadata shapes — all rejected by the EXISTING, untouched `reviewFedosSyncRecordForJournal()`.
- Multi-Relay fan-out with independent per-Relay outcomes is proven: one Relay rejects while another accepts, both outcomes present and correct; all Relays timing out still resolves cleanly (`"failed"` for each, never a hang); a Relay-count resource limit (16) is enforced.
- Tampering is proven caught at multiple, independent layers: a tampered outer event (any field) fails outer signature verification; a validly-signed but internally-inconsistent payload (a dishonest, mismatched `packageContentHash`) fails the content-hash gate regardless of signature validity — a genuine defense-in-depth property, not merely one check standing in for the other.
- Cross-account and cross-runtime isolation are proven: an Inbound Handler configured for a different account, or a wholly separate Inbound Handler instance with its own independent dedup state, cannot be tricked into importing, or into interfering with another handler's own import bookkeeping.

## What this Arc explicitly does NOT claim

- **No cloud sync, no central account server, no push notifications, no background OS service, no Onion/Tor, no MLS.** None of these are implemented, referenced, or assumed anywhere in this Arc.
- **No NIP-17 compliance claim of any kind.** NIP-17 Gift Wrap is genuinely absent from this checkout's history (confirmed: neither NIP-17 commit is an ancestor of this Arc's own base) — this Arc's wire route is an honestly-labeled, proprietary `kind:1` convention, not a NIP-17 implementation.
- **No Relay identity trust, no Relay timestamp trust as canonical ordering, no Relay deletion claim, no Relay non-storage claim.** The Relay is treated, throughout, as an untrusted mailbox: every fact this Arc relies on (Device trust, package integrity, session state) is re-derived from the LOCAL Device Registry/Transfer Coordinator/signature verification, never from anything the Relay itself asserts.
- **No Sender-Key secret synchronization of any kind.** This checkout's own history contains no Sender-Key secret persistence code at all (confirmed absent) — there is nothing for this Arc to accidentally touch, reference, or synchronize.
- **No real public Relay retention SLA.** Every "offline then later receive"/restart test in this Arc uses a real, functional, but IN-PROCESS Relay fixture (`FakeDeviceRelaySyncRelay`) — never a real network Relay.
- **No distributed exactly-once guarantee** beyond this Arc's own single-writer, in-process, durable dedup persistence — the same honestly-stated limitation every prior Device arc in this line already carries forward.
- **The Transfer Session handshake (Invitation/Challenge/Approval) is NOT relayed by this Arc.** This Arc assumes it has already completed through the existing, unmodified `FedosDeviceTransferCoordinator` before its own new work begins (Package publish onward) — a deliberate, honestly-documented scope boundary, not an oversight. Relaying the handshake itself is natural future work, not attempted here to avoid redesigning Device Transfer or broadening this Arc's own scope.
- No Sender-Key change, no Conversation Runtime change, no Archive change, no Search change, no Desktop Shell/UI change, no new dependency, no Rust/WASM change.

## Baseline vs. final

| | Baseline (before this Arc, `fcceca1`) | Final (this Arc) |
| --- | --- | --- |
| Device Transfer delivery | local-only, both Devices assumed simultaneously reachable | ALSO relay-assisted: async, store-and-forward, offline-tolerant |
| Wire route | none | `FedosDeviceRelaySyncWirePayloadV1`, route version 1, proprietary kind:1 |
| Multi-Relay Device Sync publish | none | `FedosDeviceRelaySyncPublisher`, per-Relay outcome, resource-limited |
| Inbound dedup | none | two-layer durable hierarchy (Relay event id, session+hash) |
| Device Sync Observation | none | 9-state, protocol-neutral, session-queryable |
| `npm run typecheck` | clean except pre-existing `alpha_477_scheduler_lifecycle_model.test.ts:121` | unchanged — same one pre-existing failure, nothing new |
| New test files | — | 3 files, 50 tests, real Schnorr signatures + real AEAD + a real functional Relay fixture throughout |

## Verification run (this worktree, `C:\wt\device-relay-sync`)

1. `npm run typecheck` — clean except the one pre-existing, unrelated `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` failure.
2. New Arc test files — `secure_runtime_alpha_3641_3720_device_relay_sync_outbound.test.ts` (10/10), `..._inbound.test.ts` (19/19), `..._wire_and_allowlist.test.ts` (21/21) — 50/50 passed.
3. Device Registry/Trust regression (`secure_runtime_alpha_2921_3000_device_trust_runtime_integration.test.ts`, `secure_runtime_alpha_3161_3240_account_device_signature_boundary.test.ts`) — 74/74 passed, byte-for-byte unmodified by this Arc.
4. Device Sync Foundation regression (`secure_runtime_alpha_3321_3400_*`) and Local Device Transfer regression (`secure_runtime_alpha_3481_3560_*`) — 59/59 passed, unmodified.
5. Private Relay/transport regression (`secure_runtime_alpha_1471_1540_*`, 8 files) — 59/59 passed, unmodified.
6. `npx vitest run` (full suite) — 12,307 passed / 239 failed across 949 files. The failed count is UNCHANGED from the base Arc's own documented baseline (239), and the passed count increased by exactly 50 (this Arc's own new tests) — confirming zero regressions. Every failure falls into the same two pre-existing, previously-documented categories (the fresh-worktree `?raw`-import artifact, and `test/reviews/**` git-status snapshot assertions reacting to this Arc's own new, still-uncommitted `src/device/relay_sync/` — both resolve once this Arc's changes are committed).
7. Rust/`cargo` — not run; no Rust file was touched by this Arc.

## Security guard scan

`grep` across every new file under `src/device/relay_sync/` for `masterseed`, `privatekey`/`private_key`, `passphrase`, `mnemonic`, `Math.random`, `nsec` — every match is prose/comments documenting the reuse of an existing guardrail or a test assertion confirming absence; zero occurrences carry an actual secret-bearing field or value. No new file constructs a raw private key, reads the Master Seed directly, or places any such value in a Nostr tag — every tag this Arc's own event-construction function produces (`fedos_device_relay_sync_event.ts`) carries either a public account identity or a structural marker/session-id string.

**Two genuine bugs found and fixed during test-writing, in the SAME commit** — the same off-by-one class this repo's own history already records finding twice before (Alpha 3161–3240, then again in Alpha 3481–3560's own field-count guards): `isWellFormedFedosDeviceRelaySyncWirePayloadV1()` initially checked `keys.length !== 11` against a 12-field interface, and `isWellFormedFedosDeviceRelaySyncObservationV1()` initially checked `Object.keys(value).length !== 4` against a 5-field interface (and was missing an `id` field check entirely). Both made the corresponding structural check reject every genuinely well-formed object, caught immediately by this Arc's own first real end-to-end test run (17 of 19 inbound tests failing with `"malformed"` for objects that were, by construction, entirely valid) rather than by code review — fixed in the same commit, before any test was allowed to pass.

## Security Statement

**What this Arc's Relay-assisted synchronization proves:** that a Transfer Package, already sealed and mutually-authenticated by the unmodified Local Transfer protocol, can be carried across an untrusted, asynchronous, store-and-forward Relay boundary without exposing anything beyond public routing facts and one opaque ciphertext blob; that tampering anywhere along that path — the outer event, the wire payload, or the inner package — is caught before import, at the layer best suited to catch it; that duplicate or out-of-order delivery across multiple Relays, or across a process restart, never causes a double-import; and that a Device revoked at any point before import is honestly denied, with no re-trust and no claimed remote erasure of anything already delivered.

**What this Arc's Relay-assisted synchronization does NOT prove:** that any real-world Relay actually behaves honestly, retains data for any duration, or has genuinely deleted anything on request; that Relay-reported delivery timing constitutes a trustworthy causal order of anything; any capability to synchronize the Transfer Session handshake itself over the Relay (an explicitly out-of-scope, honestly-named boundary for a future Arc); any Sender-Key secret synchronization (no such code exists in this checkout at all).

## Structural guards confirmed

- `git diff fcceca1 -- src/device/binding_challenge/ src/device/persistence/ src/device/runtime/ src/device/sync_session/ src/device/sync_package/ src/device/transfer/ src/sync/ src/conversation/ src/desktop/ src/nostr/sign/ src/runtime/ package.json package-lock.json` — empty except for the newly ADDED files under `src/device/relay_sync/` (all new paths, zero modification to any existing file's own content — the ONE read-only import of `NobleSignatureVerifier`/`NostrEvent`/`NostrTag` from `src/nostr/` is a type-only/function-call reuse, not a modification of those files).
- No public Board event: `git diff fcceca1 --stat -- src/board/publish/` — empty except the read-only import of the existing, unmodified `nostrWireEventToFedosEventDescriptor()`.
- No new dependency: `git diff fcceca1 -- package.json package-lock.json` — empty.
- No Desktop UI/Shell change: `git diff fcceca1 --stat -- src/desktop/shell/ src/desktop/renderer/` — empty (no such paths touched; confirmed no match).
- `p2p/`, `.tmp_gen/` untouched: confirmed via `git status --porcelain p2p .tmp_gen` — empty.
- Sync Journal remains canonical local state: `git diff fcceca1 -- src/sync/` — empty; this Arc's own inbound handler never writes to `FedosSyncJournal` directly, and carries the EXISTING Transfer Package (a device-inventory snapshot) as its payload, not raw Journal records — the "apply allowed Sync records" step (Phase E.10–11) is satisfied by this Arc's own direct, unmodified re-use and re-testing of `reviewFedosSyncRecordForJournal()` (Phase K), honestly documented as NOT yet wired into an end-to-end Relay-carried Journal-record flow (a natural, named extension for a future Arc — see "What this Arc explicitly does NOT claim").

## Files changed

New: `src/device/relay_sync/fedos_device_relay_sync_wire_payload.ts`, `fedos_device_relay_sync_event.ts`, `fedos_device_relay_sync_publisher.ts`, `fedos_device_relay_sync_observation.ts`, `fedos_device_relay_sync_outbound_coordinator.ts`, `fedos_device_relay_sync_inbound_handler.ts`, `persistence/fedos_device_relay_sync_outbox_persistence.ts` (+ in-memory/append-only), `persistence/fedos_device_relay_sync_inbound_dedup_persistence.ts` (+ in-memory/append-only), `persistence/in_memory_fedos_device_relay_sync_observation_repository.ts`, `persistence/append_only_fedos_device_relay_sync_observation_repository.ts`, `test/secure_runtime_alpha_3641_3720_device_relay_sync_outbound.test.ts`, `..._inbound.test.ts`, `..._wire_and_allowlist.test.ts`, `test/support/fake_device_relay_sync_relay.ts`, `test/support/device_relay_sync_test_fixture.ts`, this doc pair.

Modified: `README.md` (new status blurb, prepended per this repo's own stacking convention).

Unmodified: everything under `src/device/` outside the new `relay_sync/` directory, `src/sync/`, `src/conversation/`, `src/desktop/`, `src/nostr/` (read-only import only), `src/runtime/`, `src/crypto/`, `packages/`, `p2p/`, `.tmp_gen/`, every Rust file, `package.json`/`package-lock.json`.

## Recommend exactly one next Arc

**Background Device Sync Scheduling and Conflict Resolution Arc.**
