/**
 * Secure Runtime Alpha 1266/1290 ("Runtime Secret Ownership" / "Production
 * Configuration Contract") — Phase B of the Alpha 1261–1320 Production
 * Conversation Crypto Runtime Activation Arc.
 *
 * A dedicated, minimal, file-based port for the ALREADY-SEALED Master Seed
 * envelope (`FedosSealedMasterSeedEnvelopeV1`, `./fedos_sealed_master_seed_envelope.ts`,
 * Alpha 435, unmodified) — mirrors this codebase's own established
 * "one port per durable concern, no database vocabulary" discipline
 * (`FedosConversationPersistence`, etc.), extended here to a SECRET-adjacent
 * artifact for the first time: the envelope this port reads and writes is
 * ALREADY sealed (Argon2id-wrapped ChaCha20-Poly1305 ciphertext) before it
 * ever reaches this file — this port performs NO cryptography, reads NO
 * plaintext seed byte, and accepts NO passphrase. It only moves an
 * opaque `.json` string to and from one file.
 *
 * Alpha 1268's own "prefer explicit creation, never silently replace a
 * corrupt/unreadable seed" decision is enforced structurally, not by
 * caller discipline: `writeIfAbsent()` NEVER overwrites an existing file
 * — a second seal attempt against an already-occupied path is a
 * `"already-exists"` refusal, mirroring every append-only port in this
 * codebase's own "no update, no delete, no silent rewrite" contract. There
 * is deliberately no `overwrite()`/`delete()` method of any kind.
 *
 * `read()` distinguishes "no seed ever sealed here" (`null`, an ordinary,
 * expected first-run state) from "a file exists but is not a
 * structurally well-formed sealed envelope" (THROWS, matching this
 * codebase's own established "one corrupt record voids the backend"
 * precedent — Alpha 1296's own "fail closed, never overwrite the corrupt
 * sealed seed automatically" requirement). This is only a structural
 * pre-check (`isWellFormedSealedMasterSeedEnvelopeV1Json()`, Alpha 435,
 * unmodified) — REAL authentication of the sealed bytes happens
 * exclusively inside Rust's `restore_sealed()`, exactly as that file's
 * own header already states; a passphrase-mismatched or
 * ciphertext-tampered envelope that is still structurally well-formed
 * passes this port's own read cleanly and fails closed later, inside
 * `FedosMasterSeedAuthority.restoreSealed()`.
 *
 * HARD GUARDRAILS:
 *   - No plaintext seed byte, no passphrase, no derived key ever appears
 *     in, or is derivable from, this file.
 *   - No overwrite/compaction method. FedOS Peer Device Discovery Arc P0
 *     Closure (Agent F) adds exactly ONE narrowly-scoped `delete()` — it
 *     removes only the ONE sealed-envelope file this port was itself
 *     constructed against, nothing else, and is reachable ONLY through
 *     `FedosProfileInitializationCoordinator#resetInterruptedProfile()`'s
 *     own guarded reset path (never called directly by a renderer/IPC
 *     handler). That guard refuses unless the profile never durably
 *     reached `"ready"`, so this method never deletes a real, ever-used
 *     seed's sealed material.
 *   - Synchronous, matching every other filesystem-backed port in this
 *     codebase (`AppendOnlyFedosConversationPersistence`, etc.).
 *
 * Architecture Dependency Closure Arc — moved here from
 * `src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.ts`
 * unmodified (a shim remains at that old path; the two root tsconfigs
 * that pinned the old path by literal string
 * (`tsconfig.beta-runtime.json`, `tsconfig.unlock-runtime.json`) were
 * updated to pin this new path instead). See
 * `docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import {
  isWellFormedSealedMasterSeedEnvelopeV1Json,
  toSealedMasterSeedEnvelopeV1,
  type FedosSealedMasterSeedEnvelopeV1,
} from "./fedos_sealed_master_seed_envelope.js";

export type FedosSealedMasterSeedEnvelopePersistenceWriteResult = "written" | "already-exists" | "failed";
/** FedOS Peer Device Discovery Arc P0 Closure (Agent F) — `"deleted"` whether or not a sealed envelope existed (idempotent), `"failed"` only on a real filesystem error. */
export type FedosSealedMasterSeedEnvelopePersistenceDeleteResult = "deleted" | "failed";

export interface FedosSealedMasterSeedEnvelopePersistence {
  /** `null` when no seed has ever been sealed at this path (an ordinary first-run state). THROWS if the file exists but is not structurally well-formed. */
  read(): FedosSealedMasterSeedEnvelopeV1 | null;
  /** NEVER overwrites an existing file — `"already-exists"` for a second attempt against the same path (Alpha 1268). */
  writeIfAbsent(envelope: FedosSealedMasterSeedEnvelopeV1): FedosSealedMasterSeedEnvelopePersistenceWriteResult;
  /** FedOS Peer Device Discovery Arc P0 Closure (Agent F) — deletes ONLY this port's own single sealed envelope file. See this file's own header for the narrow reachability guarantee. Idempotent; never throws. */
  delete(): FedosSealedMasterSeedEnvelopePersistenceDeleteResult;
}

export class FileFedosSealedMasterSeedEnvelopePersistence implements FedosSealedMasterSeedEnvelopePersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  read(): FedosSealedMasterSeedEnvelopeV1 | null {
    if (!existsSync(this.#filePath)) return null;
    const contents = (readFileSync(this.#filePath, "utf8") as string).trim();
    if (!isWellFormedSealedMasterSeedEnvelopeV1Json(contents)) {
      throw new Error(
        `FileFedosSealedMasterSeedEnvelopePersistence: file at "${this.#filePath}" exists but is not a structurally well-formed sealed Master Seed envelope.`,
      );
    }
    const envelope = toSealedMasterSeedEnvelopeV1(contents);
    if (envelope === null) {
      throw new Error(`FileFedosSealedMasterSeedEnvelopePersistence: file at "${this.#filePath}" failed envelope construction after passing its own structural pre-check.`);
    }
    return envelope;
  }

  writeIfAbsent(envelope: FedosSealedMasterSeedEnvelopeV1): FedosSealedMasterSeedEnvelopePersistenceWriteResult {
    if (existsSync(this.#filePath)) return "already-exists";
    try {
      writeFileSync(this.#filePath, envelope.json, "utf8");
    } catch {
      return "failed";
    }
    return "written";
  }

  /** FedOS Peer Device Discovery Arc P0 Closure (Agent F) — deletes ONLY `this.#filePath` (the ONE file this instance was constructed against). Idempotent: a missing file is `"deleted"`, not `"failed"`. */
  delete(): FedosSealedMasterSeedEnvelopePersistenceDeleteResult {
    try {
      if (existsSync(this.#filePath)) {
        unlinkSync(this.#filePath);
      }
      return "deleted";
    } catch {
      return "failed";
    }
  }
}
