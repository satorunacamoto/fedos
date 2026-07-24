/**
 * Secure Runtime Alpha 4661-4740 — Phase E / F / H / M: the ONE
 * application-level Profile Initialization Coordinator.
 *
 * This is the single deliverable that orchestrates the ALREADY-REVIEWED
 * authorities into the three target user flows. It owns NO cryptography,
 * persists NO private key, and constructs NO second Runtime / Registry /
 * Master Seed authority. Every mutation delegates to an existing boundary:
 *   - Master Seed generate/seal/restore -> the injected `FedosMasterSeedAuthority`
 *     (real WASM in production — currently gated shut — or the
 *     DEVELOPMENT-ONLY double for the reachable dev path; Phase D).
 *   - sealed-envelope persistence -> `FedosSealedMasterSeedEnvelopePersistence`.
 *   - account public identity + device authorization signatures ->
 *     the injected `FedosNostrSigningAuthority`.
 *   - device key + registration -> `FedosDeviceSigningKeypair` +
 *     `runtime.devicePairing()` (real BIP-340 proofs both sides, Phase H).
 *   - durable paths -> `FedosLocalProfilePaths` (Phase G).
 *   - Runtime start -> the EXISTING `startFedosDesktopRuntime()` — never a
 *     new Runtime type.
 *
 * Lifecycle is the closed Phase C state machine
 * (`./fedos_profile_lifecycle_state.ts`). `markReady` is reached ONLY after
 * every mandatory step succeeds — a failure anywhere leaves `failed` or
 * `recovery-required`, NEVER a false `ready` and NEVER a running Runtime
 * (Phase C: no partial ready).
 *
 * ROLLBACK / FORENSIC (Phase E): on a failed create, this coordinator does
 * NOT delete the sealed file or descriptor it already wrote — a partial
 * profile is left in place so the next launch DETECTS it (as
 * `recovery-required`) rather than silently overwriting it. Nothing is
 * silently deleted after failure.
 *
 * HARD GUARDRAILS:
 *   - The unlock secret is only ever a `FedosProfileUnlockSecret`, consumed
 *     once at the point of use and never returned, logged, or placed on a
 *     result/config.
 *   - No result value carries a secret, a sealed byte, a private key, or a
 *     raw `Error`/stack — only the closed outcome vocabulary + a short
 *     non-secret reason.
 */

import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { FEDOS_GIFT_WRAP_KIND } from "../../conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import type { FedosMasterSeedAuthority } from "../../runtime/master_seed/fedos_master_seed_authority.js";
import type { FedosSealedMasterSeedEnvelopePersistence } from "../../runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.js";
import type { FedosNostrSigningAuthority } from "../../nostr/sign/fedos_nostr_signing_authority.js";
import {
  FedosDeviceSigningKeypair,
  generateFedosDeviceSigningKeypair,
} from "../../device/crypto/fedos_device_signing_keypair.js";
import type { FedosDeviceBindingAccountRef } from "../../device/fedos_device_binding.js";
import {
  startFedosDesktopRuntime,
  type FedosRunningDesktopRuntime,
} from "../runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../runtime/fedos_desktop_runtime_config.js";
import type { FedosLocalProfilePaths } from "./fedos_local_profile_paths.js";
import { ensureFedosLocalProfileDirectories } from "./fedos_local_profile_paths.js";
import {
  FedosLocalProfileCorruptError,
  type FedosLocalProfilePersistence,
} from "./fedos_local_profile_persistence.js";
import {
  createFedosLocalProfileDescriptorV1,
  withFedosLocalProfileInitializationState,
  type FedosLocalProfileDescriptorV1,
} from "./fedos_local_profile_descriptor.js";
import {
  applyFedosProfileLifecycleTransition,
  type FedosProfileLifecycleState,
} from "./fedos_profile_lifecycle_state.js";
import {
  validateFedosUnlockSecretBytes,
  FEDOS_DEFAULT_UNLOCK_SECRET_POLICY,
  type FedosProfileUnlockSecret,
  type FedosUnlockSecretPolicy,
} from "./fedos_profile_unlock_secret.js";
import {
  buildFedosProfileRecoveryNotice,
  type FedosProfileRecoveryNotice,
} from "./fedos_profile_recovery_notice.js";
import type { FedosDeviceSyncAbandonmentPolicy } from "../../device/sync_scheduler/fedos_device_sync_retry_policy.js";
import type { FedosDeviceSyncAttemptFn } from "../../device/sync_scheduler/fedos_device_sync_attempt.js";
// Secure Runtime Alpha 6521-6600 -- every import below this comment is
// ADDITIVE ONLY, mirroring this file's own established import ordering.
import type { FedosRelay } from "../fedos_relay.js";
import type { FedosRatchetPeerCapabilityEntry } from "../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.js";
import type { FedosIdentityTransitionLocalPolicy } from "../../conversation/identity_transition/fedos_identity_transition_evidence_evaluation.js";
import type { FedosDeletionRecipientPolicy } from "../../conversation/deletion_request/fedos_deletion_recipient_policy.js";

export type FedosProfileCoordinatorOutcome =
  | "ok"
  | "already-exists"
  | "no-profile"
  | "invalid-input"
  | "weak-secret"
  | "unlock-failed"
  | "identity-mismatch"
  | "corrupt"
  | "recovery-required"
  | "seed-unavailable"
  | "device-bootstrap-incomplete"
  | "runtime-start-failed"
  | "not-ready"
  | "failed";

export type FedosProfileCoordinatorResult<T> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: Exclude<FedosProfileCoordinatorOutcome, "ok">; readonly reason: string };

function ok<T>(value: T): FedosProfileCoordinatorResult<T> {
  return { outcome: "ok", value };
}
function fail<T>(
  outcome: Exclude<FedosProfileCoordinatorOutcome, "ok">,
  reason: string,
): FedosProfileCoordinatorResult<T> {
  return { outcome, reason };
}

