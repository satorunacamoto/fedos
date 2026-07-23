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
  type FedosConversationDirectRatchetIntegrationDependencies,
  type FedosConversationPeerCapabilityIntegrationDependencies,
  type FedosConversationInvitationIntegrationDependencies,
  type FedosConversationIdentityTransitionIntegrationDependencies,
  type FedosConversationDeletionRequestIntegrationDependencies,
} from "../../conversation/runtime/fedos_conversation_runtime.js";
import type { FedosMasterSeedAuthority } from "../../runtime/master_seed/fedos_master_seed_authority.js";
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
import { NostrNip17V1WireAdapter } from "../../conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.js";
import type { FedosConversationDirectMessageDeliveryDependencies } from "../../conversation/messaging/fedos_conversation_direct_messaging_coordinator.js";

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

// Secure Runtime Alpha 3081-3160 (Desktop Runtime Conversation Content
// Accessor and Application Shell Activation Arc) -- every import/addition
// below this comment is ADDITIVE ONLY, mirroring the Alpha 1691-1760
// boundary comment above for the same reason.
import { FedosDesktopConversationContentAccessor } from "../content_accessor/fedos_desktop_conversation_content_accessor.js";

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

// Secure Runtime Alpha 3801-3880 (Device Sync Operational Status and
// Desktop Shell Integration Arc) -- every import/addition below this
// comment is ADDITIVE ONLY, mirroring the Alpha 1691-1760 boundary
// comment above for the same reason.
import { FedosDeviceSyncScheduler } from "../../device/sync_scheduler/fedos_device_sync_scheduler.js";
import type { FedosDeviceSyncSchedulePersistence } from "../../device/sync_scheduler/persistence/fedos_device_sync_schedule_persistence.js";
import { AppendOnlyFedosDeviceSyncSchedulePersistence } from "../../device/sync_scheduler/persistence/append_only_fedos_device_sync_schedule_persistence.js";
import { InMemoryFedosDeviceSyncSchedulePersistence } from "../../device/sync_scheduler/persistence/in_memory_fedos_device_sync_schedule_persistence.js";
import type { FedosDeviceSyncConflictPersistence } from "../../device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.js";
import { AppendOnlyFedosDeviceSyncConflictPersistence } from "../../device/sync_scheduler/persistence/append_only_fedos_device_sync_conflict_persistence.js";
import { InMemoryFedosDeviceSyncConflictPersistence } from "../../device/sync_scheduler/persistence/in_memory_fedos_device_sync_conflict_persistence.js";
import type { FedosDeviceTransferSessionPersistence } from "../../device/transfer/persistence/fedos_device_transfer_session_persistence.js";
import { AppendOnlyFedosDeviceTransferSessionPersistence } from "../../device/transfer/persistence/append_only_fedos_device_transfer_session_persistence.js";
import { InMemoryFedosDeviceTransferSessionPersistence } from "../../device/transfer/persistence/in_memory_fedos_device_transfer_session_persistence.js";
import type { FedosDeviceRelaySyncObservationRepository } from "../../device/relay_sync/fedos_device_relay_sync_observation.js";
import { AppendOnlyFedosDeviceRelaySyncObservationRepository } from "../../device/relay_sync/persistence/append_only_fedos_device_relay_sync_observation_repository.js";
import { InMemoryFedosDeviceRelaySyncObservationRepository } from "../../device/relay_sync/persistence/in_memory_fedos_device_relay_sync_observation_repository.js";
import { FedosDeviceSyncOperationalFacade, type FedosDeviceSyncOperationalFacadeDeps } from "./fedos_device_sync_operational_facade.js";

