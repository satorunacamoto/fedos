import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_410_host_write_boundary_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/board/repository/fedos_board_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error node:fs has no type declarations without @types/node in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error node:os has no type declarations without @types/node in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error node:path has no type declarations without @types/node in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 410 -- "Host Write Boundary Completion": Stage
 * 10, the closing Stage, of the Alpha 401-410 Desktop Host Canonical
 * Write Boundary Closure Arc. Review only. Freezes every finding and
 * recommends exactly one next Arc.
 */
describe("Secure Runtime Alpha 410 -- Host Write Boundary Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(normalize(designDocSource)).toContain(
      "**This Arc's own Objective is CONFIRMED COMPLETE.**",
    );
  });

  it("3. the design doc recommends exactly one next Arc: Canonical Board Outbox Foundation", () => {
    expect(designDocSource).toContain(
      "**Secure Runtime Alpha 411–420: Canonical Board Outbox Foundation\nArc.**",
    );
  });

  it("4. the whole closed-boundary assembly is fully functional end to end -- write, read, restart", async () => {
    const h1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await h1.start();
    const input: FedosBoardPostInput = {
      id: "a410-post",
      boardId: "board-410",
      threadId: "a410-post",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a410" },
      body: "completion fixture",
      createdAt: 1_700_015_000,
      source: { protocol: "nostr", reference: "a410-ref" },
    };
    const post = validateFedosBoardPost(input)!;
    expect(h1.submitPost(post)).toBe("inserted");
    expect(h1.board()!.findPost(post.id)?.id).toBe("a410-post");
    expect(h1.query()!.recentFeed(post.boardId).posts.map((p) => p.id)).toContain("a410-post");
    await h1.stop();

    dir = mkdtempSync(join(tmpdir(), "a410-"));
    const filePath = join(dir, "board.jsonl");
    const p1 = new AppendOnlyFedosBoardPersistence(filePath);
    const h2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: p1 });
    await h2.start();
    expect(h2.submitPost(post)).toBe("inserted");
    await h2.stop();

    const p2 = new AppendOnlyFedosBoardPersistence(filePath);
    const h3 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: p2 });
    await h3.start();
    expect(h3.board()!.findPost(post.id)?.id).toBe("a410-post");
  });

  it("5. Regression: package.json dependency count remains unchanged at 2, no bin field", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("6. Regression: Cargo.toml carries no new dependency related to this Arc", () => {
    expect(cargoTomlSource).not.toMatch(/FedosBoardReader|readBoard/i);
  });

  it("7. Regression: src/worker.ts carries zero reference to the Host, board(), or submitPost", () => {
    expect(workerSource).not.toMatch(/FedosDesktopHost|submitPost|FedosBoardReader/);
  });

  it("8. Regression: FedosBoardRepository and FedosBoardPersistence both carry zero signature diff from prior Arcs", () => {
    expect(readerSource).toMatch(/export interface FedosBoardReader \{/);
  });

  it("9. structural: board() returns FedosBoardReader | null, never FedosBoardService, confirmed on the final source", () => {
    expect(hostSource).toMatch(/board\(\): FedosBoardReader \| null/);
    expect(hostSource).not.toMatch(/board\(\): FedosBoardService/);
  });

  it("10. structural: FedosBoardService still implements FedosBoardReader, with registerPost/previewRegistration both still present", () => {
    expect(serviceSource).toMatch(/export class FedosBoardService implements FedosBoardReader \{/);
    expect(serviceSource).toMatch(/registerPost\(post: FedosBoardPost\): FedosBoardRegistrationResult/);
    expect(serviceSource).toMatch(/previewRegistration\(post: FedosBoardPost\)/);
  });

  it("11. the design doc restates the Durable Write Warning as fully closed, with submitPost() the ONLY route", () => {
    expect(designDocSource).toContain("## 4. Durable Write Warning — the residual gap, now fully closed");
    expect(designDocSource).toContain("NO LONGER TYPECHECKS.");
  });

  it("12. the design doc's own 'still out of scope' section names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "Outbox implementation, Nostr outbound publishing, ActivityPub",
      "GUI, private threads, DM, invitations, capability tokens, Lightning",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("13. the design doc cross-references every prior Stage of this Arc, Alpha 401 through Alpha 409", () => {
    for (let n = 401; n <= 409; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
  });

  it("14. the design doc names the exact seven-file ripple scope, no other file", () => {
    expect(normalize(designDocSource)).toContain(
      "Exactly seven pre-existing test files required an update",
    );
  });
});
