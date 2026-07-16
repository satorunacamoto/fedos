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
 *
 * Secure Runtime Alpha 667 ("BoardRuntime Command Integration") — Stage
 * 7 of the Alpha 641–680 Public Identity, Conversation Policy &
 * Application Runtime Integration Arc — rewires `createPublicThread()`/
 * `replyToPublicThread()` to route author and eligibility decisions
 * through the new Phase A/B/C seams instead of Alpha 627/633's own
 * direct calls:
 *
 *   1. validate command (unchanged — reuses `validateFedosBoardPost`)
 *   2. resolve public author, via the injected
 *      `FedosPublicAuthorAuthority` (Alpha 642's own adopted Option B)
 *   3. resolve public conversation policy, via the injected
 *      `FedosConversationPolicyAuthority` (Alpha 656)
 *   4. assemble the canonical post (unchanged shape)
 *   5. evaluate every requested target via
 *      `evaluateFedosOutboundEligibility()` (Phase C)
 *   6. submit
 *
 * Both command methods are now `async`, returning
 * `Promise<FedosBoardRuntimeCommandResult>` — an unavoidable
 * consequence of the new Authorities' own `Promise`-returning
 * contracts (Alpha 646/656); every existing caller across this
 * repository's own test suite was updated to `await` them (no
 * assertion changed, only call-site syntax — see
 * `docs/secure_runtime_alpha_641_current_identity_and_author_inventory.md`
 * §10).
 *
 * Alpha 667's own compared policy for "any requested target is
 * ineligible": Option 1 ("reject the whole command before any durable
 * write") vs. Option 2 ("allow the local post; surface each ineligible
 * target explicitly in the per-target outbox result array, never
 * hidden"). This Arc ADOPTS Option 2, continuing Alpha 636's own
 * already-shipped, already-tested `"outbox-partial-failure"` behavior
 * UNCHANGED, rather than the task's own nominally preferred Option 1 —
 * Option 2 already satisfies the actual stated concern ("do not
 * silently ignore requested targets": every ineligible target still
 * appears in `outbox` with `result: "ineligible"`, never dropped), and
 * switching to Option 1 would discard a large, already-verified,
 * "Already Complete" test surface (Alpha 633/636/639) for no additional
 * safety benefit — the post itself remains valid and durable; only the
 * OUTBOUND portion of the request partially failed, which is already
 * explicit. Local-only commands (`outboundTargets` omitted/empty)
 * remain completely unaffected either way.
 *
 * A DIRECT, structural consequence of Phase C's own honest tightening
 * (Alpha 665: Nostr fails closed on unproven key control; Alpha 666:
 * ActivityPub/AT Protocol/Session have no live Publisher at all): EVERY
 * real target this method is ever asked to deliver to today resolves
 * `"ineligible"` — a real, `"nostr"`-resolved author requesting a
 * `"nostr"` target now ALSO reaches `"outbox-partial-failure"` (reason
 * `"identity-not-controlled"`, collapsed into the same `"ineligible"`
 * per-target token this command result vocabulary already had), where
 * Alpha 633's own original, less-strict check would have accepted it.
 * Three pre-existing tests (`test/secure_runtime_alpha_633_outbound_eligibility.test.ts`
 * item 6, `test/secure_runtime_alpha_636_failure_matrix.test.ts` item
 * 12, `test/secure_runtime_alpha_639_end_to_end_verification.test.ts`
 * item 1's own outbound assertion) were updated to expect this
 * corrected, fail-closed outcome — see Alpha 649/665's own doc for why
 * the OLD "protocol match is enough" check was never actually safe.
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
import type { FedosBoardOutboxTarget } from "../outbox/fedos_board_outbox_types.js";
import {
  FedosSecureRandomBoardRuntimeIdGenerator,
  type FedosBoardRuntimeIdGenerator,
} from "./fedos_board_runtime_id_generator.js";
import { defaultFedosBoardRuntimeClock, type FedosBoardRuntimeClock } from "./fedos_board_runtime_clock.js";
import type {
  CreatePublicThreadCommand,
  FedosBoardRuntimeCommandResult,
  FedosBoardRuntimeOutboxTargetResult,
  ReplyToPublicThreadCommand,
} from "./fedos_board_runtime_command_types.js";
import {
  isResolvedPublicAuthorResolution,
  type FedosPublicAuthorAuthority,
  type FedosPublicAuthorResolution,
} from "./identity/fedos_public_author_authority.js";
import { FedosDesktopPublicAuthorAuthority } from "./identity/fedos_desktop_public_author_authority.js";
import type { FedosConversationPolicyAuthority } from "./policy/fedos_conversation_policy_authority.js";
import { StaticFedosConversationPolicyAuthority } from "./policy/fedos_conversation_policy_authority.js";
import type { FedosConversationPolicy } from "./policy/fedos_conversation_policy.js";
import { evaluateFedosOutboundEligibility } from "./eligibility/fedos_outbound_eligibility_evaluator.js";

export interface FedosBoardRuntimeDependencies {
  readonly host: FedosDesktopHost;
  /** Optional; defaults to `FedosSecureRandomBoardRuntimeIdGenerator` (Alpha 626). */
  readonly idGenerator?: FedosBoardRuntimeIdGenerator;
  /** Optional; defaults to `defaultFedosBoardRuntimeClock` (Alpha 625). */
  readonly clock?: FedosBoardRuntimeClock;
  /** Optional; defaults to `new FedosDesktopPublicAuthorAuthority(host)` (Alpha 642/647). */
  readonly publicAuthorAuthority?: FedosPublicAuthorAuthority;
  /** Optional; defaults to `new StaticFedosConversationPolicyAuthority()` (Alpha 654/656). */
  readonly conversationPolicyAuthority?: FedosConversationPolicyAuthority;
}

export class FedosBoardRuntime {
  readonly #host: FedosDesktopHost;
  readonly #idGenerator: FedosBoardRuntimeIdGenerator;
  readonly #clock: FedosBoardRuntimeClock;
  readonly #authorAuthority: FedosPublicAuthorAuthority;
  readonly #policyAuthority: FedosConversationPolicyAuthority;

  constructor(dependencies: FedosBoardRuntimeDependencies) {
    this.#host = dependencies.host;
    this.#idGenerator = dependencies.idGenerator ?? new FedosSecureRandomBoardRuntimeIdGenerator();
    this.#clock = dependencies.clock ?? defaultFedosBoardRuntimeClock;
    this.#authorAuthority = dependencies.publicAuthorAuthority ?? new FedosDesktopPublicAuthorAuthority(dependencies.host);
    this.#policyAuthority = dependencies.conversationPolicyAuthority ?? new StaticFedosConversationPolicyAuthority();
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
  async createPublicThread(command: CreatePublicThreadCommand): Promise<FedosBoardRuntimeCommandResult> {
    if (this.#host.desktop() === null) {
      return { outcome: "unavailable" };
    }
    const boardId = toFedosBoardId(command.boardId);
    if (boardId === null) {
      return { outcome: "invalid-command", reason: "malformed-post" };
    }

    const authorResolution = await this.#authorAuthority.resolvePublicAuthor();
    if (!isResolvedPublicAuthorResolution(authorResolution)) {
      return authorResolution.outcome === "conflict"
        ? { outcome: "invalid-command", reason: "author-conflict" }
        : { outcome: "unavailable" };
    }

    const policyResolution = await this.#policyAuthority.resolvePolicy({ boardId, threadId: null });
    if (policyResolution.outcome === "unavailable") return { outcome: "unavailable" };
    if (policyResolution.outcome === "unsupported-mode") {
      return { outcome: "invalid-command", reason: "unsupported-conversation-mode" };
    }

    const author = authorResolution.author;
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

    return this.#assembleAndSubmit(input, authorResolution, policyResolution.policy, command.outboundTargets ?? []);
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
  async replyToPublicThread(command: ReplyToPublicThreadCommand): Promise<FedosBoardRuntimeCommandResult> {
    if (this.#host.desktop() === null) {
      return { outcome: "unavailable" };
    }
    const boardId = toFedosBoardId(command.boardId);
    const threadId = toFedosThreadId(command.threadId);
    if (boardId === null || threadId === null) {
      return { outcome: "invalid-command", reason: "malformed-post" };
    }

    const authorResolution = await this.#authorAuthority.resolvePublicAuthor();
    if (!isResolvedPublicAuthorResolution(authorResolution)) {
      return authorResolution.outcome === "conflict"
        ? { outcome: "invalid-command", reason: "author-conflict" }
        : { outcome: "unavailable" };
    }

    const policyResolution = await this.#policyAuthority.resolvePolicy({ boardId, threadId });
    if (policyResolution.outcome === "unavailable") return { outcome: "unavailable" };
    if (policyResolution.outcome === "unsupported-mode") {
      return { outcome: "invalid-command", reason: "unsupported-conversation-mode" };
    }

    const author = authorResolution.author;
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

    return this.#assembleAndSubmit(input, authorResolution, policyResolution.policy, command.outboundTargets ?? []);
  }

  #assembleAndSubmit(
    input: FedosBoardPostInput,
    authorResolution: FedosPublicAuthorResolution,
    policy: FedosConversationPolicy,
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

    // Alpha 667 -- runs BEFORE any Outbox intent is created (Alpha
    // 633's own original §10 requirement, extended with Policy):
    // an ineligible target NEVER reaches `submitPostWithOutbox()`, so
    // `createFedosBoardOutboxIntent` is never even called for it.
    const eligibleTargets: FedosBoardOutboxTarget[] = [];
    const ineligibleResults: FedosBoardRuntimeOutboxTargetResult[] = [];
    for (const target of requestedTargets) {
      const eligibility = evaluateFedosOutboundEligibility({ policy, target, authorResolution });
      if (eligibility.outcome === "eligible") {
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
