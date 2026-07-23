# Secure Runtime Alpha 6841–6920 — Compatibility and Packaged Acceptance Report

**FedOS Direct Ratchet Production Crypto Graph Unification Arc.**

## Compatibility (Phase L)

| Item | Status |
|---|---|
| NIP-44 vectors | Unchanged — zero encryption/decryption authority code touched |
| Ratchet message/header format | Unchanged — zero wire-format code touched |
| Sealed-state schema | Unchanged — `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`'s own AEAD binding-tuple contract is byte-for-byte identical; no migration needed or performed |
| Session IDs / counters / skipped-key bounds | Unchanged — zero session-state code touched |
| Device-pair isolation | Unchanged, re-confirmed by the new production sealing test (test 9: independent conversations never cross-open) |
| Outbox/retry behavior | Unchanged |
| NIP-17 framing | Unchanged |
| Archive/Search exclusions | Unchanged |
| Session Reset semantics | Unchanged — `resetDirectRatchetSession()` untouched |

**No persistence migration was necessary or performed.**

## Structural guards (Phase O) — final status

All confirmed by `test/secure_runtime_alpha_6841_6920_structural_guards.test.ts`
(9/9 passing) plus manual verification:

- Exactly one production Master Seed Authority owner — YES (`activateFedosProductionProfileMasterSeed()`, unchanged call site).
- Exactly one Store per authority generation — YES (unchanged; zero Rust touched).
- Ratchet factory no longer constructs a production authority — YES for the real production path; the dev/test factory (`assembleFedosConversationProductionCryptoGraph()`) still exists, unchanged, for dev/test callers only, never reached by the real Coordinator.
- No raw-secret export — YES (zero new export; the two new methods mirror an already-shipped implementation verbatim).
- No Store access from TS/Desktop/IPC — YES (unchanged).
- No generic handle access — YES (the new methods are named, closed operations — seal/restore only — not a generic `readSecret()`).
- No production development gate — YES (`FedosWasmLoaderSkeleton`'s Dev-only Gate is untouched and remains fully bypassed by the real production path).
- No test authority in packaged app — YES, verified live (the packaged run's own `productionCryptoStatusOutcome: "ok"` reflects the real `FedosProductionMasterSeedAuthority`, never `DevelopmentFedosMasterSeedAuthority`/`FedosWasmMasterSeedAuthority`).
- No second Runtime / no second Conversation Runtime — YES (unchanged; one `conversationDirectRatchetDeps` derivation site, confirmed by structural guard test 4).
- No new crypto/NIP — YES.
- No Ratchet wire change — YES.
- No Device Sync secret transfer — YES (untouched).
- No Identity/Deletion redesign — YES (untouched).
- No Electron security weakening — YES (`fedos_electron_beta_main.cts` byte-for-byte unchanged by this Arc, confirmed by structural guard test 8).
- No `p2p/`/`.tmp_gen/` changes — YES (confirmed by structural guard test 9).

## Packaged Electron Acceptance (Phase K)

Real packaged run proves:

- Real Settings Relay config loads (via the actual compiled `FedosDesktopSettingsController`).
- Production Store-backed authority active (`productionCryptoStatusOutcome: "ok"`).
- Direct Ratchet config is non-null ONLY when prerequisites are real (test 6: no relay → `false`; test 7: real relay → `true`).
- No fabricated Relay URL (structural guard confirms no hardcoded `wss://` literal is ever passed to the real relay constructor).
- No development authority, no test helper reaches the packaged Beta entry point.
- No duplicate WASM instance (structural guard test 7: zero Rust diff; the real production path never reaches the dev-gated factory at all).
- Peer Capability/Identity Transition/Deletion remain functional (re-confirmed passing).
- Safety Center's own `productionCryptoStatus()` reports readiness honestly (`"ok"`, live, through the real chain).

`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_6761_6840_settings_relay_reachability.test.ts`
(the immediately-prior Arc's own real packaged test suite) was updated —
tests 7/8 now assert `directRatchetConfigured: true` (was `false`) —
reflecting this Arc's own real, verified closure of that exact gap; every
other assertion in that file is unchanged.

## What remains honestly out of this Arc's own scope

- A full, live, two-party Direct Ratchet message exchange over a real
  network-reachable relay (this Arc's own tests use `NullRelay`/an
  intentionally-unreachable `wss://relay.invalid.example` URL, matching
  the EXISTING, established precedent from `secure_runtime_alpha_6521_6600_
  real_production_vertical_slice.test.ts` — proving inbound-path
  reachability and construction correctness, not live network delivery).
- Five-cycle lock/restart depth and actual NSIS installer execution
  (already-disclosed, unchanged limits from `f7c141d4`'s own threat
  scenario report).
- `initializeDirectRatchetSession()`'s own full X3DH-style establishment
  through two independent production-authority-backed parties exchanging
  a real NIP-17 Gift Wrap — the sealing/restore round trip (the actual
  crypto operation Direct Ratchet's own production reachability gated on)
  is proven for real; a full live session establishment end-to-end was not
  separately constructed as a new test this session, given the existing
  session-establishment machinery is unchanged by this Arc and already has
  its own dedicated test coverage elsewhere in the suite.
