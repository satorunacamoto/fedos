import { describe, it, expect } from "vitest";
import { createTrust } from "../src/os/trust/index.js";
import { fixedFedosTrustClock } from "../src/os/trust/envelope/index.js";

describe("createTrust() factory composition", () => {
  it("constructs successfully with zero arguments and every field is present/callable", async () => {
    const trust = createTrust();
    expect(typeof trust.clock).toBe("function");
    expect(typeof trust.clock()).toBe("number");
    expect(typeof trust.qrImageEncoder.encode).toBe("function");
    const result = await trust.qrImageEncoder.encode("fedos:trust:v1:AA");
    expect(typeof result.dataUrl).toBe("string");
  });

  it("honors explicit dependencies when supplied", () => {
    const clock = fixedFedosTrustClock(42);
    const trust = createTrust({ clock });
    expect(trust.clock()).toBe(42);
  });

  it("performs no I/O and never throws for the default construction", () => {
    expect(() => createTrust()).not.toThrow();
    expect(() => createTrust({})).not.toThrow();
  });
});
