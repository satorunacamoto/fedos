/**
 * Secure Runtime Alpha 603 ("Local Runtime Configuration Model") —
 * Stage 3 of the Alpha 601–620 Desktop Local Runtime Entry Point &
 * Publish Pipeline Ownership Arc.
 *
 * The minimal configuration surface `startFedosDesktopRuntime()`
 * (`./fedos_desktop_runtime.js`, Alpha 606) accepts. See
 * `docs/secure_runtime_alpha_603_local_runtime_configuration_model.md`
 * for the full rationale.
 *
 * Secure Runtime Alpha 673 ("Runtime Configuration Extension") — Stage
 * 3 of Phase D of the Alpha 641–680 Public Identity, Conversation
 * Policy & Application Runtime Integration Arc. Adds exactly four new,
 * OPTIONAL fields — `publicAuthorAuthority`, `conversationPolicyAuthority`,
 * `idGenerator`, `clock` — all OBJECT dependencies passed straight
 * through to `createFedosBoardRuntime()` (`fedos_desktop_runtime.ts`,
 * Alpha 672), never interpreted or transformed here. Deliberately
 * OMITS a `publicIdentity` field of any kind: Alpha 673's own "no raw
 * identity values" prohibition means a caller wanting a real, resolved
 * public author does so by supplying a `publicAuthorAuthority`
 * implementation (e.g. a `StaticFedosPublicAuthorAuthority` wrapping an
 * already-resolved identity) — never by handing this config file a raw
 * identity snapshot to plumb through `createDesktopApplication()`
 * itself, which stays byte-for-byte unchanged, still called with no
 * argument (Alpha 606, unmodified — see Alpha 674's own rationale).
 *
 * HARD GUARDRAILS:
 *   - `FedosDesktopRuntimeConfig` is the ONLY export.
 *   - NO secret/seed/token/credential field of any kind.
 *   - NO field accepts an entire `process.env`-shaped object.
 *   - Every filesystem path is a caller-supplied, explicit string —
 *     no default path, no `cwd`-relative implicit path (Alpha 604).
 *   - `publisher` is an OBJECT dependency (Alpha 610), never a
 *     primitive credential/URL this file would need to interpret.
 *   - `publicAuthorAuthority`/`conversationPolicyAuthority`/
 *     `idGenerator`/`clock` (Alpha 673) are OBJECT/function
 *     dependencies only — no raw identity value, no policy JSON bag,
 *     no UI setting, no arbitrary untyped callback.
 *
 * Secure Runtime Alpha 758 ("Local Runtime Ownership") — Stage 18 of
 * the Alpha 741–760 Canonical Conversation Identity and Record
 * Foundation Arc. Adds exactly ONE new, OPTIONAL field —
 * `conversationLogPath` — following the SAME "explicit, caller-supplied
 * path, no default, no `cwd`-relative implicit path" discipline as
 * `boardLogPath`/`outboxLogPath`/`observationLogPath` (Alpha 604/609).
 * Omitted, `FedosBoardRuntime`'s own existing default
 * (`InMemoryFedosConversationPersistence`) applies — no default
 * repository-relative path is ever assumed, per this Arc's own explicit
 * instruction.
 */

import type { FedosBoardOutboxPublisher } from "../../board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPublicAuthorAuthority } from "../../board/runtime/identity/fedos_public_author_authority.js";
import type { FedosConversationPolicyAuthority } from "../../board/runtime/policy/fedos_conversation_policy_authority.js";
import type { FedosBoardRuntimeIdGenerator } from "../../board/runtime/fedos_board_runtime_id_generator.js";
import type { FedosBoardRuntimeClock } from "../../board/runtime/fedos_board_runtime_clock.js";
import type { FedosNostrAuthorBindingAuthority } from "../../board/runtime/identity/fedos_nostr_author_binding_types.js";
import type { FedosConversationCreatorIdentityAuthority } from "../../conversation/construction/fedos_conversation_creator_identity_authority.js";
import type { FedosConversationEncryptionReadinessAuthority } from "../../conversation/readiness/fedos_conversation_encryption_readiness_authority.js";
import type { FedosRelay } from "../fedos_relay.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosConversationTransportPublisher } from "../../conversation/transport/fedos_conversation_transport_publisher.js";
import type { FedosPrivateTransportInboundConfig } from "../../conversation/transport/fedos_private_transport.js";
import type { FedosMasterSeedAuthority } from "../../runtime/master_seed/fedos_master_seed_authority.js";
import type { FedosConversationArchiveRuntimeBounds } from "../../conversation/archive/runtime/fedos_conversation_archive_runtime.js";
import type { FedosConversationEncryptionAuthority } from "../../conversation/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority } from "../../conversation/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationIdentityResolver } from "../../conversation/encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationLocalAccountIndexAuthority } from "../../conversation/encryption/identity/fedos_conversation_local_account_index_authority.js";
import type { FedosConversationProductionCryptoConfig } from "../../conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.js";
import type { FedosGroupParticipantLimitPolicy } from "../../conversation/group/fedos_group_participant_limit.js";
import type { FedosPrivateNostrDeliveryMode } from "../../conversation/delivery/nostr/fedos_private_nostr_delivery_mode.js";
import type { FedosPrivateNostrDeliveryPublisher } from "../../conversation/delivery/nostr/fedos_private_nostr_delivery_publisher.js";
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosDeviceRegistrationAuthority } from "../../device/fedos_device_registration_authority.js";
import type { FedosDeviceSyncAbandonmentPolicy } from "../../device/sync_scheduler/fedos_device_sync_retry_policy.js";
import type { FedosDeviceSyncResourceLimits } from "../../device/sync_scheduler/fedos_device_sync_resource_limits.js";
import type { FedosDeviceSyncAttemptFn } from "../../device/sync_scheduler/fedos_device_sync_attempt.js";
// Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
// Aggregation and User Consent UI Arc) -- every import/addition below this
// comment is ADDITIVE ONLY, mirroring this file's own established pattern.
import type {
  FedosConversationDeletionRequestIntegrationDependencies,
  FedosConversationDirectRatchetIntegrationDependencies,
  FedosConversationPeerCapabilityIntegrationDependencies,
  FedosConversationIdentityTransitionIntegrationDependencies,
} from "../../conversation/runtime/fedos_conversation_runtime.js";
import type { FedosRatchetPeerCapabilityEntry } from "../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";
import type { FedosIdentityTransitionLocalPolicy } from "../../conversation/identity_transition/fedos_identity_transition_evidence_evaluation.js";
import type { FedosDeletionRecipientPolicy } from "../../conversation/deletion_request/fedos_deletion_recipient_policy.js";

