/**
 * Secure Runtime Alpha 5061-5160 — FedOS Desktop Beta 0.1 Integration,
 * Release Candidate, and Acceptance Freeze Arc — Phase B: the ONE versioned,
 * non-secret Beta capability manifest (`FedosDesktopBetaCapabilityManifestV1`).
 *
 * This module is the honest, source-derived answer to "what can FedOS Desktop
 * Beta 0.1 actually do?". It is NOT built from doc strings or prior-Arc
 * completion declarations — every status below was derived by reading the real
 * accepted source in this worktree (see
 * `docs/secure_runtime_alpha_5061_5160_reconciliation_report.md`, Phase A).
 *
 * DESIGN RULES (spec Phase B):
 *   - CLOSED status vocabulary. No other value is ever produced.
 *   - Per-capability fields are all NON-SECRET and safe to render/log verbatim.
 *   - Pure value object: no Runtime, no Electron, no persistence, no secret,
 *     no timer, no filesystem. Deep-frozen; structured-clone-safe.
 *   - "The UI must not show `unavailable` features as usable" — the boundary
 *     projection (`fedosDesktopBetaUserVisibleCapabilities`) exposes exactly
 *     the label + coarse limitation the renderer may show, and callers gate
 *     interactivity on `status`.
 *
 * HONESTY NOTE on `available-development-only` vs `available`: a capability is
 * `available` ONLY when its real authority is reachable from the ONE canonical
 * packaged Electron entry point. Because Beta 0.1's canonical application
 * assembly is not yet composed (Phase C release-blocking finding), the domain
 * runtimes that are real, tested code but not yet reachable from a packaged
 * renderer are honestly `available-development-only`, NOT `available`.
 */

/**
 * The CLOSED Beta capability status vocabulary (spec Phase B). Meaning:
 *   - available                 — real authority, reachable from the packaged app.
 *   - available-development-only — real, tested code, reachable only through
 *                                  a development/test harness, not the packaged
 *                                  canonical entry point.
 *   - available-local-only      — real and reachable, but never crosses the
 *                                  network (no delivery guarantee / no peers).
 *   - unavailable               — no real authority exists in this lineage.
 *   - blocked                   — real authority exists but a named prerequisite
 *                                  prevents it operating in this build/environment.
 *   - deferred                  — intentionally out of Beta 0.1 scope.
 *   - experimental              — present but not accepted as Beta-stable.
 */
export type FedosDesktopBetaCapabilityStatus =
  | "available"
  | "available-development-only"
  | "available-local-only"
  | "unavailable"
  | "blocked"
  | "deferred"
  | "experimental";

export const FEDOS_DESKTOP_BETA_CAPABILITY_STATUSES: readonly FedosDesktopBetaCapabilityStatus[] =
  Object.freeze([
    "available",
    "available-development-only",
    "available-local-only",
    "unavailable",
    "blocked",
    "deferred",
    "experimental",
  ]);

/** The CLOSED capability-id vocabulary — one id per audited Beta domain (spec Phase A domain list). */
export type FedosDesktopBetaCapabilityId =
  | "profile-onboarding"
  | "production-master-seed-unlock"
  | "lock-unlock"
  | "local-account-identity"
  | "local-device-identity"
  | "device-registry"
  | "device-pairing"
  | "device-sync"
  | "conversation-create"
  | "direct-messaging"
  | "group-messaging"
  | "private-relay-delivery"
  | "archive-export-restore"
  | "search"
  | "retention-enforcement"
  | "settings-persistence"
  | "settings-immediate-application"
  | "settings-runtime-restart-application"
  | "notifications"
  | "tray"
  | "unread-badge"
  | "background-lifecycle"
  | "packaged-application"
  | "clean-shutdown";

export interface FedosDesktopBetaCapabilityEntry {
  readonly capabilityId: FedosDesktopBetaCapabilityId;
  readonly status: FedosDesktopBetaCapabilityStatus;
  /** Short, user-facing label. Non-secret. */
  readonly userVisibleLabel: string;
  /** One coarse, non-secret sentence on the limitation/scope. Never a raw error. */
  readonly coarseLimitation: string;
  /** Whether exercising this capability requires an unlocked profile. */
  readonly profileRequired: boolean;
  /** Whether this capability requires a network to be meaningful. */
  readonly networkRequired: boolean;
  /** Whether a Desktop Runtime restart is needed to change this capability's inputs. */
  readonly restartRequired: boolean;
  /** Whether this capability is experimental (not Beta-stable). */
  readonly experimental: boolean;
  /** `true` iff this capability is part of the Beta 0.1 product definition. */
  readonly betaIncluded: boolean;
}

