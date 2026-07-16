/**
 * Secure Runtime Alpha 722 ("Canonical Delivery Result Decision") / Alpha
 * 723 ("Publisher Port Reconciliation") — Stages 2–3 of the Alpha
 * 721–740 Nostr Relay ACK Semantics & Permanent Rejection Arc.
 *
 * Alpha 721's own inventory found the ONE actual defect: the canonical,
 * protocol-neutral `FedosOutboundPublishResult`
 * (`../fedos_outbound_publish_result.js`, Alpha 492, UNCHANGED) already
 * distinguishes `"accepted"` / `"rejected"` / `"failed"`, and
 * `outboundPublishOutcomeToRetryPolicy()` (Alpha 497, UNCHANGED) already
 * maps `"rejected"` to `"never"` retry — but NOTHING in the Nostr publish
 * path could ever PRODUCE `"rejected"`, because `FedosNostrBoardPublisher.publishOne()`
 * (Alpha 455, frozen) returns only a bare `boolean`, and
 * `nostrPublishOneResultToOutboundPublishResult()` (Alpha 497, frozen)
 * can only ever turn that boolean into `"accepted"`/`"failed"`.
 *
 * `FedosRelayOkCorrelatedNostrBoardPublisher`
 * (`./fedos_relay_ok_correlated_nostr_board_publisher.ts`, Alpha 710/711)
 * already INTERNALLY knows the real three-way distinction (a matching
 * Relay `OK` with `accepted: true`/`false`, or a timeout/transport
 * failure) — it was simply forced to collapse it to `boolean` at its own
 * `publishOne()` boundary. This file is the SECOND, additive port that
 * lets it say what it already knows, without widening
 * `FedosNostrBoardPublisher` itself (Alpha 723's own "no parallel
 * boolean contract... prefer adapters... rather than editing unrelated
 * Publisher implementations" — `FedosNostrBoardPublisher`/
 * `FedosRelayNostrBoardPublisher`/`nostrPublishOneResultToOutboundPublishResult`
 * are all left byte-for-byte unchanged).
 *
 * HARD GUARDRAILS:
 *   - `FedosNostrBoardPublisherWithOutcome` is the ONLY export.
 *   - `publishOneOutcome()` returns the EXISTING, reused
 *     `FedosOutboundPublishResult` (Alpha 492) — no new result type.
 *   - No `retryPolicy`, `reason`, `Error`, or raw Relay text field of any
 *     kind reaches this boundary — the canonical type itself already
 *     forbids all four.
 */

import type { FedosOutboundPublishResult } from "../fedos_outbound_publish_result.js";
import type { FedosNostrBoardPublishEntry } from "./fedos_nostr_board_publisher.js";

export interface FedosNostrBoardPublisherWithOutcome {
  publishOneOutcome(entry: FedosNostrBoardPublishEntry): Promise<FedosOutboundPublishResult>;
}
