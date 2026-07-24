/**
 * Secure Runtime Alpha 1921–1980 ("Group Conversation Archive Integration
 * and Cross-Branch Recovery Arc") — Archive Group Section V1.
 *
 * The OPTIONAL, ADDITIVE Group payload a `FedosConversationArchiveBundleV1`
 * (`./fedos_conversation_archive_bundle.ts`) may now carry under the SAME
 * `schemaVersion: 1` (Alpha 1923's own frozen decision, recorded in
 * `docs/secure_runtime_alpha_1921_1980_phase_a_domain_inventory.md` §3 —
 * Option B, an additive optional field, never a second schema-version
 * branch). Its absence on a bundle means "this is a Direct-only Archive,"
 * identical to every Archive this codebase produced before this Arc.
 *
 * Every one of the five nested lists below is a pure AGGREGATE of an
 * already-existing, already-frozen persisted record shape — mirroring
 * `FedosConversationArchiveBundleV1`'s own "never a new record shape of
 * its own for any reused domain" discipline exactly:
 *
 *   - `FedosGroupGenerationRecord[]`      (`../group/fedos_group_generation.ts`, Alpha 1324–1327 — EVERY generation, via `listGenerations()`)
 *   - `FedosGroupDirectPathRecord[]`      (`../group/fedos_group_direct_path.ts`, Alpha 1331–1336 — every CURRENT path fact across every known generation, via `listPathsForGeneration()` per generation)
 *   - `FedosGroupMessageRecord[]`         (`../group/fedos_group_message.ts`, Alpha 1341–1342 — the CURRENT record per id, via `listMessagesForGroup()`)
 *   - `FedosGroupFanoutDeliveryRecord[]`  (`../group/fedos_group_fanout_delivery.ts`, Alpha 1346–1347 — the CURRENT record per (message, recipient), via `listDeliveriesForMessage()`)
 *   - `FedosConversationArchiveBundleV1[]` — one FULL, already-existing bundle shape PER child Direct Conversation a Group Path references (`directConversationId`), collected via the SAME `collectFedosConversationArchiveBundle()` this file's own sibling already exports (`./fedos_conversation_archive_collector.ts`) — new ORCHESTRATION, never a new record shape.
 *
 * Generation/Path are archived EXHAUSTIVELY (every record, not just
 * current) because an OLDER generation/path is never superseded
 * content-wise, only numerically surpassed — a historical Group Message's
 * own `fanoutDelivery.pathId` can reference an older generation's path
 * (see the Phase A/B domain inventory §2 for the full canonical-vs-
 * derivable reasoning this file's own shape follows verbatim). Message/
 * FanoutDelivery are archived as CURRENT-record-only, mirroring
 * Membership's own existing "current record is sufficient" precedent —
 * a Group Message's/Fanout Delivery's own current record already carries
 * every field a superseded intermediate fact would.
 *
 * Activation and retention/tombstone facts are INTENTIONALLY EXCLUDED —
 * see the Phase A/B domain inventory §1, mirroring the Direct Archive's
 * own existing, already-accepted precedent of excluding both.
 *
 * HARD GUARDRAILS:
 *   - No key material, no bearer secret, no plaintext message content —
 *     every nested record here is already-persisted, already-frozen wire
 *     data, identical to what `FedosConversationArchiveBundleV1` itself
 *     already carries for its own five domains.
 *   - No protocol/Relay-specific data of any kind — only local persisted
 *     facts.
 *   - This file defines a TYPE ONLY — no function, no class.
 */

import type { FedosGroupGenerationRecord } from "../group/fedos_group_generation.js";
import type { FedosGroupDirectPathRecord } from "../group/fedos_group_direct_path.js";
import type { FedosGroupMessageRecord } from "../group/fedos_group_message.js";
import type { FedosGroupFanoutDeliveryRecord } from "../group/fedos_group_fanout_delivery.js";
import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";

export interface FedosConversationArchiveGroupSectionV1 {
  /** EVERY generation record for this Group (`listGenerations()`), not just the current one. */
  readonly generations: readonly FedosGroupGenerationRecord[];
  /** Every CURRENT path fact across every generation listed above (`listPathsForGeneration()` per generation id). */
  readonly paths: readonly FedosGroupDirectPathRecord[];
  /** The CURRENT (highest-ranked `fanoutState`) record per Group Message id (`listMessagesForGroup()`). */
  readonly messages: readonly FedosGroupMessageRecord[];
  /** The CURRENT (highest-ranked `state`) record per (Group Message, recipient) pair, across every message above (`listDeliveriesForMessage()`). */
  readonly fanoutDeliveries: readonly FedosGroupFanoutDeliveryRecord[];
  /** One full bundle per DISTINCT child Direct Conversation referenced by `paths` above (`directConversationId`), deduplicated by conversation id. */
  readonly childConversations: readonly FedosConversationArchiveBundleV1[];
}
