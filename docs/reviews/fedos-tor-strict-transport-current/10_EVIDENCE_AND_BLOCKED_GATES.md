# Evidence and Blocked Gates — final pass

Against CandidateHead `1027e283` (branch `arc/fedos-tor-strict-transport-local-closure`, forked from `c817b4ce`).

## 1. Ratchet/legacy shared-transport live proof (coordinator priority item 1) — DONE

`packages/fedos-desktop-electron-spike/test/fedos_tor_strict_transport_ratchet_legacy_shared_route.test.ts`,
2/2 passing. Uses the REAL `FedosConversationDirectMessagingCoordinator`
route-selection logic (never mocked) to drive both a ratchet-route send
and a forced-legacy-route send through the real
`createStrictFedosRelaySocketFactory()`, observed by one shared fake
SOCKS5 server. Both land on the identical connection target. A second
test proves the same sharing in the fail-closed direction.

## 2. Fresh red-team re-run (coordinator priority item 2) — DONE

Adversarial re-read of the actual `96c3c902` diff (not a restatement of
Phase A). One real fix applied: the WebSocket opening-handshake status
check (`fedos_electron_strict_websocket_client.ts`) was a substring
match (`.includes(" 101 ")`), satisfiable by a crafted non-101 status
line from a misbehaving destination — not a clearnet-bypass (the
destination is only ever reached via the SOCKS-negotiated socket
regardless), but a real correctness gap, fixed to an exact
`^HTTP/1.x 101` prefix check. Everything else reviewed and confirmed
clean: factory selection gates on `isStrictModeEnabled()` before any
socket opens (no path reaches the direct factory once enabled); TLS
certificate verification left at its secure default
(`rejectUnauthorized` never overridden); retries stay governed (they
re-invoke the same factory, which re-checks policy every call); the
SOCKS *proxy host* itself (not the destination) is the only thing ever
locally resolved, and only when configured by non-loopback hostname
(default is the `127.0.0.1` literal) — an accepted, expected property of
every real SOCKS client (you must reach your own local proxy somehow),
distinct from the destination-hostname-never-resolved-locally guarantee
the mandate actually requires.

## 3. Full authoritative gates (coordinator priority item 3) — PARTIAL, with an exact disclosed boundary

| Gate | Result |
|---|---|
| typecheck (package + root) | PASS — clean (pre-existing unrelated `electron`-module-type/implicit-any errors in untouched files only) |
| targeted Tor/strict-transport tests | PASS — 14/14 (`fedos_electron_strict_transport_local_socks.test.ts` + `fedos_tor_strict_transport_ratchet_legacy_shared_route.test.ts`) |
| `npm run test:current` | 188/191 files, 2808/2814 tests passed, 3 skipped. **3 failures, all in `commerce_wasm_product_media_encryption.test.ts`-family WASM dev-glue-loader assertions, none in any file this arc touched.** Consistent with this project's own documented "fresh/isolated worktree WASM-artifact" gotcha (this worktree's `packages/fedos-core-rust/pkg` is a manually-created directory junction to the source worktree, set up because this isolated worktree has no real `npm ci`/build of its own — see the blocked gate below for the same root cause). Not re-derived from first principles under this arc's time budget; flagged honestly as a probable worktree artifact rather than asserted as fully diagnosed. |
| `cargo test --locked` | 652 passed / 1 failed. The 1 failure is the SAME pre-existing `secp256k1_dependency_guard` dependency-count guard already confirmed pre-existing on the source branch before this arc (documented in the parent Direct Ratchet arc's own final report) — this arc touched zero `.rs` files. Required setting `CARGO_TARGET_DIR` outside the OneDrive-synced worktree path (`ld.exe: cannot find ... .rcgu.o`, the documented "CARGO_TARGET_DIR on OneDrive" issue) to get a real result at all. |
| Electron build / dependency closure / package / package integrity / NSIS / checksums / beta gate | **STRUCTURALLY BLOCKED, exact evidence below.** |

### Exact blocking evidence for the packaging chain

```
$ npm run package:electron-beta
> prepackage:beta
> node ../../scripts/release/guard_no_junctioned_node_modules.mjs

[guard_no_junctioned_node_modules] .../node_modules: JUNCTION/SYMLINK (forbidden for release/package validation)
[guard_no_junctioned_node_modules] .../packages/fedos-desktop-electron-spike/node_modules: MISSING

[guard_no_junctioned_node_modules] FAILED. Release/package validation must run from a
worktree whose node_modules directories were produced by this worktree's own `npm ci`
— never a directory junction or symlink shared with another worktree, and never missing.
```

This is a REAL, deliberate, correctly-firing guard, not a bug — this
isolated `agent-ad881f368afeacdc5` worktree's `node_modules` is a
directory junction to the coordinator's separate source worktree
(`C:\wt\fedos-installed-startup-root-cause`), created because this
isolated worktree has no `node_modules` of its own; a genuine electron
binary is confirmed absent from BOTH locations (checked directly:
`node_modules/electron/dist/electron.exe` does not exist in the source
worktree either). A real fix requires a fresh `npm ci` in both this
worktree root and `packages/fedos-desktop-electron-spike/` — a
network-dependent, multi-minute, multi-hundred-MB operation this pass's
remaining time budget does not cover, and not something to run silently
without the coordinator's own sign-off given its network/time cost.
**Every downstream packaging/install/NSIS gate is blocked by this same
single root cause.**

## 4. Installed two-process proof (coordinator priority item 4) — BLOCKED, same root cause as item 3

No NSIS artifact can be built in this environment for the reason above,
so no real install/run is possible. Per mandate §43's own explicit
allowance ("if full local topology is too heavy: run strongest
representative installed proof and disclose exact boundary"): the
strongest representative proof available without a real install is
exactly what item 1 above already provides — a real, running,
typechecked proof of the strict-transport fail-closed/shared-route
behavior at the source level, plus the local fake-SOCKS acceptance
matrix (12/12, `fedos_electron_strict_transport_local_socks.test.ts`).
No public Tor, no public network, at any point.

## 5. Settings UI toggle (coordinator priority item 5) — NOT ATTEMPTED, disclosed

No time budget remained after items 1-3 to add a Settings/renderer
toggle. The env-var-only mechanism
(`FEDOS_BETA_STRICT_TOR_ENABLED=1`/`FEDOS_BETA_STRICT_TOR_SOCKS_HOST`/
`FEDOS_BETA_STRICT_TOR_SOCKS_PORT`, read once at process launch) remains
the only way to enable strict mode. Explicitly left as future work, not
silently expanded scope.

## Summary classification (mandate §55/§56)

- **TOR STRICT ARCHITECTURE**: COMPLETE (frozen, documented, `03_STRICT_TRANSPORT_ARCHITECTURE.md`).
- **TOR LOCAL IMPLEMENTATION**: COMPLETE (source + composition-root wiring, `96c3c902`).
- **TOR LOCAL FAIL-CLOSED PROOF**: PASS (14/14 local tests across two files, including the ratchet/legacy shared-route proof).
- **TOR INSTALLED LOCAL PROOF**: BLOCKED — exact environmental boundary disclosed above (junctioned `node_modules`, missing `electron.exe` in both worktrees, no real `npm ci` run this pass).
- **PUBLIC TOR NETWORK CONTACT**: NO.
- **PUBLIC TOR PROOF**: NOT AUTHORIZED.
