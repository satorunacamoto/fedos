import type { NostrEvent } from "../nostr/types.js";
import type { IngestedEvent } from "../ingest/types.js";

/**
 * A node in a Reddit-style thread tree.
 *
 * Built purely from already-ingested events. The tree references the original
 * events; it never copies or mutates them.
 */
export interface ThreadNode {
  readonly event: NostrEvent;
  /** The ingest record this node was built from (relay/timestamp metadata). */
  readonly source: IngestedEvent;
  /**
   * Resolved parent id WITHIN the supplied event set, or null when this node is
   * a thread root. Note: an orphan reply (parent not in the set) and a cycle
   * that was cut both resolve to a null parent — see warnings for the reason.
   */
  readonly parentId: string | null;
  /** Distance from the root of its tree (root = 0). */
  readonly depth: number;
  /** Direct replies, sorted created_at ASC then id ASC. */
  readonly children: readonly ThreadNode[];
}

/** Why a node could not be placed as a normal reply. */
export type ThreadWarningKind =
  /** Reply target wasn't present in the input set; node promoted to root. */
  | "orphan_reply"
  /** Following reply links revisited a node; the closing edge was cut. */
  | "cycle_detected"
  /** Event carried one or more malformed `e` tags, which were ignored. */
  | "invalid_e_tag"
  /** Two input events shared an id; the later occurrence was dropped. */
  | "duplicate_event";

export interface ThreadBuildWarning {
  readonly kind: ThreadWarningKind;
  /** Id of the event the warning is about. */
  readonly eventId: string;
  /** Optional human-readable context. */
  readonly detail?: string;
}

export interface ThreadBuildResult {
  /** Root threads, sorted created_at DESC then id ASC. */
  readonly roots: readonly ThreadNode[];
  /** Every node, keyed by event id (includes nested replies). */
  readonly nodesById: ReadonlyMap<string, ThreadNode>;
  /** Non-fatal anomalies encountered while building. */
  readonly warnings: readonly ThreadBuildWarning[];
}
