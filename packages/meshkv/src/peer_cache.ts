/**
 * MeshKV peer cache — the mesh tier of a MeshKV node.
 *
 * Represents the browser-to-browser layer that fetches/announces records across
 * WebRTC peers. THIS PACKAGE SHIPS A BOUNDARY ONLY: constructing a peer cache
 * starts NOTHING — no WebRTC, no signaling, no peer discovery. The node joins
 * the mesh exclusively through the explicit `connect()` call, and even then this
 * boundary performs no real peer I/O in this stage (fetch → null, announce →
 * no-op). It exists so a real mesh transport can drop in behind it later.
 */

import type { SignalingChannel } from "./signaling.js";
import type { MeshKVRecord } from "./types.js";

export class PeerCache {
  #connected = false;
  #signaling: SignalingChannel | undefined;

  get connected(): boolean {
    return this.#connected;
  }

  /**
   * Explicitly joins the mesh via the (already-opened) signaling channel. No
   * WebRTC handshake / peer discovery is auto-started before this is called.
   */
  async connect(signaling: SignalingChannel): Promise<void> {
    this.#signaling = signaling;
    this.#connected = true;
  }

  async disconnect(): Promise<void> {
    this.#connected = false;
    this.#signaling = undefined;
  }

  /** Fetch a record from peers. Null when offline or not found (boundary stub). */
  async fetch(_key: string): Promise<MeshKVRecord | null> {
    if (!this.#connected) return null;
    return null; // no real peer fetch in this stage
  }

  /** Announce a record to peers. A no-op until connected (boundary stub). */
  async announce(_key: string, _record: MeshKVRecord): Promise<void> {
    // no real peer announce in this stage
  }
}
