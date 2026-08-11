import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { validateFedosDesktopHostCommand } from "../src/os/messenger/desktop/host_boundary/fedos_desktop_host_command.js";

declare const process: { cwd(): string };

const ACCOUNT_REF = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
const TRANSITION_ID = "fedos-identity-transition-" + "0".repeat(32);

describe("Secure Runtime Alpha 6121-6200 -- Phase K Host command structural validation", () => {
  it("1. identity-transition-list requires non-negative integer limit/offset", () => {
    expect(validateFedosDesktopHostCommand({ type: "identity-transition-list", limit: 10, offset: 0 })).not.toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "identity-transition-list", limit: -1, offset: 0 })).toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "identity-transition-list", limit: 1.5, offset: 0 })).toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "identity-transition-list", limit: 10 })).toBeNull();
  });

  it("2. identity-transition-open/inspect-evidence/accept/reject/defer/status all require a real account ref + bounded device/transition ids", () => {
    for (const type of [
      "identity-transition-open",
      "identity-transition-inspect-evidence",
      "identity-transition-accept",
      "identity-transition-reject",
      "identity-transition-defer",
      "identity-transition-status",
    ]) {
      const good = { type, peerAccountRef: ACCOUNT_REF, peerDeviceRef: "device-1", transitionId: TRANSITION_ID };
      expect(validateFedosDesktopHostCommand(good)).not.toBeNull();
      expect(validateFedosDesktopHostCommand({ ...good, peerAccountRef: { authority: "nostr" } })).toBeNull();
      expect(validateFedosDesktopHostCommand({ ...good, peerDeviceRef: "" })).toBeNull();
      expect(validateFedosDesktopHostCommand({ ...good, transitionId: "" })).toBeNull();
      expect(validateFedosDesktopHostCommand({ type })).toBeNull();
    }
  });

  it("3. identity-transition-record-manual-verification requires a known method and note code", () => {
    const good = { type: "identity-transition-record-manual-verification", transitionId: TRANSITION_ID, method: "safety-number-comparison", verifiedAt: 1000, noteCode: "confirmed-match" };
    expect(validateFedosDesktopHostCommand(good)).not.toBeNull();
    expect(validateFedosDesktopHostCommand({ ...good, method: "smoke-signal" })).toBeNull();
    expect(validateFedosDesktopHostCommand({ ...good, noteCode: "not-a-real-code" })).toBeNull();
    expect(validateFedosDesktopHostCommand({ ...good, verifiedAt: "yesterday" })).toBeNull();
  });

  it("4. identity-transition-assess-continuity bounds the pair list and requires bounded ids", () => {
    const base = { type: "identity-transition-assess-continuity", pairs: [{ conversationId: "c1", remoteDeviceRef: "d1" }] };
    expect(validateFedosDesktopHostCommand(base)).not.toBeNull();
    expect(
      validateFedosDesktopHostCommand({ type: "identity-transition-assess-continuity", pairs: Array.from({ length: 65 }, () => ({ conversationId: "c", remoteDeviceRef: "d" })) }),
    ).toBeNull();
    expect(validateFedosDesktopHostCommand({ type: "identity-transition-assess-continuity", pairs: [{ conversationId: "c1" }] })).toBeNull();
  });

  it("5. identity-transition-authorize-ratchet-reset requires a known acceptance state and well-formed affected-session list", () => {
    const good = {
      type: "identity-transition-authorize-ratchet-reset",
      transitionId: TRANSITION_ID,
      acceptanceState: "accepted",
      affectedSessions: [{ sessionId: "s1", conversationId: "c1", remoteAccountRef: ACCOUNT_REF, remoteDeviceRef: "d1" }],
    };
    expect(validateFedosDesktopHostCommand(good)).not.toBeNull();
    expect(validateFedosDesktopHostCommand({ ...good, acceptanceState: "super-trusted" })).toBeNull();
    expect(validateFedosDesktopHostCommand({ ...good, affectedSessions: [{ sessionId: "s1" }] })).toBeNull();
    expect(
      validateFedosDesktopHostCommand({
        ...good,
        affectedSessions: Array.from({ length: 65 }, () => ({ sessionId: "s", conversationId: "c", remoteAccountRef: ACCOUNT_REF, remoteDeviceRef: "d" })),
      }),
    ).toBeNull();
  });

  it("6. an unknown command type fails closed to null", () => {
    expect(validateFedosDesktopHostCommand({ type: "identity-transition-delete-everywhere" })).toBeNull();
  });

  it("7. no raw signature or raw path field is ever accepted by any identity-transition command", () => {
    const withExtra = {
      type: "identity-transition-status",
      peerAccountRef: ACCOUNT_REF,
      peerDeviceRef: "device-1",
      transitionId: TRANSITION_ID,
      signature: "deadbeef",
      filePath: "/etc/passwd",
    };
    const validated = validateFedosDesktopHostCommand(withExtra);
    expect(validated).not.toBeNull();
    expect(JSON.stringify(validated)).not.toContain("signature");
    expect(JSON.stringify(validated)).not.toContain("filePath");
  });

  it("8. requestId is echoed back only when supplied", () => {
    const withId = validateFedosDesktopHostCommand({ type: "identity-transition-list", limit: 1, offset: 0, requestId: "r-1" });
    expect((withId as any)?.requestId).toBe("r-1");
    const withoutId = validateFedosDesktopHostCommand({ type: "identity-transition-list", limit: 1, offset: 0 });
    expect((withoutId as any)?.requestId).toBeUndefined();
  });
});

