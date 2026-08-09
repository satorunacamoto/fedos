/**
 * Stage 1 ingest pipeline — pure, deterministic, side-effect free.
 *
 * Raw (untrusted) values from a relay are:
 *   1. structurally validated against NIP-01,
 *   2. de-duplicated by id (within the batch and against `seenIds`),
 *   3. normalized into `IngestedEvent` records.
 *
 * Persistence (D1/KV/R2) and signature/id verification are deliberately out of
 * scope here; they layer on top of this pure core in later stages.
 */

import { validateEventStructure } from "../../../nostr/event.js";
import type { NostrEvent } from "../../../nostr/types.js";
import type { SignatureVerifier } from "../../../nostr/signature.js";
import type {
  IngestContext,
  IngestResult,
  IngestedEvent,
  RejectedEvent,
} from "./types.js";

/** Removes duplicate events by id, keeping the first occurrence. */
export function dedupeById(events: NostrEvent[]): NostrEvent[] {
  const seen = new Set<string>();
  const out: NostrEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
  }
  return out;
}

/**
 * Runs a batch of raw values through validation + dedupe + normalization.
 *
 * Without a verifier this is pure and synchronous (Stage 1 behavior). When a
 * `SignatureVerifier` is supplied, the result is a Promise and each structurally
 * valid, non-duplicate event must also pass `verify`; events that fail are moved
 * to `rejected` with a `sig` issue.
 */
export function ingestRawEvents(
  raw: readonly unknown[],
  ctx: IngestContext,
): IngestResult;
export function ingestRawEvents(
  raw: readonly unknown[],
  ctx: IngestContext,
  signatureVerifier: SignatureVerifier,
): Promise<IngestResult>;
export function ingestRawEvents(
  raw: readonly unknown[],
  ctx: IngestContext,
  signatureVerifier?: SignatureVerifier,
): IngestResult | Promise<IngestResult> {
  if (signatureVerifier) {
    return ingestWithVerification(raw, ctx, signatureVerifier);
  }

  const accepted: IngestedEvent[] = [];
  const rejected: RejectedEvent[] = [];
  const seen = new Set<string>(ctx.seenIds ?? []);
  let duplicates = 0;

  for (const value of raw) {
    const issues = validateEventStructure(value);
    if (issues.length > 0) {
      rejected.push({ value, issues });
      continue;
    }

    // Safe: validateEventStructure passing implies the NostrEvent shape.
    const event = value as NostrEvent;

    if (seen.has(event.id)) {
      duplicates++;
      continue;
    }
    seen.add(event.id);

    accepted.push({
      event,
      relayUrl: ctx.relayUrl,
      ingestedAt: ctx.now,
    });
  }

  return { accepted, rejected, duplicates };
}

/** Async ingest variant that additionally enforces signature verification. */
async function ingestWithVerification(
  raw: readonly unknown[],
  ctx: IngestContext,
  verifier: SignatureVerifier,
): Promise<IngestResult> {
  const accepted: IngestedEvent[] = [];
  const rejected: RejectedEvent[] = [];
  const seen = new Set<string>(ctx.seenIds ?? []);
  let duplicates = 0;

  for (const value of raw) {
    const issues = validateEventStructure(value);
    if (issues.length > 0) {
      rejected.push({ value, issues });
      continue;
    }

    const event = value as NostrEvent;

    if (seen.has(event.id)) {
      duplicates++;
      continue;
    }
    seen.add(event.id);

    const verified = await verifier.verify(event);
    if (!verified) {
      rejected.push({
        value,
        issues: [{ field: "sig", reason: "signature verification failed" }],
      });
      continue;
    }

    accepted.push({ event, relayUrl: ctx.relayUrl, ingestedAt: ctx.now });
  }

  return { accepted, rejected, duplicates };
}
