/**
 * Secure Runtime Alpha 606 ("Runtime Assembly") — Stage 6 of the Alpha
 * 601–620 Desktop Local Runtime Entry Point & Publish Pipeline
 * Ownership Arc.
 *
 * `startFedosDesktopRuntime()` is the FIRST real production caller of
 * `FedosDesktopHost`/`createFedosDesktopHost` this repository has
 * (Alpha 601's own inventory: none existed before this Arc). It
 * assembles durable Persistence backends from caller-supplied paths
 * (Alpha 607/608/609), constructs one `FedosDesktopHost`, calls
 * `start()`, optionally calls `startDelivery()` (Alpha 611), and
 * returns a narrow `FedosRunningDesktopRuntime` handle — never the
 * Host's own internal Persistence/Scheduler objects (this Stage's own
 * instruction: "低レベルPersistenceやSchedulerを外へ返さない").
 *
 * This function performs NO process-lifecycle work of any kind — no
 * `process.on`, no `process.exit`, no signal registration (Alpha 613
 * owns that, one layer up, in `run_fedos_desktop_runtime.ts`). It is
 * directly `import`able and callable from a test, exactly like every
 * other constructor/factory in this repository (Alpha 617's own "no
 * implicit startup" guard: importing THIS file performs no filesystem
 * access, no Host construction, no timer, of any kind — only CALLING
 * `startFedosDesktopRuntime()` does).
 *
 * HARD GUARDRAILS:
 *   - `startFedosDesktopRuntime` and `FedosRunningDesktopRuntime` are
 *     the ONLY exports.
 *   - No module-level mutable state — no singleton Host, no shared
 *     Persistence instance across calls (Alpha 618's own "no shared
 *     singleton" guard). Two calls produce two fully independent
 *     runtimes, even if pointed at the same paths (the SAME
 *     "construct a fresh instance over the same durable backend" shape
 *     `docs/secure_runtime_alpha_589_real_restart_verification.md`
 *     already established and verifies).
 *   - `deliveryEnabled: true` without `observationLogPath` or without
 *     `publisher` is a configuration error, thrown synchronously,
 *     BEFORE any Persistence backend or Host is constructed — never a
 *     silent fallback to an in-memory Observation backend or a Mock
 *     Publisher (Alpha 609/610/614).
 *   - No `process.env` read anywhere in this file.
 *   - No Worker (`../../worker.js`), Ontology, Humanizer, AI, `p2p/`,
 *     Relay Pool, or new Protocol Publisher import of any kind.
 *   - Board/Outbox/Observation Persistence, Scheduler, Retry Registry,
 *     and Retry semantics are all constructed from EXISTING,
 *     byte-for-byte UNCHANGED classes — this file assembles, it does
 *     not modify or extend any of them.
 *
 * Secure Runtime Alpha 671 ("Running Runtime Ownership Decision") /
 * Alpha 672 ("Application Runtime Construction") — Stages 1/2 of Phase
 * D of the Alpha 641–680 Public Identity, Conversation Policy &
 * Application Runtime Integration Arc. Compares:
 *   A. `FedosRunningDesktopRuntime` exposes `boardRuntime()` — ADOPTED.
 *   B. caller constructs `FedosBoardRuntime` from `runtime.host` —
 *      rejected; every caller would duplicate the SAME construction,
 *      and a caller could inject a DIFFERENT `FedosDesktopHost` by
 *      mistake, defeating the "one Application Runtime per running
 *      runtime" guarantee.
 *   C. `startFedosDesktopRuntime` returns both `host`/`boardRuntime` as
 *      SIBLING fields — rejected; `boardRuntime()` as a METHOD (Option
 *      A) is what lets this Arc enforce "inaccessible after stop"
 *      (Alpha 678) — a plain field could not fail closed after `stop()`
 *      without the field itself becoming stale/dangling.
 *
 * `startFedosDesktopRuntime()` now constructs EXACTLY ONE
 * `FedosBoardRuntime` per running runtime — via `createFedosBoardRuntime()`
 * (Alpha 623, unmodified) over the SAME `host` this function already
 * constructs — using whichever `publicAuthorAuthority`/
 * `conversationPolicyAuthority`/`idGenerator`/`clock` the caller
 * supplied in `config` (Alpha 673), or `FedosBoardRuntime`'s own
 * existing, already-documented defaults when omitted (Alpha 642/654 —
 * no default is duplicated or overridden here). No singleton — a
 * second `startFedosDesktopRuntime()` call constructs a fully
 * independent `FedosBoardRuntime`, exactly mirroring this function's
 * own pre-existing "no shared Host" guarantee (Alpha 618).
 *
 * Secure Runtime Alpha 758 ("Local Runtime Ownership") — Stage 18 of
 * the Alpha 741–760 Canonical Conversation Identity and Record
 * Foundation Arc. `startFedosDesktopRuntime()` now OWNS the one
 * `FedosConversationPersistence` this running runtime uses —
 * `AppendOnlyFedosConversationPersistence(config.conversationLogPath)`
 * when supplied, or an explicit, freshly-constructed
 * `InMemoryFedosConversationPersistence()` otherwise (constructed HERE,
 * not left to `FedosBoardRuntime`'s own internal default, so this
 * function always holds a concrete reference to hydrate against, per
 * Alpha 756, and pass through explicitly). After `host.start()`
 * succeeds (Board state is hydrated, `host.board()` is real) and
 * BEFORE `createFedosBoardRuntime()` is called,
 * `hydrateFedosConversations()` verifies every persisted Conversation
 * record against that hydrated Board state; a non-`"hydrated"` outcome
 * throws, mirroring this function's own existing "convert a corrupt
 * Board log into a thrown Error" discipline for `host.start()` itself.
 * Conversation reads are exposed entirely through
 * `runtime.boardRuntime()`'s own new `findConversation()`/
 * `conversationForThread()`/`listBoardConversations()` methods (Alpha
 * 757) — no new accessor is added to `FedosRunningDesktopRuntime`
 * itself, matching Alpha 671's own "`FedosBoardRuntime` is the one
 * thing a caller holds a reference to" precedent. No filesystem
 * internal (the persistence object itself, a raw file handle, etc.) is
 * ever exposed to a caller.
 */

