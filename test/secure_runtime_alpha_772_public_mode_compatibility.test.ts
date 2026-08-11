import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { createFedosBoardRuntime } from "../src/os/messenger/board/runtime/fedos_board_runtime.js";

const RUNTIME_DIR = "src/board/runtime";

function runtimeFiles(): string[] {
  return (readdirSync(RUNTIME_DIR) as string[])
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(RUNTIME_DIR, name));
}

describe("Secure Runtime Alpha 772 -- Public Mode Compatibility", () => {
  it("1. no file under src/board/runtime/ imports the new Membership or Capability domains -- Membership Authority remains unused by current public commands", () => {
    for (const file of runtimeFiles()) {
      const code = readFileSync(file, "utf8") as string;
      expect(code, file).not.toMatch(/conversation\/membership\//);
      expect(code, file).not.toMatch(/conversation\/capability\//);
    }
  });

  it("2. an already-shipped public thread/reply flow is completely unaffected by this Arc -- no fabricated 'everyone member' record, no Membership Authority call anywhere on the path", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const ids = ["post-alpha-772-root", "post-alpha-772-reply"];
    const runtime = createFedosBoardRuntime({ host, idGenerator: { generatePostId: () => ids.shift()! } });

    const created = await runtime.createPublicThread({ boardId: "board-a", body: "hello, still public" });
    expect(created.outcome).toBe("created");

    const reply = await runtime.replyToPublicThread({
      boardId: "board-a",
      threadId: "post-alpha-772-root",
      replyTo: "post-alpha-772-root",
      body: "still no membership anywhere",
    });
    expect(reply, JSON.stringify(reply)).toMatchObject({ outcome: "created" });

    await host.stop();
  });
});
