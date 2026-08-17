# Current Network Surface — Tor Strict-Transport arc

**Scope:** branch `arc/fedos-tor-strict-transport-local-closure`, forked from
EvidenceHead `c817b4ce` (Direct Ratchet Live-State Durability arc, COMPLETE,
P0: 0). This document re-verifies, rather than blindly inherits, the prior
network-surface audit.

## 0. Re-verification method

The prior arc's own `docs/reviews/fedos-post-ratchet-tor-current/03_NETWORK_SURFACE_INVENTORY.md`
(written at `b886a176`) already did an exhaustive, line-cited static audit of
every network exit reachable from HEAD. Between `b886a176` and this arc's own
starting commit `c817b4ce`, the only source changes were the entire Direct
Ratchet Live-State Durability arc (persistence/checkpoint/security-state
files) plus the real installed E2E harness additions — none of which touch
`node_websocket_relay_socket_factory.ts`, `websocket_relay.ts`,
`ws_relay.ts`, `publish.ts`, or `fedos_electron_beta_main.cts`'s relay-socket
construction sites. Re-confirmed directly:

```
git log --oneline b886a176..c817b4ce -- \
  src/os/messenger/desktop/node_websocket_relay_socket_factory.ts \
  src/os/messenger/desktop/websocket_relay.ts \
  src/os/messenger/adapters/nostr/protocol/ws_relay.ts \
  src/os/messenger/adapters/nostr/protocol/publish.ts
-> (empty — zero commits touched any of these files)
```

**Conclusion: the prior audit's headline finding still holds exactly.**
Re-stated here rather than re-derived line-by-line (see that document for
full citations):

## 1. Headline finding (re-confirmed)

**Exactly one real network exit in the shipped product:** outbound
WebSocket connections to user-configured Nostr relay URLs, through one
socket-factory function, `createNodeWebSocketRelaySocketFactory()`
(`src/os/messenger/desktop/node_websocket_relay_socket_factory.ts`), called
from exactly one composition-root binding site in
`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`
(the `RootModules` return object, `createNodeWebSocketRelaySocketFactory:
websocketRelaySocketFactory.createNodeWebSocketRelaySocketFactory`) and
consumed at ~13 individual `new WebSocketRelay(...)` /
`new CommerceNostr.WebSocketRelayPublisher(...)` /
`new CommerceNostr.WebSocketRelayAdapter(...)` call sites throughout that
same file (Messenger relay connectivity, and every Commerce Nostr
transport — catalog discovery, private order/delivery/payment-evidence/
media-release sync — since Commerce reuses the exact same Nostr transport,
not a separate one).

No `fetch`, `http(s).request`, `net.connect`/`tls.connect`, `dgram`,
explicit `dns.*` call, `electron.net`/`session.defaultSession` usage, or
`child_process` spawn of a network tool exists anywhere in `src/`/`packages/`
production code on this branch. No auto-update mechanism exists (confirmed
absent in code, not just docs — see prior audit §10, still true: no
`electron-updater` dependency, no update-check code). Commerce
protected-content delivery (`DurableIpfsTransport`, `InMemoryIpfsMediaStore`)
is local-disk/in-memory only, `requiresNetwork: false` self-declared and
enforced.

## 2. DNS policy (re-confirmed)

`createNodeWebSocketRelaySocketFactory()` constructs `new WebSocket(url)`
directly against the relay URL string — no proxy parameter exists anywhere
in `WebSocketFactory`/`FedosRelaySocketFactory`/`WebSocketRelay`/
`WebSocketRelayAdapter`/`WebSocketRelayPublisher`'s constructors, and no
explicit `dns.lookup`/`dns.resolve` call exists anywhere in this path.
**Plain Node/Electron DNS resolution therefore currently happens
unconditionally, before any proxy or Tor routing could apply** — the exact
condition Strict Tor mode must eliminate for every connection made while
strict mode is enabled.

## 3. What this arc must change, precisely

One composition-root binding
(`fedos_electron_beta_main.cts`'s `createNodeWebSocketRelaySocketFactory:
websocketRelaySocketFactory.createNodeWebSocketRelaySocketFactory` line) is
the entire integration surface. Every one of the ~13 call sites downstream
already shares this single binding — none of them need to change
individually. This is the "one central routing authority" the mandate
requires, already structurally true of the current code; this arc's job is
to make that one binding strict-mode-aware, not to introduce centralization
that doesn't already exist.

## 4. Electron network surface (renderer/session/CSP)

Spot-checked (not re-derived from scratch): no `webContents`-level remote
navigation, no renderer-owned `fetch`/`XMLHttpRequest` reaching a real host
(the renderer communicates with the main process exclusively via
`ipcRenderer.invoke`, confirmed by grep for `XMLHttpRequest\|fetch(` in
`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts`
and `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html`
— zero matches). All real network I/O is main-process-only, funneled
through the one factory above. No renderer-owned bypass path exists.
