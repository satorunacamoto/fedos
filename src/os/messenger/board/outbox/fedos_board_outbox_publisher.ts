/**
 * Secure Runtime Alpha 473 ("Publisher Interface Model") — Stage 3 of
 * the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.
 *
 * `FedosBoardOutboxPublisher` is a NEW, protocol-agnostic port —
 * mirroring `FedosBoardOutboxPersistence`'s own role
 * (`./fedos_board_outbox_persistence.ts`, Alpha 417) as "the shape every
 * backend implements," except on the SEND side rather than the durable
 * side. This file defines the CONTRACT ONLY. It never constructs, signs,
 * or transmits a real protocol event — no `RelayPublisher`
 * (`../../nostr/publish.ts`, Alpha 216) reference, no
 * `FedosNostrSigningAuthority` reference, no `FedosRelay` reference, no
 * WebSocket, no `FedosNostrWireEvent`. Per this Arc's own Absolute
 * Prohibitions, no `FedosNostrBoardPublisher` — or any other real,
 * protocol-wired implementation of this interface — is created here or
 * anywhere else in this Arc; see
 * `docs/secure_runtime_alpha_473_publisher_interface_model.md` for why a
 * generic interface (Option B) was adopted over a Nostr-only shape
 * (Option A, rejected) or reuse of `RelayPublisher` itself (Option C,
 * rejected — `RelayPublisher` is transport-only and Nostr-specific,
 * never Outbox-aware).
 *
 * `MockFedosBoardOutboxPublisher` exists ONLY so this Arc's own
 * `FedosPublishScheduler` (`./fedos_publish_scheduler.ts`, Alpha 476)
 * can be tested without any real network, signing, or Relay dependency —
 * mirroring `MockRelayPublisher`'s own identical role
 * (`../../nostr/publish.ts`, Alpha 216) for a DIFFERENT interface. It is
 * not wired to Nostr, ActivityPub, AT Protocol, or Session in any way.
 *
 * HARD GUARDRAILS:
 *   - No import from `../../nostr/*`, `../../desktop/*`, or any Relay/
 *     signing/transport file anywhere in this file.
 *   - `publish()` returns a RESULT — it never throws for a delivery-side
 *     problem (mirrors `RelayPublisher.publish()`'s own "never throws
 *     for relay-side problems" convention).
 *   - Retry directive is EXACTLY `"immediate" | "later" | "never"` — no
 *     backoff duration, no attempt counter, no timestamp field anywhere
 *     in this file (see
 *     `docs/secure_runtime_alpha_474_retry_policy_model.md`).
 */

import type { FedosPersistedBoardOutboxRecordV1 } from "./fedos_board_outbox_codec.js";

/**
 * `"delivered"`: the publisher's counterparty accepted the intent.
 * `"rejected"`: the counterparty explicitly refused it (never becomes
 * `"delivered"` by retrying the identical intent).
 * `"failed"`: the attempt itself did not complete (transport/timeout/
 * unknown) — retryable, unlike `"rejected"`.
 */
export type FedosBoardOutboxPublishOutcome = "delivered" | "rejected" | "failed";

/**
 * The ONLY three retry directives this Arc recognizes (its own required
 * constraint). `"immediate"`: worth one same-tick re-attempt.
 * `"later"`: leave the intent pending for a future `tick()` call, no
 * delay computed or scheduled here. `"never"`: the Scheduler must never
 * re-attempt this intent again.
 */
export type FedosBoardOutboxRetryPolicy = "immediate" | "later" | "never";

export interface FedosBoardOutboxPublishResult {
  readonly outcome: FedosBoardOutboxPublishOutcome;
  readonly retryPolicy: FedosBoardOutboxRetryPolicy;
  readonly reason?: string;
}

export interface FedosBoardOutboxPublisher {
  publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult>;
}

const OUTCOMES: ReadonlySet<string> = new Set(["delivered", "rejected", "failed"]);
const RETRY_POLICIES: ReadonlySet<string> = new Set(["immediate", "later", "never"]);

/**
 * Fail-closed structural guard the Scheduler runs over every
 * `FedosBoardOutboxPublisher.publish()` return value before acting on
 * it — a `Publisher` is an INJECTED boundary of unknown trustworthiness,
 * the same posture this repository already takes toward every other
 * injected dependency's return value (e.g.
 * `deserializeFedosBoardOutboxIntent`, Alpha 416). A malformed result is
 * treated as `{ outcome: "failed", retryPolicy: "later" }` by the
 * caller — never trusted, never thrown.
 */
export function isValidFedosBoardOutboxPublishResult(value: unknown): value is FedosBoardOutboxPublishResult {
  if (value === null || typeof value !== "object") return false;
  const result = value as { outcome?: unknown; retryPolicy?: unknown; reason?: unknown };
  if (typeof result.outcome !== "string" || !OUTCOMES.has(result.outcome)) return false;
  if (typeof result.retryPolicy !== "string" || !RETRY_POLICIES.has(result.retryPolicy)) return false;
  if (result.reason !== undefined && typeof result.reason !== "string") return false;
  return true;
}

export interface MockFedosBoardOutboxPublisherOptions {
  /** Called once per `publish()` invocation, in order; `next()` (below) is used once this list is exhausted. */
  readonly results?: readonly FedosBoardOutboxPublishResult[];
  /** Falls back to `{ outcome: "delivered", retryPolicy: "never" }` once `results` is exhausted. */
  readonly next?: (record: FedosPersistedBoardOutboxRecordV1, callIndex: number) => FedosBoardOutboxPublishResult;
}

/**
 * In-memory `FedosBoardOutboxPublisher` for tests and local prototypes
 * ONLY. Performs NO network, signing, or Relay call of any kind — it
 * only records calls and returns caller-scripted results, mirroring
 * `MockRelayPublisher`'s own documented role (`../../nostr/publish.ts`).
 */
export class MockFedosBoardOutboxPublisher implements FedosBoardOutboxPublisher {
  readonly #results: readonly FedosBoardOutboxPublishResult[];
  readonly #next?: MockFedosBoardOutboxPublisherOptions["next"];
  readonly #calls: FedosPersistedBoardOutboxRecordV1[] = [];

  constructor(options: MockFedosBoardOutboxPublisherOptions = {}) {
    this.#results = options.results ?? [];
    this.#next = options.next;
  }

  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    const callIndex = this.#calls.length;
    this.#calls.push(record);
    const scripted = this.#results[callIndex];
    if (scripted !== undefined) {
      return scripted;
    }
    if (this.#next !== undefined) {
      return this.#next(record, callIndex);
    }
    return { outcome: "delivered", retryPolicy: "never" };
  }

  /** Fresh array each call — caller mutation cannot affect internal state. */
  get calls(): readonly FedosPersistedBoardOutboxRecordV1[] {
    return [...this.#calls];
  }
}
