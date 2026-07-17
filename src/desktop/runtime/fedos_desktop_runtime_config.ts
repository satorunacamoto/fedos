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
import type { FedosConversationEncryptionAuthority } from "../../conversation/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority } from "../../conversation/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationIdentityResolver } from "../../conversation/encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationLocalAccountIndexAuthority } from "../../conversation/encryption/identity/fedos_conversation_local_account_index_authority.js";
import type { FedosConversationProductionCryptoConfig } from "../../conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.js";
import type { FedosGroupParticipantLimitPolicy } from "../../conversation/group/fedos_group_participant_limit.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosPrivateNostrDeliveryMode } from "../../conversation/delivery/nostr/fedos_private_nostr_delivery_mode.js";
import type { FedosPrivateNostrDeliveryPublisher } from "../../conversation/delivery/nostr/fedos_private_nostr_delivery_publisher.js";

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
  /** Alpha 1113 — optional append-only log for private-message Envelope metadata; omitted, in-memory. */
  readonly conversationEnvelopeLogPath?: string;
  /** Alpha 1113 — optional append-only log for opaque ciphertext payload bytes; omitted, in-memory. */
  readonly conversationPayloadLogPath?: string;
  /** Alpha 1113 — optional, only meaningful with `conversationPayloadLogPath`; omitted, `1_000_000` bytes (Alpha 949's own default). */
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
}
