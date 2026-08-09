import { describe, it, expect } from "vitest";
import {
  FEDOS_DELIVERY_OBSERVATION_TRANSITIONS,
  isAllowedFedosDeliveryObservationTransition,
} from "../src/board/observation/fedos_delivery_observation_transition_graph.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import source from "../src/os/messenger/board/observation/fedos_delivery_observation_transition_graph.ts?raw";

describe("Secure Runtime Alpha 494 -- State Transition Contract", () => {
  it("first observation: queued and publishing are legal, terminals are not", () => {
    expect(isAllowedFedosDeliveryObservationTransition(null, "queued")).toBe(true);
    expect(isAllowedFedosDeliveryObservationTransition(null, "publishing")).toBe(true);
    expect(isAllowedFedosDeliveryObservationTransition(null, "accepted")).toBe(false);
    expect(isAllowedFedosDeliveryObservationTransition(null, "rejected")).toBe(false);
    expect(isAllowedFedosDeliveryObservationTransition(null, "failed")).toBe(false);
  });

  it("queued -> publishing only", () => {
    expect(isAllowedFedosDeliveryObservationTransition("queued", "publishing")).toBe(true);
    expect(isAllowedFedosDeliveryObservationTransition("queued", "accepted")).toBe(false);
    expect(isAllowedFedosDeliveryObservationTransition("queued", "queued")).toBe(false);
  });

  it("publishing -> accepted|rejected|failed only", () => {
    for (const terminal of ["accepted", "rejected", "failed"] as const) {
      expect(isAllowedFedosDeliveryObservationTransition("publishing", terminal)).toBe(true);
    }
    expect(isAllowedFedosDeliveryObservationTransition("publishing", "queued")).toBe(false);
    expect(isAllowedFedosDeliveryObservationTransition("publishing", "publishing")).toBe(false);
  });

  it("every explicitly forbidden transition from the spec is rejected", () => {
    expect(isAllowedFedosDeliveryObservationTransition("accepted", "publishing")).toBe(false);
    expect(isAllowedFedosDeliveryObservationTransition("rejected", "accepted")).toBe(false);
    expect(isAllowedFedosDeliveryObservationTransition("failed", "accepted")).toBe(false);
    expect(isAllowedFedosDeliveryObservationTransition("queued", "accepted")).toBe(false);
  });

  it("no observation is ever legal after a terminal state (single-attempt model)", () => {
    for (const terminal of ["accepted", "rejected", "failed"] as const) {
      for (const next of ["queued", "publishing", "accepted", "rejected", "failed"] as const) {
        expect(isAllowedFedosDeliveryObservationTransition(terminal, next)).toBe(false);
      }
    }
  });

  it("the exported table is frozen and covers exactly the five states", () => {
    expect(Object.isFrozen(FEDOS_DELIVERY_OBSERVATION_TRANSITIONS)).toBe(true);
    expect(Object.keys(FEDOS_DELIVERY_OBSERVATION_TRANSITIONS).sort()).toEqual(
      ["accepted", "failed", "publishing", "queued", "rejected"],
    );
    for (const key of Object.keys(FEDOS_DELIVERY_OBSERVATION_TRANSITIONS)) {
      expect(
        Object.isFrozen(
          FEDOS_DELIVERY_OBSERVATION_TRANSITIONS[key as keyof typeof FEDOS_DELIVERY_OBSERVATION_TRANSITIONS],
        ),
      ).toBe(true);
    }
  });

  it("is pure -- no I/O, Repository, or Publisher reference in code", () => {
    const codeOnly = source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/Repository|Publisher|fetch\(|WebSocket/);
  });
});
