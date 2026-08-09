/**
 * Secure Runtime Alpha 313 ("Persisted Board Record V1") — Stage 3 of
 * the Alpha 311–320 Canonical Board Persistence Boundary Arc.
 *
 * The STABLE WIRE SHAPE the persistence layer writes to a backend —
 * deliberately NOT the branded runtime `FedosBoardPost` type
 * (`../fedos_board_post.js`, Alpha 255) itself. See this Stage's own
 * design doc §3 for why persisting the runtime type blindly would be
 * wrong: branding is a compile-time-only device, and `FedosBoardPost`
 * was never designed as a wire format.
 *
 * HARD GUARDRAILS:
 *   - `FedosPersistedBoardPostRecordV1` is the ONLY export.
 *   - `schemaVersion` is the literal numeric type `1` — a value of any
 *     other number is a compile-time error here; Alpha 314 adds the
 *     matching RUNTIME check against unknown future values.
 *   - Plain serializable data only — every field is a `string`,
 *     `number`, `null`, or a plain nested object of the same. No
 *     branded type, `Map`, `Set`, function, class instance, protocol
 *     wire object, secret, mutable array, feed/index data, ontology
 *     data, or transport state of any kind.
 *   - No moderation field of any kind — moderation persistence is
 *     deliberately DEFERRED this Arc (this Stage's own design doc §5).
 *   - This file defines a TYPE ONLY — no function, no class, no
 *     construction logic.
 */

import type { FedosBoardSourceProtocol } from "../fedos_board_source.js";

export interface FedosPersistedBoardPostRecordV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly boardId: string;
  readonly threadId: string;
  readonly replyTo: string | null;
  readonly author: {
    readonly identityId: string | null;
    readonly protocol: FedosBoardSourceProtocol;
    readonly publicIdentifier: string;
  };
  readonly body: string;
  readonly createdAt: number;
  readonly source: {
    readonly protocol: FedosBoardSourceProtocol;
    readonly reference: string;
  };
}