/**
 * Secure Runtime Alpha 923 ("Running Runtime Integration") — Phase D of
 * the Alpha 891–930 Private Conversation Draft Construction and Readiness
 * Runtime Arc. Adds only OPTIONAL fields for the private-Conversation
 * draft runtime the Local Runtime now also owns
 * (`runtime.conversationRuntime()`). Every field follows the SAME
 * "explicit, caller-supplied path, no default, no `cwd`-relative implicit
 * path" discipline as `boardLogPath` (Alpha 604). Omitted, in-memory
 * backends and the safe defaults (anonymous-local creator identity,
 * UNAVAILABLE encryption readiness — no fallback crypto, Alpha 924) apply.
 * Public Board behavior is entirely unaffected by any of these.
 */
export interface FedosDesktopRuntimeConfig {
  /** Explicit, caller-supplied path to the Board append-only log file. */
  readonly boardLogPath: string;
  /** Explicit, caller-supplied path to the Outbox append-only log file. */
  readonly outboxLogPath: string;
  /**
   * Explicit, caller-supplied path to the Delivery Observation
   * append-only log file. REQUIRED when `deliveryEnabled` is `true`
   * (Alpha 609/614) — omitted entirely when delivery is disabled,
   * since nothing would ever read or write it.
   */
  readonly observationLogPath?: string;
  /** When `false` (the safe default a caller must override), the runtime reaches `"ready"` without ever calling `startDelivery()`. */
  readonly deliveryEnabled: boolean;
  /** Optional — omitted, `FedosDesktopHost`'s own existing default interval applies (Alpha 507, unchanged). */
  readonly deliveryIntervalMs?: number;
  /**
   * REQUIRED when `deliveryEnabled` is `true` (Alpha 610/614) — this
   * runtime constructs no Publisher of its own (no Signing Authority,
   * no Relay, no crypto touched here, per this Arc's own Absolute
   * Prohibitions). The caller supplies a real, fully-constructed
   * `FedosBoardOutboxPublisher`; omitted when `deliveryEnabled` is
   * `false`.
   */
  readonly publisher?: FedosBoardOutboxPublisher;
  /**
   * Alpha 673 — optional; passed straight through to
   * `createFedosBoardRuntime()`. Omitted, `FedosBoardRuntime`'s own
   * existing default (`FedosDesktopPublicAuthorAuthority` wrapping this
   * runtime's own `host`) applies — anonymous-local authorship remains
   * the safe V1 default (Alpha 645/674) unless the caller injects a
   * different Authority here.
   */
  readonly publicAuthorAuthority?: FedosPublicAuthorAuthority;
  /** Alpha 673 — optional; passed straight through to `createFedosBoardRuntime()`. Omitted, `StaticFedosConversationPolicyAuthority` applies (Alpha 654/656). */
  readonly conversationPolicyAuthority?: FedosConversationPolicyAuthority;
  /** Alpha 673 — optional; passed straight through to `createFedosBoardRuntime()`. Omitted, `FedosSecureRandomBoardRuntimeIdGenerator` applies (Alpha 626, unchanged). */
  readonly idGenerator?: FedosBoardRuntimeIdGenerator;
  /** Alpha 673 — optional; passed straight through to `createFedosBoardRuntime()`. Omitted, `defaultFedosBoardRuntimeClock` applies (Alpha 625, unchanged). */
  readonly clock?: FedosBoardRuntimeClock;
  /**
   * Secure Runtime Alpha 697 — optional; passed straight through to
   * `createFedosBoardRuntime()`. Omitted, this Runtime's own
   * `FedosBoardRuntime` consults no Binding Authority at all, so every
   * `"nostr"` outbound target stays `"ineligible"` (the SAME fail-closed
   * V1 default this codebase already had before the Alpha 681-720 Arc).
   * Supply `new FedosSigningAuthorityNostrAuthorBinding(signingAuthority)`
   * (`../../board/runtime/identity/fedos_nostr_author_binding_authority.js`)
   * to unlock real Nostr eligibility.
   */
  readonly nostrAuthorBindingAuthority?: FedosNostrAuthorBindingAuthority;
  /** Secure Runtime Alpha 697 — optional; passed straight through to `createFedosBoardRuntime()`. Omitted, account index `0` applies (Alpha 689). */
  readonly nostrAccountIndex?: number;
  /**
   * Secure Runtime Alpha 758 — optional, explicit, caller-supplied path
   * to the Conversation append-only log file. Omitted,
   * `FedosBoardRuntime`'s own existing default
   * (`InMemoryFedosConversationPersistence`) applies — see this file's
   * own header.
   */
  readonly conversationLogPath?: string;
  /** Alpha 923 — optional append-only log for private-Conversation DRAFT records; omitted, in-memory. */
  readonly conversationDraftLogPath?: string;
  /** Alpha 923 — optional append-only log for Conversation Membership; omitted, in-memory. */
  readonly conversationMembershipLogPath?: string;
  /** Alpha 923 — optional append-only log for Conversation Capabilities; omitted, in-memory. */
  readonly conversationCapabilityLogPath?: string;
  /** Alpha 923 — optional append-only log for the construction-coordination facts; omitted, in-memory. */
  readonly conversationConstructionCoordinationLogPath?: string;
  /** Alpha 996 — optional append-only log for invitation-revocation facts; omitted, in-memory. */
  readonly conversationInvitationRevocationLogPath?: string;
  /** Alpha 1003 — optional append-only log for draft-management-state facts; omitted, in-memory. */
  readonly conversationDraftManagementLogPath?: string;
  /** Alpha 904/923 — optional; omitted, an anonymous-local creator identity applies. */
  readonly conversationCreatorIdentityAuthority?: FedosConversationCreatorIdentityAuthority;
  /**
   * Alpha 924/923 — optional; omitted, encryption readiness is UNAVAILABLE
   * (no fallback crypto). A future encryption Arc injects a real
   * implementation here to unlock `activation-ready`; this Arc never does.
   */
  readonly conversationEncryptionReadinessAuthority?: FedosConversationEncryptionReadinessAuthority;
  /** Alpha 904/923 — optional; omitted, `false` (an anonymous-local creator may create a local draft). */
  readonly conversationRequireResolvedCreatorIdentity?: boolean;

