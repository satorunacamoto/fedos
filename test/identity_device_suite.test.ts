import { describe, it, expect } from "vitest";
import {
  reviewDeviceRegistration,
  isSensitiveDeviceRegistrationValue,
} from "../src/identity/device_registration.js";
import type { DeviceRegistrationDescriptor } from "../src/identity/device_registration.js";
import { DEVICE_TRUST_LABELS, reviewDeviceTrust } from "../src/identity/device_trust.js";
import type { DeviceTrustDescriptor } from "../src/identity/device_trust.js";
import {
  SESSION_REQUESTED_ACTIONS,
  reviewSessionRequest,
} from "../src/identity/session_boundary.js";
import type { SessionRequestDescriptor } from "../src/identity/session_boundary.js";
import {
  IDENTITY_RECOVERY_REQUEST_KINDS,
  reviewIdentityRecoveryRequest,
} from "../src/identity/recovery_policy.js";
import type { IdentityRecoveryRequestDescriptor } from "../src/identity/recovery_policy.js";
import {
  renderDevicePreviewPage,
  SAMPLE_DEVICE_REGISTRATIONS,
  SAMPLE_DEVICE_TRUST,
  SAMPLE_SESSION_REQUESTS,
  SAMPLE_RECOVERY_REQUESTS,
} from "../src/render/device_preview.js";
import { handleRequest, isDevicePreviewEnabled } from "../src/worker.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceRegistrationSource from "../src/identity/device_registration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceTrustSource from "../src/identity/device_trust.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionBoundarySource from "../src/identity/session_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recoveryPolicySource from "../src/identity/recovery_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import devicePreviewSource from "../src/render/device_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceIdentityDoc from "../docs/device_identity_boundary.md?raw";

const boundarySources = [
  deviceRegistrationSource,
  deviceTrustSource,
  sessionBoundarySource,
  recoveryPolicySource,
  devicePreviewSource,
].join("\n");

const PROHIBITED_WORDS = [
  "password",
  "recovery phrase",
  "mnemonic",
  "seed",
  "backup",
  "export",
  "import",
  "sync",
  "authentication",
];

describe("Device registration boundary", () => {
  const cleanDevice: DeviceRegistrationDescriptor = {
    idRef: "device-1",
    deviceRef: "device-ref-1",
    actorRef: "actor-1",
    platformLabel: "desktop",
  };

  it("1. a clean device is registered_placeholder", () => {
    const decision = reviewDeviceRegistration(cleanDevice);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("registered_placeholder");
  });

  it("2. rejects password/recovery/phrase/mnemonic/seed/backup/export/import/sync/auth metadata", () => {
    for (const marker of [
      "password",
      "recovery",
      "phrase",
      "mnemonic",
      "seed",
      "backup",
      "export",
      "import",
      "sync",
      "auth",
    ]) {
      const decision = reviewDeviceRegistration({ ...cleanDevice, metadata: { [marker]: "x" } });
      expect(decision.allowed).toBe(false);
      expect(decision.state).toBe("rejected");
    }
  });

  it("3. isSensitiveDeviceRegistrationValue flags credential-shaped values", () => {
    expect(isSensitiveDeviceRegistrationValue("my seed phrase")).toBe(true);
    expect(isSensitiveDeviceRegistrationValue("a plain label")).toBe(false);
  });

  it("4. never mutates its input", () => {
    const snapshot = JSON.stringify(cleanDevice);
    reviewDeviceRegistration(cleanDevice);
    expect(JSON.stringify(cleanDevice)).toBe(snapshot);
  });
});

