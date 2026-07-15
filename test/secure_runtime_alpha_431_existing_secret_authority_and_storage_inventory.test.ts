import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inventoryDoc from "../docs/secure_runtime_alpha_431_existing_secret_authority_and_storage_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoToml from "../packages/fedos-core-rust/Cargo.toml?raw";

describe("Secure Runtime Alpha 431 -- Existing Secret Authority and Storage Inventory", () => {
  it("the inventory doc exists and is substantial", () => {
    expect(typeof inventoryDoc).toBe("string");
    expect(inventoryDoc.length).toBeGreaterThan(1500);
  });

  it("answers all twelve inventory questions this Stage's own instruction poses", () => {
    for (let n = 1; n <= 12; n++) {
      expect(inventoryDoc).toMatch(new RegExp(`^${n}\\.\\s`, "m"));
    }
  });

  it("confirms argon2 and getrandom are already production dependencies (no new Cargo dependency needed)", () => {
    expect(cargoToml).toMatch(/^argon2 = /m);
    expect(cargoToml).toMatch(/^getrandom = /m);
    expect(inventoryDoc).toContain("argon2");
  });

  it("confirms no real Master Seed constructor exists in production code before this Arc", () => {
    expect(inventoryDoc).toMatch(/No real Master Seed constructor exists/);
  });
});
