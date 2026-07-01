# @nostr-window/meshkv

MeshKV is the browser-to-browser **public asset** KV store, kept as a standalone
package so the host app depends only on its *contract*, never on its internals.

## Two implementations, one contract (`MeshKVApi`)

- **Production runtime (browser):** the imported MeshKV project. It is a
  namespace module exporting `init` / `get` / `put` / `load` / `remove`, backed by
  IndexedDB (local tier) and WebRTC + a signaling server (mesh tier). It is
  browser-only and lives as an external checkout (git-ignored `cash/`), wired in
  by a browser build.
- **Reference node (this package, browser-free):** `MeshKV` / `createMeshKV()`
  mirror the same `MeshKVApi` surface backed by an in-process map, so the host can
  typecheck and test against the contract without a browser.

Both satisfy `MeshKVApi`, so either is a drop-in behind the host's adapter,
`MeshKVBrowserClient implements MeshKVClient` (`src/asset/meshkv_browser_client.ts`).

## API (`MeshKVApi`)

```ts
init(options?): Promise<void>   // options.signal wires the mesh; opens no socket
get(key): Promise<ArrayBuffer | null>
put(key, data, contentType?): Promise<void>
remove(key): Promise<void>
load?(url, contentType?): Promise<ArrayBuffer>   // ORIGIN FETCH — host adapter never uses it
```

The adapter maps the host's `MeshKVClient` onto this: `get→get`, `put→put`
(content-type only), `has→get≠null`, `delete→remove`. There is no bulk `clear`
(the real MeshKV exposes none), so the adapter omits it.

## No auto-network

Constructing a node — and constructing the adapter — opens **nothing**: no
signaling socket, no WebRTC, no peer discovery. `init()` only wires handlers
(even with a `signal`); going online is a separate explicit step
(`startSignaling()` here; `signal.connect()` in the browser runtime). The adapter
never calls any of these.

## Public bytes only

MeshKV stores opaque bytes + a content type. It is NOT access control, payment,
entitlement, or DRM. The host's policy layer (`canCacheAsset`, enforced in
`MeshKVAssetCache`) refuses private/paid/secret/DM/payment content before it could
ever reach this package.

```
packages/meshkv/src
  index.ts         — entry point: MeshKVApi + MeshKV/createMeshKV
  meshkv.ts        — browser-free reference node
  local_cache.ts   — in-process tier
  peer_cache.ts    — mesh tier boundary (no real WebRTC/peer I/O)
  signaling.ts     — signaling channel boundary (no real socket)
  types.ts         — MeshKVApi / MeshKVData / MeshKVInitOptions / MeshKVRecord
```
