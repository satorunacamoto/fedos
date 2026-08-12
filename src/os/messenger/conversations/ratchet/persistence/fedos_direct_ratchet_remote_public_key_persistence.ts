/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — a small, additive, PUBLIC-only
 * persistence port this integration Arc needs and no earlier Arc owns:
 * the counterparty's CURRENT ratchet DH public key
 * (`FedosDirectRatchetCryptographicSession.remoteRatchetPublicKeyHex()`,
 * Alpha 5481–5560) for a given session id, across a process restart.
 *
 * The Foundation Arc's own `FedosDirectRatchetSessionRecordV1` schema
 * (`../fedos_direct_ratchet_session_record.js`, Alpha 5401–5480) is
 * frozen and predates the Cryptographic Core Arc that introduced this
 * queryable fact — rather than widen that already-reviewed, already-
 * tested closed record shape, this Arc adds ONE small, DEDICATED,
 * separate port, mirroring `FedosDirectRatchetSessionPersistence`'s own
 * "one concern, one port" discipline exactly.
 *
 * HARD GUARDRAILS:
 *   - `remoteRatchetPublicKeyHex` is a PUBLIC DH key, never a private
 *     key, never secret-derived material of any kind — safe to persist
 *     in plain text, exactly like every other public binding fact this
 *     Arc's own session id/binding types already carry.
 *   - Last-write-wins per `sessionId` — this is a CURRENT-value cache,
 *     not an event log (there is exactly one "current remote ratchet
 *     public key" fact at any moment, unlike counters/skipped keys which
 *     are genuinely event-sourced elsewhere).
 */
import { readFileSync, appendFileSync } from "node:fs";

export interface FedosDirectRatchetRemotePublicKeyPersistence {
  putRemoteRatchetPublicKeyHex(sessionId: string, remoteRatchetPublicKeyHex: string): void;
  getRemoteRatchetPublicKeyHex(sessionId: string): string | null;
}

export class InMemoryFedosDirectRatchetRemotePublicKeyPersistence implements FedosDirectRatchetRemotePublicKeyPersistence {
  readonly #values = new Map<string, string>();

  putRemoteRatchetPublicKeyHex(sessionId: string, remoteRatchetPublicKeyHex: string): void {
    this.#values.set(sessionId, remoteRatchetPublicKeyHex);
  }

  getRemoteRatchetPublicKeyHex(sessionId: string): string | null {
    return this.#values.get(sessionId) ?? null;
  }
}

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

/** Restart-safe file-backed variant — NDJSON, last line per `sessionId` wins on replay (a current-value cache, not an event log; see this file's own header). */
export class FileFedosDirectRatchetRemotePublicKeyPersistence implements FedosDirectRatchetRemotePublicKeyPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRemoteRatchetPublicKeyHex(sessionId: string, remoteRatchetPublicKeyHex: string): void {
    appendFileSync(this.#filePath, `${JSON.stringify({ sessionId, remoteRatchetPublicKeyHex })}\n`, "utf8");
  }

  getRemoteRatchetPublicKeyHex(sessionId: string): string | null {
    let contents: string;
    try {
      contents = readFileSync(this.#filePath, "utf8") as string;
    } catch (err) {
      if (isEnoent(err)) return null;
      throw err;
    }
    let latest: string | null = null;
    for (const rawLine of contents.split("\n")) {
      const line = rawLine.trim();
      if (line.length === 0) continue;
      try {
        const parsed = JSON.parse(line) as { sessionId?: unknown; remoteRatchetPublicKeyHex?: unknown };
        if (parsed.sessionId === sessionId && typeof parsed.remoteRatchetPublicKeyHex === "string") {
          latest = parsed.remoteRatchetPublicKeyHex;
        }
      } catch {
        continue;
      }
    }
    return latest;
  }
}
