import { describe, it, expect } from "vitest";
import {
  FedosSecureRandomBoardRuntimeIdGenerator,
  type FedosBoardRuntimeIdGenerator,
} from "../src/os/messenger/board/runtime/fedos_board_runtime_id_generator.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 626 ("ID Authority Decision") -- Stage 6 of the
 * Alpha 621-640 Public Board Runtime Application API Foundation Arc.
 */
describe("Secure Runtime Alpha 626 -- ID Authority Decision", () => {
  it("1. generatePostId() returns a non-empty string brandable by toFedosBoardPostId()", () => {
    const generator = new FedosSecureRandomBoardRuntimeIdGenerator();
    const id = generator.generatePostId();
    expect(typeof id).toBe("string");
    expect(toFedosBoardPostId(id)).not.toBeNull();
  });

  it("2. two consecutive calls never collide (128 bits of entropy)", () => {
    const generator = new FedosSecureRandomBoardRuntimeIdGenerator();
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generator.generatePostId());
    }
    expect(ids.size).toBe(1000);
  });

  it("3. generatePostId() is a 32-character hex string (16 bytes hex-encoded)", () => {
    const generator = new FedosSecureRandomBoardRuntimeIdGenerator();
    const id = generator.generatePostId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("4. is a pure, injectable interface -- a test double can supply a deterministic id without any real entropy", () => {
    let callCount = 0;
    const deterministic: FedosBoardRuntimeIdGenerator = {
      generatePostId: () => `fixed-id-${++callCount}`,
    };
    expect(deterministic.generatePostId()).toBe("fixed-id-1");
    expect(deterministic.generatePostId()).toBe("fixed-id-2");
  });

  it("5. adds no new production dependency -- package.json still carries exactly two, unchanged", () => {
    const parsed = JSON.parse(packageJsonSource) as { dependencies: Record<string, string> };
    assertFedosRootDependencyInvariant(parsed.dependencies);
  });
});