  /**
   * Secure Runtime Alpha 1471–1540 ("Private Transport Boundary and
   * Multi-Relay Delivery Arc"). OPTIONAL, unlike `deliveryEnabled` —
   * kept optional specifically so every pre-existing call site that
   * constructs a `FedosDesktopRuntimeConfig` continues to compile
   * unchanged (the SAME "no widened required-field surface" discipline
   * `outboxPersistence?`/`publisher?` (Alpha 419/502) already established
   * for this exact reason). Omitted or `false`, the runtime reaches
   * `"ready"` without ever constructing a `FedosPrivateTransport`
   * (`../../conversation/transport/fedos_private_transport.ts`) or
   * calling `.start()` on one.
   */
  readonly privateTransportEnabled?: boolean;
  /**
   * Explicit, caller-supplied path to the Conversation Message Envelope
   * append-only log file (Private Delivery, Alpha 857 — reused,
   * unchanged). Omitted, in-memory. Shared by BOTH the Alpha 1113
   * Encryption Runtime Wiring facade and the Alpha 1471–1540 Private
   * Transport boundary — one Envelope backend, never two — reconciled
   * during the Alpha 1611–1690 integration merge (both Arcs had
   * independently declared this same field), and again during the Alpha
   * 5561–5640 cross-lineage integration merge (same reconciliation, same
   * field, this time across the NIP-17 and Ratchet lineages).
   */
  readonly conversationEnvelopeLogPath?: string;
  /**
   * Explicit, caller-supplied path to the Conversation Payload Storage
   * append-only log file (Private Delivery, Alpha 804 — reused,
   * unchanged). Omitted, in-memory. Shared by BOTH the Alpha 1113
   * Encryption Runtime Wiring facade and the Alpha 1471–1540 Private
   * Transport boundary — reconciled during the Alpha 1611–1690
   * integration merge (both Arcs had independently declared this same
   * field).
   */
  readonly conversationPayloadLogPath?: string;
  /**
   * `AppendOnlyFedosConversationPayloadStorage`'s own REQUIRED
   * `maxPayloadByteLength` constructor parameter (Alpha 809 — that Arc's
   * own instruction: "a caller must make an explicit, informed choice,"
   * no default invented there). Only consulted when
   * `conversationPayloadLogPath` is supplied (the in-memory backend has
   * no such limit). Omitted, this runtime's own explicit default of 1
   * MiB applies (`DEFAULT_CONVERSATION_PAYLOAD_MAX_BYTE_LENGTH`,
   * `./fedos_desktop_runtime.ts`) — this runtime's own choice, not a
   * Payload Storage default.
   */
  readonly conversationPayloadMaxByteLength?: number;
  /** Explicit, caller-supplied path to the Mailbox Delivery Outbox append-only log file. Omitted, in-memory. */
  readonly conversationTransportOutboxLogPath?: string;
  /** REQUIRED when `privateTransportEnabled` is `true` — a durable Observation backend is required to activate transport honestly (mirrors `observationLogPath`, Alpha 609). */
  readonly conversationTransportObservationLogPath?: string;
  /**
   * REQUIRED when `privateTransportEnabled` is `true` — this runtime
   * constructs no Relay of its own (no WebSocket, no reconnect policy).
   * The caller supplies one or more already-constructed `FedosRelay`
   * instances (Multiple Relay fan-out).
   */
  readonly conversationTransportRelays?: readonly FedosRelay[];
  /** REQUIRED when `privateTransportEnabled` is `true` — this runtime constructs no Signing Authority of its own. */
  readonly conversationTransportSigningAuthority?: FedosNostrSigningAuthority;
  /** Optional; omitted, account index `0` applies (mirrors `nostrAccountIndex`, Alpha 689). */
  readonly conversationTransportAccountIndex?: number;
  /** Optional; omitted, `FedosPrivateTransport`'s own default Mailbox Delivery cadence applies. */
  readonly conversationTransportIntervalMs?: number;
  /** Optional override of the default Multi-Relay Publisher; omitted, `FedosMultiRelayOkCorrelatedConversationTransportPublisher` over `conversationTransportRelays` is constructed. */
  readonly conversationTransportPublisher?: FedosConversationTransportPublisher;
  /** Optional — Inbound Subscription is activated ONLY when this is supplied. No silent default subscription of any kind. */
  readonly conversationTransportInbound?: FedosPrivateTransportInboundConfig;

