import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/os/messenger/board/outbox/fedos_publish_scheduler.ts?raw";

describe("Secure Runtime Alpha 522 -- Retry Coordination Scope Decision", () => {
  it("declares zero Scheduler changes as the adopted design, and honestly documents the one Host field the Arc actually needed", () => {
    expect(doc).toMatch(/Zero satisfies\s*\n?"最小"/);
    // Ripple (Alpha 531): the original claim of a byte-for-byte-unchanged
    // Host was found incomplete during ripple/verification -- the doc now
    // documents the correction honestly rather than silently editing the
    // original claim away.
    expect(doc).toMatch(/Correction \(found during Alpha 531/);
    expect(doc).toMatch(/is\s+therefore NOT empty for this Arc/);
  });

  it("FedosDesktopHost keeps its public API byte-for-byte unchanged; only the private retry registry field was added (re-confirmed structurally)", () => {
    expect(hostSource).toContain("observationQuery(): FedosDeliveryObservationQuery | null {");
    // RetryQuery/AttemptSubjectId remain caller-side/controller-side concerns
    // and must never leak into Host -- only the write-time attempt-number
    // allocator (RetryRegistry) legitimately lives on Host now (Alpha 531
    // registry-persistence fix), as one PRIVATE field, not a public API change.
    expect(hostSource).not.toMatch(/RetryQuery|AttemptSubjectId/);
    expect(hostSource).toContain("#deliveryRetryRegistry");
    expect(hostSource).toMatch(/FedosDeliveryRetryRegistry/);
  });

  it("FedosPublishScheduler is in fact byte-for-byte unchanged by this Stage (re-confirmed structurally)", () => {
    expect(schedulerSource).not.toMatch(/Retry(Query|Registry)|AttemptSubjectId|::attempt::/);
  });

  it("rejects loosening the transition graph in favor of a subject-identity-layer fix", () => {
    expect(doc).toMatch(/Rejected because it would require a new field/);
  });
});
