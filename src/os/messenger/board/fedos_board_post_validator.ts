/**
 * Secure Runtime Alpha 257 ("Canonical Board Validation Boundary") —
 * Stage 7 of the Alpha 251–260 Canonical Board Model Foundation Arc.
 *
 * The ONLY place in this repository that constructs a `FedosBoardPost`
 * (`./fedos_board_post.ts`, Alpha 255). DECISION (Alpha 257): a TYPED
 * BUILDER ("Option B" of this Arc's own instruction), not an
 * `unknown`-input parser — a future Protocol Adapter maps an already
 * protocol-verified native object (a `FedosValidatedNostrEvent`, a
 * verified ActivityPub object, an AT Protocol record, a Session gateway
 * message) into a small, typed `FedosBoardPostInput` FIRST, using its own
 * protocol-specific knowledge, and hands the result here. This boundary's
 * own job is Board-model validation ONLY — it performs no cryptographic
 * verification, no network call, and no storage call of any kind;
 * protocol adapters must verify a native object BEFORE ever calling this
 * function (Alpha 257's own instruction: "Protocol adapters must perform
 * protocol verification before invoking this boundary").
 *
 * Fails closed: every rejection returns `null`. Nothing here throws.
 *
 * Enforces only the invariants checkable from THIS post's own fields
 * (self-reply, non-empty ids, provenance shape, timestamp/body domain).
 * Cross-post invariants that require the rest of the board's post set —
 * parent existence, same-board reply, cycle detection — are Board
 * Application Logic's own responsibility (see Alpha 256's own design doc
 * §5); this boundary performs no graph traversal and holds no state
 * across calls ("Do not implement a graph database").
 */

import type { FedosBoardAuthorReference } from "./fedos_board_author.js";
import type { FedosBoardPostId } from "./fedos_board_identifiers.js";
import {
  toFedosBoardId,
  toFedosBoardPostId,
  toFedosThreadId,
} from "./fedos_board_identifiers.js";
import type { FedosBoardPost } from "./fedos_board_post.js";
import type { FedosBoardSourceReference } from "./fedos_board_source.js";
import { isFedosBoardSourceProtocol } from "./fedos_board_source.js";

/** Maximum `body` length in UTF-16 code units (Alpha 257's own "body size limit formally decided"). */
export const FEDOS_BOARD_POST_MAX_BODY_LENGTH = 10_000;

/** Earliest accepted `createdAt`: 2020-01-01T00:00:00Z in Unix seconds, a generous floor predating this repository. */
export const FEDOS_BOARD_POST_MIN_CREATED_AT = 1_577_836_800;

/**
 * Latest accepted `createdAt`: year 3000 in Unix seconds. Also rejects an
 * accidental milliseconds value (Alpha 251's own inventory found
 * `src/social/event.ts`'s `SocialEventDescriptor.createdAt` documented as
 * milliseconds, unlike every other timestamp in this repository — this
 * ceiling defends the boundary against that exact class of mistake).
 */
export const FEDOS_BOARD_POST_MAX_CREATED_AT = 32_503_680_000;

/** Typed author candidate a Protocol Adapter builds before calling `validateFedosBoardPost`. */
export interface FedosBoardPostAuthorInput {
  readonly identityId: string | null;
  readonly protocol: string;
  readonly publicIdentifier: string;
}

/** Typed source candidate a Protocol Adapter builds before calling `validateFedosBoardPost`. */
export interface FedosBoardPostSourceInput {
  readonly protocol: string;
  readonly reference: string;
}

/**
 * The typed candidate a (future) Protocol Adapter builds from an
 * already-verified native object. Every field is a plain, unbranded
 * primitive — this boundary performs the ONLY branding/freezing step.
 */
export interface FedosBoardPostInput {
  readonly id: string;
  readonly boardId: string;
  readonly threadId: string;
  readonly replyTo: string | null;
  readonly author: FedosBoardPostAuthorInput;
  readonly body: string;
  readonly createdAt: number;
  readonly source: FedosBoardPostSourceInput;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidCreatedAt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= FEDOS_BOARD_POST_MIN_CREATED_AT &&
    value <= FEDOS_BOARD_POST_MAX_CREATED_AT
  );
}

function validateAuthor(input: FedosBoardPostAuthorInput): FedosBoardAuthorReference | null {
  if (input === null || typeof input !== "object") return null;
  if (input.identityId !== null && !isNonEmptyString(input.identityId)) return null;
  if (!isFedosBoardSourceProtocol(input.protocol)) return null;
  if (!isNonEmptyString(input.publicIdentifier)) return null;
  return Object.freeze({
    identityId: input.identityId,
    protocol: input.protocol,
    publicIdentifier: input.publicIdentifier,
  });
}

function validateSource(input: FedosBoardPostSourceInput): FedosBoardSourceReference | null {
  if (input === null || typeof input !== "object") return null;
  if (!isFedosBoardSourceProtocol(input.protocol)) return null;
  if (!isNonEmptyString(input.reference)) return null;
  return Object.freeze({ protocol: input.protocol, reference: input.reference });
}

/**
 * Validates and constructs a `FedosBoardPost`. Fails closed: returns
 * `null` for anything malformed instead of throwing. Deep-copies (every
 * nested object is rebuilt field-by-field, never referenced from
 * `input`) and `Object.freeze`s the result, matching
 * `validateInboundNostrEvent`'s own convention
 * (`src/desktop/combined_inbound_event_validator.ts`, Alpha 245).
 */
export function validateFedosBoardPost(input: FedosBoardPostInput): FedosBoardPost | null {
  if (input === null || typeof input !== "object") return null;

  const id = isNonEmptyString(input.id) ? toFedosBoardPostId(input.id) : null;
  const boardId = isNonEmptyString(input.boardId) ? toFedosBoardId(input.boardId) : null;
  const threadId = isNonEmptyString(input.threadId) ? toFedosThreadId(input.threadId) : null;
  if (id === null || boardId === null || threadId === null) return null;

  let replyTo: FedosBoardPostId | null = null;
  if (input.replyTo !== null) {
    if (!isNonEmptyString(input.replyTo)) return null;
    const brandedReplyTo = toFedosBoardPostId(input.replyTo);
    if (brandedReplyTo === null) return null;
    if (brandedReplyTo === id) return null; // a post cannot reply to itself
    replyTo = brandedReplyTo;
  }

  if (typeof input.body !== "string") return null;
  if (input.body.length < 1 || input.body.length > FEDOS_BOARD_POST_MAX_BODY_LENGTH) return null;

  if (!isValidCreatedAt(input.createdAt)) return null;

  const author = validateAuthor(input.author);
  if (author === null) return null;

  const source = validateSource(input.source);
  if (source === null) return null;

  return Object.freeze({
    id,
    boardId,
    threadId,
    replyTo,
    author,
    body: input.body,
    createdAt: input.createdAt,
    source,
  });
}