describe("Secure Runtime Alpha 6121-6200 -- Phase T structural guards", () => {
  function collectTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir) as string[]) {
      const full = join(dir, entry);
      if ((entry as string).endsWith(".ts")) {
        out.push(full);
        continue;
      }
      try {
        out.push(...collectTsFiles(full));
      } catch {
        /* not a directory */
      }
    }
    return out;
  }

  it("the identity_transition Presentation/Renderer subtrees import nothing from archive/search/membership/electron", () => {
    const dirs = [
      join(process.cwd(), "src", "os", "messenger", "desktop", "presentation", "identity_transition"),
      join(process.cwd(), "src", "os", "messenger", "desktop", "renderer", "identity_transition"),
    ];
    const forbidden = [/\/archive\//, /\/search\//, /fedos_conversation_membership/, /electron/i];
    for (const dir of dirs) {
      for (const file of collectTsFiles(dir)) {
        const source = readFileSync(file, "utf8") as string;
        const importLines = source.split("\n").filter((line) => line.trim().startsWith("import"));
        for (const pattern of forbidden) {
          for (const line of importLines) {
            expect(pattern.test(line), `${file} imports something matching ${pattern} in line: ${line}`).toBe(false);
          }
        }
      }
    }
  });

  it("neither Presentation nor Renderer file performs any cryptographic verification (no @noble import)", () => {
    const dirs = [
      join(process.cwd(), "src", "os", "messenger", "desktop", "presentation", "identity_transition"),
      join(process.cwd(), "src", "os", "messenger", "desktop", "renderer", "identity_transition"),
    ];
    for (const dir of dirs) {
      for (const file of collectTsFiles(dir)) {
        const source = readFileSync(file, "utf8") as string;
        expect(source.includes("@noble")).toBe(false);
      }
    }
  });

  it("there is exactly one FedosDesktopApplicationShell, one Presentation Boundary, one Renderer aggregate, and one Host Bridge class in this codebase", () => {
    const shellFile = readFileSync(join(process.cwd(), "src", "os", "messenger", "desktop", "shell", "fedos_desktop_application_shell.ts"), "utf8") as string;
    expect((shellFile.match(/^export class FedosDesktopApplicationShell\b/m) ?? []).length).toBe(1);
    const boundaryFile = readFileSync(join(process.cwd(), "src", "os", "messenger", "desktop", "presentation", "fedos_desktop_conversation_ui_presentation_boundary.ts"), "utf8") as string;
    expect((boundaryFile.match(/^export class FedosDesktopConversationUiPresentationBoundary\b/m) ?? []).length).toBe(1);
    const rendererFile = readFileSync(join(process.cwd(), "src", "os", "messenger", "desktop", "renderer", "fedos_desktop_renderer.ts"), "utf8") as string;
    expect((rendererFile.match(/^export class FedosDesktopRenderer\b/m) ?? []).length).toBe(1);
    const bridgeFile = readFileSync(join(process.cwd(), "src", "os", "messenger", "desktop", "host_boundary", "fedos_desktop_host_bridge.ts"), "utf8") as string;
    expect((bridgeFile.match(/^export class FedosDesktopHostBridge\b/m) ?? []).length).toBe(1);
  });
});
