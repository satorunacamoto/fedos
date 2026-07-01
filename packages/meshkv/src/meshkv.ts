/**
 * MeshKV — a browser-to-browser public KV store (external package entry point).
 *
 * A MeshKV node is local-first: every read/write hits the in-process `LocalCache`
 * immediately, and the `PeerCache` mesh tier is consulted ONLY after the node is
 * explicitly brought online. Constructing a node opens NO connection: no
 * signaling socket, no WebRTC, no peer discovery, no network of any kind. The
 * node goes online exclusively through `connect()` (aliases: `init()`/`start()`).
 *
 * This package is consumed by the host app behind an adapter
 * (`MeshKVBrowserClient implements MeshKVClient`); it has no knowledge of the
 * host's asset/cache/policy types, and the host has no knowledge of this file's
 * internals beyond the `MeshKVApi` contract.
 */

import { LocalCache } from "./local_cache.js";
import { PeerCache } from "./peer_cache.js";
import { SignalingChannel } from "./signaling.js";
import type { MeshKVApi, MeshKVMeta, MeshKVRecord } from "./types.js";

export type { MeshKVApi, MeshKVMeta, MeshKVRecord } from "./types.js";
export { LocalCache } from "./local_cache.js";
export { PeerCache } from "./peer_cache.js";
export { SignalingChannel } from "./signaling.js";

export interface MeshKVOptions {
  readonly localCache?: LocalCache;
  readonly peerCache?: PeerCache;
  readonly signaling?: SignalingChannel;
}

export class MeshKV implements MeshKVApi {
  readonly #local: LocalCache;
  readonly #peers: PeerCache;
  readonly #signaling: SignalingChannel;
  #connected = false;

  constructor(options: MeshKVOptions = {}) {
    this.#local = options.localCache ?? new LocalCache();
    this.#peers = options.peerCache ?? new PeerCache();
    this.#signaling = options.signaling ?? new SignalingChannel();
    // No connection is established here. Reads/writes work locally offline; the
    // mesh tier is dormant until connect()/init()/start() is called explicitly.
  }

  get connected(): boolean {
    return this.#connected;
  }

  get signaling(): SignalingChannel {
    return this.#signaling;
  }

  /** Explicitly goes online: opens signaling, then joins the peer mesh. */
  async connect(): Promise<void> {
    if (this.#connected) return;
    await this.#signaling.open();
    await this.#peers.connect(this.#signaling);
    this.#connected = true;
  }

  /** Alias for `connect()` — an explicit lifecycle entry point. */
  async init(): Promise<void> {
    await this.connect();
  }

  /** Alias for `connect()` — an explicit lifecycle entry point. */
  async start(): Promise<void> {
    await this.connect();
  }

  /** Leaves the mesh and closes signaling. Local data is retained. */
  async close(): Promise<void> {
    await this.#peers.disconnect();
    await this.#signaling.close();
    this.#connected = false;
  }

  async get(key: string): Promise<MeshKVRecord | null> {
    const local = this.#local.get(key);
    if (local) return local;
    if (this.#connected) {
      const remote = await this.#peers.fetch(key);
      if (remote) {
        this.#local.set(key, remote);
        return remote;
      }
    }
    return null;
  }

  async set(key: string, value: ArrayBuffer, meta: MeshKVMeta = {}): Promise<void> {
    const record: MeshKVRecord = { value, meta };
    this.#local.set(key, record);
    if (this.#connected) await this.#peers.announce(key, record);
  }

  async has(key: string): Promise<boolean> {
    if (this.#local.has(key)) return true;
    if (this.#connected) return (await this.#peers.fetch(key)) !== null;
    return false;
  }

  async remove(key: string): Promise<void> {
    this.#local.delete(key);
  }

  async clearAll(): Promise<void> {
    this.#local.clear();
  }
}
