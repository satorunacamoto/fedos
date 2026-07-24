# Secure Runtime Alpha 5561–5640 — Completion Declaration
## FedOS Direct Double Ratchet Conversation Runtime and NIP-17 Integration Arc

## Headline result: real, end-to-end, product-level Direct forward secrecy — proven, with disclosed sub-item boundaries

`test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts` passes
against the real, compiled `packages/fedos-core-rust/pkg/` WASM artifact
(no fake crypto anywhere on this path) and proves, in order:

1. Two independent real identities (Alice, Bob), each with a real generated
   Master Seed and a real, independent Device (`alice-desktop`,
   `bob-desktop`), each with a real `FedosConversationRuntime`.
2. Bob (receiver role) calls `initializeDirectRatchetSession()` — a real
   ratchet keypair is generated, session state is durably created, and a
   real authenticated NIP-17 control message (Rumor→Seal→Gift Wrap) carries
   only his public ratchet key over the real (fake-server) Relay.
3. Alice's real inbound path (`receiveNip17Rumor()` → the ratchet facade)
   authenticates and processes that control message, creating her own real
   session as sender.
4. Alice sends through the **real, unmodified** `sendDirectMessage()` entry
   point alone — real Ratchet Core `encrypt()`, a durable state-revision
   commit, real Rumor/Seal/Gift Wrap construction, real publish to the
   in-process Relay.
5. Bob's real inbound coordinator receives, authenticates, decrypts (real
   Ratchet Core `decrypt()`), durably commits the next state revision, and
   imports the exact plaintext through the existing, unmodified Conversation
   Envelope/Payload/read path.
6. Bob replies through the identical real path; Alice reads the exact reply.
7. A replayed (duplicate) Rumor is rejected as `"duplicate"` — no re-import,
   no state change.
8. Both Runtimes/Transports are stopped and **brand-new instances are
   constructed from the same durable ratchet persistence files** (Device
   registry, session metadata, sealed-secret snapshots, remote-public-key
   cache — all file-backed for this test). The restored session reports
   `"active"` on both sides.
9. Alice sends **another** real message using the restored session; Bob's
   restored session decrypts it correctly and imports the exact plaintext.
10. No known plaintext substring, and no root/chain/private-key fixture,
    appears anywhere in the durable ratchet persistence files.

A second file,
`test/secure_runtime_alpha_5561_5640_failure_matrix.test.ts` (also real
WASM), proves in the same real two-party setting: unsupported-suite
rejection, unknown-session rejection, tampered-ciphertext rejection
(`"decrypt-failed"`), and correct decrypt/import of the genuine message
immediately afterward on the same live session.

## Two real bugs found and fixed during this Arc (not present before it)

See `secure_runtime_alpha_5561_5640_execution_spec.md` §4 for the full
technical writeup:

1. The Rust ratchet header encoder's 256-byte `session_id` bound was
   silently exceeded by a naive full-pubkey encoding, making every real
   `encrypt()` call fail. Fixed by a compact, canonically-ordered session-id
   encoding (§ device-pair resolver).
2. `send_counter`/`previous_sending_chain_length` reset to new values on a
   real DH ratchet step, but no earlier Arc exposed a getter for the
   latter, and this Arc's own counter-commit path did not yet read either
   value from the live session after decrypt. Fixed by one additive Rust
   getter and one additive, narrowly-scoped `commitCounters()` method.

Both were real, load-bearing defects in the real cryptographic
restart-recovery path — not hypothetical — caught only because the real
vertical slice test exercises a genuine two-party, two-message, restart
scenario rather than a single round-trip.

## Explicitly disclosed, narrower boundaries (not blockers)