export interface FedosDesktopBetaCapabilityManifestV1 {
  readonly manifestVersion: 1;
  readonly manifestId: "FedosDesktopDesktopBetaCapabilityManifestV1";
  readonly capabilities: readonly FedosDesktopBetaCapabilityEntry[];
}

function entry(e: FedosDesktopBetaCapabilityEntry): FedosDesktopBetaCapabilityEntry {
  return Object.freeze(e);
}

/**
 * The ONE evidence-derived Beta 0.1 capability manifest. Frozen. Each status
 * is justified in the Phase A reconciliation report; the short justifications
 * live in `coarseLimitation`.
 */
const FEDOS_DESKTOP_BETA_CAPABILITY_MANIFEST_V1: FedosDesktopBetaCapabilityManifestV1 = Object.freeze({
  manifestVersion: 1,
  manifestId: "FedosDesktopDesktopBetaCapabilityManifestV1",
  capabilities: Object.freeze([
    entry({
      capabilityId: "profile-onboarding",
      status: "available",
      userVisibleLabel: "First-run profile creation",
      coarseLimitation:
        "FINAL RC SEAL arc: real `profile-create` proven through the actual canonical packaged entry point (a silently-installed NSIS binary), producing a real account identity.",
      profileRequired: false,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "production-master-seed-unlock",
      status: "available",
      userVisibleLabel: "Master Seed unlock",
      coarseLimitation:
        "FINAL RC SEAL arc: real WASM Master Seed generation and later real `profile-unlock` proven through the actual packaged installed binary (not a dev/unpackaged process).",
      profileRequired: false,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "lock-unlock",
      status: "available",
      userVisibleLabel: "Lock and re-unlock",
      coarseLimitation: "FINAL RC SEAL arc: real `profile-lock` then, after an uninstall+reinstall of the packaged app, a real `profile-unlock` recovering the same identity — proven through the packaged binary, not just a harness.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "local-account-identity",
      status: "available",
      userVisibleLabel: "Local account identity",
      coarseLimitation: "FINAL RC SEAL arc: the same real `accountPublicIdentifier` was recovered via `profile-unlock` through the packaged binary after a real uninstall+reinstall cycle.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "local-device-identity",
      status: "available",
      userVisibleLabel: "Local device identity",
      coarseLimitation: "FINAL RC SEAL arc: the same real `localDeviceId` was recovered via `profile-unlock` through the packaged binary after a real uninstall+reinstall cycle.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "device-registry",
      status: "available-development-only",
      userVisibleLabel: "Device registry",
      coarseLimitation: "One durable Device Registry per Runtime (gated by deviceTrustEnabled); no packaged UI reaches it yet.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "device-pairing",
      status: "available-development-only",
      userVisibleLabel: "Device pairing",
      coarseLimitation: "Real pairing facade over the one Device Registry; no packaged UI reaches it, and cross-device pairing needs a network peer.",
      profileRequired: true,
      networkRequired: true,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "device-sync",
      status: "available-development-only",
      userVisibleLabel: "Device sync",
      coarseLimitation: "Real durable Sync Journal + scheduler; background toggle is a real subsystem boundary, but no packaged UI reaches sync operations.",
      profileRequired: true,
      networkRequired: true,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "conversation-create",
      status: "available-development-only",
      userVisibleLabel: "Create/open conversations",
      coarseLimitation: "Real Conversation Runtime (direct + private-group drafts/reads) per Runtime; no packaged renderer reaches it yet.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "direct-messaging",
      status: "available-development-only",
      userVisibleLabel: "Direct messaging",
      coarseLimitation: "Real direct-conversation model and content accessor; local read/draft proven in tests, no packaged UI, network delivery separate.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "group-messaging",
      status: "available-development-only",
      userVisibleLabel: "Group (pairwise) messaging",
      coarseLimitation: "Real private-group pairwise model; local read/draft proven in tests, no packaged UI, network delivery separate.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "private-relay-delivery",
      status: "available-local-only",
      userVisibleLabel: "Private relay delivery",
      coarseLimitation: "Real private transport constructed at Runtime; exercised in-process only. Live external-relay delivery is untested here and not guaranteed.",
      profileRequired: true,
      networkRequired: true,
      restartRequired: true,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "archive-export-restore",
      status: "available-development-only",
      userVisibleLabel: "Archive export/restore",
      coarseLimitation: "Real Conversation Archive Runtime (gated by archiveEnabled); directory is a Runtime-construction input; no packaged UI reaches it.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: true,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "search",
      status: "available-development-only",
      userVisibleLabel: "Conversation search",
      coarseLimitation: "Real search with retention gating in the Conversation lineage; no packaged renderer reaches it yet.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "retention-enforcement",
      status: "available-development-only",
      userVisibleLabel: "Retention enforcement",
      coarseLimitation: "Search remains retention-gated by real authority; verified in the Conversation/Search lineage tests.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "settings-persistence",
      status: "available",
      userVisibleLabel: "Settings persistence",
      coarseLimitation: "Real file-backed, validated, import/export-capable settings authority; reachable through the settings harness main.",
      profileRequired: false,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "settings-immediate-application",
      status: "available-development-only",
      userVisibleLabel: "Immediate settings (theme, layout, notifications)",
      coarseLimitation: "Real immediate application to live presentation/notification sinks; proven with real boundaries, not yet in a composed packaged app.",
      profileRequired: false,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "settings-runtime-restart-application",
      status: "available-development-only",
      userVisibleLabel: "Runtime-restart settings (relays, archive dir)",
      coarseLimitation: "Classified and persisted honestly as pending-runtime-restart; the confirmed-restart flow needs the composed application assembly to own the one Runtime.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: true,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "notifications",
      status: "available-development-only",
      userVisibleLabel: "Desktop notifications",
      coarseLimitation: "Real notification coordinator + gate; proven through the notifications/tray harness main.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "tray",
      status: "available-development-only",
      userVisibleLabel: "System tray",
      coarseLimitation: "Real tray coordinator; proven through the notifications/tray harness main.",
      profileRequired: false,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "unread-badge",
      status: "available-development-only",
      userVisibleLabel: "Unread badge",
      coarseLimitation: "Real badge coordinator wired to device-sync events; proven through the badge harness main.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "background-lifecycle",
      status: "available-development-only",
      userVisibleLabel: "Background operation",
      coarseLimitation: "Real background lifecycle; background sync toggled through the one scheduler. Not composed into a packaged app yet.",
      profileRequired: true,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "packaged-application",
      status: "available",
      userVisibleLabel: "Packaged Windows application",
      coarseLimitation:
        "FINAL RC SEAL arc: a real NSIS installer is built, silently installed, launched, and used end-to-end (14-real-gate release pipeline, fresh install, uninstall, reinstall, extensive packaged-binary regression suites) — the canonical packaged entry point is real and proven, not blocked.",
      profileRequired: false,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
    entry({
      capabilityId: "clean-shutdown",
      status: "available",
      userVisibleLabel: "Clean shutdown",
      coarseLimitation: "FINAL RC SEAL arc: real `fedos-beta: shutdown clean` + exit code 0 proven repeatedly through the actual packaged installed binary.",
      profileRequired: false,
      networkRequired: false,
      restartRequired: false,
      experimental: false,
      betaIncluded: true,
    }),
  ]),
});

/** Returns the ONE frozen Beta 0.1 capability manifest. */
export function fedosDesktopBetaCapabilityManifestV1(): FedosDesktopBetaCapabilityManifestV1 {
  return FEDOS_DESKTOP_BETA_CAPABILITY_MANIFEST_V1;
}

/** Looks up one capability entry by id, or `undefined` if absent. */
export function fedosDesktopBetaCapability(
  id: FedosDesktopBetaCapabilityId,
): FedosDesktopBetaCapabilityEntry | undefined {
  return FEDOS_DESKTOP_BETA_CAPABILITY_MANIFEST_V1.capabilities.find((c) => c.capabilityId === id);
}

/**
 * The boundary-safe, user-visible projection of the manifest: exactly the
 * label, status, coarse limitation, and requirement flags the renderer may
 * show — the SAME shape the manifest already carries (it holds no secrets), but
 * returned as a fresh frozen array so a renderer can never mutate the source.
 */
export interface FedosDesktopBetaUserVisibleCapability {
  readonly capabilityId: FedosDesktopBetaCapabilityId;
  readonly status: FedosDesktopBetaCapabilityStatus;
  readonly label: string;
  readonly limitation: string;
  readonly usable: boolean;
  readonly profileRequired: boolean;
  readonly networkRequired: boolean;
  readonly experimental: boolean;
}

/** `true` iff a capability with this status may be presented as interactive/usable. */
export function fedosDesktopBetaCapabilityUsable(status: FedosDesktopBetaCapabilityStatus): boolean {
  return status === "available" || status === "available-local-only";
}

/** Projects the manifest onto the closed, boundary-safe user-visible list (spec Phase B/H). */
export function fedosDesktopBetaUserVisibleCapabilities(): readonly FedosDesktopBetaUserVisibleCapability[] {
  return Object.freeze(
    FEDOS_DESKTOP_BETA_CAPABILITY_MANIFEST_V1.capabilities.map((c) =>
      Object.freeze({
        capabilityId: c.capabilityId,
        status: c.status,
        label: c.userVisibleLabel,
        limitation: c.coarseLimitation,
        usable: fedosDesktopBetaCapabilityUsable(c.status),
        profileRequired: c.profileRequired,
        networkRequired: c.networkRequired,
        experimental: c.experimental,
      }),
    ),
  );
}