/** The coarse durable presence of a profile, without any secret. */
export type FedosProfilePresence = "absent" | "locked" | "recovery-required" | "in-progress";

export interface FedosProfileStatusView {
  readonly lifecycleState: FedosProfileLifecycleState;
  readonly presence: FedosProfilePresence;
  readonly displayLabel: string | null;
  readonly accountPublicIdentifier: string | null;
  readonly localDeviceId: string | null;
  readonly runtimeRunning: boolean;
}

/** The safe, secret-free result of a completed create/unlock. */
export interface FedosProfileReadyView {
  readonly lifecycleState: "ready";
  readonly displayLabel: string;
  readonly accountPublicIdentifier: string;
  readonly localDeviceId: string;
  readonly deviceTrustState: string;
  readonly recoveryNotice: FedosProfileRecoveryNotice;
}

export interface FedosProfileInitializationDependencies {
  readonly paths: FedosLocalProfilePaths;
  readonly profilePersistence: FedosLocalProfilePersistence;
  readonly sealedSeedPersistence: FedosSealedMasterSeedEnvelopePersistence;
  /** The injected Master Seed authority. Production: `FedosWasmMasterSeedAuthority` (currently gated shut). Dev: `DevelopmentFedosMasterSeedAuthority`. Never constructed here. */
  readonly masterSeedAuthority: FedosMasterSeedAuthority;
  /** Resolves the account public identity + signs device-binding account authorizations. In the real design this is derived from the Master Seed; here it is injected (dev: `RealFedosNostrSigningAuthority`). */
  readonly accountSigningAuthority: FedosNostrSigningAuthority;
  readonly accountIndex?: number;
  readonly now?: () => number;
  readonly generateProfileId?: () => string;
  readonly generateDeviceKeypair?: () => FedosDeviceSigningKeypair;
  /** Omitted, derived from the local Device public key. */
  readonly localDeviceId?: string;
  readonly unlockPolicy?: FedosUnlockSecretPolicy;
  /** Omitted, the real `startFedosDesktopRuntime`. Injectable for tests. */
  readonly startRuntime?: (config: FedosDesktopRuntimeConfig) => Promise<FedosRunningDesktopRuntime>;
  /** Whether to enable the Archive capability (requires a REAL Master Seed authority for archive crypto). Default false — the dev double cannot back real archive crypto. */
  readonly archiveEnabled?: boolean;
  /**
   * Secure Runtime Alpha 7881-7960 — mirrors `deviceSyncSchedulerEnabled`'s
   * own established "optional capability toggle, threaded straight into
   * `#buildRuntimeConfig()`" pattern exactly. Whether to enable real Device
   * Sync propagation of Archive Suppression facts on the Runtime this
   * Coordinator starts — REQUIRES `privateTransportEnabled` (the SAME real
   * relay set/signing authority this Coordinator already wires for private
   * transport is reused, never a second one). Default false; the LOCAL
   * suppression authority itself (durable, via `paths.archiveSuppressionObservationLogFile`)
   * is unconditional whenever `archiveEnabled` is true, unaffected by this flag.
   */
  readonly archiveSuppressionSyncEnabled?: boolean;
  /**
   * Secure Runtime Alpha 5161-5240 (Canonical Desktop Composition Arc) —
   * mirrors `archiveEnabled`'s own established "optional capability toggle,
   * threaded straight into `#buildRuntimeConfig()`" pattern exactly. Whether
   * to enable the Device Sync Scheduler on the Runtime this Coordinator
   * starts. Default false (unchanged prior behavior for every existing
   * caller) — this Coordinator constructs no Scheduler/attempt logic of its
   * own; `deviceSyncAttemptFn` is the caller's own, already-real
   * `FedosDeviceSyncEventBridge.wrapAttemptFn()` (or any other
   * `FedosDeviceSyncAttemptFn`), unchanged in kind from
   * `startFedosDesktopRuntime()`'s own existing contract.
   */
  readonly deviceSyncSchedulerEnabled?: boolean;
  /** REQUIRED when `deviceSyncSchedulerEnabled` is `true` — this Coordinator constructs no abandonment policy of its own (mirrors `FedosDeviceSyncScheduler`'s own existing required-dependency discipline). */
  readonly deviceSyncAbandonmentPolicy?: FedosDeviceSyncAbandonmentPolicy;
  /** Optional; omitted, every Scheduler tick's own attempt fails closed with `"failed"` — the SAME existing `FedosDesktopRuntimeConfig.deviceSyncAttemptFn` default. */
  readonly deviceSyncAttemptFn?: FedosDeviceSyncAttemptFn;

  // ---------------------------------------------------------------------
  // Secure Runtime Alpha 6521-6600 (FedOS Desktop Beta Production Runtime
  // Configuration Unification Arc) -- every field below this comment is
  // ADDITIVE ONLY, mirroring `archiveEnabled`/`deviceSyncSchedulerEnabled`'s
  // own established "optional capability toggle" convention exactly.
  // Closes the gap the Release Freeze Arc (`76f7fab`) found: this
  // Coordinator previously had NO private-transport wiring of any kind, so
  // none of Direct Ratchet/Peer Capability/Identity Transition/Signed
  // Deletion Request could ever become production-reachable through it.
  // ---------------------------------------------------------------------

