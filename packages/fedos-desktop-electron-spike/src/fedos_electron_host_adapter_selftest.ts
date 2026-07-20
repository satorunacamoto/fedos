/**
 * Secure Runtime Alpha 4101-4180 -- self-test page script (Phase F).
 *
 * Runs inside the loaded page itself (an isolated Chromium page context,
 * NOT the preload/Node context) -- has NO import of any kind. Calls the
 * ONE exposed `window.fedos.invoke()` API with a small, fixed sequence of
 * real requests and logs each JSON result via `console.log`, prefixed
 * with a marker Main forwards to its own stdout
 * (`fedos_electron_host_adapter_main.cts`'s own "SELFTEST_MARKER"
 * forwarding, test-support only). This is a TRANSPORT proof harness for
 * this Arc's own real acceptance tests -- it renders no Conversation/
 * Device/business UI of any kind (the real UI is the explicitly preferred
 * NEXT Arc, "Desktop Conversation Window Renderer and Navigation Arc").
 *
 * Plain script (not a module): TypeScript emits this file as un-wrapped
 * global-scope JS, loaded via a plain `<script src="...">` tag, no bundler.
 */

const MARKER = "FEDOS_ELECTRON_ADAPTER_TEST:";

function logStep(step: string, result: unknown): void {
  console.log(`${MARKER}${JSON.stringify({ step, result })}`);
}

async function runSelfTest(): Promise<void> {
  const statusResult = await window.fedos.invoke({ op: "status" });
  logStep("status", statusResult);

  const runtimeStatusResult = await window.fedos.invoke({ op: "dispatch", command: { type: "runtime-status", requestId: "selftest-runtime-status" } });
  logStep("dispatch-runtime-status", runtimeStatusResult);

  const unknownCommandResult = await window.fedos.invoke({ op: "dispatch", command: { type: "not-a-real-command" } });
  logStep("dispatch-unknown-command", unknownCommandResult);

  const renderResult = await window.fedos.invoke({ op: "render" });
  logStep("render", renderResult);

  const invalidOpResult = await window.fedos.invoke({ op: "not-a-real-op" });
  logStep("invalid-op", invalidOpResult);

  console.log(`${MARKER}done`);
}

void runSelfTest();
