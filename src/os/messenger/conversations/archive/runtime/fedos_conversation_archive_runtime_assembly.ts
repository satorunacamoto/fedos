/**
 * Secure Runtime Alpha 1691–1760 ("Conversation Archive Runtime
 * Integration and Recovery Operations Arc") — the ONE wiring point that
 * assembles a `FedosConversationArchiveRuntime` from already-constructed
 * durable ports plus an injected `FedosMasterSeedAuthority`. Mirrors
 * `assembleFedosConversationRuntimeDependencies()`'s own style (Alpha
 * 923, `../../runtime/fedos_conversation_runtime_assembly.ts`) — a thin
 * function, no filesystem I/O of its own, no default log path, no
 * `process.env` read.
 *
 * UNLIKE the Alpha 923 assembly (which itself constructs fresh
 * persistence backends from caller-supplied log paths), this function
 * takes already-constructed `FedosConversationPersistence`/
 * `FedosConversationMembershipPersistence`/
 * `FedosConversationCapabilityPersistence`/
 * `FedosConversationMessageEnvelopePersistence`/
 * `FedosConversationPayloadStorage` instances directly — the Local
 * Runtime (`../../../desktop/runtime/fedos_desktop_runtime.ts`) already
 * constructs every one of these itself (Conversation/Envelope/Payload
 * unconditionally since Alpha 758/1471–1540; Membership/Capability newly
 * for this Arc, over the SAME log paths the Conversation Runtime's own
 * Alpha 923 assembly already uses for its Membership/Capability
 * Authorities — see that file's own desktop-runtime call site for why
 * two separate port instances over the same durable log path is this
 * codebase's own established, restart-stable pattern, not a new one).
 * This function never constructs a persistence backend itself, and
 * never duplicates a `FedosMasterSeedAuthority` — exactly one is
 * injected, the SAME "no Master Seed Authority of its own" discipline
 * this Local Runtime already applies to `conversationTransportSigningAuthority`
 * (Alpha 1471–1540).
 */

import type { FedosConversationPersistence } from "../../../../../conversation/persistence/fedos_conversation_persistence.js";
import type { FedosConversationMembershipPersistence } from "../../../../../conversation/membership/persistence/fedos_conversation_membership_persistence.js";
import type { FedosConversationCapabilityPersistence } from "../../../../../conversation/capability/persistence/fedos_conversation_capability_persistence.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../../../../conversation/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../../../../../conversation/payload_storage/fedos_conversation_payload_storage.js";
import type { FedosGroupGenerationPersistence } from "../../../../../conversation/group/fedos_group_generation.js";
import type { FedosGroupDirectPathPersistence } from "../../../../../conversation/group/fedos_group_direct_path.js";
import type { FedosGroupMessagePersistence } from "../../../../../conversation/group/fedos_group_message.js";
import type { FedosGroupFanoutDeliveryPersistence } from "../../../../../conversation/group/fedos_group_fanout_delivery.js";
import type { FedosMasterSeedAuthority } from "../../../../../runtime/master_seed/fedos_master_seed_authority.js";
import type { FedosPayloadRetentionAuthority } from "../../../../../conversation/retention/fedos_payload_retention_authority.js";
import type { FedosArchiveSuppressionObservationAuthority } from "../../../../../conversation/retention/fedos_archive_suppression_observation_authority.js";
import type { FedosConversationDraftPersistence } from "../../../../../conversation/construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../../../../conversation/activation/fedos_conversation_activation_persistence.js";
import type { FedosBoardRuntimeClock } from "../../../../../board/runtime/fedos_board_runtime_clock.js";
import { defaultFedosBoardRuntimeClock } from "../../../../../board/runtime/fedos_board_runtime_clock.js";
import { FedosWasmConversationArchiveEncryptionAuthority, type FedosConversationArchiveEncryptionRuntimeBoundary } from "../../../../../conversation/archive/fedos_conversation_archive_encryption.js";
import type { FedosConversationArchiveFileAuthority } from "../../../../../conversation/archive/fs/fedos_conversation_archive_file_authority.js";
import { fedosConversationArchiveFileAuthority } from "../../../../../conversation/archive/fs/fedos_conversation_archive_file_authority.js";
import {
  createFedosConversationArchiveRuntime,
  type FedosConversationArchiveRuntime,
  type FedosConversationArchiveRuntimeBounds,
} from "../../../../../conversation/archive/runtime/fedos_conversation_archive_runtime.js";

