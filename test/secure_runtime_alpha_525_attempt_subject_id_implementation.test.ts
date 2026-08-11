import { describe, it, expect } from "vitest";
import {
  makeFedosDeliveryAttemptSubjectId,
  parseFedosDeliveryAttemptSubjectId,
} from "../src/os/messenger/board/observation/fedos_delivery_attempt_subject_id.js";
import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";

describe("Secure Runtime Alpha 525 -- Attempt Subject ID Implementation", () => {
  it("is deterministic: the same pair always yields the same id", () => {
    const original = toFedosDeliveryObservationSubjectId("post-1")!;
    expect(makeFedosDeliveryAttemptSubjectId(original, 3)).toBe(makeFedosDeliveryAttemptSubjectId(original, 3));
  });

  it("round-trips through parse", () => {
    const original = toFedosDeliveryObservationSubjectId("post-1")!;
    const attemptSubjectId = makeFedosDeliveryAttemptSubjectId(original, 5)!;
    expect(parseFedosDeliveryAttemptSubjectId(attemptSubjectId)).toEqual({
      originalSubjectId: original,
      attemptNumber: 5,
    });
  });

  it("round-trips correctly even when the original subject id itself contains '::' (Outbox-id-shaped subjects)", () => {
    const original = toFedosDeliveryObservationSubjectId("postId::nostr::wss://relay.example.test")!;
    const attemptSubjectId = makeFedosDeliveryAttemptSubjectId(original, 2)!;
    expect(parseFedosDeliveryAttemptSubjectId(attemptSubjectId)).toEqual({
      originalSubjectId: original,
      attemptNumber: 2,
    });
  });

  it("fails closed to null for a non-positive-integer attempt number, never throws", () => {
    const original = toFedosDeliveryObservationSubjectId("post-1")!;
    for (const bad of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => makeFedosDeliveryAttemptSubjectId(original, bad)).not.toThrow();
      expect(makeFedosDeliveryAttemptSubjectId(original, bad)).toBeNull();
    }
  });

  it("parse fails closed to null for a non-attempt-shaped subject id", () => {
    const original = toFedosDeliveryObservationSubjectId("post-1")!;
    expect(parseFedosDeliveryAttemptSubjectId(original)).toBeNull();
    expect(parseFedosDeliveryAttemptSubjectId(toFedosDeliveryObservationSubjectId("post-1::attempt::abc")!)).toBeNull();
  });

  it("different attempt numbers for the same original subject produce different ids", () => {
    const original = toFedosDeliveryObservationSubjectId("post-1")!;
    expect(makeFedosDeliveryAttemptSubjectId(original, 1)).not.toBe(makeFedosDeliveryAttemptSubjectId(original, 2));
  });
});
