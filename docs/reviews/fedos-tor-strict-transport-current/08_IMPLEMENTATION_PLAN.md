# Implementation Plan

New files, `packages/fedos-desktop-electron-spike/src/`:

1. `fedos_electron_strict_transport_errors.ts` — closed `StrictTransportErrorCode`
   vocabulary (`socks-unreachable`, `socks-failure`, `authentication-failure`,
   `timeout`, `not-ready`, `handshake-failed`), user-safe messages, pattern
   ported from the historical `TorError` (see `02_HISTORICAL_TOR_ASSETS.md`).
2. `fedos_electron_socks5_client.ts` — `socks5Connect()`, ported near-verbatim
   from `feature/commerce-tor-live-final-v1`'s `fedos_electron_tor_socks_client.ts`
   (RFC 1928/1929, DNS-never-local guarantee unchanged), retargeted to the
   new error module and a simplified single-credential isolation shape.
3. `fedos_electron_strict_isolation.ts` — `deriveStrictSocksIsolationCredential(processSessionSalt)`,
   simplified single-scope port of the historical per-scope derivation.
4. `fedos_electron_strict_transport_policy.ts` — `FedosStrictTransportPolicy`:
   `enable(config)`/`disable()`, `state()`, `probeReadiness()`, internal
   READY/DEGRADED/FAILED_CLOSED transitions per `03_STRICT_TRANSPORT_ARCHITECTURE.md` §2/§3.
5. `fedos_electron_strict_websocket_client.ts` — minimal RFC 6455 client over
   a raw/TLS socket, implementing `FedosRelaySocket` (`send`/`close`/
   `addEventListener`), text frames only, auto ping/pong.
6. `fedos_electron_strict_transport_socket_factory.ts` — `createStrictFedosRelaySocketFactory(policy)`:
   returns a `FedosRelaySocketFactory` that checks `policy.state() === "ready"`,
   parses the URL, SOCKS-connects, TLS-wraps if `wss:`, builds the strict
   WebSocket client; rejects immediately (no socket opened) if not ready.

Composition root (`fedos_electron_beta_main.cts`):

7. One new config/settings field: `strictTorEnabled: boolean` (default
   `false`) + `torSocksHost`/`torSocksPort` (defaults `127.0.0.1`/`9050`),
   threaded through the existing Settings persistence
   (`fedos_desktop_settings_controller`/whatever the current Settings shape
   is — read that file first, extend its existing shape, do not invent a
   parallel config store).
8. One `FedosStrictTransportPolicy` instance constructed once per
   `requireModules()`/main-process lifetime, `enable()`d/`disable()`d when
   Settings load/change.
9. The single binding-site change described in
   `03_STRICT_TRANSPORT_ARCHITECTURE.md` §4 — the ONLY change to
   `fedos_electron_beta_main.cts`'s existing ~13 relay-construction call
   sites is zero; only the one `RootModules` return-object line changes.

Tests (local-only, no public network — mandate §3):

10. `packages/fedos-desktop-electron-spike/test/fedos_electron_strict_transport_local_socks.test.ts`
    — a local fake SOCKS5 server (real TCP, real protocol bytes, loopback
    only) plus a local fake WS destination server; exercises the full
    acceptance matrix (`09_ACCEPTANCE_MATRIX.md`).
