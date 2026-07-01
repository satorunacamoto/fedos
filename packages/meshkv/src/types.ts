/**
 * MeshKV — shared types for the browser-to-browser public KV store.
 *
 * This is the EXTERNAL package's own surface; it knows nothing about the host
 * app (no `AssetMetadata`, no `AssetCache`). The host adapts to it via
 * `MeshKVClient` in `src/asset/meshkv_browser_client.ts`.
 */

/** Opaque descriptive metadata a record carries. MeshKV does not interpret it. */
export type MeshKVMeta = Record<string, unknown>;

/** A stored record: opaque bytes plus opaque metadata. */
export interface MeshKVRecord {
  readonly value: ArrayBuffer;
  readonly meta: MeshKVMeta;
}

/**
 * The MeshKV public API. A real mesh implementation and the in-process default
 * both satisfy this. The host's browser-client adapter depends on this contract
 * only, never on the concrete classes.
 */
export interface MeshKVApi {
  get(key: string): Promise<MeshKVRecord | null>;
  set(key: string, value: ArrayBuffer, meta?: MeshKVMeta): Promise<void>;
  has(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  clearAll(): Promise<void>;
}
