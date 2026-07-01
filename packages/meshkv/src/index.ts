/**
 * @nostr-window/meshkv — public entry point (stable import surface).
 *
 * Exports the MeshKV public API contract (`MeshKVApi`) and a browser-free
 * reference node (`MeshKV` / `createMeshKV`). The production runtime is the
 * vendored browser MeshKV (`cash/src/index.js`), a namespace module exporting
 * `init`/`get`/`put`/`load`/`remove` that satisfies `MeshKVApi` structurally.
 *
 * The host app depends ONLY on `MeshKVApi` (through its own `MeshKVClient`
 * adapter, `src/asset/meshkv_browser_client.ts`) — never on either
 * implementation's internals.
 */

import { MeshKV } from "./meshkv.js";
import type { MeshKVOptions } from "./meshkv.js";

export { MeshKV } from "./meshkv.js";
export type { MeshKVOptions } from "./meshkv.js";
export type {
  MeshKVApi,
  MeshKVData,
  MeshKVInitOptions,
  MeshKVRecord,
} from "./types.js";
export { LocalCache } from "./local_cache.js";
export { PeerCache } from "./peer_cache.js";
export { SignalingChannel } from "./signaling.js";

/** Creates a fresh browser-free reference node satisfying `MeshKVApi`. */
export function createMeshKV(options?: MeshKVOptions): MeshKV {
  return new MeshKV(options);
}
