/**
 * Secure Runtime Alpha 2501–2580 ("Conversation Search Runtime") — Mode
 * Index (satisfies both the "group index" and "direct index" scope
 * items).
 *
 * ONE `conversationId → FedosPrivateConversationMode` map backs BOTH
 * `directConversationIds()` and `groupConversationIds()` — deliberately
 * NOT two separate, independently-maintained structures. This mirrors
 * `FedosConversationReader`'s own Alpha 753 "Conversation Repository /
 * Index Decision" (`../fedos_conversation_reader.ts`), which rejected a
 * second in-memory index precisely because it would compute nothing a
 * direct lookup does not already give: `"direct"`/`"private-group"`
 * (`FedosPrivateConversationMode`,
 * `../construction/fedos_private_conversation_id.ts`, Alpha 908) are
 * two values of ONE closed enum, so splitting them into two
 * separately-maintained maps would be exactly the redundant index that
 * precedent already argues against — "group index" and "direct index"
 * are two independently-tested READ accessors over one classification,
 * not two data structures.
 *
 * REUSES Conversation Runtime's own `FedosConversationDraftPersistence`
 * (`../construction/fedos_conversation_draft_persistence.ts`, Alpha
 * 894/911 — the same port `FedosConversationRuntimeDependencies`,
 * `../runtime/fedos_conversation_runtime.ts`, already bundles as
 * `draftPersistence`) to classify a conversation id: `getDraft(id)` and
 * read its `mode`. A conversation id this port does not recognize (no
 * draft record — e.g. a public Board conversation, out of this Arc's
 * scope entirely) resolves to `null`: fails closed, never guessed.
 *
 * HARD GUARDRAILS:
 *   - No module-level mutable state.
 *   - Read-only consumer of `draftPersistence` — never calls `putDraft`.
 *   - `indexConversation()` is idempotent — indexing the same
 *     conversation id twice never produces two entries.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../../../../conversation/construction/fedos_conversation_draft_persistence.js";
import type { FedosPrivateConversationMode } from "../../../../conversation/construction/fedos_private_conversation_id.js";

export interface FedosConversationSearchModeIndexDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
}

function isFedosPrivateConversationMode(value: string): value is FedosPrivateConversationMode {
  return value === "direct" || value === "private-group";
}

export class FedosConversationSearchModeIndex {
  readonly #draftPersistence: FedosConversationDraftPersistence;
  readonly #modeByConversation = new Map<FedosConversationId, FedosPrivateConversationMode>();

  constructor(deps: FedosConversationSearchModeIndexDependencies) {
    this.#draftPersistence = deps.draftPersistence;
  }

  /** Classifies `conversationId` via `draftPersistence`, if not already classified. Returns the resolved mode, or `null` if `conversationId` has no known draft record. */
  indexConversation(conversationId: FedosConversationId): FedosPrivateConversationMode | null {
    const existing = this.#modeByConversation.get(conversationId);
    if (existing !== undefined) return existing;

    const draft = this.#draftPersistence.getDraft(conversationId);
    if (draft === null || !isFedosPrivateConversationMode(draft.mode)) return null;
    this.#modeByConversation.set(conversationId, draft.mode);
    return draft.mode;
  }

  removeConversation(conversationId: FedosConversationId): void {
    this.#modeByConversation.delete(conversationId);
  }

  modeOf(conversationId: FedosConversationId): FedosPrivateConversationMode | null {
    return this.#modeByConversation.get(conversationId) ?? null;
  }

  /** Every currently-indexed `"direct"` conversation id, deterministically sorted. */
  directConversationIds(): readonly FedosConversationId[] {
    return [...this.#modeByConversation.entries()].filter(([, mode]) => mode === "direct").map(([id]) => id).sort();
  }

  /** Every currently-indexed `"private-group"` conversation id, deterministically sorted. */
  groupConversationIds(): readonly FedosConversationId[] {
    return [...this.#modeByConversation.entries()].filter(([, mode]) => mode === "private-group").map(([id]) => id).sort();
  }
}