  /**
   * Whether to enable the real Private Transport (`FedosPrivateTransport`)
   * on the Runtime this Coordinator starts. REQUIRED for any of the four
   * subsystems below, since all four send/receive control payloads
   * through it. Reuses `accountSigningAuthority` above as the transport's
   * own signing identity — never a second, incoherent signing authority.
   */
  readonly privateTransportEnabled?: boolean;
  /** REQUIRED when `privateTransportEnabled` is `true` — a real, external fact (this Coordinator invents no Relay endpoint of its own, never a fabricated default). */
  readonly conversationTransportRelays?: readonly FedosRelay[];
  readonly directRatchetEnabled?: boolean;
  /** Secure Runtime Alpha 7001-7080 — pass-through to `FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef`'s own doc comment; omitted by default, zero behavior change. */
  readonly directRatchetMessageDeliveryRemoteDeviceRef?: string;
  readonly peerCapabilityEnabled?: boolean;
  /** REQUIRED when `peerCapabilityEnabled` is `true` — this Runtime advertises no capability of its own by default. */
  readonly peerCapabilityLocallySupportedCapabilities?: readonly FedosRatchetPeerCapabilityEntry[];
  /** Secure Runtime Alpha 7081-7160 — pass-through to `FedosDesktopRuntimeConfig.conversationInvitationEnabled`'s own doc comment. */
  readonly conversationInvitationEnabled?: boolean;
  readonly identityTransitionEnabled?: boolean;
  readonly identityTransitionLocalPolicy?: FedosIdentityTransitionLocalPolicy;
  readonly deletionRequestEnabled?: boolean;
  /** REQUIRED when `deletionRequestEnabled` is `true` — LOCAL configuration only, never derived from a request. */
  readonly deletionRequestResolveLocalPolicy?: (requesterAccountRef: string) => FedosDeletionRecipientPolicy;
  /**
   * Secure Runtime Alpha 7161-7240 ("FedOS Conversation-Level Production
   * Crypto and Identity Authority Wiring Arc") — mirrors
   * `directRatchetEnabled`'s own established "optional capability
   * toggle" pattern exactly. When `true`, this Coordinator's own
   * already-required `masterSeedAuthority`/`accountSigningAuthority`/
   * account index (the SAME canonical authorities profile
   * create/unlock already activated — never a second, independently-
   * constructed authority) are threaded through as
   * `FedosDesktopRuntimeConfig.conversationCanonicalCryptoAuthority`,
   * closing the production Conversation-level identity/encryption/NIP-17
   * wiring gap Secure Runtime Alpha 7081-7160 disclosed. Default `false`
   * — zero behavior change for every existing caller.
   */
  readonly conversationCanonicalCryptoEnabled?: boolean;
  /**
   * Secure Runtime Alpha 7161-7240 — pass-through to
   * `FedosDesktopRuntimeConfig.conversationDirectMessageDeliveryRoute`'s
   * own doc comment verbatim (this Coordinator never previously threaded
   * this field at all — a genuine gap this Arc closes, since without it
   * no caller of this Coordinator could ever reach the standard NIP-17
   * message-delivery route, regardless of `conversationCanonicalCryptoEnabled`).
   * Omitted, byte-for-byte unchanged prior behavior (local storage only,
   * no standard delivery attempted).
   */
  readonly conversationDirectMessageDeliveryRoute?: "nostr-nip17-v1";
  /**
   * Secure Runtime Alpha 7161-7240 — a SECOND, previously-undiscovered
   * gap this Arc closes alongside the crypto/identity wiring above: this
   * Coordinator never threaded `FedosDesktopRuntimeConfig.conversationTransportInbound`
   * at all, so no subsystem (Direct Ratchet, Peer Capability, Identity
   * Transition, Deletion Request, Conversation Invitation) could ever
   * receive a real, live, relay-delivered NIP-17 Rumor through the real
   * Coordinator/packaged path — every prior real vertical slice that
   * proved inbound receipt did so by feeding a coordinator-captured
   * record directly to the inbound coordinator, never a live
   * subscription. When `true`, subscribes with the real, standard
   * Gift Wrap kind filter (`FEDOS_GIFT_WRAP_KIND`, NIP-59) — no
   * server-side tag filter exists in this codebase's own
   * `FedosSubscriptionFilter` (`fedos_subscription_filter.ts`'s own doc
   * comment), so client-side classification (wrong-recipient decrypt
   * failure) is the correct, already-real mechanism, exactly like a real
   * NIP-17 client. `onEnvelope` is a real no-op: the legacy proprietary
   * `kind: 24700` delivery format is untouched by this Arc. Default
   * `false` — zero behavior change for every existing caller.
   */
  readonly conversationTransportInboundEnabled?: boolean;
  /** Pass-through to `FedosDesktopRuntimeConfig.conversationTransportIntervalMs`'s own doc comment. Omitted, `30_000` ms (unchanged prior behavior). Never previously threaded through this Coordinator at all — closed alongside the two toggles above. */
  readonly conversationTransportIntervalMs?: number;
}

export class FedosProfileInitializationCoordinator {
  readonly #deps: FedosProfileInitializationDependencies;
  readonly #accountIndex: number;
  readonly #now: () => number;
  readonly #unlockPolicy: FedosUnlockSecretPolicy;
  readonly #startRuntime: (config: FedosDesktopRuntimeConfig) => Promise<FedosRunningDesktopRuntime>;

  #state: FedosProfileLifecycleState = "absent";
  #runtime: FedosRunningDesktopRuntime | null = null;
  #deviceKeypair: FedosDeviceSigningKeypair | null = null;
  #descriptor: FedosLocalProfileDescriptorV1 | null = null;
  #stopped = false;

  constructor(deps: FedosProfileInitializationDependencies) {
    this.#deps = deps;
    this.#accountIndex = deps.accountIndex ?? 0;
    this.#now = deps.now ?? (() => Date.now());
    this.#unlockPolicy = deps.unlockPolicy ?? FEDOS_DEFAULT_UNLOCK_SECRET_POLICY;
    this.#startRuntime = deps.startRuntime ?? startFedosDesktopRuntime;
  }

