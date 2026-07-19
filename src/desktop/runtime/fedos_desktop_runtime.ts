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

// Secure Runtime Alpha 2921-3000 (Device Trust and Multi-Device Runtime
// Integration Arc) -- every import/addition below this comment is
// ADDITIVE ONLY, mirroring the Alpha 1471-1540 boundary comment above.
import { InMemoryFedosDeviceRegistryPersistence } from "../../device/persistence/in_memory_fedos_device_registry_persistence.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../../device/persistence/append_only_fedos_device_registry_persistence.js";
import type { FedosDeviceRegistryPersistence } from "../../device/persistence/fedos_device_registry_persistence.js";
import { PersistedFedosDeviceTrustAuthority } from "../../device/persistence/persisted_fedos_device_trust_authority.js";
import { UnavailableFedosDeviceRegistrationAuthority } from "../../device/unavailable_fedos_device_registration_authority.js";
import { FedosSyncState } from "../../sync/fedos_sync_state.js";
import { FedosDeviceTrustRuntime } from "./fedos_device_trust_runtime.js";

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
   * Secure Runtime Alpha 2921–3000 — the `FedosDeviceTrustRuntime`
   * (`./fedos_device_trust_runtime.js`) this running Local Runtime owns,
   * constructed ONLY when `config.deviceTrustEnabled` was `true`. Throws
   * `"not enabled"` if it was never configured, and throws
   * `"inaccessible after stop"` once `stop()` has been called — the SAME
   * two-state fail-closed contract `privateTransport()` itself uses.
   */
  deviceTrust(): FedosDeviceTrustRuntime;
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
  // Secure Runtime Alpha 2921-3000 -- mirrors the guards above exactly:
  // a configuration error is thrown synchronously, BEFORE any Persistence
  // backend or Host is constructed, never a silent in-memory/no-account fallback.
  if (config.deviceTrustEnabled) {
    if (config.localDeviceId === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: deviceTrustEnabled is true but no localDeviceId was supplied — this runtime generates no device id of its own.",
      );
    }
    if (config.localAccountRef === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: deviceTrustEnabled is true but no localAccountRef was supplied.",
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
  if (config.deviceRegistryLogPath !== undefined) {
    ensureParentDirectoryExists(config.deviceRegistryLogPath);
  }
  // Alpha 923 -- the private-Conversation draft runtime's own logs.
  for (const path of [
    config.conversationDraftLogPath,
    config.conversationMembershipLogPath,
    config.conversationCapabilityLogPath,
    config.conversationConstructionCoordinationLogPath,
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
      clock: config.clock ?? defaultFedosBoardRuntimeClock,
      creatorIdentityAuthority: config.conversationCreatorIdentityAuthority,
      encryptionReadinessAuthority: config.conversationEncryptionReadinessAuthority,
      requireResolvedCreatorIdentity: config.conversationRequireResolvedCreatorIdentity,
    }),
  );

  // Secure Runtime Alpha 2921-3000 -- exactly one FedosDeviceTrustRuntime
  // per running runtime, constructed ONLY when config.deviceTrustEnabled
  // was true (the guard at the top of this function already confirmed
  // localDeviceId/localAccountRef are both present in that case). The
  // Device Registry persistence backend follows the SAME
  // "AppendOnly when a log path is supplied, else InMemory" discipline
  // every other backend in this function already uses. The Sync State
  // (Alpha 2421-2500, unmodified) is always in-memory -- this Arc adds
  // no disk persistence for the Sync Journal/Cursor themselves (see
  // fedos_device_trust_runtime.ts's own header).
  let deviceTrustRuntimeInstance: FedosDeviceTrustRuntime | undefined;
  if (config.deviceTrustEnabled) {
    const deviceRegistryPersistence: FedosDeviceRegistryPersistence =
      config.deviceRegistryLogPath !== undefined
        ? new AppendOnlyFedosDeviceRegistryPersistence(config.deviceRegistryLogPath)
        : new InMemoryFedosDeviceRegistryPersistence();
    const deviceTrustAuthority = new PersistedFedosDeviceTrustAuthority({
      persistence: deviceRegistryPersistence,
      registrationAuthority: config.deviceRegistrationAuthority ?? new UnavailableFedosDeviceRegistrationAuthority(),
    });
    const syncAccountKey = `${config.localAccountRef!.authority}:${config.localAccountRef!.publicIdentifier}`;
    deviceTrustRuntimeInstance = new FedosDeviceTrustRuntime({
      localDeviceId: config.localDeviceId!,
      localAccountRef: config.localAccountRef!,
      trustAuthority: deviceTrustAuthority,
      syncState: new FedosSyncState(syncAccountKey),
    });
  }

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
    deviceTrust(): FedosDeviceTrustRuntime {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.deviceTrust() is inaccessible after stop().");
      }
      if (deviceTrustRuntimeInstance === undefined) {
        throw new Error("FedosRunningDesktopRuntime.deviceTrust() is not enabled -- see config.deviceTrustEnabled.");
      }
      return deviceTrustRuntimeInstance;
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
      await host.stop();
    },
  };
}
