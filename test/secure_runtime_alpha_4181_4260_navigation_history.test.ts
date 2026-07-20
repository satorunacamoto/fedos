/**
 * Secure Runtime Alpha 4181-4260 — Phase C: Navigation History (back/
 * forward stacks) — pure unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  fedosNavigationHistoryBack,
  fedosNavigationHistoryCanGoBack,
  fedosNavigationHistoryCanGoForward,
  fedosNavigationHistoryEmpty,
  fedosNavigationHistoryForward,
  fedosNavigationHistoryPush,
} from "../src/desktop/navigation/fedos_desktop_conversation_navigation_history.js";

describe("Alpha 4181-4260 -- Navigation History: push/back/forward", () => {
  it("starts empty: current null, no back, no forward", () => {
    const h = fedosNavigationHistoryEmpty();
    expect(h).toEqual({ current: null, back: [], forward: [] });
    expect(fedosNavigationHistoryCanGoBack(h)).toBe(false);
    expect(fedosNavigationHistoryCanGoForward(h)).toBe(false);
  });

  it("push records the prior current onto back and sets the new current", () => {
    let h = fedosNavigationHistoryEmpty();
    h = fedosNavigationHistoryPush(h, "c1");
    expect(h).toEqual({ current: "c1", back: [null], forward: [] });
    h = fedosNavigationHistoryPush(h, "c2");
    expect(h).toEqual({ current: "c2", back: [null, "c1"], forward: [] });
  });

  it("push to the SAME id as current is still a recorded, distinct navigation", () => {
    let h = fedosNavigationHistoryPush(fedosNavigationHistoryEmpty(), "c1");
    h = fedosNavigationHistoryPush(h, "c1");
    expect(h).toEqual({ current: "c1", back: [null, "c1"], forward: [] });
  });

  it("push clears any existing forward stack", () => {
    let h = fedosNavigationHistoryPush(fedosNavigationHistoryEmpty(), "c1");
    h = fedosNavigationHistoryPush(h, "c2");
    const back = fedosNavigationHistoryBack(h)!;
    expect(back.forward).toEqual(["c2"]);
    const pushed = fedosNavigationHistoryPush(back, "c3");
    expect(pushed).toEqual({ current: "c3", back: [null, "c1"], forward: [] });
  });

  it("back()/forward() are exact inverses and return null (no-op) at the ends", () => {
    let h = fedosNavigationHistoryEmpty();
    expect(fedosNavigationHistoryBack(h)).toBeNull();
    h = fedosNavigationHistoryPush(h, "c1");
    h = fedosNavigationHistoryPush(h, "c2");
    h = fedosNavigationHistoryPush(h, "c3");
    expect(fedosNavigationHistoryCanGoForward(h)).toBe(false);

    const back1 = fedosNavigationHistoryBack(h)!;
    expect(back1.current).toBe("c2");
    const back2 = fedosNavigationHistoryBack(back1)!;
    expect(back2.current).toBe("c1");
    const back3 = fedosNavigationHistoryBack(back2)!;
    expect(back3.current).toBeNull();
    expect(fedosNavigationHistoryCanGoBack(back3)).toBe(false);
    expect(fedosNavigationHistoryBack(back3)).toBeNull();

    const fwd1 = fedosNavigationHistoryForward(back3)!;
    expect(fwd1.current).toBe("c1");
    const fwd2 = fedosNavigationHistoryForward(fwd1)!;
    expect(fwd2.current).toBe("c2");
    const fwd3 = fedosNavigationHistoryForward(fwd2)!;
    expect(fwd3.current).toBe("c3");
    expect(fedosNavigationHistoryCanGoForward(fwd3)).toBe(false);
    expect(fedosNavigationHistoryForward(fwd3)).toBeNull();
    expect(fwd3).toEqual(h);
  });

  it("every value is frozen and no method mutates its receiver", () => {
    const h1 = fedosNavigationHistoryEmpty();
    expect(Object.isFrozen(h1)).toBe(true);
    const h2 = fedosNavigationHistoryPush(h1, "c1");
    expect(h1).toEqual({ current: null, back: [], forward: [] });
    expect(Object.isFrozen(h2)).toBe(true);
    expect(Object.isFrozen(h2.back)).toBe(true);
    expect(Object.isFrozen(h2.forward)).toBe(true);
  });
});
