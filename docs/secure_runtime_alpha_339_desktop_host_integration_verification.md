# Secure Runtime Alpha 339 — End-to-End Host Verification

**Status: this Stage implements tests only — no production code
change.** Stage 9 of the Alpha 331–340 Desktop Host Runtime Foundation
Arc. Verifies `FedosDesktopHost`/`createFedosDesktopHost`
(Alpha 333–337) by real execution with injected dependencies —
`test/secure_runtime_alpha_339_desktop_host_integration_verification.test.ts`.

## 1. Why now

Alpha 333–337 built the Host's state model, dependency assembly,
hydration ownership, access boundary, and shutdown contract as
separate, individually-reviewed Stages. This Stage exercises all five
TOGETHER, through real construction, real (in-memory) persistence, and
a real `DesktopApplication` — never a mock of either owned class —
matching Alpha 309's own "real fixtures through all four real,
unmodified Board Adapters" verification discipline.

## 2. Successful startup, verified

A `FedosDesktopHost` is constructed via `createFedosDesktopHost()`
with an `InMemoryFedosBoardPersistence` pre-populated, via the real
`serializeFedosBoardPost`/`validateFedosBoardPost` codec path, with
real posts produced by all FOUR real, unmodified Board Adapters
(`validateNostrBoardPost`, `validateActivityPubBoardPost`,
`validateAtprotoBoardPost`, `validateSessionBoardPost` — the same
fixture shapes Alpha 309 established). After `await host.start()`:
`state()` reads `"constructed"` before the call and `"ready"` after;
`board()` returns a non-`null` `FedosBoardService` only after; the
four persisted posts are all reachable via `listBoardPosts()`; and a
thread relationship persisted across two protocols (Nostr root +
AT Protocol reply, mirroring Alpha 309 §5's own cross-protocol thread
fixture) resolves correctly via `listThreadPosts()`.

## 3. Hydration failure, verified

An `InMemoryFedosBoardPersistence` seeded with a structurally corrupt
record (a `schemaVersion` mismatch, the SAME corruption shape Alpha
318's own test #6 uses) causes `host.start()` to REJECT. `state()`
reads `"failed"`. The injected `DesktopApplication`'s own
`isBootstrapped()` stays `false` — direct, structural proof that
`DesktopApplication.start()` was never reached, since `start()`'s own
first internal step is `bootstrap()` (Alpha 097/136), which is the
only path that can ever set Identity's own bootstrapped flag to
`true`. `board()` returns `null`.

## 4. Desktop startup failure, verified

A `DesktopApplication` constructed with a `FedosPublicIdentityReader`
whose own `readPublicIdentity()` rejects (an explicit test fake
implementing ONLY that one-method interface, Alpha 101) is injected
alongside a persistence pre-populated with valid posts. `host.start()`
REJECTS (the SAME rejection `DesktopApplication.start()` itself
produces, per Alpha 136's own fixed `bootstrap → refreshPublicIdentity`
order). `state()` reads `"failed"`. `board()` returns `null` even
though hydration itself succeeded — direct proof of Alpha 335 §4's own
"the hydrated service is discarded, not exposed" guarantee.

## 5. Lifecycle, verified

- A second `start()` call on an already-`"ready"` (or already-`"failed"`)
  instance REJECTS.
- `stop()` from `"ready"` resolves; `state()` reads `"stopped"`.
- A stopped Host denies `desktop()`/`board()` access (`null` for both).
- A second `stop()` call, or any `start()` call, on a stopped instance
  REJECTS — no restart.
- Two independently-constructed `FedosDesktopHost` instances (via two
  separate `createFedosDesktopHost()` calls) never share state — a post
  registered through one's `board()` is invisible to the other's.
- Calling `createFedosDesktopHost()` alone, with no override and no
  `start()` call, produces zero observable side effect (no thrown
  error, no state beyond `"constructed"`, no persisted record) —
  confirming Alpha 334 §4's own "construction only" guardrail by
  direct execution, not just by inspection.

## 6. Boundaries, verified structurally

Direct `?raw`-source inspection of every file under
`src/desktop/host/` confirms: no `src/worker.ts` import, no
`src/runtime/create_runtime.ts` import (Option D was rejected, Alpha
332 §4 — this Stage confirms the rejection held in the actual
implementation), no Relay Pool reference, no `FedosRuntimeStorageBackend`/
`StorageBackend` reference, no `p2p/` import of any kind, no GUI
reference (`window`/`document`/DOM), no `process.exit`, and no
`process.env` read.

## 7. Conclusion

Every requirement Alpha 339 names in this Arc's own instruction is
verified by real execution, with injected (never mocked) dependencies,
against the actual `FedosDesktopHost`/`createFedosDesktopHost`
implementation Alpha 333–337 shipped.

## 8. See also

- `docs/secure_runtime_alpha_337_desktop_host_shutdown_contract.md`
- `docs/secure_runtime_alpha_309_four_protocol_board_integration.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
