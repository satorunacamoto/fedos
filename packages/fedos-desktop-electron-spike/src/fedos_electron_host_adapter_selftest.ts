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

  // Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-
  // Device Aggregation and User Consent UI Arc) -- proves the REAL
  // Renderer -> Preload -> IPC -> Main -> FedosDesktopHostBridge round trip
  // for this Arc's own new deletion-request commands, through the SAME
  // existing, unmodified, generic `window.fedos.invoke()` transport (no new
  // Electron entry point). This spike's own minimal `hostRuntimeConfig()`
  // does not wire `conversationDeletionRequest` -- an honest `"unavailable"`
  // response is therefore the REAL, non-fabricated outcome, exactly like
  // this SAME adapter's own pre-existing `"device-status"` command already
  // always reports.
  const deletionListReceivedResult = await window.fedos.invoke({ op: "dispatch", command: { type: "deletion-request-list-received", requestId: "selftest-deletion-list-received" } });
  logStep("dispatch-deletion-request-list-received", deletionListReceivedResult);

  const deletionListSentResult = await window.fedos.invoke({
    op: "dispatch",
    command: { type: "deletion-request-list-sent", conversationId: "selftest-conv", targetEnvelopeId: "selftest-env", knownDeviceIds: [], requestId: "selftest-deletion-list-sent" },
  });
  logStep("dispatch-deletion-request-list-sent", deletionListSentResult);

  const deletionStatusResult = await window.fedos.invoke({ op: "dispatch", command: { type: "deletion-request-status", deletionRequestId: "selftest-request-id", requestId: "selftest-deletion-status" } });
  logStep("dispatch-deletion-request-status", deletionStatusResult);

  const deletionApproveResult = await window.fedos.invoke({ op: "dispatch", command: { type: "deletion-request-approve", deletionRequestId: "selftest-request-id", requestId: "selftest-deletion-approve" } });
  logStep("dispatch-deletion-request-approve", deletionApproveResult);

  const renderResult = await window.fedos.invoke({ op: "render" });
  logStep("render", renderResult);

  const invalidOpResult = await window.fedos.invoke({ op: "not-a-real-op" });
  logStep("invalid-op", invalidOpResult);

  console.log(`${MARKER}done`);
}

void runSelfTest();