// @ts-expect-error `node:fs`/`node:path` have no type declarations without `@types/node` in this project's tsconfig.
import { mkdirSync } from "node:fs";
// @ts-expect-error see above.
import { dirname } from "node:path";
import type { FedosDesktopHost } from "../host/fedos_desktop_host.js";
import { createFedosDesktopHost } from "../host/create_fedos_desktop_host.js";
import { createDesktopApplication } from "../create_desktop_application.js";
import { AppendOnlyFedosBoardPersistence } from "../../board/persistence/append_only_fedos_board_persistence.js";
import { AppendOnlyFedosBoardOutboxPersistence } from "../../board/outbox/append_only_fedos_board_outbox_persistence.js";
import { AppendOnlyFedosDeliveryObservationPersistence } from "../../board/observation/append_only_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_repository.js";
import type { FedosDesktopRuntimeConfig } from "./fedos_desktop_runtime_config.js";
import { createFedosBoardRuntime, type FedosBoardRuntime } from "../../board/runtime/fedos_board_runtime.js";
import type { FedosConversationPersistence } from "../../conversation/persistence/fedos_conversation_persistence.js";
import { AppendOnlyFedosConversationPersistence } from "../../conversation/persistence/append_only_fedos_conversation_persistence.js";
import { InMemoryFedosConversationPersistence } from "../../conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { hydrateFedosConversations } from "../../conversation/fedos_conversation_hydration.js";
import {
  createFedosConversationRuntime,
  type FedosConversationRuntime,
} from "../../conversation/runtime/fedos_conversation_runtime.js";
import { assembleFedosConversationRuntimeDependencies } from "../../conversation/runtime/fedos_conversation_runtime_assembly.js";
import { defaultFedosBoardRuntimeClock } from "../../board/runtime/fedos_board_runtime_clock.js";
import {
  assembleFedosConversationProductionCryptoGraph,
  type FedosConversationProductionCryptoConfig,
  type FedosConversationProductionCryptoGraph,
} from "../../conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.js";
import type { FedosConversationProductionCryptoCapabilityOutcome } from "../../conversation/encryption/production/fedos_conversation_production_crypto_capability_result.js";

// Secure Runtime Alpha 1471-1540 (Private Transport Boundary and
// Multi-Relay Delivery Arc) -- every import/addition below this comment
// is ADDITIVE ONLY, mirroring the Alpha 501-520 boundary comment
// already established in `fedos_desktop_host.ts` for the same reason.
import type { FedosConversationMessageEnvelopePersistence } from "../../conversation/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../../conversation/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../../conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../../conversation/payload_storage/fedos_conversation_payload_storage.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../../conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { InMemoryFedosConversationPayloadStorage } from "../../conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import type { FedosConversationTransportOutboxPersistence } from "../../conversation/transport/fedos_conversation_transport_outbox_persistence.js";
import { AppendOnlyFedosConversationTransportOutboxPersistence } from "../../conversation/transport/append_only_fedos_conversation_transport_outbox_persistence.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../../conversation/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../../board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosConversationRelaySet } from "../../conversation/transport/relay/fedos_conversation_relay_set.js";
import { FedosPrivateTransport } from "../../conversation/transport/fedos_private_transport.js";

// Secure Runtime Alpha 1691-1760 (Conversation Archive Runtime
// Integration and Recovery Operations Arc) -- every import/addition
// below this comment is ADDITIVE ONLY, mirroring the Alpha 1471-1540
// boundary comment above for the same reason.
import type { FedosConversationMembershipPersistence } from "../../conversation/membership/persistence/fedos_conversation_membership_persistence.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../../conversation/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../../conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import type { FedosConversationCapabilityPersistence } from "../../conversation/capability/persistence/fedos_conversation_capability_persistence.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../../conversation/capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../../conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { assembleFedosConversationArchiveRuntime } from "../../conversation/archive/runtime/fedos_conversation_archive_runtime_assembly.js";
import type { FedosConversationArchiveRuntime } from "../../conversation/archive/runtime/fedos_conversation_archive_runtime.js";

