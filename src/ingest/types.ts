import type { NostrEvent } from "../nostr/types.js";
import type { StructureIssue } from "../nostr/event.js";

/** A validated event annotated with where/when we ingested it. */
export interface IngestedEvent {
  readonly event: NostrEvent;
  /** Relay URL this event was first seen on. */
  readonly relayUrl: string;
  /** Unix ms timestamp when we ingested it (injected, for determinism). */
  readonly ingestedAt: number;
}

/** A value that failed structural validation. */
export interface RejectedEvent {
  readonly value: unknown;
  readonly issues: StructureIssue[];
}

/** Result of running raw events through the ingest pipeline. */
export interface IngestResult {
  readonly accepted: IngestedEvent[];
  readonly rejected: RejectedEvent[];
  /** Count of structurally-valid events dropped as duplicates (same id). */
  readonly duplicates: number;
}

/** Context injected into the (otherwise pure) ingest pipeline. */
export interface IngestContext {
  readonly relayUrl: string;
  /** Current time in unix ms. Injected so the pipeline stays deterministic. */
  readonly now: number;
  /**
   * Optional set of ids already known to the store. Events whose id is present
   * are counted as duplicates and not re-accepted. Defaults to empty.
   */
  readonly seenIds?: ReadonlySet<string>;
}