// Secure Runtime Alpha 4581-4660 (Desktop Device Registration, Pairing, and
// Durable Sync Journal Arc) -- every import/addition below this comment is
// ADDITIVE ONLY, mirroring the Alpha 1471-1540 boundary comment above.
import { createFedosDeviceBindingBoundary } from "../../device/binding_challenge/fedos_device_binding_boundary_factory.js";
import type { FedosDeviceBindingChallengeReplayPersistence } from "../../device/persistence/fedos_device_binding_challenge_replay_persistence.js";
import { AppendOnlyFedosDeviceBindingChallengeReplayPersistence } from "../../device/persistence/append_only_fedos_device_binding_challenge_replay_persistence.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../../device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import { FedosDevicePairingFacade } from "./fedos_device_pairing_facade.js";
import type { FedosSyncJournalPersistence } from "../../sync/persistence/fedos_sync_journal_persistence.js";
import { AppendOnlyFedosSyncJournalPersistence } from "../../sync/persistence/append_only_fedos_sync_journal_persistence.js";
import { InMemoryFedosSyncJournalPersistence } from "../../sync/persistence/in_memory_fedos_sync_journal_persistence.js";
// Secure Runtime Alpha 6521-6600 (FedOS Desktop Beta Production Runtime
// Configuration Unification Arc) -- every import below this comment is
// ADDITIVE ONLY, closing the gap this Arc's own mission names: production
// bootstrap previously had no route to any of these four subsystems.
import type { FedosConversationSearchIndex } from "../../conversation/search/fedos_conversation_search_index.js";
import type { FedosDirectRatchetSealingAuthority } from "../../conversation/ratchet/fedos_direct_ratchet_sealing_authority.js";
import { AppendOnlyFedosDirectRatchetSessionPersistence } from "../../conversation/ratchet/persistence/append_only_fedos_direct_ratchet_session_persistence.js";
import { AppendOnlyFedosSealedDirectRatchetSecretPersistence } from "../../conversation/ratchet/persistence/append_only_fedos_sealed_direct_ratchet_secret_persistence.js";
import { AppendOnlyFedosDirectRatchetSessionResetRecordPersistence } from "../../conversation/ratchet/persistence/append_only_fedos_direct_ratchet_session_reset_record_persistence.js";
import { AppendOnlyFedosPrivateNostrImportRecordPersistence } from "../../conversation/delivery/nostr/append_only_fedos_private_nostr_import_record_persistence.js";
import { AppendOnlyFedosRatchetPeerCapabilityObservationPersistence } from "../../conversation/ratchet/peer_capability/persistence/append_only_fedos_ratchet_peer_capability_observation_persistence.js";
import { AppendOnlyFedosConversationInvitationReceivedPersistence } from "../../conversation/invitation_bootstrap/persistence/append_only_fedos_conversation_invitation_received_persistence.js";
import { FedosSecureRandomConversationInvitationIdGenerator } from "../../conversation/invitation_bootstrap/fedos_secure_random_conversation_invitation_id_generator.js";
import { AppendOnlyFedosIdentityTransitionPeerObservationPersistence } from "../../conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_peer_observation_persistence.js";
import { AppendOnlyFedosIdentityTransitionLocalDecisionPersistence } from "../../conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_local_decision_persistence.js";
import { AppendOnlyFedosDeletionRequestStatePersistence } from "../../conversation/deletion_request/append_only_fedos_deletion_request_state_persistence.js";
import { AppendOnlyFedosDeletionRecipientDecisionPersistence } from "../../conversation/deletion_request/append_only_fedos_deletion_recipient_decision_persistence.js";
import { AppendOnlyFedosDeletionAcknowledgementPersistence } from "../../conversation/deletion_request/append_only_fedos_deletion_acknowledgement_persistence.js";
import { AppendOnlyFedosDeletionExecutionPersistence } from "../../conversation/deletion/append_only_fedos_deletion_execution_persistence.js";
import { AppendOnlyFedosDeletionRequestInboxSummaryPersistence } from "../../conversation/deletion_request/append_only_fedos_deletion_request_inbox_summary_persistence.js";
import { AppendOnlyFedosDeletionRequestPendingReviewPersistence } from "../../conversation/deletion_request/append_only_fedos_deletion_request_pending_review_persistence.js";

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
   * Secure Runtime Alpha 3081-3160 — the `FedosDesktopConversationContentAccessor`
   * (`../content_accessor/fedos_desktop_conversation_content_accessor.ts`)
   * this running Local Runtime owns — ALWAYS constructed (never gated by a
   * config flag, mirroring `conversationRuntime()`'s own "always available"
   * discipline), over the SAME `conversationRuntimeInstance`/
   * `archiveRuntimeInstance` this function already holds — never a second,
   * divergent Conversation Runtime or Archive Runtime. Throws
   * `"inaccessible after stop"` once `stop()` has been called — the SAME
   * fail-closed contract every other accessor on this handle already uses;
   * the accessor's OWN internal `isRuntimeRunning` closure independently
   * enforces the identical rule for any reference a caller grabbed before
   * `stop()` (mirrors `conversationArchiveRuntime()`'s own two-layer
   * defense).
   */
  conversationContentAccessor(): FedosDesktopConversationContentAccessor;
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
   * Secure Runtime Alpha 2921–3000 — the `FedosDeviceTrustRuntime`
   * (`./fedos_device_trust_runtime.js`) this running Local Runtime owns,
   * constructed ONLY when `config.deviceTrustEnabled` was `true`. Throws
   * `"not enabled"` if it was never configured, and throws
   * `"inaccessible after stop"` once `stop()` has been called — the SAME
   * two-state fail-closed contract `privateTransport()` itself uses.
   */
  deviceTrust(): FedosDeviceTrustRuntime;
  /**
   * Secure Runtime Alpha 3801–3880 — the `FedosDeviceSyncOperationalFacade`
   * (`./fedos_device_sync_operational_facade.js`) this running Local Runtime
   * owns, constructed ONLY when `config.deviceTrustEnabled` was `true` (the
   * SAME gate `deviceTrust()` itself uses — the facade composes that SAME
   * `FedosDeviceTrustRuntime` instance). Throws `"not enabled"` if it was
   * never configured, and throws `"inaccessible after stop"` once `stop()`
   * has been called — the SAME two-state fail-closed contract every other
   * accessor on this handle already uses. The facade's OWN methods apply a
   * SECOND, independent `isRuntimeRunning` check for a reference a caller
   * grabbed before `stop()` (mirrors `conversationContentAccessor()`'s own
   * two-layer defense).
   */
  deviceSyncOperational(): FedosDeviceSyncOperationalFacade;
  /**
   * Secure Runtime Alpha 4581–4660 — the `FedosDevicePairingFacade`
   * (`./fedos_device_pairing_facade.js`) this running Local Runtime owns,
   * constructed ONLY when `config.deviceTrustEnabled` was `true` (the SAME
   * gate `deviceTrust()`/`deviceSyncOperational()` themselves use — this
   * facade composes the SAME `FedosDeviceTrustRuntime` instance plus a
   * `FedosDeviceBindingBoundary` built over the SAME Device Registry
   * persistence backend, never a second Device Registry — see Phase A §8 of
   * this Arc's own execution spec). Throws `"not enabled"` if it was never
   * configured, and throws `"inaccessible after stop"` once `stop()` has
   * been called — the SAME two-state fail-closed contract every other
   * accessor on this handle already uses.
   */
  devicePairing(): FedosDevicePairingFacade;
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

/**
 * Secure Runtime Alpha 6521-6600 — PRIVATE structural duck-type check: does
 * this `FedosMasterSeedAuthority` ALSO implement `FedosDirectRatchetSealingAuthority`
 * (`FedosWasmMasterSeedAuthority` does, additionally; `DevelopmentFedosMasterSeedAuthority`
 * does not)? Never imports the concrete WASM class here (this file must
 * construct correctly even when the WASM artifact is entirely absent) —
 * a pure shape check only, matching this whole subsystem's own established
 * "never fabricate, never throw, degrade to null" discipline.
 */
