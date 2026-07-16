/**
 * Secure Runtime Alpha 622 ("FedosBoardRuntime Ownership") — Stage 2 of
 * the Alpha 621–640 Public Board Runtime Application API Foundation
 * Arc. Implements the new Application layer the prior, review-only
 * Board Runtime Application API & Conversation Model Review recommended
 * (`docs/reviews/board_runtime_application_api_02_application_api_ownership.md`
 * §Recommendation: **B — a new `FedosBoardRuntime`**) — PUBLIC MODE
 * ONLY, per this Arc's own instruction.
 *
 * Responsibilities: command validation, canonical post assembly, Host
 * submit delegation, read/query delegation, public-mode Outbound
 * Eligibility policy (`./fedos_board_runtime_outbound_eligibility.ts`).
 *
 * Explicitly NOT this class's responsibility (Alpha 622's own list,
 * confirmed unchanged by every method below): Host lifecycle
 * (`FedosDesktopHost.start()`/`stop()` are never called from here),
 * filesystem (no `node:fs` import), Publisher execution (no
 * `FedosBoardOutboxPublisher`/`.publish()` reference — `Host.startDelivery()`'s
 * own Scheduler is the only caller of that), retry (no
 * `FedosDeliveryRetryRegistry`/retry-policy reference), crypto (no
 * `src/crypto`/signing import — see `fedos_board_runtime_author_authority.ts`'s
 * own header for why author resolution needs none), Relay (no
 * `FedosRelay`/`src/nostr` import), protocol adapter (no
 * `validate<Protocol>BoardPost` import — this class never reads an
 * INBOUND protocol post, only WRITES a local one), GUI (no rendering/UI
 * code of any kind).
 *
 * Ownership boundary (Alpha 623): holds exactly one `FedosDesktopHost`
 * reference, injected — never constructs, starts, or stops it. Never
 * receives `FedosBoardPersistence`/`FedosBoardOutboxPersistence`/
 * `FedosBoardOutboxPublisher` directly (those remain Host-owned,
 * Host-private); every read/write goes through `#host`'s own public
 * methods only. No singleton — every `new FedosBoardRuntime(...)` (or
 * `createFedosBoardRuntime(...)`) call produces a fully independent
 * instance holding no module-level shared state, so two Runtimes can
 * legitimately wrap the SAME or DIFFERENT `FedosDesktopHost` instances
 * without interfering with each other. Constructible with a
 * not-yet-`"ready"` Host (construction never inspects `host.state()`);
 * every OPERATION method below checks readiness itself, at call time,
 * by using `host.desktop()`/`host.board()`/`host.query()`'s own
 * existing "return the owned instance only when ready, else `null`"
 * contract as the single source of truth for readiness — no separate,
 * second `host.state()` check duplicated alongside it.
 */

import type { FedosDesktopHost, FedosDesktopHostSubmitPostResult } from "../../desktop/host/fedos_desktop_host.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../fedos_board_post_validator.js";
import { toFedosBoardId, toFedosBoardPostId, toFedosThreadId } from "../fedos_board_identifiers.js";
import type {
  FedosBoardQueryFilter,
  FedosBoardQueryPageOptions,
  FedosBoardQueryResult,
} from "../query/fedos_board_query_types.js";
import type { FedosBoardAuthorReference } from "../fedos_board_author.js";
import type { FedosBoardOutboxTarget } from "../outbox/fedos_board_outbox_types.js";
import {
  FedosSecureRandomBoardRuntimeIdGenerator,
  type FedosBoardRuntimeIdGenerator,
} from "./fedos_board_runtime_id_generator.js";
import { defaultFedosBoardRuntimeClock, type FedosBoardRuntimeClock } from "./fedos_board_runtime_clock.js";
import { resolvePublicAuthorReference } from "./fedos_board_runtime_author_authority.js";
import { isEligibleForPublicOutboundTarget } from "./fedos_board_runtime_outbound_eligibility.js";
import type {
  CreatePublicThreadCommand,
  FedosBoardRuntimeCommandResult,
  FedosBoardRuntimeOutboxTargetResult,
  ReplyToPublicThreadCommand,
} from "./fedos_board_runtime_command_types.js";

export interface FedosBoardRuntimeDependencies {
  readonly host: FedosDesktopHost;
  /** Optional; defaults to `FedosSecureRandomBoardRuntimeIdGenerator` (Alpha 626). */
  readonly idGenerator?: FedosBoardRuntimeIdGenerator;
  /** Optional; defaults to `defaultFedosBoardRuntimeClock` (Alpha 625). */
  readonly clock?: FedosBoardRuntimeClock;
}

