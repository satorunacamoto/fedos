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
 *
 * Secure Runtime Alpha 754 ("BoardRuntime Creation Integration") / Alpha
 * 755 ("Reply Integration") — Stages 14/15 of the Alpha 741–760
 * Canonical Conversation Identity and Record Foundation Arc.
 *
 * `createPublicThread()` now durably records exactly ONE
 * `FedosConversationRecord` (`../../conversation/fedos_conversation_record.js`,
 * Alpha 745) per new root post, via the injected
 * `FedosConversationPersistence` (Alpha 749). Alpha 754 compares:
 *   A. write Conversation FIRST, then Board — rejected; a Conversation
 *      record for a Board post that never durably existed would be an
 *      orphaned record with nothing to describe.
 *   B. write Board FIRST, then Conversation — ADOPTED. Only once
 *      `#assembleAndSubmit()` confirms the Board write itself succeeded
 *      (`"created"`/`"already-present"`/`"outbox-partial-failure"`, all
 *      of which already carry the durable `post`) does this method
 *      attempt the Conversation write.
 *   C. preview both, then write in a recoverable order — rejected as
 *      unnecessary complexity: unlike Board persistence (which has a
 *      real `previewRegistration()` predicting a genuine domain
 *      rejection), a Conversation record built from an
 *      already-durable, already-valid root post cannot itself be
 *      domain-invalid — the only failure this write can still produce
 *      is a `FedosConversationPersistence`-level one (`"conflict"`/
 *      `"failed"`), which Option B already surfaces explicitly.
 *   D. a dedicated coordinator class — rejected as premature
 *      abstraction for ONE two-step sequence; `#recordConversationForRootPost()`
 *      below IS the narrow coordinator the task's own instruction asks
 *      for, kept as a private method rather than a new exported class.
 *
 * NO transactional atomicity is claimed — `FedosBoardPersistence`/
 * `FedosConversationPersistence` are separate ports with no shared
 * commit. A process crash between the two writes leaves a durable Board
 * post with no Conversation record — an honest, narrow, EXPLICIT
 * partial-failure surfaced via `FedosConversationAssociationResult`'s
 * own `"conflict"`/`"persistence-failed"` outcomes
 * (`./fedos_board_runtime_command_types.js`), never silently hidden and
 * never described as atomic.
 *
 * `replyToPublicThread()` never creates a second Conversation record
 * (Alpha 755's own explicit requirement) — it only RESOLVES the
 * already-existing one via `#conversationReader.conversationForThread()`.
 * A reply into a thread with NO Conversation record (this Arc's own
 * Alpha 756 answer for Board data that predates this Arc) surfaces
 * `{ outcome: "not-found" }` — the underlying Board reply itself
 * succeeds or fails EXACTLY as it did before this Arc, regardless (Rule
 * 10: existing public Board behavior remains compatible).
 */

import type { FedosDesktopHost, FedosDesktopHostSubmitPostResult } from "../../desktop/host/fedos_desktop_host.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../fedos_board_post_validator.js";
import {
  toFedosBoardId,
  toFedosBoardPostId,
  toFedosThreadId,
  type FedosBoardId,
  type FedosThreadId,
} from "../fedos_board_identifiers.js";
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
  FedosBoardRuntimeWriteResult,
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
import type { FedosNostrAuthorBindingAuthority, FedosNostrAuthorBindingResult } from "./identity/fedos_nostr_author_binding_types.js";
import type { FedosConversationAssociationResult } from "./fedos_board_runtime_command_types.js";
import type { FedosConversationRecord } from "../../conversation/fedos_conversation_record.js";
import { validateFedosConversationRecord, type FedosConversationRecordInput } from "../../conversation/fedos_conversation_record_validator.js";
import { toFedosConversationId, type FedosConversationId } from "../../conversation/fedos_conversation_id.js";
import { FedosConversationReader } from "../../conversation/fedos_conversation_reader.js";
import type { FedosConversationPersistence } from "../../conversation/persistence/fedos_conversation_persistence.js";
import { InMemoryFedosConversationPersistence } from "../../conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { serializeFedosConversationRecord } from "../../conversation/persistence/fedos_conversation_record_codec.js";

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
  /**
   * Secure Runtime Alpha 690/694/697 — optional; omitted means a
   * `"nostr"`-resolved author can NEVER bind (this Runtime consults no
   * Binding Authority at all), so every `"nostr"` target stays
   * `"ineligible"` with reason `"identity-not-controlled"` — the SAME
   * fail-closed behavior this class had before this Arc. Supply
   * `new FedosSigningAuthorityNostrAuthorBinding(signingAuthority)`
   * (`./identity/fedos_nostr_author_binding_authority.js`) to unlock
   * real Nostr eligibility for a genuinely-controlled identity.
   */
  readonly nostrAuthorBindingAuthority?: FedosNostrAuthorBindingAuthority;
  /**
   * Secure Runtime Alpha 689 — the ONE explicit Nostr signing account
   * index this Runtime's own Binding Authority checks against for every
   * command. Optional; defaults to `0` (Alpha 689's own "Runtime/
   * application configuration owns one explicit account index,
   * defaulting only if an existing decision already establishes account
   * 0" decision — Alpha 424 already fixed `kind: 1`/V1 scope around a
   * single default account). Never inferred from `publicIdentifier`.
   */
  readonly nostrAccountIndex?: number;
  /**
   * Secure Runtime Alpha 754 — optional; defaults to a fresh
   * `InMemoryFedosConversationPersistence()` when omitted. Injected
   * separately from every Board/Outbox/Observation persistence
   * (Host-owned, Host-private) — Conversation persistence is an
   * Application-layer concern `FedosBoardRuntime` itself owns
   * end-to-end, exactly like `publicAuthorAuthority`/
   * `conversationPolicyAuthority` (Alpha 749's own "never fold into
   * Board persistence" requirement).
   */
  readonly conversationPersistence?: FedosConversationPersistence;
}

