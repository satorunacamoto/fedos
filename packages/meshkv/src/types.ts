/**
 * MeshKV — shared types for the browser-to-browser public KV store.
 *
 * This is the EXTERNAL package's own surface; it knows nothing about the host
 * app (no `AssetMetadata`, no `AssetCache`, no policy). The host adapts to it via
 * `MeshKVClient` in `src/asset/meshkv_browser_client.ts`.
 *
 * `MeshKVApi` deliberately mirrors the imported browser implementation
 * (`cash/src/index.js`, a namespace module exporting `init`/`get`/`put`/`load`/
 * `remove`) so that real module is a structural drop-in for this contract.
 */

/** Opaque binary payload MeshKV stores and serves. */
export type MeshKVData = ArrayBuffer;

/**
 * Options accepted by `init()`. Providing `signal` WIRES the mesh handlers, but
 * opens no socket by itself — going online is a separate explicit step.
 */
export interface MeshKVInitOptions {
  readonly dbName?: string;
  readonly maxSizeBytes?: number;
  /** A signaling client. Its presence enables P2P wiring; it opens nothing here. */
  readonly signal?: unknown;
  /** ICE servers for the WebRTC layer (unused until online). */
  readonly iceServers?: readonly unknown[];
}

/**
 * The public MeshKV API. Matches the imported browser module's exports. `load`
 * is optional here because it performs an ORIGIN FETCH and is deliberately NOT
 * used by the host cache adapter (which only reads/writes the local tier).
 */
export interface MeshKVApi {
  init(options?: MeshKVInitOptions): Promise<void>;
  get(key: string): Promise<MeshKVData | null>;
  put(key: string, data: MeshKVData, contentType?: string): Promise<void>;
  remove(key: string): Promise<void>;
  load?(url: string, contentType?: string): Promise<MeshKVData>;
}

/** A stored record: opaque bytes plus their content type (mirrors the real store). */
export interface MeshKVRecord {
  readonly data: MeshKVData;
  readonly contentType: string;
}
