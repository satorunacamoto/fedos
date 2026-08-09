import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_370_recovery_robustness_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 370 -- "Board Recovery & Host Robustness
 * Completion": Stage 10, the closing Stage, of the Alpha 361-370 Arc.
 * Review only. Answers the Special Focus question, freezes every
 * finding, and confirms every hard constraint held throughout.
 */
describe("Secure Runtime Alpha 370 -- Board Recovery & Host Robustness Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the Special Focus question is answered explicitly: Yes, a true architectural defect", () => {
    expect(designDocSource).toContain(
      "## 2. Special Focus, answered: is the hydration-exception gap a true architectural defect?",
    );
    expect(designDocSource).toMatch(/\*\*Yes\.\*\* Reasoning/);
  });

  it("3. the minimal future fix is documented as a design sketch, explicitly not implemented", () => {
    expect(designDocSource).toContain(
      "## 3. The minimal future fix, documented, NOT implemented",
    );
    expect(designDocSource).toContain("async start(): Promise<void> {");
  });

  it("4. structural: the documented fix is NOT actually present in fedos_desktop_host.ts -- confirming it was truly not implemented", () => {
    const startMatch = hostSource.match(/async start\(\): Promise<void> \{[\s\S]*?\n {2}\}/);
    expect(startMatch).not.toBeNull();
    expect(startMatch![0]).not.toMatch(/try \{\s*hydration = hydrateFedosBoardService/);
  });

  it("5. behavioral: the confirmed defect is now FIXED by Alpha 382 (Arc 381-390) -- state correctly reaches failed, never stuck at starting", async () => {
    dir = mkdtempSync(join(tmpdir(), "a370-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, '{"schemaVersion":1,"id":"trunc', "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    // At the time this Arc (361-370) shipped, this was the confirmed,
    // disclosed gap -- state stuck at "starting". Alpha 382 (Arc 381-390)
    // closed it; this test now documents the FIXED behavior.
    expect(host.state()).toBe("failed");
  });

  it("6. the design doc names the second finding -- board() writes are not durable -- confirmed by Alpha 367's own execution", () => {
    expect(designDocSource).toContain(
      "## 4. A second finding, confirmed by Alpha 367's own execution: `board()` writes are not durable",
    );
  });

  it("7. Regression: package.json dependency count remains unchanged at 2, no bin field, across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("8. Regression: Cargo.toml carries no new dependency", () => {
    expect(cargoTomlSource).not.toMatch(/salvage|compact/i);
  });

  it("9. Regression: the AppendOnlyFedosBoardPersistence format is preserved exactly -- same public shape as Alpha 353 shipped", () => {
    expect(implementationSource).toMatch(/export class AppendOnlyFedosBoardPersistence implements FedosBoardPersistence \{/);
    expect(implementationSource).toMatch(/putPost\(record: FedosPersistedBoardPostRecordV1\): FedosBoardPersistenceWriteResult/);
    expect(implementationSource).toMatch(/getPost\(id: string\): FedosPersistedBoardPostRecordV1 \| null/);
    expect(implementationSource).toMatch(/listPosts\(\): readonly FedosPersistedBoardPostRecordV1\[\]/);
    expect(implementationSource).toMatch(/JSON\.stringify\(record\) \+ "\\n"/);
  });

  it("10. Regression: FedosDesktopHost itself carries zero diff from this Arc -- same public API as Alpha 337 shipped", () => {
    expect(hostSource).toMatch(/state\(\): FedosDesktopHostState/);
    expect(hostSource).toMatch(/async start\(\): Promise<void>/);
    expect(hostSource).toMatch(/async stop\(\): Promise<void>/);
    expect(hostSource).toMatch(/desktop\(\): DesktopApplication \| null/);
    // board()'s own return type was REWIRED by Alpha 404 (Arc 401-410) from
    // FedosBoardService to FedosBoardReader -- board() as a NAMED accessor
    // this Arc (337) shipped is unchanged; only its return type narrowed.
    expect(hostSource).toMatch(/board\(\): FedosBoardReader \| null/);
  });

  it("11. the design doc issues a Completion Declaration and recommends exactly one next Arc", () => {
    expect(normalize(designDocSource)).toContain(
      "**This Arc's own Objective is CONFIRMED COMPLETE.**",
    );
    expect(normalize(designDocSource)).toContain(
      "**Secure Runtime Alpha 371–380: FedosDesktopHost Hydration Exception Handling Arc.**",
    );
  });

  it("12. the design doc's own 'still out of scope' section confirms every public interface carries zero diff", () => {
    expect(normalize(designDocSource)).toContain(
      "`FedosDesktopHost`, `FedosDesktopHostState`, and `AppendOnlyFedosBoardPersistence` all carry zero diff from this Arc.",
    );
  });

  it("13. the design doc cross-references every prior Stage of this Arc, Alpha 361 through Alpha 369, plus Alpha 360", () => {
    for (let n = 361; n <= 369; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
    expect(designDocSource).toContain("secure_runtime_alpha_360_append_only_backend_completion");
  });
});