  /**
   * Secure Runtime Alpha 1691–1760 ("Conversation Archive Runtime
   * Integration and Recovery Operations Arc"). OPTIONAL, unlike
   * `deliveryEnabled` — the SAME "no widened required-field surface"
   * discipline `privateTransportEnabled` itself already established
   * (Alpha 1471–1540). Omitted or `false`, the runtime reaches `"ready"`
   * without ever constructing a `FedosConversationArchiveRuntime`, and
   * `runtime.conversationArchiveRuntime()` throws `"not enabled"`.
   */
  readonly archiveEnabled?: boolean;
  /**
   * REQUIRED when `archiveEnabled` is `true` — this runtime constructs
   * no Master Seed Authority of its own (mirrors
   * `conversationTransportSigningAuthority`'s own identical "this
   * runtime constructs no Signing Authority of its own" discipline). The
   * caller supplies a real, already-constructed `FedosMasterSeedAuthority`
   * — the SAME instance backing this account's own conversation
   * encryption, never a second, duplicate one.
   */
  readonly conversationArchiveMasterSeedAuthority?: FedosMasterSeedAuthority;
  /** Optional override of the Archive Runtime's own default byte/record bounds (`DEFAULT_FEDOS_CONVERSATION_ARCHIVE_RUNTIME_BOUNDS`). No secret, no path policy beyond what the caller-supplied destination/source path itself already is. */
  readonly conversationArchiveBounds?: FedosConversationArchiveRuntimeBounds;
  /**
   * Secure Runtime Alpha 1841–1920 ("NIP-17 Standard Transport
   * Integration and Group Pairwise Delivery Arc") Phase C/G (Alpha
   * 1844/1878) — the ONE explicit, closed route-selection knob for
   * Direct (and, transitively, Group pairwise) send delivery. Omitted
   * (the default) — `sendDirectMessage()` behaves byte-for-byte as
   * before this Arc: local storage only, no standard delivery attempted,
   * no Relay event of this kind ever emitted. `"nostr-nip17-v1"` —
   * REQUIRES `privateTransportEnabled: true` (this route rides the SAME
   * Private Transport queue/Scheduler/Multi-Relay/Observation, never a
   * second Outbox domain); a real `NostrNip17V1WireAdapter` is
   * constructed and injected into `FedosPrivateTransport`'s own
   * `wireAdapter`, and `sendDirectMessage()` additionally prepares +
   * durably enqueues a standard Gift Wrap for every successfully
   * locally-stored Direct message. NEVER a heuristic, NEVER a silent
   * fallback to `fedos-private-v1` if unavailable (Alpha 1844).
   */
  readonly conversationDirectMessageDeliveryRoute?: "nostr-nip17-v1";
  /** Alpha 1844 — optional; forwarded to `NostrNip17V1WireAdapter`'s own `localAccountIndex` (defaults `0`). Only meaningful with `conversationDirectMessageDeliveryRoute: "nostr-nip17-v1"`. */
  readonly conversationNip17LocalAccountIndex?: number;
  /**
   * Secure Runtime Alpha 1113 ("Runtime Encryption Configuration") —
   * Phase A of the Alpha 1111–1180 Private Conversation Activation and
   * Direct Messaging Runtime Arc. Threads the Alpha 949 encryption
   * dependencies — already accepted on `FedosConversationRuntimeDependencies`
   * but never previously reachable from this config — through to
   * `assembleFedosConversationRuntimeDependencies()`. Omitted, the SAME
   * fail-closed `Unavailable*` defaults apply as before (Alpha 942, Alpha
   * 1115's own "no fallback crypto" rule): direct activation and direct
   * messaging stay unavailable; public Board and local draft management
   * remain entirely unaffected.
   */
  readonly conversationEncryptionAuthority?: FedosConversationEncryptionAuthority;
  /** Alpha 1113 — optional; omitted, fail-closed (Alpha 942/1115). */
  readonly conversationDecryptionAuthority?: FedosConversationDecryptionAuthority;
  /** Alpha 1113 — optional; omitted, delegates to `conversationCreatorIdentityAuthority` (Alpha 931's own default). */
  readonly conversationIdentityResolver?: FedosConversationIdentityResolver;
  /** Alpha 1113 — optional; omitted, fixed `0` (Alpha 933's own default). */
  readonly conversationAccountIndexAuthority?: FedosConversationLocalAccountIndexAuthority;
  /**
   * Alpha 1113 — optional, only meaningful with `conversationPayloadLogPath`
   * (declared once above, under the Alpha 1471–1540 Private Transport
   * boundary's own fields — reconciled during the Alpha 1611–1690
   * integration merge); omitted, `1_000_000` bytes (Alpha 949's own
   * default).
   */
  readonly conversationMaxPayloadByteLength?: number;
  /** Alpha 1113 — optional append-only log for the encryption-coordination facts; omitted, in-memory. */
  readonly conversationEncryptionCoordinationLogPath?: string;
  /** Alpha 1121 — optional append-only log for the Direct Activation coordination facts; omitted, in-memory. */
  readonly conversationActivationCoordinationLogPath?: string;
  /** Alpha 1143 — optional append-only log for the Payload Retention decision log; omitted, in-memory. */
  readonly conversationPayloadRetentionLogPath?: string;
  /**
   * Secure Runtime Alpha 1274 ("Runtime Config Wiring") — Phase C of the
   * Alpha 1261–1320 Production Conversation Crypto Runtime Activation
   * Arc. Optional; omitted, production crypto stays entirely unconfigured
   * (Alpha 1275's own "Default Unavailable Adapter" — identical to every
   * prior Arc's own default). When present, resolved via
   * `assembleFedosConversationProductionCryptoGraph()`
   * (`../../conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.ts`)
   * BEFORE Conversation Runtime assembly; a successful (`"available"`)
   * resolution supplies its own real, WASM-backed Authorities in place of
   * `conversationEncryptionAuthority`/`conversationDecryptionAuthority`/
   * `conversationCreatorIdentityAuthority`/`conversationAccountIndexAuthority`/
   * `nostrAuthorBindingAuthority` above; any OTHER outcome falls back to
   * those individual fields' own existing defaults, unchanged — Runtime
   * startup itself never fails because production crypto could not be
   * assembled (Alpha 1264). No raw secret field of any kind — this object
   * carries only a durable-file-persistence port and an injected
   * passphrase-provider BOUNDARY (Alpha 1266/1267), never a passphrase
   * value itself.
   */
  readonly conversationProductionCrypto?: FedosConversationProductionCryptoConfig;
  /**
   * Secure Runtime Alpha 1321–1390 ("Private Group Pairwise Fanout
   * Foundation Arc") — the additive `groupRuntime()` facade's own
   * backends. Every field OPTIONAL; omitted, in-memory (the same
   * "explicit path or safe in-memory default" discipline as every field
   * above). Never widens the Direct Activation Coordinator's own
   * Private-Group Gate.
   */
  readonly conversationGroupGenerationLogPath?: string;
  /** Alpha 1321–1390 — optional append-only log for Group Direct Path facts; omitted, in-memory. */
  readonly conversationGroupDirectPathLogPath?: string;
  /** Alpha 1321–1390 — optional append-only log for local canonical Group Message facts; omitted, in-memory. */
  readonly conversationGroupMessageLogPath?: string;
  /** Alpha 1321–1390 — optional append-only log for Fanout Delivery facts; omitted, in-memory. */
  readonly conversationGroupFanoutDeliveryLogPath?: string;
  /** Alpha 1321–1390 — optional; omitted, a conservative fixed OPERATIONAL limit applies (never a cryptographic one). */
  readonly conversationGroupParticipantLimitPolicy?: FedosGroupParticipantLimitPolicy;
  /**
   * Secure Runtime Alpha 1391–1470 ("Nostr Private Direct and Pairwise
   * Fanout Delivery Arc") — the additive `conversationRuntime().privateNostrDelivery()`
   * facade's own backends. Every field OPTIONAL; omitted, private
   * delivery stays entirely unavailable (Alpha 1440) — local Direct/Group
   * messaging itself is unaffected. This runtime constructs no Signing
   * Authority or Relay/Publisher of its own (mirrors `publisher`'s own
   * established "caller supplies a real, fully-constructed" precedent,
   * Alpha 610).
   */
  readonly conversationPrivateNostrDeliveryRequestLogPath?: string;
  /** Alpha 1391–1470 — optional append-only log for Local Import Record facts; omitted, in-memory. */
  readonly conversationPrivateNostrImportRecordLogPath?: string;
  /** Alpha 1391–1470 — optional append-only log for Private Nostr Delivery Observation facts; omitted, in-memory. A SEPARATE log from the Board's own `observationLogPath`. */
  readonly conversationPrivateNostrDeliveryObservationLogPath?: string;
  /** Alpha 1391–1470 — optional; omitted, private delivery stays entirely unavailable (Alpha 1440). */
  readonly conversationPrivateNostrSigningAuthority?: FedosNostrSigningAuthority;
  /** Alpha 1391–1470 — optional; omitted, outbound private delivery stays unavailable. */
  readonly conversationPrivateNostrDeliveryPublisher?: FedosPrivateNostrDeliveryPublisher;
  /** Alpha 1391–1470 — optional; omitted, `"mailbox"` (Alpha 1434's own explicit default). */
  readonly conversationPrivateNostrDefaultMode?: FedosPrivateNostrDeliveryMode;
  /** Alpha 1391–1470 — optional; omitted, `[]`. */
  readonly conversationPrivateNostrDefaultRelayUrls?: readonly string[];

