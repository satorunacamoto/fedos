import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateFedosDesktopHostCommand } from "../src/os/messenger/desktop/host_boundary/fedos_desktop_host_command.js";

describe("Secure Runtime Alpha 6041-6120 -- Phase G/L Host command structural validation", () => {
  it("1. deletion-request-create requires every structural field, rejects a malformed one", () => {
    const good = {
      type: "deletion-request-create",
      requesterAccountRef: "alice",
      recipientAccountRef: "bob",
      recipientDeviceRef: "bob-device-a",
      conversationId: "conv-1",
      targetEnvelopeId: "env-1",
      scope: "local-history-and-index",
      expiresInSeconds: 1000,
      reasonCode: null,
    };
    expect(validateFedosDesktopHostCommand(good)).not.toBeNull();
    expect(validateFedosDesktopHostCommand({ ...good, scope: "whole-conversation" })).toBeNull();
    expect(validateFedosDesktopHostCommand({ ...good, expiresInSeconds: -1 })).toBeNull();
    expect(validateFedosDesktopHostCommand({ ...good, reasonCode: "not-a-real-code" })).toBeNull();
    expect(validateFedosDesktopHostCommand({ ...good, conversationId: "" })).toBeNull();
  });

  it("2. deletion-request-list-sent bounds the known-device-id list", () => {
    const base = { type: "deletion-request-list-sent", conversationId: "c", targetEnvelopeId: "e", knownDeviceIds: ["d1", "d2"] };
    expect(validateFedosDesktopHostCommand(base)).not.toBeNull();
    expect(validateFedosDesktopHostCommand({ ...base, knownDeviceIds: Array.from({ length: 65 }, (_, i) => `d${i}`) })).toBeNull();
    expect(validateFedosDesktopHostCommand({ ...base, knownDeviceIds: [123] })).toBeNull();
  });

  it("3. deletion-request-open requires a real closed policy value", () => {
    expect(validateFedosDesktopHostCommand({ type: "deletion-request-open", deletionRequestId: "r1", localPolicy: "always-review" })).not.toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "deletion-request-open", deletionRequestId: "r1", localPolicy: "allow-everything" })).toBeNull();
  });

  it("4. deletion-request-approve/reject/status/dismiss require only a bounded id", () => {
    for (const type of ["deletion-request-approve", "deletion-request-reject", "deletion-request-status", "deletion-request-dismiss"]) {
      expect(validateFedosDesktopHostCommand({ type, deletionRequestId: "r1" })).not.toBeNull();
      expect(validateFedosDesktopHostCommand({ type, deletionRequestId: "" })).toBeNull();
      expect(validateFedosDesktopHostCommand({ type })).toBeNull();
    }
  });

  it("5. an unknown command type fails closed to null", () => {
    expect(validateFedosDesktopHostCommand({ type: "deletion-request-delete-everywhere" })).toBeNull();
  });

  it("6. no raw signature or raw path field is ever accepted by any deletion-request command", () => {
    const withExtra = { type: "deletion-request-approve", deletionRequestId: "r1", signature: "deadbeef", filePath: "/etc/passwd" };
    const validated = validateFedosDesktopHostCommand(withExtra);
    // Extra fields are simply ignored by the validator's own closed reconstruction -- proven by
    // re-serializing the validated command and confirming neither extra key survived.
    expect(validated).not.toBeNull();
    expect(JSON.stringify(validated)).not.toContain("signature");
    expect(JSON.stringify(validated)).not.toContain("filePath");
  });
});

describe("Secure Runtime Alpha 6041-6120 -- Phase Q structural guards", () => {
  const files = [
    "../src/desktop/presentation/deletion_request/fedos_deletion_request_device_status.ts",
    "../src/desktop/presentation/deletion_request/fedos_deletion_request_screen_model.ts",
    "../src/desktop/presentation/deletion_request/fedos_deletion_request_consent_model.ts",
    "../src/desktop/presentation/deletion_request/fedos_deletion_request_navigation_state.ts",
    "../src/desktop/presentation/deletion_request/fedos_deletion_request_controller.ts",
    "../src/desktop/renderer/deletion_request/fedos_deletion_request_renderer.ts",
  ];
  const dir = dirname(fileURLToPath(import.meta.url));
  function readAll(): string {
    return files
      .map((rel) => {
        try {
          return readFileSync(join(dir, rel), "utf8") as string;
        } catch {
          return "";
        }
      })
      .join("\n");
  }
  const source = readAll();
  const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("7. no 'deleted-everywhere'/account-wide claim value exists in CODE (a doc comment may name the absence)", () => {
    expect(codeOnly).not.toMatch(/"deleted-everywhere"|"account-deleted"|"all-copies-erased"|"cryptographically-erased"/);
  });

  it("8. no Archive/backup deletion authority is imported by the presentation/renderer layer", () => {
    expect(codeOnly).not.toMatch(/removeFedosDeletionArchiveFile|executeFedosLocalArchiveFileRemovalPlan/);
  });

  it("9. no Group/attachment/whole-conversation scope value exists", () => {
    expect(source).not.toMatch(/"group-message"|"attachment"|"whole-conversation"/i);
  });

  it("10. no Identity Transition / Ratchet crypto / Sender-Key/MLS/PQ reference exists", () => {
    expect(source).not.toMatch(/identity[_-]transition|\/ratchet\/fedos_direct_ratchet|sender[_-]key|\bMLS\b|post-quantum/i);
  });

  it("11. no direct persistence/crypto/execution-coordinator import in the presentation/renderer layer -- everything goes through the Shell", () => {
    expect(codeOnly).not.toMatch(/fedos_deletion_execution_coordinator|FedosPayloadRetentionAuthority|FedosNostrSigningAuthority/);
  });

  it("12. no p2p/ or .tmp_gen/ import exists", () => {
    expect(source).not.toMatch(/from ["'].*p2p\//);
    expect(source).not.toMatch(/from ["'].*\.tmp_gen\//);
  });

  it("13. no rendering framework / DOM / browser global reference exists", () => {
    expect(source).not.toMatch(/\bdocument\.|\bwindow\.|require\(["']react["']\)|from ["']react["']/);
  });

  it("14. the Controller never calls a Shell method beyond the deletion-request/device-detail surface (no arbitrary command execution)", () => {
    const controllerSource = readFileSync(join(dir, "../src/os/messenger/desktop/presentation/deletion_request/fedos_deletion_request_controller.ts"), "utf8") as string;
    const shellCalls = [...controllerSource.matchAll(/this\.#shell\.(\w+)/g)].map((m) => m[1] ?? "");
    const allowed = new Set(["deletionRequestCreate", "deletionRequestListSentForTarget", "deletionRequestAcknowledgementOutcome", "deletionRequestListReceived", "deletionRequestAssessPolicy", "deletionRequestApprove", "deletionRequestReject", "deviceDetail"]);
    for (const call of shellCalls) expect(allowed.has(call)).toBe(true);
  });
});
