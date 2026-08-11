import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { StaticFedosPublicAuthorAuthority } from "../src/os/messenger/board/runtime/identity/static_fedos_public_author_authority.js";

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-677-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Secure Runtime Alpha 677 ("Outbound Verification") — Stage 7 of
 * Phase D of the Alpha 641-680 Arc. Safe Nostr author/signing key-
 * control matching is UNAVAILABLE anywhere in this codebase (Alpha
 * 649/665's own confirmed blocker) — this Stage therefore tests the
 * fail-closed behavior itself, through the REAL running Local Runtime,
 * rather than fabricating a successful outbound path.
 */
describe("Secure Runtime Alpha 677 -- Outbound Verification", () => {
  it("1. a real, resolved Nostr identity injected via publicAuthorAuthority still fails closed on an explicit Nostr target -- BoardRuntime never publishes directly, and delivery remains Scheduler-owned", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.ndjson"),
      outboxLogPath: join(dir, "outbox.ndjson"),
      deliveryEnabled: false,
      publicAuthorAuthority: new StaticFedosPublicAuthorAuthority({
        outcome: "resolved",
        author: { identityId: "id-677", protocol: "nostr", publicIdentifier: "npub1e677" },
      }),
    });

    const result = await runtime.boardRuntime().createPublicThread({
      boardId: "board-677",
      body: "attempted federation",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    // The post itself still durably writes (local semantics unaffected
    // by outbound eligibility) -- but the requested Nostr target is
    // "ineligible", not "inserted": no fabricated success.
    expect(result.outcome).toBe("outbox-partial-failure");
    if (result.outcome !== "outbox-partial-failure") throw new Error("unreachable");
    expect(result.outbox).toEqual([{ target: { protocol: "nostr", destination: null }, result: "ineligible" }]);

    await runtime.stop();
  });

  it("2. BoardRuntime itself never calls startDelivery() or a Publisher -- delivery remains an explicit, separate Host-owned action", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.ndjson"),
      outboxLogPath: join(dir, "outbox.ndjson"),
      deliveryEnabled: false,
    });

    await runtime.boardRuntime().createPublicThread({
      boardId: "b",
      body: "hi",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });

    // deliveryEnabled was false -- confirm the Host's own delivery
    // status agrees no delivery loop is running, proving BoardRuntime
    // did not implicitly start one.
    expect(runtime.host.deliveryStatus()).toEqual({ running: false });

    await runtime.stop();
  });
});
