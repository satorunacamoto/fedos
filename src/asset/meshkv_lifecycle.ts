/**
 * Stage 32 — MeshKV browser LIFECYCLE boundary.
 *
 * This is the explicit, separate place where a MeshKV node is brought online or
 * offline. Stage 31 wired a `MeshKVBrowserClient` into the runtime as an OPT-IN
 * asset-cache selection, but selecting the adapter starts no network. Going
 * online (opening signaling / joining the WebRTC peer mesh) is deliberately kept
 * OUT of `createRuntime` and the Worker — it happens ONLY when a caller drives
 * this lifecycle.
 *
 * GUARDRAILS:
 *   - The constructor does NOTHING: it opens no store, no signaling socket, no
 *     WebRTC link, and starts no peer discovery.
 *   - `prepare()` only WIRES the node (`init`); it opens no socket.
 *   - `goOnline()` is the FIRST call that may start signaling / peer connect.
 *   - `goOffline()` tears the mesh down (`stop`).
 *   - Every step is idempotent (double-calls are safe) and failures land the
 *     lifecycle in `error` rather than throwing raw.
 *   - Nothing here is auto-wired into the runtime or Worker. WebRTC / signaling /
 *     peer discovery begin only through `goOnline()`.
 *
 * The node this drives must expose the online/offline steps (`init` +
 * `startSignaling` + `stop`), which the reference `MeshKV` node satisfies. A real
 * browser MeshKV would be adapted to this shape (e.g. `signal.connect()` →
 * `startSignaling`, `signal.close()` → `stop`). MeshKV carries PUBLIC bytes only;
 * this boundary adds no cache, policy, or data path.
 */

import type { MeshKVInitOptions } from "../../packages/meshkv/src/index.js";

/** The observable lifecycle states of a MeshKV node. */
export type MeshKVLifecycleState =
  | "idle" // constructed; nothing wired, nothing online
  | "prepared" // `init` (wiring) done; still offline
  | "online" // signaling opened + peer mesh joined
  | "offline" // explicitly torn down after being prepared/online
  | "error"; // a lifecycle step failed

/**
 * The online/offline-capable node a lifecycle drives. `init` wires handlers (no
 * socket); `startSignaling` is the explicit online step; `stop` tears down. The
 * reference `MeshKV` node satisfies this structurally.
 */
export interface MeshKVLifecycleNode {
  init(options?: MeshKVInitOptions): Promise<void>;
  startSignaling(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * The lifecycle boundary. Callers use it to move a MeshKV node between offline
 * and online EXPLICITLY. It is never invoked by the runtime or Worker.
 */
export interface MeshKVLifecycle {
  /** The current state (pure read; touches no network). */
  getState(): MeshKVLifecycleState;
  /** Wire the node (`init`) only — opens no socket. Idempotent. */
  prepare(): Promise<MeshKVLifecycleState>;
  /** Bring the node online (signaling + peer connect). Idempotent. */
  goOnline(): Promise<MeshKVLifecycleState>;
  /** Take the node offline (`stop`). Idempotent. */
  goOffline(): Promise<MeshKVLifecycleState>;
}

export interface MeshKVBrowserLifecycleOptions {
  /** The node to drive. The lifecycle calls no method on it until `prepare()`. */
  readonly node: MeshKVLifecycleNode;
  /**
   * Options handed to `node.init()` during `prepare()`/`goOnline()`. Supplying a
   * `signal` WIRES the mesh handlers but still opens no socket. Never mutated.
   */
  readonly initOptions?: MeshKVInitOptions;
}

/** Normalizes any thrown value to an `Error` for the `error` state. */
function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * `MeshKVLifecycle` over a `MeshKVLifecycleNode`. Constructing it does nothing;
 * each transition is explicit and idempotent. A failed step sets `error` and
 * records the cause (`lastError`) instead of propagating.
 */
export class MeshKVBrowserLifecycle implements MeshKVLifecycle {
  readonly #node: MeshKVLifecycleNode;
  readonly #initOptions: MeshKVInitOptions | undefined;
  #state: MeshKVLifecycleState = "idle";
  #lastError: Error | undefined;

  constructor(options: MeshKVBrowserLifecycleOptions) {
    this.#node = options.node;
    this.#initOptions = options.initOptions;
    // No init/startSignaling/stop here: construction opens nothing and starts
    // no signaling, WebRTC, or peer discovery.
  }

  getState(): MeshKVLifecycleState {
    return this.#state;
  }

  /** The last failure that moved the lifecycle to `error`, if any. */
  getLastError(): Error | undefined {
    return this.#lastError;
  }

  async prepare(): Promise<MeshKVLifecycleState> {
    // Already wired or online: nothing to do (double prepare is safe).
    if (this.#state === "prepared" || this.#state === "online") return this.#state;
    try {
      await this.#node.init(this.#initOptions);
      this.#lastError = undefined;
      this.#state = "prepared";
    } catch (err) {
      this.#lastError = toError(err);
      this.#state = "error";
    }
    return this.#state;
  }

  async goOnline(): Promise<MeshKVLifecycleState> {
    // Already online: do not re-open signaling (double goOnline is safe).
    if (this.#state === "online") return this.#state;
    try {
      // Ensure the node is wired before the FIRST online step.
      if (this.#state !== "prepared") {
        await this.#node.init(this.#initOptions);
        this.#state = "prepared";
      }
      await this.#node.startSignaling();
      this.#lastError = undefined;
      this.#state = "online";
    } catch (err) {
      this.#lastError = toError(err);
      this.#state = "error";
    }
    return this.#state;
  }

  async goOffline(): Promise<MeshKVLifecycleState> {
    // Already offline: nothing to tear down (double goOffline is safe).
    if (this.#state === "offline") return this.#state;
    try {
      await this.#node.stop();
      this.#lastError = undefined;
      this.#state = "offline";
    } catch (err) {
      this.#lastError = toError(err);
      this.#state = "error";
    }
    return this.#state;
  }
}

/**
 * Factory for a `MeshKVLifecycle` over a node. Constructing the lifecycle starts
 * NO network — the returned object is idle until a caller explicitly drives it.
 */
export function createMeshKVLifecycle(
  node: MeshKVLifecycleNode,
  initOptions?: MeshKVInitOptions,
): MeshKVLifecycle {
  return new MeshKVBrowserLifecycle({
    node,
    ...(initOptions !== undefined ? { initOptions } : {}),
  });
}