export class FedosBoardRuntime {
  readonly #host: FedosDesktopHost;
  readonly #idGenerator: FedosBoardRuntimeIdGenerator;
  readonly #clock: FedosBoardRuntimeClock;
  readonly #authorAuthority: FedosPublicAuthorAuthority;
  readonly #policyAuthority: FedosConversationPolicyAuthority;
  readonly #nostrAuthorBindingAuthority: FedosNostrAuthorBindingAuthority | undefined;
  readonly #nostrAccountIndex: number;
  readonly #conversationPersistence: FedosConversationPersistence;
  readonly #conversationReader: FedosConversationReader;

  constructor(dependencies: FedosBoardRuntimeDependencies) {
    this.#host = dependencies.host;
    this.#idGenerator = dependencies.idGenerator ?? new FedosSecureRandomBoardRuntimeIdGenerator();
    this.#clock = dependencies.clock ?? defaultFedosBoardRuntimeClock;
    this.#authorAuthority = dependencies.publicAuthorAuthority ?? new FedosDesktopPublicAuthorAuthority(dependencies.host);
    this.#policyAuthority = dependencies.conversationPolicyAuthority ?? new StaticFedosConversationPolicyAuthority();
    this.#nostrAuthorBindingAuthority = dependencies.nostrAuthorBindingAuthority;
    this.#nostrAccountIndex = dependencies.nostrAccountIndex ?? 0;
    this.#conversationPersistence = dependencies.conversationPersistence ?? new InMemoryFedosConversationPersistence();
    this.#conversationReader = new FedosConversationReader(this.#conversationPersistence);
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

    const result = await this.#assembleAndSubmit(input, authorResolution, policyResolution.policy, command.outboundTargets ?? []);
    if (result.outcome === "created" || result.outcome === "already-present" || result.outcome === "outbox-partial-failure") {
      const conversation = this.#recordConversationForRootPost(result.post);
      return { ...result, conversation };
    }
    return result;
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

    const result = await this.#assembleAndSubmit(input, authorResolution, policyResolution.policy, command.outboundTargets ?? []);
    if (result.outcome === "created" || result.outcome === "already-present" || result.outcome === "outbox-partial-failure") {
      const conversation = this.#resolveConversationForReply(boardId, threadId);
      return { ...result, conversation };
    }
    return result;
  }

