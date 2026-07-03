/**
 * Stage 107 — Storage backend implementations.
 *
 * Two safe defaults for the `StorageBackend` seam (see `./types.js`). NEITHER
 * calls the Google Drive API, opens a Nostr relay WebSocket, touches SQLite,
 * a Bluetooth/Wi-Fi mesh, or an IPFS gateway, performs file IO, or issues a
 * `fetch`. Every method is total and never throws, and neither implementation
 * stores or returns a byte.
 *
 *   - `NoopStorageBackend` is the permanently `unavailable` default: it
 *     denies every `put`/`get`/`delete`.
 *   - `PlaceholderStorageBackend` (dev/test) evaluates the placeholder policy
 *     (see `./policy.js`) for `put` and returns `accepted_placeholder` or
 *     `rejected` — but stores NOTHING. `get` always resolves `unavailable`
 *     (nothing is ever stored in this stage, so there is never anything to
 *     find), and `delete` is a safe no-op that always resolves
 *     `accepted_placeholder`.
 *
 * These exist so callers can depend on the seam without a real backend,
 * exactly as the app depends on mock/no-op defaults elsewhere. NEITHER is
 * wired into the runtime or Worker.
 */

import { reviewStoragePacket } from "./policy.js";
import type {
  StorageBackend,
  StorageDecision,
  StoragePacket,
  StorageReadDecision,
  StorageRef,
} from "./types.js";

export class NoopStorageBackend implements StorageBackend {
  constructor() {
    // Does nothing: no backend, network, or file handle is opened.
  }

  getStatus(): StorageDecision {
    return { allowed: false, state: "unavailable", reason: "no storage backend is configured" };
  }

  async put(_packet: StoragePacket): Promise<StorageDecision> {
    // Reads nothing from the packet; stores nothing; contacts no backend.
    return {
      allowed: false,
      state: "unavailable",
      reason: "no storage backend is configured (nothing stored)",
    };
  }

  async get(_ref: StorageRef): Promise<StorageReadDecision> {
    return {
      allowed: false,
      state: "unavailable",
      reason: "no storage backend is configured (nothing to read)",
    };
  }

  async delete(_ref: StorageRef): Promise<StorageDecision> {
    return {
      allowed: false,
      state: "unavailable",
      reason: "no storage backend is configured (nothing to delete)",
    };
  }
}

/**
 * A dev/test backend that models the decision flow WITHOUT storing anything.
 * `put` evaluates `reviewStoragePacket` and returns its decision; `get`
 * always resolves `unavailable` (this stage stores nothing, so there is
 * never anything to find); `delete` is a safe no-op that always succeeds. An
 * `accepted_placeholder` result means the packet is policy-clean, NOT that
 * anything was persisted.
 */
export class PlaceholderStorageBackend implements StorageBackend {
  constructor() {
    // Does nothing: no backend is contacted.
  }

  getStatus(): StorageDecision {
    return {
      allowed: true,
      state: "accepted_placeholder",
      reason: "placeholder backend is ready (nothing is stored)",
    };
  }

  async put(packet: StoragePacket): Promise<StorageDecision> {
    // Policy decision only — never mutates the packet and never stores it.
    return reviewStoragePacket(packet);
  }

  async get(_ref: StorageRef): Promise<StorageReadDecision> {
    // Nothing is ever stored in this stage, so nothing can ever be found.
    return {
      allowed: false,
      state: "unavailable",
      reason: "nothing was ever stored in this stage (no bytes to find)",
    };
  }

  async delete(_ref: StorageRef): Promise<StorageDecision> {
    // Safe no-op: nothing was ever stored, so there is nothing to remove.
    return {
      allowed: true,
      state: "accepted_placeholder",
      reason: "delete is a safe no-op (nothing was ever stored)",
    };
  }
}
