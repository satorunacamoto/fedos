/**
 * Secure Runtime Alpha 5961–6040 — Append-Only Ratchet Reset Link
 * Persistence. Mirrors every other append-only backend in this domain:
 * independent log file, insert-only, deterministic replay, fail-closed
 * on corruption.
 */
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  decodeFedosIdentityTransitionRatchetResetLinkV1,
  encodeFedosIdentityTransitionRatchetResetLinkV1,
  fedosIdentityTransitionRatchetResetLinkKey,
  fedosIdentityTransitionRatchetResetLinksAreEqual,
  type FedosIdentityTransitionRatchetResetLinkPersistence,
  type FedosIdentityTransitionRatchetResetLinkV1,
} from "../fedos_identity_transition_ratchet_reset_link.js";

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

function replayLog(filePath: string): FedosIdentityTransitionRatchetResetLinkV1[] {
  const contents = readLogFile(filePath);
  const links: FedosIdentityTransitionRatchetResetLinkV1[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosIdentityTransitionRatchetResetLinkV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosIdentityTransitionRatchetResetLinkPersistence: corrupt or schema-invalid record found in log file.");
    }
    links.push(parsed);
  }
  return links;
}

export class AppendOnlyFedosIdentityTransitionRatchetResetLinkPersistence implements FedosIdentityTransitionRatchetResetLinkPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putLink(link: FedosIdentityTransitionRatchetResetLinkV1): "inserted" | "already-present" | "conflict" | "failed" {
    const key = fedosIdentityTransitionRatchetResetLinkKey(link);
    const existing = replayLog(this.#filePath).find((l) => fedosIdentityTransitionRatchetResetLinkKey(l) === key) ?? null;
    if (existing !== null) {
      return fedosIdentityTransitionRatchetResetLinksAreEqual(existing, link) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, encodeFedosIdentityTransitionRatchetResetLinkV1(link) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  listLinksForTransition(transitionId: string): readonly FedosIdentityTransitionRatchetResetLinkV1[] {
    return replayLog(this.#filePath).filter((l) => l.transitionId === transitionId);
  }

  listLinks(): readonly FedosIdentityTransitionRatchetResetLinkV1[] {
    return replayLog(this.#filePath);
  }
}
