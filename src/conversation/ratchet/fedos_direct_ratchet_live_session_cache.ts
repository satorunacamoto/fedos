/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — the in-process, in-memory-only
 * cache of live `FedosDirectRatchetCryptographicSession` handles
 * (`./fedos_direct_ratchet_cryptographic_session.js`, Alpha 5481–5560,
 * UNCHANGED). A live session handle wraps an opaque Rust/WASM object —
 * it cannot itself be serialized/persisted (Phase M's own "no Rust/WASM
 * object handles" exposure rule) and is intentionally NOT restored from
 * durable sealed state on every call: within one running process, the
 * SAME live handle is reused across every send/receive for a given
 * session id, exactly mirroring how `FedosPrivateTransport` keeps its
 * own signing/publisher objects alive for the lifetime of the Runtime.
 *
 * HARD GUARDRAILS:
 *   - Never persists anything — a pure in-memory `Map`.
 *   - `clear()`/`drop()` never touch durable state — only the Foundation
 *     Runtime's own `sealAndPersistSecret`/checkpoint helpers do that.
 */
import type { FedosDirectRatchetCryptographicSession } from "./fedos_direct_ratchet_cryptographic_session.js";
import type { FedosDirectRatchetSessionId } from "./fedos_direct_ratchet_session_id.js";

export class FedosDirectRatchetLiveSessionCache {
  readonly #sessions = new Map<string, FedosDirectRatchetCryptographicSession>();

  get(sessionId: FedosDirectRatchetSessionId): FedosDirectRatchetCryptographicSession | null {
    return this.#sessions.get(sessionId as unknown as string) ?? null;
  }

  set(sessionId: FedosDirectRatchetSessionId, session: FedosDirectRatchetCryptographicSession): void {
    this.#sessions.set(sessionId as unknown as string, session);
  }

  drop(sessionId: FedosDirectRatchetSessionId): void {
    this.#sessions.delete(sessionId as unknown as string);
  }

  /** Test/shutdown-only convenience — never called on any production hot path. */
  clear(): void {
    this.#sessions.clear();
  }
}