describe("Device trust label boundary", () => {
  it("5. every trust label is a placeholder label", () => {
    for (const label of DEVICE_TRUST_LABELS) {
      expect(label).toMatch(/_placeholder$/);
    }
  });

  it("6. a clean assessment is accepted_placeholder", () => {
    const trust: DeviceTrustDescriptor = { deviceRef: "device-ref-1", label: "trusted_placeholder" };
    const decision = reviewDeviceTrust(trust);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("7. rejects sensitive metadata", () => {
    const trust: DeviceTrustDescriptor = {
      deviceRef: "device-ref-1",
      label: "trusted_placeholder",
      metadata: { password: "x" },
    };
    expect(reviewDeviceTrust(trust).allowed).toBe(false);
  });
});

describe("Session boundary", () => {
  it("8. every session-requested-action is a placeholder label", () => {
    for (const action of SESSION_REQUESTED_ACTIONS) {
      expect(action).toMatch(/_placeholder$/);
    }
  });

  it("9. maps start/end/refresh 1:1 to active/ended/refreshed", () => {
    const map: Record<string, string> = {
      start_placeholder: "active_placeholder",
      end_placeholder: "ended_placeholder",
      refresh_placeholder: "refreshed_placeholder",
    };
    for (const action of SESSION_REQUESTED_ACTIONS) {
      const request: SessionRequestDescriptor = { deviceRef: "device-1", action };
      const review = reviewSessionRequest(request);
      expect(review.decision).toBe(map[action]);
    }
  });

  it("10. rejects sensitive metadata (never reaches a lifecycle label)", () => {
    const request: SessionRequestDescriptor = {
      deviceRef: "device-1",
      action: "start_placeholder",
      metadata: { token: "x" },
    };
    expect(reviewSessionRequest(request).decision).toBe("rejected");
  });

  it("11. never mutates its input", () => {
    const request: SessionRequestDescriptor = { deviceRef: "device-1", action: "start_placeholder" };
    const snapshot = JSON.stringify(request);
    reviewSessionRequest(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});

describe("Identity recovery policy boundary", () => {
  it("12. every recovery request kind is a placeholder label", () => {
    for (const kind of IDENTITY_RECOVERY_REQUEST_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("13. a clean request is accepted_placeholder", () => {
    const request: IdentityRecoveryRequestDescriptor = {
      actorRef: "actor-1",
      kind: "unlock_trigger_placeholder",
    };
    const decision = reviewIdentityRecoveryRequest(request);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("14. rejects password/recovery/phrase/mnemonic/seed/backup/export/import/sync/auth metadata", () => {
    for (const marker of [
      "password",
      "recovery",
      "phrase",
      "mnemonic",
      "seed",
      "backup",
      "export",
      "import",
      "sync",
      "auth",
    ]) {
      const request: IdentityRecoveryRequestDescriptor = {
        actorRef: "actor-1",
        kind: "unlock_trigger_placeholder",
        metadata: { [marker]: "x" },
      };
      expect(reviewIdentityRecoveryRequest(request).allowed).toBe(false);
    }
  });

  it("15. never mutates its input", () => {
    const request: IdentityRecoveryRequestDescriptor = {
      actorRef: "actor-1",
      kind: "unlock_trigger_placeholder",
    };
    const snapshot = JSON.stringify(request);
    reviewIdentityRecoveryRequest(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});

describe("Device & identity preview UI", () => {
  it("16. flag absent -> not shown (checked via Worker route below)", () => {
    expect(SAMPLE_DEVICE_REGISTRATIONS.length).toBeGreaterThan(0);
    expect(SAMPLE_DEVICE_TRUST.length).toBeGreaterThan(0);
    expect(SAMPLE_SESSION_REQUESTS.length).toBeGreaterThan(0);
    expect(SAMPLE_RECOVERY_REQUESTS.length).toBeGreaterThan(0);
  });

  it("17. renders every sample record's platform/label/action/kind", () => {
    const html = renderDevicePreviewPage(
      SAMPLE_DEVICE_REGISTRATIONS,
      SAMPLE_DEVICE_TRUST,
      SAMPLE_SESSION_REQUESTS,
      SAMPLE_RECOVERY_REQUESTS,
    );
    expect(html).toContain(SAMPLE_DEVICE_REGISTRATIONS[0]!.platformLabel!);
    expect(html).toContain(SAMPLE_DEVICE_TRUST[0]!.label);
    expect(html).toContain(SAMPLE_SESSION_REQUESTS[0]!.action);
    expect(html).toContain(SAMPLE_RECOVERY_REQUESTS[0]!.kind);
  });

  it("18. never throws", () => {
    expect(() =>
      renderDevicePreviewPage(
        SAMPLE_DEVICE_REGISTRATIONS,
        SAMPLE_DEVICE_TRUST,
        SAMPLE_SESSION_REQUESTS,
        SAMPLE_RECOVERY_REQUESTS,
      ),
    ).not.toThrow();
  });
});

describe("Worker device preview route", () => {
  it("19. no devicePreview flag -> normal board route", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    const body = await res.text();
    expect(body).not.toMatch(/device-preview-page/);
  });

  it("20. ?devicePreview=1 -> device preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?devicePreview=1"));
    const body = await res.text();
    expect(body).toMatch(/device-preview-page/);
  });

  it("21. creatorGovernancePreview takes precedence over devicePreview when both present", async () => {
    const res = await handleRequest(
      new Request("https://example.com/?creatorGovernancePreview=1&devicePreview=1"),
    );
    const body = await res.text();
    expect(body).toMatch(/creator-governance-preview-page/);
    expect(body).not.toMatch(/device-preview-page/);
  });

  it("22. isDevicePreviewEnabled recognizes only 1/true", () => {
    expect(isDevicePreviewEnabled(new URL("https://x.com/?devicePreview=1"))).toBe(true);
    expect(isDevicePreviewEnabled(new URL("https://x.com/?devicePreview=0"))).toBe(false);
  });

  it("23. existing routes are unaffected", async () => {
    const res = await handleRequest(new Request("https://example.com/?relay=bad-relay"));
    expect(res.status).toBe(400);
  });
});

describe("Stage 127-130 boundaries carry no password/recovery-phrase/mnemonic/seed/backup/export/import/sync/authentication field", () => {
  it("24. no prohibited word appears as a TYPE FIELD name across the four boundary sources", () => {
    for (const source of [
      deviceRegistrationSource,
      deviceTrustSource,
      sessionBoundarySource,
      recoveryPolicySource,
    ] as string[]) {
      expect(source).not.toMatch(/\breadonly\s+(password|mnemonic|seed|backup|export|import|sync)\w*\s*[?:]/i);
    }
  });

  it("25. no fetch/websocket/oauth-token-storing call in any of the four sources", () => {
    for (const source of [
      deviceRegistrationSource,
      deviceTrustSource,
      sessionBoundarySource,
      recoveryPolicySource,
    ] as string[]) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    }
  });

  it("26. calls no provider method", () => {
    expect(boundarySources).not.toMatch(
      /\.(requestPayment|purchasePlaceholder|listPlaceholder|checkPlaceholder|sendPlaceholder|publishPlaceholder|connect|disconnect)\s*\(/,
    );
  });

  it("27. boundary sources import no storage/payment/vault library", () => {
    expect(boundarySources).not.toMatch(/from\s+['"].*storage\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*payment\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*vault\//);
  });

  it("28. Worker source never reads/calls a runtime-selected boundary from the device preview route", () => {
    expect(workerSource).toMatch(/isDevicePreviewEnabled\(url\)/);
    expect(workerSource).not.toMatch(
      /runtime\.(storageBackend|federationProvider|marketplaceProvider|creatorEntitlementProvider|chatProvider|webAuthnProvider|identityProvider)\b/,
    );
  });

  it("29. docs/device_identity_boundary.md names every prohibited word in the guardrail list", () => {
    for (const word of PROHIBITED_WORDS) {
      expect((deviceIdentityDoc as string).toLowerCase()).toContain(word);
    }
  });

  it("30. never throws for any exported review function", () => {
    expect(() => reviewDeviceRegistration({ deviceRef: "d" })).not.toThrow();
    expect(() => reviewDeviceTrust({ deviceRef: "d", label: "test_placeholder" })).not.toThrow();
    expect(() => reviewSessionRequest({ deviceRef: "d", action: "start_placeholder" })).not.toThrow();
    expect(() =>
      reviewIdentityRecoveryRequest({ actorRef: "a", kind: "test_placeholder" }),
    ).not.toThrow();
  });
});
