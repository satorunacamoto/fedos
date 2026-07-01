/**
 * MeshKV local cache — the in-process tier of a MeshKV node.
 *
 * A plain key→record map. It is purely local: no network, no peers, no
 * signaling. The mesh tier (`PeerCache`) sits on top and is only consulted once
 * the node is explicitly connected.
 */

import type { MeshKVRecord } from "./types.js";

export class LocalCache {
  readonly #store = new Map<string, MeshKVRecord>();

  get size(): number {
    return this.#store.size;
  }

  get(key: string): MeshKVRecord | undefined {
    return this.#store.get(key);
  }

  set(key: string, record: MeshKVRecord): void {
    this.#store.set(key, record);
  }

  has(key: string): boolean {
    return this.#store.has(key);
  }

  delete(key: string): boolean {
    return this.#store.delete(key);
  }

  clear(): void {
    this.#store.clear();
  }
}