  /**
   * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device
   * Runtime Integration Arc"). OPTIONAL, mirroring
   * `privateTransportEnabled`'s own "no widened required-field surface"
   * discipline exactly — every pre-existing call site continues to
   * compile unchanged. Omitted or `false`, the runtime reaches
   * `"ready"` without ever constructing a `FedosDeviceTrustRuntime`
   * (`./fedos_device_trust_runtime.js`), and `runtime.deviceTrust()`
   * throws `"not enabled"`.
   */
  readonly deviceTrustEnabled?: boolean;
  /** REQUIRED when `deviceTrustEnabled` is `true` — a stable, non-secret identifier for THIS running runtime's own local device. Never a credential; this runtime generates no device id of its own. */
  readonly localDeviceId?: string;
  /** REQUIRED when `deviceTrustEnabled` is `true` — the existing account identity this local device is additive beneath (Review `4672244`'s own Option B). */
  readonly localAccountRef?: FedosDeviceBindingAccountRef;
  /** Explicit, caller-supplied path to the Device Registry append-only log file. Omitted, in-memory (mirrors every other `*LogPath` field in this config). */
  readonly deviceRegistryLogPath?: string;
  /** Optional; omitted, `UnavailableFedosDeviceRegistrationAuthority` applies — this codebase has no accepted cryptographic boundary yet for independent, account-verifiable Device keys (Phase E blocker), so every registration through the default is honestly capped at `"unavailable"`, never `"trusted"`. */
  readonly deviceRegistrationAuthority?: FedosDeviceRegistrationAuthority;

