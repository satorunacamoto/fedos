/**
 * Secure Runtime Alpha 413 ("Outbox Identifier and Target Model") / Alpha
 * 414 ("Immutable Outbox Intent Model") — Stages 3–4 of the Alpha
 * 411–420 Canonical Board Durable Outbox Foundation Arc.
 *
 * The Outbox represents DELIVERY INTENT ONLY — never a Relay queue,
 * network retry implementation, Board Repository, protocol-native
 * message store, delivery confirmation, payment state, or Ontology
 * queue (see `docs/secure_runtime_alpha_412_outbox_responsibility_decision.md`).
 *
 * `FedosBoardOutboxId` (Alpha 413) is DETERMINISTICALLY derived from
 * `postId + target.protocol + target.destination` via
 * `makeFedosBoardOutboxId` — never random — so that submitting the SAME
 * logical intent twice always yields the SAME id, which is what lets
 * `FedosBoardOutboxPersistence.putIntent()`'s own
 * inserted/already-present/conflict semantics (Alpha 417) provide
 * idempotency for free, with no separate dedupe index.
 *
 * `FedosBoardOutboxTarget.destination` (Alpha 413) is inert vocabulary
 * this Arc, not an active network address: no Relay policy, no
 * ActivityPub inbox/actor URI, no AT Protocol repository authority, no
 * Session Gateway destination is ever computed or dialed here — the
 * field carries a caller-supplied opaque string or `null`.
 *
 * `FedosBoardOutboxIntent` (Alpha 414) is immutable and carries a Board
 * post BY REFERENCE ONLY (`postId`) — never a body duplicate, never
 * author-secret data, never a protocol-native payload, never a delivery
 * result, retry count, or scheduling policy. Per Alpha 414's own required
 * decision, inbound provenance NEVER determines outbound targets
 * automatically — `createFedosBoardOutboxIntent` takes an explicit,
 * caller-supplied `target`; nothing in this file reads
 * `FedosBoardPost.source` or infers a protocol from it.
 *
 * HARD GUARDRAILS:
 *   - No access token, private key, Relay socket, HTTP header, OAuth
 *     credential, Session credential, protocol-native event/record
 *     object, or free-form metadata bag anywhere in this file.
 *   - `createFedosBoardOutboxIntent` is the ONLY constructor of a
 *     `FedosBoardOutboxIntent` — fails closed (`null`) for anything
 *     malformed, mirroring `validateFedosBoardPost`
 *     (`../fedos_board_post_validator.ts`, Alpha 257). Its result is
 *     `Object.freeze`d, matching that same convention.
 *   - No mutation method, no setter, no scheduling field of any kind.
 */

import type { FedosBoardPostId } from "../fedos_board_identifiers.js";

export type FedosBoardOutboxId = string & { readonly __brand: "FedosBoardOutboxId" };

export type FedosBoardOutboundProtocol = "nostr" | "activitypub" | "atproto" | "session";

/** Every outbound protocol label (for mapping/documentation helpers). */
export const FEDOS_BOARD_OUTBOUND_PROTOCOLS: readonly FedosBoardOutboundProtocol[] = [
  "nostr",
  "activitypub",
  "atproto",
  "session",
];

export function isFedosBoardOutboundProtocol(value: string): value is FedosBoardOutboundProtocol {
  return (FEDOS_BOARD_OUTBOUND_PROTOCOLS as readonly string[]).includes(value);
}

/**
 * `destination` is inert vocabulary this Arc (see this file's own
 * header) — `null` for a publisher-selected/unspecified destination, or
 * a caller-supplied opaque string. Nothing here parses `destination`.
 */
export interface FedosBoardOutboxTarget {
  readonly protocol: FedosBoardOutboundProtocol;
  readonly destination: string | null;
}

/** Deep, frozen copy of `target` — never the caller's own reference. */
function cloneTarget(target: FedosBoardOutboxTarget): FedosBoardOutboxTarget {
  return Object.freeze({ protocol: target.protocol, destination: target.destination });
}

/**
 * Deterministic id derivation (Alpha 413): `postId + protocol +
 * destination`, joined by a separator that cannot appear inside any of
 * the three parts under this repository's own id/protocol conventions
 * (`FedosBoardPostId`/`FedosBoardOutboundProtocol` are never empty and
 * never contain `::`; `destination`, if present, is caller data and is
 * therefore included last). Two calls with logically identical inputs
 * ALWAYS produce the identical id — no randomness, no clock read.
 */
export function makeFedosBoardOutboxId(
  postId: FedosBoardPostId,
  target: FedosBoardOutboxTarget,
): FedosBoardOutboxId {
  const destinationPart = target.destination ?? "";
  return `${postId}::${target.protocol}::${destinationPart}` as FedosBoardOutboxId;
}

export interface FedosBoardOutboxIntent {
  readonly id: FedosBoardOutboxId;
  readonly postId: FedosBoardPostId;
  readonly target: FedosBoardOutboxTarget;
  readonly createdAt: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTarget(value: unknown): value is FedosBoardOutboxTarget {
  if (value === null || typeof value !== "object") return false;
  const target = value as { protocol?: unknown; destination?: unknown };
  if (typeof target.protocol !== "string" || !isFedosBoardOutboundProtocol(target.protocol)) return false;
  if (target.destination !== null && typeof target.destination !== "string") return false;
  return true;
}

function isValidCreatedAt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/**
 * The ONLY constructor of a `FedosBoardOutboxIntent` (Alpha 414). Fails
 * closed to `null` for a malformed `postId`/`target`/`createdAt` —
 * never throws. `target` is an EXPLICIT, caller-supplied parameter:
 * this function never derives it from `postId` or from any Board post
 * field, so no automatic provenance-based routing can occur here (Alpha
 * 414's own required decision).
 */
export function createFedosBoardOutboxIntent(
  postId: FedosBoardPostId,
  target: FedosBoardOutboxTarget,
  createdAt: number,
): FedosBoardOutboxIntent | null {
  if (!isNonEmptyString(postId as unknown as string)) return null;
  if (!isValidTarget(target)) return null;
  if (!isValidCreatedAt(createdAt)) return null;

  const frozenTarget = cloneTarget(target);
  return Object.freeze({
    id: makeFedosBoardOutboxId(postId, frozenTarget),
    postId,
    target: frozenTarget,
    createdAt,
  });
}
