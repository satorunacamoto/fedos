/**
 * Secure Runtime Alpha 254 ("Canonical Board Author Reference") — Stage 4
 * of the Alpha 251–260 Canonical Board Model Foundation Arc.
 *
 * The author of a Canonical Board Post (`./fedos_board_post.ts`, Alpha
 * 255), adopting "Option D" of this Arc's own instruction: a DEDICATED
 * reference type, distinct from embedding a full
 * `FedosIdentityDescriptor` (`src/identity/fedos_identity_descriptor.ts`,
 * Alpha 028/045), a bare local identity id, or a raw source-protocol
 * author identifier.
 *
 * DECISION (Alpha 254): `displayName`/`avatar` are DELIBERATELY EXCLUDED
 * from this type, unlike `FedosIdentityDescriptor`/`FedosIdentityRecord`'s
 * own optional two-field expansion (Alpha 045/047). A `FedosBoardPost`
 * (Alpha 255) is IMMUTABLE and, once federation adapters exist, may be
 * held for a long time; a `displayName`/`avatar` snapshotted at ingest
 * time would silently go stale the moment the real author renames or
 * changes their avatar, and nothing in this Arc's scope ever re-resolves
 * it. A future presentation layer should resolve profile display data
 * SEPARATELY (via `FedosIdentityRecord` for local identities, or a future
 * per-protocol profile cache for remote ones) and join it against
 * `publicIdentifier` at render time — never bake it into the immutable
 * post.
 *
 * HARD GUARDRAILS:
 *   - NO private key, Master Seed, authentication token, OAuth token,
 *     session cookie, `nsec`, or protocol credential of any kind.
 *   - `identityId` links to a LOCAL `FedosIdentityRecord.id`
 *     (`src/identity/fedos_identity_record.ts`, Alpha 040) only when the
 *     author is already a known local identity; `null` for every other
 *     author (the common case for federated content).
 *   - `publicIdentifier` is the SAME kind of already-public value
 *     `FedosIdentityDescriptor.publicIdentifier` already is (Alpha 028) —
 *     a pubkey/npub, DID, ActivityPub Actor URI, or Session ID — never a
 *     secret.
 */

import type { FedosBoardSourceProtocol } from "./fedos_board_source.js";

export interface FedosBoardAuthorReference {
  /** Local `FedosIdentityRecord.id`, or `null` when the author is not a known local identity. */
  readonly identityId: string | null;
  readonly protocol: FedosBoardSourceProtocol;
  /** An already-public identifier in the author's own protocol namespace — never a secret. */
  readonly publicIdentifier: string;
}
