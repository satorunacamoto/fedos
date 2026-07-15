import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_502_host_dependency_extension_decision.md?raw";

describe("Secure Runtime Alpha 502 -- Host Dependency Extension Decision", () => {
  it("adopts exactly three new optional fields", () => {
    expect(doc).toMatch(/readonly publisher\?: FedosBoardOutboxPublisher;/);
    expect(doc).toMatch(/readonly observationRepository\?: FedosDeliveryObservationRepository;/);
    expect(doc).toMatch(/readonly deliveryIntervalMs\?: number;/);
  });

  it("explains why defaults live in the constructor, not createFedosDesktopHost()", () => {
    expect(doc).toMatch(/never in\s*\n?\s*`createFedosDesktopHost\(\)`/);
  });

  it("explicitly rejects adding a fifth, un-asked-for field", () => {
    expect(doc).toMatch(/No FIFTH field/);
  });
});