  /**
   * Secure Runtime Alpha 3801–3880 ("Device Sync Operational Status and
   * Desktop Shell Integration Arc"). OPTIONAL and meaningful ONLY when
   * `deviceTrustEnabled` is also `true` (the Scheduler reuses the SAME
   * Device Registry/Sync Journal instances `FedosDeviceTrustRuntime` already
   * owns — see `./fedos_device_sync_operational_facade.ts`'s own header).
   * Omitted or `false`, `runtime.deviceSyncOperational().syncStatus()`
   * reports `"disabled"`, and no `FedosDeviceSyncScheduler` is ever
   * constructed. This Arc does not assemble a real, network-attached Relay
   * Sync graph (Phase A §20) — `deviceSyncAttemptFn` below is the ONLY
   * bridge to real Relay delivery, and it is entirely caller-supplied.
   */
  readonly deviceSyncSchedulerEnabled?: boolean;
  /** REQUIRED when `deviceSyncSchedulerEnabled` is `true` — this runtime constructs no retry/abandonment policy of its own (`FedosDeviceSyncScheduler`'s own constructor requires one explicitly). */
  readonly deviceSyncAbandonmentPolicy?: FedosDeviceSyncAbandonmentPolicy;
  /** Optional; omitted, `FEDOS_DEVICE_SYNC_DEFAULT_RESOURCE_LIMITS` applies. */
  readonly deviceSyncResourceLimits?: FedosDeviceSyncResourceLimits;
  /** Optional; omitted, `30_000` ms (mirrors `conversationTransportIntervalMs`'s own default cadence order of magnitude). */
  readonly deviceSyncIntervalMs?: number;
  /**
   * OPTIONAL — this runtime constructs no Relay Sync attempt of its own
   * (mirrors `conversationTransportPublisher`'s/`conversationTransportSigningAuthority`'s
   * own "this runtime constructs no Signing Authority or Relay of its own"
   * discipline). Omitted, every Scheduler tick's own attempt fails closed
   * with `"failed"` — the Scheduler itself still starts/stops/reports
   * honest status.
   */
  readonly deviceSyncAttemptFn?: FedosDeviceSyncAttemptFn;
  /** Explicit, caller-supplied path to the Schedule append-only log file. Omitted, in-memory. */
  readonly deviceSyncScheduleLogPath?: string;
  /** Explicit, caller-supplied path to the Conflict append-only log file. Omitted, in-memory. */
  readonly deviceSyncConflictLogPath?: string;
  /** Explicit, caller-supplied path to the Transfer Session append-only log file. Omitted, in-memory. Independent of `deviceSyncSchedulerEnabled` -- Transfer session STATUS is readable even when the Scheduler itself is disabled. */
  readonly deviceSyncTransferSessionLogPath?: string;
  /** Explicit, caller-supplied path to the Relay Sync Observation append-only log file. Omitted, in-memory. Used ONLY to distinguish `relayAccepted` from `deviceImported` on a Transfer Session view -- never to reconstruct a raw Relay event. */
  readonly deviceSyncRelaySyncObservationLogPath?: string;

