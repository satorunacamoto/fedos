/**
 * Secure Runtime Alpha 416 ("Persisted Outbox Record V1 and Codec") —
 * Stage 6 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
 * Arc.
 *
 * `FedosPersistedBoardOutboxRecordV1` is the STABLE WIRE SHAPE the
 * Outbox persistence layer writes to a backend — deliberately NOT the
 * branded runtime `FedosBoardOutboxIntent`
 * (`./fedos_board_outbox_types.ts`, Alpha 414) itself, mirroring
 * `FedosPersistedBoardPostRecordV1`'s own identical relationship to
 * `FedosBoardPost` (`../persistence/fedos_persisted_board_post_v1.ts`,
 * Alpha 313).
 *
 * `serializeFedosBoardOutboxIntent`/`deserializeFedosBoardOutboxIntent`
 * are the ONLY two functions permitted to convert between the two,
 * mirroring `fedos_board_post_codec.ts`'s own Alpha 314 role exactly:
 * deserialize fails closed to `null` for anything malformed, never
 * throws; `schemaVersion` is checked EXACTLY against `1`; unknown
 * top-level AND nested `target` fields are REJECTED, not silently
 * ignored; no implicit coercion; no Board-post-body duplication of any
 * kind (this record never carries `body`, `author`, `threadId`, or any
 * other Board-post field — only the opaque `postId` reference).
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosBoardOutboxIntent` never throws.
 *   - No silent migration: an unrecognized `schemaVersion` is rejected,
 *     never guessed at.
 *   - `serializeFedosBoardOutboxIntent` deep-copies `intent` into a
 *     fresh plain object — no shared reference with `intent.target`.
 */

import {
  createFedosBoardOutboxIntent,
  isFedosBoardOutboundProtocol,
  type FedosBoardOutboxIntent,
  type FedosBoardOutboundProtocol,
} from "./fedos_board_outbox_types.js";
import { toFedosBoardPostId } from "../fedos_board_identifiers.js";

export interface FedosPersistedBoardOutboxRecordV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly postId: string;
  readonly target: {
    readonly protocol: FedosBoardOutboundProtocol;
    readonly destination: string | null;
  };
  readonly createdAt: number;
}

/** Deep-copies `intent` into the persisted V1 wire shape. Never mutates or shares `intent.target`. */
export function serializeFedosBoardOutboxIntent(
  intent: FedosBoardOutboxIntent,
): FedosPersistedBoardOutboxRecordV1 {
  return {
    schemaVersion: 1,
    id: intent.id,
    postId: intent.postId,
    target: {
      protocol: intent.target.protocol,
      destination: intent.target.destination,
    },
    createdAt: intent.createdAt,
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(["schemaVersion", "id", "postId", "target", "createdAt"]);
const TARGET_KEYS: ReadonlySet<string> = new Set(["protocol", "destination"]);

function hasOnlyAllowedKeys(value: object, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

interface RawTargetFields {
  readonly protocol: unknown;
  readonly destination: unknown;
}

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly postId: unknown;
  readonly target: unknown;
  readonly createdAt: unknown;
}

function readTarget(value: unknown): { protocol: FedosBoardOutboundProtocol; destination: string | null } | null {
  if (value === null || typeof value !== "object") return null;
  if (!hasOnlyAllowedKeys(value, TARGET_KEYS)) return null;
  const { protocol, destination } = value as RawTargetFields;
  if (typeof protocol !== "string" || !isFedosBoardOutboundProtocol(protocol)) return null;
  if (destination !== null && typeof destination !== "string") return null;
  return { protocol, destination };
}

/**
 * Fails closed to `null` for any malformed, unrecognized-schema, or
 * corrupt input. Reuses `createFedosBoardOutboxIntent` (Alpha 414) for
 * the final construction/validation step, never re-implementing its
 * checks. Deliberately does NOT trust the record's own `id` field
 * blindly: it re-derives the id from `postId`/`target` via
 * `createFedosBoardOutboxIntent` -> `makeFedosBoardOutboxId`, and
 * rejects the record if the stored `id` does not match — a tampered or
 * hand-edited log line can never resurrect a mismatched id.
 */
export function deserializeFedosBoardOutboxIntent(record: unknown): FedosBoardOutboxIntent | null {
  if (record === null || typeof record !== "object") return null;
  if (!hasOnlyAllowedKeys(record, TOP_LEVEL_KEYS)) return null;

  const { schemaVersion, id, postId, target, createdAt } = record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof postId !== "string") return null;
  if (typeof createdAt !== "number") return null;

  const brandedPostId = toFedosBoardPostId(postId);
  if (brandedPostId === null) return null;

  const parsedTarget = readTarget(target);
  if (parsedTarget === null) return null;

  const intent = createFedosBoardOutboxIntent(brandedPostId, parsedTarget, createdAt);
  if (intent === null) return null;
  if (intent.id !== id) return null;

  return intent;
}