export class FedosBoardRuntime {
  readonly #host: FedosDesktopHost;
  readonly #idGenerator: FedosBoardRuntimeIdGenerator;
  readonly #clock: FedosBoardRuntimeClock;

  constructor(dependencies: FedosBoardRuntimeDependencies) {
    this.#host = dependencies.host;
    this.#idGenerator = dependencies.idGenerator ?? new FedosSecureRandomBoardRuntimeIdGenerator();
    this.#clock = dependencies.clock ?? defaultFedosBoardRuntimeClock;
  }

  /**
   * Alpha 629 ("Create Public Thread"). A new root post — per Alpha 631
   * ("Create Public Root Post vs Thread Decision"), the Canonical Board
   * Model already makes a root post AND its own thread the SAME thing
   * (`threadId === id` for a root, `src/board/repository/fedos_board_service.ts`'s
   * own thread-integrity check) — this is therefore the ONLY "create a
   * new public post that is not a reply" method; there is no separate,
   * duplicate "create board post" API.
   */
  createPublicThread(command: CreatePublicThreadCommand): FedosBoardRuntimeCommandResult {
    const desktopApplication = this.#host.desktop();
    if (desktopApplication === null) {
      return { outcome: "unavailable" };
    }

    const author = resolvePublicAuthorReference(desktopApplication);
    const id = this.#idGenerator.generatePostId();

    const input: FedosBoardPostInput = {
      id,
      boardId: command.boardId,
      threadId: id,
      replyTo: null,
      author,
      body: command.body,
      createdAt: this.#clock(),
      source: { protocol: "fedos", reference: id },
    };

    return this.#assembleAndSubmit(input, author, command.outboundTargets ?? []);
  }

  /**
   * Alpha 630 ("Reply to Public Thread"). Thread-integrity enforcement
   * (parent exists / same board / thread consistency) is deliberately
   * NOT re-implemented here — `#assembleAndSubmit()` routes exclusively
   * through `FedosDesktopHost.submitPost()`/`submitPostWithOutbox()`,
   * which already runs `FedosBoardService`'s own existing
   * `#precheckRegistration` (missing-parent / cross-board-reply /
   * invalid-thread) before any mutation — this method performs "no
   * direct BoardService mutation" (Alpha 629's own requirement, applied
   * here too) and no duplicate validation of checks Host already owns.
   */
  replyToPublicThread(command: ReplyToPublicThreadCommand): FedosBoardRuntimeCommandResult {
    const desktopApplication = this.#host.desktop();
    if (desktopApplication === null) {
      return { outcome: "unavailable" };
    }

    const author = resolvePublicAuthorReference(desktopApplication);
    const id = this.#idGenerator.generatePostId();

    const input: FedosBoardPostInput = {
      id,
      boardId: command.boardId,
      threadId: command.threadId,
      replyTo: command.replyTo,
      author,
      body: command.body,
      createdAt: this.#clock(),
      source: { protocol: "fedos", reference: id },
    };

    return this.#assembleAndSubmit(input, author, command.outboundTargets ?? []);
  }

