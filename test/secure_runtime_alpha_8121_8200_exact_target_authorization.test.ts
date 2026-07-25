import { describe, it, expect } from "vitest";
import { FedosIdentityTransitionController } from "../src/desktop/presentation/identity_transition/fedos_identity_transition_controller.js";
import { FedosDeletionRequestController } from "../src/desktop/presentation/deletion_request/fedos_deletion_request_controller.js";
import type { FedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 3 (external audit
 * delta `6873d24f`): "open A, open B before A's own await resolves, then
 * decide — which item is actually decided?" This is a real, precise
 * race-condition SHAPE this review named but could not test live from
 * source reading alone (its own §11 item 3, §7 fuzz target 3).
 *
 * These tests instrument the exact two Shell methods each Controller
 * calls (`identityTransitionAccept/Reject/Defer`, `deletionRequestApprove/
 * Reject` — real, unmodified, already-id-based methods, see
 * `fedos_desktop_application_shell.ts:942-977`/`:...`) to RECORD which id
 * was actually passed, rather than fabricating a fake business outcome —
 * every other Shell method the Controllers call returns a real, correctly
 * -shaped `FedosDesktopShellResult`. This proves the CONTROLLER's own
 * dispatch/authorization logic, not backend crypto/business correctness
 * (already covered by the real vertical slices elsewhere in this
 * repository) — a full two-account cross-device identity-rotation setup
 * would only re-prove business logic this file does not touch.
 */

interface RecordedCall {
  readonly method: string;
  readonly peerAccountRef?: unknown;
  readonly peerDeviceRef?: string;
  readonly transitionId?: string;
  readonly requestId?: string;
}

function fedosDesktopShellOk<T>(value: T): { readonly outcome: "ok"; readonly value: T } {
  return { outcome: "ok", value };
}

describe("Alpha 8121-8200 -- Security Finding 3: exact-target authorization survives a reordered open-A/open-B race", () => {
  it("IdentityTransitionController: the OLD selection-based acceptSelected() is genuinely race-prone (open A, open B, acceptSelected() decides B, not A) -- demonstrating the vulnerability this Arc's own fix closes", async () => {
    const calls: RecordedCall[] = [];
    const accountA = { authority: "nostr", publicIdentifier: "pub-a", identityId: null };
    const accountB = { authority: "nostr", publicIdentifier: "pub-b", identityId: null };
    const fakeShell = {
      identityTransitionOpen: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => {
        calls.push({ method: "open", peerAccountRef, peerDeviceRef, transitionId });
        return fedosDesktopShellOk({
          transitionId,
          oldAccountIdentity: { publicIdentifier: "old" },
          newAccountIdentity: { publicIdentifier: "new" },
          evidenceOutcome: "sufficient",
          acceptanceState: "none",
          oldKeyOnlyInsufficientWarning: false,
          warningText: [],
          warnings: [],
        });
      },
      identityTransitionAccept: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => {
        calls.push({ method: "accept", peerAccountRef, peerDeviceRef, transitionId });
        return fedosDesktopShellOk({ acceptanceState: "accepted" });
      },
      identityTransitionReject: () => fedosDesktopShellOk({ acceptanceState: "rejected" }),
      identityTransitionDefer: () => fedosDesktopShellOk({ acceptanceState: "none" }),
    } as unknown as FedosDesktopApplicationShell;

    const controller = new FedosIdentityTransitionController(fakeShell);

    // Open A, then (before anything awaits A) open B -- exactly the race the review named.
    const openA = controller.openTransition(accountA, "device-a", "transition-A");
    const openB = controller.openTransition(accountB, "device-b", "transition-B");
    await Promise.all([openA, openB]);

    await controller.acceptSelected();

    const acceptCalls = calls.filter((c) => c.method === "accept");
    expect(acceptCalls).toHaveLength(1);
    // The OLD API decided against whatever was LAST opened (B), even
    // though a real user still looking at A's own rendered detail view
    // would reasonably expect their click to decide A.
    expect(acceptCalls[0]!.transitionId).toBe("transition-B");
  });

  it("IdentityTransitionController: the NEW exact-id accept()/reject()/defer() always decides the EXACT tuple passed, regardless of a later openTransition() for a different item", async () => {
    const calls: RecordedCall[] = [];
    const accountA = { authority: "nostr", publicIdentifier: "pub-a", identityId: null };
    const accountB = { authority: "nostr", publicIdentifier: "pub-b", identityId: null };
    const fakeShell = {
      identityTransitionOpen: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => {
        calls.push({ method: "open", peerAccountRef, peerDeviceRef, transitionId });
        return fedosDesktopShellOk({
          transitionId,
          oldAccountIdentity: { publicIdentifier: "old" },
          newAccountIdentity: { publicIdentifier: "new" },
          evidenceOutcome: "sufficient",
          acceptanceState: "none",
          oldKeyOnlyInsufficientWarning: false,
          warningText: [],
          warnings: [],
        });
      },
      identityTransitionAccept: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => {
        calls.push({ method: "accept", peerAccountRef, peerDeviceRef, transitionId });
        return fedosDesktopShellOk({ acceptanceState: "accepted" });
      },
      identityTransitionReject: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => {
        calls.push({ method: "reject", peerAccountRef, peerDeviceRef, transitionId });
        return fedosDesktopShellOk({ acceptanceState: "rejected" });
      },
      identityTransitionDefer: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => {
        calls.push({ method: "defer", peerAccountRef, peerDeviceRef, transitionId });
        return fedosDesktopShellOk({ acceptanceState: "none" });
      },
    } as unknown as FedosDesktopApplicationShell;

    const controller = new FedosIdentityTransitionController(fakeShell);

    // Renderer opens A (real UI flow) -- the caller (main.cts, in
    // production) captures A's own tuple at this point, exactly like
    // `fedos_electron_beta_renderer.ts`'s own `target` closure does.
    await controller.openTransition(accountA, "device-a", "transition-A");
    // The user then opens a SECOND item, B, before deciding on A --
    // reordered on purpose, mirroring the review's own fuzz target 3.
    await controller.openTransition(accountB, "device-b", "transition-B");

    // The renderer's own captured `target` for A is still A's tuple --
    // deciding against it must decide EXACTLY A, never B, even though B
    // is now the Controller's own "currently selected" item.
    await controller.accept(accountA, "device-a", "transition-A");

    const acceptCalls = calls.filter((c) => c.method === "accept");
    expect(acceptCalls).toHaveLength(1);
    expect(acceptCalls[0]!.transitionId).toBe("transition-A");
    expect(acceptCalls[0]!.peerDeviceRef).toBe("device-a");
  });

  it("IdentityTransitionController: a duplicate/rapid double-decide (same target, fired twice before the first resolves) is not double-counted -- #actionInFlight guard holds for the exact-id path too", async () => {
    const calls: RecordedCall[] = [];
    let resolveFirstAccept: (() => void) | null = null;
    const account = { authority: "nostr", publicIdentifier: "pub-a", identityId: null };
    const fakeShell = {
      identityTransitionOpen: () =>
        fedosDesktopShellOk({
          transitionId: "transition-A",
          oldAccountIdentity: { publicIdentifier: "old" },
          newAccountIdentity: { publicIdentifier: "new" },
          evidenceOutcome: "sufficient",
          acceptanceState: "none",
          oldKeyOnlyInsufficientWarning: false,
          warningText: [],
          warnings: [],
        }),
      identityTransitionAccept: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => {
        calls.push({ method: "accept", peerAccountRef, peerDeviceRef, transitionId });
        return fedosDesktopShellOk({ acceptanceState: "accepted" });
      },
      identityTransitionReject: () => fedosDesktopShellOk({ acceptanceState: "rejected" }),
      identityTransitionDefer: () => fedosDesktopShellOk({ acceptanceState: "none" }),
    } as unknown as FedosDesktopApplicationShell;
    void resolveFirstAccept;

    const controller = new FedosIdentityTransitionController(fakeShell);
    await controller.openTransition(account, "device-a", "transition-A");

    // Two rapid clicks on the SAME rendered Accept button, before the
    // first's own async completion -- simulating a real double-click with
    // no `setBusy()` guard yet applied at the renderer layer (Security
    // Finding 2's own separate concern); the CONTROLLER's own
    // `#actionInFlight` guard must still hold as the authoritative boundary.
    const first = controller.accept(account, "device-a", "transition-A");
    const second = controller.accept(account, "device-a", "transition-A");
    await Promise.all([first, second]);

    expect(calls.filter((c) => c.method === "accept")).toHaveLength(1);
  });
});

describe("Alpha 8121-8200 -- Security Finding 3: Deletion Request exact-target authorization survives a reordered open-A/open-B race", () => {
  it("DeletionRequestController: the OLD selection-based approveSelected() decides whatever is currently selected, not necessarily what the caller intended", async () => {
    const calls: RecordedCall[] = [];
    const fakeShell = {
      deletionRequestListReceived: () =>
        fedosDesktopShellOk([
          { summary: { requestId: "request-A", requesterAccountRef: "pub-a", conversationId: "conv-1", requestedScope: "conversation" }, decisionState: "received" },
          { summary: { requestId: "request-B", requesterAccountRef: "pub-b", conversationId: "conv-2", requestedScope: "conversation" }, decisionState: "received" },
        ]),
      deletionRequestApprove: (requestId: string) => {
        calls.push({ method: "approve", requestId });
        return fedosDesktopShellOk({ requestId });
      },
      deletionRequestReject: (requestId: string) => {
        calls.push({ method: "reject", requestId });
        return fedosDesktopShellOk({ requestId });
      },
    } as unknown as FedosDesktopApplicationShell;

    const controller = new FedosDeletionRequestController(fakeShell);
    await controller.openReceivedRequest("request-A", "always-review");
    await controller.openReceivedRequest("request-B", "always-review");
    await controller.approveSelected();

    const approveCalls = calls.filter((c) => c.method === "approve");
    expect(approveCalls).toHaveLength(1);
    expect(approveCalls[0]!.requestId).toBe("request-B");
  });

  it("DeletionRequestController: the NEW exact-id approve()/reject() always targets the exact requestId passed, regardless of a later openReceivedRequest() for a different item", async () => {
    const calls: RecordedCall[] = [];
    const fakeShell = {
      deletionRequestListReceived: () =>
        fedosDesktopShellOk([
          { summary: { requestId: "request-A", requesterAccountRef: "pub-a", conversationId: "conv-1", requestedScope: "conversation" }, decisionState: "received" },
          { summary: { requestId: "request-B", requesterAccountRef: "pub-b", conversationId: "conv-2", requestedScope: "conversation" }, decisionState: "received" },
        ]),
      deletionRequestApprove: (requestId: string) => {
        calls.push({ method: "approve", requestId });
        return fedosDesktopShellOk({ requestId });
      },
      deletionRequestReject: (requestId: string) => {
        calls.push({ method: "reject", requestId });
        return fedosDesktopShellOk({ requestId });
      },
    } as unknown as FedosDesktopApplicationShell;

    const controller = new FedosDeletionRequestController(fakeShell);
    await controller.openReceivedRequest("request-A", "always-review");
    await controller.openReceivedRequest("request-B", "always-review");

    // The renderer's own captured `targetRequestId` for A (from when A
    // was rendered) is passed directly -- must decide A, never B.
    await controller.approve("request-A");

    const approveCalls = calls.filter((c) => c.method === "approve");
    expect(approveCalls).toHaveLength(1);
    expect(approveCalls[0]!.requestId).toBe("request-A");
  });
});