  async #assembleAndSubmit(
    input: FedosBoardPostInput,
    authorResolution: FedosPublicAuthorResolution,
    policy: FedosConversationPolicy,
    requestedTargets: readonly FedosBoardOutboxTarget[],
  ): Promise<FedosBoardRuntimeWriteResult> {
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
    //
    // Alpha 694/698 -- the Nostr Identity-to-Signing Binding check is
    // computed AT MOST ONCE per command (never per-target), lazily, only
    // once the first "nostr" target is actually encountered, and only
    // when the resolved author is itself "nostr"-protocol (an anonymous-
    // local/ActivityPub/AT Protocol/Session author can never bind --
    // Alpha 692 -- so no Binding Authority call is ever made for one).
    let nostrAuthorBinding: FedosNostrAuthorBindingResult | undefined;
    let nostrAuthorBindingComputed = false;
    const eligibleTargets: FedosBoardOutboxTarget[] = [];
    const ineligibleResults: FedosBoardRuntimeOutboxTargetResult[] = [];
    for (const target of requestedTargets) {
      if (target.protocol === "nostr" && !nostrAuthorBindingComputed) {
        nostrAuthorBindingComputed = true;
        if (
          this.#nostrAuthorBindingAuthority !== undefined &&
          isResolvedPublicAuthorResolution(authorResolution) &&
          authorResolution.author.protocol === "nostr"
        ) {
          nostrAuthorBinding = await this.#nostrAuthorBindingAuthority.verifyBinding({
            author: authorResolution.author,
            accountIndex: this.#nostrAccountIndex,
          });
        }
      }
      const eligibility = evaluateFedosOutboundEligibility({ policy, target, authorResolution, nostrAuthorBinding });
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
  ): FedosBoardRuntimeWriteResult {
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
   * Alpha 754 -- durably records exactly ONE `FedosConversationRecord`
   * for a just-durably-written root post, via the injected
   * `FedosConversationPersistence`. See this file's own header for the
   * write-ordering rationale (Board write already succeeded by the time
   * this is called) and why no atomicity is claimed.
   *
   * `validateFedosConversationRecord` returning `null` here would mean
   * this Runtime's OWN root post -- already `validateFedosBoardPost`-
   * accepted, with `id === threadId` by construction (`createPublicThread`,
   * above) -- somehow fails `rootPostId === rootThreadId` (Alpha 747).
   * That is a genuine internal invariant violation, never a normal
   * outcome, so this throws rather than silently returning a degraded
   * association -- mirroring `FedosDesktopHost.submitPost()`'s own
   * identical "invariant violated" throw for its structurally
   * unreachable case.
   */
  #recordConversationForRootPost(post: FedosBoardPost): FedosConversationAssociationResult {
    const id = toFedosConversationId(post.boardId, post.threadId);
    const candidate: FedosConversationRecordInput = {
      id,
      mode: "public",
      boardId: post.boardId,
      rootThreadId: post.threadId,
      rootPostId: post.id,
      policyReference: "public-v1",
      createdAt: post.createdAt,
    };
    const record: FedosConversationRecord | null = validateFedosConversationRecord(candidate);
    if (record === null) {
      throw new Error(
        "FedosBoardRuntime: invariant violated -- a root post this Runtime just assembled itself failed FedosConversationRecord validation.",
      );
    }
    const persisted = serializeFedosConversationRecord(record);
    const writeResult = this.#conversationPersistence.putConversation(persisted);
    switch (writeResult) {
      case "inserted":
        return { outcome: "recorded", conversation: record };
      case "already-present":
        return { outcome: "already-recorded", conversation: record };
      case "conflict":
        return { outcome: "conflict" };
      case "failed":
        return { outcome: "persistence-failed" };
    }
  }

  /**
   * Alpha 755 -- NEVER creates a Conversation record; only resolves the
   * already-existing one for `(boardId, threadId)`. `{ outcome:
   * "not-found" }` for a thread that predates this Arc (Alpha 756's own
   * Option C compatibility answer) -- the Board reply itself has
   * already succeeded or failed by the time this is called, regardless.
   */
  #resolveConversationForReply(boardId: FedosBoardId, threadId: FedosThreadId): FedosConversationAssociationResult {
    const record = this.#conversationReader.conversationForThread(boardId, threadId);
    return record === null ? { outcome: "not-found" } : { outcome: "existing", conversation: record };
  }

  /**
   * Alpha 757 ("Read API") -- forwards to the injected
   * `FedosConversationPersistence` via `FedosConversationReader`, never
   * returning that reader or the persistence object itself. `null` for
   * an empty/malformed `id` -- mirrors `findPost`'s own convention,
   * directly below.
   */
  findConversation(id: string): FedosConversationRecord | null {
    if (id.trim().length === 0) return null;
    return this.#conversationReader.findConversation(id as FedosConversationId);
  }

  /** Alpha 757 -- no separate index needed (Alpha 747): `toFedosConversationId(boardId, threadId)` alone resolves the record. */
  conversationForThread(boardId: string, threadId: string): FedosConversationRecord | null {
    const brandedBoardId = toFedosBoardId(boardId);
    const brandedThreadId = toFedosThreadId(threadId);
    if (brandedBoardId === null || brandedThreadId === null) return null;
    return this.#conversationReader.conversationForThread(brandedBoardId, brandedThreadId);
  }

  /** Alpha 757 -- filters over `listConversations()` (Alpha 753's own "no side index" decision); empty array for a malformed `boardId`. */
  listBoardConversations(boardId: string): readonly FedosConversationRecord[] {
    const branded = toFedosBoardId(boardId);
    if (branded === null) return [];
    return this.#conversationReader.listBoardConversations(branded);
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