// Secure Runtime Alpha 1921-1980 (Group Conversation Archive Integration and
// Cross-Branch Recovery Arc) -- every import/addition below this comment is
// ADDITIVE ONLY, mirroring the Alpha 1691-1760 boundary comment above for the
// same reason.
import type { FedosGroupGenerationPersistence } from "../../conversation/group/fedos_group_generation.js";
import { AppendOnlyFedosGroupGenerationPersistence } from "../../conversation/group/append_only_fedos_group_generation_persistence.js";
import { InMemoryFedosGroupGenerationPersistence } from "../../conversation/group/in_memory_fedos_group_generation_persistence.js";
import type { FedosGroupDirectPathPersistence } from "../../conversation/group/fedos_group_direct_path.js";
import { AppendOnlyFedosGroupDirectPathPersistence } from "../../conversation/group/append_only_fedos_group_direct_path_persistence.js";
import { InMemoryFedosGroupDirectPathPersistence } from "../../conversation/group/in_memory_fedos_group_direct_path_persistence.js";
import type { FedosGroupMessagePersistence } from "../../conversation/group/fedos_group_message.js";
import { AppendOnlyFedosGroupMessagePersistence } from "../../conversation/group/append_only_fedos_group_message_persistence.js";
import { InMemoryFedosGroupMessagePersistence } from "../../conversation/group/in_memory_fedos_group_message_persistence.js";
import type { FedosGroupFanoutDeliveryPersistence } from "../../conversation/group/fedos_group_fanout_delivery.js";
import { AppendOnlyFedosGroupFanoutDeliveryPersistence } from "../../conversation/group/append_only_fedos_group_fanout_delivery_persistence.js";
import { InMemoryFedosGroupFanoutDeliveryPersistence } from "../../conversation/group/in_memory_fedos_group_fanout_delivery_persistence.js";

/** Alpha 1471-1540 -- this runtime's own explicit choice for `AppendOnlyFedosConversationPayloadStorage`'s REQUIRED `maxPayloadByteLength` parameter when `conversationPayloadMaxByteLength` is omitted. 1 MiB. */
const DEFAULT_CONVERSATION_PAYLOAD_MAX_BYTE_LENGTH = 1_048_576;
/** Alpha 1471-1540 -- Mailbox Delivery's own default tick cadence when `conversationTransportIntervalMs` is omitted. Mirrors the Board delivery loop's own `DEFAULT_DELIVERY_INTERVAL_MS` (`../host/fedos_desktop_host.ts`, Alpha 507) — same value, a separate constant since that one is not exported. */
const DEFAULT_CONVERSATION_TRANSPORT_INTERVAL_MS = 30_000;

export interface FedosRunningDesktopRuntime {
  readonly host: FedosDesktopHost;
  /**
   * Alpha 671/678 — the Application Runtime this running Local Runtime
   * owns. Returns the SAME `FedosBoardRuntime` instance on every call
   * while this runtime is running; throws once `stop()` has been
   * called (Alpha 678's own "inaccessible after stop" requirement) —
   * mirroring `stop()`'s own established "fail closed on misuse rather
   * than return something stale" convention in this exact file, rather
   * than a Host-accessor-style `null` return (this handle, unlike
   * `FedosDesktopHost`, has no intermediate "not yet ready" state to
   * return `null` for — it exists only once the runtime already
   * started successfully).
   */
  boardRuntime(): FedosBoardRuntime;
  /**
   * Alpha 923 — the Conversation Application Runtime this running Local
   * Runtime owns, for `private-group`/`direct` DRAFT construction and
   * reads. EXACTLY ONE instance per running runtime, returned on every
   * call while running; throws once `stop()` has been called (the same
   * "inaccessible after stop" contract as `boardRuntime()`). No singleton
   * (a second `startFedosDesktopRuntime()` builds a fully independent
   * one), no automatic network/timer, no Host internal exposed. It never
   * constructs an active Conversation and never sends a private message.
   */
  conversationRuntime(): FedosConversationRuntime;
  /**
   * Secure Runtime Alpha 1471–1540 — the `FedosPrivateTransport`
   * (`../../conversation/transport/fedos_private_transport.ts`) this
   * running Local Runtime owns, constructed ONLY when
   * `config.privateTransportEnabled` was `true`. Throws
   * `"not enabled"` if it was never configured, and throws
   * `"inaccessible after stop"` once `stop()` has been called — the SAME
   * two-state fail-closed contract `boardRuntime()`/`conversationRuntime()`
   * themselves use, extended with the one additional "was it even
   * configured" state this accessor alone needs.
   */
  privateTransport(): FedosPrivateTransport;
  /**
   * Secure Runtime Alpha 1691–1760 — the `FedosConversationArchiveRuntime`
   * (`../../conversation/archive/runtime/fedos_conversation_archive_runtime.ts`)
   * this running Local Runtime owns, constructed ONLY when
   * `config.archiveEnabled` was `true`. Throws `"not enabled"` if it was
   * never configured, and throws `"inaccessible after stop"` once
   * `stop()` has been called — the SAME two-state fail-closed contract
   * `privateTransport()` itself already uses. Independently of THIS
   * accessor's own gate, the returned Runtime's own operations ALSO fail
   * closed once `stop()` has been called (see its own "LIFECYCLE"
   * header) — a caller that grabbed a reference before `stop()` cannot
   * use it afterward either.
   */
  conversationArchiveRuntime(): FedosConversationArchiveRuntime;
  /**
   * Secure Runtime Alpha 1263/1291 — the closed, non-secret reason
   * production Conversation crypto is (or is not) currently available.
   * `"disabled"` when `config.conversationProductionCrypto` was never
   * supplied; one of the other eight closed outcomes otherwise (Alpha
   * 1263). Never a raw loader `Error`, never a provider message, never a
   * secret byte. Readable even after `stop()` — a coarse, static fact
   * about how THIS runtime started, not a live probe.
   */
  conversationProductionCryptoCapability(): FedosConversationProductionCryptoCapabilityOutcome;
  /**
   * Alpha 612 — ordering enforced: (1) no further calls into this
   * runtime are meaningful once called; (2) if delivery was started,
   * `host.stopDelivery()` first (itself already guarantees "no new
   * tick starts, in-flight tick completes," Alpha 505/506/564,
   * unchanged); (3) `host.stop()`. Throws on a SECOND call — mirrors
   * `FedosDesktopHost.stop()`'s own non-idempotent, "may only be
   * called once, from the ready/running state" contract exactly,
   * rather than silently absorbing a repeat call.
   */
  stop(): Promise<void>;
}