  /**
   * Secure Runtime Alpha 4581–4660 ("Desktop Device Registration, Pairing,
   * and Durable Sync Journal Arc"). Meaningful ONLY when `deviceTrustEnabled`
   * is also `true` -- the Pairing Boundary (`runtime.deviceBinding()`)
   * reuses the SAME `deviceRegistryLogPath`/in-memory Device Registry
   * backend `FedosDeviceTrustRuntime` already owns (Phase A §8's own
   * "stateless read-through orchestrator, safe to construct a second thin
   * instance over the identical durable backend" finding) -- never a
   * second Device Registry. Omitted or `deviceTrustEnabled: false`,
   * `runtime.deviceBinding()` throws `"not enabled"`, the SAME two-state
   * fail-closed contract `deviceTrust()` itself already uses.
   */
  readonly deviceBindingChallengeReplayLogPath?: string;
  /** Optional; omitted, `FEDOS_DEVICE_BINDING_DEFAULT_LIMITS` (300s challenge TTL) applies -- see `../../device/binding_challenge/fedos_device_binding_boundary_factory.ts`. */
  readonly deviceBindingChallengeTtlSeconds?: number;
  /**
   * OPTIONAL — this runtime constructs no Signing Authority of its own
   * (mirrors `conversationTransportSigningAuthority`'s/
   * `conversationPrivateNostrSigningAuthority`'s own identical "the caller
   * supplies a real, already-constructed one" discipline). Required only to
   * ACT as the Authorizing Device in a real pairing exchange
   * (`runtime.devicePairing().approvePairingRequest()`/`revokeDevice()`).
   * Omitted, those two methods report `"disabled"`; every other
   * `FedosDevicePairingFacade` method (`createPairingRequest`,
   * `inspectPairingRequest`, `completePairing`, `registrationStatus`,
   * `listPendingPairings`) needs no account signing capability at all and
   * remains fully available regardless.
   */
  readonly deviceBindingAccountSigningAuthority?: FedosNostrSigningAuthority;
  /** Optional; omitted, account index `0` applies (mirrors `nostrAccountIndex`/`conversationTransportAccountIndex`). */
  readonly deviceBindingAccountIndex?: number;
  /**
   * Explicit, caller-supplied path to the durable Sync Journal append-only
   * log file (Phase F). Meaningful ONLY when `deviceTrustEnabled` is also
   * `true` -- the SAME `FedosSyncState`/`FedosSyncJournal` instance the
   * Scheduler/Import Coordinator already share. Omitted, the Sync Journal
   * remains exactly what it always was on this base: a pure in-memory
   * ledger, lost on every restart (see `./fedos_device_trust_runtime.ts`'s
   * own long-documented restart limitation, now closable by supplying this
   * field).
   */
  readonly deviceSyncJournalLogPath?: string;
  /**
   * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-
   * Device Aggregation and User Consent UI Arc) — OPTIONAL, additive.
   * Passed straight through, unmodified, to `createFedosConversationRuntime()`'s
   * own already-real, already-optional `deletionRequest` dependency
   * bundle (`5881-5960`) — this file interprets NOTHING in it, exactly
   * like `conversationDirectMessageDeliveryRoute`'s own sibling
   * `directMessageDelivery` object above. Omitted,
   * `FedosConversationRuntime.deletionRequest()` returns `null` and
   * every `FedosDesktopApplicationShell.deletionRequest*()` method
   * reports `"unavailable"` — the SAME honest, pre-existing fail-closed
   * contract this Arc's own Shell methods already implement.
   */
  readonly conversationDeletionRequest?: FedosConversationDeletionRequestIntegrationDependencies;

