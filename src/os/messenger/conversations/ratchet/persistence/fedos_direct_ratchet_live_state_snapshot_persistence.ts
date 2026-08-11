/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — a small, additive, CURRENT-VALUE
 * sealed-state snapshot port this integration Arc needs and no earlier
 * Arc's own port can represent.
 *
 * The Foundation Arc's own dedicated `FedosSealedDirectRatchetSecretPersistence`
 * (`./fedos_sealed_direct_ratchet_secret_persistence.js`, Alpha 5401–5480)
 * is DELIBERATELY insert-only, one fixed key per
 * `(sessionId, secretKind, generation)` for every kind except
 * `"skipped-message-key"` (`chainCounter` is forced `null` for the other
 * four kinds by that file's own frozen validator) — correct for
 * `"skipped-message-key"` entries (each is a genuine one-shot event with
 * its own unique `chainCounter`, never re-written) but structurally unable
 * to represent the SENDING/RECEIVING CHAIN KEY, which the real Rust
 * ratchet core's own `encrypt()`/`decrypt()`
 * (`packages/fedos-core-rust/src/crypto/direct_ratchet_session.rs`)
 * genuinely advances on EVERY message within the SAME generation — a
 * second seal of a changed chain key under the identical
 * `(sessionId, secretKind, generation)` key would `"conflict"`, never
 * overwrite (confirmed by direct reproduction against the real Rust
 * boundary during this Arc's own development: a restored session built
 * from a STALE chain key snapshot combined with an up-to-date plain
 * counter decrypts/encrypts incorrectly, because `FedosDirectRatchetSession::restore()`
 * takes the given chain-key bytes literally — it never re-derives or
 * fast-forwards them from the counter).
 *
 * This port is therefore a CURRENT-VALUE cache (last-write-wins per
 * `sessionId`), not an event log — mirrors
 * `FedosDirectRatchetRemotePublicKeyPersistence`'s own identical
 * "one additive, small, dedicated port for one CURRENT public fact"
 * shape exactly, applied to the (still non-plaintext, still Rust-sealed)
 * chain-key/root-key/private-key hex strings instead of the remote
 * public key.
 *
 * HARD GUARDRAILS:
 *   - Every field here is the SAME already-sealed (Rust `seal_direct_ratchet_secret`-
 *     produced) hex ciphertext `FedosDirectRatchetCryptographicSession.sealState()`
 *     already returns — this file never seals/unseals anything itself,
 *     and never carries a raw/plaintext key of any kind.
 *   - Last-write-wins per `sessionId` ONLY — never a delete, never a
 *     cross-session read.
 */

export interface FedosDirectRatchetLiveStateSnapshotV1 {
  readonly sealedRootKey: string;
  readonly sealedSendingChainKey: string | null;
  readonly sealedReceivingChainKey: string | null;
  readonly sealedLocalRatchetPrivateKey: string;
}

export interface FedosDirectRatchetLiveStateSnapshotPersistence {
  putSnapshot(sessionId: string, snapshot: FedosDirectRatchetLiveStateSnapshotV1): void;
  getSnapshot(sessionId: string): FedosDirectRatchetLiveStateSnapshotV1 | null;
}

export class InMemoryFedosDirectRatchetLiveStateSnapshotPersistence implements FedosDirectRatchetLiveStateSnapshotPersistence {
  readonly #snapshots = new Map<string, FedosDirectRatchetLiveStateSnapshotV1>();

  putSnapshot(sessionId: string, snapshot: FedosDirectRatchetLiveStateSnapshotV1): void {
    this.#snapshots.set(sessionId, snapshot);
  }

  getSnapshot(sessionId: string): FedosDirectRatchetLiveStateSnapshotV1 | null {
    return this.#snapshots.get(sessionId) ?? null;
  }
}

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

/** Restart-safe file-backed variant — NDJSON, last line per `sessionId` wins on replay (a current-value cache, not an event log — see this file's own header). */
export class FileFedosDirectRatchetLiveStateSnapshotPersistence implements FedosDirectRatchetLiveStateSnapshotPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putSnapshot(sessionId: string, snapshot: FedosDirectRatchetLiveStateSnapshotV1): void {
    appendFileSync(this.#filePath, `${JSON.stringify({ sessionId, ...snapshot })}\n`, "utf8");
  }

  getSnapshot(sessionId: string): FedosDirectRatchetLiveStateSnapshotV1 | null {
    let contents: string;
    try {
      contents = readFileSync(this.#filePath, "utf8") as string;
    } catch (err) {
      if (isEnoent(err)) return null;
      throw err;
    }
    let latest: FedosDirectRatchetLiveStateSnapshotV1 | null = null;
    for (const rawLine of contents.split("\n")) {
      const line = rawLine.trim();
      if (line.length === 0) continue;
      try {
        const parsed = JSON.parse(line) as {
          sessionId?: unknown;
          sealedRootKey?: unknown;
          sealedSendingChainKey?: unknown;
          sealedReceivingChainKey?: unknown;
          sealedLocalRatchetPrivateKey?: unknown;
        };
        if (parsed.sessionId === sessionId && typeof parsed.sealedRootKey === "string" && typeof parsed.sealedLocalRatchetPrivateKey === "string") {
          latest = {
            sealedRootKey: parsed.sealedRootKey,
            sealedSendingChainKey: typeof parsed.sealedSendingChainKey === "string" ? parsed.sealedSendingChainKey : null,
            sealedReceivingChainKey: typeof parsed.sealedReceivingChainKey === "string" ? parsed.sealedReceivingChainKey : null,
            sealedLocalRatchetPrivateKey: parsed.sealedLocalRatchetPrivateKey,
          };
        }
      } catch {
        continue;
      }
    }
    return latest;
  }
}
