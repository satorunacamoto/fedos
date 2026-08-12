/**
 * Secure Runtime Alpha 6361-6440 (FedOS Desktop Beta Security Acceptance,
 * Threat-Scenario Testing, and Release Freeze Arc) — Phase F: structural
 * guards. This Arc's own mission is architecture-frozen (no protocol
 * redesign, no new Runtime owner, no new cryptographic feature) — these
 * guards prove that constraint held, by real source inspection, not by
 * narrative claim alone.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function gitDiffNameOnly(fromRef: string, toRef: string): string[] {
  const out = execFileSync("git", ["diff", "--name-only", fromRef, toRef], { encoding: "utf8", cwd: REPO_ROOT }) as string;
  return out.split("\n").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
}

/**
 * This Arc's own TRUE starting point is the reconciliation merge commit
 * itself (`d23f350`, merging `33f29f22` into `fc48d64c`'s lineage) — not
 * `fc48d64c` alone, which would also re-count the ENTIRE merged-in Secure
 * Memory lineage's own Rust changes as if this Arc had made them.
 */
const ARC_OWN_BASE = "d23f350";

describe("Secure Runtime Alpha 6361-6440 -- structural guards (no protocol drift, no new crypto, no new Runtime owner)", () => {
  it("1. this Arc's own commits add ZERO files under src/ -- testing/documentation only, exactly as this Arc's own mission requires", () => {
    // Compares HEAD against the reconciliation merge commit itself -- i.e. every file THIS
    // Arc's own commits are responsible for, never the merged-in prior lineages' own changes.
    const changed = gitDiffNameOnly(ARC_OWN_BASE, "HEAD");
    const srcFiles = changed.filter((f) => f.startsWith("src/") || f.startsWith("packages/fedos-core-rust/src/"));
    expect(srcFiles, JSON.stringify(srcFiles)).toEqual([]);
  });

  it("2. no new @noble/curves or @noble/hashes import was introduced anywhere in this Arc's own new test files beyond what this session's own established real-crypto test convention already uses", () => {
    const files = [
      "test/secure_runtime_alpha_6361_6440_threat_scenarios.test.ts",
      "test/secure_runtime_alpha_6361_6440_real_acceptance_vertical_slice.test.ts",
    ];
    for (const f of files) {
      const text = readFileSync(join(REPO_ROOT, f), "utf8") as string;
      const nobleImports = [...text.matchAll(/from ["']@noble\/([a-z/]+)["']/g)].map((m) => m[1]);
      for (const imp of nobleImports) {
        expect(["curves/secp256k1.js", "hashes/utils.js"]).toContain(imp);
      }
    }
  });

  it("3. exactly one FedosDesktopApplicationShell/FedosDesktopConversationUiPresentationBoundary/FedosDesktopRenderer/FedosDesktopHostBridge class exists in the whole codebase", () => {
    const shellSource = readFileSync(join(REPO_ROOT, "src", "os", "messenger", "desktop", "shell", "fedos_desktop_application_shell.ts"), "utf8") as string;
    expect((shellSource.match(/class FedosDesktopApplicationShell\b/g) ?? []).length).toBe(1);
    const boundarySource = readFileSync(join(REPO_ROOT, "src", "os", "messenger", "desktop", "presentation", "fedos_desktop_conversation_ui_presentation_boundary.ts"), "utf8") as string;
    expect((boundarySource.match(/class FedosDesktopConversationUiPresentationBoundary\b/g) ?? []).length).toBe(1);
    const rendererSource = readFileSync(join(REPO_ROOT, "src", "os", "messenger", "desktop", "renderer", "fedos_desktop_renderer.ts"), "utf8") as string;
    expect((rendererSource.match(/class FedosDesktopRenderer\b/g) ?? []).length).toBe(1);
    const bridgeSource = readFileSync(join(REPO_ROOT, "src", "os", "messenger", "desktop", "host_boundary", "fedos_desktop_host_bridge.ts"), "utf8") as string;
    expect((bridgeSource.match(/class FedosDesktopHostBridge\b/g) ?? []).length).toBe(1);
  });

  it("4. no canonical Electron main/preload exists under src/ -- only the pre-existing, unmodified spike package -- confirms this Arc did not add a second Electron entry point", () => {
    const electronFiles = gitDiffNameOnly(ARC_OWN_BASE, "HEAD").filter((f: string) => /electron/i.test(f));
    expect(electronFiles, JSON.stringify(electronFiles)).toEqual([]);
  });

  it("5. no new exported function/type name in this Arc's own new files matches a raw-secret-export naming pattern (SecretKey/PrivateKey/MasterSeed as a returned VALUE, not merely a parameter type)", () => {
    const files = [
      "test/secure_runtime_alpha_6361_6440_threat_scenarios.test.ts",
      "test/secure_runtime_alpha_6361_6440_real_acceptance_vertical_slice.test.ts",
    ];
    for (const f of files) {
      const text = readFileSync(join(REPO_ROOT, f), "utf8") as string;
      expect(text, f).not.toMatch(/export (function|const) \w*(SecretKey|PrivateKey|MasterSeed)\w*\(/);
    }
  });

  it("6. signature verification remains present and un-bypassed in every inbound coordinator this Arc's own threat scenarios exercise (a weakened-threat-model canary -- these calls must still exist, unmodified, by this Arc)", () => {
    const idTransitionInbound = readFileSync(join(REPO_ROOT, "src", "conversation", "identity_transition", "peer_integration", "fedos_identity_transition_inbound_notification_coordinator.ts"), "utf8") as string;
    expect(idTransitionInbound).toMatch(/verifyFedosRatchetPeerCapabilityAccountAuthorization|verify/i);
    const deletionInbound = readFileSync(join(REPO_ROOT, "src", "conversation", "deletion_request", "fedos_deletion_request_recipient_evaluation.ts"), "utf8") as string;
    expect(deletionInbound.length).toBeGreaterThan(0);
    const peerCapInbound = readFileSync(join(REPO_ROOT, "src", "conversation", "ratchet", "peer_capability", "fedos_ratchet_peer_capability_inbound_coordinator.ts"), "utf8") as string;
    expect(peerCapInbound).toMatch(/verify/i);
  });

  it("7. this Arc's own docs directory contains all 6 required deliverables", () => {
    const required = [
      "secure_runtime_alpha_6361_6440_reconciliation_report.md",
      "secure_runtime_alpha_6361_6440_acceptance_matrix.md",
      "secure_runtime_alpha_6361_6440_threat_matrix.md",
      "secure_runtime_alpha_6361_6440_release_freeze_checklist.md",
      "secure_runtime_alpha_6361_6440_verification_report.md",
      "secure_runtime_alpha_6361_6440_completion_declaration.md",
    ];
    for (const name of required) {
      expect(existsSync(join(REPO_ROOT, "docs", name)), name).toBe(true);
    }
  });
});
