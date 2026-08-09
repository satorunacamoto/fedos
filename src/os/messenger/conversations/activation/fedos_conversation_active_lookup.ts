/**
 * Secure Runtime Alpha 1116/1160 — the ONE shared answer to "is this
 * Conversation active right now", consulted by BOTH
 * `FedosConversationEncryptionCoordinator` and
 * `FedosConversationDecryptionCoordinator` in place of the literal
 * `persistedDraft.lifecycleState !== "active"` check neither of them can
 * ever satisfy (see `docs/secure_runtime_alpha_1111_1180_integrated_inventory.md`
 * §2). A single source of truth avoids duplicating this rule across two
 * coordinators and keeps the ripple in each of them to a one-line swap.
 *
 * Active means TWO durable facts agree — never one boolean stored as
 * authority (Alpha 1117's own explicit instruction):
 *   1. a draft record genuinely exists for this Conversation id
 *      (`FedosConversationDraftPersistence`, unmodified, immutable), AND
 *   2. a `FedosConversationDirectActivationCoordinator` (Alpha 1122) has
 *      durably recorded a `"completed"` Activation fact for it
 *      (`FedosConversationActivationPersistence`, Alpha 1121).
 *
 * The draft record's own `lifecycleState` field is NEVER consulted for
 * this — it is permanently `"draft"` by construction (Alpha 1116's own
 * "do not silently rewrite persisted V1 records" instruction) and carries
 * no activation information of its own.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosConversationActivationPersistence } from "./fedos_conversation_activation_persistence.js";
import { fedosConversationActivationId } from "./fedos_persisted_conversation_activation_v1.js";

export type FedosConversationActiveLookupResult =
  | { readonly outcome: "active"; readonly draft: FedosPersistedConversationDraftRecordV1 }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "not-active" };

export function resolveFedosConversationActiveConversation(
  draftPersistence: FedosConversationDraftPersistence,
  activationPersistence: FedosConversationActivationPersistence,
  conversationId: FedosConversationId,
): FedosConversationActiveLookupResult {
  const draft = draftPersistence.getDraft(conversationId);
  if (draft === null) return { outcome: "not-found" };

  const activation = activationPersistence.getActivation(fedosConversationActivationId(conversationId));
  if (activation === null || activation.phase !== "completed") return { outcome: "not-active" };

  return { outcome: "active", draft };
}
