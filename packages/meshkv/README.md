# @nostr-window/meshkv

MeshKV is the browser-to-browser **public asset** KV store, kept as a standalone
package so it can be swapped for the real upstream MeshKV project without the
host app depending on its internals.

- **Local-first.** Every read/write hits the in-process `LocalCache`. The mesh
  tier (`PeerCache`) is consulted only after the node is explicitly online.
- **No auto-network.** Constructing a `MeshKV` opens nothing — no signaling
  socket, no WebRTC, no peer discovery. Call `connect()` (aliases `init()` /
  `start()`) to go online; `close()` to leave.
- **Public bytes only.** MeshKV stores opaque bytes + opaque metadata. It is NOT
  access control, payment, entitlement, or DRM. The host's policy layer
  (`canCacheAsset`) decides what may be written — private/paid/secret content is
  refused before it ever reaches this package.

The host app consumes MeshKV through an adapter,
`MeshKVBrowserClient implements MeshKVClient` (in
`src/asset/meshkv_browser_client.ts`). The host depends only on the
`MeshKVApi` contract, never on the classes in this package.

```
packages/meshkv/src
  meshkv.ts        — MeshKV node (entry point) + MeshKVApi
  local_cache.ts   — in-process tier
  peer_cache.ts    — mesh tier boundary (no real WebRTC/peer I/O yet)
  signaling.ts     — signaling channel boundary (no real socket yet)
  types.ts         — MeshKVApi / MeshKVRecord / MeshKVMeta
```