export interface FedosConversationArchiveRuntimeAssemblyConfig {
  readonly conversationPersistence: FedosConversationPersistence;
  /** Secure Runtime Alpha 7801-7880 — optional pair, additive; see `FedosConversationArchiveRuntimeDependencies`'s own doc comment. Passed straight through, unmodified. */
  readonly draftPersistence?: FedosConversationDraftPersistence;
  readonly activationPersistence?: FedosConversationActivationPersistence;
  readonly membershipPersistence: FedosConversationMembershipPersistence;
  readonly capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  /**
   * Secure Runtime Alpha 1921–1980 — the four Group-only persistence
   * ports, passed straight through to `createFedosConversationArchiveRuntime()`
   * unmodified. ALL four optional, meaningful only together — omitted,
   * this Runtime never populates or restores a Group Section (the
   * IDENTICAL Direct-only behavior every prior Arc's own assembly
   * already produced).
   */
  readonly groupGenerationPersistence?: FedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence?: FedosGroupDirectPathPersistence;
  readonly groupMessagePersistence?: FedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence?: FedosGroupFanoutDeliveryPersistence;
  /** REQUIRED — this function constructs no Master Seed Authority of its own. */
  readonly masterSeedAuthority: FedosMasterSeedAuthority;
  /** REQUIRED — the owning Local Runtime's own live "am I still running" predicate. See `FedosConversationArchiveRuntime`'s own header, "LIFECYCLE". */
  readonly isRuntimeRunning: () => boolean;
  /** Optional — default `defaultFedosBoardRuntimeClock` (Alpha 625, unchanged). */
  readonly clock?: FedosBoardRuntimeClock;
  /** Optional — default `DEFAULT_FEDOS_CONVERSATION_ARCHIVE_RUNTIME_BOUNDS`. */
  readonly bounds?: FedosConversationArchiveRuntimeBounds;
  /** Optional, testability only — default `fedosConversationArchiveFileAuthority` (the real, Node-`fs`-backed implementation). */
  readonly fileAuthority?: FedosConversationArchiveFileAuthority;
  /** Optional, testability only — default the real Runtime Service pass-throughs (`fedosConversationArchiveEncryptionRuntimeBoundary`). */
  readonly encryptionRuntimeBoundary?: FedosConversationArchiveEncryptionRuntimeBoundary;
  /** Secure Runtime Alpha 7241-7320 — optional, additive; see `FedosConversationArchiveRuntimeDependencies`'s own doc comment. Passed straight through, unmodified. Widened in Alpha 7481-7560 to also cover `evaluateRetentionDecisionOnly` (Restore's own defense-in-depth gate). */
  readonly retentionAuthority?: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess" | "evaluateRetentionDecisionOnly">;
  /** Secure Runtime Alpha 7801-7880 — optional, additive; see `FedosConversationArchiveRuntimeDependencies`'s own doc comment. Passed straight through, unmodified. Closes the real wiring gap this Arc found: `e048ff63` never threaded this dependency past `restoreFedosConversationArchiveBundle()` itself. */
  readonly suppressionAuthority?: Pick<FedosArchiveSuppressionObservationAuthority, "evaluateSuppression">;
}

/** Pure with respect to the filesystem — constructs no file, starts no timer, reads no `process.env`. */
export function assembleFedosConversationArchiveRuntime(
  config: FedosConversationArchiveRuntimeAssemblyConfig,
): FedosConversationArchiveRuntime {
  const encryptionAuthority = new FedosWasmConversationArchiveEncryptionAuthority(
    config.masterSeedAuthority,
    config.encryptionRuntimeBoundary,
  );

  return createFedosConversationArchiveRuntime({
    conversationPersistence: config.conversationPersistence,
    draftPersistence: config.draftPersistence,
    activationPersistence: config.activationPersistence,
    membershipPersistence: config.membershipPersistence,
    capabilityPersistence: config.capabilityPersistence,
    envelopePersistence: config.envelopePersistence,
    payloadStorage: config.payloadStorage,
    groupGenerationPersistence: config.groupGenerationPersistence,
    groupDirectPathPersistence: config.groupDirectPathPersistence,
    groupMessagePersistence: config.groupMessagePersistence,
    groupFanoutDeliveryPersistence: config.groupFanoutDeliveryPersistence,
    encryptionAuthority,
    fileAuthority: config.fileAuthority ?? fedosConversationArchiveFileAuthority,
    clock: config.clock ?? defaultFedosBoardRuntimeClock,
    isRuntimeRunning: config.isRuntimeRunning,
    bounds: config.bounds,
    retentionAuthority: config.retentionAuthority,
    suppressionAuthority: config.suppressionAuthority,
  });
}