function isFedosDirectRatchetSealingAuthority(authority: FedosMasterSeedAuthority): authority is FedosMasterSeedAuthority & FedosDirectRatchetSealingAuthority {
  const candidate = authority as Partial<FedosDirectRatchetSealingAuthority>;
  return typeof candidate.sealDirectRatchetSecret === "function" && typeof candidate.restoreDirectRatchetSecret === "function";
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
  // Secure Runtime Alpha 3801-3880 -- mirrors the guards above exactly. Also
  // requires deviceTrustEnabled, since the Scheduler reuses the SAME Device
  // Registry/Sync Journal instances FedosDeviceTrustRuntime already owns.
  if (config.deviceSyncSchedulerEnabled) {
    if (!config.deviceTrustEnabled) {
      throw new Error(
        "startFedosDesktopRuntime: deviceSyncSchedulerEnabled is true but deviceTrustEnabled is not -- the Scheduler reuses FedosDeviceTrustRuntime's own Device Registry/Sync Journal instances.",
      );
    }
    if (config.deviceSyncAbandonmentPolicy === undefined) {
      throw new Error(
        "startFedosDesktopRuntime: deviceSyncSchedulerEnabled is true but no deviceSyncAbandonmentPolicy was supplied — this runtime constructs no default retry policy of its own.",
      );
    }
  }
  // Secure Runtime Alpha 1841-1920 Phase G (Alpha 1844/1878) -- the
  // standard route rides the SAME Private Transport this guard block
  // already gates; requesting it without transport enabled is a genuine
  // configuration error, thrown synchronously, never a silent no-op.
  if (config.conversationDirectMessageDeliveryRoute === "nostr-nip17-v1" && !config.privateTransportEnabled) {
    throw new Error(
      "startFedosDesktopRuntime: conversationDirectMessageDeliveryRoute is \"nostr-nip17-v1\" but privateTransportEnabled is not true -- the standard route requires the Private Transport queue/Scheduler/Multi-Relay plumbing.",
    );
  }
  // Secure Runtime Alpha 1841-1920 Phase C (Alpha 1843) -- the standard
  // route's own NIP-44 Seal encryption MUST use the SAME Master Seed
  // `conversationTransportSigningAuthority`'s own real Nostr identity is
  // derived from (NIP-44's ECDH requires the matching private key) --
  // never a second, independent, incoherent crypto identity. A real
  // Production Crypto Graph is therefore REQUIRED, never defaulted or
  // silently substituted with an unrelated fresh WASM master seed.
  if (config.conversationDirectMessageDeliveryRoute === "nostr-nip17-v1" && config.conversationProductionCrypto === undefined) {
    throw new Error(
      "startFedosDesktopRuntime: conversationDirectMessageDeliveryRoute is \"nostr-nip17-v1\" but conversationProductionCrypto was not supplied -- the standard route requires a real, coherent Master Seed graph for NIP-44/NIP-59, never a second, independent identity.",
    );
  }
  // Secure Runtime Alpha 6521-6600 -- mirrors every guard above exactly: a
  // configuration error is thrown synchronously, BEFORE any Persistence
  // backend or Host is constructed, never a silent no-op. All four new
  // subsystems need a real Device Registry AND a real
  // `sendMailboxNip17Control` to do anything -- both come from
  // `deviceTrustEnabled`/`privateTransportEnabled` respectively.
  for (const [flag, name] of [
    [config.directRatchetEnabled, "directRatchetEnabled"],
    [config.peerCapabilityEnabled, "peerCapabilityEnabled"],
    [config.identityTransitionEnabled, "identityTransitionEnabled"],
    [config.deletionRequestEnabled, "deletionRequestEnabled"],
  ] as const) {
    if (!flag) continue;
    if (!config.deviceTrustEnabled) {
      throw new Error(`startFedosDesktopRuntime: ${name} is true but deviceTrustEnabled is not -- this subsystem reuses FedosDeviceTrustRuntime's own Device Registry instance.`);
    }
    if (!config.privateTransportEnabled) {
      throw new Error(`startFedosDesktopRuntime: ${name} is true but privateTransportEnabled is not -- this subsystem sends/receives control payloads through the real Private Transport, never a fabricated one.`);
    }
  }
  if (config.peerCapabilityEnabled && config.conversationPeerCapability === undefined && config.peerCapabilityLocallySupportedCapabilities === undefined) {
    throw new Error(
      "startFedosDesktopRuntime: peerCapabilityEnabled is true but no peerCapabilityLocallySupportedCapabilities was supplied -- this runtime advertises no capability of its own by default, never a fabricated list.",
    );
  }
  if (config.deletionRequestEnabled && config.conversationDeletionRequest === undefined && config.deletionRequestResolveLocalPolicy === undefined) {
    throw new Error(
      "startFedosDesktopRuntime: deletionRequestEnabled is true but no deletionRequestResolveLocalPolicy was supplied -- this runtime applies no default recipient policy of its own.",
    );
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
  // Secure Runtime Alpha 4581-4660 -- the Pairing Boundary's replay log and
  // the durable Sync Journal log.
  if (config.deviceBindingChallengeReplayLogPath !== undefined) {
    ensureParentDirectoryExists(config.deviceBindingChallengeReplayLogPath);
  }
  if (config.deviceSyncJournalLogPath !== undefined) {
    ensureParentDirectoryExists(config.deviceSyncJournalLogPath);
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

  // Secure Runtime Alpha 1841-1920 Phase C/G (Alpha 1843/1844/1879) --
  // forward-declared HERE, BEFORE `conversationRuntimeInstance` is built
  // below, so the closure handed to it can reference the Private
  // Transport instance this function does not construct until AFTER the
  // Conversation Runtime (mirrors `membershipsForConversation`'s own
  // identical forward-reference-via-closure discipline a few dozen lines
  // below, applied in the opposite direction). By the time
  // `sendDirectMessage()` is EVER actually called (well after this whole
  // function returns), `privateTransportInstance` is already assigned --
  // this is a construction-order convenience, never a live race.
  let privateTransportInstance: FedosPrivateTransport | undefined;
  const directMessageDelivery: FedosConversationDirectMessageDeliveryDependencies | undefined =
    config.conversationDirectMessageDeliveryRoute === "nostr-nip17-v1"
      ? {
          route: "nostr-nip17-v1",
          sendMailboxNip17: async (envelopeId, conversationId, plaintext) => {
            if (privateTransportInstance === undefined) return { outcome: "route-unavailable" };
            return privateTransportInstance.sendMailboxNip17(envelopeId as never, conversationId as never, plaintext);
          },
        }
      : undefined;

  // Secure Runtime Alpha 6521-6600 -- the SAME forward-reference-via-closure
  // discipline as `directMessageDelivery.sendMailboxNip17` immediately
  // above, for the FOUR new subsystems' own `sendMailboxNip17Control`
  // control-payload route. By the time any of these subsystems actually
  // sends anything (well after this whole function returns),
  // `privateTransportInstance` is already assigned.
  const sendMailboxNip17Control = async (controlId: string, conversationId: unknown, plaintext: Uint8Array, createdAt: number) => {
    if (privateTransportInstance === undefined) return { outcome: "route-unavailable" as const };
    return privateTransportInstance.sendMailboxNip17Control(controlId, conversationId as never, plaintext, createdAt);
  };

  // Secure Runtime Alpha 6521-6600 -- `deviceRegistryPersistence` is
  // HOISTED here (rather than left as the `deviceTrustEnabled` block's own
  // local `const`, further below) so the four new subsystems' own
  // dependency bundles -- built BEFORE that block runs, since they must be
  // ready in time for `createFedosConversationRuntime()` just below -- can
  // share the EXACT SAME instance the `deviceTrustEnabled` block already
  // constructs, never a second, divergent Device Registry. Side-effect-free
  // (wraps a log path or defaults to in-memory) — safe to construct early.
  let deviceRegistryPersistence: FedosDeviceRegistryPersistence | undefined;
  if (config.deviceTrustEnabled) {
    deviceRegistryPersistence =
      config.deviceRegistryLogPath !== undefined
        ? new AppendOnlyFedosDeviceRegistryPersistence(config.deviceRegistryLogPath)
        : new InMemoryFedosDeviceRegistryPersistence();
  }

  // Secure Runtime Alpha 6521-6600 -- the search index a granted Signed
  // Deletion Request's own `reconcilePayloadRetention()` reconciles MUST be
  // the SAME instance `conversationContentAccessorInstance.search()` later
  // queries -- never a second, divergent index. `conversationRuntimeInstance`
  // (needed to construct a real one via `createSearchIndex()`) does not
  // exist yet at this point, so this proxy forward-references it exactly
  // like `sendMailboxNip17Control` above forward-references
  // `privateTransportInstance` -- assigned once, immediately after
  // `conversationRuntimeInstance` exists, well before any real deletion
  // request could ever be processed.
  let sharedSearchIndexInstance: FedosConversationSearchIndex | undefined;
  const deletionRequestSearchIndex = {
    reconcilePayloadRetention: (payloadId: never) => sharedSearchIndexInstance?.reconcilePayloadRetention(payloadId) ?? 0,
  };

  // Secure Runtime Alpha 6521-6600 -- Direct Ratchet REQUIRES a real,
  // resolved production Master Seed Authority -- if `directRatchetEnabled`
  // is true but none resolved (e.g. the WASM artifact is genuinely absent
  // in this environment), this subsystem stays honestly unreachable
  // (`directRatchet()` returns `null`) rather than fabricating a Master
  // Seed Authority or throwing a hard configuration error for an
  // environment fact that is not the caller's own mistake -- mirrors this
  // whole file's own established "artifact-missing degrades gracefully"
  // convention.
  //
  // Secure Runtime Alpha 6841-6920 -- prefers `config.conversationDirectRatchetMasterSeedAuthority`
  // (the ALREADY-ACTIVATED canonical production authority the Coordinator
  // already holds -- the SAME object profile unlock constructed) over the
  // legacy `productionCryptoGraph` path -- eliminating the second,
  // independent, `NODE_ENV=development`-gated WASM instance/authority the
  // immediately-prior Arc's own real packaged run proved was the last
  // reachability blocker for the canonical packaged entry point. The
  // legacy `productionCryptoGraph` path remains fully intact, unmodified,
  // for any dev/test caller that still supplies `conversationProductionCrypto`
  // directly -- zero regression, zero removed capability.
  //
  // GATE REQUIRES the sealing port specifically (`isFedosDirectRatchetSealingAuthority()`),
  // not merely "some masterSeedAuthority exists" -- caught by this Arc's own
  // real regression test: `DevelopmentFedosMasterSeedAuthority` implements
  // `FedosMasterSeedAuthority` but deliberately NOT the sealing port, and
  // must NEVER make Direct Ratchet appear reachable (that would be exactly
  // the "development crypto in production"/"missing capability fails
  // closed" violation this Arc's own mission absolutely prohibits) --
  // `FedosWasmMasterSeedAuthority` and, as of this Arc,
  // `FedosProductionMasterSeedAuthority` both genuinely implement it, so
  // both correctly pass this gate; a bare `FedosMasterSeedAuthority` that
  // does not is correctly excluded, exactly like before this Arc.
  const directRatchetMasterSeedAuthorityCandidate =
    config.conversationDirectRatchetMasterSeedAuthority ?? productionCryptoGraph?.masterSeedAuthority;
  const directRatchetSealingAuthority =
    directRatchetMasterSeedAuthorityCandidate !== undefined && isFedosDirectRatchetSealingAuthority(directRatchetMasterSeedAuthorityCandidate)
      ? directRatchetMasterSeedAuthorityCandidate
      : null;
  const conversationDirectRatchetDeps: FedosConversationDirectRatchetIntegrationDependencies | undefined =
    config.conversationDirectRatchet ??
    (config.directRatchetEnabled && directRatchetSealingAuthority !== null
      ? {
          deviceRegistry: deviceRegistryPersistence!,
          sessionPersistence: config.directRatchetSessionLogPath !== undefined ? new AppendOnlyFedosDirectRatchetSessionPersistence(config.directRatchetSessionLogPath) : undefined,
          sealedSecretPersistence: config.directRatchetSealedSecretLogPath !== undefined ? new AppendOnlyFedosSealedDirectRatchetSecretPersistence(config.directRatchetSealedSecretLogPath) : undefined,
          resetRecordPersistence: config.directRatchetResetRecordLogPath !== undefined ? new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(config.directRatchetResetRecordLogPath) : undefined,
          importRecordPersistence: config.directRatchetImportRecordLogPath !== undefined ? new AppendOnlyFedosPrivateNostrImportRecordPersistence(config.directRatchetImportRecordLogPath) : undefined,
          sealingAuthority: directRatchetSealingAuthority,
          masterSeedAuthority: directRatchetSealingAuthority,
          localDeviceRef: config.localDeviceId!,
          sendMailboxNip17Control,
          // Secure Runtime Alpha 7001-7080 -- mirrors `directMessageDelivery.sendMailboxNip17`
          // immediately above (Alpha 1841-1920), forward-referencing the SAME
          // `privateTransportInstance`. Omitted (`undefined`) unless the caller
          // opts in via `directRatchetMessageDeliveryRemoteDeviceRef` -- zero
          // behavior change for every pre-existing caller.
          messageDelivery:
            config.directRatchetMessageDeliveryRemoteDeviceRef !== undefined
              ? {
                  remoteDeviceRef: config.directRatchetMessageDeliveryRemoteDeviceRef,
                  sendMailboxNip17: async (envelopeId, conversationId, plaintext) => {
                    if (privateTransportInstance === undefined) return { outcome: "route-unavailable" };
                    return privateTransportInstance.sendMailboxNip17(envelopeId as never, conversationId as never, plaintext);
                  },
                }
              : undefined,
        }
      : undefined);

  const conversationPeerCapabilityDeps: FedosConversationPeerCapabilityIntegrationDependencies | undefined =
    config.conversationPeerCapability ??
    (config.peerCapabilityEnabled
      ? {
          deviceRegistry: deviceRegistryPersistence!,
          signingAuthority: config.conversationTransportSigningAuthority!,
          localAccountRef: config.localAccountRef!,
          localDeviceRef: config.localDeviceId!,
          locallySupportedCapabilities: config.peerCapabilityLocallySupportedCapabilities!,
          observationPersistence: config.peerCapabilityObservationLogPath !== undefined ? new AppendOnlyFedosRatchetPeerCapabilityObservationPersistence(config.peerCapabilityObservationLogPath) : undefined,
          sendMailboxNip17Control,
        }
      : undefined);

  // Secure Runtime Alpha 7081-7160 (FedOS Conversation Invitation and
  // Shared Conversation Foundation Arc) -- mirrors `conversationPeerCapabilityDeps`'s
  // own auto-construction exactly, reusing the SAME `sendMailboxNip17Control`
  // closure and the SAME real production `FedosNostrSigningAuthority` --
  // never a second, divergent signing/transport path.
  const conversationInvitationDeps: FedosConversationInvitationIntegrationDependencies | undefined =
    config.conversationInvitation ??
    (config.conversationInvitationEnabled
      ? {
          signingAuthority: config.conversationTransportSigningAuthority!,
          localDeviceRef: config.localDeviceId!,
          idGenerator: new FedosSecureRandomConversationInvitationIdGenerator(),
          receivedPersistence: config.conversationInvitationReceivedLogPath !== undefined ? new AppendOnlyFedosConversationInvitationReceivedPersistence(config.conversationInvitationReceivedLogPath) : undefined,
          sendMailboxNip17Control,
        }
      : undefined);

  const conversationIdentityTransitionDeps: FedosConversationIdentityTransitionIntegrationDependencies | undefined =
    config.conversationIdentityTransition ??
    (config.identityTransitionEnabled
      ? {
          deviceRegistry: deviceRegistryPersistence!,
          signingAuthority: config.conversationTransportSigningAuthority!,
          localAccountRef: config.localAccountRef!,
          localDeviceRef: config.localDeviceId!,
          sendMailboxNip17Control,
          observationPersistence: config.identityTransitionObservationLogPath !== undefined ? new AppendOnlyFedosIdentityTransitionPeerObservationPersistence(config.identityTransitionObservationLogPath) : undefined,
          // Secure Runtime Alpha 6121-6200's own real bug fix -- durable local
          // decisions -- is only meaningful in production when this is
          // ACTUALLY append-only; omitted, decisions do not survive restart.
          localDecisionPersistence: config.identityTransitionLocalDecisionLogPath !== undefined ? new AppendOnlyFedosIdentityTransitionLocalDecisionPersistence(config.identityTransitionLocalDecisionLogPath) : undefined,
          localPolicy: config.identityTransitionLocalPolicy,
        }
      : undefined);

  const conversationDeletionRequestDeps: FedosConversationDeletionRequestIntegrationDependencies | undefined =
    config.conversationDeletionRequest ??
    (config.deletionRequestEnabled
      ? {
          deviceRegistry: deviceRegistryPersistence!,
          signingAuthority: config.conversationTransportSigningAuthority!,
          localAccountRef: config.localAccountRef!.publicIdentifier,
          localDeviceRef: config.localDeviceId ?? null,
          accountAuthority: "nostr",
          searchIndex: deletionRequestSearchIndex,
          resolveLocalPolicy: config.deletionRequestResolveLocalPolicy!,
          requestStatePersistence: config.deletionRequestStateLogPath !== undefined ? new AppendOnlyFedosDeletionRequestStatePersistence(config.deletionRequestStateLogPath) : undefined,
          recipientDecisionPersistence: config.deletionRequestDecisionLogPath !== undefined ? new AppendOnlyFedosDeletionRecipientDecisionPersistence(config.deletionRequestDecisionLogPath) : undefined,
          acknowledgementPersistence: config.deletionRequestAcknowledgementLogPath !== undefined ? new AppendOnlyFedosDeletionAcknowledgementPersistence(config.deletionRequestAcknowledgementLogPath) : undefined,
          localExecutionPersistence: config.deletionRequestExecutionLogPath !== undefined ? new AppendOnlyFedosDeletionExecutionPersistence(config.deletionRequestExecutionLogPath) : undefined,
          inboxSummaryPersistence: config.deletionRequestInboxSummaryLogPath !== undefined ? new AppendOnlyFedosDeletionRequestInboxSummaryPersistence(config.deletionRequestInboxSummaryLogPath) : undefined,
          pendingReviewPersistence: config.deletionRequestPendingReviewLogPath !== undefined ? new AppendOnlyFedosDeletionRequestPendingReviewPersistence(config.deletionRequestPendingReviewLogPath) : undefined,
          sendMailboxNip17Control,
        }
      : undefined);

  // Alpha 921/923 -- exactly one FedosConversationRuntime per running
  // runtime, a NEW peer to FedosBoardRuntime (not a wrapper, not a
  // subclass), over its own durable (or in-memory) backends. Constructed
  // over already-assembled ports/authorities; it reaches into Host for
  // nothing. Encryption readiness defaults to UNAVAILABLE, so every draft
  // it constructs stays "draft" -- never active, never a message (Alpha
  // 924/928).
  const conversationRuntimeInstance = createFedosConversationRuntime({
    ...assembleFedosConversationRuntimeDependencies({
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
    directMessageDelivery,
    // Secure Runtime Alpha 6041-6120 -- passed straight through, unmodified; see
    // `FedosDesktopRuntimeConfig.conversationDeletionRequest`'s own doc comment.
    // Secure Runtime Alpha 6521-6600 -- either the caller's own manual
    // override, or this Arc's own auto-constructed bundle (built above,
    // BEFORE this call, sharing the same Device Registry / signing
    // authority / Master Seed authority / search index this Runtime
    // already owns) -- `undefined` when the corresponding `*Enabled` flag
    // was never set, byte-for-byte the same as before this Arc.
    directRatchet: conversationDirectRatchetDeps,
    peerCapability: conversationPeerCapabilityDeps,
    conversationInvitation: conversationInvitationDeps,
    identityTransition: conversationIdentityTransitionDeps,
    deletionRequest: conversationDeletionRequestDeps,
  });

  // Secure Runtime Alpha 6521-6600 -- `conversationRuntimeInstance` now
  // exists; resolve the forward-referenced shared search index EXACTLY
  // once here, well before any real deletion request could ever be
  // processed (see `deletionRequestSearchIndex`'s own doc comment above).
  // Constructed unconditionally (cheap, no persistence, no crypto) so
  // `conversationContentAccessorInstance` below always receives the SAME
  // instance `deletionRequestSearchIndex` itself forwards to -- never two
  // divergent indexes, regardless of whether `deletionRequestEnabled` was
  // ever set.
  sharedSearchIndexInstance = conversationRuntimeInstance.createSearchIndex();

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
  // Alpha 3801-3880 -- deps for `FedosDeviceSyncOperationalFacade`, assembled
  // here (inside the SAME deviceTrustEnabled gate that already constructs
  // deviceTrustRuntimeInstance/deviceRegistryPersistence/syncStateInstance)
  // but the facade ITSELF is constructed further below, after `let stopped`
  // is declared -- `isRuntimeRunning: () => !stopped` closes over that
  // binding and must not be created before it exists in this function's
  // scope.
  let deviceSyncFacadeDeps: Omit<FedosDeviceSyncOperationalFacadeDeps, "isRuntimeRunning"> | undefined;
  // Secure Runtime Alpha 4581-4660 -- mirrors deviceSyncFacadeDeps's own
  // "assembled inside the deviceTrustEnabled gate, constructed further below
  // once `stopped` exists" pattern exactly.
  let devicePairingBoundary: ReturnType<typeof createFedosDeviceBindingBoundary> | undefined;
  if (config.deviceTrustEnabled) {
    // Secure Runtime Alpha 6521-6600 -- `deviceRegistryPersistence` itself
    // is now constructed ABOVE (hoisted, shared with the four new
    // Conversation Runtime integrations) -- this block only USES it,
    // never redeclares or reconstructs it (a second, divergent instance
    // over the same log path would be exactly the "second Device
    // Registry" this Arc's own structural guards forbid).
    const deviceTrustAuthority = new PersistedFedosDeviceTrustAuthority({
      persistence: deviceRegistryPersistence!,
      registrationAuthority: config.deviceRegistrationAuthority ?? new UnavailableFedosDeviceRegistrationAuthority(),
    });
    const syncAccountKey = `${config.localAccountRef!.authority}:${config.localAccountRef!.publicIdentifier}`;
    // Secure Runtime Alpha 4581-4660 (Phase F) -- the durable Sync Journal
    // backend, following the SAME "AppendOnly when a log path is supplied,
    // else InMemory" discipline every other backend in this function already
    // uses. Injected into `FedosSyncState` below -- `FedosSyncJournal` hydrates
    // from it at construction and write-throughs every successful append.
    const journalPersistence: FedosSyncJournalPersistence =
      config.deviceSyncJournalLogPath !== undefined
        ? new AppendOnlyFedosSyncJournalPersistence(config.deviceSyncJournalLogPath)
        : new InMemoryFedosSyncJournalPersistence();
    // Alpha 3801-3880 -- hoisted into a named instance (rather than the
    // inline `new FedosSyncState(...)` this field held before this Arc) so
    // the Scheduler/Import Coordinator below can share the EXACT SAME Sync
    // Journal instance FedosDeviceTrustRuntime itself owns -- never a
    // second, divergent Journal.
    const syncStateInstance = new FedosSyncState(syncAccountKey, { journalPersistence });
    // Secure Runtime Alpha 4581-4660 (Phase E) -- the ONE Pairing Boundary
    // this Arc wires in, over the EXACT SAME `deviceRegistryPersistence`
    // instance `deviceTrustAuthority` above already uses -- never a second
    // Device Registry (Phase A §8's own "stateless read-through
    // orchestrator, safe over an identical durable backend" finding). The
    // replay persistence follows the SAME AppendOnly/InMemory discipline.
    const deviceBindingReplayPersistence: FedosDeviceBindingChallengeReplayPersistence =
      config.deviceBindingChallengeReplayLogPath !== undefined
        ? new AppendOnlyFedosDeviceBindingChallengeReplayPersistence(config.deviceBindingChallengeReplayLogPath)
        : new InMemoryFedosDeviceBindingChallengeReplayPersistence();
    devicePairingBoundary = createFedosDeviceBindingBoundary({
      registryPersistence: deviceRegistryPersistence!,
      replayPersistence: deviceBindingReplayPersistence,
      limits: config.deviceBindingChallengeTtlSeconds !== undefined ? { challengeTtlSeconds: config.deviceBindingChallengeTtlSeconds } : undefined,
      now: config.clock,
    });
    deviceTrustRuntimeInstance = new FedosDeviceTrustRuntime({
      localDeviceId: config.localDeviceId!,
      localAccountRef: config.localAccountRef!,
      trustAuthority: deviceTrustAuthority,
      syncState: syncStateInstance,
    });

    // Secure Runtime Alpha 4581-4660 (Phase L) -- restart hydration for Sync
    // fabric ELIGIBILITY. `FedosSyncState`'s own Device Registry
    // (`FedosSyncDeviceRegistry`, Alpha 2421-2500, unmodified) is a SEPARATE,
    // always-in-memory structure from the durable Device Trust Registry this
    // block already constructed above -- a fresh `syncStateInstance` starts
    // with an EMPTY set on every `startFedosDesktopRuntime()` call, even when
    // `deviceRegistryLogPath` durably remembers a Device as `"trusted"`.
    // Without this, "restart preserves eligibility" (Phase L's own explicit
    // requirement) would be false: `syncReadiness().ready` would report
    // `false` for an already-trusted Device immediately after a real restart,
    // until SOME caller happened to re-call `registerSyncDevice()` by hand.
    // This re-derives sync-fabric membership from the durable trust facts
    // ALONE, using the SAME public `FedosDeviceTrustRuntime.registerSyncDevice()`
    // method every other caller already uses -- no new Sync Foundation
    // semantics, no second Device Registry, just restoring what a durable
    // Device Trust Registry already answers authoritatively.
    const syncEligibilityHydrationNow = (config.clock ?? defaultFedosBoardRuntimeClock)();
    for (const binding of deviceTrustAuthority.listBindingsForAccount(config.localAccountRef!)) {
      if (binding.trustState === "trusted") {
        deviceTrustRuntimeInstance.registerSyncDevice(binding.deviceId, syncEligibilityHydrationNow);
      }
    }

    // Secure Runtime Alpha 3801-3880 -- the Runtime Operational Facade
    // (`./fedos_device_sync_operational_facade.ts`). ALWAYS constructed once
    // deviceTrustEnabled is true (mirrors conversationContentAccessorInstance's
    // own "always constructed, composes what already exists" discipline);
    // the Scheduler piece alone stays gated behind
    // config.deviceSyncSchedulerEnabled (the guard above already confirmed
    // deviceSyncAbandonmentPolicy is present in that case).
    const schedulePersistence: FedosDeviceSyncSchedulePersistence | null = config.deviceSyncSchedulerEnabled
      ? config.deviceSyncScheduleLogPath !== undefined
        ? new AppendOnlyFedosDeviceSyncSchedulePersistence(config.deviceSyncScheduleLogPath)
        : new InMemoryFedosDeviceSyncSchedulePersistence()
      : null;
    const conflictPersistence: FedosDeviceSyncConflictPersistence | null = config.deviceSyncSchedulerEnabled
      ? config.deviceSyncConflictLogPath !== undefined
        ? new AppendOnlyFedosDeviceSyncConflictPersistence(config.deviceSyncConflictLogPath)
        : new InMemoryFedosDeviceSyncConflictPersistence()
      : null;
    let deviceSyncSchedulerInstance: FedosDeviceSyncScheduler | null = null;
    if (config.deviceSyncSchedulerEnabled) {
      deviceSyncSchedulerInstance = new FedosDeviceSyncScheduler({
        schedulePersistence: schedulePersistence!,
        registryPersistence: deviceRegistryPersistence!,
        accountRef: config.localAccountRef!,
        sourceDeviceId: config.localDeviceId!,
        syncState: syncStateInstance,
        // Alpha 3801-3880 -- this runtime constructs no real Relay Sync
        // attempt of its own (Phase A §20); omitted, every tick's own
        // attempt fails closed, never fabricating "delivered".
        attemptFn: config.deviceSyncAttemptFn ?? (async () => ({ outcome: "failed" })),
        abandonmentPolicy: config.deviceSyncAbandonmentPolicy!,
        limits: config.deviceSyncResourceLimits,
        intervalMs: config.deviceSyncIntervalMs ?? 30_000,
      });
    }

    const transferSessionPersistence: FedosDeviceTransferSessionPersistence =
      config.deviceSyncTransferSessionLogPath !== undefined
        ? new AppendOnlyFedosDeviceTransferSessionPersistence(config.deviceSyncTransferSessionLogPath)
        : new InMemoryFedosDeviceTransferSessionPersistence();
    const relaySyncObservationRepository: FedosDeviceRelaySyncObservationRepository =
      config.deviceSyncRelaySyncObservationLogPath !== undefined
        ? new AppendOnlyFedosDeviceRelaySyncObservationRepository(config.deviceSyncRelaySyncObservationLogPath)
        : new InMemoryFedosDeviceRelaySyncObservationRepository();

    deviceSyncFacadeDeps = {
      deviceTrust: deviceTrustRuntimeInstance,
      localAccountRef: config.localAccountRef!,
      localDeviceId: config.localDeviceId!,
      scheduler: deviceSyncSchedulerInstance,
      schedulePersistence,
      conflictPersistence,
      transferSessionPersistence,
      relaySyncObservationRepository,
    };
  }

  // Secure Runtime Alpha 1471-1540 -- exactly one FedosPrivateTransport
  // per running runtime, constructed ONLY when config.privateTransportEnabled
  // was true (the guard at the top of this function already confirmed
  // conversationTransportObservationLogPath/conversationTransportRelays/
  // conversationTransportSigningAuthority are all present in that case).
  // Reaches into conversationRuntimeInstance for membership reads ONLY
  // (`listMemberships`), the SAME narrow-accessor discipline
  // `FedosConversationTransportSignedEventSource` itself requires.
  //
  // Secure Runtime Alpha 1841-1920 Phase C/G (Alpha 1843/1844) --
  // `privateTransportInstance` itself is declared ABOVE (before
  // `conversationRuntimeInstance`, for the closure reason documented
  // there); this block only ASSIGNS it now. A real `NostrNip17V1WireAdapter`
  // is constructed and injected as `wireAdapter` ONLY when
  // `conversationDirectMessageDeliveryRoute` selected the standard route
  // -- never unconditionally, never as a silent default.
  let privateTransportStarted = false;
  if (config.privateTransportEnabled) {
    const conversationTransportOutboxPersistence: FedosConversationTransportOutboxPersistence =
      config.conversationTransportOutboxLogPath !== undefined
        ? new AppendOnlyFedosConversationTransportOutboxPersistence(config.conversationTransportOutboxLogPath)
        : new InMemoryFedosConversationTransportOutboxPersistence();
    const conversationTransportObservationRepository = new FedosDeliveryObservationRepository(
      new AppendOnlyFedosDeliveryObservationPersistence(config.conversationTransportObservationLogPath!),
    );
    // `nip44Wire` MUST be the SAME Master Seed `conversationTransportSigningAuthority`'s
    // own real identity is derived from -- the top-of-function guard
    // above already REQUIRES `conversationProductionCrypto` (hence a
    // resolved, "available" `productionCryptoGraph`) whenever this route
    // is selected; a caller reaching this line with the route selected
    // but no resolved graph is a genuine, unrecoverable misconfiguration
    // this Transport was never meant to paper over.
    const nip17WireAdapter =
      config.conversationDirectMessageDeliveryRoute === "nostr-nip17-v1" && productionCryptoGraph !== null
        ? new NostrNip17V1WireAdapter({
            localAccountIndex: config.conversationNip17LocalAccountIndex ?? config.conversationTransportAccountIndex ?? 0,
            signingAuthority: config.conversationTransportSigningAuthority!,
            nip44Wire: productionCryptoGraph.masterSeedAuthority,
          })
        : undefined;

    // Secure Runtime Alpha 1841-1920 Phase D (Alpha 1856/1860) -- when the
    // caller ALSO configured Inbound Subscription (`conversationTransportInbound`,
    // still never a silent default), a standard-route Rumor is routed
    // straight into `conversationRuntimeInstance`'s own admission/import
    // pipeline (`receiveNip17Rumor()`) -- the SAME coherent graph, never a
    // second, caller-owned import path the caller would otherwise have
    // to reimplement by hand.
    const inboundConfig =
      config.conversationTransportInbound !== undefined
        ? {
            ...config.conversationTransportInbound,
            onRumor:
              nip17WireAdapter !== undefined
                ? (rumor: Parameters<typeof conversationRuntimeInstance.receiveNip17Rumor>[0], relaySource: string) => {
                    void conversationRuntimeInstance.receiveNip17Rumor(rumor, relaySource);
                  }
                : config.conversationTransportInbound.onRumor,
          }
        : undefined;

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
      inbound: inboundConfig,
      wireAdapter: nip17WireAdapter,
    });
    await privateTransportInstance.start();
    privateTransportStarted = true;
  }

  let stopped = false;

  // Secure Runtime Alpha 3801-3880 -- exactly one FedosDeviceSyncOperationalFacade
  // per running runtime, constructed ONLY when deviceSyncFacadeDeps was
  // assembled above (i.e. config.deviceTrustEnabled was true). Composes
  // deviceTrustRuntimeInstance and whatever Scheduler/Conflict/Transfer/
  // Relay-observation pieces were built above -- constructs nothing new
  // itself. `isRuntimeRunning` closes over this SAME `stopped` flag, mirroring
  // conversationContentAccessorInstance's own identical pattern just below.
  const deviceSyncOperationalFacadeInstance: FedosDeviceSyncOperationalFacade | undefined =
    deviceSyncFacadeDeps !== undefined
      ? new FedosDeviceSyncOperationalFacade({ ...deviceSyncFacadeDeps, isRuntimeRunning: () => !stopped })
      : undefined;

  // Secure Runtime Alpha 4581-4660 -- exactly one FedosDevicePairingFacade per
  // running runtime, constructed ONLY when devicePairingBoundary/
  // deviceTrustRuntimeInstance were assembled above (i.e. config.deviceTrustEnabled
  // was true). Composes the SAME FedosDeviceBindingBoundary/FedosDeviceTrustRuntime
  // instances -- constructs nothing new itself. `isRuntimeRunning` closes over the
  // SAME `stopped` flag every other accessor on this handle already uses.
  const devicePairingFacadeInstance: FedosDevicePairingFacade | undefined =
    devicePairingBoundary !== undefined && deviceTrustRuntimeInstance !== undefined
      ? new FedosDevicePairingFacade({
          bindingBoundary: devicePairingBoundary,
          deviceTrust: deviceTrustRuntimeInstance,
          accountSigningAuthority: config.deviceBindingAccountSigningAuthority ?? null,
          accountIndex: config.deviceBindingAccountIndex ?? 0,
          isRuntimeRunning: () => !stopped,
          now: config.clock,
        })
      : undefined;

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

  // Secure Runtime Alpha 3081-3160 -- exactly one FedosDesktopConversationContentAccessor
  // per running runtime, ALWAYS constructed (unlike privateTransportInstance/
  // archiveRuntimeInstance above, this needs no dedicated config flag: it constructs
  // no persistence, no crypto authority, no timer of its own -- only composes
  // conversationRuntimeInstance/archiveRuntimeInstance, exactly like boardRuntimeInstance
  // itself is always constructed above). `archiveRuntimeInstance` is passed through as
  // `null` when `config.archiveEnabled` was false, matching every other optional
  // capability's own "remains optional" discipline (this Arc's own Absolute Prohibitions).
  const conversationContentAccessorInstance = new FedosDesktopConversationContentAccessor({
    conversationRuntime: conversationRuntimeInstance,
    archiveRuntime: archiveRuntimeInstance ?? null,
    isRuntimeRunning: () => !stopped,
    // Secure Runtime Alpha 6521-6600 -- the SAME instance
    // `deletionRequestSearchIndex` forwards to above -- never a second,
    // divergent search index.
    searchIndex: sharedSearchIndexInstance,
  });

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
    conversationContentAccessor(): FedosDesktopConversationContentAccessor {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.conversationContentAccessor() is inaccessible after stop().");
      }
      return conversationContentAccessorInstance;
    },
    /** Alpha 1263/1291 -- the closed, non-secret reason production crypto is (or is not) available. `"disabled"` when `conversationProductionCrypto` was never supplied. Readable even after `stop()`. */
    conversationProductionCryptoCapability(): FedosConversationProductionCryptoCapabilityOutcome {
      return productionCryptoCapability;
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
    deviceSyncOperational(): FedosDeviceSyncOperationalFacade {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.deviceSyncOperational() is inaccessible after stop().");
      }
      if (deviceSyncOperationalFacadeInstance === undefined) {
        throw new Error("FedosRunningDesktopRuntime.deviceSyncOperational() is not enabled -- see config.deviceTrustEnabled.");
      }
      return deviceSyncOperationalFacadeInstance;
    },
    devicePairing(): FedosDevicePairingFacade {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.devicePairing() is inaccessible after stop().");
      }
      if (devicePairingFacadeInstance === undefined) {
        throw new Error("FedosRunningDesktopRuntime.devicePairing() is not enabled -- see config.deviceTrustEnabled.");
      }
      return devicePairingFacadeInstance;
    },
    async stop(): Promise<void> {
      if (stopped) {
        throw new Error("FedosRunningDesktopRuntime.stop() may only be called once.");
      }
      stopped = true;
      // Newest-constructed, stopped first -- the reverse of construction order.
      // Alpha 3801-3880 -- waits for any in-flight tick (FedosDeviceSyncScheduler.stopSync()'s
      // own contract, unmodified) BEFORE the Host itself stops.
      if (deviceSyncFacadeDeps?.scheduler !== null && deviceSyncFacadeDeps?.scheduler !== undefined) {
        await deviceSyncFacadeDeps.scheduler.stopSync();
      }
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
