/**
 * MeshKV — browser-free REFERENCE node (mirrors the imported browser API).
 *
 * The production runtime is the vendored browser MeshKV (`cash/src/index.js`), a
 * namespace module exporting `init`/`get`/`put`/`load`/`remove` backed by
 * IndexedDB + WebRTC. This class exposes the SAME public surface (`MeshKVApi`)
 * and the SAME "no network until explicitly online" guarantee, but is backed by
 * an in-process map so the host can typecheck and test against the contract
 * without a browser. Both satisfy `MeshKVApi`, so either is a drop-in.
 *
 * Constructing a node opens NO connection: no store I/O, no signaling socket, no
 * WebRTC, no peer discovery. `init()` (optionally wiring the mesh handlers when a
 * `signal` is supplied) still opens nothing; going online is the separate,
 * explicit `startSignaling()` step — mirroring the real module, where the host
 * calls `signal.connect()` itself. `get`/`put`/`remove` are local-tier only and
 * never touch the network.
 */

import { LocalCache } from "./local_cache.js";
import { PeerCache } from "./peer_cache.js";
import { SignalingChannel } from "./signaling.js";
import type { MeshKVApi, MeshKVData, MeshKVInitOptions } from "./types.js";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export interface MeshKVOptions {
  readonly localCache?: LocalCache;
  readonly peerCache?: PeerCache;
  readonly signaling?: SignalingChannel;
}

export class MeshKV implements MeshKVApi {
  readonly #local: LocalCache;
  readonly #peers: PeerCache;
  readonly #signaling: SignalingChannel;
  #meshWired = false;

  constructor(options: MeshKVOptions = {}) {
    this.#local = options.localCache ?? new LocalCache();
    this.#peers = options.peerCache ?? new PeerCache();
    this.#signaling = options.signaling ?? new SignalingChannel();
    // Establishes nothing: no store open, no signaling, no WebRTC/peer discovery.
  }

  /** True only after signaling was explicitly opened and peers joined. */
  get online(): boolean {
    return this.#signaling.isOpen && this.#peers.connected;
  }

  /** True once `init({ signal })` wired the mesh handlers (still offline). */
  get meshWired(): boolean {
    return this.#meshWired;
  }

  get signaling(): SignalingChannel {
    return this.#signaling;
  }

  /**
   * Prepares the node. Opens the (in-memory) store and, when a `signal` is
   * supplied, WIRES the mesh handlers — but opens NO socket and starts NO
   * WebRTC/peer discovery. Going online is the separate `startSignaling()` call.
   */
  async init(options: MeshKVInitOptions = {}): Promise<void> {
    if (options.signal !== undefined) this.#meshWired = true;
    // No signaling.open(), no peers.connect(): the node stays fully offline.
  }

  /** Explicit online step: opens signaling, then joins the peer mesh. */
  async startSignaling(): Promise<void> {
    await this.#signaling.open();
    await this.#peers.connect(this.#signaling);
  }

  /** Leaves the mesh and closes signaling. Local data is retained. */
  async stop(): Promise<void> {
    await this.#peers.disconnect();
    await this.#signaling.close();
  }

  async get(key: string): Promise<MeshKVData | null> {
    const record = this.#local.get(key);
    return record ? record.data : null;
  }

  async put(
    key: string,
    data: MeshKVData,
    contentType: string = DEFAULT_CONTENT_TYPE,
  ): Promise<void> {
    this.#local.set(key, { data, contentType });
  }

  async remove(key: string): Promise<void> {
    this.#local.delete(key);
  }
}
