/**
 * Secure Runtime Alpha 314 ("Board Serialization and Deserialization
 * Boundary") — Stage 4 of the Alpha 311–320 Canonical Board Persistence
 * Boundary Arc.
 *
 * The ONLY two functions permitted to convert between the runtime
 * `FedosBoardPost` (`../fedos_board_post.js`, Alpha 255) and the
 * persisted wire shape `FedosPersistedBoardPostRecordV1`
 * (`./fedos_persisted_board_post_v1.js`, Alpha 313).
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosBoardPost` fails closed: returns `null` for any
 *     malformed input, never throws.
 *   - No implicit coercion — `typeof` checks only.
 *   - `schemaVersion` is checked EXACTLY against `1` — an unknown
 *     future schema is rejected, never guessed at or migrated.
 *   - Unknown fields (top-level AND nested `author`/`source`) are
 *     REJECTED, not silently ignored — see this Stage's own design doc
 *     §5.
 *   - `deserializeFedosBoardPost` reuses `validateFedosBoardPost`
 *     (Alpha 257, unmodified) rather than re-implementing any of its
 *     own checks.
 *   - No mutation, no JSON string produced or parsed anywhere in this
 *     file (see design doc §3).
 */

import { validateFedosBoardPost, type FedosBoardPostInput } from "../fedos_board_post_validator.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import { isFedosBoardSourceProtocol } from "../fedos_board_source.js";
import type { FedosPersistedBoardPostRecordV1 } from "./fedos_persisted_board_post_v1.js";

/** Deep-copies `post` into the persisted V1 wire shape. No JSON step -- see design doc §3. */
export function serializeFedosBoardPost(post: FedosBoardPost): FedosPersistedBoardPostRecordV1 {
  return {
    schemaVersion: 1,
    id: post.id,
    boardId: post.boardId,
    threadId: post.threadId,
    replyTo: post.replyTo,
    author: {
      identityId: post.author.identityId,
      protocol: post.author.protocol,
      publicIdentifier: post.author.publicIdentifier,
    },
    body: post.body,
    createdAt: post.createdAt,
    source: {
      protocol: post.source.protocol,
      reference: post.source.reference,
    },
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "id",
  "boardId",
  "threadId",
  "replyTo",
  "author",
  "body",
  "createdAt",
  "source",
]);

const AUTHOR_KEYS: ReadonlySet<string> = new Set(["identityId", "protocol", "publicIdentifier"]);
const SOURCE_KEYS: ReadonlySet<string> = new Set(["protocol", "reference"]);

function hasOnlyAllowedKeys(value: object, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

interface RawAuthorFields {
  readonly identityId: unknown;
  readonly protocol: unknown;
  readonly publicIdentifier: unknown;
}

interface RawSourceFields {
  readonly protocol: unknown;
  readonly reference: unknown;
}

function readAuthor(value: unknown): FedosBoardPostInput["author"] | null {
  if (value === null || typeof value !== "object") return null;
  if (!hasOnlyAllowedKeys(value, AUTHOR_KEYS)) return null;
  const { identityId, protocol, publicIdentifier } = value as RawAuthorFields;
  if (identityId !== null && typeof identityId !== "string") return null;
  if (typeof protocol !== "string" || !isFedosBoardSourceProtocol(protocol)) return null;
  if (typeof publicIdentifier !== "string") return null;
  return { identityId, protocol, publicIdentifier };
}

function readSource(value: unknown): FedosBoardPostInput["source"] | null {
  if (value === null || typeof value !== "object") return null;
  if (!hasOnlyAllowedKeys(value, SOURCE_KEYS)) return null;
  const { protocol, reference } = value as RawSourceFields;
  if (typeof protocol !== "string" || !isFedosBoardSourceProtocol(protocol)) return null;
  if (typeof reference !== "string") return null;
  return { protocol, reference };
}

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly boardId: unknown;
  readonly threadId: unknown;
  readonly replyTo: unknown;
  readonly author: unknown;
  readonly body: unknown;
  readonly createdAt: unknown;
  readonly source: unknown;
}

/**
 * Fails closed to `null` for any malformed, unrecognized-schema, or
 * corrupt input. Reuses `validateFedosBoardPost` (Alpha 257) for every
 * check that boundary already performs -- never re-implemented here.
 */
export function deserializeFedosBoardPost(record: unknown): FedosBoardPost | null {
  if (record === null || typeof record !== "object") return null;
  if (!hasOnlyAllowedKeys(record, TOP_LEVEL_KEYS)) return null;

  const { schemaVersion, id, boardId, threadId, replyTo, author, body, createdAt, source } =
    record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof boardId !== "string") return null;
  if (typeof threadId !== "string") return null;
  if (replyTo !== null && typeof replyTo !== "string") return null;
  if (typeof body !== "string") return null;
  if (typeof createdAt !== "number") return null;

  const parsedAuthor = readAuthor(author);
  if (parsedAuthor === null) return null;

  const parsedSource = readSource(source);
  if (parsedSource === null) return null;

  const input: FedosBoardPostInput = {
    id,
    boardId,
    threadId,
    replyTo,
    author: parsedAuthor,
    body,
    createdAt,
    source: parsedSource,
  };

  return validateFedosBoardPost(input);
}
