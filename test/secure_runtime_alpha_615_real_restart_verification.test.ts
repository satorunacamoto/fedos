import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { makeFedosBoardOutboxId } from "../src/board/outbox/fedos_board_outbox_types.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryRetryQuery } from "../src/board/observation/fedos_delivery_retry_query.js";

/**
 * Secure Runtime Alpha 615 -- "Real Restart Verification": Stage 15
 * of the Alpha 601-620 Desktop Local Runtime Entry Point & Publish
 * Pipeline Ownership Arc. The ten-step scenario this Stage's own
 * instruction names, run against a real temporary directory, real
 * `AppendOnlyFedos*Persistence` backends, and two genuinely independent
 * `startFedosDesktopRuntime()` calls (no shared in-memory object of
 * any kind survives between them except the file paths themselves).
 */

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-615-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-615",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a615" },
    body: `body-${id}`,
    createdAt: 1_700_615_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

describe("Secure Runtime Alpha 615 -- Real Restart Verification", () => {
  it("1 runtime start -> 2 post submit -> 3 outbox queue -> 4 delivery attempt -> 5 stop -> 6 fresh runtime -> 7 hydrate -> 8 query -> 9 recovery state -> 10 duplicate delivery prevented", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.jsonl");
    const outboxLogPath = join(dir, "outbox.jsonl");
    const observationLogPath = join(dir, "observation.jsonl");

    // 1. runtime起動
    let firstRunCalls = 0;
    const firstPublisher: FedosBoardOutboxPublisher = {
      async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
        firstRunCalls++;
        // A tiny real delay -- avoids the Alpha 513/529 same-millisecond
        // started/terminal write tie-break (a real Publisher never
        // resolves in literally 0ms either).
        await new Promise((resolve) => setTimeout(resolve, 2));
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const firstRuntime = await startFedosDesktopRuntime({
      boardLogPath,
      outboxLogPath,
      observationLogPath,
      deliveryEnabled: true,
      deliveryIntervalMs: 5,
      publisher: firstPublisher,
    });
    expect(firstRuntime.host.state()).toBe("ready");

    // 2. post submit / 3. outbox queue
    const post = validateFedosBoardPost(rootInput("post-615"))!;
    const submitResult = firstRuntime.host.submitPostWithOutbox(post, [{ protocol: "nostr", destination: null }]);
    expect(submitResult.post).toBe("inserted");
    expect(submitResult.outbox).toHaveLength(1);

    // 4. delivery attempt
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(firstRunCalls).toBeGreaterThan(0);

    // 5. stop
    await firstRuntime.stop();

    // 6. fresh runtime instance -- a genuinely SEPARATE startFedosDesktopRuntime()
    // call, over the SAME three durable log paths, nothing else shared.
    let secondRunCalls = 0;
    const secondPublisher: FedosBoardOutboxPublisher = {
      async publish(): Promise<FedosBoardOutboxPublishResult> {
        secondRunCalls++;
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const secondRuntime = await startFedosDesktopRuntime({
      boardLogPath,
      outboxLogPath,
      observationLogPath,
      deliveryEnabled: true,
      deliveryIntervalMs: 5,
      publisher: secondPublisher,
    });

    // 7/8. hydrate + query -- the Board post itself recovers via the
    // pre-existing, unchanged hydrateFedosBoardService() path.
    expect(secondRuntime.host.board()!.findPost(post.id)).not.toBeNull();

    // 9. recovery state -- the delivery outcome recorded by the FIRST
    // runtime is visible through the SECOND runtime's own read boundary.
    const retryQuery = new FedosDeliveryRetryQuery(secondRuntime.host.observationQuery()!);
    const outboxId = makeFedosBoardOutboxId(post.id, submitResult.outbox[0]!.target);
    const subjectId = toFedosDeliveryObservationSubjectId(outboxId)!;
    const history = retryQuery.historyFor(subjectId);
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1]!.state).toBe("accepted");

    // 10. duplicate delivery prevention -- the SECOND runtime never
    // re-publishes the already-delivered intent.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(secondRunCalls).toBe(0);

    await secondRuntime.stop();
  });
});