  get lifecycleState(): FedosProfileLifecycleState {
    return this.#state;
  }

  #transition(event: Parameters<typeof applyFedosProfileLifecycleTransition>[1]): void {
    this.#state = applyFedosProfileLifecycleTransition(this.#state, event);
  }

  // ------------------------------------------------------------------
  // Detection (Phase F: "detect profile").
  // ------------------------------------------------------------------

  /**
   * Reads durable state and reports coarse presence, driving the lifecycle
   * to `absent` / `locked` / `recovery-required`. Fail-closed: a corrupt
   * descriptor or a sealed file with no descriptor (interrupted init) is
   * `recovery-required`, NEVER silently treated as a new profile.
   */
  detectProfileState(): FedosProfileCoordinatorResult<FedosProfileStatusView> {
    let descriptor: FedosLocalProfileDescriptorV1 | null;
    try {
      descriptor = this.#deps.profilePersistence.read();
    } catch (error) {
      if (error instanceof FedosLocalProfileCorruptError) {
        this.#state = "absent";
        this.#transition("corruption-detected");
        return ok(this.#statusView("recovery-required"));
      }
      return fail("failed", "profile read failed");
    }

    if (descriptor === null) {
      // No descriptor. Was there leftover sealed material (interrupted init)?
      let sealedPresent = false;
      try {
        sealedPresent = this.#deps.sealedSeedPersistence.read() !== null;
      } catch {
        // A corrupt sealed file with no descriptor -> recovery-required.
        this.#state = "absent";
        this.#transition("corruption-detected");
        return ok(this.#statusView("recovery-required"));
      }
      if (sealedPresent) {
        this.#state = "absent";
        this.#transition("corruption-detected");
        return ok(this.#statusView("recovery-required"));
      }
      this.#state = "absent";
      return ok(this.#statusView("absent"));
    }

    this.#descriptor = descriptor;
    if (descriptor.initializationState === "ready") {
      this.#state = "absent";
      this.#transition("profile-detected-locked");
      return ok(this.#statusView("locked"));
    }
    if (descriptor.initializationState === "recovery-required") {
      this.#state = "absent";
      this.#transition("corruption-detected");
      return ok(this.#statusView("recovery-required"));
    }
    // "initializing" or "failed" -> an interrupted init. Recovery-required
    // (never a false ready, never a silent overwrite).
    this.#state = "absent";
    this.#transition("corruption-detected");
    return ok(this.#statusView("recovery-required"));
  }

  // ------------------------------------------------------------------
  // Flow A — create a new local profile (Phase E).
  // ------------------------------------------------------------------

  async createProfile(
    input: { readonly displayLabel: string },
    unlockSecret: FedosProfileUnlockSecret,
  ): Promise<FedosProfileCoordinatorResult<FedosProfileReadyView>> {
    // 1. Validate non-secret input BEFORE entering `initializing`.
    const label = typeof input.displayLabel === "string" ? input.displayLabel.trim() : "";
    if (label.length === 0 || label.length > 128) {
      return fail("invalid-input", "display label must be 1-128 characters");
    }
    const secretVerdict = validateFedosUnlockSecretBytes(
      new Uint8Array(Math.max(0, unlockSecret.byteLength)),
      this.#unlockPolicy,
    );
    if (secretVerdict !== "ok") {
      unlockSecret.clear();
      return fail("weak-secret", `unlock secret rejected: ${secretVerdict}`);
    }

    // 2. Refuse to overwrite an existing/partial profile (idempotent create guard).
    const detect = this.detectProfileState();
    if (detect.outcome !== "ok") {
      unlockSecret.clear();
      return fail("failed", "profile detection failed");
    }
    if (detect.value.presence === "locked") {
      unlockSecret.clear();
      return fail("already-exists", "a profile already exists at this location");
    }
    if (detect.value.presence === "recovery-required") {
      unlockSecret.clear();
      return fail("recovery-required", "a partial or corrupt profile exists; recover it, do not create over it");
    }

    this.#state = "absent";
    this.#transition("begin-create");

    // 3. Durable directories.
    if (!ensureFedosLocalProfileDirectories(this.#deps.paths)) {
      unlockSecret.clear();
      this.#transition("initialization-failed");
      return fail("failed", "could not create profile directories");
    }

    // 4. Generate the Master Seed through the existing authority.
    const generated = await this.#deps.masterSeedAuthority.generate();
    if (!generated) {
      unlockSecret.clear();
      this.#transition("initialization-failed");
      return fail("seed-unavailable", "Master Seed generation is unavailable (crypto gate closed)");
    }

    // 5. Seal it (consume the secret exactly once) and persist ONLY sealed material.
    const sealed = await unlockSecret.consume((bytes) => this.#deps.masterSeedAuthority.seal(bytes));
    if (sealed === null) {
      this.#transition("initialization-failed");
      return fail("seed-unavailable", "Master Seed sealing is unavailable (crypto gate closed)");
    }
    const sealWrite = this.#deps.sealedSeedPersistence.writeIfAbsent(sealed);
    if (sealWrite === "already-exists") {
      // Leftover sealed material from an interrupted attempt — do NOT overwrite.
      this.#transition("corruption-detected");
      return fail("recovery-required", "sealed Master Seed material already exists; recover, do not overwrite");
    }
    if (sealWrite === "failed") {
      this.#transition("initialization-failed");
      return fail("failed", "could not persist sealed Master Seed");
    }

    // 6. Resolve the account public identity.
    const identity = await this.#deps.accountSigningAuthority.publicIdentityForAccount(this.#accountIndex);
    if (identity === null) {
      this.#transition("initialization-failed");
      return fail("failed", "could not resolve account public identity");
    }

    // 7. Local Device identity (Phase H) — a real, independent Device key.
    const deviceKeypair = (this.#deps.generateDeviceKeypair ?? generateFedosDeviceSigningKeypair)();
    this.#deviceKeypair = deviceKeypair;
    const localDeviceId = this.#deps.localDeviceId ?? `device-${deviceKeypair.publicKeyHex.slice(0, 16)}`;

    // 8. Persist the descriptor as `initializing` (interrupt-detectable).
    const profileId =
      (this.#deps.generateProfileId ?? (() => bytesToHex(randomBytes(16))))();
    const draft = createFedosLocalProfileDescriptorV1({
      profileId,
      displayLabel: label,
      accountPublicIdentity: { authority: "nostr", publicKeyHex: identity.publicKeyHex },
      localDeviceId,
      createdAt: this.#now(),
      sealedMasterSeedRef: this.#deps.paths.sealedMasterSeedFile,
      dataDirectoryRoot: this.#deps.paths.root,
      initializationState: "initializing",
    });
    if (draft === null) {
      this.#transition("initialization-failed");
      return fail("failed", "could not construct profile descriptor");
    }
    const write = this.#deps.profilePersistence.writeIfAbsent(draft);
    if (write !== "written") {
      this.#transition("corruption-detected");
      return fail("recovery-required", "a profile descriptor already exists; recover, do not overwrite");
    }
    this.#descriptor = draft;

    // 9. Start the Desktop Runtime + bootstrap the local Device + Sync Journal.
    const accountRef: FedosDeviceBindingAccountRef = {
      authority: "nostr",
      publicIdentifier: identity.publicKeyHex,
      identityId: null,
    };
    const startResult = await this.#startAndBootstrap(accountRef, deviceKeypair, localDeviceId);
    if (startResult.outcome !== "ok") {
      // Mark the descriptor failed (NOT deleted) for interrupt detection.
      this.#markDescriptorState("failed");
      this.#transition(
        startResult.outcome === "runtime-start-failed" ? "runtime-start-failed" : "initialization-failed",
      );
      return fail(startResult.outcome, startResult.reason);
    }

    // 10. Mark ready ONLY now.
    this.#markDescriptorState("ready");
    this.#transition("initialization-succeeded");
    return ok(
      this.#readyView(label, identity.publicKeyHex, localDeviceId, startResult.value.deviceTrustState),
    );
  }

  // ------------------------------------------------------------------
  // Flow B / C — unlock an existing local profile (Phase F).
  // ------------------------------------------------------------------

  async unlockProfile(
    unlockSecret: FedosProfileUnlockSecret,
  ): Promise<FedosProfileCoordinatorResult<FedosProfileReadyView>> {
    const detect = this.detectProfileState();
    if (detect.outcome !== "ok") {
      unlockSecret.clear();
      return fail("failed", "profile detection failed");
    }
    if (detect.value.presence === "absent") {
      unlockSecret.clear();
      return fail("no-profile", "no profile to unlock");
    }
    if (detect.value.presence === "recovery-required") {
      unlockSecret.clear();
      return fail("recovery-required", "profile requires recovery; unlock is not possible");
    }

    const descriptor = this.#descriptor;
    if (descriptor === null) {
      unlockSecret.clear();
      return fail("failed", "profile descriptor unavailable");
    }

    // Read the sealed material (fail-closed on corruption).
    let sealed;
    try {
      sealed = this.#deps.sealedSeedPersistence.read();
    } catch {
      unlockSecret.clear();
      this.#transition("begin-unlock");
      this.#transition("corruption-detected");
      return fail("corrupt", "sealed Master Seed material is corrupt");
    }
    if (sealed === null) {
      unlockSecret.clear();
      this.#transition("begin-unlock");
      this.#transition("corruption-detected");
      return fail("corrupt", "sealed Master Seed material is missing");
    }

    this.#transition("begin-unlock");

    // Invoke the existing restore/unseal authority (consume the secret once).
    const restored = await unlockSecret.consume((bytes) =>
      this.#deps.masterSeedAuthority.restoreSealed(sealed!, bytes),
    );
    if (restored !== true) {
      // Wrong secret is an indistinguishable coarse failure — remain locked, retry open.
      this.#transition("unlock-failed");
      return fail("unlock-failed", "unlock failed");
    }

    // Validate restored account identity against the persisted public identity.
    const identity = await this.#deps.accountSigningAuthority.publicIdentityForAccount(this.#accountIndex);
    if (identity === null || identity.publicKeyHex !== descriptor.accountPublicIdentity.publicKeyHex) {
      await this.#deps.masterSeedAuthority.clear();
      this.#transition("identity-mismatch");
      return fail("identity-mismatch", "restored identity does not match the profile");
    }

    // Hydrate durable authorities + start the Runtime.
    const deviceKeypair = (this.#deps.generateDeviceKeypair ?? generateFedosDeviceSigningKeypair)();
    this.#deviceKeypair = deviceKeypair;
    const accountRef: FedosDeviceBindingAccountRef = {
      authority: "nostr",
      publicIdentifier: identity.publicKeyHex,
      identityId: null,
    };
    const startResult = await this.#startAndBootstrap(accountRef, deviceKeypair, descriptor.localDeviceId);
    if (startResult.outcome !== "ok") {
      await this.#deps.masterSeedAuthority.clear();
      this.#transition("runtime-start-failed");
      return fail(startResult.outcome, startResult.reason);
    }

    this.#markDescriptorState("ready");
    this.#transition("unlock-succeeded");
    return ok(
      this.#readyView(
        descriptor.displayLabel,
        identity.publicKeyHex,
        descriptor.localDeviceId,
        startResult.value.deviceTrustState,
      ),
    );
  }

  // ------------------------------------------------------------------
  // Phase M — lock / shutdown (idempotent).
  // ------------------------------------------------------------------

  /**
   * Stops the active Runtime, clears in-memory unlock material, and returns
   * to the locked/stopped state — leaving durable encrypted state intact.
   * Idempotent: a second call is a safe no-op `ok`.
   */
  async lock(): Promise<FedosProfileCoordinatorResult<{ readonly lifecycleState: FedosProfileLifecycleState }>> {
    if (this.#runtime !== null && !this.#stopped) {
      try {
        await this.#runtime.stop();
      } catch {
        // stop() is non-idempotent at the Runtime layer; a throw here is
        // treated as already-stopped. We never surface a raw Error.
      }
      this.#stopped = true;
    }
    this.#runtime = null;
    if (this.#deviceKeypair !== null) {
      // The Device keypair is an opaque handle; drop our reference.
      this.#deviceKeypair = null;
    }
    // Best-effort clear of in-memory seed authority state.
    try {
      await this.#deps.masterSeedAuthority.clear();
    } catch {
      /* never throws to the caller */
    }
    if (this.#state === "ready") {
      this.#transition("lock"); // ready -> stopped
    }
    return ok({ lifecycleState: this.#state });
  }

  /** The running Runtime handle, or `null` if not `ready`. For the Shell/host to reach conversation/device commands after unlock. Never exposes a secret. */
  runningRuntime(): FedosRunningDesktopRuntime | null {
    return this.#state === "ready" ? this.#runtime : null;
  }

  /**
   * Secure Runtime Alpha 5061-5160 (FedOS Desktop Beta 0.1 Integration Arc) —
   * additive Phase E hook for a CONFIRMED Runtime-restart flow (e.g.
   * `FedosDesktopBetaApplicationAssembly`, `../beta/fedos_desktop_beta_application_assembly.ts`).
   *
   * A Runtime-only restart (relay list / archive directory / other
   * construction-time Settings) must replace the ONE Runtime this Coordinator
   * itself started during unlock/create, WITHOUT re-running unlock and WITHOUT
   * clearing the Master Seed authority (`lock()` does both — wrong for this
   * case; Phase E requires "preserve profile unlocked state"). Without this
   * method, the composed assembly would have to keep its own duplicate
   * Runtime pointer, and `runningRuntime()`/`status().runtimeRunning` would
   * silently go stale (still describing the OLD, now-stopped Runtime) after a
   * confirmed restart — an honesty defect this Coordinator's own guardrails
   * (never a false `ready`, never stale state) exist specifically to prevent.
   *
   * Callable ONLY while `ready` (a confirmed restart is meaningless before a
   * successful unlock/create, and never while locked). The caller is solely
   * responsible for having already stopped the OLD Runtime and started the
   * NEW one through the existing `startFedosDesktopRuntime()` entry point —
   * this method performs no I/O and constructs nothing itself.
   */
  adoptReplacementRuntime(runtime: FedosRunningDesktopRuntime): FedosProfileCoordinatorResult<null> {
    if (this.#state !== "ready") {
      return fail("not-ready", "cannot adopt a replacement Runtime unless the profile is ready/unlocked");
    }
    this.#runtime = runtime;
    this.#stopped = false;
    return ok(null);
  }

  recoveryNotice(): FedosProfileRecoveryNotice {
    return buildFedosProfileRecoveryNotice(this.#deps.paths, {
      conversationArchiveExportAvailable: this.#deps.archiveEnabled === true,
    });
  }

  status(): FedosProfileStatusView {
    const presence: FedosProfilePresence =
      this.#state === "ready"
        ? "locked"
        : this.#state === "recovery-required"
          ? "recovery-required"
          : this.#state === "absent"
            ? "absent"
            : this.#state === "initializing" || this.#state === "unlocking"
              ? "in-progress"
              : "locked";
    return this.#statusView(this.#state === "ready" ? "locked" : presence, true);
  }

  // ------------------------------------------------------------------
  // Internal helpers.
  // ------------------------------------------------------------------

  async #startAndBootstrap(
    accountRef: FedosDeviceBindingAccountRef,
    deviceKeypair: FedosDeviceSigningKeypair,
    localDeviceId: string,
  ): Promise<FedosProfileCoordinatorResult<{ readonly deviceTrustState: string }>> {
    const config = this.#buildRuntimeConfig(accountRef, localDeviceId);
    let runtime: FedosRunningDesktopRuntime;
    try {
      runtime = await this.#startRuntime(config);
    } catch {
      return fail("runtime-start-failed", "Desktop Runtime failed to start");
    }
    this.#runtime = runtime;
    this.#stopped = false;

    // Phase H — bootstrap the local Device through the real pairing proofs.
    const deviceTrustState = await this.#bootstrapLocalDevice(runtime, deviceKeypair, accountRef, localDeviceId);
    return ok({ deviceTrustState });
  }

  #buildRuntimeConfig(
    accountRef: FedosDeviceBindingAccountRef,
    localDeviceId: string,
  ): FedosDesktopRuntimeConfig {
    const paths = this.#deps.paths;
    return {
      boardLogPath: paths.boardLogFile,
      outboxLogPath: paths.outboxLogFile,
      deliveryEnabled: false,
      conversationLogPath: paths.conversationLogFile,
      conversationEnvelopeLogPath: paths.conversationEnvelopeLogFile,
      conversationPayloadLogPath: paths.conversationPayloadLogFile,
      conversationMembershipLogPath: paths.conversationMembershipLogFile,
      // Secure Runtime Alpha 7081-7160 -- real, narrow bug fix: this field
      // already existed on FedosDesktopRuntimeConfig but was never
      // supplied here, so Draft persistence silently defaulted to
      // in-memory-only (lost on every restart). See
      // fedos_local_profile_paths.ts's own doc comment on this field.
      conversationDraftLogPath: paths.conversationDraftLogFile,
      // Secure Runtime Alpha 7241-7320 -- real, narrow bug fix, the SAME
      // class as `conversationDraftLogPath` immediately above: both
      // fields already existed on `FedosDesktopRuntimeConfig` (Alpha
      // 923/1143) but were never supplied here, so Capability/Payload
      // Retention state silently defaulted to in-memory-only (lost on
      // every real restart) even through the real production Coordinator
      // path. Unconditional, mirroring `conversationMembershipLogPath`'s
      // own discipline -- neither field is gated behind a dependency
      // toggle in `FedosDesktopRuntimeConfig`.
      conversationCapabilityLogPath: paths.conversationCapabilityLogFile,
      conversationPayloadRetentionLogPath: paths.conversationPayloadRetentionLogFile,
      deviceTrustEnabled: true,
      localDeviceId,
      localAccountRef: accountRef,
      deviceRegistryLogPath: paths.deviceRegistryLogFile,
      deviceBindingChallengeReplayLogPath: paths.deviceBindingReplayLogFile,
      deviceBindingAccountSigningAuthority: this.#deps.accountSigningAuthority,
      deviceBindingAccountIndex: this.#accountIndex,
      deviceSyncJournalLogPath: paths.syncJournalLogFile,
      archiveEnabled: this.#deps.archiveEnabled === true,
      conversationArchiveMasterSeedAuthority:
        this.#deps.archiveEnabled === true ? this.#deps.masterSeedAuthority : undefined,
      // Secure Runtime Alpha 7881-7960 -- unconditional, mirrors
      // `conversationCapabilityLogPath`/`conversationPayloadRetentionLogPath`'s
      // own discipline immediately above: a real profile's own local
      // suppression facts survive restart regardless of whether Device
      // Sync propagation is ever enabled.
      archiveSuppressionObservationLogPath: paths.archiveSuppressionObservationLogFile,
      archiveSuppressionSyncEnabled: this.#deps.archiveSuppressionSyncEnabled === true,
      archiveSuppressionInboundDedupLogPath:
        this.#deps.archiveSuppressionSyncEnabled === true ? paths.archiveSuppressionInboundDedupLogFile : undefined,
      archiveSuppressionFanoutObservationLogPath:
        this.#deps.archiveSuppressionSyncEnabled === true ? paths.archiveSuppressionFanoutObservationLogFile : undefined,
      deviceSyncSchedulerEnabled: this.#deps.deviceSyncSchedulerEnabled === true,
      deviceSyncAbandonmentPolicy:
        this.#deps.deviceSyncSchedulerEnabled === true ? this.#deps.deviceSyncAbandonmentPolicy : undefined,
      deviceSyncAttemptFn:
        this.#deps.deviceSyncSchedulerEnabled === true ? this.#deps.deviceSyncAttemptFn : undefined,
      deviceSyncScheduleLogPath: this.#deps.deviceSyncSchedulerEnabled === true ? paths.syncScheduleLogFile : undefined,
      deviceSyncConflictLogPath: this.#deps.deviceSyncSchedulerEnabled === true ? paths.syncConflictLogFile : undefined,
      // Secure Runtime Alpha 6521-6600 -- mirrors `archiveEnabled`'s own
      // established "optional capability toggle" convention exactly.
      // `conversationTransportSigningAuthority` reuses `accountSigningAuthority`
      // above verbatim — the SAME real identity, never a second, incoherent
      // signing authority.
      privateTransportEnabled: this.#deps.privateTransportEnabled === true,
      conversationTransportRelays: this.#deps.privateTransportEnabled === true ? this.#deps.conversationTransportRelays : undefined,
      conversationTransportObservationLogPath: this.#deps.privateTransportEnabled === true ? paths.conversationTransportObservationLogFile : undefined,
      conversationTransportSigningAuthority: this.#deps.privateTransportEnabled === true ? this.#deps.accountSigningAuthority : undefined,
      conversationTransportAccountIndex: this.#deps.privateTransportEnabled === true ? this.#accountIndex : undefined,
      directRatchetEnabled: this.#deps.directRatchetEnabled === true,
      directRatchetSessionLogPath: this.#deps.directRatchetEnabled === true ? paths.directRatchetSessionLogFile : undefined,
      directRatchetSealedSecretLogPath: this.#deps.directRatchetEnabled === true ? paths.directRatchetSealedSecretLogFile : undefined,
      directRatchetResetRecordLogPath: this.#deps.directRatchetEnabled === true ? paths.directRatchetResetRecordLogFile : undefined,
      directRatchetImportRecordLogPath: this.#deps.directRatchetEnabled === true ? paths.directRatchetImportRecordLogFile : undefined,
      // Secure Runtime Alpha 6841-6920 -- mirrors `conversationArchiveMasterSeedAuthority`'s
      // own established line immediately above (in file order at Alpha 1691-1760)
      // exactly: reuses `this.#deps.masterSeedAuthority` directly, never a second,
      // independently-constructed authority.
      conversationDirectRatchetMasterSeedAuthority: this.#deps.directRatchetEnabled === true ? this.#deps.masterSeedAuthority : undefined,
      // Secure Runtime Alpha 7161-7240 -- mirrors the line immediately
      // above exactly: reuses `this.#deps.masterSeedAuthority`/
      // `this.#deps.accountSigningAuthority`/`this.#accountIndex`
      // directly, never a second, independently-constructed authority.
      conversationCanonicalCryptoAuthority:
        this.#deps.conversationCanonicalCryptoEnabled === true
          ? {
              masterSeedAuthority: this.#deps.masterSeedAuthority,
              signingAuthority: this.#deps.accountSigningAuthority,
              accountIndex: this.#accountIndex,
            }
          : undefined,
      conversationDirectMessageDeliveryRoute: this.#deps.conversationDirectMessageDeliveryRoute,
      conversationTransportInbound:
        this.#deps.conversationTransportInboundEnabled === true
          ? { filter: { kinds: [FEDOS_GIFT_WRAP_KIND] }, onEnvelope: () => {} }
          : undefined,
      conversationTransportIntervalMs: this.#deps.conversationTransportIntervalMs,
      directRatchetMessageDeliveryRemoteDeviceRef: this.#deps.directRatchetEnabled === true ? this.#deps.directRatchetMessageDeliveryRemoteDeviceRef : undefined,
      peerCapabilityEnabled: this.#deps.peerCapabilityEnabled === true,
      peerCapabilityLocallySupportedCapabilities: this.#deps.peerCapabilityEnabled === true ? this.#deps.peerCapabilityLocallySupportedCapabilities : undefined,
      peerCapabilityObservationLogPath: this.#deps.peerCapabilityEnabled === true ? paths.peerCapabilityObservationLogFile : undefined,
      conversationInvitationEnabled: this.#deps.conversationInvitationEnabled === true,
      conversationInvitationReceivedLogPath: this.#deps.conversationInvitationEnabled === true ? paths.conversationInvitationReceivedLogFile : undefined,
      identityTransitionEnabled: this.#deps.identityTransitionEnabled === true,
      identityTransitionObservationLogPath: this.#deps.identityTransitionEnabled === true ? paths.identityTransitionObservationLogFile : undefined,
      identityTransitionLocalDecisionLogPath: this.#deps.identityTransitionEnabled === true ? paths.identityTransitionLocalDecisionLogFile : undefined,
      identityTransitionLocalPolicy: this.#deps.identityTransitionEnabled === true ? this.#deps.identityTransitionLocalPolicy : undefined,
      deletionRequestEnabled: this.#deps.deletionRequestEnabled === true,
      deletionRequestResolveLocalPolicy: this.#deps.deletionRequestEnabled === true ? this.#deps.deletionRequestResolveLocalPolicy : undefined,
      deletionRequestStateLogPath: this.#deps.deletionRequestEnabled === true ? paths.deletionRequestStateLogFile : undefined,
      deletionRequestDecisionLogPath: this.#deps.deletionRequestEnabled === true ? paths.deletionRequestDecisionLogFile : undefined,
      deletionRequestAcknowledgementLogPath: this.#deps.deletionRequestEnabled === true ? paths.deletionRequestAcknowledgementLogFile : undefined,
      deletionRequestExecutionLogPath: this.#deps.deletionRequestEnabled === true ? paths.deletionRequestExecutionLogFile : undefined,
      deletionRequestInboxSummaryLogPath: this.#deps.deletionRequestEnabled === true ? paths.deletionRequestInboxSummaryLogFile : undefined,
      deletionRequestPendingReviewLogPath: this.#deps.deletionRequestEnabled === true ? paths.deletionRequestPendingReviewLogFile : undefined,
    };
  }

  /**
   * Phase H — registers THIS machine's own local Device through the real
   * pairing exchange (createPairingRequest -> approvePairingRequest ->
   * completePairing), with real BIP-340 proofs on both the account and
   * Device sides. The first Device is NOT special-cased with a
   * caller-supplied `trusted=true`; it proves possession and is authorized
   * by the same account signature every other Device uses. If no account
   * signing capability is available (`approvePairingRequest` -> "disabled"),
   * the Device remains at the honest boundary and the profile still reaches
   * ready with a `"pending"`/`"unavailable"` Device trust state (documented,
   * never faked).
   */
  async #bootstrapLocalDevice(
    runtime: FedosRunningDesktopRuntime,
    deviceKeypair: FedosDeviceSigningKeypair,
    accountRef: FedosDeviceBindingAccountRef,
    localDeviceId: string,
  ): Promise<string> {
    let pairing;
    try {
      pairing = runtime.devicePairing();
    } catch {
      return "unavailable";
    }
    const created = pairing.createPairingRequest(localDeviceId, deviceKeypair, accountRef);
    if (created.outcome !== "ok") return "failed";
    const approval = await pairing.approvePairingRequest(created.value.encoded);
    if (approval.outcome === "disabled") return "unavailable";
    if (approval.outcome !== "ok") return "failed";
    const completed = await pairing.completePairing(
      created.value.pairingId,
      deviceKeypair,
      approval.value.encoded,
    );
    if (completed.outcome !== "ok") return "failed";
    return completed.value.trustState;
  }

  #markDescriptorState(state: "ready" | "failed" | "recovery-required"): void {
    if (this.#descriptor === null) return;
    const mappedState = state === "ready" ? "ready" : state === "failed" ? "failed" : "recovery-required";
    const next = withFedosLocalProfileInitializationState(this.#descriptor, mappedState, this.#now());
    if (next === null) return;
    this.#descriptor = next;
    this.#deps.profilePersistence.update(next);
  }

  #statusView(presence: FedosProfilePresence, runtimeRunning = false): FedosProfileStatusView {
    const descriptor = this.#descriptor;
    return Object.freeze({
      lifecycleState: this.#state,
      presence,
      displayLabel: descriptor?.displayLabel ?? null,
      accountPublicIdentifier: descriptor?.accountPublicIdentity.publicKeyHex ?? null,
      localDeviceId: descriptor?.localDeviceId ?? null,
      runtimeRunning: runtimeRunning && this.#runtime !== null && !this.#stopped,
    });
  }

  #readyView(
    displayLabel: string,
    accountPublicIdentifier: string,
    localDeviceId: string,
    deviceTrustState: string,
  ): FedosProfileReadyView {
    return Object.freeze({
      lifecycleState: "ready" as const,
      displayLabel,
      accountPublicIdentifier,
      localDeviceId,
      deviceTrustState,
      recoveryNotice: this.recoveryNotice(),
    });
  }
}
