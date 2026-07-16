/**
 * Secure Runtime Alpha 626 ("ID Authority Decision") — Stage 6 of the
 * Alpha 621–640 Public Board Runtime Application API Foundation Arc.
 *
 * Canonical Board ids (`FedosBoardPostId`, `../fedos_board_identifiers.ts`)
 * are opaque application ids — `../fedos_board_identifiers.ts`'s own
 * header states plainly "No random ID generator exists anywhere in
 * this file. Nothing here mints a new id; every function only BRANDS
 * an already-chosen, already-non-empty string." Something upstream of
 * that branding step must choose the raw string in the first place —
 * this file is that "something," for `FedosBoardRuntime` specifically.
 *
 * Options compared (Alpha 626):
 *   A. Caller-supplied id — REJECTED. Lets a caller choose (and
 *      therefore collide/spoof/predict) a post's own identity; the
 *      Command Model boundary this Arc's own prior review already
 *      established (`docs/reviews/board_runtime_application_api_03_command_model.md`)
 *      requires canonical ids to be Authority-derived, never accepted
 *      from a command.
 *   B. Cryptographic random — ADOPTED. See below.
 *   C. Deterministic content hash (e.g. hash of body+author+timestamp)
 *      — REJECTED for THIS use. Two structurally different posts can
 *      legitimately share identical (author, body, createdAt) inputs
 *      (e.g. the same person posting the identical short reply "yes"
 *      in the same second is not implausible) — a content hash would
 *      make that a collision, whereas true randomness makes it a
 *      certainty of new, distinct ids. Content-hash derivation remains
 *      the RIGHT choice elsewhere in this codebase (e.g. Outbox intent
 *      ids, `makeFedosBoardOutboxId`) precisely because THOSE ids
 *      intentionally want the SAME logical input to always yield the
 *      SAME id, for idempotency — the opposite property this file needs.
 *   D. Injected ID generator interface — ADOPTED alongside B: B is the
 *      DEFAULT implementation, behind an injected interface (this
 *      file's own `FedosBoardRuntimeIdGenerator`), so a test can
 *      supply a deterministic or deliberately-colliding generator
 *      without needing real entropy, mirroring this codebase's own
 *      established "injected `now`, injected `setIntervalFn`" testing
 *      precedent (`FedosPublishSchedulerDependencies`,
 *      `src/board/outbox/fedos_publish_scheduler.ts`).
 *
 * Default generator: `randomBytes(16)` + `bytesToHex()`, BOTH already
 * imported from `@noble/hashes/utils.js` elsewhere in this codebase
 * (`src/desktop/nostr_event_id_verifier.ts`,
 * `src/desktop/nostr_signature_verifier.ts`) — this file adds ZERO new
 * dependency; `@noble/hashes` is already one of this repository's
 * exactly two production dependencies. 16 bytes (128 bits) of real
 * entropy is the same security margin a random UUIDv4 carries — the
 * collision probability across any realistic number of posts this
 * runtime could ever generate is astronomically negligible, without
 * this file needing to invent its own collision-avoidance scheme.
 *
 * Collision policy: this file does NOT check for collisions itself —
 * `FedosBoardService.registerPost()` (via `FedosDesktopHost.submitPost()`)
 * already returns `"post-id-conflict"` for a colliding id, an EXISTING,
 * already-tested code path this file's own near-zero collision
 * probability makes reachable only in a test that deliberately injects
 * a colliding id (see `FedosBoardRuntimeIdGenerator`'s own testability
 * rationale above) — this file does not duplicate that check.
 *
 * HARD GUARDRAILS:
 *   - No new production dependency of any kind.
 *   - This file mints ONLY the raw string a post id is built from; it
 *     never calls `toFedosBoardPostId`/`toFedosThreadId` itself — that
 *     branding step stays exclusively `fedos_board_post_validator.ts`'s
 *     own job, unchanged.
 *   - No network call, no filesystem call, no WASM/Rust boundary call
 *     (`randomBytes()` in `../../runtime/fedos_runtime_random_bytes.ts`
 *     is a SEPARATE, async, dev-only, WASM-gated function this file
 *     never calls — this file's own `randomBytes` import is
 *     `@noble/hashes/utils.js`'s synchronous, always-available one).
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";

/**
 * Mints a fresh, opaque raw string suitable for `toFedosBoardPostId()`
 * to brand. Pure interface — no id validation, no branding, no
 * collision handling (see this file's own header).
 */
export interface FedosBoardRuntimeIdGenerator {
  generatePostId(): string;
}

/**
 * The default `FedosBoardRuntimeIdGenerator`: 16 bytes (128 bits) of
 * `@noble/hashes/utils.js`'s own `randomBytes()`, hex-encoded. Every
 * call is independent — no internal counter, no shared state, safe to
 * share across multiple `FedosBoardRuntime` instances (Alpha 623's own
 * "independent instances" requirement) without any coordination.
 */
export class FedosSecureRandomBoardRuntimeIdGenerator implements FedosBoardRuntimeIdGenerator {
  generatePostId(): string {
    return bytesToHex(nobleRandomBytes(16));
  }
}