/** PRIVATE — ensures a caller-supplied file's own parent directory exists (Alpha 604). Never creates the file itself. */
function ensureParentDirectoryExists(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export async function startFedosDesktopRuntime(
  config: FedosDesktopRuntimeConfig,
): Promise<FedosRunningDesktopRuntime> {
  if (config.deliveryEnabled) {
    if (config.observationLogPath === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: deliveryEnabled is true but observationLogPath was not supplied — a durable Observation backend is required to activate delivery honestly (see Alpha 609).",
      );
    }
    if (config.publisher === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: deliveryEnabled is true but no publisher was supplied — this runtime constructs no Signing Authority or Relay of its own (see Alpha 610).",
      );
    }
  }
  // Secure Runtime Alpha 1471-1540 -- mirrors the deliveryEnabled guard
  // above exactly: a configuration error is thrown synchronously, BEFORE
  // any Persistence backend or Host is constructed, never a silent
  // fallback to an in-memory Observation backend or a no-op Relay.
  if (config.privateTransportEnabled) {
    if (config.conversationTransportObservationLogPath === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: privateTransportEnabled is true but conversationTransportObservationLogPath was not supplied — a durable Observation backend is required to activate transport honestly.",
      );
    }
    if (config.conversationTransportRelays === undefined || config.conversationTransportRelays.length === 0) {
      throw new Error(
        "startFedosDesktopRuntime: privateTransportEnabled is true but no conversationTransportRelays were supplied — this runtime constructs no Relay of its own.",
      );
    }
    if (config.conversationTransportSigningAuthority === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: privateTransportEnabled is true but no conversationTransportSigningAuthority was supplied — this runtime constructs no Signing Authority of its own.",
      );
    }
  }
  // Secure Runtime Alpha 1691-1760 -- mirrors the privateTransportEnabled guard
  // above exactly: a configuration error is thrown synchronously, BEFORE any
  // Persistence backend or Host is constructed, never a silent fallback to a
  // second, internally-constructed Master Seed Authority.
  if (config.archiveEnabled) {
    if (config.conversationArchiveMasterSeedAuthority === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: archiveEnabled is true but no conversationArchiveMasterSeedAuthority was supplied — this runtime constructs no Master Seed Authority of its own.",
      );
    }
  }

  ensureParentDirectoryExists(config.boardLogPath);
  ensureParentDirectoryExists(config.outboxLogPath);
  if (config.observationLogPath !== undefined) {
    ensureParentDirectoryExists(config.observationLogPath);
  }
  if (config.conversationLogPath !== undefined) {
    ensureParentDirectoryExists(config.conversationLogPath);
  }
  // Alpha 923 -- the private-Conversation draft runtime's own logs.
  for (const path of [
    config.conversationDraftLogPath,
    config.conversationMembershipLogPath,
    config.conversationCapabilityLogPath,
    config.conversationConstructionCoordinationLogPath,
    // Alpha 996/1003 -- the invitation-revocation and draft-management logs.
    config.conversationInvitationRevocationLogPath,
    config.conversationDraftManagementLogPath,
    // Alpha 1113/1121/1143 -- the Encryption Runtime Wiring's own logs plus
    // the NEW Activation coordination and Payload Retention logs.
    config.conversationEnvelopeLogPath,
    config.conversationPayloadLogPath,
    config.conversationEncryptionCoordinationLogPath,
    config.conversationActivationCoordinationLogPath,
    config.conversationPayloadRetentionLogPath,
    // Alpha 1321-1390 -- the additive Group Runtime facade's own logs.
    config.conversationGroupGenerationLogPath,
    config.conversationGroupDirectPathLogPath,
    config.conversationGroupMessageLogPath,
    config.conversationGroupFanoutDeliveryLogPath,
    // Alpha 1391-1470 -- the additive Private Nostr Delivery facade's own logs.
    config.conversationPrivateNostrDeliveryRequestLogPath,
    config.conversationPrivateNostrImportRecordLogPath,
    config.conversationPrivateNostrDeliveryObservationLogPath,
  ]) {
    if (path !== undefined) ensureParentDirectoryExists(path);
  }
  // Secure Runtime Alpha 1471-1540 -- the private-Transport runtime's own logs.
  for (const path of [
    config.conversationTransportOutboxLogPath,
    config.conversationTransportObservationLogPath,
    config.conversationEnvelopeLogPath,
    config.conversationPayloadLogPath,
  ]) {
    if (path !== undefined) ensureParentDirectoryExists(path);
  }

  const boardPersistence = new AppendOnlyFedosBoardPersistence(config.boardLogPath);
  const outboxPersistence = new AppendOnlyFedosBoardOutboxPersistence(config.outboxLogPath);
  const observationRepository =
    config.observationLogPath !== undefined
      ? new FedosDeliveryObservationRepository(
          new AppendOnlyFedosDeliveryObservationPersistence(config.observationLogPath),
        )
      : undefined;
  // Alpha 758 -- constructed explicitly HERE (not left to
  // FedosBoardRuntime's own internal default) so this function always
  // holds a concrete reference to hydrate against, below.
  const conversationPersistence: FedosConversationPersistence =
    config.conversationLogPath !== undefined
      ? new AppendOnlyFedosConversationPersistence(config.conversationLogPath)
      : new InMemoryFedosConversationPersistence();

  // Secure Runtime Alpha 1471-1540 -- Private Delivery's own durable
  // backends (Alpha 804/857, UNCHANGED classes), constructed HERE for
  // the first time anywhere in this runtime: no prior Arc ever wired
  // them into `startFedosDesktopRuntime()`. Constructed unconditionally
  // (not gated by `privateTransportEnabled`) so a future Coordinator
  // that produces real Envelopes/Payloads never depends on Transport
  // being enabled -- mirrors `conversationPersistence`'s own identical
  // "always constructed, in-memory when no log path given" discipline.
  const conversationEnvelopePersistence: FedosConversationMessageEnvelopePersistence =
    config.conversationEnvelopeLogPath !== undefined
      ? new AppendOnlyFedosConversationMessageEnvelopePersistence(config.conversationEnvelopeLogPath)
      : new InMemoryFedosConversationMessageEnvelopePersistence();
  const conversationPayloadStorage: FedosConversationPayloadStorage =
    config.conversationPayloadLogPath !== undefined
      ? new AppendOnlyFedosConversationPayloadStorage(
          config.conversationPayloadLogPath,
          config.conversationPayloadMaxByteLength ?? DEFAULT_CONVERSATION_PAYLOAD_MAX_BYTE_LENGTH,
        )
      : new InMemoryFedosConversationPayloadStorage();

  // Secure Runtime Alpha 1691-1760 -- constructed unconditionally (mirrors
  // conversationEnvelopePersistence/conversationPayloadStorage's own identical
  // discipline above), over the SAME conversationMembershipLogPath/
  // conversationCapabilityLogPath the Conversation Runtime's own Alpha 923
  // assembly already uses for its Membership/Capability Authorities -- two
  // separate port instances reading/writing the SAME durable append-only log
  // file, the same "fresh instance over the same durable backend" pattern
  // this codebase already relies on for restart-stability (Alpha 618/589).
  const conversationArchiveMembershipPersistence: FedosConversationMembershipPersistence =
    config.conversationMembershipLogPath !== undefined
      ? new AppendOnlyFedosConversationMembershipPersistence(config.conversationMembershipLogPath)
      : new InMemoryFedosConversationMembershipPersistence();
  const conversationArchiveCapabilityPersistence: FedosConversationCapabilityPersistence =
    config.conversationCapabilityLogPath !== undefined
      ? new AppendOnlyFedosConversationCapabilityPersistence(config.conversationCapabilityLogPath)
      : new InMemoryFedosConversationCapabilityPersistence();

  // Secure Runtime Alpha 1921-1980 -- mirrors conversationArchiveMembershipPersistence/
  // conversationArchiveCapabilityPersistence's own identical discipline immediately above: a SECOND
  // port instance over the SAME durable Group log paths the Conversation Runtime's own Group facade
  // (assembleFedosConversationRuntimeDependencies, via groupGenerationLogPath etc.) already uses --
  // never a second, duplicate log file, and never shared/reused across running Runtime instances.
  const conversationArchiveGroupGenerationPersistence: FedosGroupGenerationPersistence =
    config.conversationGroupGenerationLogPath !== undefined
      ? new AppendOnlyFedosGroupGenerationPersistence(config.conversationGroupGenerationLogPath)
      : new InMemoryFedosGroupGenerationPersistence();
  const conversationArchiveGroupDirectPathPersistence: FedosGroupDirectPathPersistence =
    config.conversationGroupDirectPathLogPath !== undefined
      ? new AppendOnlyFedosGroupDirectPathPersistence(config.conversationGroupDirectPathLogPath)
      : new InMemoryFedosGroupDirectPathPersistence();
  const conversationArchiveGroupMessagePersistence: FedosGroupMessagePersistence =
    config.conversationGroupMessageLogPath !== undefined
      ? new AppendOnlyFedosGroupMessagePersistence(config.conversationGroupMessageLogPath)
      : new InMemoryFedosGroupMessagePersistence();
  const conversationArchiveGroupFanoutDeliveryPersistence: FedosGroupFanoutDeliveryPersistence =
    config.conversationGroupFanoutDeliveryLogPath !== undefined
      ? new AppendOnlyFedosGroupFanoutDeliveryPersistence(config.conversationGroupFanoutDeliveryLogPath)
      : new InMemoryFedosGroupFanoutDeliveryPersistence();

  const host = createFedosDesktopHost({
    desktopApplication: createDesktopApplication(),
    boardPersistence,
    outboxPersistence,
    observationRepository,
    publisher: config.publisher,
    deliveryIntervalMs: config.deliveryIntervalMs,
  });

  await host.start(); // propagates unmodified on a corrupt Board log — Host itself sets state "failed" (Alpha 614)

  // Alpha 756/758 -- verifies every persisted Conversation record
  // against the Board state host.start() just hydrated, BEFORE any
  // FedosBoardRuntime Conversation read is ever reachable. A
  // non-"hydrated" outcome throws, mirroring the exact same "convert a
  // corrupt log into a thrown Error" discipline host.start() itself
  // already uses for a corrupt Board log.
  const boardReaderForHydration = host.board();
  if (boardReaderForHydration === null) {
    throw new Error("startFedosDesktopRuntime: Host reported ready but board() returned null -- unreachable under normal operation.");
  }
  const conversationHydration = hydrateFedosConversations(conversationPersistence, boardReaderForHydration);
  if (conversationHydration.outcome !== "hydrated") {
    throw new Error(`startFedosDesktopRuntime failed to hydrate Conversation state: ${conversationHydration.outcome}`);
  }

  let deliveryStarted = false;
  if (config.deliveryEnabled) {
    host.startDelivery(); // propagates unmodified on a corrupt Outbox/Observation log
    deliveryStarted = true;
  }

  // Alpha 672 -- exactly one FedosBoardRuntime per running runtime,
  // over the SAME host, using whichever Authority/idGenerator/clock
  // the caller supplied (or FedosBoardRuntime's own existing defaults).
  // Alpha 758 -- conversationPersistence is always the concrete
  // instance constructed above, never omitted here.
  const boardRuntimeInstance = createFedosBoardRuntime({
    host,
    idGenerator: config.idGenerator,
    clock: config.clock,
    publicAuthorAuthority: config.publicAuthorAuthority,
    conversationPolicyAuthority: config.conversationPolicyAuthority,
    nostrAuthorBindingAuthority: config.nostrAuthorBindingAuthority,
    nostrAccountIndex: config.nostrAccountIndex,
    conversationPersistence,
  });

  // Alpha 1273/1274 -- resolve the real, WASM-backed Production Crypto
  // Graph BEFORE Conversation Runtime assembly, so a successful
  // resolution can supply its own real Authorities below. Never throws
  // and never fails Runtime startup -- every internal failure mode
  // collapses to one of the nine closed capability outcomes (Alpha 1263);
  // Runtime startup itself never fails because production crypto could
  // not be assembled (Alpha 1264/1275).
  let productionCryptoCapability: FedosConversationProductionCryptoCapabilityOutcome = "disabled";
  let productionCryptoGraph: FedosConversationProductionCryptoGraph | null = null;
  if (config.conversationProductionCrypto !== undefined) {
    const productionCryptoResult = await assembleFedosConversationProductionCryptoGraph(config.conversationProductionCrypto);
    productionCryptoCapability = productionCryptoResult.outcome;
    if (productionCryptoResult.outcome === "available") {
      productionCryptoGraph = productionCryptoResult.graph;
    }
  }

  // Alpha 921/923 -- exactly one FedosConversationRuntime per running
  // runtime, a NEW peer to FedosBoardRuntime (not a wrapper, not a
  // subclass), over its own durable (or in-memory) backends. Constructed
  // over already-assembled ports/authorities; it reaches into Host for
  // nothing. Encryption readiness defaults to UNAVAILABLE, so every draft
  // it constructs stays "draft" -- never active, never a message (Alpha
  // 924/928).
  const conversationRuntimeInstance = createFedosConversationRuntime(
    assembleFedosConversationRuntimeDependencies({
      draftLogPath: config.conversationDraftLogPath,
      membershipLogPath: config.conversationMembershipLogPath,
      capabilityLogPath: config.conversationCapabilityLogPath,
      constructionCoordinationLogPath: config.conversationConstructionCoordinationLogPath,
      invitationRevocationLogPath: config.conversationInvitationRevocationLogPath,
      draftManagementLogPath: config.conversationDraftManagementLogPath,
      clock: config.clock ?? defaultFedosBoardRuntimeClock,
      // Alpha 1273 -- a real, "available" Production Crypto Graph supplies
      // its own real creator identity/Authorities in place of these
      // individual fields' own existing defaults; any other outcome
      // (including "disabled" -- no config supplied at all) leaves this
      // exactly as every prior Arc's own default (Alpha 1275).
      creatorIdentityAuthority: productionCryptoGraph?.creatorIdentityAuthority ?? config.conversationCreatorIdentityAuthority,
      encryptionReadinessAuthority: config.conversationEncryptionReadinessAuthority,
      requireResolvedCreatorIdentity: config.conversationRequireResolvedCreatorIdentity,
      // Alpha 1113/1114 -- the Encryption Runtime Wiring's own dependencies,
      // finally threaded through from this config (previously accepted by
      // `FedosConversationRuntimeDependencies` but unreachable from here —
      // see `docs/secure_runtime_alpha_1111_1180_integrated_inventory.md`
      // §7). `nostrAuthorBindingAuthority` reuses the SAME instance already
      // passed to `createFedosBoardRuntime()` above -- one coherent graph,
      // never a second signing/encryption identity (Alpha 1114) -- UNLESS
      // a real Production Crypto Graph resolved, in which case ITS OWN
      // binding authority (sharing ITS OWN Master Seed Authority instance)
      // is the coherent one to use instead.
      encryptionAuthority: productionCryptoGraph?.encryptionAuthority ?? config.conversationEncryptionAuthority,
      decryptionAuthority: productionCryptoGraph?.decryptionAuthority ?? config.conversationDecryptionAuthority,
      identityResolver: config.conversationIdentityResolver,
      accountIndexAuthority: productionCryptoGraph?.accountIndexAuthority ?? config.conversationAccountIndexAuthority,
      nostrAuthorBindingAuthority: productionCryptoGraph?.nostrAuthorBindingAuthority ?? config.nostrAuthorBindingAuthority,
      envelopeLogPath: config.conversationEnvelopeLogPath,
      payloadLogPath: config.conversationPayloadLogPath,
      maxPayloadByteLength: config.conversationMaxPayloadByteLength,
      encryptionCoordinationLogPath: config.conversationEncryptionCoordinationLogPath,
      // Alpha 1121/1143 -- the NEW Activation coordination and Payload
      // Retention logs this Arc introduces.
      activationCoordinationLogPath: config.conversationActivationCoordinationLogPath,
      payloadRetentionLogPath: config.conversationPayloadRetentionLogPath,
      // Alpha 1321-1390 -- the additive Group Runtime facade's own logs.
      groupGenerationLogPath: config.conversationGroupGenerationLogPath,
      groupDirectPathLogPath: config.conversationGroupDirectPathLogPath,
      groupMessageLogPath: config.conversationGroupMessageLogPath,
      groupFanoutDeliveryLogPath: config.conversationGroupFanoutDeliveryLogPath,
      groupParticipantLimitPolicy: config.conversationGroupParticipantLimitPolicy,
      // Alpha 1391-1470 -- the additive Private Nostr Delivery facade's own
      // backends. This runtime constructs no Signing Authority or
      // Relay/Publisher of its own -- see this file's own config type header.
      privateNostrDeliveryRequestLogPath: config.conversationPrivateNostrDeliveryRequestLogPath,
      privateNostrImportRecordLogPath: config.conversationPrivateNostrImportRecordLogPath,
      privateNostrDeliveryObservationLogPath: config.conversationPrivateNostrDeliveryObservationLogPath,
      privateNostrSigningAuthority: config.conversationPrivateNostrSigningAuthority,
      privateNostrDeliveryPublisher: config.conversationPrivateNostrDeliveryPublisher,
      privateNostrDefaultMode: config.conversationPrivateNostrDefaultMode,
      privateNostrDefaultRelayUrls: config.conversationPrivateNostrDefaultRelayUrls,
    }),
  );

  // Secure Runtime Alpha 1471-1540 -- exactly one FedosPrivateTransport
  // per running runtime, constructed ONLY when config.privateTransportEnabled
  // was true (the guard at the top of this function already confirmed
  // conversationTransportObservationLogPath/conversationTransportRelays/
  // conversationTransportSigningAuthority are all present in that case).
  // Reaches into conversationRuntimeInstance for membership reads ONLY
  // (`listMemberships`), the SAME narrow-accessor discipline
  // `FedosConversationTransportSignedEventSource` itself requires.
  let privateTransportInstance: FedosPrivateTransport | undefined;
  let privateTransportStarted = false;
  if (config.privateTransportEnabled) {
    const conversationTransportOutboxPersistence: FedosConversationTransportOutboxPersistence =
      config.conversationTransportOutboxLogPath !== undefined
        ? new AppendOnlyFedosConversationTransportOutboxPersistence(config.conversationTransportOutboxLogPath)
        : new InMemoryFedosConversationTransportOutboxPersistence();
    const conversationTransportObservationRepository = new FedosDeliveryObservationRepository(
      new AppendOnlyFedosDeliveryObservationPersistence(config.conversationTransportObservationLogPath!),
    );

    privateTransportInstance = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet(config.conversationTransportRelays!),
      signingAuthority: config.conversationTransportSigningAuthority!,
      localAccountIndex: config.conversationTransportAccountIndex ?? 0,
      envelopePersistence: conversationEnvelopePersistence,
      payloadStorage: conversationPayloadStorage,
      membershipsForConversation: (id) => conversationRuntimeInstance.listMemberships(id),
      outboxPersistence: conversationTransportOutboxPersistence,
      observationRepository: conversationTransportObservationRepository,
      intervalMs: config.conversationTransportIntervalMs ?? DEFAULT_CONVERSATION_TRANSPORT_INTERVAL_MS,
      publisher: config.conversationTransportPublisher,
      inbound: config.conversationTransportInbound,
    });
    await privateTransportInstance.start();
    privateTransportStarted = true;
  }

  let stopped = false;

  // Secure Runtime Alpha 1691-1760 -- exactly one FedosConversationArchiveRuntime
  // per running runtime, constructed ONLY when config.archiveEnabled was true (the
  // guard at the top of this function already confirmed
  // conversationArchiveMasterSeedAuthority is present in that case). Wraps the SAME
  // conversationPersistence/conversationArchiveMembershipPersistence/
  // conversationArchiveCapabilityPersistence/conversationEnvelopePersistence/
  // conversationPayloadStorage instances this runtime already owns -- never a
  // second, duplicate set of ports, and constructs no Master Seed Authority of its
  // own (mirrors privateTransportInstance's own identical "no Signing Authority of
  // its own" discipline just above). `isRuntimeRunning` closes over this same
  // `stopped` flag -- lazily read only once actually invoked, so its textual
  // position relative to `let stopped` above is not order-sensitive.
  let archiveRuntimeInstance: FedosConversationArchiveRuntime | undefined;
  if (config.archiveEnabled) {
    archiveRuntimeInstance = assembleFedosConversationArchiveRuntime({
      conversationPersistence,
      membershipPersistence: conversationArchiveMembershipPersistence,
      capabilityPersistence: conversationArchiveCapabilityPersistence,
      envelopePersistence: conversationEnvelopePersistence,
      payloadStorage: conversationPayloadStorage,
      // Secure Runtime Alpha 1921-1980 -- the SAME "second port instance over the same durable Group
      // log path" pattern the base five ports above already establish.
      groupGenerationPersistence: conversationArchiveGroupGenerationPersistence,
      groupDirectPathPersistence: conversationArchiveGroupDirectPathPersistence,
      groupMessagePersistence: conversationArchiveGroupMessagePersistence,
      groupFanoutDeliveryPersistence: conversationArchiveGroupFanoutDeliveryPersistence,
      masterSeedAuthority: config.conversationArchiveMasterSeedAuthority!,
      isRuntimeRunning: () => !stopped,
      clock: config.clock,
      bounds: config.conversationArchiveBounds,
    });
  }

  return {
    host,
    boardRuntime(): FedosBoardRuntime {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.boardRuntime() is inaccessible after stop().");
      }
      return boardRuntimeInstance;
    },
    conversationRuntime(): FedosConversationRuntime {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.conversationRuntime() is inaccessible after stop().");
      }
      return conversationRuntimeInstance;
    },
    privateTransport(): FedosPrivateTransport {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.privateTransport() is inaccessible after stop().");
      }
      if (privateTransportInstance === undefined) {
        throw new Error("FedosRunningDesktopRuntime.privateTransport() is not enabled -- see config.privateTransportEnabled.");
      }
      return privateTransportInstance;
    },
    conversationArchiveRuntime(): FedosConversationArchiveRuntime {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.conversationArchiveRuntime() is inaccessible after stop().");
      }
      if (archiveRuntimeInstance === undefined) {
        throw new Error("FedosRunningDesktopRuntime.conversationArchiveRuntime() is not enabled -- see config.archiveEnabled.");
      }
      return archiveRuntimeInstance;
    },
    /** Alpha 1263/1291 -- the closed, non-secret reason production crypto is (or is not) available. `"disabled"` when `conversationProductionCrypto` was never supplied. Readable even after `stop()`. */
    conversationProductionCryptoCapability(): FedosConversationProductionCryptoCapabilityOutcome {
      return productionCryptoCapability;
    },
    async stop(): Promise<void> {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.stop() may only be called once.");
      }
      stopped = true;
      // Newest-constructed, stopped first -- the reverse of construction order.
      if (privateTransportStarted && privateTransportInstance !== undefined) {
        await privateTransportInstance.stop();
      }
      if (deliveryStarted) {
        await host.stopDelivery();
      }
      // Alpha 1277/1278 -- clear the real Master Seed Authority (where one
      // was assembled) BEFORE the Host itself stops: no passphrase
      // material is retained, and every subsequent encrypt/decrypt/sign
      // attempt against it fails closed (Alpha 438's own `clear()`
      // contract, unmodified).
      if (productionCryptoGraph !== null) {
        await productionCryptoGraph.masterSeedAuthority.clear();
      }
      await host.stop();
    },
  };
}