  // -----------------------------------------------------------------------
  // Secure Runtime Alpha 6521-6600 (FedOS Desktop Beta Production Runtime
  // Configuration Unification Arc) -- every field below is ADDITIVE ONLY,
  // closing the gap the Release Freeze Arc (`76f7fab`) found: this config
  // type previously had NO field at all for `directRatchet`/`peerCapability`/
  // `identityTransition` (only `conversationDeletionRequest` above existed).
  //
  // Two tiers per subsystem: an `*Enabled` boolean (this file's own
  // auto-construction trigger, mirroring `archiveEnabled`/
  // `deviceSyncSchedulerEnabled`'s established convention above) plus an
  // optional FULL manual override (mirroring `conversationDeletionRequest`
  // itself) for advanced/test callers who want to supply every dependency
  // by hand. When both are omitted, the subsystem stays exactly as
  // unreachable as it was before this Arc. When `*Enabled` is true and the
  // override is omitted, `startFedosDesktopRuntime()` constructs the
  // dependency bundle itself, reusing the SAME Device Registry / signing
  // authority / Master Seed authority / search index this Runtime already
  // owns elsewhere -- never a second, divergent instance of any of them.
  // Every one of these four REQUIRES `deviceTrustEnabled` AND
  // `privateTransportEnabled` (validated, thrown synchronously, mirroring
  // every other guard in this file) -- all four need a real Device
  // Registry and a real `sendMailboxNip17Control` to do anything.
  // -----------------------------------------------------------------------

  /**
   * OPTIONAL. Auto-constructs `FedosConversationDirectRatchetIntegrationDependencies`
   * when `conversationDirectRatchet` was not manually supplied. NOTE: no
   * append-only backend exists anywhere in this codebase for
   * `FedosDirectRatchetRemotePublicKeyPersistence`/
   * `FedosDirectRatchetLiveStateSnapshotPersistence` — this Arc does not
   * fabricate durability for either; both remain in-memory-only even when
   * this subsystem is enabled (a genuine, disclosed, narrower boundary —
   * see the completion declaration).
   */
  readonly directRatchetEnabled?: boolean;
  readonly directRatchetSessionLogPath?: string;
  readonly directRatchetSealedSecretLogPath?: string;
  readonly directRatchetResetRecordLogPath?: string;
  readonly directRatchetImportRecordLogPath?: string;
  /** Manual override — when supplied, `directRatchetEnabled`'s own auto-construction is skipped entirely and this object is used verbatim. */
  readonly conversationDirectRatchet?: FedosConversationDirectRatchetIntegrationDependencies;

  /** OPTIONAL. Auto-constructs `FedosConversationPeerCapabilityIntegrationDependencies` when `conversationPeerCapability` was not manually supplied. */
  readonly peerCapabilityEnabled?: boolean;
  /** REQUIRED when `peerCapabilityEnabled` is `true` and `conversationPeerCapability` was not supplied — this Runtime advertises no capability of its own by default (never a fabricated capability list). */
  readonly peerCapabilityLocallySupportedCapabilities?: readonly FedosRatchetPeerCapabilityEntry[];
  readonly peerCapabilityObservationLogPath?: string;
  /** Manual override — see `conversationDirectRatchet`'s own doc comment for the exact same convention. */
  readonly conversationPeerCapability?: FedosConversationPeerCapabilityIntegrationDependencies;

  /** OPTIONAL. Auto-constructs `FedosConversationIdentityTransitionIntegrationDependencies` when `conversationIdentityTransition` was not manually supplied. */
  readonly identityTransitionEnabled?: boolean;
  readonly identityTransitionObservationLogPath?: string;
  readonly identityTransitionLocalDecisionLogPath?: string;
  /** Optional — omitted, `FedosIdentityTransitionPeerRuntime`'s own existing default policy applies (unchanged by this Arc). */
  readonly identityTransitionLocalPolicy?: FedosIdentityTransitionLocalPolicy;
  /** Manual override — see `conversationDirectRatchet`'s own doc comment for the exact same convention. */
  readonly conversationIdentityTransition?: FedosConversationIdentityTransitionIntegrationDependencies;

  /** OPTIONAL. Auto-constructs `FedosConversationDeletionRequestIntegrationDependencies` when `conversationDeletionRequest` was not manually supplied — this Arc's own closure of the SAME gap `conversationDeletionRequest` above has had, unreachable from production, since `50f80e8`. */
  readonly deletionRequestEnabled?: boolean;
  /** REQUIRED when `deletionRequestEnabled` is `true` and `conversationDeletionRequest` was not supplied — LOCAL configuration only, never derived from a request (mirrors `FedosConversationDeletionRequestIntegrationDependencies.resolveLocalPolicy`'s own existing contract exactly). */
  readonly deletionRequestResolveLocalPolicy?: (requesterAccountRef: string) => FedosDeletionRecipientPolicy;
  readonly deletionRequestStateLogPath?: string;
  readonly deletionRequestDecisionLogPath?: string;
  readonly deletionRequestAcknowledgementLogPath?: string;
  readonly deletionRequestExecutionLogPath?: string;
  readonly deletionRequestInboxSummaryLogPath?: string;
  readonly deletionRequestPendingReviewLogPath?: string;
}
