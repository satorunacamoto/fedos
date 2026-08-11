import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_473_publisher_interface_model.md?raw";
import {
  isValidFedosBoardOutboxPublishResult,
  MockFedosBoardOutboxPublisher,
} from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 473 -- "Publisher Interface Model": Stage 3 of
 * the Alpha 471-480 Canonical Publish Scheduler Foundation Arc.
 */
describe("Secure Runtime Alpha 473 -- Publisher Interface Model", () => {
  const postId = toFedosBoardPostId("post-1")!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1_700_000_000)!;
  const record = serializeFedosBoardOutboxIntent(intent);

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc adopts a new, generic FedosBoardOutboxPublisher port (Option C)", () => {
    expect(designDocSource).toMatch(/ADOPTED\.\s*\n\n## 2\. Why a structured result/);
  });

  it("3. the design doc rejects reusing RelayPublisher directly", () => {
    expect(designDocSource).toMatch(/REJECTED:\s*\n\s*`RelayPublisher\.publish\(event\)`/);
  });

  it("4. isValidFedosBoardOutboxPublishResult accepts every valid outcome/retryPolicy combination", () => {
    const outcomes = ["delivered", "rejected", "failed"];
    const policies = ["immediate", "later", "never"];
    for (const outcome of outcomes) {
      for (const retryPolicy of policies) {
        expect(isValidFedosBoardOutboxPublishResult({ outcome, retryPolicy })).toBe(true);
      }
    }
  });

  it("5. isValidFedosBoardOutboxPublishResult rejects malformed shapes -- fails closed", () => {
    expect(isValidFedosBoardOutboxPublishResult(null)).toBe(false);
    expect(isValidFedosBoardOutboxPublishResult(undefined)).toBe(false);
    expect(isValidFedosBoardOutboxPublishResult({})).toBe(false);
    expect(isValidFedosBoardOutboxPublishResult({ outcome: "success", retryPolicy: "never" })).toBe(false);
    expect(isValidFedosBoardOutboxPublishResult({ outcome: "delivered", retryPolicy: "exponential" })).toBe(false);
    expect(isValidFedosBoardOutboxPublishResult({ outcome: "delivered", retryPolicy: "never", reason: 5 })).toBe(
      false,
    );
    expect(isValidFedosBoardOutboxPublishResult("delivered")).toBe(false);
  });

  it("6. MockFedosBoardOutboxPublisher defaults to delivered/never and never performs real I/O", () => {
    const publisher = new MockFedosBoardOutboxPublisher();
    return publisher.publish(record).then((result) => {
      expect(result).toEqual({ outcome: "delivered", retryPolicy: "never" });
      expect(publisher.calls).toEqual([record]);
    });
  });

  it("7. MockFedosBoardOutboxPublisher plays back scripted results in order, then falls back to delivered", async () => {
    const publisher = new MockFedosBoardOutboxPublisher({
      results: [
        { outcome: "failed", retryPolicy: "immediate" },
        { outcome: "rejected", retryPolicy: "never" },
      ],
    });
    expect(await publisher.publish(record)).toEqual({ outcome: "failed", retryPolicy: "immediate" });
    expect(await publisher.publish(record)).toEqual({ outcome: "rejected", retryPolicy: "never" });
    expect(await publisher.publish(record)).toEqual({ outcome: "delivered", retryPolicy: "never" });
  });

  it("8. MockFedosBoardOutboxPublisher.calls returns a fresh array each call", () => {
    const publisher = new MockFedosBoardOutboxPublisher();
    const first = publisher.calls as unknown[];
    first.push("intruder");
    expect(publisher.calls).toEqual([]);
  });

  it("9. exposes exactly publish() on FedosBoardOutboxPublisher's own concrete Mock -- no retry/backoff method", () => {
    const publisher = new MockFedosBoardOutboxPublisher();
    const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(publisher)).filter(
      (name) => name !== "constructor" && name !== "calls",
    );
    expect(publicMethods).toEqual(["publish"]);
  });
});
