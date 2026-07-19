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
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import type { FedosDeviceRegistrationAuthority } from "../../device/fedos_device_registration_authority.js";

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
  /** Explicit, caller-supplied path to the Conversation Message Envelope append-only log file (Private Delivery, Alpha 857 — reused, unchanged). Omitted, in-memory. */
  readonly conversationEnvelopeLogPath?: string;
  /** Explicit, caller-supplied path to the Conversation Payload Storage append-only log file (Private Delivery, Alpha 804 — reused, unchanged). Omitted, in-memory. */
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
}