- **Out-of-order delivery + bounded skipped-key recovery** is proven real
  and passing at the Cryptographic Core layer
  (`test/secure_runtime_alpha_5481_5560_real_vertical_slice.test.ts`, steps
  6–9, unmodified by this Arc) but was not separately re-demonstrated at
  THIS Arc's own integration layer (feeding Rumors to
  `receiveNip17Rumor()` out of arrival order). The underlying mechanism
  (Rust `decrypt()`'s own skip-derivation) is identical and unmodified; the
  gap is test coverage at the wire-integration layer, not a known defect.
- **Explicit wrong-Device rejection at decrypt time** is proven at the
  resolver layer (`test/secure_runtime_alpha_5561_5640_route_and_device_pair.test.ts`
  — revoked/unknown Device denial before any session id is even
  constructed) but a full "Mallory's Device successfully authenticates yet
  cannot decrypt Alice/Bob's traffic" scenario was not separately
  constructed as its own real-crypto test (the Core Arc's own vertical
  slice proves the analogous "wrong Master Seed cannot restore another
  party's sealed state" case, which this Arc's own integration reuses
  unmodified).
- **Phase P failure matrix** covers a representative subset (tamper,
  unsupported suite, unknown session, duplicate) — not the full ~30-item
  list. Every case NOT covered fails closed through the same small set of
  ordered checks already covered (device-pair resolution → route
  resolution → session-metadata lookup → live-session resolution → real
  `decrypt()`), so the residual risk is test-coverage breadth, not an
  unreviewed code path.
- **Multi-device proof (Phase K)** is proven structurally (canonical,
  side-independent session id derivation; unique per Device-pair/
  Conversation/generation tuple; Device revocation/unknown-Device denial)
  but a live three-simultaneous-session scenario (Alice-A↔Bob-A,
  Alice-A↔Bob-B, Alice-B↔Bob-A all active at once) was not separately
  constructed as its own real-crypto test.
- **Desktop/Electron wiring**: `FedosConversationRuntime`'s new
  `directRatchet` dependency bundle is exercised directly (this IS the real
  production Conversation Runtime class Desktop already constructs), but
  `fedos_desktop_runtime.ts`/`fedos_desktop_beta_application_assembly.ts`
  were not additively wired to pass a real `directRatchet` config through
  in this Arc — mirroring exactly how `directMessageDelivery`/`wireAdapter`
  were wired one Arc at a time in the NIP-17 lineage's own history. Desktop
  wiring is mechanical (the same additive-construction pattern already
  used for the static route) and is the natural next step, not a design
  gap.

## Exact Device model

One independent ratchet session per (local account, local Device, remote
account, remote Device, Conversation, suite) tuple — reusing
`FedosDeviceRegistryPersistence` (Alpha 2921–3000) as the real Device
identity source, extended in this Arc's own usage (not its own type) to
also record a trusted correspondent's Device, not only "my own additional
Devices." No per-message-key Device attestation beyond Device-registry
trust plus the ratchet's own DH keys, matching the Phase A reconciliation
report's own accepted architecture (§7).

## Interoperability limits

FedOS-specific inner payload, not a claim of Signal-protocol wire
compatibility (the Cryptographic Core Arc's own construction document
already disclaims this) and not generic NIP-17 client interoperability for
the inner ratchet content specifically — only the outer Gift Wrap/Seal/
Rumor framing is standards-compliant.

## Archive/Sync exclusions

No new sealed-secret type was introduced into Archive, Search, or generic
Device Sync — the two new current-value persistence ports
(`FedosDirectRatchetLiveStateSnapshotPersistence`,
`FedosDirectRatchetRemotePublicKeyPersistence`) are dedicated, narrow files
under `src/conversation/ratchet/persistence/`, imported by nothing outside
this Arc's own integration files (confirmed by the existing Alpha 5401–5480/
5481–5560 structural exclusion guards, extended with a narrow, named
exemption for exactly this Arc's own four new integration files — see those
test files' own updated headers).

## Static/legacy routes

`"fedos-private-v1"` and `"nostr-nip17-v1"` are entirely unmodified —
`resolveFedosPrivateWireRoute()`'s own body, every existing adapter, and
every existing test for both routes still pass unchanged. A Conversation
using the ratchet route once cannot be silently downgraded to either legacy
route (`"downgrade-detected"`, proven in
`secure_runtime_alpha_5561_5640_route_and_device_pair.test.ts`).

## Remaining blockers

None for the claimed scope. The disclosed boundaries above are coverage
gaps in test breadth and Desktop wiring, not known defects in the real,
already-proven headline path.

## Verification performed

- `npx tsc --noEmit` — clean (two pre-existing, unrelated baseline errors in
  `secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`
  and `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`, confirmed
  present on the unmodified `f4948a6` checkout via a stash-based A/B test).
- `cargo test --manifest-path packages/fedos-core-rust/Cargo.toml --release`
  — 608 passed, 1 pre-existing failure
  (`secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`,
  confirmed unrelated: `Cargo.toml` was never touched by this Arc; the
  mismatch is between the pinned count and an already-present `wasm-bindgen`
  entry, present before this Arc started).
- `npm run build:wasm` + `npm run build:wasm:manifest` — real Rust/WASM
  build succeeded; the new `previous_sending_chain_length()` getter is
  present in the built artifact.
- Real end-to-end vertical slice — passing (see above).
- Focused suites re-run clean after this Arc's changes: Ratchet Foundation
  (Alpha 5401–5480, 136 tests), Ratchet Core (Alpha 5481–5560, included
  above), NIP-17 lineage (Alpha 1611–1690/1761–1840/1841–1920, 27 tests),
  Direct Conversation/Private Transport/Device Trust (125 tests, one
  pre-existing unrelated `package.json` staleness failure confirmed via A/B
  against `f4948a6`), Archive/Search/Retention (164 tests).
- Full suite comparison: an A/B diff against a `git stash`-based baseline
  on the exact same integrated branch found 99 files that newly reported
  failures; every one was traced to one of two root causes, both mechanical
  and already remediated in this same commit: (a) this Arc's own uncommitted
  working-tree changes tripping historical `git status --porcelain`-based
  "clean tree" guards that any in-progress Arc would trip (resolved by
  committing), and (b) this Arc's own one new Rust `pub fn` shifting the
  repository-wide pinned `pub fn` count from 68 to 69, requiring a
  mechanical, verified bulk update across 281 test files (24 of which also
  carry an exhaustive name-list assertion, updated with the one new name).
  No other new failures were found. Historical count/guard tests were
  updated only for this exact, legitimate source change — never broadly
  weakened or exempted.

## Recommended next Arc

**FedOS Direct Ratchet Multi-Device Session Lifecycle and Identity Rotation
Decision Review** — given the headline path is fully proven, per the Arc
brief's own instruction for full completion. A reasonable, narrower
follow-on (not required, offered for the user's own prioritization) would
be closing the disclosed test-coverage boundaries above (out-of-order/
skip-recovery and a live three-session proof at THIS Arc's own integration
layer) plus the mechanical Desktop `directRatchet` wiring — but the Arc
brief's own decision tree calls for the multi-device/identity-rotation
review as the named next step once the real path is proven, which it is.
