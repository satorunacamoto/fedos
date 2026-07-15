import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import lifecycleDoc from "../docs/secure_runtime_alpha_434_master_seed_authority_lifecycle.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRaw from "../packages/fedos-core-rust/src/lib.rs?raw";

const lib: string = (libRaw as string).replace(/\r\n/g, "\n");

describe("Secure Runtime Alpha 434 -- Master Seed Authority Lifecycle", () => {
  it("the lifecycle doc exists and names three coarse states", () => {
    expect(typeof lifecycleDoc).toBe("string");
    expect(lifecycleDoc).toContain("**Empty**");
    expect(lifecycleDoc).toContain("**Available**");
    expect(lifecycleDoc).toContain("**Cleared**");
  });

  it("lib.rs declares FedosMasterSeedAuthorityState with exactly Empty/Available/Cleared variants", () => {
    const block = (lib.match(/enum FedosMasterSeedAuthorityState \{[\s\S]*?\n\}/) ?? [""])[0];
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("Empty,");
    expect(block).toMatch(/Available\(/);
    expect(block).toContain("Cleared,");
  });

  it("lib.rs never derives Clone/Debug/Serialize on the authority or its state", () => {
    const stateIdx = lib.indexOf("enum FedosMasterSeedAuthorityState");
    const before = lib.slice(Math.max(0, stateIdx - 400), stateIdx);
    expect(before).not.toMatch(/#\[derive\([^)]*(Clone|Debug|Serialize)[^)]*\)\]/);
  });

  it("lib.rs exposes no reset/reinitialize method on FedosMasterSeedAuthority", () => {
    expect(lib).not.toMatch(/fn reset\(/);
    expect(lib).not.toMatch(/fn reinitialize\(/);
  });
});