  #assembleAndSubmit(
    input: FedosBoardPostInput,
    author: FedosBoardAuthorReference,
    requestedTargets: readonly FedosBoardOutboxTarget[],
  ): FedosBoardRuntimeCommandResult {
    const post = validateFedosBoardPost(input);
    if (post === null) {
      return { outcome: "invalid-command", reason: "malformed-post" };
    }

    if (requestedTargets.length === 0) {
      // Alpha 634 ("Local-only Behavior") -- a first-class product
      // action, not a degenerate case: durable Board write, Query
      // visibility, no Outbox intent, no network.
      const result = this.#host.submitPost(post);
      return this.#mapResult(result, post, []);
    }

    // Alpha 633 ("Outbound Eligibility V1") -- runs BEFORE any Outbox
    // intent is created (prior review's own §10 requirement): an
    // ineligible target NEVER reaches `submitPostWithOutbox()`, so
    // `createFedosBoardOutboxIntent` is never even called for it.
    const eligibleTargets: FedosBoardOutboxTarget[] = [];
    const ineligibleResults: FedosBoardRuntimeOutboxTargetResult[] = [];
    for (const target of requestedTargets) {
      if (isEligibleForPublicOutboundTarget(author, target)) {
        eligibleTargets.push(target);
      } else {
        ineligibleResults.push({ target, result: "ineligible" });
      }
    }

    // Alpha 635 ("Nostr Outbound Behavior") -- this method itself never
    // calls a Publisher; it only writes an Outbox intent via Host's own
    // EXISTING `submitPostWithOutbox()`. Delivery happens later, only
    // once a caller separately invokes `Host.startDelivery()`.
    const hostResult = this.#host.submitPostWithOutbox(post, eligibleTargets);
    const outbox: FedosBoardRuntimeOutboxTargetResult[] = [
      ...hostResult.outbox.map((entry) => ({ target: entry.target, result: entry.result })),
      ...ineligibleResults,
    ];
    return this.#mapResult(hostResult.post, post, outbox);
  }

  #mapResult(
    hostResult: FedosDesktopHostSubmitPostResult,
    post: FedosBoardPost,
    outbox: readonly FedosBoardRuntimeOutboxTargetResult[],
  ): FedosBoardRuntimeCommandResult {
    const outboxHasFailure = outbox.some((entry) => entry.result !== "inserted" && entry.result !== "already-present");

    switch (hostResult) {
      case "inserted":
        return outboxHasFailure
          ? { outcome: "outbox-partial-failure", post, outbox }
          : { outcome: "created", post, outbox };
      case "already-present":
        return outboxHasFailure
          ? { outcome: "outbox-partial-failure", post, outbox }
          : { outcome: "already-present", post, outbox };
      case "post-id-conflict":
        return { outcome: "conflict", reason: "post-id-conflict" };
      case "source-conflict":
        return { outcome: "conflict", reason: "source-conflict" };
      case "missing-parent":
        return { outcome: "invalid-command", reason: "missing-parent" };
      case "invalid-thread":
        return { outcome: "invalid-command", reason: "invalid-thread" };
      case "cross-board-reply":
        return { outcome: "invalid-command", reason: "cross-board-reply" };
      case "persistence-failed":
        return { outcome: "persistence-failed" };
    }
  }

  /**
   * Alpha 632 ("Read Boundary") -- Option B (delegation): forwards to
   * `Host.board()`'s own existing `findPost`, never returns the raw
   * `FedosBoardReader`/`FedosBoardService` instance itself. `null`
   * whenever the Host is not `"ready"` OR `id` is not a well-formed,
   * non-empty identifier.
   */
  findPost(id: string): FedosBoardPost | null {
    const reader = this.#host.board();
    if (reader === null) return null;
    const branded = toFedosBoardPostId(id);
    if (branded === null) return null;
    return reader.findPost(branded);
  }

  /** Alpha 632 -- forwards to `Host.query()`'s own existing `recentFeed`. */
  recentFeed(
    boardId: string,
    filter?: FedosBoardQueryFilter,
    page?: FedosBoardQueryPageOptions,
  ): FedosBoardQueryResult | null {
    const query = this.#host.query();
    if (query === null) return null;
    const branded = toFedosBoardId(boardId);
    if (branded === null) return null;
    return query.recentFeed(branded, filter, page);
  }

  /** Alpha 632 -- forwards to `Host.query()`'s own existing `thread`. */
  thread(
    boardId: string,
    threadId: string,
    filter?: FedosBoardQueryFilter,
    page?: FedosBoardQueryPageOptions,
  ): FedosBoardQueryResult | null {
    const query = this.#host.query();
    if (query === null) return null;
    const brandedBoardId = toFedosBoardId(boardId);
    const brandedThreadId = toFedosThreadId(threadId);
    if (brandedBoardId === null || brandedThreadId === null) return null;
    return query.thread(brandedBoardId, brandedThreadId, filter, page);
  }
}

/**
 * Alpha 623 ("Runtime Construction Boundary"). A thin factory only --
 * no default `host` is ever constructed here (unlike
 * `createFedosDesktopHost()`'s own defaulting of `boardPersistence`),
 * since a `FedosBoardRuntime` with no real `FedosDesktopHost` to wrap
 * would be meaningless. Never calls `host.start()`/`stop()` -- matches
 * `createFedosDesktopHost()`'s own "construct, never start" precedent.
 */
export function createFedosBoardRuntime(dependencies: FedosBoardRuntimeDependencies): FedosBoardRuntime {
  return new FedosBoardRuntime(dependencies);
}
