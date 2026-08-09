/**
 * Secure Runtime Alpha 895 ("Mode Validator Extension") — Stage 5 of
 * Phase A of the Alpha 891–930 Private Conversation Draft Construction and
 * Readiness Runtime Arc.
 *
 * The ONLY place that constructs a `FedosConversationDraftRecord`
 * (`./fedos_conversation_draft_record.ts`, Alpha 894) — mirrors
 * `validateFedosConversationRecord`'s own "typed builder, sole
 * constructor, fail-closed to `null`, never throws" discipline (Alpha
 * 748).
 *
 * Alpha 895 extends mode handling ADDITIVELY: this validator accepts
 * `"private-group"`/`"direct"` (and lifecycle `"draft"` only) — while the
 * PUBLIC `validateFedosConversationRecord` stays byte-for-byte unchanged,
 * still rejecting every non-`"public"` mode. There are now two sole
 * constructors, one per record family; neither can produce the other's
 * mode. Crucially, this validator alone is NOT sufficient authorization
 * to create a draft (Alpha 895's own rule): it is a pure structural
 * builder, reachable in production ONLY through the reviewed construction
 * coordinator (`./fedos_private_conversation_construction_coordinator.ts`),
 * which resolves identity, policy, and durable ordering first — an old
 * factory cannot casually mint an unsupported-mode record just by calling
 * this function.
 *
 * Enforces, in order: exact field set; `mode ∈ {private-group, direct}`;
 * `lifecycleState === "draft"` (this Arc constructs no other lifecycle,
 * Alpha 893); `policyReference` matches `mode`
 * (`private-group-draft-v1` ↔ `private-group`, `direct-draft-v1` ↔
 * `direct`, Alpha 896); a well-formed `creator`
 * (`validateFedosConversationParticipantReference`, Alpha 763,
 * unmodified); `createdAt` in the same accepted Unix-seconds range the
 * Board post/record validators already use.
 *
 * HARD GUARDRAILS:
 *   - Fails closed: every rejection returns `null`. Never throws.
 *   - No network, no storage, no identity resolution, no existence check.
 *   - Deep-copies and `Object.freeze`s the result (creator included),
 *     never the caller's own reference.
 */

import {
  FEDOS_BOARD_POST_MAX_CREATED_AT,
  FEDOS_BOARD_POST_MIN_CREATED_AT,
} from "../../board/fedos_board_post_validator.js";
import { validateFedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference_validator.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type {
  FedosConversationDraftRecord,
  FedosPrivateConversationPolicyReference,
} from "./fedos_conversation_draft_record.js";
import type { FedosPrivateConversationMode } from "./fedos_private_conversation_id.js";

/** The typed candidate the coordinator builds before calling `validateFedosConversationDraftRecord`. */
export interface FedosConversationDraftRecordInput {
  readonly id: string;
  readonly mode: string;
  readonly lifecycleState: string;
  readonly policyReference: string;
  readonly creator: unknown;
  readonly createdAt: number;
}

const EXPECTED_KEYS: readonly string[] = ["createdAt", "creator", "id", "lifecycleState", "mode", "policyReference"].slice().sort();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidCreatedAt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= FEDOS_BOARD_POST_MIN_CREATED_AT &&
    value <= FEDOS_BOARD_POST_MAX_CREATED_AT
  );
}

/** The one policy reference each private mode is allowed to carry in V1 (Alpha 896). */
function policyReferenceForMode(mode: FedosPrivateConversationMode): FedosPrivateConversationPolicyReference {
  return mode === "private-group" ? "private-group-draft-v1" : "direct-draft-v1";
}

export function validateFedosConversationDraftRecord(
  input: FedosConversationDraftRecordInput,
): FedosConversationDraftRecord | null {
  if (input === null || typeof input !== "object") return null;

  const keys = Object.keys(input).sort();
  if (keys.length !== EXPECTED_KEYS.length || !keys.every((key, index) => key === EXPECTED_KEYS[index])) {
    return null;
  }

  if (input.mode !== "private-group" && input.mode !== "direct") return null;
  const mode: FedosPrivateConversationMode = input.mode;

  // Alpha 893 — this Arc constructs only "draft"; any other lifecycle
  // value (including the recognized-but-unimplemented "active"/"closed"/
  // "tombstoned") fails closed here.
  if (input.lifecycleState !== "draft") return null;

  if (input.policyReference !== policyReferenceForMode(mode)) return null;
  const policyReference: FedosPrivateConversationPolicyReference = policyReferenceForMode(mode);

  if (!isNonEmptyString(input.id)) return null;
  const id = input.id as FedosConversationId;

  const creator = validateFedosConversationParticipantReference(input.creator);
  if (creator === null) return null;

  if (!isValidCreatedAt(input.createdAt)) return null;

  return Object.freeze({
    id,
    mode,
    lifecycleState: "draft" as const,
    policyReference,
    creator,
    createdAt: input.createdAt,
  });
}
