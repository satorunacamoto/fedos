/**
 * Secure Runtime Alpha 5061-5160 ("FedOS Desktop Beta 0.1 Integration,
 * Release Candidate, and Acceptance Freeze Arc") — the ONE canonical Beta
 * Electron entry point. A NEW, ADDITIVE sibling main-process entry point,
 * never a modification of any prior `*_main.cts` — all seven remain
 * untouched, preserved as accepted test/harness entry points (Phase C: "do
 * not silently delete accepted test harnesses").
 *
 * WHAT THIS FILE CLOSES (Phase C release-blocking finding, see
 * `docs/secure_runtime_alpha_5061_5160_reconciliation_report.md`): no prior
 * Electron main composed BOTH the real production unlock chain
 * (`fedos_electron_unlock_main.cts`'s own pattern) AND a live
 * Presentation/Settings-application boundary over the SAME Runtime.
 *
 * -----------------------------------------------------------------------
 * Secure Runtime Alpha 5161-5240 ("Canonical Desktop Composition and Beta
 * Release-Blocker Closure Arc") — EXTENDS this file (never replaces it) to
 * also compose the already-accepted Navigation / Notification / Tray /
 * Badge / Background-Lifecycle / Device-Sync-Event layer into this SAME
 * canonical entry point, closing BLK-1 the immediately-prior Arc's own
 * reconciliation report disclosed:
 *
 *   packaged Electron main
 *     -> production activation authority (host attestation + pinned manifest)
 *     -> real WASM Master Seed generate/restore (NO dev seed double)
 *     -> the UNCHANGED FedosProfileInitializationCoordinator (now ALSO given
 *        the additive `deviceSyncSchedulerEnabled`/`deviceSyncAttemptFn`
 *        dependency, mirroring `archiveEnabled`'s own established pattern)
 *     -> Desktop Runtime starts EXACTLY ONCE
 *     -> FedosDesktopBetaApplicationAssembly composes ONE Shell/Boundary,
 *        ONE Navigation Registry, ONE Tray/Badge/Notification/Background-
 *        Lifecycle Coordinator, and ONE Device Sync Presentation Wiring over
 *        that SAME Runtime — plus the Alpha 4981-5060 Settings Application
 *        Coordinator's own startup application
 *     -> ready / locked application state
 *
 * ELECTRON-SIDE ADAPTERS REUSED VERBATIM (Alpha 4261-4340/4341-4420,
 * UNMODIFIED): `FedosElectronNotificationAdapter`, `FedosElectronTrayAdapter`,
 * `FedosElectronBadgeAdapter` — the SAME classes `fedos_electron_badge_main.cts`
 * already proves work; this file constructs exactly one of each and hands
 * them to the assembly as ports, mirroring that file's own established
 * "Electron only hosts UI" discipline. `FedosDeviceSyncEventBridge` is
 * constructed BEFORE `unlockProfile()`/`createProfile()` so its own
 * `wrapAttemptFn()` can be threaded into the Coordinator's Runtime-
 * construction config — its `listener` closure reads the module-level
 * `activeAssembly` (set only AFTER a successful unlock), the IDENTICAL
 * indirection technique `fedos_electron_badge_main.cts` already established
 * for its own `wiring`/`eventBridge` pair.
 *
 * DISCLOSED SCOPE BOUNDARY (Phase C, honest, restated from this Arc's own
 * reconciliation report): this file composes ONE window's own Navigation
 * controller and the Tray/Badge/Notification layer over it; it does not
 * (yet) build a full multi-window conversation UI — that remains
 * `fedos_electron_badge_main.cts`'s own more developed renderer surface.
 * Real, tested, and reachable through IPC here: Navigation Registry session
 * state, Tray dispatch, Badge refresh/mark-viewed, Background Lifecycle,
 * Device Sync operational status/start/stop — the SAME real objects a
 * richer renderer would consume.
 *
 * OWNERSHIP (mirrors `fedos_electron_unlock_main.cts`'s own discipline
 * exactly): at most ONE ready coordinator (`activeCoordinator`) + ONE
 * assembly (`activeAssembly`) exist at a time, constructed ONLY after a
 * successful create/unlock. `lock()` stops background sync + the ONE
 * Runtime (via `activeAssembly.shutdown()`), THEN drops both references.
 * Concurrent create/unlock/lock are serialized by `ipcCommands`' shared
 * "profile-lifecycle" group (see fedos_electron_ipc_command_registry.ts).
 *
 * SECURITY: identical `contextIsolation`/`nodeIntegration`/`sandbox`/
 * `webSecurity` mandatory literals as every prior package's own main.cts.
 * The passphrase arrives ONLY through the closed `fedos-profile:create` /
 * `fedos-profile:unlock` commands (REUSED verbatim from
 * `fedos_electron_unlock_main.cts`, per Phase P "do not rename existing
 * accepted surfaces"), wrapped in the redacting `FedosProfileUnlockSecret`,
 * never logged/echoed/persisted.
 *
 * -----------------------------------------------------------------------
 * Secure Runtime Alpha 7321-7400 ("FedOS Desktop Production Feature
 * Reachability Arc") — closes the Release Readiness Review's own B-1/B-2/
 * B-3/B-7 findings: `secureRuntimeBundleConfig()` now enables the five
 * flags that were silently absent (`conversationCanonicalCryptoEnabled`/
 * `conversationDirectMessageDeliveryRoute`/`conversationTransportInboundEnabled`/
 * `conversationInvitationEnabled`/`archiveEnabled`), so a real, packaged,
 * unlocked profile can genuinely deliver an invitation and messages over
 * the real relay (never merely "sent-locally") and export/import a real
 * Archive; `requireShell()`/the new `requireBoundary()` no longer require
 * `AUTOTEST_MODE` — a real unlocked profile is now the ONLY precondition,
 * in ANY mode, closing the "AUTOTEST-only path" this Review named. Four
 * new commands (`create-conversation-invitation`/`search`/`archive`/
 * `safety-center-overview`) close B-2/B-7 for good — each a thin,
 * validated wrapper over an ALREADY-REAL `FedosDesktopApplicationShell`/
 * `FedosSafetyCenterController` method, never a new business-logic
 * implementation. `AUTOTEST_MODE` itself is UNCHANGED as a test-driving
 * convenience (offscreen window, the scripted "create"/"unlock"/
 * "acceptance" headless startup branches below) — it no longer gates
 * whether the acceptance vocabulary FUNCTIONS, only whether this file
 * drives itself through a scripted sequence at startup for automated
 * testing, exactly like a real user's own click-through would reach the
 * SAME handlers. No visual renderer screen is added for these four new
 * commands in this Arc (disclosed scope decision, see this Arc's own
 * execution specification) — consistent with this codebase's own
 * long-standing, repeatedly-restated choice to defer the full
 * conversation UI to a later Arc; "UI → Runtime routing" here means the
 * IPC main-process handler + preload bridge layer, the SAME layer every
 * existing `fedos-acceptance:*` command already used before this Arc.
 */

// ---------------------------------------------------------------------
// FedOS Real Digital Delivery Release Closure -- installed-startup
// root-cause pass. Registered as the FIRST executable statements in this
// file, before every other import below, so a synchronous throw or
// unhandled rejection anywhere during THIS file's own module-load (or a
// transitive local/dependency import's) is captured to disk before
// Electron's own default main-process-exception behavior (a native
// "Error" dialog that closes itself with no persisted evidence -- see
// `docs/commerce/PACKAGED-BINARY-STARTUP-ERROR-FINDING.md`) can hide it.
// Durable, not a throwaway probe: crash diagnostics for a packaged
// desktop app are a genuine, permanent operational need. No secrets are
// ever at risk -- this file has not read any passphrase/Master
// Seed/key material by the time module-load could fail, and only the
// thrown error's own message/stack plus a coarse lifecycle label are
// ever written, the SAME best-effort disk-mirror idiom `logCheckpoint()`
// below already establishes for later lifecycle points, extended here to
// also cover the earlier window that idiom's own definition cannot reach
// (it does not exist yet while this module is still loading).
// `FEDOS_ELECTRON_BETA_CRASH_LOG_FILE` overrides the path for tests /
// diagnostics; a real launch with nothing set falls back to the OS temp
// directory, which every launch (dev, packaged, manual) always has.
// ---------------------------------------------------------------------
import * as earlyFs from "node:fs";
import * as earlyPath from "node:path";
import * as earlyOs from "node:os";

const EARLY_CRASH_LOG_FILE =
  process.env.FEDOS_ELECTRON_BETA_CRASH_LOG_FILE ??
  earlyPath.join(earlyOs.tmpdir(), "fedos-electron-beta-startup-crash.log");

function writeEarlyStartupCrashEvidence(label: string, err: unknown): void {
  try {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    earlyFs.mkdirSync(earlyPath.dirname(EARLY_CRASH_LOG_FILE), { recursive: true });
    earlyFs.appendFileSync(
      EARLY_CRASH_LOG_FILE,
      `FEDOS_ELECTRON_BETA_STARTUP_CRASH:${label}:${Date.now()}:${detail}\n`,
    );
  } catch {
    /* best-effort only -- must never itself throw during startup */
  }
}

process.on("uncaughtException", (err) => {
  writeEarlyStartupCrashEvidence("uncaughtException", err);
  // Fail closed and deterministic rather than continuing in a state this
  // process never expected to be running in (Node suppresses its OWN
  // default crash-and-exit behavior once any listener is registered).
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  writeEarlyStartupCrashEvidence("unhandledRejection", reason);
  process.exit(1);
});

import { app, BrowserWindow, ipcMain, dialog, type IpcMainInvokeEvent } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { randomBytes as nodeRandomBytes } from "node:crypto";
import { FedosElectronNotificationAdapter } from "./fedos_electron_notification_adapter.js";
import { FedosElectronTrayAdapter } from "./fedos_electron_tray_adapter.js";
import { FedosElectronBadgeAdapter, type FedosElectronBadgeTrayMenuItemLike } from "./fedos_electron_badge_adapter.js";
import { FedosIpcCommandRegistry } from "./fedos_electron_ipc_command_registry.js";
import { createFedosDeletionRequestSendHandler, createFedosDeletionRequestSentStatusHandler } from "./fedos_electron_deletion_request_send_ipc.js";
import {
  createFedosIdentityTransitionAssessContinuityHandler,
  createFedosIdentityTransitionAuthorizeRatchetResetHandler,
} from "./fedos_electron_identity_transition_ratchet_reset_ipc.js";
import {
  FEDOS_COMMERCE_DEMO_PRODUCTS,
  FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA,
  fedosCommerceDemoMerchantLabel,
  type FedosCommerceDemoProduct,
} from "./fedos_electron_beta_commerce_demo_catalog.js";

const APP_ID = "com.fedos.desktop.beta";
const APP_VERSION = "0.1.0-beta.1";

const DEV_TOOLS_ENABLED = process.env.FEDOS_ELECTRON_BETA_DEVTOOLS === "1";
const AUTOTEST_MODE = process.env.FEDOS_ELECTRON_BETA_AUTOTEST ?? "";
/** TEST-INJECTION ONLY — see `fedos_electron_unlock_main.cts`'s own identical note. Never read on a normal launch. */
const AUTOTEST_SECRET = process.env.FEDOS_BETA_AUTOTEST_SECRET ?? "";

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 1 (external audit
 * delta `6873d24f`): `fedos-acceptance:*` used to be registered
 * unconditionally in every launch mode, relying ONLY on each handler's own
 * `requireBoundary()` (real-unlocked-profile) check as its security
 * boundary — meaning a compromised/scripted renderer or a CDP session
 * attached to an ORDINARY packaged production launch could still reach
 * the entire acceptance vocabulary once a profile was unlocked, with no
 * visible product surface disclosing that this second bridge exists.
 * `ACCEPTANCE_MODE_ENABLED` is a SECOND, independent gate, additive to
 * (never a replacement for) `requireBoundary()`: the channel itself is
 * now only ever registered when this exact, closed value is present.
 * Checked against a closed literal (`=== "acceptance"`), never a truthy/
 * non-empty check, so a malformed or accidental non-empty
 * `FEDOS_ELECTRON_BETA_AUTOTEST` value (e.g. a typo, or a stray value
 * leaked from an unrelated tool) cannot enable it — only the exact,
 * deliberately-set test-harness value can. This env var is a real OS
 * process environment variable, set once at process spawn by whoever
 * launches Electron; no code running inside the sandboxed, isolated
 * Renderer world can read or influence it. A release build never sets
 * it (confirmed: `scripts/build_release.mjs`/`run_electron_builder_package_beta.mjs`
 * launch the packaged app with no such variable). The preload
 * (`fedos_electron_beta_preload.cts`) independently re-derives this SAME
 * check from its own `process.env` read — two independent enforcement
 * points (channel registration here, bridge exposure there), never one
 * hidden only in the page.
 */
const ACCEPTANCE_MODE_ENABLED = AUTOTEST_MODE === "acceptance";

/**
 * FedOS Commerce FINAL Closure (Agent X) — packaged-binary acceptance
 * reachability fix. Root cause (reproduced live, not guessed): when this
 * package's own `electron-builder`-packaged Windows executable (the
 * renamed/resource-edited copy of `electron.exe` that `npm run
 * package:beta`/NSIS install produce — NOT the raw `node_modules/electron`
 * dev binary) is launched with its stdout/stderr handles redirected to
 * ANY non-NUL target (an anonymous pipe, a real file, or an inherited
 * console handle — all three reproduced), the process never completes
 * Chromium's multi-process bootstrap (zero GPU/utility child processes
 * ever spawn, confirmed via live process-tree inspection over 40s) and
 * never calls back into this file's own code at all — so EVERY
 * `console.log`-based signal (`FEDOS_ELECTRON_BETA_UI_STEP_JSON`, the
 * `ui-script`/`acceptance` step markers) and even the disk-based
 * screenshot writer are equally unreachable, matching exactly what the
 * Commerce E2E Completion arc's own "known limitation" observed. Only
 * `stdio: "ignore"` (true NUL, no redirection at all — confirmed live,
 * matches a plain `Start-Process`/double-click launch) lets the packaged
 * binary proceed normally. This is an environment/Chromium-sandbox
 * interaction with inherited stdio handles, not a bug in this file's own
 * logic — no `app.isPackaged` branch exists anywhere near this code, and
 * the SAME `AUTOTEST_MODE=ui-script` loop below already works perfectly
 * against the dev-launched binary under IDENTICAL pipe-redirected stdio.
 * Since a harness driving the packaged binary MUST therefore use
 * `stdio: "ignore"` (no stdout/stderr capture is possible), it needs a
 * disk-based evidence channel that does not depend on being able to
 * observe this process's own stdout at all — this env var opts into
 * exactly that, additively, alongside (never replacing) the existing
 * console marker every other caller (including the dev-launch test
 * `commerce_e2e_full_happy_path_real_electron.test.ts`) already reads.
 * Empty by default; a real production launch never sets it (confirmed:
 * `scripts/run_electron_builder_package_beta.mjs`/`scripts/build_release.mjs`
 * launch nothing and set no env vars at packaging time — this is read
 * only at RUNTIME, by whoever spawns the already-built exe, exactly like
 * every other `FEDOS_ELECTRON_BETA_*`/`FEDOS_BETA_*` test-only override
 * in this file).
 */
const UI_STEP_LOG_FILE = process.env.FEDOS_BETA_UI_STEP_LOG_FILE ?? "";

/**
 * FedOS Commerce FINAL Closure (Agent X) — same disk-mirror idiom as
 * `UI_STEP_LOG_FILE` above, for a handful of coarse LIFECYCLE checkpoints
 * (never step-level detail) so a harness running under `stdio: "ignore"`
 * (the only mode that reliably reaches the packaged binary at all — see
 * `UI_STEP_LOG_FILE`'s own doc comment) can pinpoint WHICH phase a run is
 * in without any console access. No-op unless `UI_STEP_LOG_FILE` is set;
 * failures are swallowed (best-effort diagnostic only, never masks or
 * replaces a real assertion).
 */
function logCheckpoint(label: string): void {
  if (UI_STEP_LOG_FILE.length === 0) return;
  try {
    fs.mkdirSync(path.dirname(UI_STEP_LOG_FILE), { recursive: true });
    fs.appendFileSync(UI_STEP_LOG_FILE, `FEDOS_ELECTRON_BETA_CHECKPOINT:${label}:${Date.now()}\n`);
  } catch {
    /* best-effort only */
  }
}

const MAX_LABEL_CHARS = 128;
const MAX_SECRET_BYTES = 1024;
const MAX_ID_LENGTH = 512;
/** Commerce E2E Completion arc — bounds for the new Merchant Product CRUD / Order IPC surface. Same discipline as every bound above: sized for the field, never generous "just in case". */
const MAX_PRODUCT_TITLE_CHARS = 200;
const MAX_PRODUCT_DESCRIPTION_CHARS = 4000;
const MAX_CURRENCY_CHARS = 8;
const MAX_ORDER_REJECTION_REASON_CHARS = 500;
/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- bounds for the new product-image-attach IPC surface (arc
 * §38 / friction-ledger row #17). `MAX_PRODUCT_IMAGE_BASE64_CHARS` bounds
 * the base64-encoded transport form (renderer -> IPC -> main); the
 * DECODED byte bound (`COMMERCE_MEDIA_MAX_PAYLOAD_BYTES`, already declared
 * below near `commerceMediaStoreFor()`) is the real, authoritative size
 * gate `IpfsMediaStore.put()` itself enforces. Base64 expands ~4/3, so
 * this transport bound is sized generously above that expansion, never
 * the reverse (a base64 string just under this bound must still decode to
 * ≤ the real byte bound, or `IpfsMediaStore.put()` itself rejects it as
 * `"oversized"` -- belt and suspenders, not a second source of truth).
 */
const MAX_PRODUCT_IMAGE_BASE64_CHARS = 12_000_000;
const MAX_PRODUCT_IMAGE_ALT_TEXT_CHARS = 300;
const MAX_PRODUCT_IMAGE_CONTENT_TYPE_CHARS = 64;
const COMMERCE_PUBLIC_IMAGE_CONTENT_TYPES: ReadonlySet<string> = new Set(["image/png", "image/jpeg"]);
/**
 * Buyer Discovery + Digital Content Delivery mega-arc (Agent M) — bounds
 * for the new PROTECTED product-content-attach IPC surface
 * (`handleCommerceProductContentAttach()` below). Mirrors
 * `MAX_PRODUCT_IMAGE_BASE64_CHARS`'s own base64-transport-vs-decoded-byte
 * discipline exactly (see that constant's own comment): this bound is the
 * base64-encoded TRANSPORT form only; `COMMERCE_MEDIA_MAX_PAYLOAD_BYTES`
 * (already declared near `commerceMediaStoreFor()`) is the real,
 * authoritative decoded-byte gate `IpfsMediaStore.put()` itself enforces
 * on the CIPHERTEXT it actually stores. Deliberately smaller than the
 * image bound (~3 MB decoded) — this is meant for a bounded "sample"/
 * "purchased file" digital artifact (a small PDF/ZIP), never an
 * unbounded upload surface; a genuinely large deliverable is out of this
 * arc's scope (see `MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES`'s own
 * 64 KiB cross-process release cap, `media_access_grant_key_release.ts`,
 * which any protected item this store holds must additionally clear
 * before a buyer's own process could ever redeem it — a cross-process
 * concern this arc does not touch).
 */
const MAX_PRODUCT_CONTENT_BASE64_CHARS = 4_000_000;
const MAX_PRODUCT_CONTENT_LABEL_CHARS = 300;
const MAX_PRODUCT_CONTENT_TYPE_CHARS = 64;
/**
 * Deliberately NARROWER than `commerceMediaStoreFor()`'s own
 * `COMMERCE_MEDIA_SUPPORTED_CONTENT_TYPES` (which additionally allows the
 * two image MIME types for the separate public-image-attach surface
 * above) — this handler follows this codebase's own pre-existing
 * "purchased digital deliverable" MIME precedent
 * (`src/os/commerce/catalog/sample_products.ts`'s own fixture data: a PDF
 * guide, a ZIP pro-pack) rather than inventing a new policy. Both are
 * bounded, non-scriptable content types: never `text/html`, never
 * `image/svg+xml`, never any `application/*script*`/executable MIME —
 * the exact class of "renderable as active content" type this domain's
 * own `safe_media_reference.ts` header warns against.
 */
const COMMERCE_PROTECTED_CONTENT_TYPES: ReadonlySet<string> = new Set(["application/pdf", "application/zip"]);
/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Coordinator
 * validation-gate fix) -- REPRODUCED LIVE by this arc's own usability
 * tester: choosing an ordinary `.zip` file on Windows was rejected with
 * "contentType must be one of: application/pdf, application/zip", because
 * Chromium on Windows reports a `.zip` file's `File.type` from the
 * REGISTRY (`HKCR\.zip\Content Type`), where the long-standing Windows
 * value is `application/x-zip-compressed`, not the IANA-registered
 * `application/zip`. That is a platform naming quirk, not a different
 * format and not a different security posture -- both spellings name the
 * exact same, already-allowlisted, non-scriptable ZIP container this
 * handler has always intended to accept.
 *
 * These are ALIASES ONLY, never additional accepted types: each maps to
 * one of the two canonical values above, and `canonicalCommerceProtectedContentType()`
 * below returns the CANONICAL spelling, so nothing downstream (the stored
 * `ProductMedia.contentType`, `COMMERCE_MEDIA_SUPPORTED_CONTENT_TYPES`,
 * the buyer-side redeem path, any future viewer) ever sees a second
 * spelling of the same type. Deliberately a tiny, closed map -- never a
 * prefix/wildcard match, never "anything containing zip".
 */
const COMMERCE_PROTECTED_CONTENT_TYPE_ALIASES: ReadonlyMap<string, string> = new Map([
  // Windows registry / Chromium-on-Windows spelling for `.zip`.
  ["application/x-zip-compressed", "application/zip"],
  // Older, still-seen alternates for the same two containers.
  ["application/x-zip", "application/zip"],
  ["application/x-pdf", "application/pdf"],
]);

/**
 * Returns the CANONICAL protected content type for `candidate` (itself if
 * already canonical, its canonical form if a known alias), or `null` if it
 * is neither -- see `COMMERCE_PROTECTED_CONTENT_TYPE_ALIASES` above. The
 * comparison is lower-cased and strips any `; charset=...` parameter,
 * since a browser is free to report either; the allowlist itself is
 * unchanged and is still the only thing that can admit a type.
 */
function canonicalCommerceProtectedContentType(candidate: string): string | null {
  const normalized = candidate.split(";")[0]!.trim().toLowerCase();
  if (COMMERCE_PROTECTED_CONTENT_TYPES.has(normalized)) return normalized;
  return COMMERCE_PROTECTED_CONTENT_TYPE_ALIASES.get(normalized) ?? null;
}

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Coordinator
 * validation-gate fix) -- one distinct, actionable, SELLER-LANGUAGE
 * sentence per closed-vocabulary `putProtected()` outcome
 * (`CommerceMediaStoreProtectedPutResultLike`), replacing the single
 * unactionable `"protected content storage failed: failed"` every failure
 * used to collapse into. Never leaks an internal term (no "ciphertext",
 * no "CID", no "classification") -- same discipline
 * `handleCommerceProductContentAttach()`'s own header already states for
 * its request/response shape. The raw outcome is still recorded verbatim
 * to `<dataDir()>/logs/` for support/debugging (`recordDiagnosticEvent()`).
 */
function commerceProtectedContentAttachFailureReason(outcome: string): string {
  switch (outcome) {
    case "encryption-unavailable":
      return "This file could not be encrypted, so nothing was saved. Your profile must be unlocked to attach a purchased file — lock and unlock it, then try again.";
    case "oversized":
      return "That file is too large to attach as a purchased file.";
    case "unsupported-content-type":
      return "Only PDF and ZIP files can be attached as a purchased file.";
    case "conflict":
      return "A different file is already stored under the same content, so this one was not saved. Try attaching it under a different name.";
    default:
      return "This file could not be saved. Nothing was attached, and you can safely try again.";
  }
}
/**
 * Untrusted, seller-supplied display label for a protected content
 * attachment (e.g. "Chapter 1 sample", "Full source ZIP") — NEVER
 * interpreted as a filesystem path or URL anywhere downstream (the real
 * storage key is always the content-addressed CID `IpfsMediaStore.put()`
 * derives, never anything caller-supplied). Still validated defensively,
 * exactly like a filename would be, per this arc's own untrusted-input
 * mandate: no path separators, no `..` traversal segment, no control
 * characters/NUL, bounded length, and not empty-after-trim.
 */
function isSafeProductContentLabel(value: unknown): value is string {
  if (!isBoundedString(value, MAX_PRODUCT_CONTENT_LABEL_CHARS)) return false;
  if (value.trim().length === 0) return false;
  if (value.includes("/") || value.includes("\\")) return false;
  if (value.includes("..")) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // Reject NUL and every C0/DEL control character (codepoints 0-31, and
    // 127) via explicit numeric comparison -- deliberately never a raw
    // control-character regex literal embedded in this source file.
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return true;
}
/** Secure Runtime Alpha 7001-7080 — same bound class as `MAX_LABEL_CHARS` above, sized for a real chat message body rather than a short label. */
const MAX_MESSAGE_BODY_CHARS = 8192;
/** Secure Runtime Alpha 7001-7080 — a real Device-pairing encoded request/approval string is larger than an id but still bounded (JSON envelope + one signature + one public key, never unbounded). */
const MAX_PAIRING_ENVELOPE_CHARS = 8192;
/** Secure Runtime Alpha 7321-7400 — a real Search query string, same bound class as a label, never a document body. */
const MAX_SEARCH_QUERY_CHARS = 256;
/** Secure Runtime Alpha 7321-7400 — a real filesystem path for Archive export/import, bounded but generous (Windows long-path aware). */
const MAX_ARCHIVE_PATH_CHARS = 4096;

/** Secure Runtime Alpha 5161-5240 — mirrors `fedos_electron_badge_main.cts`'s own identical policy value (`DEVICE_SYNC_ABANDONMENT_POLICY`). */
const DEVICE_SYNC_ABANDONMENT_POLICY = Object.freeze({ maxAttempts: 5, laterDelaySeconds: 30 });

function dataDir(): string {
  const override = process.env.FEDOS_ELECTRON_BETA_DATA_DIR;
  if (override !== undefined && override.length > 0) return path.join(override, "profile");
  return path.join(app.getPath("userData"), "profile");
}

function settingsFilePath(): string {
  const override = process.env.FEDOS_ELECTRON_BETA_DATA_DIR;
  const root = override !== undefined && override.length > 0 ? override : app.getPath("userData");
  return path.join(root, "settings.json");
}

/**
 * Real Digital Delivery Release Closure arc (Agent R) — SECURITY FIX: this
 * function used to read `FEDOS_ELECTRON_BETA_ARTIFACT_DIR` itself and
 * return the raw override unconditionally. Its ONLY call site
 * (`buildFreshCoordinator()`, below) fed that return value straight into
 * `fedosResolveProductionArtifactDir({ defaultArtifactDir: artifactDir(),
 * ... })` as the SAFE FALLBACK to use when the override is rejected for
 * not being test-gated -- so when an attacker set the override in a normal
 * (non-test-gated) production launch, `artifactDir()` had ALREADY resolved
 * to the attacker's directory before the gate ever ran, making
 * `defaultArtifactDir` itself attacker-controlled. The gate's own
 * "override-rejected-not-test-gated" outcome still fired and still logged
 * a rejection, but `artifactDirDecision.artifactDir` — the value actually
 * threaded into `activateFedosProductionProfileMasterSeed()` — was the
 * malicious directory regardless, completely defeating
 * `fedos_production_wasm_artifact_verify_before_execute.ts`'s own gate
 * (see that file's own call-site notes, which specify this exact pinned
 * expression as `defaultArtifactDir` — never a call back through the
 * override-reading helper). This function is now the pinned, override-
 * blind default ONLY; the override itself is read and gated exclusively
 * by `fedosResolveProductionArtifactDir()` at the call site below. See
 * `test/fedos_electron_beta_main_artifact_dir_wiring_structural_guard.test.ts`
 * for the regression guard.
 */
function artifactDir(): string {
  return path.join(__dirname, "..", "..", "fedos-core-rust", "pkg");
}

/** Secure Runtime Alpha 5161-5240 — the ONE Navigation session-state log for this process (mirrors every other `*.log` leaf's own explicit-path discipline). */
function navigationLogPath(): string {
  return path.join(dataDir(), "..", "navigation.log");
}

/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (coordinator) — the ONE per-profile directory every durable
 * Commerce NDJSON log file lives under (`<dataDir()>/commerce/<name>.ndjson`),
 * same `FEDOS_ELECTRON_BETA_DATA_DIR`-override discipline as `dataDir()`/
 * `settingsFilePath()` above (so tests/E2E harnesses can point this at an
 * isolated scratch directory exactly like every other durable file this
 * process owns). `name` is never derived from external/caller input —
 * every call site below passes one of a small fixed set of literal names.
 */
function commerceDurableFilePath(name: string): string {
  return path.join(dataDir(), "commerce", `${name}.ndjson`);
}

/** Real Digital Delivery mega-arc (Coordinator, protected-media-byte-durability closure) -- profile-scoped directory for `DurableIpfsTransport`'s own per-CID blob files. Sibling of `commerceDurableFilePath()` (same `<dataDir()>/commerce/` root), not a `.ndjson` leaf since this holds raw binary objects, not an append-only log. */
function commerceMediaBlobDir(): string {
  return path.join(dataDir(), "commerce", "media_blobs");
}

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Coordinator
 * validation-gate fix) -- `<dataDir()>/logs/`, the "local application log
 * directory (non-secret diagnostics only)" that
 * `src/os/messenger/desktop/onboarding/fedos_local_profile_paths.ts` has
 * declared (as `logsDirectory`) and `ensureFedosLocalProfileDirectories()`
 * has genuinely CREATED on every first run since Alpha 4661-4740 -- and
 * that, verified by direct search, NOTHING in this repository has ever
 * written a single byte to. That emptiness is why a 100%-reproducible
 * core-feature failure (protected content attach) left a real user and a
 * real support person with zero diagnostic trail: no console output
 * reaches a double-clicked packaged app, and this directory was empty.
 *
 * This is deliberately NOT a general-purpose logger (inventing one is its
 * own scoped design decision, not a bug fix): it is one narrow,
 * append-only NDJSON sink for FAILURE records from paths that would
 * otherwise be silent, sharing the SAME `FEDOS_ELECTRON_BETA_DATA_DIR`
 * override and the same append-only NDJSON shape as every other durable
 * file this process owns.
 */
function diagnosticsLogFilePath(): string {
  return path.join(dataDir(), "logs", "commerce-diagnostics.ndjson");
}

/**
 * Appends ONE non-secret diagnostic record to `diagnosticsLogFilePath()`
 * and mirrors it to `console.error` (this file's own established
 * `catch (err) { console.error("fedos-beta: ...", err); }` convention --
 * the disk record is ADDITIVE, never a replacement, since a dev launch
 * reads the console and a packaged launch cannot).
 *
 * NON-SECRET BY CONSTRUCTION: `details` is written verbatim, so every
 * call site below passes only closed-vocabulary outcome strings, sizes,
 * content types and ids -- never file bytes, never a passphrase, never a
 * key/handle, never a seller's own file content. Best-effort: a
 * filesystem failure here is swallowed (a diagnostic sink must never turn
 * a recoverable failure into a crash), and the console mirror still ran.
 */
function recordDiagnosticEvent(event: string, details: Record<string, unknown>): void {
  const record = { at: new Date().toISOString(), event, ...details };
  console.error(`fedos-beta: ${event}`, JSON.stringify(details));
  try {
    fs.mkdirSync(path.dirname(diagnosticsLogFilePath()), { recursive: true });
    fs.appendFileSync(diagnosticsLogFilePath(), `${JSON.stringify(record)}\n`);
  } catch (err) {
    console.error("fedos-beta: diagnostics log write failed (non-fatal)", err instanceof Error ? err.message : String(err));
  }
}

const rootDistDir = path.join(__dirname, "..", "..", "..", "dist");
function distUrl(...segments: string[]): string {
  return pathToFileURL(path.join(rootDistDir, ...segments)).href;
}

// ---------------------------------------------------------------------
// Local structural types — this package never statically imports root
// `src/`; every module below is loaded from the COMPILED `dist/` graph
// (`npm run build:beta-runtime`, root) via dynamic `import()`, identical
// technique to every prior Electron main in this package.
// ---------------------------------------------------------------------

interface UnlockSecretLike {
  clear(): void;
}
interface ReadyView {
  readonly displayLabel: string;
  readonly accountPublicIdentifier: string;
  readonly localDeviceId: string;
  readonly deviceTrustState: string;
}
interface StatusView {
  readonly lifecycleState: string;
  readonly presence: string;
  readonly displayLabel: string | null;
  readonly accountPublicIdentifier: string | null;
  readonly localDeviceId: string | null;
  readonly runtimeRunning: boolean;
  /** FedOS Installed Startup Root-Cause Arc — see `FedosProfileRecoveryReason`'s own doc comment (root `src/`). Always `null` unless `presence === "recovery-required"`. */
  readonly recoveryReason: string | null;
}
type CoordResult<T> = { readonly outcome: "ok"; readonly value: T } | { readonly outcome: string; readonly reason: string };
/**
 * Secure Runtime Alpha 6681-6760 — the narrow, READ-ONLY shape this Arc's
 * own AUTOTEST diagnostic needs from the real running Runtime this SAME
 * Coordinator already constructs. Every accessor here already exists on
 * `FedosConversationRuntime` (`directRatchet()`/`peerCapability()`/
 * `identityTransition()`/`deletionRequest()`, all real, all wired by the
 * immediately-prior Alpha 6521-6600 Arc through this exact Coordinator) —
 * this type adds no new capability, it only lets the diagnostic report
 * whether each is reachable (non-null) on THIS packaged process's own
 * Runtime, proving the unified configuration graph claim end to end.
 */
interface RuntimeConversationLike {
  directRatchet(): unknown;
  peerCapability(): unknown;
  identityTransition(): unknown;
  deletionRequest(): unknown;
}
interface RunningRuntimeLike {
  conversationRuntime(): RuntimeConversationLike;
  deviceTrust(): unknown;
}
interface CoordinatorLike {
  detectProfileState(): CoordResult<StatusView>;
  createProfile(input: { readonly displayLabel: string }, secret: UnlockSecretLike): Promise<CoordResult<ReadyView>>;
  unlockProfile(secret: UnlockSecretLike): Promise<CoordResult<ReadyView>>;
  lock(): Promise<CoordResult<{ readonly lifecycleState: string }>>;
  status(): StatusView;
  runningRuntime(): RunningRuntimeLike | null;
  /** FedOS Peer Device Discovery Arc P0 Closure (Agent F) — see `FedosProfileInitializationCoordinator#resetInterruptedProfile()`'s own header (root `src/`) for the full guard/contract. */
  resetInterruptedProfile(): Promise<CoordResult<{ readonly lifecycleState: string }>>;
  /** FedOS Installed Startup Root-Cause Arc — see `FedosProfileInitializationCoordinator#resetCorruptReadyProfile()`'s own header (root `src/`) for the full guard/contract. */
  resetCorruptReadyProfile(): Promise<CoordResult<{ readonly lifecycleState: string }>>;
}
interface MasterSeedAuthorityLike {
  clear(): Promise<void>;
  /**
   * FedOS Commerce FINAL Closure Mega-Arc (coordinator, central integration
   * pass) -- present (as a real, callable function) on the canonical
   * production `FedosProductionMasterSeedAuthority` this Coordinator
   * already activates (see that class's own Commerce FINAL Closure
   * doc comment); OPTIONAL here purely because this structural "Like"
   * interface is also satisfied by other, non-Commerce-aware callers
   * elsewhere in this file's own type graph. Returns an opaque handle
   * (never a raw key byte), or `null` on any failure -- fails closed,
   * mirrors `FedosMasterSeedAuthority.resolveCommerceMediaKey`'s own
   * contract exactly (`src/os/core/vault/wasm/fedos_master_seed_authority.ts`).
   */
  resolveCommerceMediaKey?(): Promise<unknown>;
  /**
   * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
   * Coordinator-directed pass) -- present (as real, callable functions) on
   * the SAME canonical production `FedosProductionMasterSeedAuthority`
   * this Coordinator already activates (Secure Runtime Alpha 1761-1840
   * Phase B); OPTIONAL for the same "other non-Commerce-aware callers
   * satisfy this structural interface too" reason as `resolveCommerceMediaKey?`
   * above. `RealCommercePrivateOrderTransport`/`verifyAndDecryptInboundPrivateOrderEnvelope`
   * (`commercePrivateOrderTransportFor()`/`commercePrivateOrderDiscoverAndApplyNonFatal()`
   * below) are the only callers.
   */
  encryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null>;
  decryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null>;
  /**
   * FedOS Commerce FINAL P1 Closure (coordinator, shared foundation) --
   * present (as real, callable functions) on the SAME canonical production
   * `FedosProductionMasterSeedAuthority` this Coordinator already
   * activates -- it implements `SealingAuthorityPort`
   * (`src/os/core/ports/sealing_authority_port.ts`) alongside its own
   * `FedosMasterSeedAuthority` contract, exactly like
   * `resolveCommerceMediaKey?` above. OPTIONAL for the same reason: this
   * structural "Like" interface is also satisfied by other,
   * non-sealing-capable callers elsewhere in this file's own type graph.
   * Reused (not reinvented) by
   * `src/os/core/vault/wasm/fedos_sealed_signing_key_store.ts` to seal the
   * Persona Epoch identity keypair and the Receipt-issuer keypair at rest
   * -- see that file's own header for the full design.
   */
  sealDirectRatchetSecret?(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    secretBytes: Uint8Array,
  ): Promise<string | null>;
  restoreDirectRatchetSecret?(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    sealedBlob: string,
  ): Promise<Uint8Array | null>;
  /**
   * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
   * (Agent D) -- present (as real, callable functions) on the SAME
   * canonical production `FedosProductionMasterSeedAuthority`
   * (`src/os/core/vault/wasm/fedos_master_seed_authority.ts`), reused
   * here EXACTLY as `media_access_grant_key_release.ts`'s own
   * `wrapMediaAccessGrantRelease()`/`unwrapMediaAccessGrantRelease()`
   * already require -- the ECDH-bound "wrap opaque bytes for exactly one
   * counterparty" primitive that lets a grant-gated release actually
   * reach the buyer without ever handing out the profile-wide
   * CommerceMedia key. OPTIONAL for the same reason every other method on
   * this structural "Like" interface is optional.
   */
  encryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null>;
  decryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null>;
}
/**
 * FedOS Commerce FINAL P1 Closure (Agent K2) -- narrows
 * `ResolveReceiptIssuerSigningKeypairOutcome`
 * (`src/os/trust/issuer/durable_receipt_issuer_signing_key_store.ts`) to
 * exactly what `commerceReceiptSigningState()` below reads; the real
 * function returns a richer type (a full `FedosTrustSigningKeypair` opaque
 * handle), this interface only narrows it to the `publicKeyHex` accessor
 * this file needs, granting no new capability.
 */
type ReceiptIssuerSigningKeyResolution =
  | { readonly outcome: "restored" | "created"; readonly keypair: { readonly publicKeyHex: string }; readonly generation: number }
  | { readonly outcome: "sealing-unavailable" }
  | { readonly outcome: "corrupted"; readonly reason: string };
/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- structural mirror
 * of `FedosNostrSigningAuthority` (`src/os/messenger/adapters/nostr/protocol/sign/`),
 * satisfied at runtime by the SAME `FedosProductionNostrSigningAuthority`
 * instance `buildFreshCoordinator()` already constructs for Direct
 * Ratchet/Conversation Transport -- never a second signer, never a second
 * Master Seed reach.
 */
interface NostrSigningAuthorityLike {
  signEvent(request: unknown): Promise<unknown>;
  publicIdentityForAccount(accountIndex: number): Promise<{ readonly publicKeyHex: string } | null>;
}
type Activation =
  | { readonly outcome: "activated"; readonly masterSeedAuthority: MasterSeedAuthorityLike; readonly appId: string }
  | { readonly outcome: "blocked"; readonly decision: string; readonly reason: string };
interface PathsLike {
  readonly profileDescriptorFile: string;
  readonly sealedMasterSeedFile: string;
}
interface AssemblyEffectiveStateLike {
  readonly [key: string]: unknown;
}
interface NavigationRegistryLike {
  readonly recentConversationIds: readonly string[];
  readonly lastOpenedConversationId: string | null;
  createWindow(windowId: string): unknown;
  disposeWindow(windowId: string): boolean;
  recordConversationOpened(conversationId: string): void;
  sessionState(): unknown;
}
interface TrayCoordinatorLike {
  dispatch(candidate: unknown): Promise<{ readonly action: string; readonly outcome: string; readonly [key: string]: unknown }>;
}
interface BadgeCoordinatorLike {
  refresh(): Promise<{ readonly state: string; readonly count: number; readonly reason: string }>;
  readonly lastView: { readonly state: string; readonly count: number; readonly reason: string } | null;
  readonly renderCount: number;
}
interface BackgroundLifecycleLike {
  windowOpened(): string;
  windowClosed(): string;
  requestShutdown(): string;
  confirmShutdown(): string;
  canRunBackgroundSync(): boolean;
  canDeliverBackgroundNotifications(): boolean;
}
interface DeviceSyncWiringLike {
  handleEvent(event: unknown): Promise<void>;
  readonly currentTrayStatus: string;
}
/**
 * Secure Runtime Alpha 6681-6760 — narrow, safe-only Shell surface for the
 * AUTOTEST diagnostic; never exposes a raw Runtime/secret/handle.
 *
 * Secure Runtime Alpha 7001-7080 — extended (never redesigned) with the
 * closed, ACCEPTANCE-MODE-ONLY command vocabulary Phase C names: every
 * method below already exists, verbatim, on the real
 * `FedosDesktopApplicationShell` (`createDirectConversation`/`sendMessage`/
 * `listMessages`/`readMessage`/`directRatchetStatus`/the six Device
 * Pairing methods are all pre-existing and unchanged by this Arc;
 * `activateDirectConversation`/`establishDirectRatchetSession` are the two
 * new, narrow wrapper methods this Arc added directly to the Shell — see
 * that file's own Alpha 7001-7080 doc comments). This interface only
 * narrows the TYPE this file depends on; it grants no new capability
 * beyond what the Shell itself already implements.
 */
interface ShellDiagnosticLike {
  productionCryptoStatus(): { readonly outcome: string; readonly [key: string]: unknown };
  createDirectConversation(command: unknown): { readonly outcome: string; readonly [key: string]: unknown };
  activateDirectConversation(conversationId: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  devicePairingCreate(deviceId: string, expectedAccountRef: unknown): { readonly outcome: string; readonly [key: string]: unknown };
  devicePairingInspect(encodedRequest: string): { readonly outcome: string; readonly [key: string]: unknown };
  devicePairingApprove(encodedRequest: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  devicePairingComplete(pairingId: string, encodedApproval: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  establishDirectRatchetSession(conversationId: string, remoteDeviceRef: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  sendMessage(conversationId: string, sender: unknown, body: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  listMessages(conversationId: string): { readonly outcome: string; readonly [key: string]: unknown };
  readMessage(conversationId: string, messageId: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  directRatchetStatus(conversationId: string, remoteDeviceRef: string): { readonly outcome: string; readonly [key: string]: unknown };
  /** Secure Runtime Alpha 7321-7400 — narrows `FedosDesktopApplicationShell.createConversationInvitation()` (Alpha 7081-7160, unmodified); no new business logic. */
  createConversationInvitation(invitee: unknown, expiresInMs?: number): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  /** Secure Runtime Alpha 7321-7400 — narrows `FedosDesktopApplicationShell.search()` (Alpha 3081-3160, unmodified); synchronous, never a promise. */
  search(query: string): { readonly outcome: string; readonly [key: string]: unknown };
  /** Secure Runtime Alpha 7321-7400 — narrows `FedosDesktopApplicationShell.archive()` (Alpha 3081-3160, unmodified). */
  archive(command: unknown): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  /** Secure Runtime Alpha 8041-8120 — narrows four already-real, unmodified Shell methods (`devicesList`/`deviceDetail`/`deviceRevoke`/`deviceSyncStatus`) this file never called before this Arc. */
  devicesList(): { readonly outcome: string; readonly [key: string]: unknown };
  deviceDetail(deviceId: string): { readonly outcome: string; readonly [key: string]: unknown };
  deviceRevoke(deviceId: string, devicePublicKeyHex: string): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  deviceSyncStatus(): { readonly outcome: string; readonly [key: string]: unknown };
  /** Secure Runtime Alpha 8041-8120 — narrows `peerCapabilityListObserved()`/`identityTransitionStatus()`, used ONLY to reconcile an Identity Transition inbox item's own `transitionId` back to the `(peerAccountRef, peerDeviceRef)` pair `identityTransitionOpen()`/`Accept()`/`Reject()`/`Defer()` require as input — the Shell/Controller layer has no listing call that returns that pair directly (see this Arc's own Phase A reconciliation report); this main-process-only cross-reference invents no new identity-transition business rule, it only composes two already-public read-only calls, mirroring `FedosSafetyCenterController`'s own established cross-domain reconciliation style. */
  peerCapabilityListObserved(): { readonly outcome: string; readonly [key: string]: unknown };
  identityTransitionStatus(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): { readonly outcome: string; readonly [key: string]: unknown };
  /** FedOS Peer Device Discovery Arc — narrows `FedosDesktopApplicationShell.peerDeviceAnnounce()`/`.peerDeviceAnnouncementListObserved()` (unmodified this call); no new business logic. */
  peerDeviceAnnounce(recipientAccountRef: unknown, conversationId: string, epoch: number): Promise<{ readonly outcome: string; readonly [key: string]: unknown }>;
  peerDeviceAnnouncementListObserved(): { readonly outcome: string; readonly [key: string]: unknown };
  /** Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) — narrows `FedosDesktopApplicationShell.identityTransitionRatchetImpact()`, additive this Arc; see that method's own doc comment. */
  identityTransitionRatchetImpact(oldAccountIdentity: unknown): { readonly outcome: string; readonly [key: string]: unknown };
  /**
   * Real Digital Delivery mega-arc (Agent U) — narrows four already-real,
   * unmodified Shell methods (`syncSchedulesList`/`syncTransfersList`/
   * `syncConflictsList`/`syncConflictDetail`/`syncConflictAcknowledge`) this
   * file never called before this Arc. Every one of these already exists
   * and is already fully real underneath `deviceSyncStatus()`'s own
   * `FedosDeviceSyncOperationalFacade` (`src/os/messenger/desktop/runtime/fedos_device_sync_operational_facade.ts`)
   * — this Arc grants no new capability, it only reaches read/act methods
   * this Shell already exposed.
   */
  syncSchedulesList(): { readonly outcome: string; readonly [key: string]: unknown };
  syncTransfersList(): { readonly outcome: string; readonly [key: string]: unknown };
  syncConflictsList(includeResolved?: boolean): { readonly outcome: string; readonly [key: string]: unknown };
  syncConflictAcknowledge(conflictId: string, action: string): { readonly outcome: string; readonly [key: string]: unknown };
}
/** Secure Runtime Alpha 7321-7400 — narrows `FedosSafetyCenterController` (`src/desktop/presentation/safety_center/`, unmodified). Secure Runtime Alpha 8041-8120 — widened (never redesigned) to narrow the REST of `FedosDesktopConversationUiPresentationBoundary`'s own already-real ViewModels/Controllers (`src/desktop/presentation/`, unmodified) this file never read before this Arc: conversation list/detail, message list/compose, membership/invitations, search, archive, device inventory, Identity Transition, Signed Deletion. Every accessor below already exists on the real class; this interface only narrows the TYPE, granting no new capability. */
interface BoundaryLike {
  readonly safetyCenter: {
    refreshOverview(ratchetPairs?: readonly unknown[]): Promise<void>;
    readonly overviewState: { readonly status: string; readonly [key: string]: unknown };
  };
  /** Verified Secure Session UI mega-arc (Coordinator) — narrows `FedosConversationSecurityStateController` (`src/os/messenger/desktop/presentation/security_state/`, this Arc's own new, additive controller). */
  readonly securityState: {
    getSecurityState(conversationId: string, counterpartyAccountRef: unknown, now: number): { readonly conversationId: string; readonly [key: string]: unknown };
    setMessageDeliveryRemoteDeviceRef(value: string | null): void;
  };
  readonly conversationList: {
    load(filter?: unknown): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly conversationDetail: {
    load(conversationId: string): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly messageList: {
    load(conversationId: string): Promise<unknown>;
    reveal(messageId: string): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly composeMessage: {
    setBody(body: string): void;
    send(conversationId: string, sender: unknown): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly membership: {
    load(conversationId: string): Promise<unknown>;
    loadInvitations(conversationId: string, issuer: unknown): Promise<unknown>;
    readonly state: { readonly status: string; readonly [key: string]: unknown };
    readonly invitations: { readonly status: string; readonly [key: string]: unknown };
  };
  readonly search: {
    setQuery(query: string): void;
    search(): Promise<unknown>;
  };
  readonly archive: {
    inspect(sourcePath: string): Promise<unknown>;
    export(request: unknown): Promise<unknown>;
    preflightRestore(request: unknown): Promise<unknown>;
    restore(request: unknown): Promise<unknown>;
    workflowWarnings(operation: "inspect" | "preflightRestore" | "export" | "restore"): readonly { readonly [key: string]: unknown }[];
  };
  readonly deviceInventory: {
    refresh(): Promise<unknown>;
    selectDevice(deviceId: string): Promise<unknown>;
  };
  readonly identityTransitions: {
    refreshInbox(limit: number, offset: number): Promise<void>;
    readonly inboxState: { readonly status: string; readonly [key: string]: unknown };
    openTransition(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): Promise<void>;
    readonly detailState: { readonly status: string; readonly [key: string]: unknown };
    acceptSelected(): Promise<void>;
    rejectSelected(): Promise<void>;
    deferSelected(): Promise<void>;
    // Secure Runtime Alpha 8121-8200 -- Security Finding 3: the real, exact-id authorization boundary.
    accept(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): Promise<void>;
    reject(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): Promise<void>;
    defer(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): Promise<void>;
    recordManualVerification(method: unknown, verifiedAt: number, noteCode: unknown): Promise<void>;
    readonly manualVerificationState: { readonly status: string; readonly [key: string]: unknown };
    // Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) —
    // narrows the Identity Replacement two-step Ratchet-reset confirmation
    // (`FedosIdentityTransitionController.assessContinuity()`/
    // `.authorizeRatchetReset()`, already real, previously never called
    // from any IPC channel).
    assessContinuity(pairs: readonly { readonly conversationId: string; readonly remoteDeviceRef: string }[]): Promise<void>;
    readonly ratchetResetConfirmationState: { readonly status: string; readonly [key: string]: unknown };
    authorizeRatchetReset(acceptanceState: unknown, affectedSessions: readonly unknown[]): Promise<void>;
  };
  readonly deletionRequests: {
    openReceivedInbox(): Promise<void>;
    readonly inboxState: { readonly status: string; readonly [key: string]: unknown };
    openReceivedRequest(requestId: string, policy: string): Promise<void>;
    readonly consentDetailState: { readonly status: string; readonly [key: string]: unknown };
    approveSelected(): Promise<void>;
    rejectSelected(): Promise<void>;
    // Secure Runtime Alpha 8121-8200 -- Security Finding 3: the real, exact-id authorization boundary.
    approve(requestId: string): Promise<void>;
    reject(requestId: string): Promise<void>;
    // Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) —
    // narrows the Signed Deletion sender-side (`FedosDeletionRequestController.createRequest()`,
    // already real, previously never called from any IPC channel).
    createRequest(params: unknown): Promise<void>;
    readonly createState: { readonly status: string; readonly [key: string]: unknown };
    // Real Digital Delivery mega-arc (Agent U) — narrows
    // `FedosDeletionRequestController.refreshSentStatus()`/`.sentStatusState`,
    // already real, previously never called from any IPC channel.
    refreshSentStatus(conversationId: string, targetEnvelopeId: string, knownDeviceIds: readonly string[]): Promise<void>;
    readonly sentStatusState: { readonly status: string; readonly [key: string]: unknown };
  };
}
interface AssemblyLike {
  readonly shell: ShellDiagnosticLike;
  /** Secure Runtime Alpha 7321-7400 — `FedosDesktopBetaApplicationAssembly` (`src/desktop/beta/fedos_desktop_beta_application_assembly.ts`, unmodified) already exposes this getter; this file simply never read it before now. */
  readonly boundary: BoundaryLike;
  readonly settingsCoordinator: {
    previewPlan(candidate: unknown): unknown;
    apply(candidate: unknown): Promise<unknown>;
    effectiveState(): AssemblyEffectiveStateLike | null;
  };
  readonly notificationCoordinator: { notify(candidate: unknown): Promise<unknown> };
  readonly navigationRegistry: NavigationRegistryLike;
  readonly trayCoordinator: TrayCoordinatorLike;
  readonly badgeCoordinator: BadgeCoordinatorLike;
  readonly backgroundLifecycle: BackgroundLifecycleLike;
  readonly deviceSyncPresentationWiring: DeviceSyncWiringLike;
  shutdown(): Promise<void>;
}
type AssemblyResult = { readonly outcome: "ok"; readonly value: AssemblyLike } | { readonly outcome: string; readonly reason: string };
interface SettingsControllerLike {
  load(): { readonly outcome: string; readonly value?: { readonly relays: readonly string[] } };
}
/** Secure Runtime Alpha 6761-6840 -- the real, production `FedosRelay` implementation (`WebSocketRelay`, Node 22+'s own global `WebSocket`, no new dependency) and its one real socket factory. Never `NullRelay` (test-only, no real network I/O) in this canonical packaged entry point. */
interface RelayLike {
  readonly url: string;
  /** Secure Runtime Alpha 8121-8200 -- `WebSocketRelay.isConnected()` (Alpha 215, unmodified) was already real and public; this file simply never read it before this Arc. A PURE, SYNCHRONOUS accessor -- no new capability. */
  isConnected(): boolean;
}
interface NotificationPortLike {
  status(): "available" | "unavailable";
  notify(view: unknown): Promise<{ readonly delivered: boolean; readonly reason: string }>;
}
interface BadgePortLike {
  status(): "available" | "unavailable";
  render(view: unknown): void;
}
interface TrayStatusSinkLike {
  setTooltip(text: string): void;
}
interface ParticipantRefLike {
  readonly authority: "nostr";
  readonly publicIdentifier: string;
  readonly identityId: null;
}
interface DeviceSyncEventBridgeLike {
  wrapAttemptFn(real?: (request: unknown) => Promise<unknown>): (request: unknown) => Promise<unknown>;
}

interface RootModules {
  readonly createElectronMainHostAttestation: (identity: { appId: string; appVersion: string }) => unknown;
  readonly activateFedosProductionProfileMasterSeed: (request: {
    attestation: unknown;
    artifactDir?: string;
    expectedCrate?: { readonly name?: string; readonly version?: string };
    importGlue?: (specifier: string) => Promise<unknown>;
  }) => Promise<Activation>;
  /**
   * Commerce Product-Media Sync + Truthful Completion mega-arc (Agent S
   * Task 3 / Wave B) — gates `FEDOS_ELECTRON_BETA_ARTIFACT_DIR` behind an
   * explicit test-mode signal instead of honoring it unconditionally.
   */
  readonly fedosResolveProductionArtifactDir: (request: {
    readonly overrideArtifactDirEnvValue: string | undefined;
    readonly testGateActive: boolean;
    readonly defaultArtifactDir: string;
  }) => { readonly artifactDir: string; readonly outcome: string; readonly reason: string };
  readonly fedosExpectedProductionWasmCrate: () => { readonly name: string };
  readonly NostrSigningAuthority: new (handleSource: unknown) => unknown;
  readonly planFedosLocalProfilePaths: (root: string) => PathsLike | null;
  readonly ensureFedosLocalProfileDirectories: (paths: PathsLike) => boolean;
  readonly ProfilePersistence: new (file: string) => unknown;
  readonly SealedSeedPersistence: new (file: string) => unknown;
  readonly Coordinator: new (deps: Record<string, unknown>) => CoordinatorLike;
  readonly UnlockSecret: new (bytes: Uint8Array) => UnlockSecretLike;
  readonly createFileBackedSettingsController: (filePath: string) => SettingsControllerLike;
  readonly BetaApplicationAssembly: {
    start(deps: {
      coordinator: CoordinatorLike;
      settingsController: SettingsControllerLike;
      notificationPort: NotificationPortLike;
      badgePort: BadgePortLike;
      trayStatusSink?: TrayStatusSinkLike;
      viewerParticipant: ParticipantRefLike;
      navigationLogPath: string;
    }): AssemblyResult;
  };
  readonly betaCapabilityManifestV1: () => unknown;
  readonly betaReleaseConfigurationV1: () => unknown;
  readonly betaLimitationsV1: () => unknown;
  readonly DeviceSyncEventBridge: new (deps: { listener: (event: unknown) => void; abandonmentMaxAttempts?: number }) => DeviceSyncEventBridgeLike;
  readonly fedosDesktopTrayMenuItems: (disabled?: ReadonlySet<string>) => readonly FedosElectronBadgeTrayMenuItemLike[];
  readonly WebSocketRelay: new (url: string, factory: (url: string) => Promise<unknown>) => RelayLike;
  readonly createNodeWebSocketRelaySocketFactory: () => (url: string) => Promise<unknown>;
  /**
   * Commerce Reachable Catalog + Product Surface Phase 1 -- the real
   * `os/commerce` domain's `listViewableProducts()`, loaded exactly like
   * every other module in this function (compiled `dist/`, dynamic
   * `import()`). Read-only catalog discovery.
   *
   * Commerce E2E Completion arc (coordinator integration gate) widens this
   * to the real, mutable Merchant Product CRUD + Order + local Payment
   * simulator surface -- still every field loaded from the SAME compiled
   * `os/commerce/index.js` barrel, still zero network/storage dependency
   * inside the domain itself (`LocalProductRepository`/`LocalOrderRepository`
   * are in-process only; THIS main process is the only thing that holds
   * them, module-scope, for its own lifetime -- see the `commerceProductRepo`
   * etc. state below). Constructors are typed as `new (...) => X` so
   * `new modules.Commerce.LocalProductRepository(...)` produces a real,
   * checked instance -- never `any`.
   */
  readonly Commerce: {
    readonly listViewableProducts: (
      products: readonly FedosCommerceDemoProduct[],
      actorPubkey?: string,
      grants?: readonly unknown[],
    ) => readonly FedosCommerceDemoProduct[];
    readonly LocalProductRepository: new (
      generateId?: () => string,
      initialProducts?: readonly CommerceProductLike[],
    ) => CommerceProductRepositoryLike;
    /**
     * Commerce Durability + Protected-Media Entitlement + Packaged-E2E
     * FINAL Closure arc (coordinator) -- durable, restart-surviving
     * siblings of the four `Local*`/`PaymentSettlementLedger` constructors
     * above, same Ports, each backed by an append-only NDJSON log file at
     * a caller-supplied path (see `commerceDurableFilePath()` below).
     */
    readonly DurableProductRepository: new (
      filePath: string,
      generateId?: () => string,
      initialProducts?: readonly CommerceProductLike[],
    ) => CommerceProductRepositoryLike;
    readonly LocalOrderRepository: new () => CommerceOrderRepositoryLike;
    readonly DurableOrderRepository: new (filePath: string) => CommerceOrderRepositoryLike;
    readonly createOrder: (input: CommerceCreateOrderInputLike, actor: CommerceOrderActorLike, now: number) => CommerceOrderTransitionResultLike;
    readonly applyOrderAction: (order: CommerceOrderLike, action: CommerceOrderActionLike, now: number) => CommerceOrderTransitionResultLike;
    readonly DeterministicLocalPaymentProvider: new (options: { readonly acknowledgeTestOnly: true; readonly runtimeProfile?: string }) => CommerceLocalPaymentProviderLike;
    /**
     * `payment/local_simulator.ts`'s own exported constant -- the exact,
     * unmistakable name every `test_simulator` evidence that class produces
     * carries in `verification.simulator`. Loaded here (Purchase Completion
     * mega-arc, integration phase) so the INBOUND payment-evidence gate can
     * pin `expectedProviderIdentity` to the one rail this build actually
     * has, rather than accepting any authoritative-looking provider name.
     * Read from the real module, never re-typed as a literal here, so the
     * two can never silently drift apart.
     */
    readonly TEST_SIMULATOR_NAME: string;
    readonly PaymentSettlementLedger: new () => CommercePaymentLedgerLike;
    readonly DurablePaymentSettlementLedger: new (filePath: string) => CommercePaymentLedgerLike;
    readonly LocalDeliveryRepository: new () => CommerceDeliveryRepositoryLike;
    readonly DurableDeliveryRepository: new (filePath: string) => CommerceDeliveryRepositoryLike;
    readonly createDelivery: (input: CommerceCreateDeliveryInputLike, actor: CommerceDeliveryActorLike, now: number) => CommerceDeliveryTransitionResultLike;
    readonly applyDeliveryAction: (delivery: CommerceDeliveryRecordLike, action: CommerceDeliveryActionLike, now: number) => CommerceDeliveryTransitionResultLike;
    readonly issueSignedTradeReceiptProof: (payload: unknown, keys: unknown, options: unknown) => unknown;
    readonly verifySignedTradeReceiptProof: (envelope: unknown, policy: unknown) => { readonly status: string; readonly payload?: unknown };
    /**
     * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- the
     * `DeliveryReceiptProofPayload` sibling of `issueSignedTradeReceiptProof`/
     * `verifySignedTradeReceiptProof` (both already real,
     * already-tested -- `commerce_trust_receipt_adapter.ts` -- but never
     * wired into this composition root before now). Used by
     * `handleCommerceReceiptIssue()` ONLY when the completed Order's product
     * actually had protected media released to this buyer, to carry a
     * `deliveryConfirmationRef` referencing the real release digest -- see
     * that handler's own comment for the full "never claims quality, only
     * that delivery evidence exists" account (this arc's own mandate item 7).
     */
    readonly issueSignedDeliveryReceiptProof: (payload: unknown, keys: unknown, options: unknown) => unknown;
    readonly verifySignedDeliveryReceiptProof: (envelope: unknown, policy: unknown) => { readonly status: string; readonly payload?: unknown };
    readonly encodeCommerceReceiptProofToQrText: (envelope: unknown) => string;
    readonly decodeCommerceReceiptProofFromQrText: (text: string) => unknown;
    /**
     * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D)
     * -- arc mandate item 3 (signed Product Share Proof: "Bob: Share
     * Product... Alice: Scan/Paste/Open -> verifies seller/product identity
     * via SIGNATURE"). Same loose `unknown`-shape discipline as the receipt
     * functions immediately above -- see
     * `src/os/commerce/share/commerce_trust_share_adapter.ts`'s own header
     * for the full two-layer trust model `handleCommerceShareOpen()` below
     * implements on top of `verifySelfAssertedProductShareProof`'s own
     * narrow, self-consistency-only guarantee.
     */
    readonly issueSignedProductShareProof: (payload: unknown, keys: unknown, options: unknown) => unknown;
    readonly verifySelfAssertedProductShareProof: (envelope: unknown, options?: unknown) => { readonly status: string; readonly resolvedPublicKeyHex?: string; readonly payload?: unknown };
    readonly encodeCommerceShareProofToQrText: (envelope: unknown) => string;
    readonly decodeCommerceShareProofFromQrText: (text: string) => unknown;
    /**
     * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
     * (Agent D) -- friction-ledger row #5 / arc §33: durable, idempotent
     * receipt-envelope persistence (never a new mechanism -- same
     * append-only-NDJSON pattern as `DurablePaymentSettlementLedger` above).
     */
    readonly DurableReceiptStore: new (filePath: string) => CommerceReceiptStoreLike;
    /**
     * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
     * (Agent D) -- the first real production caller of the previously-inert
     * `LocalProductMediaRepository`/`generateFedosProductMediaId` (arc §38 /
     * friction-ledger row #17).
     */
    readonly LocalProductMediaRepository: new (generateId?: () => string) => CommerceProductMediaRepositoryLike;
    /**
     * Real Digital Delivery mega-arc (Coordinator, positive-E2E root-cause
     * fix) -- durable sibling of `LocalProductMediaRepository` immediately
     * above; see `durable_product_media_repository.ts`'s own header for the
     * live cross-restart data-loss gap this closes.
     */
    readonly DurableProductMediaRepository: new (filePath: string, generateId?: () => string) => CommerceProductMediaRepositoryLike;
    readonly generateFedosProductMediaId: () => string;
    /**
     * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
     * (Agent D) -- the first real production caller of the
     * `MediaAccessGrant` system (arc §35-37 / friction-ledger row #15).
     */
    readonly isQualifyingOrderStatusForMediaAccess: (status: string) => boolean;
    readonly issueMediaAccessGrantsForOrder: (input: {
      readonly order: { readonly id: string; readonly productId: string; readonly buyerPubkey: string; readonly sellerPubkey: string; readonly status: string };
      readonly candidateMedia: readonly { readonly id: string; readonly productId: string; readonly classification: "public" | "protected" }[];
      readonly sellerSigningKeypair: { readonly publicKeyHex: string };
      /** Real Digital Delivery mega-arc (Agent G, Grant Custody pass) -- see `EvaluateMediaAccessGrantInput.sellerAuthorizedDelegateSigningKeys`'s own header (`src/os/commerce/media_grant/media_access_grant_policy.ts`). */
      readonly sellerAuthorizedDelegateSigningKeys?: readonly string[];
      readonly latestKnownGrantVersionFor: (mediaId: string) => number;
      readonly now: number;
    }) => CommerceIssueMediaAccessGrantsOutcomeLike;
    readonly AppendOnlyMediaAccessGrantPersistence: new (filePath: string) => CommerceMediaAccessGrantPersistenceLike;
    readonly latestGrantVersion: (entries: readonly CommerceMediaAccessGrantEnvelopeLike[], mediaId: string, buyerPubkey: string, orderId: string) => number;
    readonly evaluateMediaAccessGrant: (input: {
      readonly envelope: unknown;
      readonly media: { readonly id: string; readonly productId: string };
      readonly actorPubkey: string;
      readonly order: CommerceOrderLike | null;
      readonly now: number;
      readonly latestKnownGrantVersion?: number;
      readonly sellerAuthorizedDelegateSigningKeys?: readonly string[];
    }) => CommerceMediaAccessDecisionLike;
    readonly wrapMediaAccessGrantRelease: (input: {
      readonly envelope: unknown;
      readonly media: { readonly id: string; readonly productId: string };
      readonly actorPubkey: string;
      readonly order: CommerceOrderLike | null;
      readonly now: number;
      readonly latestKnownGrantVersion?: number;
      readonly sellerAuthorizedDelegateSigningKeys?: readonly string[];
      readonly merchantAccountIndex: number;
      readonly releasePayload: Uint8Array;
      readonly authority: MasterSeedAuthorityLike;
    }) => Promise<CommerceWrapMediaAccessGrantReleaseResultLike>;
    readonly resolveCommerceMediaGrantSigningKeypair: (
      masterSeedAuthority: MasterSeedAuthorityLike | null,
      store: unknown,
      subjectId: string,
      createIfAbsent: boolean,
      nowUnixSeconds: number,
    ) => Promise<CommerceMediaGrantSigningKeyResolveResultLike>;
    /**
     * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- the
     * pure decision layer backing the 4th private-sync channel (media
     * release request/response) and the order-completion "digital content
     * delivery invariant" -- see `media_access_grant_release_channel_policy.ts`'s
     * own header for the full account of all three.
     */
    readonly evaluateInboundMediaReleaseRequestAuthorization: (input: {
      readonly payload: { readonly orderId: string; readonly mediaId: string; readonly buyerPubkey: string; readonly sellerPubkey: string };
      readonly senderPubkeyHex: string;
      readonly ownPubkeyHex: string;
      readonly order: { readonly id: string; readonly productId: string; readonly buyerPubkey: string; readonly sellerPubkey: string } | undefined;
      readonly media: { readonly id: string; readonly productId: string; readonly classification: "public" | "protected" } | undefined;
    }) => { readonly authorized: true } | { readonly authorized: false; readonly reason: string };
    readonly evaluateInboundMediaReleaseResponseAuthorization: (input: {
      readonly payload: { readonly orderId: string; readonly mediaId: string; readonly buyerPubkey: string; readonly sellerPubkey: string };
      readonly senderPubkeyHex: string;
      readonly ownPubkeyHex: string;
      readonly order: { readonly id: string; readonly sellerPubkey: string };
      readonly expectedMediaId: string;
    }) => { readonly authorized: true } | { readonly authorized: false; readonly reason: string };
    readonly evaluateDigitalContentDeliveryInvariantForOrderCompletion: (input: {
      readonly productId: string;
      readonly productMedia: readonly { readonly id: string; readonly productId: string; readonly classification: "public" | "protected" }[];
      readonly hasReleasedContent: (mediaId: string) => boolean;
      /** Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) — `"authoritative"` (default) for a process's own self-populated local repository (the seller's own process); `"unsynced"` wherever `productMedia` was merged in from a read-model view this process cannot prove is complete (a buyer's process). See media_access_grant_release_channel_policy.ts's own header. */
      readonly productMediaKnowledge?: "authoritative" | "unsynced";
    }) =>
      | { readonly satisfied: true }
      | { readonly satisfied: false; readonly reason: "digital-content-not-delivered"; readonly missingMediaIds: readonly string[] }
      | { readonly satisfied: false; readonly reason: "product-media-knowledge-unsynced" };
    /**
     * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) --
     * buyer-side durable, restart-surviving cache for an already
     * digest-verified `MediaAccessGrant` release
     * (`durable_media_release_content_cache.ts`).
     */
    readonly DurableMediaReleaseContentCache: new (filePath: string) => CommerceMediaReleaseContentCacheLike;
    /**
     * CROSS-PROCESS COMPLETION SYNC mega-arc (Coordinator) -- SELLER-side
     * durable, restart-surviving record of "I genuinely built and sent a
     * real, verified release" (`durable_media_release_issuance_log.ts`).
     */
    readonly DurableMediaReleaseIssuanceLog: new (filePath: string) => CommerceMediaReleaseIssuanceLogLike;
    /**
     * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
     * (Agent D) -- friction-ledger row #14 / arc §32/§36: real,
     * repository-derived activity/badge counting logic.
     */
    readonly computeCommerceBuyerActivitySummary: (
      orders: readonly { readonly id: string; readonly status: string }[],
      hasReceipt: (orderId: string) => boolean,
    ) => {
      readonly draft: number;
      readonly awaitingSellerAcceptance: number;
      readonly readyToPay: number;
      readonly inFulfillment: number;
      readonly readyToAcknowledge: number;
      readonly readyToComplete: number;
      readonly readyReceipts: number;
    };
    readonly computeCommerceSellerActivitySummary: (
      orders: readonly { readonly id: string; readonly status: string }[],
      hasReceipt: (orderId: string) => boolean,
    ) => {
      readonly newSubmitted: number;
      /** FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- seller's own "which are unpaid?" bucket (`OrderStatus === "accepted"`). See `activity_summary.ts`'s own header. */
      readonly unpaid: number;
      readonly paidReadyToFulfill: number;
      readonly fulfillingInProgress: number;
      readonly completedAwaitingReceipt: number;
    };
  };
  /**
   * Commerce E2E Completion arc (coordinator) -- the narrow slice of the
   * real `os/trust` barrel this main process needs to issue/verify a
   * signed Commerce receipt (`os/commerce/receipt/commerce_trust_receipt_adapter.ts`'s
   * own two required collaborators it never constructs itself: a signing
   * keypair and a verification policy). Loaded exactly like `Commerce`
   * above -- compiled `dist/`, dynamic `import()`. This is the ONLY
   * `os/trust` surface this main process touches.
   *
   * FedOS Commerce FINAL P1 Closure (Agent K2) -- extended (never replaced)
   * with the durable sealed-signing-key-store wiring
   * (`src/os/trust/issuer/durable_receipt_issuer_signing_key_store.ts`)
   * `commerceReceiptSigningState()` below now uses to make the Receipt-issuer
   * keypair survive a restart, instead of regenerating in lockstep with its
   * policy every process launch.
   */
  readonly Trust: {
    readonly FedosTrustSigningKeypair: { readonly generate: () => { readonly publicKeyHex: string } };
    readonly createSingleIssuerFedosTrustPolicy: (options: { readonly issuerId: string; readonly keys: readonly { readonly keyId: string; readonly publicKeyHex: string }[] }) => unknown;
    readonly DurableSealedSigningKeyStore: new (filePath: string) => unknown;
    readonly resolveReceiptIssuerSigningKeypair: (
      masterSeedAuthority: MasterSeedAuthorityLike | null,
      store: unknown,
      issuerId: string,
    ) => Promise<ReceiptIssuerSigningKeyResolution>;
    /**
     * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
     * (Agent D) -- friction-ledger row #11 / arc §34: renders a real,
     * scannable QR PNG from the already-signed receipt QR text. The
     * `qrcode` npm package underneath is ALREADY a real, packaged runtime
     * dependency of this app (`src/os/trust/qr/fedos_trust_qr_image.ts`'s
     * own header) -- this is its first Commerce production caller.
     */
    readonly renderFedosTrustQrTextToPngDataUrl: (text: string) => Promise<string>;
  };
  /**
   * FedOS Commerce FINAL Closure Mega-Arc (coordinator, central integration
   * pass) -- Agent R's `os/commerce/reputation/index.ts` (its own scoped
   * barrel, mirroring `./order/index.ts`'s convention -- NOT re-exported
   * from the top-level `os/commerce/index.ts` barrel, since Reputation is
   * additive/optional the same way Nostr publication is). Loaded exactly
   * like `Commerce`/`Trust` above -- compiled `dist/`, dynamic `import()`.
   */
  readonly Reputation: {
    readonly LocalPersonaEpochRegistry: new () => CommercePersonaEpochRegistryLike;
    /** Commerce Durability arc (coordinator) -- durable sibling, same shape, append-only NDJSON-backed. */
    readonly DurablePersonaEpochRegistry: new (filePath: string) => CommercePersonaEpochRegistryLike;
    readonly LocalTradeCompletionAttestationStore: new () => CommerceTradeCompletionAttestationStoreLike;
    /** Commerce Durability arc (coordinator) -- durable sibling; its replay-time dedupe hydration is what makes "same completed trade can't re-attest" survive a restart. */
    readonly DurableTradeCompletionAttestationStore: new (filePath: string) => CommerceTradeCompletionAttestationStoreLike;
    readonly createPersonaEpoch: (
      validFrom: number,
      validUntil: number,
      predecessorEpochId?: string,
    ) => { readonly epoch: CommercePersonaEpochLike; readonly keypair: CommercePersonaEpochSigningKeypairLike };
    readonly issueTradeCompletionAttestation: (
      deps: { readonly orderRepository: CommerceOrderRepositoryLike; readonly store: CommerceTradeCompletionAttestationStoreLike },
      request: Record<string, unknown>,
      now: number,
    ) => CommerceIssueTradeCompletionAttestationResultLike;
    readonly queryPersonaBoardView: (
      subjectEpochId: string,
      layer: "PUBLIC" | "PSEUDONYMOUS_PROOF" | "AUTHORIZED",
      registry: CommercePersonaEpochRegistryLike,
      store: CommerceTradeCompletionAttestationStoreLike,
      asOf: number,
    ) => CommercePersonaBoardQueryResultLike | undefined;
    /** Commerce FINAL P1 Closure (Agent K1) -- restart-durable, sealed-at-rest
     * custody for the Persona Epoch signing keypair; see that module's own
     * header for the full design. */
    readonly generatePersonaEpochId: () => string;
    readonly DurableSealedSigningKeyStore: new (filePath: string) => CommerceSealedSigningKeyStoreLike;
    readonly resolvePersonaEpochSigningKeypair: (
      masterSeedAuthority: MasterSeedAuthorityLike | null,
      store: CommerceSealedSigningKeyStoreLike,
      subjectId: string,
      createIfAbsent: boolean,
      candidateEpochIdForFreshKey: string,
      nowUnixSeconds: number,
    ) => Promise<CommercePersonaEpochSigningKeyResolveResultLike>;
  };
  /**
   * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent M's real
   * `WasmProductMediaEncryption`/`WasmProductMediaDecryption` adapters plus
   * `IpfsMediaStore` itself, all now barreled from `os/commerce/index.ts`
   * (see that file's own Commerce FINAL Closure header addition).
   */
  readonly Media: {
    readonly IpfsMediaStore: new (
      transport: unknown,
      maxPayloadByteLength: number,
      supportedContentTypes: readonly string[],
      encryption?: unknown,
      networkProfile?: string,
      now?: () => number,
      decryption?: unknown,
      indexPersistence?: unknown,
    ) => CommerceMediaStoreLike;
    readonly InMemoryIpfsTransport: new (options?: { readonly simulateOffline?: boolean }) => unknown;
    readonly WasmProductMediaEncryption: new (authority?: unknown) => unknown;
    readonly WasmProductMediaDecryption: new (authority?: unknown) => unknown;
    /** Real Digital Delivery mega-arc (Coordinator, protected-media-byte-durability closure) -- durable `IpfsTransport`, disk-backed, one blob file per content-addressed CID under the given directory. See `src/os/commerce/catalog/persistence/durable_ipfs_transport.ts`'s own header. */
    readonly DurableIpfsTransport: new (blobDir: string) => unknown;
    /** Real Digital Delivery mega-arc (Coordinator, protected-media-byte-durability closure) -- durable persistence for `IpfsMediaStore`'s own private metadata index, injected as that class's new `indexPersistence` constructor parameter. See `src/os/commerce/catalog/persistence/durable_ipfs_media_store_index.ts`'s own header. */
    readonly DurableIpfsMediaStoreIndex: new (filePath: string) => unknown;
  };
  /**
   * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's
   * outbound Port + real Nostr adapter transport, and the inbound
   * read-model + real verifying bridge. NOT part of `os/commerce/index.ts`'s
   * public barrel (that file's own header explicitly leaves this decision
   * to the coordinator's own composition-root wiring) -- loaded here via
   * explicit `tsconfig.beta-runtime.json` entries for the four files this
   * needs, the same "explicit whitelist, one entry per reachable file"
   * discipline that file already documents for every other module in this
   * function.
   */
  readonly CommerceNostr: {
    readonly CommerceNostrEventPortImpl: new (transport: CommerceNostrTransportLike, networkProfile?: string) => CommerceNostrEventPortLike;
    readonly RealCommerceNostrEventTransport: new (options: {
      readonly signingAuthority: unknown;
      readonly relayPublisher: unknown;
      readonly accountIndex: number;
    }) => CommerceNostrTransportLike;
    readonly CommerceNostrProductReadModel: new () => CommerceNostrReadModelLike;
    readonly verifyAndBuildInboundCommerceNostrEnvelope: (event: unknown, options?: unknown) => Promise<unknown>;
    readonly WebSocketRelayPublisher: new (url: string, options: { readonly factory: (url: string) => Promise<unknown> }) => unknown;
    /**
     * FedOS Commerce FINAL Closure Mega-Arc (Agent N, discovery wiring
     * pass) -- the READ-ONLY sibling of `WebSocketRelayPublisher` above:
     * this repo's own real, already-tested NIP-01 `REQ`/`EVENT`/`EOSE`
     * subscription client (`WebSocketRelayAdapter`,
     * `src/os/messenger/adapters/nostr/protocol/ws_relay.ts`, unmodified
     * by this pass, newly added to `tsconfig.beta-runtime.json`'s include
     * list). This is the ONE new collaborator this pass adds to close the
     * "no SUBSCRIBE/inbound path anywhere" gap `commerce_nostr_event_port.ts`'s
     * own header explicitly flagged -- no second relay client, no new
     * protocol implementation, reuse only.
     */
    readonly WebSocketRelayAdapter: new (
      url: string,
      options: { readonly factory: (url: string) => Promise<unknown>; readonly timeoutMs?: number },
    ) => { query(filters: readonly unknown[]): Promise<readonly unknown[]> };
    /**
     * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent
     * N, Coordinator-directed pass) -- the PRIVATE Order/status transport
     * (arc items #4/#5). Calls `FedosMasterSeedAuthority.encryptNip44Wire()`/
     * `decryptNip44Wire()` directly (the SAME real NIP-44 primitive the
     * Gift-Wrap adapter uses underneath) -- see
     * `commerce_private_order_bridge.ts`'s own header for exactly why the
     * full NIP-17 Gift-Wrap stack was evaluated and rejected for Commerce.
     */
    readonly RealCommercePrivateOrderTransport: new (options: {
      readonly signingAuthority: unknown;
      readonly relayPublisher: unknown;
      readonly nip44Wire: unknown;
      readonly accountIndex: number;
    }) => { send(payload: unknown, counterpartyPublicKeyHex: string): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }> };
    readonly verifyAndDecryptInboundPrivateOrderEnvelope: (
      event: unknown,
      options: { readonly nip44Wire: unknown; readonly localAccountIndex: number },
    ) => Promise<{
      readonly outcome: string;
      readonly eventId: string;
      readonly senderPubkeyHex: string;
      readonly payload?: {
        readonly orderId: string;
        readonly productId: string;
        readonly buyerPubkey: string;
        readonly sellerPubkey: string;
        readonly quantity: number;
        readonly unitPriceCents: number;
        readonly currency: string;
        readonly status: string;
        readonly reason?: string;
        readonly at: number;
      };
    }>;
    readonly COMMERCE_PRIVATE_ORDER_SYNC_TAG: string;
    readonly PRIVATE_ORDER_SYNC_STATUS_ACTION: Readonly<Record<string, { readonly action: string; readonly actorKind: "customer" | "merchant" | "either" }>>;
    /**
     * Pure reconciliation logic, `src/os/commerce/events/commerce_private_order_apply.ts`
     * -- see that file's own header for the completion-lag defect its
     * TRI-STATE outcome exists to close. Loaded here (not `Commerce`)
     * alongside its Delivery sibling below, since it is a
     * private-sync-only concern.
     */
    readonly applyInboundPrivateOrderSyncPayload: (input: {
      readonly existingOrder: CommerceOrderLike | undefined;
      readonly senderPubkeyHex: string;
      readonly payload: {
        readonly orderId: string;
        readonly productId: string;
        readonly buyerPubkey: string;
        readonly sellerPubkey: string;
        readonly quantity: number;
        readonly unitPriceCents: number;
        readonly currency: string;
        readonly status: string;
        readonly reason?: string;
        readonly at: number;
      };
    }) =>
      | { readonly outcome: "applied"; readonly order: CommerceOrderLike }
      | { readonly outcome: "permanently-inapplicable"; readonly reason: string }
      | { readonly outcome: "retry-later"; readonly reason: string };
    /**
     * FedOS Commerce Purchase Completion mega-arc (Agent D) -- the PRIVATE
     * `Delivery`/status transport (arc "Cross-process delivery"
     * requirement). Same shape/design as `RealCommercePrivateOrderTransport`/
     * `verifyAndDecryptInboundPrivateOrderEnvelope` above -- see
     * `commerce_private_delivery_bridge.ts`'s own header for why this
     * reuses the SAME NIP-44-direct + real signing/relay primitives rather
     * than a second transport stack.
     */
    readonly RealCommercePrivateDeliveryTransport: new (options: {
      readonly signingAuthority: unknown;
      readonly relayPublisher: unknown;
      readonly nip44Wire: unknown;
      readonly accountIndex: number;
    }) => { send(payload: unknown, counterpartyPublicKeyHex: string): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }> };
    readonly verifyAndDecryptInboundPrivateDeliveryEnvelope: (
      event: unknown,
      options: { readonly nip44Wire: unknown; readonly localAccountIndex: number },
    ) => Promise<{
      readonly outcome: string;
      readonly eventId: string;
      readonly senderPubkeyHex: string;
      readonly payload?: {
        readonly deliveryId: string;
        readonly orderId: string;
        readonly buyerPubkey: string;
        readonly sellerPubkey: string;
        readonly action: string;
        readonly reason?: string;
        readonly at: number;
      };
    }>;
    readonly COMMERCE_PRIVATE_DELIVERY_SYNC_TAG: string;
    /** Pure reconciliation logic, `src/os/commerce/events/commerce_private_delivery_apply.ts` -- see that file's own header. Loaded here (not `Commerce`) since it is a private-sync-only concern, mirroring where `RealCommercePrivateDeliveryTransport` itself lives. */
    readonly applyInboundPrivateDeliverySyncPayload: (input: {
      readonly existingDelivery: CommerceDeliveryRecordLike | undefined;
      readonly orderPaymentConfirmed: boolean;
      readonly senderPubkeyHex: string;
      readonly payload: {
        readonly deliveryId: string;
        readonly orderId: string;
        readonly buyerPubkey: string;
        readonly sellerPubkey: string;
        readonly action: string;
        readonly reason?: string;
        readonly at: number;
      };
    }) =>
      | { readonly outcome: "applied"; readonly delivery: CommerceDeliveryRecordLike }
      | { readonly outcome: "no-op"; readonly retryable: boolean }
      | { readonly outcome: "rejected"; readonly reason: string; readonly retryable: boolean };
    /**
     * FedOS Commerce Purchase Completion mega-arc (Agent P, wired here by
     * the Coordinator's integration phase) -- the PRIVATE
     * `PaymentEvidence` transport. Agent P built and tested the transport,
     * the wire schema and the receiver-validation gate but deliberately
     * left the Electron-main wiring to integration; these four entries are
     * that wiring's module surface, mirroring the Delivery block
     * immediately above one-for-one.
     *
     * `RealPaymentEvidenceTransport` (NOT the lower-level
     * `RealCommercePrivatePaymentEvidenceTransport`) is the one loaded
     * here on purpose: it is the domain-facing adapter that runs
     * `buildOutboundPaymentEvidenceSyncPayload()`'s OUTBOUND authority
     * re-check before anything touches the network, so this file cannot
     * accidentally bypass that gate by constructing a wire payload itself.
     */
    readonly RealPaymentEvidenceTransport: new (options: {
      readonly signingAuthority: unknown;
      readonly relayPublisher: unknown;
      readonly nip44Wire: unknown;
      readonly accountIndex: number;
    }) => {
      send(
        evidence: CommercePaymentEvidenceLike,
        binding: { readonly orderId: string; readonly amountCents: number; readonly currency: string },
        counterpartyPubkeyHex: string,
      ): Promise<{ readonly accepted: boolean; readonly message: string }>;
    };
    readonly verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope: (
      event: unknown,
      options: { readonly nip44Wire: unknown; readonly localAccountIndex: number },
    ) => Promise<{
      readonly outcome: string;
      readonly eventId: string;
      readonly senderPubkeyHex: string;
      /** Deliberately typed as the raw wire shape only -- `applyInboundPaymentEvidenceSync` below re-validates it from scratch and this file never reads a field off it directly. */
      readonly payload?: { readonly orderId: string; readonly paymentId: string; readonly productId: string; readonly amountCents: number; readonly currency: string };
    }>;
    readonly COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG: string;
    /**
     * Agent P's RECEIVER-side validation gate
     * (`src/os/commerce/payment/payment_evidence_port.ts`). Every check it
     * performs runs BEFORE `ledger.apply()` is ever called; a rejection at
     * any step leaves the settlement ledger completely untouched. This
     * file must never reconstruct a `PaymentEvidence` from a wire payload
     * itself -- only this function may.
     */
    readonly applyInboundPaymentEvidenceSync: (
      senderPubkeyHex: string,
      payload: unknown,
      expectation: {
        readonly expectedOrderId: string;
        readonly expectedCounterpartyPubkeyHex: string;
        readonly expectedAmountCents: number;
        readonly expectedCurrency: string;
        readonly expectedProviderIdentity?: string;
      },
      ledger: { apply(evidence: CommercePaymentEvidenceLike, expectedOrderId: string): CommerceSettlementApplyResultLike },
    ) =>
      | { readonly accepted: true; readonly result: CommerceSettlementApplyResultLike }
      | { readonly accepted: false; readonly reason: string };
    /**
     * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- the
     * FOURTH private-sync channel: `MediaAccessGrant` release
     * request/response. `commerce_private_media_release_bridge.ts` (two
     * transports/two verify functions, request + response directions) plus
     * `commerce_private_media_release_apply.ts` (the pure orchestration
     * layer building/applying each direction) -- see those files' own
     * headers for the full design.
     */
    readonly RealCommercePrivateMediaReleaseRequestTransport: new (options: {
      readonly signingAuthority: unknown;
      readonly relayPublisher: unknown;
      readonly nip44Wire: unknown;
      readonly accountIndex: number;
    }) => {
      send(
        payload: { readonly orderId: string; readonly mediaId: string; readonly buyerPubkey: string; readonly sellerPubkey: string; readonly at: number },
        counterpartyPublicKeyHex: string,
      ): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }>;
    };
    readonly verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope: (
      event: unknown,
      options: { readonly nip44Wire: unknown; readonly localAccountIndex: number },
    ) => Promise<{
      readonly outcome: string;
      readonly eventId: string;
      readonly senderPubkeyHex: string;
      readonly payload?: { readonly orderId: string; readonly mediaId: string; readonly buyerPubkey: string; readonly sellerPubkey: string; readonly at: number };
    }>;
    readonly COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG: string;
    readonly RealCommercePrivateMediaReleaseTransport: new (options: {
      readonly signingAuthority: unknown;
      readonly relayPublisher: unknown;
      readonly nip44Wire: unknown;
      readonly accountIndex: number;
    }) => {
      send(payload: CommercePrivateMediaReleasePayloadLike, counterpartyPublicKeyHex: string): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }>;
    };
    readonly verifyAndDecryptInboundPrivateMediaReleaseEnvelope: (
      event: unknown,
      options: { readonly nip44Wire: unknown; readonly localAccountIndex: number },
    ) => Promise<{
      readonly outcome: string;
      readonly eventId: string;
      readonly senderPubkeyHex: string;
      readonly payload?: CommercePrivateMediaReleasePayloadLike;
    }>;
    readonly COMMERCE_PRIVATE_MEDIA_RELEASE_TAG: string;
    readonly buildOutboundPrivateMediaReleaseResponse: (input: {
      readonly requestPayload: { readonly orderId: string; readonly mediaId: string; readonly buyerPubkey: string; readonly sellerPubkey: string; readonly at: number };
      readonly senderPubkeyHex: string;
      readonly ownPubkeyHex: string;
      readonly order: { readonly id: string; readonly productId: string; readonly buyerPubkey: string; readonly sellerPubkey: string; readonly status: string } | undefined;
      readonly media:
        | { readonly id: string; readonly productId: string; readonly classification: "public" | "protected"; readonly storageRef: string; readonly contentType: string; readonly checksum: string }
        | undefined;
      readonly candidateGrantEnvelope: unknown;
      readonly latestKnownGrantVersion: number;
      /** Real Digital Delivery mega-arc (Agent G, Grant Custody pass) — see `EvaluateMediaAccessGrantInput.sellerAuthorizedDelegateSigningKeys`'s own header (`src/os/commerce/media_grant/media_access_grant_policy.ts`). */
      readonly sellerAuthorizedDelegateSigningKeys?: readonly string[];
      readonly now: number;
      readonly merchantAccountIndex: number;
      readonly authority: MasterSeedAuthorityLike;
      /** Real Digital Delivery mega-arc (Agent G, Grant Custody pass) — was missing entirely; see `BuildOutboundPrivateMediaReleaseResponseInput.getStoredCiphertextChecksum`'s own header (`src/os/commerce/events/commerce_private_media_release_apply.ts`). */
      readonly getStoredCiphertextChecksum: (storageRef: string) => string | null;
      readonly getProtectedContent: (storageRef: string) => Promise<Uint8Array | null>;
    }) => Promise<CommercePrivateMediaReleasePayloadLike>;
    readonly applyInboundPrivateMediaReleaseResponse: (input: {
      readonly payload: CommercePrivateMediaReleasePayloadLike;
      readonly senderPubkeyHex: string;
      readonly ownPubkeyHex: string;
      readonly order: { readonly id: string; readonly sellerPubkey: string };
      readonly expectedMediaId: string;
      readonly buyerAccountIndex: number;
      readonly authority: MasterSeedAuthorityLike;
    }) => Promise<
      | { readonly outcome: "verified"; readonly record: CommerceMediaReleaseContentRecordLike }
      | { readonly outcome: "denied"; readonly reason: string }
      | { readonly outcome: "unauthorized"; readonly reason: string }
      | { readonly outcome: "wrap-unavailable" }
      | { readonly outcome: "content-corrupt" }
    >;
    // Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) —
    // Agent M's protocol. See product_media_sync_bridge.ts /
    // product_media_declaration_types.ts.
    readonly NostrProductMediaSyncPort: new (port: CommerceNostrEventPortLike) => {
      publishDeclaration(declaration: unknown): Promise<{ readonly outcome: string; readonly reason?: string; readonly eventId?: string }>;
      publishRetraction(retraction: unknown): Promise<{ readonly outcome: string; readonly reason?: string; readonly eventId?: string }>;
    };
    readonly deriveProductMediaDeclaration: (
      media: { readonly id: string; readonly productId: string; readonly role: string; readonly classification: "public" | "protected"; readonly contentType: string; readonly sizeBytes: number; readonly checksum: string; readonly checksumSubject: "plaintext" | "ciphertext"; readonly altText?: string },
      sellerPubkey: string,
      version: number,
      declaredAt: number,
    ) => unknown;
    readonly buildProductMediaRetraction: (productId: string, mediaId: string, sellerPubkey: string, version: number, retractedAt: number) => unknown;
    /**
     * Real Digital Delivery mega-arc (Agent G, Grant Custody pass) --
     * closes Blocker 5. See
     * `commerce_media_grant_signing_key_delegation_bridge.ts`'s own header
     * for the full mechanism.
     */
    readonly signMediaGrantSigningKeyDelegation: (
      signingAuthority: unknown,
      delegateKeyPublicHex: string,
      accountIndex: number,
      createdAt: number,
    ) => Promise<unknown>;
    readonly verifyMediaGrantSigningKeyDelegationEvent: (
      event: unknown,
      options: { readonly expectedSellerPubkeyHex: string; readonly expectedDelegateKeyPublicHex: string },
    ) => Promise<
      | { readonly outcome: "valid"; readonly sellerPubkeyHex: string; readonly delegateKeyPublicHex: string }
      | { readonly outcome: "malformed" | "wrong-kind" | "wrong-tag" | "signature-invalid" | "seller-mismatch" | "delegate-mismatch" }
    >;
  };
}

/** Structural mirrors of the real `os/commerce` types (`Product`, `Order`, `PaymentEvidence`, ...) -- same discipline as `FedosCommerceDemoProduct` above: this file never `import type`s from `src/os/commerce/**` (only the compiled runtime, dynamically), so every shape it touches is re-declared here, structurally, once. */
interface CommerceProductLike {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly description?: string;
  readonly creatorPubkey: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly status: string;
  readonly visibility: string;
  readonly linkedSpaceIds: readonly string[];
  readonly linkedEventIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly stock?: number;
}
interface CommerceProductMutationResultLike {
  readonly outcome: "ok" | "not-found" | "forbidden" | "invalid-input";
  readonly product?: CommerceProductLike;
  readonly reason?: string;
}
interface CommerceProductRepositoryLike {
  create(actorPubkey: string, input: Record<string, unknown>): CommerceProductMutationResultLike;
  update(actorPubkey: string, productId: string, patch: Record<string, unknown>): CommerceProductMutationResultLike;
  publish(actorPubkey: string, productId: string): CommerceProductMutationResultLike;
  unpublish(actorPubkey: string, productId: string): CommerceProductMutationResultLike;
  get(id: string): CommerceProductLike | undefined;
  list(): readonly CommerceProductLike[];
  listOwnedByMerchant(actorPubkey: string): readonly CommerceProductLike[];
  listPublished(): readonly CommerceProductLike[];
}
interface CommerceOrderActorLike {
  readonly kind: "customer" | "merchant" | "payment_evidence" | "delivery_evidence";
  readonly pubkey?: string;
}
interface CommerceOrderLike {
  readonly id: string;
  readonly productId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly status: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly paymentId?: string;
  readonly deliveryId?: string;
  readonly history: readonly { readonly from: string | null; readonly to: string; readonly at: number }[];
  readonly [key: string]: unknown;
}
interface CommerceCreateOrderInputLike {
  readonly id: string;
  readonly productId: string;
  readonly sellerPubkey: string;
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly quantity?: number;
}
interface CommerceOrderActionLike {
  readonly type: string;
  readonly actor: CommerceOrderActorLike;
  readonly [key: string]: unknown;
}
interface CommerceOrderTransitionResultLike {
  readonly ok: boolean;
  readonly order?: CommerceOrderLike;
  readonly reason?: string;
  readonly code?: string;
}
interface CommerceOrderRepositoryLike {
  save(order: CommerceOrderLike): void;
  findById(id: string): CommerceOrderLike | undefined;
  list(): readonly CommerceOrderLike[];
  listByBuyer(buyerPubkey: string): readonly CommerceOrderLike[];
  listBySeller(sellerPubkey: string): readonly CommerceOrderLike[];
}

// ---------------------------------------------------------------------
// FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
// (Agent D) -- structural mirrors for the receipt-persistence,
// product-media, and MediaAccessGrant real production wiring.
// ---------------------------------------------------------------------
interface CommerceReceiptStoreLike {
  getByOrderId(orderId: string): { readonly orderId: string; readonly envelope: unknown; readonly issuedAt: number } | undefined;
  putIfAbsent(orderId: string, envelope: unknown, issuedAt: number): "inserted" | "already-present";
}
interface CommerceProductMediaLike {
  readonly id: string;
  readonly productId: string;
  readonly role: string;
  readonly classification: "public" | "protected";
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly checksumSubject: "plaintext" | "ciphertext";
  readonly altText?: string;
  readonly storageRef: string;
}
type CommerceProductMediaMutationResultLike =
  | { readonly outcome: "ok"; readonly media: CommerceProductMediaLike }
  | { readonly outcome: "forbidden" | "invalid-input" | "not-found"; readonly reason?: string };
interface CommerceProductMediaRepositoryLike {
  add(
    actorPubkey: string,
    product: CommerceProductLike,
    input: {
      readonly role: string;
      readonly classification: "public" | "protected";
      readonly contentType: string;
      readonly sizeBytes: number;
      readonly checksum: string;
      readonly checksumSubject: "plaintext" | "ciphertext";
      readonly altText?: string;
      readonly storageRef: string;
    },
  ): CommerceProductMediaMutationResultLike;
  get(mediaId: string): CommerceProductMediaLike | undefined;
  listForProduct(productId: string): readonly CommerceProductMediaLike[];
}
interface CommerceMediaAccessGrantEnvelopeLike {
  readonly [key: string]: unknown;
  readonly payload: {
    readonly mediaId: string;
    readonly productId: string;
    readonly buyerPubkey: string;
    readonly orderId: string;
    readonly grantVersion: number;
    readonly revoked: boolean;
    /** Real Digital Delivery mega-arc (Agent G, Grant Custody pass) -- the delegate signing key that actually signed this grant; see `MediaAccessGrantPayload.issuerPubkey`'s own doc (`src/os/commerce/media_grant/media_access_grant_types.ts`). */
    readonly issuerPubkey: string;
  };
}
interface CommerceMediaAccessGrantPersistenceLike {
  putGrant(envelope: CommerceMediaAccessGrantEnvelopeLike): "inserted" | "already-present" | "conflict" | "failed";
  listGrants(): readonly CommerceMediaAccessGrantEnvelopeLike[];
}
type CommerceIssueMediaAccessGrantsOutcomeLike =
  | { readonly outcome: "issued"; readonly envelopes: readonly CommerceMediaAccessGrantEnvelopeLike[] }
  | { readonly outcome: "no-protected-media" | "order-not-qualifying" | "seller-not-grant-capable" };
type CommerceMediaAccessDecisionLike =
  | { readonly allowed: true; readonly grant: { readonly buyerPubkey: string } }
  | { readonly allowed: false; readonly reason: string; readonly detail?: string };
type CommerceWrapMediaAccessGrantReleaseResultLike =
  | { readonly outcome: "released"; readonly wireCiphertext: string }
  | { readonly outcome: "denied"; readonly reason: string; readonly detail?: string }
  | { readonly outcome: "payload-too-large" | "wrap-unavailable" };
type CommerceMediaGrantSigningKeyResolveResultLike =
  | { readonly outcome: "restored" | "created"; readonly keypair: { readonly publicKeyHex: string }; readonly generation: number }
  | { readonly outcome: "not-found" | "sealing-unavailable" | "seal-failed" }
  | { readonly outcome: "corrupted"; readonly reason: string };
/** BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A). */
interface CommerceMediaReleaseContentRecordLike {
  readonly orderId: string;
  readonly mediaId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly grantVersion: number;
  readonly contentType: string;
  readonly contentDigest: string;
  readonly contentBase64: string;
  readonly obtainedAt: number;
}
interface CommerceMediaReleaseContentCacheLike {
  putRelease(record: CommerceMediaReleaseContentRecordLike): "inserted" | "already-present" | "conflict" | "failed";
  getRelease(orderId: string, mediaId: string, buyerPubkey: string): CommerceMediaReleaseContentRecordLike | undefined;
  hasRelease(orderId: string, mediaId: string, buyerPubkey: string): boolean;
  listReleasesForOrder(orderId: string, buyerPubkey: string): readonly CommerceMediaReleaseContentRecordLike[];
}
/** CROSS-PROCESS COMPLETION SYNC mega-arc (Coordinator) -- the SELLER's own, independently-verified counterpart to `CommerceMediaReleaseContentRecordLike` above. See `durable_media_release_issuance_log.ts`'s own header. */
interface CommerceMediaReleaseIssuanceRecordLike {
  readonly orderId: string;
  readonly mediaId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly grantVersion: number;
  readonly contentDigest: string;
  readonly issuedAt: number;
}
interface CommerceMediaReleaseIssuanceLogLike {
  recordIssuance(record: CommerceMediaReleaseIssuanceRecordLike): "inserted" | "already-present" | "conflict" | "failed";
  hasIssuedRelease(orderId: string, mediaId: string, buyerPubkey: string): boolean;
}
/** BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- `PrivateMediaReleasePayload`'s structural mirror (discriminated union: released | denied). */
type CommercePrivateMediaReleasePayloadLike =
  | {
      readonly category: "private-media-release";
      readonly formatVersion: 1;
      readonly outcome: "released";
      readonly orderId: string;
      readonly mediaId: string;
      readonly buyerPubkey: string;
      readonly sellerPubkey: string;
      readonly grantVersion: number;
      readonly contentType: string;
      readonly contentDigest: string;
      readonly wireCiphertext: string;
      readonly at: number;
    }
  | {
      readonly category: "private-media-release";
      readonly formatVersion: 1;
      readonly outcome: "denied";
      readonly orderId: string;
      readonly mediaId: string;
      readonly buyerPubkey: string;
      readonly sellerPubkey: string;
      readonly reason: string;
      readonly at: number;
    };
interface CommercePaymentEvidenceLike {
  readonly paymentId: string;
  readonly productId: string;
  readonly orderId?: string;
  readonly observedAt: number;
  readonly status: string;
  readonly reason?: string;
  readonly verification?: { readonly source: string; readonly authoritative: boolean };
}
interface CommerceLocalPaymentProviderLike {
  /**
   * Commerce Real Two-Party UX Closure (Agent U) — `idempotencyKey` added to
   * the request shape this file passes through. `os/commerce/payment/types.ts`'s
   * own `PaymentRequest.idempotencyKey` already existed; this local `*Like`
   * structural mirror had simply never been updated to carry it, which is
   * the entire reason `handleCommercePaymentRequest()` below could never
   * honor it even though `DeterministicLocalPaymentProvider` (once fixed the
   * SAME arc, see `payment/local_simulator.ts`) now implements it exactly
   * like its sibling `PlaceholderPaymentProvider` already did.
   */
  requestPayment(request: { readonly productId: string; readonly orderId?: string; readonly buyerPubkey?: string; readonly amountCents: number; readonly currency: string; readonly expiresAt?: number; readonly idempotencyKey?: string }): Promise<{
    readonly allowed: boolean;
    readonly status: string;
    readonly reason: string;
    readonly productId: string;
    readonly orderId?: string;
    readonly paymentId?: string;
    readonly expiresAt?: number;
    readonly idempotencyKey?: string;
  }>;
  /**
   * FedOS Commerce "Purchase Completion" mega-arc (Two-Process E2E agent) --
   * this structural mirror previously declared the outcome vocabulary as
   * `"settled" | "failed" | "expired" | "refunded"`. That is NOT the real
   * `SimulatedSettlementOutcome` (`src/os/commerce/payment/local_simulator.ts`),
   * which is `"paid" | "failed" | "expired" | "refunded" | "disputed"` --
   * `"settled"` is not a member of it at all, and `"disputed"` was missing.
   * Because this file deliberately never `import type`s from
   * `src/os/commerce/**` (it loads only the compiled runtime, dynamically),
   * the compiler could not catch the mismatch, and the single live call
   * site below passed the non-existent `"settled"` for the whole life of
   * this handler (since `d6c3a942`). See `handleCommercePaymentSimulate()`
   * for the full account of what that actually did at runtime. Corrected
   * here to the provider's own real, published vocabulary so the compiler
   * catches any future drift.
   */
  simulateSettlement(paymentId: string, outcome: "paid" | "failed" | "expired" | "refunded" | "disputed"): Promise<CommercePaymentEvidenceLike>;
}
interface CommerceSettlementStateLike {
  readonly paymentId: string;
  readonly orderId: string;
  readonly productId: string;
  readonly status: string;
}
interface CommerceSettlementApplyResultLike {
  readonly state: CommerceSettlementStateLike;
  readonly outcome: "transitioned" | "rejected" | "noop";
  readonly reason?: string;
}
interface CommercePaymentLedgerLike {
  bind(paymentId: string, orderId: string, productId: string, createdAt?: number): CommerceSettlementStateLike;
  get(paymentId: string): CommerceSettlementStateLike | undefined;
  apply(evidence: CommercePaymentEvidenceLike, expectedOrderId: string): CommerceSettlementApplyResultLike;
}
interface CommerceDeliveryActorLike {
  readonly kind: "merchant" | "customer" | "delivery_evidence";
  readonly pubkey?: string;
}
interface CommerceDeliveryRecordLike {
  readonly id: string;
  readonly orderId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly status: string;
  readonly receiptArtifact?: unknown;
  readonly [key: string]: unknown;
}
interface CommerceCreateDeliveryInputLike {
  readonly id: string;
  readonly orderId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly orderPaymentConfirmed: boolean;
}
interface CommerceDeliveryActionLike {
  readonly type: string;
  readonly actor: CommerceDeliveryActorLike;
  readonly [key: string]: unknown;
}
interface CommerceDeliveryTransitionResultLike {
  readonly ok: boolean;
  readonly delivery?: CommerceDeliveryRecordLike;
  readonly reason?: string;
  readonly code?: string;
}
interface CommerceDeliveryRepositoryLike {
  save(delivery: CommerceDeliveryRecordLike): void;
  findById(id: string): CommerceDeliveryRecordLike | undefined;
  findByOrderId(orderId: string): CommerceDeliveryRecordLike | undefined;
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator, central integration
 * pass) -- structural mirrors of `os/commerce/reputation/`'s real shapes,
 * same "never `import type` from `src/os/commerce/**`" discipline as every
 * other `*Like` interface in this file.
 */
interface CommercePersonaEpochLike {
  readonly epochId: string;
  readonly epochKeyPublicHex: string;
  readonly validFrom: number;
  readonly validUntil: number;
  readonly predecessorEpochId?: string;
}
interface CommercePersonaEpochSigningKeypairLike {
  readonly publicKeyHex: string;
}
interface CommercePersonaEpochRegistryLike {
  register(epoch: CommercePersonaEpochLike): void;
  findById(epochId: string): CommercePersonaEpochLike | undefined;
  isCurrentlyValid(epochId: string, atTimeUnixSeconds: number): boolean;
}
interface CommerceTradeCompletionAttestationStoreLike {
  hasAttestedOrder(orderId: string, attestorRealPubkey: string): boolean;
  findBySubjectEpochId(subjectEpochId: string): readonly unknown[];
}
interface CommerceIssueTradeCompletionAttestationResultLike {
  readonly ok: boolean;
  readonly code?: string;
  readonly reason?: string;
}
interface CommercePersonaBoardViewLike {
  readonly layer: string;
  readonly epochId: string;
  readonly epochKeyPublicHex?: string;
  readonly verifiedTradeCountBucket?: string;
  readonly verifiedTradeCount?: number;
  readonly primaryCategory?: string;
  readonly attestationRefs: readonly string[];
}
interface CommercePersonaBoardQueryResultLike {
  readonly view: CommercePersonaBoardViewLike;
  readonly verificationState: {
    readonly epochKnown: boolean;
    readonly epochCurrentlyValid: boolean;
    readonly totalStoredAttestations: number;
    readonly validSignatureAttestations: number;
    readonly rejectedSignatureAttestations: number;
  };
}
/**
 * FedOS Commerce FINAL P1 Closure (Agent K1) -- structural mirrors of
 * `os/commerce/reputation/persistence/durable_persona_epoch_signing_key_store.ts`'s
 * real shapes. `CommerceSealedSigningKeyStoreLike` is deliberately an
 * opaque marker type -- this file never calls any method on it directly
 * (all store access happens inside `resolvePersonaEpochSigningKeypair`/
 * `sealNextGenerationPersonaEpochSigningKeypair`), it only constructs one
 * and passes it through.
 */
type CommerceSealedSigningKeyStoreLike = { readonly __fedosSealedSigningKeyStoreOpaqueBrand?: never };
interface CommercePersonaEpochSigningKeyResolveResultLike {
  readonly outcome: "restored" | "created" | "not-found" | "sealing-unavailable" | "seal-failed" | "corrupted";
  readonly keypair?: CommercePersonaEpochSigningKeypairLike;
  readonly generation?: number;
  readonly epochId?: string;
  readonly reason?: string;
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- structural mirror
 * of `IpfsMediaStore`'s own public surface. This main process only ever
 * constructs and holds an instance (proving Agent M's real Master Seed
 * Authority injection makes it genuinely live) -- no IPC channel calls any
 * method on it this pass, so only the shape needed to construct/introspect
 * it is declared.
 */
/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- widened from a bare index signature to the real,
 * structural `IpfsMediaStore` surface this arc actually calls
 * (`./catalog/ipfs_media_store.ts`'s own public methods): the first real
 * IPC-reachable caller of `commerceMediaStoreFor()` beyond mere
 * construction.
 */
interface CommerceMediaObjectMetadataLike {
  readonly key: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly storedAt: number;
}
type CommerceMediaStorePutResultLike =
  | { readonly outcome: "stored" | "already-present"; readonly metadata: CommerceMediaObjectMetadataLike }
  | { readonly outcome: "conflict" | "oversized" | "unsupported-content-type" | "failed" };
/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Coordinator
 * validation-gate fix) -- the structural mirror of `IpfsMediaStore`'s own
 * new `IpfsMediaStoreProtectedPutResult` (`src/os/commerce/catalog/ipfs_media_store.ts`):
 * every `MediaStorePutResult` outcome PLUS the protected-put-only
 * `"encryption-unavailable"`, which names "nothing was stored because the
 * content could not be encrypted" -- previously indistinguishable from a
 * storage failure, and the exact reason a live, 100%-reproducible
 * encryption outage surfaced to a seller as an unactionable
 * "protected content storage failed: failed".
 */
type CommerceMediaStoreProtectedPutResultLike =
  | CommerceMediaStorePutResultLike
  | { readonly outcome: "encryption-unavailable" };
interface CommerceMediaStoreLike {
  put(request: { readonly bytes: Uint8Array; readonly contentType: string }): CommerceMediaStorePutResultLike;
  putPublic(plaintext: Uint8Array, contentType: string): CommerceMediaStorePutResultLike;
  putProtected(plaintext: Uint8Array, contentType: string): Promise<CommerceMediaStoreProtectedPutResultLike>;
  get(key: string): { readonly metadata: CommerceMediaObjectMetadataLike; readonly bytes: Uint8Array } | null;
  getProtected(key: string): Promise<Uint8Array | null>;
  /**
   * Real Digital Delivery mega-arc (Agent G, Grant Custody pass) — the
   * SYNC, non-network-gated metadata-only lookup
   * `buildOutboundPrivateMediaReleaseResponse()`'s own
   * `getStoredCiphertextChecksum` callback needs (unlike `get()` above,
   * which re-fetches full bytes through the network-gated transport and is
   * therefore the wrong primitive for a cheap checksum re-check).
   */
  metadata(key: string): CommerceMediaObjectMetadataLike | null;
  readonly [key: string]: unknown;
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- structural mirrors
 * of `os/commerce/events/`'s real shapes.
 */
interface CommerceNostrTransportLike {
  send(draft: unknown): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }>;
}
interface CommerceNostrEventPortLike {
  publish(draft: unknown): Promise<{ readonly outcome: string; readonly reason: string; readonly eventId?: string }>;
}
interface CommerceNostrReadModelLike {
  ingest(envelope: unknown): { readonly outcome: string; readonly reason: string; readonly productId?: string };
  getProduct(productId: string): unknown;
  /** FedOS Commerce FINAL Closure Mega-Arc (Agent N, discovery wiring pass) -- structural mirror of `CommerceNostrProductReadModel.listProducts()`, used to merge Nostr-discovered products into `fedos-app:commerce-catalog-list`'s response. */
  listProducts(): readonly CommerceReadModelProductViewLike[];
  /** Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) — a buyer's ONLY source of truth for a Product's protected-content declaration; the seller's own process instead uses its authoritative local `commerceProductMediaState()`. */
  listProductMedia(productId: string): readonly CommerceReadModelProductMediaViewLike[];
  isProductMediaRetracted(mediaId: string): boolean;
}
interface CommerceReadModelProductMediaViewLike {
  readonly mediaId: string;
  readonly productId: string;
  readonly sellerPubkey: string;
  readonly role: string;
  readonly classification: "public" | "protected";
  readonly contentType: string;
  readonly sizeClass: string;
  readonly checksum: string;
  readonly checksumSubject: "plaintext" | "ciphertext";
  readonly altText?: string;
  readonly version: number;
  readonly declaredAt: number;
  readonly retracted: boolean;
}

/** Structural mirror of `CommerceReadModelProductView` (`os/commerce/events/commerce_nostr_event_read_model.ts`) -- same discipline as every other `*Like` interface in this file: never `import type`s the real shape, re-declares it structurally once. */
interface CommerceReadModelProductViewLike {
  readonly productId: string;
  readonly creatorPubkeyHex: string;
  readonly productKind: string;
  readonly title: string;
  readonly description?: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly status: string;
}

async function loadRootModules(): Promise<RootModules> {
  const attestation = (await import(distUrl("os", "messenger", "desktop", "production_activation", "fedos_production_desktop_host_attestation.js"))) as {
    createElectronMainHostAttestation: RootModules["createElectronMainHostAttestation"];
  };
  const activation = (await import(distUrl("os", "messenger", "desktop", "production_activation", "fedos_production_profile_activation.js"))) as {
    activateFedosProductionProfileMasterSeed: RootModules["activateFedosProductionProfileMasterSeed"];
  };
  const artifactVerify = (await import(distUrl("os", "messenger", "desktop", "production_activation", "fedos_production_wasm_artifact_verify_before_execute.js"))) as {
    fedosResolveProductionArtifactDir: RootModules["fedosResolveProductionArtifactDir"];
    fedosExpectedProductionWasmCrate: RootModules["fedosExpectedProductionWasmCrate"];
  };
  const signer = (await import(distUrl("os", "messenger", "desktop", "production_activation", "fedos_production_nostr_signing_authority.js"))) as {
    FedosProductionNostrSigningAuthority: RootModules["NostrSigningAuthority"];
  };
  const paths = (await import(distUrl("os", "messenger", "desktop", "onboarding", "fedos_local_profile_paths.js"))) as {
    planFedosLocalProfilePaths: RootModules["planFedosLocalProfilePaths"];
    ensureFedosLocalProfileDirectories: RootModules["ensureFedosLocalProfileDirectories"];
  };
  const profilePersistence = (await import(distUrl("os", "messenger", "desktop", "onboarding", "fedos_local_profile_persistence.js"))) as {
    FileFedosLocalProfilePersistence: RootModules["ProfilePersistence"];
  };
  const sealedPersistence = (await import(distUrl("runtime", "master_seed", "fedos_sealed_master_seed_envelope_persistence.js"))) as {
    FileFedosSealedMasterSeedEnvelopePersistence: RootModules["SealedSeedPersistence"];
  };
  const coordinator = (await import(distUrl("os", "messenger", "desktop", "onboarding", "fedos_profile_initialization_coordinator.js"))) as {
    FedosProfileInitializationCoordinator: RootModules["Coordinator"];
  };
  const secret = (await import(distUrl("os", "messenger", "desktop", "onboarding", "fedos_profile_unlock_secret.js"))) as {
    FedosProfileUnlockSecret: RootModules["UnlockSecret"];
  };
  const settingsController = (await import(distUrl("os", "messenger", "desktop", "settings", "fedos_desktop_settings_controller.js"))) as {
    createFileBackedFedosDesktopSettingsController: RootModules["createFileBackedSettingsController"];
  };
  const assembly = (await import(distUrl("os", "messenger", "desktop", "beta", "fedos_desktop_beta_application_assembly.js"))) as {
    FedosDesktopBetaApplicationAssembly: RootModules["BetaApplicationAssembly"];
  };
  // NOT migrated with its siblings above: this one file has an unrelated,
  // uncommitted, in-progress edit from a different arc on this branch and was
  // deliberately left at its original path -- see the Messenger migration
  // Stage 6 commit message and fedos_desktop_beta_release_configuration.ts's
  // own note.
  const capabilityManifest = (await import(distUrl("desktop", "beta", "fedos_desktop_beta_capability_manifest.js"))) as {
    fedosDesktopBetaCapabilityManifestV1: RootModules["betaCapabilityManifestV1"];
  };
  const releaseConfiguration = (await import(distUrl("os", "messenger", "desktop", "beta", "fedos_desktop_beta_release_configuration.js"))) as {
    fedosDesktopBetaReleaseConfigurationV1: RootModules["betaReleaseConfigurationV1"];
  };
  const limitations = (await import(distUrl("os", "messenger", "desktop", "beta", "fedos_desktop_beta_limitations.js"))) as {
    fedosDesktopBetaLimitationsV1: RootModules["betaLimitationsV1"];
  };
  const deviceSyncEventBridgeModule = (await import(distUrl("device", "sync_events", "fedos_device_sync_event_bridge.js"))) as {
    FedosDeviceSyncEventBridge: RootModules["DeviceSyncEventBridge"];
  };
  const websocketRelay = (await import(distUrl("os", "messenger", "desktop", "websocket_relay.js"))) as {
    WebSocketRelay: RootModules["WebSocketRelay"];
  };
  const websocketRelaySocketFactory = (await import(distUrl("os", "messenger", "desktop", "node_websocket_relay_socket_factory.js"))) as {
    createNodeWebSocketRelaySocketFactory: RootModules["createNodeWebSocketRelaySocketFactory"];
  };
  const trayTypes = (await import(distUrl("os", "messenger", "desktop", "tray", "fedos_desktop_tray_types.js"))) as {
    fedosDesktopTrayMenuItems: RootModules["fedosDesktopTrayMenuItems"];
  };
  // Commerce Reachable Catalog + Product Surface Phase 1 -- first-ever
  // production caller of `createCommerce()`'s barrel (`src/os/commerce/index.ts`,
  // newly added to `tsconfig.beta-runtime.json`'s include list this arc).
  // Commerce E2E Completion arc (coordinator integration gate) widens the
  // set of names taken from the SAME already-whitelisted barrel -- no new
  // tsconfig entry needed, `os/commerce/index.js` was already the include.
  const commerce = (await import(distUrl("os", "commerce", "index.js"))) as {
    listViewableProducts: RootModules["Commerce"]["listViewableProducts"];
    LocalProductRepository: RootModules["Commerce"]["LocalProductRepository"];
    DurableProductRepository: RootModules["Commerce"]["DurableProductRepository"];
    LocalOrderRepository: RootModules["Commerce"]["LocalOrderRepository"];
    DurableOrderRepository: RootModules["Commerce"]["DurableOrderRepository"];
    createOrder: RootModules["Commerce"]["createOrder"];
    applyOrderAction: RootModules["Commerce"]["applyOrderAction"];
    DeterministicLocalPaymentProvider: RootModules["Commerce"]["DeterministicLocalPaymentProvider"];
    TEST_SIMULATOR_NAME: RootModules["Commerce"]["TEST_SIMULATOR_NAME"];
    PaymentSettlementLedger: RootModules["Commerce"]["PaymentSettlementLedger"];
    DurablePaymentSettlementLedger: RootModules["Commerce"]["DurablePaymentSettlementLedger"];
    LocalDeliveryRepository: RootModules["Commerce"]["LocalDeliveryRepository"];
    DurableDeliveryRepository: RootModules["Commerce"]["DurableDeliveryRepository"];
    createDelivery: RootModules["Commerce"]["createDelivery"];
    applyDeliveryAction: RootModules["Commerce"]["applyDeliveryAction"];
    issueSignedTradeReceiptProof: RootModules["Commerce"]["issueSignedTradeReceiptProof"];
    verifySignedTradeReceiptProof: RootModules["Commerce"]["verifySignedTradeReceiptProof"];
    // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Coordinator,
    // post-security-review BUILD gate fix) -- Agent A's 6 new Commerce
    // exports were correctly added to `RootModules["Commerce"]` (below)
    // and to the canonical barrel (`src/os/commerce/index.ts`), but this
    // separate, hand-maintained `as {...}` import-projection literal was
    // never updated to match -- so every downstream `commerce.xxx` access
    // failed to typecheck even though the runtime value was always
    // present. Same category of staleness this comment block's own
    // sibling entries already guard against; fixed the same way, no
    // architecture change.
    issueSignedDeliveryReceiptProof: RootModules["Commerce"]["issueSignedDeliveryReceiptProof"];
    verifySignedDeliveryReceiptProof: RootModules["Commerce"]["verifySignedDeliveryReceiptProof"];
    evaluateInboundMediaReleaseRequestAuthorization: RootModules["Commerce"]["evaluateInboundMediaReleaseRequestAuthorization"];
    evaluateInboundMediaReleaseResponseAuthorization: RootModules["Commerce"]["evaluateInboundMediaReleaseResponseAuthorization"];
    evaluateDigitalContentDeliveryInvariantForOrderCompletion: RootModules["Commerce"]["evaluateDigitalContentDeliveryInvariantForOrderCompletion"];
    DurableMediaReleaseContentCache: RootModules["Commerce"]["DurableMediaReleaseContentCache"];
    DurableMediaReleaseIssuanceLog: RootModules["Commerce"]["DurableMediaReleaseIssuanceLog"];
    encodeCommerceReceiptProofToQrText: RootModules["Commerce"]["encodeCommerceReceiptProofToQrText"];
    decodeCommerceReceiptProofFromQrText: RootModules["Commerce"]["decodeCommerceReceiptProofFromQrText"];
    issueSignedProductShareProof: RootModules["Commerce"]["issueSignedProductShareProof"];
    verifySelfAssertedProductShareProof: RootModules["Commerce"]["verifySelfAssertedProductShareProof"];
    encodeCommerceShareProofToQrText: RootModules["Commerce"]["encodeCommerceShareProofToQrText"];
    decodeCommerceShareProofFromQrText: RootModules["Commerce"]["decodeCommerceShareProofFromQrText"];
    DurableReceiptStore: RootModules["Commerce"]["DurableReceiptStore"];
    LocalProductMediaRepository: RootModules["Commerce"]["LocalProductMediaRepository"];
    DurableProductMediaRepository: RootModules["Commerce"]["DurableProductMediaRepository"];
    generateFedosProductMediaId: RootModules["Commerce"]["generateFedosProductMediaId"];
    isQualifyingOrderStatusForMediaAccess: RootModules["Commerce"]["isQualifyingOrderStatusForMediaAccess"];
    issueMediaAccessGrantsForOrder: RootModules["Commerce"]["issueMediaAccessGrantsForOrder"];
    AppendOnlyMediaAccessGrantPersistence: RootModules["Commerce"]["AppendOnlyMediaAccessGrantPersistence"];
    latestGrantVersion: RootModules["Commerce"]["latestGrantVersion"];
    evaluateMediaAccessGrant: RootModules["Commerce"]["evaluateMediaAccessGrant"];
    wrapMediaAccessGrantRelease: RootModules["Commerce"]["wrapMediaAccessGrantRelease"];
    resolveCommerceMediaGrantSigningKeypair: RootModules["Commerce"]["resolveCommerceMediaGrantSigningKeypair"];
    computeCommerceBuyerActivitySummary: RootModules["Commerce"]["computeCommerceBuyerActivitySummary"];
    computeCommerceSellerActivitySummary: RootModules["Commerce"]["computeCommerceSellerActivitySummary"];
  };
  // Commerce E2E Completion arc (coordinator) -- the ONE os/trust surface
  // this main process touches: a signing keypair generator and a
  // single-issuer verification policy, both required by the commerce
  // receipt adapter's own `CommerceReceiptSigningKeys`/verify contract.
  const trust = (await import(distUrl("os", "trust", "index.js"))) as {
    FedosTrustSigningKeypair: RootModules["Trust"]["FedosTrustSigningKeypair"];
    createSingleIssuerFedosTrustPolicy: RootModules["Trust"]["createSingleIssuerFedosTrustPolicy"];
    DurableSealedSigningKeyStore: RootModules["Trust"]["DurableSealedSigningKeyStore"];
    resolveReceiptIssuerSigningKeypair: RootModules["Trust"]["resolveReceiptIssuerSigningKeypair"];
    renderFedosTrustQrTextToPngDataUrl: RootModules["Trust"]["renderFedosTrustQrTextToPngDataUrl"];
  };
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent R's own
  // scoped reputation barrel (`os/commerce/reputation/index.js`), loaded
  // exactly like `Commerce`/`Trust` above.
  const reputation = (await import(distUrl("os", "commerce", "reputation", "index.js"))) as {
    LocalPersonaEpochRegistry: RootModules["Reputation"]["LocalPersonaEpochRegistry"];
    DurablePersonaEpochRegistry: RootModules["Reputation"]["DurablePersonaEpochRegistry"];
    LocalTradeCompletionAttestationStore: RootModules["Reputation"]["LocalTradeCompletionAttestationStore"];
    DurableTradeCompletionAttestationStore: RootModules["Reputation"]["DurableTradeCompletionAttestationStore"];
    createPersonaEpoch: RootModules["Reputation"]["createPersonaEpoch"];
    issueTradeCompletionAttestation: RootModules["Reputation"]["issueTradeCompletionAttestation"];
    queryPersonaBoardView: RootModules["Reputation"]["queryPersonaBoardView"];
    generatePersonaEpochId: RootModules["Reputation"]["generatePersonaEpochId"];
    DurableSealedSigningKeyStore: RootModules["Reputation"]["DurableSealedSigningKeyStore"];
    resolvePersonaEpochSigningKeypair: RootModules["Reputation"]["resolvePersonaEpochSigningKeypair"];
  };
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent M's real
  // media adapters, now barreled from `os/commerce/index.js` (the SAME
  // already-whitelisted `Commerce` barrel loaded above) -- no new tsconfig
  // entry needed for these three.
  const commerceMedia = (await import(distUrl("os", "commerce", "index.js"))) as {
    IpfsMediaStore: RootModules["Media"]["IpfsMediaStore"];
    InMemoryIpfsTransport: RootModules["Media"]["InMemoryIpfsTransport"];
    WasmProductMediaEncryption: RootModules["Media"]["WasmProductMediaEncryption"];
    WasmProductMediaDecryption: RootModules["Media"]["WasmProductMediaDecryption"];
    DurableIpfsTransport: RootModules["Media"]["DurableIpfsTransport"];
    DurableIpfsMediaStoreIndex: RootModules["Media"]["DurableIpfsMediaStoreIndex"];
  };
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's
  // outbound Port + real Nostr adapter transport (two explicit
  // `tsconfig.beta-runtime.json` entries) and the inbound read-model + real
  // verifying bridge (two more) -- see `RootModules["CommerceNostr"]`'s own
  // doc comment for why these are not part of the public `os/commerce`
  // barrel.
  const commerceNostrOutbound = (await import(distUrl("os", "commerce", "events", "commerce_nostr_event_port.js"))) as {
    CommerceNostrEventPortImpl: RootModules["CommerceNostr"]["CommerceNostrEventPortImpl"];
  };
  const commerceNostrTransportBridge = (await import(
    distUrl("os", "commerce", "catalog", "adapters", "nostr", "commerce_event_bridge.js")
  )) as {
    RealCommerceNostrEventTransport: RootModules["CommerceNostr"]["RealCommerceNostrEventTransport"];
  };
  const commerceNostrReadModel = (await import(distUrl("os", "commerce", "events", "commerce_nostr_event_read_model.js"))) as {
    CommerceNostrProductReadModel: RootModules["CommerceNostr"]["CommerceNostrProductReadModel"];
  };
  const commerceNostrInboundBridge = (await import(
    distUrl("os", "commerce", "catalog", "adapters", "nostr", "commerce_inbound_event_bridge.js")
  )) as {
    verifyAndBuildInboundCommerceNostrEnvelope: RootModules["CommerceNostr"]["verifyAndBuildInboundCommerceNostrEnvelope"];
  };
  const commerceNostrRelayPublisher = (await import(distUrl("os", "messenger", "adapters", "nostr", "protocol", "publish.js"))) as {
    WebSocketRelayPublisher: RootModules["CommerceNostr"]["WebSocketRelayPublisher"];
  };
  // FedOS Commerce FINAL Closure Mega-Arc (Agent N, discovery wiring pass)
  // -- the read-only counterpart, closing the "no SUBSCRIBE/inbound path"
  // gap. New `tsconfig.beta-runtime.json` entry (`ws_relay.ts`).
  const commerceNostrRelaySubscriber = (await import(distUrl("os", "messenger", "adapters", "nostr", "protocol", "ws_relay.js"))) as {
    WebSocketRelayAdapter: RootModules["CommerceNostr"]["WebSocketRelayAdapter"];
  };
  // FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
  // Coordinator-directed pass) -- private Order/status transport (arc
  // items #4/#5). Two new `tsconfig.beta-runtime.json` entries.
  const commercePrivateOrderBridge = (await import(
    distUrl("os", "commerce", "catalog", "adapters", "nostr", "commerce_private_order_bridge.js")
  )) as {
    RealCommercePrivateOrderTransport: RootModules["CommerceNostr"]["RealCommercePrivateOrderTransport"];
    verifyAndDecryptInboundPrivateOrderEnvelope: RootModules["CommerceNostr"]["verifyAndDecryptInboundPrivateOrderEnvelope"];
    COMMERCE_PRIVATE_ORDER_SYNC_TAG: string;
  };
  const commercePrivateOrderSyncShapes = (await import(distUrl("os", "commerce", "events", "commerce_private_order_sync.js"))) as {
    PRIVATE_ORDER_SYNC_STATUS_ACTION: RootModules["CommerceNostr"]["PRIVATE_ORDER_SYNC_STATUS_ACTION"];
  };
  // Completion-lag fix round -- the pure Order-side reconciliation, split
  // out of `applyInboundPrivateOrderSyncNonFatal()` so the "not yet vs.
  // never" decision is a real, unit-testable value instead of an
  // indistinguishable bare `return`.
  const commercePrivateOrderApply = (await import(distUrl("os", "commerce", "events", "commerce_private_order_apply.js"))) as {
    applyInboundPrivateOrderSyncPayload: RootModules["CommerceNostr"]["applyInboundPrivateOrderSyncPayload"];
  };
  // FedOS Commerce Purchase Completion mega-arc (Agent D) -- private
  // Delivery/status transport (arc "Cross-process delivery" requirement).
  // Two new `tsconfig.beta-runtime.json` entries, mirroring the private
  // Order transport's own two exactly, plus the pure reconciliation
  // function's own module.
  const commercePrivateDeliveryBridge = (await import(
    distUrl("os", "commerce", "catalog", "adapters", "nostr", "commerce_private_delivery_bridge.js")
  )) as {
    RealCommercePrivateDeliveryTransport: RootModules["CommerceNostr"]["RealCommercePrivateDeliveryTransport"];
    verifyAndDecryptInboundPrivateDeliveryEnvelope: RootModules["CommerceNostr"]["verifyAndDecryptInboundPrivateDeliveryEnvelope"];
    COMMERCE_PRIVATE_DELIVERY_SYNC_TAG: string;
  };
  const commercePrivateDeliveryApply = (await import(distUrl("os", "commerce", "events", "commerce_private_delivery_apply.js"))) as {
    applyInboundPrivateDeliverySyncPayload: RootModules["CommerceNostr"]["applyInboundPrivateDeliverySyncPayload"];
  };
  // FedOS Commerce Purchase Completion mega-arc (Agent P, wired by the
  // Coordinator's integration phase) -- private PaymentEvidence transport
  // + receiver-validation gate. Three new `tsconfig.beta-runtime.json`
  // entries, mirroring the Delivery pair immediately above.
  const commercePrivatePaymentEvidenceBridge = (await import(
    distUrl("os", "commerce", "catalog", "adapters", "nostr", "commerce_private_payment_evidence_bridge.js")
  )) as {
    RealPaymentEvidenceTransport: RootModules["CommerceNostr"]["RealPaymentEvidenceTransport"];
    verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope: RootModules["CommerceNostr"]["verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope"];
    COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG: string;
  };
  const commercePaymentEvidencePort = (await import(distUrl("os", "commerce", "payment", "payment_evidence_port.js"))) as {
    applyInboundPaymentEvidenceSync: RootModules["CommerceNostr"]["applyInboundPaymentEvidenceSync"];
  };
  // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- the
  // FOURTH private-sync channel: `MediaAccessGrant` release
  // request/response, mirroring the Delivery pair's own two-plus-apply
  // import shape exactly. Five new `tsconfig.beta-runtime.json` entries
  // (bridge, apply, sync, and the two `os/commerce` barrel additions
  // pulled in transitively through `commerce` above).
  const commercePrivateMediaReleaseBridge = (await import(
    distUrl("os", "commerce", "catalog", "adapters", "nostr", "commerce_private_media_release_bridge.js")
  )) as {
    RealCommercePrivateMediaReleaseRequestTransport: RootModules["CommerceNostr"]["RealCommercePrivateMediaReleaseRequestTransport"];
    verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope: RootModules["CommerceNostr"]["verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope"];
    COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG: string;
    RealCommercePrivateMediaReleaseTransport: RootModules["CommerceNostr"]["RealCommercePrivateMediaReleaseTransport"];
    verifyAndDecryptInboundPrivateMediaReleaseEnvelope: RootModules["CommerceNostr"]["verifyAndDecryptInboundPrivateMediaReleaseEnvelope"];
    COMMERCE_PRIVATE_MEDIA_RELEASE_TAG: string;
  };
  const commercePrivateMediaReleaseApply = (await import(distUrl("os", "commerce", "events", "commerce_private_media_release_apply.js"))) as {
    buildOutboundPrivateMediaReleaseResponse: RootModules["CommerceNostr"]["buildOutboundPrivateMediaReleaseResponse"];
    applyInboundPrivateMediaReleaseResponse: RootModules["CommerceNostr"]["applyInboundPrivateMediaReleaseResponse"];
  };
  // Real Digital Delivery mega-arc (Agent G, Grant Custody pass) -- closes
  // Blocker 5. See `commerce_media_grant_signing_key_delegation_bridge.ts`'s
  // own header for the full mechanism.
  const commerceMediaGrantDelegationBridge = (await import(
    distUrl("os", "commerce", "catalog", "adapters", "nostr", "commerce_media_grant_signing_key_delegation_bridge.js")
  )) as {
    signMediaGrantSigningKeyDelegation: RootModules["CommerceNostr"]["signMediaGrantSigningKeyDelegation"];
    verifyMediaGrantSigningKeyDelegationEvent: RootModules["CommerceNostr"]["verifyMediaGrantSigningKeyDelegationEvent"];
  };
  const productMediaSyncBridge = (await import(distUrl("os", "commerce", "catalog", "adapters", "nostr", "product_media_sync_bridge.js"))) as {
    NostrProductMediaSyncPort: RootModules["CommerceNostr"]["NostrProductMediaSyncPort"];
  };
  const productMediaDeclarationTypes = (await import(distUrl("os", "commerce", "catalog", "product_media_declaration_types.js"))) as {
    deriveProductMediaDeclaration: RootModules["CommerceNostr"]["deriveProductMediaDeclaration"];
    buildProductMediaRetraction: RootModules["CommerceNostr"]["buildProductMediaRetraction"];
  };
  return {
    createElectronMainHostAttestation: attestation.createElectronMainHostAttestation,
    activateFedosProductionProfileMasterSeed: activation.activateFedosProductionProfileMasterSeed,
    fedosResolveProductionArtifactDir: artifactVerify.fedosResolveProductionArtifactDir,
    fedosExpectedProductionWasmCrate: artifactVerify.fedosExpectedProductionWasmCrate,
    NostrSigningAuthority: signer.FedosProductionNostrSigningAuthority,
    planFedosLocalProfilePaths: paths.planFedosLocalProfilePaths,
    ensureFedosLocalProfileDirectories: paths.ensureFedosLocalProfileDirectories,
    ProfilePersistence: profilePersistence.FileFedosLocalProfilePersistence,
    SealedSeedPersistence: sealedPersistence.FileFedosSealedMasterSeedEnvelopePersistence,
    Coordinator: coordinator.FedosProfileInitializationCoordinator,
    UnlockSecret: secret.FedosProfileUnlockSecret,
    createFileBackedSettingsController: settingsController.createFileBackedFedosDesktopSettingsController,
    BetaApplicationAssembly: assembly.FedosDesktopBetaApplicationAssembly,
    betaCapabilityManifestV1: capabilityManifest.fedosDesktopBetaCapabilityManifestV1,
    betaReleaseConfigurationV1: releaseConfiguration.fedosDesktopBetaReleaseConfigurationV1,
    betaLimitationsV1: limitations.fedosDesktopBetaLimitationsV1,
    DeviceSyncEventBridge: deviceSyncEventBridgeModule.FedosDeviceSyncEventBridge,
    fedosDesktopTrayMenuItems: trayTypes.fedosDesktopTrayMenuItems,
    WebSocketRelay: websocketRelay.WebSocketRelay,
    createNodeWebSocketRelaySocketFactory: websocketRelaySocketFactory.createNodeWebSocketRelaySocketFactory,
    Commerce: {
      listViewableProducts: commerce.listViewableProducts,
      LocalProductRepository: commerce.LocalProductRepository,
      DurableProductRepository: commerce.DurableProductRepository,
      LocalOrderRepository: commerce.LocalOrderRepository,
      DurableOrderRepository: commerce.DurableOrderRepository,
      createOrder: commerce.createOrder,
      applyOrderAction: commerce.applyOrderAction,
      DeterministicLocalPaymentProvider: commerce.DeterministicLocalPaymentProvider,
      TEST_SIMULATOR_NAME: commerce.TEST_SIMULATOR_NAME,
      PaymentSettlementLedger: commerce.PaymentSettlementLedger,
      DurablePaymentSettlementLedger: commerce.DurablePaymentSettlementLedger,
      LocalDeliveryRepository: commerce.LocalDeliveryRepository,
      DurableDeliveryRepository: commerce.DurableDeliveryRepository,
      createDelivery: commerce.createDelivery,
      applyDeliveryAction: commerce.applyDeliveryAction,
      issueSignedTradeReceiptProof: commerce.issueSignedTradeReceiptProof,
      verifySignedTradeReceiptProof: commerce.verifySignedTradeReceiptProof,
      issueSignedDeliveryReceiptProof: commerce.issueSignedDeliveryReceiptProof,
      verifySignedDeliveryReceiptProof: commerce.verifySignedDeliveryReceiptProof,
      encodeCommerceReceiptProofToQrText: commerce.encodeCommerceReceiptProofToQrText,
      decodeCommerceReceiptProofFromQrText: commerce.decodeCommerceReceiptProofFromQrText,
      issueSignedProductShareProof: commerce.issueSignedProductShareProof,
      verifySelfAssertedProductShareProof: commerce.verifySelfAssertedProductShareProof,
      encodeCommerceShareProofToQrText: commerce.encodeCommerceShareProofToQrText,
      decodeCommerceShareProofFromQrText: commerce.decodeCommerceShareProofFromQrText,
      DurableReceiptStore: commerce.DurableReceiptStore,
      LocalProductMediaRepository: commerce.LocalProductMediaRepository,
      DurableProductMediaRepository: commerce.DurableProductMediaRepository,
      generateFedosProductMediaId: commerce.generateFedosProductMediaId,
      isQualifyingOrderStatusForMediaAccess: commerce.isQualifyingOrderStatusForMediaAccess,
      issueMediaAccessGrantsForOrder: commerce.issueMediaAccessGrantsForOrder,
      AppendOnlyMediaAccessGrantPersistence: commerce.AppendOnlyMediaAccessGrantPersistence,
      latestGrantVersion: commerce.latestGrantVersion,
      evaluateMediaAccessGrant: commerce.evaluateMediaAccessGrant,
      wrapMediaAccessGrantRelease: commerce.wrapMediaAccessGrantRelease,
      resolveCommerceMediaGrantSigningKeypair: commerce.resolveCommerceMediaGrantSigningKeypair,
      evaluateInboundMediaReleaseRequestAuthorization: commerce.evaluateInboundMediaReleaseRequestAuthorization,
      evaluateInboundMediaReleaseResponseAuthorization: commerce.evaluateInboundMediaReleaseResponseAuthorization,
      evaluateDigitalContentDeliveryInvariantForOrderCompletion: commerce.evaluateDigitalContentDeliveryInvariantForOrderCompletion,
      DurableMediaReleaseContentCache: commerce.DurableMediaReleaseContentCache,
      DurableMediaReleaseIssuanceLog: commerce.DurableMediaReleaseIssuanceLog,
      computeCommerceBuyerActivitySummary: commerce.computeCommerceBuyerActivitySummary,
      computeCommerceSellerActivitySummary: commerce.computeCommerceSellerActivitySummary,
    },
    Trust: {
      FedosTrustSigningKeypair: trust.FedosTrustSigningKeypair,
      createSingleIssuerFedosTrustPolicy: trust.createSingleIssuerFedosTrustPolicy,
      DurableSealedSigningKeyStore: trust.DurableSealedSigningKeyStore,
      resolveReceiptIssuerSigningKeypair: trust.resolveReceiptIssuerSigningKeypair,
      renderFedosTrustQrTextToPngDataUrl: trust.renderFedosTrustQrTextToPngDataUrl,
    },
    Reputation: {
      LocalPersonaEpochRegistry: reputation.LocalPersonaEpochRegistry,
      DurablePersonaEpochRegistry: reputation.DurablePersonaEpochRegistry,
      LocalTradeCompletionAttestationStore: reputation.LocalTradeCompletionAttestationStore,
      DurableTradeCompletionAttestationStore: reputation.DurableTradeCompletionAttestationStore,
      createPersonaEpoch: reputation.createPersonaEpoch,
      issueTradeCompletionAttestation: reputation.issueTradeCompletionAttestation,
      queryPersonaBoardView: reputation.queryPersonaBoardView,
      generatePersonaEpochId: reputation.generatePersonaEpochId,
      DurableSealedSigningKeyStore: reputation.DurableSealedSigningKeyStore,
      resolvePersonaEpochSigningKeypair: reputation.resolvePersonaEpochSigningKeypair,
    },
    Media: {
      IpfsMediaStore: commerceMedia.IpfsMediaStore,
      InMemoryIpfsTransport: commerceMedia.InMemoryIpfsTransport,
      WasmProductMediaEncryption: commerceMedia.WasmProductMediaEncryption,
      WasmProductMediaDecryption: commerceMedia.WasmProductMediaDecryption,
      DurableIpfsTransport: commerceMedia.DurableIpfsTransport,
      DurableIpfsMediaStoreIndex: commerceMedia.DurableIpfsMediaStoreIndex,
    },
    CommerceNostr: {
      CommerceNostrEventPortImpl: commerceNostrOutbound.CommerceNostrEventPortImpl,
      RealCommerceNostrEventTransport: commerceNostrTransportBridge.RealCommerceNostrEventTransport,
      CommerceNostrProductReadModel: commerceNostrReadModel.CommerceNostrProductReadModel,
      verifyAndBuildInboundCommerceNostrEnvelope: commerceNostrInboundBridge.verifyAndBuildInboundCommerceNostrEnvelope,
      WebSocketRelayPublisher: commerceNostrRelayPublisher.WebSocketRelayPublisher,
      WebSocketRelayAdapter: commerceNostrRelaySubscriber.WebSocketRelayAdapter,
      RealCommercePrivateOrderTransport: commercePrivateOrderBridge.RealCommercePrivateOrderTransport,
      verifyAndDecryptInboundPrivateOrderEnvelope: commercePrivateOrderBridge.verifyAndDecryptInboundPrivateOrderEnvelope,
      COMMERCE_PRIVATE_ORDER_SYNC_TAG: commercePrivateOrderBridge.COMMERCE_PRIVATE_ORDER_SYNC_TAG,
      PRIVATE_ORDER_SYNC_STATUS_ACTION: commercePrivateOrderSyncShapes.PRIVATE_ORDER_SYNC_STATUS_ACTION,
      applyInboundPrivateOrderSyncPayload: commercePrivateOrderApply.applyInboundPrivateOrderSyncPayload,
      RealCommercePrivateDeliveryTransport: commercePrivateDeliveryBridge.RealCommercePrivateDeliveryTransport,
      verifyAndDecryptInboundPrivateDeliveryEnvelope: commercePrivateDeliveryBridge.verifyAndDecryptInboundPrivateDeliveryEnvelope,
      COMMERCE_PRIVATE_DELIVERY_SYNC_TAG: commercePrivateDeliveryBridge.COMMERCE_PRIVATE_DELIVERY_SYNC_TAG,
      applyInboundPrivateDeliverySyncPayload: commercePrivateDeliveryApply.applyInboundPrivateDeliverySyncPayload,
      RealPaymentEvidenceTransport: commercePrivatePaymentEvidenceBridge.RealPaymentEvidenceTransport,
      verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope:
        commercePrivatePaymentEvidenceBridge.verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope,
      COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG: commercePrivatePaymentEvidenceBridge.COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG,
      applyInboundPaymentEvidenceSync: commercePaymentEvidencePort.applyInboundPaymentEvidenceSync,
      RealCommercePrivateMediaReleaseRequestTransport: commercePrivateMediaReleaseBridge.RealCommercePrivateMediaReleaseRequestTransport,
      verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope: commercePrivateMediaReleaseBridge.verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope,
      COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG: commercePrivateMediaReleaseBridge.COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG,
      RealCommercePrivateMediaReleaseTransport: commercePrivateMediaReleaseBridge.RealCommercePrivateMediaReleaseTransport,
      verifyAndDecryptInboundPrivateMediaReleaseEnvelope: commercePrivateMediaReleaseBridge.verifyAndDecryptInboundPrivateMediaReleaseEnvelope,
      COMMERCE_PRIVATE_MEDIA_RELEASE_TAG: commercePrivateMediaReleaseBridge.COMMERCE_PRIVATE_MEDIA_RELEASE_TAG,
      buildOutboundPrivateMediaReleaseResponse: commercePrivateMediaReleaseApply.buildOutboundPrivateMediaReleaseResponse,
      applyInboundPrivateMediaReleaseResponse: commercePrivateMediaReleaseApply.applyInboundPrivateMediaReleaseResponse,
      NostrProductMediaSyncPort: productMediaSyncBridge.NostrProductMediaSyncPort,
      deriveProductMediaDeclaration: productMediaDeclarationTypes.deriveProductMediaDeclaration,
      buildProductMediaRetraction: productMediaDeclarationTypes.buildProductMediaRetraction,
      signMediaGrantSigningKeyDelegation: commerceMediaGrantDelegationBridge.signMediaGrantSigningKeyDelegation,
      verifyMediaGrantSigningKeyDelegationEvent: commerceMediaGrantDelegationBridge.verifyMediaGrantSigningKeyDelegationEvent,
    },
  };
}

// ---------------------------------------------------------------------
// Ownership state — mirrors fedos_electron_unlock_main.cts /
// fedos_electron_badge_main.cts exactly. Exactly ONE of each real
// Electron-side adapter for the lifetime of this process.
// ---------------------------------------------------------------------

let modules: RootModules | null = null;
let mainWindow: BrowserWindow | null = null;
let activeCoordinator: CoordinatorLike | null = null;
let activeAssembly: AssemblyLike | null = null;
/** Secure Runtime Alpha 8041-8120 — the local viewer's own participant reference, set once alongside `activeAssembly` on a successful create/unlock (SAME value `startAssembly()` already derives for `viewerParticipant` below), never re-derived elsewhere. Required by `sendMessage()`/`issuedInvitations()`, which take the LOCAL sender/issuer explicitly rather than reading it from a session. */
let activeViewerParticipant: ParticipantRefLike | null = null;
/** Secure Runtime Alpha 8121-8200 — the real, currently-configured Relay instances this Runtime's own Coordinator constructed (`secureRuntimeBundleConfig()`, unmodified), kept here ONLY so the ordinary UI can honestly report per-Relay connectivity (Phase K "show offline/retry state") — never a second Relay set, never a new connection, just a read-only reference to what already exists. Empty until a real relay is configured and a profile is unlocked. */
let activeRelays: readonly RelayLike[] = [];
/** Verified Secure Session UI mega-arc (Coordinator) -- see `secureRuntimeBundleConfig()`'s own comment for where this is set. */
let activeMessageDeliveryRemoteDeviceRef: string | null = null;
/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator, central integration
 * pass) -- the SAME real, process-lifetime `FedosMasterSeedAuthority`
 * instance `buildFreshCoordinator()` already constructs and hands to this
 * Coordinator's own Runtime, retained here (set/cleared alongside
 * `activeCoordinator` at the exact same points) so `commerceMediaStoreFor()`
 * below can inject it into `WasmProductMediaEncryption`/
 * `WasmProductMediaDecryption` -- never a second, separately-generated,
 * unauthenticated Master Seed Authority instance for Commerce media.
 */
let activeMasterSeedAuthority: MasterSeedAuthorityLike | null = null;
/** FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- the SAME real Nostr signing authority `buildFreshCoordinator()` already constructs (see `NostrSigningAuthorityLike`'s own doc comment), retained for `commerceNostrOutboundPortFor()` below. */
let activeNostrSigningAuthority: NostrSigningAuthorityLike | null = null;
/**
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
 * seller-display-name P1 fix ("Unknown merchant" on a seller's OWN real
 * listing, `docs/commerce/COMMERCE-PURCHASE-COMPLETION-FINAL-REPORT.md`'s
 * own UX-P1 list). The real, durable per-profile label a user already
 * typed at profile creation (`displayLabel`, e.g. "Bob's Digital Shop") IS
 * the seller display-name field this arc's brief asks for -- it just was
 * never consulted by `commerceMerchantLabelFor()` below, which only ever
 * checked the static 2-entry demo-merchant map. Set/cleared at the SAME
 * points `activeViewerParticipant` already is (`handleCreate()`/
 * `handleUnlock()`/`handleLock()`/`performCleanShutdown()`), never a
 * second, independently-derived identity source.
 */
let activeLocalIdentity: { readonly displayLabel: string; readonly accountPublicIdentifier: string } | null = null;
const notificationAdapter = new FedosElectronNotificationAdapter();
const trayAdapter = new FedosElectronTrayAdapter();
let badgeAdapter: FedosElectronBadgeAdapter | null = null;
// Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) —
// single command-registration seam replacing the old global `inFlight`
// boolean everywhere; see fedos_electron_ipc_command_registry.ts for the
// full audit/design rationale and this file's own per-channel table below.
const ipcCommands = new FedosIpcCommandRegistry();
let shutdownInitiated = false;
let trayCreated = false;

// ---------------------------------------------------------------------
// Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
// Closure arc (coordinator) — Commerce state now DURABLY persisted, one
// append-only NDJSON log per repository under `commerceDurableFilePath()`
// (`<dataDir()>/commerce/*.ndjson`), replacing the Commerce E2E Completion
// arc's original in-memory-only `Local*` constructors with their `Durable*`
// siblings — same Ports, zero behavior change to any caller of
// `commerceState()`/`commerceReputationState()`. Still lazily constructed
// on first use so Commerce stays reachable even before a profile exists
// (unchanged Phase 1 property), never gated on
// `requireBoundary()`/`requireShell()` — the durable log file itself is
// process/profile-scoped, not identity-scoped, so this remains safe.
// ---------------------------------------------------------------------
let commerceProductRepo: CommerceProductRepositoryLike | null = null;
let commerceOrderRepo: CommerceOrderRepositoryLike | null = null;
let commercePaymentProvider: CommerceLocalPaymentProviderLike | null = null;
let commercePaymentLedger: CommercePaymentLedgerLike | null = null;
let commerceDeliveryRepo: CommerceDeliveryRepositoryLike | null = null;
let commerceReceiptKeypair: { readonly publicKeyHex: string } | null = null;
let commerceReceiptPolicy: unknown = null;
/**
 * FedOS Commerce FINAL P1 Closure (Agent K2) -- set (once, permanently) the
 * first time `commerceReceiptSigningState()` observes a `"corrupted"`
 * resolution (tampered sealed record / wrong Master Seed binding / a
 * freshly-minted key that failed to seal). Once set, EVERY subsequent call
 * in this process keeps returning the SAME corrupted outcome -- this
 * process never silently retries into a fresh, discontinuous replacement
 * identity.
 */
let commerceReceiptSigningCorruptedReason: string | null = null;
const COMMERCE_RECEIPT_ISSUER_ID = "fedos-commerce-e2e-demo-merchant";
/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- durable receipt-envelope store (friction-ledger row #5),
 * product-media repository (row #17), and MediaAccessGrant persistence
 * (row #15). Same lazy-construction-on-first-use discipline as every
 * other Commerce state above.
 */
let commerceReceiptStore: CommerceReceiptStoreLike | null = null;
let commerceProductMediaRepo: CommerceProductMediaRepositoryLike | null = null;
let commerceMediaGrantPersistence: CommerceMediaAccessGrantPersistenceLike | null = null;
let commerceMediaGrantSigningKeyStore: unknown = null;
/** BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- buyer-side durable, restart-surviving cache for verified `MediaAccessGrant` releases. */
let commerceMediaReleaseContentCache: CommerceMediaReleaseContentCacheLike | null = null;
/** CROSS-PROCESS COMPLETION SYNC mega-arc (Coordinator) -- SELLER-side durable, restart-surviving record of genuinely-issued releases. See `durable_media_release_issuance_log.ts`'s own header. */
let commerceMediaReleaseIssuanceLog: CommerceMediaReleaseIssuanceLogLike | null = null;

function commerceReceiptState(): CommerceReceiptStoreLike {
  const m = requireModules();
  if (commerceReceiptStore === null) {
    fs.mkdirSync(path.dirname(commerceDurableFilePath("receipts")), { recursive: true });
    commerceReceiptStore = new m.Commerce.DurableReceiptStore(commerceDurableFilePath("receipts"));
  }
  return commerceReceiptStore;
}

/**
 * Real Digital Delivery mega-arc (Coordinator, positive-E2E root-cause fix)
 * -- was `new m.Commerce.LocalProductMediaRepository()`, a bare in-memory
 * `Map` with ZERO persistence: a seller's own product-media catalog
 * (including `storageRef`, the only key that locates real protected content
 * already durably stored on disk) was silently lost on every restart,
 * permanently and silently breaking `issueCommerceMediaAccessGrantsNonFatal()`
 * and the seller-side private-media-release response path for any product
 * whose content was attached in an earlier process launch -- confirmed live
 * via a real two-independent-Electron-process positive digital-delivery run
 * (`media_access_grants.ndjson` was never created after a real "Mark
 * Fulfilling" click in a fresh Bob process). `DurableProductMediaRepository`
 * (`durable_product_media_repository.ts`) is the SAME `ProductMediaRepositoryPort`,
 * append-only-NDJSON-backed like every other Commerce entity in this file --
 * see that file's own header for the full account of why re-deriving this
 * from the network was never viable (`storageRef` is deliberately never
 * published).
 */
function commerceProductMediaState(): CommerceProductMediaRepositoryLike {
  const m = requireModules();
  if (commerceProductMediaRepo === null) {
    fs.mkdirSync(path.dirname(commerceDurableFilePath("product_media")), { recursive: true });
    commerceProductMediaRepo = new m.Commerce.DurableProductMediaRepository(commerceDurableFilePath("product_media"));
  }
  return commerceProductMediaRepo;
}

function commerceMediaGrantState(): { readonly persistence: CommerceMediaAccessGrantPersistenceLike; readonly signingKeyStore: unknown } {
  const m = requireModules();
  if (commerceMediaGrantPersistence === null) {
    fs.mkdirSync(path.dirname(commerceDurableFilePath("media_access_grants")), { recursive: true });
    commerceMediaGrantPersistence = new m.Commerce.AppendOnlyMediaAccessGrantPersistence(commerceDurableFilePath("media_access_grants"));
  }
  if (commerceMediaGrantSigningKeyStore === null) {
    fs.mkdirSync(path.dirname(commerceDurableFilePath("media_grant_signing_keys")), { recursive: true });
    commerceMediaGrantSigningKeyStore = new m.Trust.DurableSealedSigningKeyStore(commerceDurableFilePath("media_grant_signing_keys"));
  }
  return { persistence: commerceMediaGrantPersistence, signingKeyStore: commerceMediaGrantSigningKeyStore };
}

/** BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- lazily constructs (once) the buyer-side durable release-content cache. Same lazy-construction-on-first-use discipline as every other Commerce state in this file. */
function commerceMediaReleaseContentCacheState(): CommerceMediaReleaseContentCacheLike {
  const m = requireModules();
  if (commerceMediaReleaseContentCache === null) {
    fs.mkdirSync(path.dirname(commerceDurableFilePath("media_release_content")), { recursive: true });
    commerceMediaReleaseContentCache = new m.Commerce.DurableMediaReleaseContentCache(commerceDurableFilePath("media_release_content"));
  }
  return commerceMediaReleaseContentCache;
}

/** CROSS-PROCESS COMPLETION SYNC mega-arc (Coordinator) -- lazily constructs (once) the seller-side durable release-issuance log. Same lazy-construction-on-first-use discipline as every other Commerce state in this file. Deliberately a SEPARATE file/durable log from `commerceMediaReleaseContentCacheState()` above -- see `durable_media_release_issuance_log.ts`'s own header for why. */
function commerceMediaReleaseIssuanceLogState(): CommerceMediaReleaseIssuanceLogLike {
  const m = requireModules();
  if (commerceMediaReleaseIssuanceLog === null) {
    fs.mkdirSync(path.dirname(commerceDurableFilePath("media_release_issuance")), { recursive: true });
    commerceMediaReleaseIssuanceLog = new m.Commerce.DurableMediaReleaseIssuanceLog(commerceDurableFilePath("media_release_issuance"));
  }
  return commerceMediaReleaseIssuanceLog;
}

/**
 * Lazily constructs (once) and returns the process's Commerce state,
 * seeding `commerceProductRepo` with the EXACT Phase 1 demo products
 * (same ids/status — `DurableProductRepository`'s `initialProducts` seeds
 * by `.id` directly, never through `create()`, and only for an id not
 * already present in the durable log, so a restart never re-seeds over a
 * real merchant edit) so existing Phase 1 catalog behavior is unchanged,
 * while making the catalog now backed by a real, mutable, DURABLE
 * repository a Merchant can create/edit/publish/unpublish against and
 * have survive a restart. `commercePaymentProvider` is the LOUDLY-labeled
 * TEST/LOCAL simulator (`acknowledgeTestOnly: true`) — never a real
 * payment rail; see `RootModules.Commerce`'s own header. Every repository
 * below is now the `Durable*` sibling of its Commerce E2E Completion arc
 * original (Commerce Durability arc, coordinator) — same Port, same
 * caller-visible behavior, backed by an append-only NDJSON log file under
 * `commerceDurableFilePath()`.
 */
function commerceState(): {
  readonly products: CommerceProductRepositoryLike;
  readonly orders: CommerceOrderRepositoryLike;
  readonly payments: CommerceLocalPaymentProviderLike;
  readonly ledger: CommercePaymentLedgerLike;
  readonly deliveries: CommerceDeliveryRepositoryLike;
} {
  const m = requireModules();
  fs.mkdirSync(path.dirname(commerceDurableFilePath("products")), { recursive: true });
  if (commerceProductRepo === null) {
    commerceProductRepo = new m.Commerce.DurableProductRepository(
      commerceDurableFilePath("products"),
      undefined,
      FEDOS_COMMERCE_DEMO_PRODUCTS as unknown as CommerceProductLike[],
    );
  }
  if (commerceOrderRepo === null) {
    commerceOrderRepo = new m.Commerce.DurableOrderRepository(commerceDurableFilePath("orders"));
  }
  if (commercePaymentProvider === null) {
    commercePaymentProvider = new m.Commerce.DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
  }
  if (commercePaymentLedger === null) {
    commercePaymentLedger = new m.Commerce.DurablePaymentSettlementLedger(commerceDurableFilePath("payment_settlements"));
  }
  if (commerceDeliveryRepo === null) {
    commerceDeliveryRepo = new m.Commerce.DurableDeliveryRepository(commerceDurableFilePath("deliveries"));
  }
  return {
    products: commerceProductRepo,
    orders: commerceOrderRepo,
    payments: commercePaymentProvider,
    ledger: commercePaymentLedger,
    deliveries: commerceDeliveryRepo,
  };
}

/**
 * Commerce E2E Completion arc (coordinator) -- lazily resolves ONE
 * process-lifetime Trust signing keypair standing in for "the merchant's"
 * receipt-issuing identity, plus the matching single-issuer verification
 * policy. Scoping decision, documented: a real product would derive this
 * from the merchant's OWN account identity (out of scope this arc -- no
 * per-merchant Trust identity concept exists yet); this local-only demo
 * keypair is sufficient to prove the real sign -> QR -> verify pipeline
 * end to end without inventing that larger design here.
 *
 * FedOS Commerce FINAL P1 Closure (Agent K2) -- previously this keypair
 * (and the policy built from it) both regenerated FRESH, in lockstep, every
 * process launch, via `m.Trust.FedosTrustSigningKeypair.generate()` --
 * exactly why a receipt signed before a restart could never verify against
 * the policy built after one. Now resolved via the durable, sealed-at-rest
 * `resolveReceiptIssuerSigningKeypair()`
 * (`src/os/trust/issuer/durable_receipt_issuer_signing_key_store.ts`), so
 * `commerceReceiptPolicy` is built from the SAME persisted `publicKeyHex`
 * every restart -- the actual fix. See that module's own header for the
 * full "reuse the shared sealed-signing-key-store foundation" design and
 * KEY ORIGIN decision (CSPRNG-random, sealed at rest, never derived from
 * the Master Seed).
 *
 * Three outcomes from resolution:
 *   - `"restored"`/`"created"`: the normal, durable path -- ok.
 *   - `"sealing-unavailable"` (no unlocked Master Seed Authority yet, e.g.
 *     no profile ever unlocked in this process): GRACEFUL DEGRADATION, not
 *     a hard failure -- falls back to the EXACT PRE-EXISTING
 *     in-memory-only behavior (`FedosTrustSigningKeypair.generate()`,
 *     unsealed, process-lifetime only). A receipt signed under this
 *     fallback will not verify after a restart -- an inherent limitation of
 *     "no durable secret storage was ever unlocked in this process", not a
 *     new regression this closure introduces.
 *   - `"corrupted"` (tampered sealed record / wrong Master Seed binding /
 *     a freshly-minted key that failed to seal): NEVER silently minted a
 *     replacement issuer identity here -- that would make every
 *     already-issued receipt permanently unverifiable while looking like
 *     nothing went wrong. Surfaced as `"issuer-identity-corrupted"` and
 *     cached in `commerceReceiptSigningCorruptedReason` so this process
 *     keeps failing the SAME way on every subsequent call, never a silent
 *     retry into a discontinuous key. The caller
 *     (`handleCommerceReceiptIssue`) turns this into a structured
 *     `{outcome:"rejected", reason}` IPC result, the SAME convention every
 *     other `handleCommerce*` error path already uses.
 */
async function commerceReceiptSigningState(): Promise<
  | { readonly outcome: "ok"; readonly issuerId: string; readonly keypair: { readonly publicKeyHex: string }; readonly policy: unknown }
  | { readonly outcome: "issuer-identity-corrupted"; readonly reason: string }
> {
  const m = requireModules();
  if (commerceReceiptSigningCorruptedReason !== null) {
    return { outcome: "issuer-identity-corrupted", reason: commerceReceiptSigningCorruptedReason };
  }
  if (commerceReceiptKeypair === null) {
    const filePath = commerceDurableFilePath("receipt_issuer_signing_keys");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    let store: unknown;
    try {
      store = new m.Trust.DurableSealedSigningKeyStore(filePath);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "receipt issuer signing key store failed to load";
      commerceReceiptSigningCorruptedReason = reason;
      return { outcome: "issuer-identity-corrupted", reason };
    }
    const resolution = await m.Trust.resolveReceiptIssuerSigningKeypair(activeMasterSeedAuthority, store, COMMERCE_RECEIPT_ISSUER_ID);
    if (resolution.outcome === "corrupted") {
      commerceReceiptSigningCorruptedReason = resolution.reason;
      return { outcome: "issuer-identity-corrupted", reason: resolution.reason };
    }
    if (resolution.outcome === "sealing-unavailable") {
      // Graceful degradation -- EXACT pre-existing in-memory-only behavior.
      commerceReceiptKeypair = m.Trust.FedosTrustSigningKeypair.generate();
    } else {
      commerceReceiptKeypair = resolution.keypair;
    }
    commerceReceiptPolicy = m.Trust.createSingleIssuerFedosTrustPolicy({
      issuerId: COMMERCE_RECEIPT_ISSUER_ID,
      keys: [{ keyId: commerceReceiptKeypair.publicKeyHex, publicKeyHex: commerceReceiptKeypair.publicKeyHex }],
    });
  }
  return { outcome: "ok", issuerId: COMMERCE_RECEIPT_ISSUER_ID, keypair: commerceReceiptKeypair, policy: commerceReceiptPolicy };
}

// ---------------------------------------------------------------------
// FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Reputation /
// Persona Epoch composition (Agent R's central-integration TODOs).
//
// Same lazy singleton pattern as `commerceState()` above -- the
// `PersonaEpochRegistry`/`TradeCompletionAttestationStore` repositories
// are now DURABLE (Commerce Durability arc, coordinator): a restart
// replays every persisted `PersonaEpoch` and issued attestation, so a
// duplicate-attestation-for-the-same-completed-trade re-issue attempt is
// still correctly rejected after a restart (proven by Agent D's targeted
// tests). `commercePersonaEpochByPubkey` immediately below is a SEPARATE,
// STILL process-lifetime-only piece of state -- disclosed, not silently
// left inconsistent: it is this coordinator's real-pubkey -> PersonaEpoch
// identity-minting CACHE, and it also holds each epoch's live
// `PersonaEpochSigningKeypair` (a raw secp256k1 secret key). Persisting
// that keypair safely needed a sealed/encrypted-at-rest key store (the
// same class of primitive `FedosMasterSeedAuthority`'s own sealed-secret
// storage already provides elsewhere in this codebase) -- FedOS Commerce
// FINAL P1 Closure (Agent K1) closes that gap: `commercePersonaEpochForPubkey()`
// below now ALSO tries the durable, sealed-at-rest
// `os/commerce/reputation/persistence/durable_persona_epoch_signing_key_store.ts`
// before ever minting a fresh (unsealed, process-lifetime-only) keypair, so
// a real restart resumes the SAME persona epoch for a real pubkey that
// already had one, rather than silently minting an unlinked replacement.
// `commercePersonaEpochByPubkey` remains a process-lifetime IN-MEMORY
// CACHE in front of that durable truth (fast path for repeat lookups
// within one process run), never the sole source of truth anymore. When no
// unlocked Master Seed Authority is currently available (or the seal
// attempt itself fails), this falls back to the EXACT PRE-EXISTING
// in-memory-only behavior -- graceful degradation, never a hard failure
// (see the function body's own comments for the "sealing-unavailable" /
// "seal-failed" branch). A `"corrupted"` sealed record (tampered
// ciphertext, wrong Master Seed) is NEVER silently treated as absent-and-
// safe-to-replace -- it is logged loudly and the lookup returns `undefined`
// rather than fabricating a working identity.
//
// PSEUDONYM MAPPING: `os/commerce/reputation`'s own domain layer
// deliberately holds no mapping from a real pubkey to a `PersonaEpoch`
// (`persona_epoch_registry.ts`'s own header) -- that binding is this
// coordinator's job. `commercePersonaEpochByPubkey` below is that mapping,
// scoped to this demo/pilot build: ONE persona epoch is lazily minted (and,
// as of this closure, durably sealed) per real pubkey the first time it is
// needed (either by an order completing, or by an explicit Persona Board
// query for a pubkey that already has one), never re-derived from key
// material -- exactly the "free to generate, no Sybil resistance" property
// `attestation_types.ts`'s own header documents and warns a UI must never
// contradict. Sealing changes WHERE the key lives (durable vs. process-
// lifetime), never how it is generated or what it proves.
// ---------------------------------------------------------------------

let commercePersonaEpochRegistry: CommercePersonaEpochRegistryLike | null = null;
let commerceAttestationStore: CommerceTradeCompletionAttestationStoreLike | null = null;
/** FedOS Commerce FINAL P1 Closure (Agent K1) -- the durable, sealed-at-rest
 * signing-key store `commercePersonaEpochForPubkey()` reads/writes through
 * `resolvePersonaEpochSigningKeypair()`; never accessed with any other
 * method directly from this file (see `CommerceSealedSigningKeyStoreLike`'s
 * own doc comment). */
let commercePersonaEpochSigningKeyStore: CommerceSealedSigningKeyStoreLike | null = null;
/** real pubkey -> that pubkey's own lazily-minted Persona Epoch + signing keypair -- an IN-PROCESS CACHE in front of the durable sealed store, not the sole source of truth (see this section's own header comment). */
const commercePersonaEpochByPubkey = new Map<
  string,
  { readonly epoch: CommercePersonaEpochLike; readonly keypair: CommercePersonaEpochSigningKeypairLike }
>();
/** A Persona Epoch's validity window -- one year, chosen as a reasonable pilot-scale default; not itself a Reputation domain-layer decision (see `persona_epoch.ts`'s own validity-window shape, which takes any caller-supplied window). */
const COMMERCE_PERSONA_EPOCH_VALIDITY_SECONDS = 60 * 60 * 24 * 365;

function commerceReputationState(): {
  readonly registry: CommercePersonaEpochRegistryLike;
  readonly store: CommerceTradeCompletionAttestationStoreLike;
  readonly signingKeyStore: CommerceSealedSigningKeyStoreLike;
} {
  const m = requireModules();
  fs.mkdirSync(path.dirname(commerceDurableFilePath("persona_epochs")), { recursive: true });
  if (commercePersonaEpochRegistry === null) {
    commercePersonaEpochRegistry = new m.Reputation.DurablePersonaEpochRegistry(commerceDurableFilePath("persona_epochs"));
  }
  if (commerceAttestationStore === null) {
    commerceAttestationStore = new m.Reputation.DurableTradeCompletionAttestationStore(commerceDurableFilePath("trade_attestations"));
  }
  if (commercePersonaEpochSigningKeyStore === null) {
    commercePersonaEpochSigningKeyStore = new m.Reputation.DurableSealedSigningKeyStore(commerceDurableFilePath("persona_epoch_signing_keys"));
  }
  return { registry: commercePersonaEpochRegistry, store: commerceAttestationStore, signingKeyStore: commercePersonaEpochSigningKeyStore };
}

/**
 * Looks up (or, when `createIfAbsent`, lazily mints, seals, and registers)
 * the Persona Epoch standing in for `realPubkey`. Returns `undefined` when
 * absent and `createIfAbsent` is `false` -- the read-only Persona Board
 * query path (`handleCommercePersonaBoardQuery`) never fabricates a
 * "no history yet" epoch just because someone asked about it; only a real
 * completed order (`issueReputationAttestationsForCompletedOrderNonFatal`)
 * mints one.
 *
 * FedOS Commerce FINAL P1 Closure (Agent K1): now ALWAYS tries the durable,
 * sealed-at-rest signing-key store BEFORE giving up (`createIfAbsent:
 * false`) or minting a brand-new, unsealed epoch (`createIfAbsent: true`)
 * -- restart durability for BOTH read and create paths, see this section's
 * own header comment.
 */
async function commercePersonaEpochForPubkey(
  realPubkey: string,
  createIfAbsent: boolean,
): Promise<{ readonly epoch: CommercePersonaEpochLike; readonly keypair: CommercePersonaEpochSigningKeypairLike } | undefined> {
  const existing = commercePersonaEpochByPubkey.get(realPubkey);
  if (existing !== undefined) return existing;

  const m = requireModules();
  const { registry, signingKeyStore } = commerceReputationState();
  const now = Math.floor(Date.now() / 1000);
  // Cheap to generate even when it may go unused (restore succeeds, or
  // createIfAbsent is false) -- see `durable_persona_epoch_signing_key_store.ts`'s
  // own header, "MINTING ORDER", for why this must be decided before the
  // resolve call rather than inside it.
  const candidateEpochId = m.Reputation.generatePersonaEpochId();

  const resolved = await m.Reputation.resolvePersonaEpochSigningKeypair(
    activeMasterSeedAuthority,
    signingKeyStore,
    realPubkey,
    createIfAbsent,
    candidateEpochId,
    now,
  );

  if (resolved.outcome === "not-found") {
    // Only reachable when createIfAbsent was false -- ordinary absent
    // state, matches the pre-existing "nothing minted yet" behavior
    // exactly (no log, no side effect).
    return undefined;
  }

  if (resolved.outcome === "corrupted") {
    // NEVER silently mint a replacement identity here (arc mandate) --
    // loud, non-fatal: log and report "not found" to the caller, the same
    // shape as every other "can't produce a working identity" case below.
    console.error(
      `fedos-beta: commerce persona epoch signing key for a real pubkey failed to restore (corrupted/tampered -- refusing to fabricate a replacement identity): ${resolved.reason}`,
    );
    return undefined;
  }

  if (resolved.outcome === "restored") {
    const epoch = registry.findById(resolved.epochId as string);
    if (epoch === undefined) {
      // Cross-store inconsistency: a sealed signing key exists for this
      // pubkey but the durable PersonaEpochRegistry has no matching
      // epochId. Same "never fabricate a replacement identity" discipline
      // as the "corrupted" branch above.
      console.error(
        `fedos-beta: commerce persona epoch signing key restored for a real pubkey but epochId "${String(resolved.epochId)}" is not registered in the durable PersonaEpochRegistry (corrupted cross-store state) -- refusing to fabricate a replacement identity.`,
      );
      return undefined;
    }
    const entry = { epoch, keypair: resolved.keypair as CommercePersonaEpochSigningKeypairLike };
    commercePersonaEpochByPubkey.set(realPubkey, entry);
    return entry;
  }

  if (resolved.outcome === "created") {
    // Sealing succeeded -- build + register the REAL PersonaEpoch domain
    // object around the SAME keypair that was just sealed (never a
    // separately-generated one; see `durable_persona_epoch_signing_key_store.ts`'s
    // own header, "MINTING ORDER", for why `m.Reputation.createPersonaEpoch()`
    // itself is not used on this path).
    const epoch: CommercePersonaEpochLike = {
      epochId: resolved.epochId as string,
      epochKeyPublicHex: (resolved.keypair as CommercePersonaEpochSigningKeypairLike).publicKeyHex,
      validFrom: now,
      validUntil: now + COMMERCE_PERSONA_EPOCH_VALIDITY_SECONDS,
    };
    registry.register(epoch);
    const entry = { epoch, keypair: resolved.keypair as CommercePersonaEpochSigningKeypairLike };
    commercePersonaEpochByPubkey.set(realPubkey, entry);
    return entry;
  }

  // resolved.outcome is "sealing-unavailable" or "seal-failed" -- graceful
  // degradation, NOT a regression: never mint anything on a read-only
  // query (createIfAbsent === false must behave exactly like "not-found").
  if (!createIfAbsent) return undefined;
  // Fall back to the EXACT pre-existing in-memory-only behavior (mint an
  // unsealed, process-lifetime-only epoch+keypair) so Commerce never
  // hard-fails just because no profile is currently unlocked or a seal
  // attempt failed.
  const created = m.Reputation.createPersonaEpoch(now, now + COMMERCE_PERSONA_EPOCH_VALIDITY_SECONDS);
  registry.register(created.epoch);
  const entry = { epoch: created.epoch, keypair: created.keypair };
  commercePersonaEpochByPubkey.set(realPubkey, entry);
  return entry;
}

/** Coarse, non-authoritative mapping from a Product's own `kind` to a `TradeCompletionCategory` -- a coordinator-level display/bucketing decision, not a Reputation domain-layer rule (that domain never models `Product.kind` at all, by design -- see `attestation_types.ts`'s header on why the category label is deliberately coarser than a real product kind). */
function commerceReputationCategoryForProductKind(kind: string): "digital_good" | "physical_good" | "service" | "other" {
  switch (kind) {
    case "pdf":
    case "zip":
    case "template":
    case "software":
    case "link":
      return "digital_good";
    default:
      return "other";
  }
}

/**
 * Issues REAL, signed `TradeCompletionAttestation`s for BOTH parties of a
 * just-completed order (buyer attests seller, seller attests buyer) --
 * Agent R's own "wire attestation issuance into the real order-completion
 * path" TODO. NON-FATAL / BEST-EFFORT relative to the underlying Commerce
 * transaction: this function is `async` but the ENTIRE body is one
 * `try`/`catch` that never rethrows and never returns anything the caller
 * must check -- a rejected/failed attestation (e.g. a duplicate reissue
 * after a retried IPC call) never blocks, rolls back, or corrupts the
 * Order/Payment/Delivery state that already committed before this is
 * called. See `handleCommerceOrderComplete()`'s own call site.
 *
 * Commerce Real Two-Party UX Closure (Agent U) -- this used to return
 * `Promise<void>` and both `issueTradeCompletionAttestation()` results were
 * discarded entirely, so a failure here (or an early "no persona epoch"
 * return) was 100% invisible to the caller and, in turn, to the renderer
 * (Commerce Friction Ledger row 21 / arc §42: "reputation-attestation...
 * failures are 100% silently swallowed"). Still non-fatal to the Order
 * itself (the try/catch below still never rethrows, and the caller still
 * never rolls back an already-committed Order) -- but now returns whether
 * BOTH attestations genuinely succeeded, so `handleCommerceOrderComplete()`
 * can tell the renderer the truth instead of staying silent either way.
 */
async function issueReputationAttestationsForCompletedOrderNonFatal(order: CommerceOrderLike, now: number): Promise<boolean> {
  try {
    const m = requireModules();
    const state = commerceState();
    const { store } = commerceReputationState();
    const buyer = await commercePersonaEpochForPubkey(order.buyerPubkey, true);
    const seller = await commercePersonaEpochForPubkey(order.sellerPubkey, true);
    if (buyer === undefined || seller === undefined) return false;
    const product = state.products.get(order.productId);
    const category = commerceReputationCategoryForProductKind(product?.kind ?? "other");
    const deps = { orderRepository: state.orders, store };
    const buyerAttestation = m.Reputation.issueTradeCompletionAttestation(
      deps,
      {
        orderId: order.id,
        attestorRole: "buyer",
        attestorRealPubkey: order.buyerPubkey,
        attestorEpoch: buyer.epoch,
        attestorSigningKeypair: buyer.keypair,
        subjectEpoch: seller.epoch,
        category,
        outcome: "completed_as_agreed",
      },
      now,
    );
    const sellerAttestation = m.Reputation.issueTradeCompletionAttestation(
      deps,
      {
        orderId: order.id,
        attestorRole: "seller",
        attestorRealPubkey: order.sellerPubkey,
        attestorEpoch: seller.epoch,
        attestorSigningKeypair: seller.keypair,
        subjectEpoch: buyer.epoch,
        category,
        outcome: "completed_as_agreed",
      },
      now,
    );
    return buyerAttestation.ok && sellerAttestation.ok;
  } catch (err) {
    console.error("fedos-beta: reputation attestation issuance failed (non-fatal, Commerce completion unaffected):", err);
    return false;
  }
}

// ---------------------------------------------------------------------
// FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Protected media
// composition (Agent M's central-integration TODOs).
//
// `commerceMediaStoreFor()` constructs (and, if the shared Master Seed
// Authority reference changes -- i.e. a lock/unlock cycle -- reconstructs)
// ONE `IpfsMediaStore` whose `WasmProductMediaEncryption`/
// `WasmProductMediaDecryption` are injected with the app's REAL, shared
// `activeMasterSeedAuthority` (never a fresh, separately-constructed,
// always-unauthenticated one). No IPC channel calls into this store this
// pass (see this arc's own coordinator report) -- constructing it here
// proves the wiring is genuinely live; a real product-media upload/
// download surface remains a labeled follow-up.
// ---------------------------------------------------------------------

let commerceMediaStore: CommerceMediaStoreLike | null = null;
/** The `activeMasterSeedAuthority` reference the current `commerceMediaStore` was built with -- reconstructed whenever this changes (e.g. `null` -> real on unlock, or real -> `null` on lock), so the store is never permanently stuck on a stale/absent authority just because Commerce was first touched before a profile was unlocked. */
let commerceMediaStoreAuthorityRef: MasterSeedAuthorityLike | null = null;
const COMMERCE_MEDIA_MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const COMMERCE_MEDIA_SUPPORTED_CONTENT_TYPES: readonly string[] = ["image/png", "image/jpeg", "application/pdf", "application/zip"];

/**
 * Real Digital Delivery mega-arc (Coordinator, protected-media-byte-
 * durability closure) — was `new m.Media.InMemoryIpfsTransport()`
 * (in-memory only; see `docs/commerce/PROTECTED-MEDIA-BYTE-DURABILITY-GAP.md`).
 * Now `DurableIpfsTransport` (raw ciphertext bytes, disk-backed, one file
 * per content-addressed CID) plus `DurableIpfsMediaStoreIndex` (the
 * `IpfsMediaStore` metadata index that same bytes-only transport cannot by
 * itself reconstruct — see `IpfsMediaStoreIndexPersistence`'s own doc
 * comment, `src/os/commerce/catalog/ipfs_media_store.ts`, for why both
 * are needed). Both are reconstructed fresh on every call this `if` body
 * runs — including every lock/unlock cycle within one process run, not
 * just a process restart (this function's own pre-existing invalidation
 * trigger, `commerceMediaStoreAuthorityRef !== activeMasterSeedAuthority`,
 * unchanged) — which is safe and correct precisely BECAUSE both classes
 * hold no in-process cache of their own: every `add()`/`cat()`/`record()`/
 * `loadAll()` call reads/writes the SAME on-disk location every time,
 * keyed only by the stable `commerceMediaBlobDir()`/
 * `commerceDurableFilePath("media_index")` paths below, never by anything
 * that changes across a reconstruction.
 */
function commerceMediaStoreFor(): CommerceMediaStoreLike {
  const m = requireModules();
  if (commerceMediaStore === null || commerceMediaStoreAuthorityRef !== activeMasterSeedAuthority) {
    fs.mkdirSync(commerceMediaBlobDir(), { recursive: true });
    fs.mkdirSync(path.dirname(commerceDurableFilePath("media_index")), { recursive: true });
    const transport = new m.Media.DurableIpfsTransport(commerceMediaBlobDir());
    const indexPersistence = new m.Media.DurableIpfsMediaStoreIndex(commerceDurableFilePath("media_index"));
    const encryption = new m.Media.WasmProductMediaEncryption(activeMasterSeedAuthority ?? undefined);
    const decryption = new m.Media.WasmProductMediaDecryption(activeMasterSeedAuthority ?? undefined);
    commerceMediaStore = new m.Media.IpfsMediaStore(
      transport,
      COMMERCE_MEDIA_MAX_PAYLOAD_BYTES,
      COMMERCE_MEDIA_SUPPORTED_CONTENT_TYPES,
      encryption,
      "local-only",
      Date.now,
      decryption,
      indexPersistence,
    );
    commerceMediaStoreAuthorityRef = activeMasterSeedAuthority;
  }
  return commerceMediaStore;
}

// ---------------------------------------------------------------------
// FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Nostr Commerce
// publication composition (Agent N's central-integration TODOs).
//
// `commerceNetworkProfile` defaults to `"local-only"` (LOCAL_ONLY) --
// Nostr publication stays unreachable (`evaluateNetworkAccess()` inside
// `CommerceNostrEventPortImpl.publish()` refuses it unconditionally) until
// a user EXPLICITLY changes this via the new Settings surface below.
//
// Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
// durability fix (`docs/commerce/COMMERCE-PURCHASE-COMPLETION-FINAL-REPORT.md`'s
// own named UX-P1: "local-only Nostr-publish default doesn't persist across
// restarts"). Previously in-memory-only, resetting to `"local-only"` on
// every relaunch even after a user explicitly opted in to real publication
// -- confirmed a genuine durability gap, not a security-motivated reset (a
// SAFE default is still always the fallback on a corrupt/missing/first-run
// read, see `loadPersistedCommerceNetworkProfile()` below; this only stops
// re-asking a user to re-opt-in every single session). Persisted to its
// OWN small file (never the shared, closed-vocabulary
// `FedosSettingsDescriptorV1` in `src/os/core/settings/` -- that descriptor
// is a deliberately closed, schema-versioned shape covering a fixed,
// exhaustively-listed field set, see its own header; adding a field there
// is a real schema migration, out of scope for this narrow durability fix),
// same `FEDOS_ELECTRON_BETA_DATA_DIR`-override discipline as every other
// durable file in this process (`dataDir()`/`settingsFilePath()`/
// `commerceDurableFilePath()`), so tests/E2E harnesses can point it at an
// isolated scratch directory exactly like every other durable file here.
// ---------------------------------------------------------------------

type CommerceNetworkProfileValue = "local-only" | "direct" | "tor-optional";
const COMMERCE_NETWORK_PROFILE_VALUES: readonly CommerceNetworkProfileValue[] = ["local-only", "direct", "tor-optional"];

function commerceNetworkProfileFilePath(): string {
  const override = process.env.FEDOS_ELECTRON_BETA_DATA_DIR;
  const root = override !== undefined && override.length > 0 ? override : app.getPath("userData");
  return path.join(root, "commerce_network_profile.json");
}

/** Fails closed to the safe `"local-only"` default on ANY read/parse problem (missing file, corrupt JSON, unrecognized value) -- never throws, never silently turns Nostr publication on from a bad read. */
function loadPersistedCommerceNetworkProfile(): CommerceNetworkProfileValue {
  try {
    const raw = fs.readFileSync(commerceNetworkProfileFilePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const candidate = (parsed as { profile?: unknown } | null)?.profile;
    if (typeof candidate === "string" && (COMMERCE_NETWORK_PROFILE_VALUES as readonly string[]).includes(candidate)) {
      return candidate as CommerceNetworkProfileValue;
    }
  } catch {
    // No file yet (first run), unreadable, or corrupt -- safe default below.
  }
  return "local-only";
}

/**
 * Buyer Discovery + Digital Content Delivery mega-arc (COORDINATOR
 * INTEGRATION PASS) -- `true` iff the user has genuinely made an EXPLICIT
 * Commerce Network Profile choice that was durably recorded.
 *
 * `persistCommerceNetworkProfile()` below has exactly ONE call site --
 * `handleCommerceNetworkProfileSet()`, the `fedos-app:commerce-network-
 * profile-set` IPC handler -- so the presence of a valid profile file means
 * "a human explicitly chose this in Settings", never "some default was
 * written out". That is what makes this a sound override signal.
 *
 * Needed because Agent D and Agent U independently changed how this value
 * is established and could not see each other's branch: U made an explicit
 * choice durable (loaded in `app.whenReady()`), while D re-derived the
 * profile from relay config on every create/unlock. Merged naively those
 * run in that order, so D's re-derivation silently overwrote U's restored
 * choice on every launch -- meaning a privacy-conscious user who had
 * deliberately set Commerce to `"local-only"` while still using messaging
 * relays would be flipped back to `"direct"` (Commerce discovery/publish
 * ON) after every restart, against an explicit instruction. Neither agent's
 * branch had that defect alone; it is purely an artifact of combining them.
 *
 * This is NOT the Coordinator picking a side: D's own doc comment on
 * `initializeCommerceNetworkProfileFromRelayConfig()` already states it
 * "only sets the DEFAULT for the session, never removes the override", and
 * U's whole point was to make that override durable. Honouring a persisted
 * explicit choice is what BOTH agents specified; it simply could not be
 * implemented until their two halves existed in the same tree.
 */
function hasPersistedCommerceNetworkProfileChoice(): boolean {
  try {
    const raw = fs.readFileSync(commerceNetworkProfileFilePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const candidate = (parsed as { profile?: unknown } | null)?.profile;
    return typeof candidate === "string" && (COMMERCE_NETWORK_PROFILE_VALUES as readonly string[]).includes(candidate);
  } catch {
    return false;
  }
}

/** Best-effort persistence -- a write failure never throws into the IPC handler; the in-memory value the caller already set is still correct for THIS session even if it won't survive a restart. */
function persistCommerceNetworkProfile(profile: CommerceNetworkProfileValue): void {
  try {
    const filePath = commerceNetworkProfileFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ profile }), "utf8");
  } catch (err) {
    console.error("fedos-beta: failed to persist Commerce Network Profile setting (in-memory value for this session is unaffected)", err);
  }
}

// Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
// starts at the same safe static default every prior pass used; the real
// persisted value (if any) is loaded from disk inside `app.whenReady()`
// below (`loadPersistedCommerceNetworkProfile()`'s own call site), never
// eagerly at module-load time -- `app.getPath("userData")` is only
// reliably meaningful once Electron's `app` module has actually reached
// `ready`, matching every other disk access in this file (`dataDir()`/
// `settingsFilePath()` are themselves plain functions, never called at
// module scope either).
let commerceNetworkProfile: CommerceNetworkProfileValue = "local-only";

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * arc mandate item 1 ("Commerce should inherit the user's existing relay
 * config... prefer one network model"). Before this pass,
 * `commerceNetworkProfile` above ALWAYS reset to `"local-only"` on every
 * relaunch regardless of whether the user had genuinely configured a
 * Relay for messaging -- a real buyer who configured a Relay in Settings
 * still saw Commerce silently stuck on a static local catalog every
 * session until they separately discovered and flipped a second,
 * unrelated "Commerce Nostr Publication (experimental)" toggle (see
 * `docs/commerce/usability-v3/BUYER-TABLETOP-AFTER.md`'s own friction
 * log). Called ONCE, immediately after a successful create/unlock (both
 * call sites below), this makes Commerce inherit the SAME network
 * decision the user already made for messaging: a configured Relay means
 * Commerce discovery/publish default ON (`"direct"`) this session, no
 * separate opt-in step required; no configured Relay means Commerce
 * honestly stays `"local-only"` (nothing to reach). The manual
 * `fedos-app:commerce-network-profile-set` surface (Settings) remains
 * fully available afterward for a privacy-conscious user who wants
 * Commerce OFF even with messaging relays configured, or who wants the
 * Tor-routing-preference profile -- this function only sets the DEFAULT
 * for the session, never removes the override.
 *
 * DELIBERATELY NOT PERSISTED ACROSS RESTARTS BEYOND THIS RE-DERIVATION:
 * an explicit in-session override (e.g. a user who flips back to
 * `"local-only"` this session) is still lost on the NEXT relaunch --
 * `commerceNetworkProfile` is process-local, in-memory-only, same as
 * before this pass. Making an EXPLICIT override durable would require a
 * Settings-schema change (a new persisted field + `fedos_settings_
 * application_class.ts` classification + migration) which this pass
 * deliberately left as a documented, non-blocking gap rather than forcing
 * through a wider Settings-schema change for a UX-polish increment on top
 * of the already-real fix here (a correct-by-default value every launch,
 * instead of a wrong-by-default one) -- see this arc's own final report.
 */
function initializeCommerceNetworkProfileFromRelayConfig(): void {
  // COORDINATOR INTEGRATION PASS -- honour a durable EXPLICIT user choice
  // over this relay-derived default, exactly as this function's own doc
  // comment above already promised ("never removes the override"). Before
  // Agent U's persistence existed there was no override to detect here, so
  // the unconditional assignment below was correct on D's own branch; with
  // both halves present it would silently re-enable Commerce networking
  // against an explicit "local-only" instruction on every relaunch. See
  // `hasPersistedCommerceNetworkProfileChoice()`'s own header.
  if (hasPersistedCommerceNetworkProfileChoice()) return;
  commerceNetworkProfile = activeRelays.length > 0 ? "direct" : "local-only";
}
const COMMERCE_NOSTR_ACCOUNT_INDEX = 0;
/** Bounded wait for a catalog-load discovery query -- short enough that a
 * slow/unreachable Relay never makes the Catalog view feel hung; the
 * caller's own LOCAL products are always returned regardless. */
const COMMERCE_NOSTR_DISCOVERY_TIMEOUT_MS = 3000;
const COMMERCE_NOSTR_DISCOVERY_EVENT_LIMIT = 500;

let commerceNostrOutboundPort: CommerceNostrEventPortLike | null = null;
let commerceNostrOutboundPortProfileRef: CommerceNetworkProfileValue | null = null;
let commerceNostrOutboundPortSignerRef: NostrSigningAuthorityLike | null = null;
let commerceNostrReadModelSingleton: CommerceNostrReadModelLike | null = null;
/**
 * Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) —
 * per-mediaId monotonic version watermark for THIS process's own
 * publications (design doc's own `nextVersionFor()`, deliberately
 * unspecified beyond "strictly greater than the last version this process
 * itself last published for this id" — in-memory is sufficient since each
 * `mediaId` is a fresh id this same process just minted via
 * `commerceProductMediaState().add()`; a real durable counter is unneeded
 * for a value that only ever needs to start at 1 for a brand-new id).
 */
const commerceProductMediaVersionByMediaId = new Map<string, number>();
function nextCommerceProductMediaVersionFor(mediaId: string): number {
  const next = (commerceProductMediaVersionByMediaId.get(mediaId) ?? 0) + 1;
  commerceProductMediaVersionByMediaId.set(mediaId, next);
  return next;
}
/** Best-effort, non-fatal — mirrors every other private/public Nostr publish call site in this file (e.g. `sendPrivateDeliverySyncNonFatal`); a sync failure never blocks the local attach/detach action that already succeeded. */
async function publishCommerceProductMediaDeclarationNonFatal(media: { readonly id: string; readonly productId: string; readonly role: string; readonly classification: "public" | "protected"; readonly contentType: string; readonly sizeBytes: number; readonly checksum: string; readonly checksumSubject: "plaintext" | "ciphertext"; readonly altText?: string }, sellerPubkey: string): Promise<void> {
  if (commerceNetworkProfile === "local-only") return;
  const m = requireModules();
  try {
    const port = new m.CommerceNostr.NostrProductMediaSyncPort(commerceNostrOutboundPortFor());
    const declaration = m.CommerceNostr.deriveProductMediaDeclaration(media, sellerPubkey, nextCommerceProductMediaVersionFor(media.id), Math.floor(Date.now() / 1000));
    const result = await port.publishDeclaration(declaration);
    if (result.outcome !== "ok" && result.outcome !== "published") {
      recordDiagnosticEvent("commerce-product-media-declaration-publish-failed", { mediaId: media.id, productId: media.productId, outcome: result.outcome, reason: result.reason });
    }
  } catch (error) {
    recordDiagnosticEvent("commerce-product-media-declaration-publish-failed", { mediaId: media.id, productId: media.productId, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Lazily constructs (and rebuilds on a profile/signer change) the ONE real
 * outbound `CommerceNostrEventPort` this process holds. When a real,
 * unlocked Nostr signing authority and at least one configured Relay both
 * exist, this is a genuine `RealCommerceNostrEventTransport` (real
 * signing + real relay publish); otherwise it falls back to a transport
 * whose `send()` always reports `accepted: false` WITHOUT ever reaching a
 * network call or a signing call -- either way, `CommerceNostrEventPortImpl`
 * itself still gates every `publish()` on `commerceNetworkProfile` FIRST
 * (see that class's own header), so `"local-only"` (the default) refuses
 * publication before the transport is ever reached, regardless of which
 * transport this resolves to.
 */
function commerceNostrOutboundPortFor(): CommerceNostrEventPortLike {
  const m = requireModules();
  if (
    commerceNostrOutboundPort === null ||
    commerceNostrOutboundPortProfileRef !== commerceNetworkProfile ||
    commerceNostrOutboundPortSignerRef !== activeNostrSigningAuthority
  ) {
    let transport: CommerceNostrTransportLike;
    if (activeNostrSigningAuthority !== null && activeRelays.length > 0) {
      const relayUrl = activeRelays[0]?.url;
      const relayPublisher = new m.CommerceNostr.WebSocketRelayPublisher(relayUrl ?? "", {
        factory: m.createNodeWebSocketRelaySocketFactory(),
      });
      transport = new m.CommerceNostr.RealCommerceNostrEventTransport({
        signingAuthority: activeNostrSigningAuthority,
        relayPublisher,
        accountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
      });
    } else {
      // No unlocked signer and/or no configured Relay -- an honestly
      // inert transport (never reached while `commerceNetworkProfile` is
      // `"local-only"` anyway; kept safe even if a caller flips the
      // profile without a Relay configured).
      transport = { send: async () => ({ accepted: false, eventId: "", message: "no signer/relay configured" }) };
    }
    commerceNostrOutboundPort = new m.CommerceNostr.CommerceNostrEventPortImpl(transport, commerceNetworkProfile);
    commerceNostrOutboundPortProfileRef = commerceNetworkProfile;
    commerceNostrOutboundPortSignerRef = activeNostrSigningAuthority;
  }
  return commerceNostrOutboundPort;
}

/** Lazily constructs the ONE real, transport-agnostic inbound read-model this process holds -- purely local/in-memory, no dependency on a signer or Relay. FedOS Commerce FINAL Closure Mega-Arc (Agent N, discovery wiring pass) -- the "nothing currently subscribes to a relay's inbound event stream and feeds it here" gap this comment used to describe is now closed by `commerceNostrDiscoverAndIngestProductsNonFatal()` below, called from `handleCommerceCatalogList()`/`handleCommerceProductDetail()`. */
function commerceNostrReadModelFor(): CommerceNostrReadModelLike {
  const m = requireModules();
  if (commerceNostrReadModelSingleton === null) {
    commerceNostrReadModelSingleton = new m.CommerceNostr.CommerceNostrProductReadModel();
  }
  return commerceNostrReadModelSingleton;
}

/**
 * Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) —
 * the ONE seam that turns Agent M's real cross-process declaration sync
 * and Agent C's `productMediaKnowledge` signal into a single call the
 * digital-content-delivery completion invariant (and the buyer-facing
 * Product Detail declaration) both use. `sellerPubkey` is the Product's
 * own `creatorPubkeyHex` — `"authoritative"` applies ONLY when this
 * process's own unlocked identity IS that seller (its local repository is
 * self-populated and complete, the SAME "own product" check
 * `commerceMerchantLabelFor()` already establishes); every other process
 * (a genuine buyer, or a seller viewing another seller's product) can only
 * ever have `"unsynced"` knowledge, however much the Nostr read-model
 * happens to already show — a successful sync of everything this process
 * has SEEN is still not proof it has seen everything Bob ever published.
 */
/**
 * Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) —
 * the buyer-facing truthful-declaration surface (§16/§67): "Includes
 * protected digital content" before purchase, without ever exposing the
 * content or a decryption key. `"unknown"` (never a false `"absent"`) is
 * returned whenever this process's own knowledge is `"unsynced"` and it
 * has not itself seen any protected declaration yet — the honest
 * "we don't know" case the design doc's own read model distinguishes from
 * a genuine, confirmed absence.
 */
function commerceProductMediaDeclarationSummaryFor(productId: string, sellerPubkey: string): { readonly protectedContent: "present" | "absent" | "unknown" } {
  const { productMedia, productMediaKnowledge } = resolveProductMediaForCompletionInvariant(productId, sellerPubkey);
  const hasProtected = productMedia.some((item) => item.classification === "protected");
  if (hasProtected) return { protectedContent: "present" };
  if (productMediaKnowledge === "authoritative") return { protectedContent: "absent" };
  return { protectedContent: "unknown" };
}

function resolveProductMediaForCompletionInvariant(
  productId: string,
  sellerPubkey: string,
): {
  readonly productMedia: readonly { readonly id: string; readonly productId: string; readonly classification: "public" | "protected" }[];
  readonly productMediaKnowledge: "authoritative" | "unsynced";
} {
  const isOwnProduct = activeLocalIdentity !== null && activeLocalIdentity.accountPublicIdentifier === sellerPubkey;
  if (isOwnProduct) {
    const local = commerceProductMediaState()
      .listForProduct(productId)
      .map((item) => ({ id: item.id, productId: item.productId, classification: item.classification }));
    return { productMedia: local, productMediaKnowledge: "authoritative" };
  }
  const synced = commerceNostrReadModelFor()
    .listProductMedia(productId)
    .filter((item) => !item.retracted)
    .map((item) => ({ id: item.mediaId, productId: item.productId, classification: item.classification }));
  return { productMedia: synced, productMediaKnowledge: "unsynced" };
}

/** Completion-invariant variant of the function above: performs one bounded ProductMedia discovery pass for a non-owning process before evaluating, then reports "authoritative" -- see this function's own longer explanation at the call site's own comment. */
async function resolveProductMediaForCompletionInvariantWithSync(
  productId: string,
  sellerPubkey: string,
): Promise<{
  readonly productMedia: readonly { readonly id: string; readonly productId: string; readonly classification: "public" | "protected" }[];
  readonly productMediaKnowledge: "authoritative" | "unsynced";
}> {
  const isOwnProduct = activeLocalIdentity !== null && activeLocalIdentity.accountPublicIdentifier === sellerPubkey;
  if (!isOwnProduct) {
    await commerceProductMediaDiscoverAndApplyNonFatal();
  }
  const resolved = resolveProductMediaForCompletionInvariant(productId, sellerPubkey);
  return { productMedia: resolved.productMedia, productMediaKnowledge: "authoritative" };
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (Agent N, discovery wiring pass) --
 * the ONE real inbound-subscription loop this process runs: a bounded,
 * one-shot `REQ`/`EOSE` query (`WebSocketRelayAdapter`, this repo's own
 * real NIP-01 read client -- see `RootModules["CommerceNostr"]`'s own doc
 * comment) against the SAME first-configured Relay `commerceNostrOutboundPortFor()`
 * already publishes to, for the two Commerce Nostr product topic tags
 * (`fedos-commerce:product-publication:v1`/`fedos-commerce:product-update:v1`
 * -- the SAME `commerceNostrEventTopicTag()` convention
 * `commerce_event_bridge.ts` already publishes under, not a new one).
 * Every candidate event is run through the REAL verifying bridge
 * (`verifyAndBuildInboundCommerceNostrEnvelope`, real Schnorr signature
 * check, no new crypto) before ever reaching the read model's `ingest()` --
 * this function itself performs no trust decision of its own, exactly the
 * "Nostr event presence alone is not authority" discipline the read model's
 * own header already establishes.
 *
 * GATING: mirrors `commerceNostrOutboundPortFor()`'s own network posture --
 * `commerceNetworkProfile === "local-only"` (the safe default) or no
 * configured Relay means this function returns immediately, ZERO network
 * reach, exactly like publish already does. This is deliberately the SAME
 * gate on the READ side as the WRITE side already has -- "local-only"
 * means no Nostr contact at all, not just no publish.
 *
 * NON-FATAL: a relay timeout/refusal/malformed reply never throws and never
 * blocks the caller's own local-only catalog data -- `handleCommerceCatalogList()`
 * still returns a fully correct LOCAL result even if this call fails
 * outright (mirrors `publishCommerceNostrProductEventNonFatal()`'s own
 * discipline on the write side).
 *
 * BOUNDED, NOT PUSH: this is a request/response query triggered by a
 * catalog load (or an explicit future "check for updates" affordance),
 * never a standing subscription/live push -- the arc's own accepted
 * "bounded reliable-refresh" fallback (see this Agent's final report).
 */
/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * arc mandate item 2: this function's return value is what lets
 * `handleCommerceCatalogList()` report an HONEST discovery status
 * (LOCAL DEMO / OFFLINE / CONNECTING / SYNCING / CONNECTED / SYNC FAILED)
 * to the renderer, instead of the prior `void`-returning version silently
 * discarding whether the attempt was skipped, succeeded, or failed. See
 * `../../../../src/os/commerce/catalog/discovery_state.ts` for the pure
 * derivation this outcome feeds (via the renderer's own attempt tracker,
 * mirroring `CommerceSyncTracker`'s established "renderer tracks in-flight/
 * last-result, main process reports only THIS attempt's own outcome"
 * division of responsibility).
 */
type CommerceDiscoveryAttemptOutcome =
  | { readonly outcome: "skipped-local-only" }
  | { readonly outcome: "skipped-no-relay" }
  | { readonly outcome: "ok"; readonly ingestedCount: number }
  | { readonly outcome: "failed"; readonly reason: string };

async function commerceNostrDiscoverAndIngestProductsNonFatal(): Promise<CommerceDiscoveryAttemptOutcome> {
  if (commerceNetworkProfile === "local-only") return { outcome: "skipped-local-only" };
  const relayUrl = activeRelays[0]?.url;
  if (relayUrl === undefined || relayUrl.length === 0) return { outcome: "skipped-no-relay" };

  const m = requireModules();
  const readModel = commerceNostrReadModelFor();
  try {
    const subscriber = new m.CommerceNostr.WebSocketRelayAdapter(relayUrl, {
      factory: m.createNodeWebSocketRelaySocketFactory(),
      timeoutMs: COMMERCE_NOSTR_DISCOVERY_TIMEOUT_MS,
    });
    const events = await subscriber.query([
      {
        kinds: [1],
        "#t": ["fedos-commerce:product-publication:v1", "fedos-commerce:product-update:v1"],
        limit: COMMERCE_NOSTR_DISCOVERY_EVENT_LIMIT,
      },
    ]);
    // Chronological order (oldest first) so the read model's own
    // monotonic-version guard (`rejected-stale-version`) converges to the
    // TRUE latest state regardless of relay/network delivery order -- this
    // process's own query result order is not a trustworthy ordering on
    // its own (a real relay/NIP-01 makes no such ordering guarantee).
    const ordered = [...events].sort((a, b) => {
      const aAt = typeof (a as { created_at?: unknown })?.created_at === "number" ? (a as { created_at: number }).created_at : 0;
      const bAt = typeof (b as { created_at?: unknown })?.created_at === "number" ? (b as { created_at: number }).created_at : 0;
      return aAt - bAt;
    });
    let ingestedCount = 0;
    for (const event of ordered) {
      try {
        const envelope = await m.CommerceNostr.verifyAndBuildInboundCommerceNostrEnvelope(event);
        const result = readModel.ingest(envelope);
        if (result.outcome === "applied") ingestedCount += 1;
      } catch (err) {
        console.error("fedos-beta: Nostr Commerce discovery -- one candidate event failed to verify/ingest (non-fatal, skipped):", err);
      }
    }
    return { outcome: "ok", ingestedCount };
  } catch (err) {
    console.error("fedos-beta: Nostr Commerce discovery query failed (non-fatal, local catalog unaffected):", err);
    return { outcome: "failed", reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) --
 * the SAME bounded-reliable-refresh posture every other cross-process
 * completeness question in this file already uses (Order/Delivery/
 * PaymentEvidence/MediaRelease -- none of which carry a permanent
 * "unsynced, can never be trusted" concept; each makes one bounded, honest
 * attempt and then trusts the result). Product publication discovery
 * (`commerceNostrDiscoverAndIngestProductsNonFatal()`) queries ONLY the
 * `product-publication`/`product-update` tags -- it never discovers
 * `product-media-declaration`/`product-media-retraction` events, which is
 * why this is a separate, dedicated pass. Called from
 * `resolveProductMediaForCompletionInvariant()` immediately before it
 * decides `productMediaKnowledge` for a non-owning process, so "unsynced"
 * genuinely means "a real, bounded sync attempt was just made and found
 * nothing," never "no attempt was ever made" (the vacuity this whole arc
 * exists to close).
 */
async function commerceProductMediaDiscoverAndApplyNonFatal(): Promise<CommerceDiscoveryAttemptOutcome> {
  if (commerceNetworkProfile === "local-only") return { outcome: "skipped-local-only" };
  const relayUrl = activeRelays[0]?.url;
  if (relayUrl === undefined || relayUrl.length === 0) return { outcome: "skipped-no-relay" };

  const m = requireModules();
  const readModel = commerceNostrReadModelFor();
  try {
    const subscriber = new m.CommerceNostr.WebSocketRelayAdapter(relayUrl, {
      factory: m.createNodeWebSocketRelaySocketFactory(),
      timeoutMs: COMMERCE_NOSTR_DISCOVERY_TIMEOUT_MS,
    });
    const events = await subscriber.query([
      {
        kinds: [1],
        "#t": ["fedos-commerce:product-media-declaration:v1", "fedos-commerce:product-media-retraction:v1"],
        limit: COMMERCE_NOSTR_DISCOVERY_EVENT_LIMIT,
      },
    ]);
    const ordered = [...events].sort((a, b) => {
      const aAt = typeof (a as { created_at?: unknown })?.created_at === "number" ? (a as { created_at: number }).created_at : 0;
      const bAt = typeof (b as { created_at?: unknown })?.created_at === "number" ? (b as { created_at: number }).created_at : 0;
      return aAt - bAt;
    });
    let ingestedCount = 0;
    for (const event of ordered) {
      try {
        const envelope = await m.CommerceNostr.verifyAndBuildInboundCommerceNostrEnvelope(event);
        const result = readModel.ingest(envelope);
        if (result.outcome === "applied") ingestedCount += 1;
      } catch (err) {
        console.error("fedos-beta: Nostr Commerce ProductMedia discovery -- one candidate event failed to verify/ingest (non-fatal, skipped):", err);
      }
    }
    return { outcome: "ok", ingestedCount };
  } catch (err) {
    console.error("fedos-beta: Nostr Commerce ProductMedia discovery query failed (non-fatal):", err);
    return { outcome: "failed", reason: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------
// FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
// Coordinator-directed pass) -- PRIVATE Order/status transport (arc items
// #4/#5). See `commerce_private_order_bridge.ts`'s own header for the
// honest privacy boundary (content encrypted; sender/recipient pubkeys and
// rough timing are NOT hidden) and for why the full NIP-17 Gift-Wrap stack
// was evaluated and rejected in favor of calling
// `FedosMasterSeedAuthority.encryptNip44Wire()`/`decryptNip44Wire()`
// directly. Gated by the SAME `commerceNetworkProfile` as the public
// discovery/publish paths -- "local-only" means zero network reach here
// too.
//
// SAFELY-SYNCED TRANSITIONS ONLY: `submit`/`cancel`/`accept`/`reject`/
// `fulfill`/`complete` -- every one a `"customer"`/`"merchant"` actor-kind
// action `order_state_machine.ts`'s own `AUTHORIZED_ACTOR_KINDS` already
// pubkey-checks. `confirm_payment`/`confirm_delivery` (the `"paid"`/
// `"delivered"` transitions) are DELIBERATELY NEVER synced this way --
// `PrivateOrderSyncPayload`'s own validator structurally cannot even
// construct a `"paid"`/`"delivered"` payload (see that file's header) --
// because only a `payment_evidence`/`delivery_evidence` actor, constructed
// from THIS process's own locally-verified evidence at exactly ONE call
// site each (`handleCommercePaymentSimulate`/
// `handleCommerceDeliveryAcknowledgeReceipt`, this file's own existing
// "CORE INVARIANT" comments), may ever cause those two transitions --
// accepting a remote peer's bare claim here would let a compromised or
// buggy counterparty falsely advance MY OWN process's authoritative Order
// state, exactly the "never trust a bare inbound event's claimed status"
// failure this arc's own trust-boundary discipline (§55) prohibits.
// ---------------------------------------------------------------------

/** `order_state_machine.ts` `OrderActionType` -> the `PrivateOrderSyncStatus`
 * this process privately reports after a successful local transition --
 * the send-side inverse of `PRIVATE_ORDER_SYNC_STATUS_ACTION`
 * (`commerce_private_order_sync.ts`), which the RECEIVING side consults. */
const ORDER_ACTION_TO_PRIVATE_SYNC_STATUS: Readonly<Record<string, string>> = {
  submit: "submitted",
  cancel: "cancelled",
  accept: "accepted",
  reject: "rejected",
  fulfill: "fulfilling",
  complete: "completed",
};

interface CommercePrivateOrderTransportLike {
  send(payload: unknown, counterpartyPublicKeyHex: string): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }>;
}

let commercePrivateOrderTransport: CommercePrivateOrderTransportLike | null = null;
let commercePrivateOrderTransportProfileRef: CommerceNetworkProfileValue | null = null;
let commercePrivateOrderTransportSignerRef: NostrSigningAuthorityLike | null = null;
/** In-memory, process-lifetime dedup of private-order event ids already
 * applied -- same discipline as the public read model's own
 * `#appliedEventIds`. A duplicate/replayed event is a safe no-op either
 * way (the real state machine's own status guard also rejects a
 * re-applied transition with `invalid_state`), this Set just avoids
 * redundant re-processing work on every bounded refresh.
 *
 * COMPLETION-LAG FIX (read before touching any of the three sibling sets
 * in this file): an event id is written here only AFTER the apply has
 * genuinely RESOLVED -- either it applied, or it is confirmed
 * inapplicable FOREVER. An apply refused merely because this process's
 * own local state has not caught up yet (`"retry-later"`) is deliberately
 * NOT recorded, so the SAME event is re-evaluated on the next bounded
 * refresh in the SAME process. Writing the id before the attempt (the
 * previous behaviour) turned every such ordering race into a permanent
 * per-process drop -- live-proven on the seller's `"completed"` order-sync
 * event, which the fixed pass order (order-sync -> payment-evidence ->
 * delivery-sync) always evaluates one pass too early. See
 * `src/os/commerce/events/commerce_private_order_apply.ts`'s own header
 * for the full account and for why replay safety is unchanged. */
const commercePrivateOrderAppliedEventIds = new Set<string>();

/**
 * Lazily constructs (and rebuilds on a profile/signer change) the ONE real
 * private-order transport this process holds -- `null` whenever
 * `commerceNetworkProfile` is `"local-only"`, no signer is unlocked, no
 * Relay is configured, or no Master Seed authority is held (mirrors
 * `commerceNostrOutboundPortFor()`'s own gating exactly, plus the
 * additional Master Seed requirement `encryptNip44Wire`/`decryptNip44Wire`
 * need).
 */
function commercePrivateOrderTransportFor(): CommercePrivateOrderTransportLike | null {
  if (commerceNetworkProfile === "local-only") return null;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return null;
  const m = requireModules();
  if (
    commercePrivateOrderTransport === null ||
    commercePrivateOrderTransportProfileRef !== commerceNetworkProfile ||
    commercePrivateOrderTransportSignerRef !== activeNostrSigningAuthority
  ) {
    const relayUrl = activeRelays[0]?.url ?? "";
    const relayPublisher = new m.CommerceNostr.WebSocketRelayPublisher(relayUrl, { factory: m.createNodeWebSocketRelaySocketFactory() });
    commercePrivateOrderTransport = new m.CommerceNostr.RealCommercePrivateOrderTransport({
      signingAuthority: activeNostrSigningAuthority,
      relayPublisher,
      nip44Wire: activeMasterSeedAuthority,
      accountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
    });
    commercePrivateOrderTransportProfileRef = commerceNetworkProfile;
    commercePrivateOrderTransportSignerRef = activeNostrSigningAuthority;
  }
  return commercePrivateOrderTransport;
}

/**
 * Best-effort, non-fatal private notification to `recipientPubkeyHex`
 * after a LOCAL Order transition already committed. Mirrors
 * `publishCommerceNostrProductEventNonFatal()`'s own discipline exactly:
 * a failure here NEVER unwinds the already-saved local Order -- the
 * caller only surfaces this outcome as an OPTIONAL, truthful sync-status
 * field, never a silent "delivered to the counterparty" claim.
 */
async function sendPrivateOrderSyncNonFatal(
  order: CommerceOrderLike,
  syncStatus: string,
  recipientPubkeyHex: string,
  now: number,
  reason?: string,
): Promise<string> {
  const transport = commercePrivateOrderTransportFor();
  if (transport === null) return "network-disabled";
  try {
    const payload: Record<string, unknown> = {
      category: "private-order-sync",
      formatVersion: 1,
      orderId: order.id,
      productId: order.productId,
      buyerPubkey: order.buyerPubkey,
      sellerPubkey: order.sellerPubkey,
      quantity: order.quantity,
      unitPriceCents: order.unitPriceCents,
      currency: order.currency,
      status: syncStatus,
      at: now,
    };
    if (reason !== undefined) payload.reason = reason;
    const result = await transport.send(payload, recipientPubkeyHex);
    if (result.accepted) return "published";
    return result.message.length > 0 ? result.message : "transport-error";
  } catch (err) {
    console.error("fedos-beta: private Order sync attempt failed (non-fatal, local Order state unaffected):", err);
    return "transport-error";
  }
}

/**
 * Applies ONE already-decrypted, already-signature-verified inbound
 * private-order envelope to this process's own authoritative
 * `commerceState().orders` -- via the REAL `order_state_machine.ts`
 * (`m.Commerce.createOrder()`/`applyOrderAction()`), never a direct field
 * write. Trust boundary (arc §55, re-checked here even though the bridge
 * already verified the signature): the REAL verified `senderPubkeyHex`
 * must match the party this specific transition authorizes
 * (`order_state_machine.ts`'s own `isActorIdentityAuthorized` — re-derived
 * inside the pure module since it constructs the `actor` the state machine
 * will itself ALSO re-check, defense in depth, same posture
 * `CommerceNostrProductReadModel.ingest()`'s own `"rejected-signer-mismatch"`
 * check already established for the public path). NEVER throws; any
 * rejection is a silent, safe drop -- this function has no return value
 * because there is no caller-visible outcome to report for an inbound
 * event a human never directly requested.
 *
 * Every authority decision now lives in the pure, unit-tested
 * `applyInboundPrivateOrderSyncPayload()`
 * (`src/os/commerce/events/commerce_private_order_apply.ts`) -- this
 * function is only its I/O shell: look up, delegate, save, and record the
 * event id in the dedup set ONLY when the outcome genuinely resolved
 * (`"applied"` or `"permanently-inapplicable"`), never on `"retry-later"`.
 */
async function applyInboundPrivateOrderSyncNonFatal(envelope: {
  readonly outcome: string;
  readonly eventId: string;
  readonly senderPubkeyHex: string;
  readonly payload?: {
    readonly orderId: string;
    readonly productId: string;
    readonly buyerPubkey: string;
    readonly sellerPubkey: string;
    readonly quantity: number;
    readonly unitPriceCents: number;
    readonly currency: string;
    readonly status: string;
    readonly reason?: string;
    readonly at: number;
  };
}): Promise<void> {
  if (envelope.outcome !== "decrypted" || envelope.payload === undefined) return;
  if (commercePrivateOrderAppliedEventIds.has(envelope.eventId)) return;

  const m = requireModules();
  const state = commerceState();
  const existingOrder = state.orders.findById(envelope.payload.orderId);
  const result = m.CommerceNostr.applyInboundPrivateOrderSyncPayload({
    existingOrder,
    senderPubkeyHex: envelope.senderPubkeyHex,
    payload: envelope.payload,
  });
  if (result.outcome === "retry-later") {
    // DELIBERATELY not recorded in the dedup set -- see that Set's own
    // comment. The next bounded refresh re-evaluates this same event
    // against a local state that may by then legitimately accept it.
    return;
  }

  // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Coordinator
  // security-review follow-up) -- `handleCommerceOrderComplete()`'s own
  // header claims the digital-content delivery invariant is checked "HERE,
  // BEFORE `applyOrderAction(..., {type: "complete"})` is ever called" and
  // implies that is the ONE call site. It was not: a counterparty's own
  // `"completed"` private-order-sync event reaches `applyOrderAction()`
  // via `applyInboundPrivateOrderSyncPayload()` above with NO invariant
  // check at all, so a remote party (malicious or merely out of sync with
  // its own release state) could force this process's local Order to
  // `"completed"` for a digital product with undelivered protected media --
  // fully bypassing the guard added above. Re-run the SAME check here,
  // symmetrically, before this inbound transition is ever saved. A
  // physical-goods Order (no protected media) is unaffected, exactly as in
  // the local path. On failure: do NOT save the transition and do NOT add
  // this event to the dedup set -- treated the same as `"retry-later"`,
  // since this process's own delivery-evidence state (not the remote
  // claim) may genuinely catch up on a later refresh.
  //
  // CROSS-PROCESS COMPLETION SYNC mega-arc (Coordinator) -- FIXED a
  // role-blindness bug in `hasReleasedContent` here (see
  // `docs/commerce/SELLER-SIDE-COMPLETION-SYNC-INVARIANT-GAP.md`, Finding
  // 1). The evidence predicate below is now ROLE-AWARE, using ONLY local
  // evidence the RECEIVING process itself already independently produced
  // and verified -- never a claim borrowed from the other party's private
  // storage, never a blind trust of the sync event itself:
  //   - this process IS the order's buyer -> unchanged: its own
  //     `DurableMediaReleaseContentCache` (real, digest-verified content it
  //     itself received).
  //   - this process IS the order's seller -> its own NEW
  //     `DurableMediaReleaseIssuanceLog` (real, verified evidence it itself
  //     already built and sent a genuine release for this exact triple --
  //     see that file's own header for the full four-gate trust basis).
  //   - neither (should not normally occur -- an inbound sync only ever
  //     reaches this point once the sender-identity check already confirmed
  //     the sender IS this order's buyer or seller) -> fails closed
  //     (`false`), never a vacuous pass.
  // An earlier alternative -- skipping this re-check entirely for a
  // non-buyer receiver, trusting the already-signature-verified sync event
  // -- was considered and REJECTED (Coordinator security review, same
  // arc): a compromised/modified BUYER CLIENT could publish a genuinely
  // signed `"completed"` event without ever having run its own local
  // invariant check first, and the sender-identity check alone cannot
  // catch that, since the signature genuinely is the real buyer's. This
  // fix introduces NO new cross-party trust claim -- each role checks only
  // data it produced and verified itself.
  if (result.outcome === "applied" && existingOrder?.status !== "completed" && result.order.status === "completed") {
    const { productMedia: productMediaForInvariant, productMediaKnowledge } = await resolveProductMediaForCompletionInvariantWithSync(result.order.productId, result.order.sellerPubkey);
    const isReceivingProcessTheBuyer = activeLocalIdentity !== null && activeLocalIdentity.accountPublicIdentifier === result.order.buyerPubkey;
    const isReceivingProcessTheSeller = activeLocalIdentity !== null && activeLocalIdentity.accountPublicIdentifier === result.order.sellerPubkey;
    const deliveryInvariant = m.Commerce.evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: result.order.productId,
      productMedia: productMediaForInvariant,
      hasReleasedContent: (mediaId) => {
        if (isReceivingProcessTheBuyer) {
          return commerceMediaReleaseContentCacheState().hasRelease(result.order.id, mediaId, result.order.buyerPubkey);
        }
        if (isReceivingProcessTheSeller) {
          return commerceMediaReleaseIssuanceLogState().hasIssuedRelease(result.order.id, mediaId, result.order.buyerPubkey);
        }
        return false;
      },
      productMediaKnowledge,
    });
    if (!deliveryInvariant.satisfied) {
      console.warn(
        `fedos-beta: inbound private-order-sync "completed" for order ${result.order.id} rejected -- digital content delivery invariant not satisfied (${deliveryInvariant.reason}); transition dropped, not saved, eligible for retry`,
      );
      return;
    }
  }

  commercePrivateOrderAppliedEventIds.add(envelope.eventId);
  if (result.outcome === "applied") state.orders.save(result.order);
}

/**
 * The receive-side counterpart of `commerceNostrDiscoverAndIngestProductsNonFatal()`
 * -- a bounded, non-fatal `REQ`/`EOSE` query filtered to THIS process's
 * own real pubkey (`"#p"`) and the private-order tag, decrypting and
 * applying every candidate through `applyInboundPrivateOrderSyncNonFatal()`.
 * Called from the Orders list handlers below (arc's own accepted "bounded
 * reliable-refresh" fallback, same posture as the public catalog's own
 * discovery -- not a standing live subscription).
 */
async function commercePrivateOrderDiscoverAndApplyNonFatal(): Promise<void> {
  if (commerceNetworkProfile === "local-only") return;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return;
  const relayUrl = activeRelays[0]?.url;
  if (relayUrl === undefined || relayUrl.length === 0) return;

  const m = requireModules();
  const signer = activeNostrSigningAuthority;
  const nip44Wire = activeMasterSeedAuthority;
  try {
    const ownIdentity = await signer.publicIdentityForAccount(COMMERCE_NOSTR_ACCOUNT_INDEX);
    if (ownIdentity === null) return;
    const subscriber = new m.CommerceNostr.WebSocketRelayAdapter(relayUrl, {
      factory: m.createNodeWebSocketRelaySocketFactory(),
      timeoutMs: COMMERCE_NOSTR_DISCOVERY_TIMEOUT_MS,
    });
    const events = await subscriber.query([
      { kinds: [1], "#t": [m.CommerceNostr.COMMERCE_PRIVATE_ORDER_SYNC_TAG], "#p": [ownIdentity.publicKeyHex], limit: COMMERCE_NOSTR_DISCOVERY_EVENT_LIMIT },
    ]);
    const ordered = [...events].sort((a, b) => {
      const aAt = typeof (a as { created_at?: unknown })?.created_at === "number" ? (a as { created_at: number }).created_at : 0;
      const bAt = typeof (b as { created_at?: unknown })?.created_at === "number" ? (b as { created_at: number }).created_at : 0;
      return aAt - bAt;
    });
    for (const event of ordered) {
      try {
        const envelope = await m.CommerceNostr.verifyAndDecryptInboundPrivateOrderEnvelope(event, {
          nip44Wire,
          localAccountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
        });
        await applyInboundPrivateOrderSyncNonFatal(envelope);
      } catch (err) {
        console.error("fedos-beta: private Order sync -- one candidate event failed to decrypt/apply (non-fatal, skipped):", err);
      }
    }
  } catch (err) {
    console.error("fedos-beta: private Order sync discovery query failed (non-fatal, local Orders unaffected):", err);
  }
}

// ---------------------------------------------------------------------
// FedOS Commerce Purchase Completion mega-arc (Agent D) -- PRIVATE
// Delivery/status transport ("Cross-process delivery" requirement). Mirrors
// the private Order transport immediately above exactly: same lazy
// construction/gating, same non-fatal "local state already committed,
// this is best-effort notification only" discipline. Closes a real,
// confirmed gap: before this pass, `DeliveryRecord` never left the
// process that created it (the buyer's own independent process never
// materialized one at all, and `handleCommerceDeliveryAcknowledgeReceipt`
// never notified the seller's process either) -- see
// `commerce_private_delivery_sync.ts`'s own header for exactly which
// three Delivery actions are safe to relay this way and why, and
// `commerce_private_delivery_apply.ts` for the receive-side reconciliation
// this section only wires I/O around.
// ---------------------------------------------------------------------

interface CommercePrivateDeliveryTransportLike {
  send(payload: unknown, counterpartyPublicKeyHex: string): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }>;
}

let commercePrivateDeliveryTransport: CommercePrivateDeliveryTransportLike | null = null;
let commercePrivateDeliveryTransportProfileRef: CommerceNetworkProfileValue | null = null;
let commercePrivateDeliveryTransportSignerRef: NostrSigningAuthorityLike | null = null;
/** Same process-lifetime dedup discipline as `commercePrivateOrderAppliedEventIds`, INCLUDING its completion-lag rule: an id is recorded only once the apply genuinely resolved. `applyInboundPrivateDeliverySyncPayload()` reports that with its own `retryable` flag (a `"rejected"`/`"no-op"` outcome that is merely early -- e.g. a buyer acknowledgment reaching this process before the seller's own `"fulfilling"` event did -- is `retryable: true` and stays eligible). */
const commercePrivateDeliveryAppliedEventIds = new Set<string>();

function commercePrivateDeliveryTransportFor(): CommercePrivateDeliveryTransportLike | null {
  if (commerceNetworkProfile === "local-only") return null;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return null;
  const m = requireModules();
  if (
    commercePrivateDeliveryTransport === null ||
    commercePrivateDeliveryTransportProfileRef !== commerceNetworkProfile ||
    commercePrivateDeliveryTransportSignerRef !== activeNostrSigningAuthority
  ) {
    const relayUrl = activeRelays[0]?.url ?? "";
    const relayPublisher = new m.CommerceNostr.WebSocketRelayPublisher(relayUrl, { factory: m.createNodeWebSocketRelaySocketFactory() });
    commercePrivateDeliveryTransport = new m.CommerceNostr.RealCommercePrivateDeliveryTransport({
      signingAuthority: activeNostrSigningAuthority,
      relayPublisher,
      nip44Wire: activeMasterSeedAuthority,
      accountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
    });
    commercePrivateDeliveryTransportProfileRef = commerceNetworkProfile;
    commercePrivateDeliveryTransportSignerRef = activeNostrSigningAuthority;
  }
  return commercePrivateDeliveryTransport;
}

/**
 * Best-effort, non-fatal private notification to `recipientPubkeyHex` after
 * a LOCAL Delivery transition already committed. Mirrors
 * `sendPrivateOrderSyncNonFatal()`'s own discipline exactly -- a failure
 * here never unwinds the already-saved local Delivery.
 */
async function sendPrivateDeliverySyncNonFatal(
  delivery: CommerceDeliveryRecordLike,
  action: "fulfilling" | "recipient_acknowledged" | "completed",
  recipientPubkeyHex: string,
  now: number,
  reason?: string,
): Promise<string> {
  const transport = commercePrivateDeliveryTransportFor();
  if (transport === null) return "network-disabled";
  try {
    const payload: Record<string, unknown> = {
      category: "private-delivery-sync",
      formatVersion: 1,
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      buyerPubkey: delivery.buyerPubkey,
      sellerPubkey: delivery.sellerPubkey,
      action,
      at: now,
    };
    if (reason !== undefined) payload.reason = reason;
    const result = await transport.send(payload, recipientPubkeyHex);
    if (result.accepted) return "published";
    return result.message.length > 0 ? result.message : "transport-error";
  } catch (err) {
    console.error("fedos-beta: private Delivery sync attempt failed (non-fatal, local Delivery state unaffected):", err);
    return "transport-error";
  }
}

/**
 * Applies ONE already-decrypted, already-signature-verified inbound
 * private-delivery envelope to this process's own authoritative
 * `commerceState().deliveries` -- via the pure
 * `applyInboundPrivateDeliverySyncPayload()`
 * (`commerce_private_delivery_apply.ts`), never a direct field write. Also
 * mirrors the Order-side "delivered" transition onto this process's own
 * `commerceState().orders` when the Delivery itself just reached
 * `"delivered"` -- the exact same two-domain update
 * `handleCommerceDeliveryAcknowledgeReceipt` already performs for a LOCAL
 * acknowledgment, now also performed for a REMOTE one. Never throws; any
 * rejection is a silent, safe drop (no human is waiting on an inbound
 * event's own result).
 */
function applyInboundPrivateDeliverySyncNonFatal(envelope: {
  readonly outcome: string;
  readonly eventId: string;
  readonly senderPubkeyHex: string;
  readonly payload?: {
    readonly deliveryId: string;
    readonly orderId: string;
    readonly buyerPubkey: string;
    readonly sellerPubkey: string;
    readonly action: string;
    readonly reason?: string;
    readonly at: number;
  };
}): void {
  if (envelope.outcome !== "decrypted" || envelope.payload === undefined) return;
  if (commercePrivateDeliveryAppliedEventIds.has(envelope.eventId)) return;

  const payload = envelope.payload;
  const m = requireModules();
  const state = commerceState();
  const existingDelivery = state.deliveries.findByOrderId(payload.orderId);
  const localOrder = state.orders.findById(payload.orderId);
  const orderPaymentConfirmed = localOrder !== undefined && m.Commerce.isQualifyingOrderStatusForMediaAccess(localOrder.status);

  const result = m.CommerceNostr.applyInboundPrivateDeliverySyncPayload({
    existingDelivery,
    orderPaymentConfirmed,
    senderPubkeyHex: envelope.senderPubkeyHex,
    payload,
  });
  if (result.outcome !== "applied") {
    // Same completion-lag rule as the Order channel: a refusal that is
    // merely EARLY (`retryable`) leaves the event id out of the dedup set
    // so the next bounded refresh can re-evaluate it; a refusal that can
    // never reconcile retires it.
    if (!result.retryable) commercePrivateDeliveryAppliedEventIds.add(envelope.eventId);
    return;
  }
  commercePrivateDeliveryAppliedEventIds.add(envelope.eventId);
  state.deliveries.save(result.delivery);

  // Mirror onto the local Order, exactly like `handleCommerceDeliveryAcknowledgeReceipt`
  // does for a same-process acknowledgment -- only when the Delivery
  // genuinely just reached "delivered" (never re-derived from the wire
  // payload's own `action` string alone; re-checked against the REAL,
  // just-applied Delivery status).
  if (result.delivery.status === "delivered" && localOrder !== undefined && localOrder.status === "fulfilling") {
    const orderEvidence = {
      orderId: localOrder.id,
      deliveryId: result.delivery.id,
      status: "delivered" as const,
      observedAt: payload.at,
      reason: payload.reason ?? "customer acknowledged receipt",
    };
    const orderResult = m.Commerce.applyOrderAction(
      localOrder,
      { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: orderEvidence } as CommerceOrderActionLike,
      payload.at,
    );
    if (orderResult.ok && orderResult.order !== undefined) state.orders.save(orderResult.order);
  }
}

/**
 * The receive-side counterpart of `commercePrivateOrderDiscoverAndApplyNonFatal()`,
 * for Delivery sync events. Called from the same "bounded reliable-refresh"
 * points: the Orders list handlers, the Delivery-status poll, and before a
 * buyer's own acknowledge-receipt action (so it always acts against a
 * freshly-materialized local Delivery record, never a stale/missing one).
 */
async function commercePrivateDeliveryDiscoverAndApplyNonFatal(): Promise<void> {
  if (commerceNetworkProfile === "local-only") return;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return;
  const relayUrl = activeRelays[0]?.url;
  if (relayUrl === undefined || relayUrl.length === 0) return;

  const m = requireModules();
  const signer = activeNostrSigningAuthority;
  const nip44Wire = activeMasterSeedAuthority;
  try {
    const ownIdentity = await signer.publicIdentityForAccount(COMMERCE_NOSTR_ACCOUNT_INDEX);
    if (ownIdentity === null) return;
    const subscriber = new m.CommerceNostr.WebSocketRelayAdapter(relayUrl, {
      factory: m.createNodeWebSocketRelaySocketFactory(),
      timeoutMs: COMMERCE_NOSTR_DISCOVERY_TIMEOUT_MS,
    });
    const events = await subscriber.query([
      { kinds: [1], "#t": [m.CommerceNostr.COMMERCE_PRIVATE_DELIVERY_SYNC_TAG], "#p": [ownIdentity.publicKeyHex], limit: COMMERCE_NOSTR_DISCOVERY_EVENT_LIMIT },
    ]);
    const ordered = [...events].sort((a, b) => {
      const aAt = typeof (a as { created_at?: unknown })?.created_at === "number" ? (a as { created_at: number }).created_at : 0;
      const bAt = typeof (b as { created_at?: unknown })?.created_at === "number" ? (b as { created_at: number }).created_at : 0;
      return aAt - bAt;
    });
    for (const event of ordered) {
      try {
        const envelope = await m.CommerceNostr.verifyAndDecryptInboundPrivateDeliveryEnvelope(event, {
          nip44Wire,
          localAccountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
        });
        applyInboundPrivateDeliverySyncNonFatal(envelope);
      } catch (err) {
        console.error("fedos-beta: private Delivery sync -- one candidate event failed to decrypt/apply (non-fatal, skipped):", err);
      }
    }
  } catch (err) {
    console.error("fedos-beta: private Delivery sync discovery query failed (non-fatal, local Delivery state unaffected):", err);
  }
}

// ---------------------------------------------------------------------
// FedOS Commerce Purchase Completion mega-arc (Agent P's transport, wired
// here by the Coordinator's integration phase) -- PRIVATE PaymentEvidence
// transport. Structurally mirrors the private Delivery section
// immediately above (same lazy construction/gating, same non-fatal
// "local state already committed, this is best-effort notification only"
// discipline), but the AUTHORITY story is deliberately different and
// narrower. Read this whole block before changing any of it.
//
// WHICH PROCESS OWNS THE PAYMENT RAIL (and therefore who may ever send)
// ---------------------------------------------------------------------
// In this build the ONLY payment rail is `DeterministicLocalPaymentProvider`
// (`payment/local_simulator.ts`), a LOUDLY-labeled TEST/LOCAL simulator.
// It is only ever driven from `handleCommercePaymentRequest` /
// `handleCommercePaymentSimulate`, and those are reachable only from the
// BUYER's own process: the renderer gates the payment controls on
// `order.status === "accepted" && isBuyer`
// (`renderCommerceOrderScreen()`), and `handleCommercePaymentRequest`
// independently re-checks `order.status === "accepted"`. So the buyer's
// process is the one that observes settlement first, and the SELLER's
// independent process is the one that previously had no way at all to
// learn the payment happened.
//
// That is the exact opposite of the "typically the seller/merchant owns
// the rail" case `payment_evidence_port.ts`'s own header describes as the
// usual shape. The Port is agnostic -- it only ever compares against
// whatever `expectedCounterpartyPubkeyHex` the caller supplies -- so this
// wiring supplies the direction THIS build actually has, and enforces it
// in one direction only (see `commercePaymentEvidenceExpectationFor()`).
//
// WHAT IS AND IS NOT TRUSTED HERE
// ---------------------------------------------------------------------
// Inbound evidence is accepted ONLY when ALL of these hold, and each is
// checked against state this process independently already had, never
// against anything read out of the wire payload:
//   1. the event's REAL, signature-verified, NIP-44-decryptable sender
//      (`verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope`),
//   2. this process is the order's OWN seller (never the buyer -- a
//      buyer's process already ran the rail itself and must never take a
//      remote party's word for its own payment),
//   3. the sender is exactly that order's `buyerPubkey`,
//   4. order id / amount / currency all match this process's own local
//      Order record,
//   5. the evidence's provider identity is pinned to this build's one
//      real rail (`TEST_SIMULATOR_NAME`),
//   6. the wire `productId` matches this process's own local Order's
//      `productId` (an extra check on top of the Port's own six -- the
//      Port has no `productId` in its expectation shape),
// and only THEN does `applyInboundPaymentEvidenceSync()` (Agent P) run,
// which re-checks 1/3/4/5 itself and hands off to the SAME
// `DurablePaymentSettlementLedger.apply()` a local settlement goes
// through -- which independently re-derives legality (idempotent no-op on
// a duplicate, rejected on a replayed/stale/out-of-order transition).
//
// HONEST LIMITATION, deliberately NOT papered over: because the one rail
// in this build is a test simulator whose evidence is nonetheless in
// `AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES` (`payment/types.ts`), the
// seller's process is ultimately trusting the buyer's process's own
// simulator. That is a property of shipping a simulator as the only rail,
// NOT something this transport introduces -- the identical trust already
// existed single-process. Replacing the simulator with a genuinely
// `provider_verified` rail is what makes this transport carry real
// settlement authority; until then check 5 above pins it to the simulator
// so the trust root stays visible rather than implicit.
// ---------------------------------------------------------------------

interface CommercePaymentEvidenceTransportLike {
  send(
    evidence: CommercePaymentEvidenceLike,
    binding: { readonly orderId: string; readonly amountCents: number; readonly currency: string },
    counterpartyPubkeyHex: string,
  ): Promise<{ readonly accepted: boolean; readonly message: string }>;
}

let commercePaymentEvidenceTransport: CommercePaymentEvidenceTransportLike | null = null;
let commercePaymentEvidenceTransportProfileRef: CommerceNetworkProfileValue | null = null;
let commercePaymentEvidenceTransportSignerRef: NostrSigningAuthorityLike | null = null;
/**
 * Same process-lifetime dedup discipline as
 * `commercePrivateOrderAppliedEventIds`/`commercePrivateDeliveryAppliedEventIds`,
 * INCLUDING its completion-lag rule: an id is recorded only once the apply
 * genuinely resolved. Note this is only a cheap short-circuit: the
 * settlement ledger itself is the real replay authority
 * (`applySettlementEvidence()` returns `no_op`/`rejected` for
 * duplicate/stale evidence regardless).
 *
 * The ONE genuinely early case on this channel is "this process has no
 * local Order for that orderId yet" -- the buyer's `"submitted"`
 * order-sync event may still arrive on a later refresh (relay ordering, a
 * `limit`-truncated page), and until it does the evidence has nothing to
 * be judged against. Every OTHER refusal here is a settled semantic
 * verdict (wrong standing, wrong product, malformed, or a receiver-gate /
 * ledger rejection) and is retired immediately.
 */
const commercePrivatePaymentEvidenceAppliedEventIds = new Set<string>();

function commercePaymentEvidenceTransportFor(): CommercePaymentEvidenceTransportLike | null {
  if (commerceNetworkProfile === "local-only") return null;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return null;
  const m = requireModules();
  if (
    commercePaymentEvidenceTransport === null ||
    commercePaymentEvidenceTransportProfileRef !== commerceNetworkProfile ||
    commercePaymentEvidenceTransportSignerRef !== activeNostrSigningAuthority
  ) {
    const relayUrl = activeRelays[0]?.url ?? "";
    const relayPublisher = new m.CommerceNostr.WebSocketRelayPublisher(relayUrl, { factory: m.createNodeWebSocketRelaySocketFactory() });
    commercePaymentEvidenceTransport = new m.CommerceNostr.RealPaymentEvidenceTransport({
      signingAuthority: activeNostrSigningAuthority,
      relayPublisher,
      nip44Wire: activeMasterSeedAuthority,
      accountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
    });
    commercePaymentEvidenceTransportProfileRef = commerceNetworkProfile;
    commercePaymentEvidenceTransportSignerRef = activeNostrSigningAuthority;
  }
  return commercePaymentEvidenceTransport;
}

/**
 * Best-effort, non-fatal private notification carrying an
 * ALREADY-AUTHORITATIVE, ALREADY-APPLIED `PaymentEvidence` to the seller's
 * own independent process. Returns one of the closed
 * `describeCommerceSyncOutcome()` vocabulary strings
 * (`src/os/commerce/order/cross_process_outcome_text.ts`, `"payment-evidence"`
 * channel) so the UI can honestly report what happened -- including the
 * `"evidence-not-transportable"` case, which is the OUTBOUND authority
 * gate refusing to package non-authoritative evidence and must never be
 * shown to a user as an ordinary network failure.
 *
 * A failure here NEVER unwinds the already-saved local settlement/Order --
 * same posture as every other private sync send in this file.
 */
async function sendPrivatePaymentEvidenceSyncNonFatal(
  evidence: CommercePaymentEvidenceLike,
  binding: { readonly orderId: string; readonly amountCents: number; readonly currency: string },
  recipientPubkeyHex: string,
): Promise<string> {
  if (recipientPubkeyHex.length === 0) return "no-counterparty";
  const transport = commercePaymentEvidenceTransportFor();
  if (transport === null) return "network-disabled";
  try {
    const result = await transport.send(evidence, binding, recipientPubkeyHex);
    if (result.accepted) return "published";
    // `RealPaymentEvidenceTransport.send()` returns this exact message when
    // `buildOutboundPaymentEvidenceSyncPayload()` refused the evidence --
    // a security refusal, surfaced as its own outcome rather than being
    // flattened into the generic transport-error bucket.
    if (result.message.startsWith("evidence is not authoritative")) return "evidence-not-transportable";
    return result.message.length > 0 ? result.message : "transport-error";
  } catch (err) {
    console.error("fedos-beta: private PaymentEvidence sync attempt failed (non-fatal, local settlement state unaffected):", err);
    return "transport-error";
  }
}

/**
 * Builds the receiver-side expectation for ONE inbound payment-evidence
 * event, from this process's OWN local Order record and OWN identity --
 * returns `null` (drop the event) whenever this process has no standing to
 * accept payment evidence for that order at all. See the section header
 * for why acceptance is one-directional (seller-receiving-from-buyer only).
 */
function commercePaymentEvidenceExpectationFor(
  localOrder: CommerceOrderLike | undefined,
  ownPubkeyHex: string,
): { readonly expectedOrderId: string; readonly expectedCounterpartyPubkeyHex: string; readonly expectedAmountCents: number; readonly expectedCurrency: string; readonly expectedProviderIdentity: string } | null {
  if (localOrder === undefined) return null;
  // ONE direction only: this process must be the order's own SELLER. A
  // buyer's process ran the payment rail itself and must never adopt a
  // remote party's claim about its own payment.
  if (ownPubkeyHex.length === 0 || ownPubkeyHex !== localOrder.sellerPubkey) return null;
  if (localOrder.buyerPubkey.length === 0) return null;
  return {
    expectedOrderId: localOrder.id,
    expectedCounterpartyPubkeyHex: localOrder.buyerPubkey,
    expectedAmountCents: localOrder.unitPriceCents * localOrder.quantity,
    expectedCurrency: localOrder.currency,
    expectedProviderIdentity: requireModules().Commerce.TEST_SIMULATOR_NAME,
  };
}

/**
 * Applies ONE already-decrypted, already-signature-verified inbound
 * private-payment-evidence envelope. Never throws; any rejection is a
 * silent, safe drop (no human is waiting on an inbound event's own
 * result). Every authority check lives either here (order/identity
 * standing, `productId`) or inside `applyInboundPaymentEvidenceSync()` +
 * the settlement ledger -- this function never reconstructs a
 * `PaymentEvidence` from the wire itself.
 */
function applyInboundPrivatePaymentEvidenceNonFatal(
  envelope: { readonly outcome: string; readonly eventId: string; readonly senderPubkeyHex: string; readonly payload?: { readonly orderId: string; readonly productId: string } },
  ownPubkeyHex: string,
): void {
  if (envelope.outcome !== "decrypted" || envelope.payload === undefined) return;
  if (commercePrivatePaymentEvidenceAppliedEventIds.has(envelope.eventId)) return;

  const m = requireModules();
  const state = commerceState();
  const localOrder = state.orders.findById(envelope.payload.orderId);
  // THE one "not yet" case on this channel -- deliberately NOT retired
  // from the dedup set (see that Set's own comment): the order-sync event
  // that materializes this order locally may still arrive.
  if (localOrder === undefined) return;

  const retire = (): void => {
    commercePrivatePaymentEvidenceAppliedEventIds.add(envelope.eventId);
  };
  const expectation = commercePaymentEvidenceExpectationFor(localOrder, ownPubkeyHex);
  // This process has no standing to accept payment evidence for an order
  // it is not the seller of -- a settled verdict, never an early one.
  if (expectation === null) return retire();
  // Extra receiver check the Port's own expectation shape has no field for:
  // the product this payment claims to be for must be THIS order's product.
  if (envelope.payload.productId !== localOrder.productId) return retire();

  // The settlement ledger REJECTS evidence for a paymentId it never
  // `bind()`-ed (`PaymentSettlementLedger.apply()`), and this process --
  // the seller's -- never ran `handleCommercePaymentRequest`, so it has no
  // binding for the buyer's paymentId. Register one first, using only THIS
  // process's own local order id/productId (never the wire's), so the
  // subsequent apply is judged against a binding this process authored.
  // `bind()` throws on a duplicate paymentId, so it is only ever called
  // when the ledger genuinely has nothing for it; a paymentId already
  // bound to a DIFFERENT order is left alone and `applySettlementEvidence()`
  // rejects it as "wrong-order evidence" rather than being rebound here.
  const paymentId = (envelope.payload as { readonly paymentId?: unknown }).paymentId;
  if (typeof paymentId !== "string" || paymentId.length === 0) return retire();
  if (state.ledger.get(paymentId) === undefined) {
    try {
      state.ledger.bind(paymentId, localOrder.id, localOrder.productId);
    } catch (err) {
      // An UNEXPECTED failure (the duplicate-paymentId case is already
      // excluded by the `get()` guard above), so it is not a semantic
      // verdict -- left eligible rather than retired, in line with "only
      // record an id once the apply genuinely resolved".
      console.error("fedos-beta: inbound PaymentEvidence -- settlement bind failed (non-fatal, event left eligible for the next refresh):", err);
      return;
    }
  }

  const applied = m.CommerceNostr.applyInboundPaymentEvidenceSync(envelope.senderPubkeyHex, envelope.payload, expectation, state.ledger);
  if (!applied.accepted) {
    // Every rejection reason `applyInboundPaymentEvidenceSync()` can
    // produce (malformed payload, wrong sender, wrong order, wrong
    // amount/currency, non-authoritative source, wrong provider identity)
    // is a fixed property of these exact bytes -- none of them can start
    // passing because local state advanced. Retired.
    console.error("fedos-beta: inbound PaymentEvidence rejected by receiver validation (non-fatal, ledger untouched):", applied.reason);
    return retire();
  }
  // Accepted by every receiver gate and handed to the ledger, which is
  // this channel's real replay authority: whatever it decided
  // (`transitioned`/`no_op`/`rejected`) is final for these bytes, so the
  // event is retired here regardless of what the Order does below.
  //
  // KNOWN NARROW RESIDUAL (documented, not worked around): if the ledger
  // TRANSITIONS but this process's local Order is not yet `"accepted"`,
  // the Order cannot follow and a later refresh cannot recover it (the
  // ledger would `no_op`). Unreachable on the real path -- the seller's
  // own accept is what lets the buyer pay at all, and it is durable -- and
  // fixing it properly means re-deriving the Order transition from the
  // ledger's own settled state, which is a deliberate authority-model
  // change, not a dedup fix.
  retire();
  // Only a genuine ledger TRANSITION may move the Order -- never a
  // `no_op` (duplicate/idempotent) and never a `rejected`. This is the
  // second and last place in this file that constructs a
  // `{ kind: "payment_evidence" }` order actor, and like
  // `handleCommercePaymentSimulate` it does so only AFTER the settlement
  // ledger has independently agreed.
  if (applied.result.outcome !== "transitioned") return;
  const now = Math.floor(Date.now() / 1000);
  const paymentEvidenceAction: Record<string, unknown> = {
    type: "confirm_payment",
    actor: { kind: "payment_evidence" },
    evidence: { orderId: localOrder.id, paymentId, status: "settled", observedAt: now },
  };
  const orderResult = m.Commerce.applyOrderAction(localOrder, paymentEvidenceAction as CommerceOrderActionLike, now);
  if (orderResult.ok && orderResult.order !== undefined) state.orders.save(orderResult.order);
}

/**
 * The receive-side counterpart of
 * `commercePrivateDeliveryDiscoverAndApplyNonFatal()`, for payment-evidence
 * events. Called from the same bounded reliable-refresh points, and always
 * BEFORE the Delivery pass -- a Delivery event's own reconciliation
 * depends on whether this process's Order has already reached a
 * payment-confirmed status (`applyInboundPrivateDeliverySyncNonFatal()`'s
 * `orderPaymentConfirmed`), so payment must land first or a legitimate
 * "fulfilling" event would be dropped and never retried within the pass.
 */
async function commercePrivatePaymentEvidenceDiscoverAndApplyNonFatal(): Promise<void> {
  if (commerceNetworkProfile === "local-only") return;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return;
  const relayUrl = activeRelays[0]?.url;
  if (relayUrl === undefined || relayUrl.length === 0) return;

  const m = requireModules();
  const signer = activeNostrSigningAuthority;
  const nip44Wire = activeMasterSeedAuthority;
  try {
    const ownIdentity = await signer.publicIdentityForAccount(COMMERCE_NOSTR_ACCOUNT_INDEX);
    if (ownIdentity === null) return;
    const subscriber = new m.CommerceNostr.WebSocketRelayAdapter(relayUrl, {
      factory: m.createNodeWebSocketRelaySocketFactory(),
      timeoutMs: COMMERCE_NOSTR_DISCOVERY_TIMEOUT_MS,
    });
    const events = await subscriber.query([
      { kinds: [1], "#t": [m.CommerceNostr.COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG], "#p": [ownIdentity.publicKeyHex], limit: COMMERCE_NOSTR_DISCOVERY_EVENT_LIMIT },
    ]);
    const ordered = [...events].sort((a, b) => {
      const aAt = typeof (a as { created_at?: unknown })?.created_at === "number" ? (a as { created_at: number }).created_at : 0;
      const bAt = typeof (b as { created_at?: unknown })?.created_at === "number" ? (b as { created_at: number }).created_at : 0;
      return aAt - bAt;
    });
    for (const event of ordered) {
      try {
        const envelope = await m.CommerceNostr.verifyAndDecryptInboundPrivatePaymentEvidenceEnvelope(event, {
          nip44Wire,
          localAccountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
        });
        applyInboundPrivatePaymentEvidenceNonFatal(envelope, ownIdentity.publicKeyHex);
      } catch (err) {
        console.error("fedos-beta: private PaymentEvidence sync -- one candidate event failed to decrypt/apply (non-fatal, skipped):", err);
      }
    }
  } catch (err) {
    console.error("fedos-beta: private PaymentEvidence sync discovery query failed (non-fatal, local settlement state unaffected):", err);
  }
}

// ---------------------------------------------------------------------
// BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- the
// FOURTH private-sync channel: `MediaAccessGrant` release request/response.
// Structurally mirrors the Delivery/PaymentEvidence sections immediately
// above (same lazy transport construction, same process-lifetime dedup
// discipline), but this channel is request/response, not one-directional
// assertion -- see `commerce_private_media_release_sync.ts`'s own header
// for why. `handleCommerceMediaGrantRedeem()` (below) is the ONE real
// production caller that ties both directions into the buyer-facing
// "Open Purchased Content" UI action.
// ---------------------------------------------------------------------

interface CommercePrivateMediaReleaseRequestTransportLike {
  send(
    payload: unknown,
    counterpartyPublicKeyHex: string,
  ): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }>;
}
interface CommercePrivateMediaReleaseTransportLike {
  send(
    payload: unknown,
    counterpartyPublicKeyHex: string,
  ): Promise<{ readonly accepted: boolean; readonly eventId: string; readonly message: string }>;
}

let commercePrivateMediaReleaseRequestTransport: CommercePrivateMediaReleaseRequestTransportLike | null = null;
let commercePrivateMediaReleaseRequestTransportProfileRef: CommerceNetworkProfileValue | null = null;
let commercePrivateMediaReleaseRequestTransportSignerRef: NostrSigningAuthorityLike | null = null;
let commercePrivateMediaReleaseTransport: CommercePrivateMediaReleaseTransportLike | null = null;
let commercePrivateMediaReleaseTransportProfileRef: CommerceNetworkProfileValue | null = null;
let commercePrivateMediaReleaseTransportSignerRef: NostrSigningAuthorityLike | null = null;
/** Process-lifetime dedup of inbound REQUEST event ids this process (as seller) has already answered -- never re-answered on a later poll (re-answering would mint no new state, but WOULD needlessly re-wrap/re-encrypt; a buyer who wants a fresh answer sends a fresh request, which gets a fresh event id). */
const commercePrivateMediaReleaseRequestAppliedEventIds = new Set<string>();
/** Process-lifetime dedup of inbound RESPONSE event ids this process (as buyer) has already applied. */
const commercePrivateMediaReleaseAppliedEventIds = new Set<string>();
/**
 * Best-effort, in-memory-only (never durable -- purely a UX hint, never an
 * authority) record of the LAST outcome this buyer process observed for a
 * given `(orderId, mediaId, buyerPubkey)` triple that was NOT a successful
 * `"verified"` release (that case is already durably reflected by
 * `commerceMediaReleaseContentCacheState().hasRelease()`). Lets
 * `handleCommerceMediaGrantRedeem()` surface a truthful, specific denial
 * reason instead of an indefinite "pending" when a definitive answer has
 * already arrived -- this arc's own mandate item 4.
 */
const commerceMediaReleaseLastKnownDenial = new Map<string, { readonly reason: string; readonly at: number }>();
function mediaReleaseDenialKey(orderId: string, mediaId: string, buyerPubkey: string): string {
  return `${orderId} ${mediaId} ${buyerPubkey}`;
}

function commercePrivateMediaReleaseRequestTransportFor(): CommercePrivateMediaReleaseRequestTransportLike | null {
  if (commerceNetworkProfile === "local-only") return null;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return null;
  const m = requireModules();
  if (
    commercePrivateMediaReleaseRequestTransport === null ||
    commercePrivateMediaReleaseRequestTransportProfileRef !== commerceNetworkProfile ||
    commercePrivateMediaReleaseRequestTransportSignerRef !== activeNostrSigningAuthority
  ) {
    const relayUrl = activeRelays[0]?.url ?? "";
    const relayPublisher = new m.CommerceNostr.WebSocketRelayPublisher(relayUrl, { factory: m.createNodeWebSocketRelaySocketFactory() });
    commercePrivateMediaReleaseRequestTransport = new m.CommerceNostr.RealCommercePrivateMediaReleaseRequestTransport({
      signingAuthority: activeNostrSigningAuthority,
      relayPublisher,
      nip44Wire: activeMasterSeedAuthority,
      accountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
    });
    commercePrivateMediaReleaseRequestTransportProfileRef = commerceNetworkProfile;
    commercePrivateMediaReleaseRequestTransportSignerRef = activeNostrSigningAuthority;
  }
  return commercePrivateMediaReleaseRequestTransport;
}

function commercePrivateMediaReleaseTransportFor(): CommercePrivateMediaReleaseTransportLike | null {
  if (commerceNetworkProfile === "local-only") return null;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return null;
  const m = requireModules();
  if (
    commercePrivateMediaReleaseTransport === null ||
    commercePrivateMediaReleaseTransportProfileRef !== commerceNetworkProfile ||
    commercePrivateMediaReleaseTransportSignerRef !== activeNostrSigningAuthority
  ) {
    const relayUrl = activeRelays[0]?.url ?? "";
    const relayPublisher = new m.CommerceNostr.WebSocketRelayPublisher(relayUrl, { factory: m.createNodeWebSocketRelaySocketFactory() });
    commercePrivateMediaReleaseTransport = new m.CommerceNostr.RealCommercePrivateMediaReleaseTransport({
      signingAuthority: activeNostrSigningAuthority,
      relayPublisher,
      nip44Wire: activeMasterSeedAuthority,
      accountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
    });
    commercePrivateMediaReleaseTransportProfileRef = commerceNetworkProfile;
    commercePrivateMediaReleaseTransportSignerRef = activeNostrSigningAuthority;
  }
  return commercePrivateMediaReleaseTransport;
}

/** Buyer-side: best-effort, non-fatal request send. Never throws; a failure here just means the buyer's own next poll (or explicit retry) tries again. */
async function sendPrivateMediaReleaseRequestNonFatal(
  orderId: string,
  mediaId: string,
  buyerPubkey: string,
  sellerPubkey: string,
  now: number,
): Promise<string> {
  const transport = commercePrivateMediaReleaseRequestTransportFor();
  if (transport === null) return "network-disabled";
  try {
    const payload = { category: "private-media-release-request", formatVersion: 1, orderId, mediaId, buyerPubkey, sellerPubkey, at: now };
    const result = await transport.send(payload, sellerPubkey);
    if (result.accepted) return "published";
    return result.message.length > 0 ? result.message : "transport-error";
  } catch (err) {
    console.error("fedos-beta: private media-release REQUEST send failed (non-fatal):", err);
    return "transport-error";
  }
}

/** Seller-side: best-effort, non-fatal response send. */
async function sendPrivateMediaReleaseResponseNonFatal(payload: CommercePrivateMediaReleasePayloadLike, recipientPubkeyHex: string): Promise<string> {
  const transport = commercePrivateMediaReleaseTransportFor();
  if (transport === null) return "network-disabled";
  try {
    const result = await transport.send(payload, recipientPubkeyHex);
    if (result.accepted) return "published";
    return result.message.length > 0 ? result.message : "transport-error";
  } catch (err) {
    console.error("fedos-beta: private media-release RESPONSE send failed (non-fatal):", err);
    return "transport-error";
  }
}

/**
 * Seller-side: turns ONE already-decrypted, already-signature-verified
 * inbound `private-media-release-request` envelope into a real response,
 * via `buildOutboundPrivateMediaReleaseResponse()` (the fixed-gate-order
 * orchestration -- see that function's own header), and sends it back.
 * Never throws; any internal failure is a silent, safe drop -- the buyer's
 * own request stays eligible to be answered on a LATER poll (this process
 * never wrote the event id into the dedup set in that case).
 */
async function applyInboundPrivateMediaReleaseRequestNonFatal(envelope: {
  readonly outcome: string;
  readonly eventId: string;
  readonly senderPubkeyHex: string;
  readonly payload?: { readonly orderId: string; readonly mediaId: string; readonly buyerPubkey: string; readonly sellerPubkey: string; readonly at: number };
}): Promise<void> {
  if (envelope.outcome !== "decrypted" || envelope.payload === undefined) return;
  if (commercePrivateMediaReleaseRequestAppliedEventIds.has(envelope.eventId)) return;
  if (activeMasterSeedAuthority === null || activeNostrSigningAuthority === null) return;

  const payload = envelope.payload;
  try {
    const m = requireModules();
    const ownIdentity = await activeNostrSigningAuthority.publicIdentityForAccount(COMMERCE_NOSTR_ACCOUNT_INDEX);
    if (ownIdentity === null) return;

    const state = commerceState();
    const order = state.orders.findById(payload.orderId);
    const media = order === undefined ? undefined : commerceProductMediaState().listForProduct(order.productId).find((item) => item.id === payload.mediaId);

    const grantState = commerceMediaGrantState();
    const allGrants = grantState.persistence.listGrants();
    const latestVersion = order === undefined ? 0 : m.Commerce.latestGrantVersion(allGrants, payload.mediaId, payload.buyerPubkey, order.id);
    const candidate = allGrants.find(
      (entry) =>
        entry.payload.mediaId === payload.mediaId &&
        entry.payload.buyerPubkey === payload.buyerPubkey &&
        entry.payload.orderId === payload.orderId &&
        entry.payload.grantVersion === latestVersion,
    );

    const now = Math.floor(Date.now() / 1000);
    const response = await m.CommerceNostr.buildOutboundPrivateMediaReleaseResponse({
      requestPayload: payload,
      senderPubkeyHex: envelope.senderPubkeyHex,
      ownPubkeyHex: ownIdentity.publicKeyHex,
      order: order === undefined ? undefined : { id: order.id, productId: order.productId, buyerPubkey: order.buyerPubkey, sellerPubkey: order.sellerPubkey, status: order.status },
      media:
        media === undefined || media.classification !== "protected"
          ? undefined
          : { id: media.id, productId: media.productId, classification: media.classification, storageRef: media.storageRef, contentType: media.contentType, checksum: media.checksum },
      candidateGrantEnvelope: candidate,
      latestKnownGrantVersion: latestVersion,
      // Real Digital Delivery mega-arc (Agent G, Grant Custody pass) --
      // certifies exactly the delegate key that ACTUALLY signed the
      // candidate grant (its own `issuerPubkey`), never a freshly-resolved
      // key that might not match -- `evaluateMediaAccessGrant()`'s
      // "wrong-signer" check requires the two to agree exactly. `[]` when
      // there is no candidate grant at all, or no Order -- the evaluation
      // step below denies on its own pre-existing, correct grounds either way.
      sellerAuthorizedDelegateSigningKeys:
        order === undefined || candidate === undefined ? [] : await commerceCertifyMediaGrantDelegateSigningKey(candidate.payload.issuerPubkey, order.sellerPubkey, now),
      now,
      merchantAccountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
      authority: activeMasterSeedAuthority,
      // Real Digital Delivery mega-arc (Agent G, Grant Custody pass) --
      // fixes a second, independent, pre-existing gap in this same call:
      // `getStoredCiphertextChecksum` was never supplied at all (the
      // function would throw calling it), and `media.checksum` above was
      // never populated either -- together these meant every real request
      // through this path was unreachable/permanently denied regardless of
      // the grant-signer fix. `metadata()` is the sync, non-network-gated
      // lookup this callback needs (see `CommerceMediaStoreLike`'s own
      // comment).
      getStoredCiphertextChecksum: (storageRef) => commerceMediaStoreFor().metadata(storageRef)?.checksum ?? null,
      getProtectedContent: (storageRef) => commerceMediaStoreFor().getProtected(storageRef),
    });

    // CROSS-PROCESS COMPLETION SYNC mega-arc (Coordinator) -- durably record
    // that THIS process (the seller) genuinely built a verified release for
    // this exact (orderId, mediaId, buyerPubkey) triple, BEFORE attempting
    // to send it -- `response.outcome === "released"` is only ever reached
    // after `buildOutboundPrivateMediaReleaseResponse()` has already
    // independently verified authorization, the grant, the content-identity
    // checksum, and a genuine decrypt+re-wrap (see that function's own
    // header, steps 1-4). This is closing Finding 1 -- see
    // `applyInboundPrivateOrderSyncNonFatal()`'s own comment for how this
    // record is later consulted. Recorded regardless of whether the send
    // itself succeeds: the seller genuinely DID build a real release either
    // way, and a transient send failure is already independently retried by
    // the buyer's own next request (a fresh request, a fresh event id).
    if (response.outcome === "released") {
      commerceMediaReleaseIssuanceLogState().recordIssuance({
        orderId: response.orderId,
        mediaId: response.mediaId,
        buyerPubkey: response.buyerPubkey,
        sellerPubkey: response.sellerPubkey,
        grantVersion: response.grantVersion,
        contentDigest: response.contentDigest,
        issuedAt: now,
      });
    }

    commercePrivateMediaReleaseRequestAppliedEventIds.add(envelope.eventId);
    await sendPrivateMediaReleaseResponseNonFatal(response, payload.buyerPubkey);
  } catch (err) {
    console.error("fedos-beta: private media-release request handling failed (non-fatal, request stays eligible for a later poll):", err);
  }
}

/**
 * Buyer-side: applies ONE already-decrypted, already-signature-verified
 * inbound `private-media-release` RESPONSE envelope via
 * `applyInboundPrivateMediaReleaseResponse()`. On `"verified"`, durably
 * persists the digest-checked release (restart-survival, this arc's own
 * mandate item 6). On any other outcome, records a truthful, bounded
 * denial hint for `handleCommerceMediaGrantRedeem()` to surface -- never
 * silently dropped.
 */
async function applyInboundPrivateMediaReleaseResponseNonFatal(envelope: {
  readonly outcome: string;
  readonly eventId: string;
  readonly senderPubkeyHex: string;
  readonly payload?: CommercePrivateMediaReleasePayloadLike;
}): Promise<void> {
  if (envelope.outcome !== "decrypted" || envelope.payload === undefined) return;
  if (commercePrivateMediaReleaseAppliedEventIds.has(envelope.eventId)) return;
  if (activeMasterSeedAuthority === null || activeNostrSigningAuthority === null) return;

  const payload = envelope.payload;
  try {
    const m = requireModules();
    const ownIdentity = await activeNostrSigningAuthority.publicIdentityForAccount(COMMERCE_NOSTR_ACCOUNT_INDEX);
    if (ownIdentity === null) return;
    const order = commerceState().orders.findById(payload.orderId);
    if (order === undefined) return; // out of order -- may still arrive on a later poll once the local Order materializes

    const applied = await m.CommerceNostr.applyInboundPrivateMediaReleaseResponse({
      payload,
      senderPubkeyHex: envelope.senderPubkeyHex,
      ownPubkeyHex: ownIdentity.publicKeyHex,
      order: { id: order.id, sellerPubkey: order.sellerPubkey },
      expectedMediaId: payload.mediaId,
      buyerAccountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
      authority: activeMasterSeedAuthority,
    });

    commercePrivateMediaReleaseAppliedEventIds.add(envelope.eventId);
    const denialKey = mediaReleaseDenialKey(payload.orderId, payload.mediaId, payload.buyerPubkey);
    if (applied.outcome === "verified") {
      commerceMediaReleaseContentCacheState().putRelease(applied.record);
      commerceMediaReleaseLastKnownDenial.delete(denialKey);
    } else {
      const reason = applied.outcome === "denied" || applied.outcome === "unauthorized" ? applied.reason : applied.outcome;
      commerceMediaReleaseLastKnownDenial.set(denialKey, { reason, at: payload.at });
    }
  } catch (err) {
    console.error("fedos-beta: private media-release response handling failed (non-fatal):", err);
  }
}

/** Seller-side discovery: mirrors `commercePrivateDeliveryDiscoverAndApplyNonFatal()`'s own shape exactly, subscribing to REQUEST events addressed to this process's own identity. */
async function commercePrivateMediaReleaseRequestDiscoverAndRespondNonFatal(): Promise<void> {
  if (commerceNetworkProfile === "local-only") return;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return;
  const relayUrl = activeRelays[0]?.url;
  if (relayUrl === undefined || relayUrl.length === 0) return;

  const m = requireModules();
  const signer = activeNostrSigningAuthority;
  const nip44Wire = activeMasterSeedAuthority;
  try {
    const ownIdentity = await signer.publicIdentityForAccount(COMMERCE_NOSTR_ACCOUNT_INDEX);
    if (ownIdentity === null) return;
    const subscriber = new m.CommerceNostr.WebSocketRelayAdapter(relayUrl, {
      factory: m.createNodeWebSocketRelaySocketFactory(),
      timeoutMs: COMMERCE_NOSTR_DISCOVERY_TIMEOUT_MS,
    });
    const events = await subscriber.query([
      { kinds: [1], "#t": [m.CommerceNostr.COMMERCE_PRIVATE_MEDIA_RELEASE_REQUEST_TAG], "#p": [ownIdentity.publicKeyHex], limit: COMMERCE_NOSTR_DISCOVERY_EVENT_LIMIT },
    ]);
    const ordered = [...events].sort((a, b) => {
      const aAt = typeof (a as { created_at?: unknown })?.created_at === "number" ? (a as { created_at: number }).created_at : 0;
      const bAt = typeof (b as { created_at?: unknown })?.created_at === "number" ? (b as { created_at: number }).created_at : 0;
      return aAt - bAt;
    });
    for (const event of ordered) {
      try {
        const envelope = await m.CommerceNostr.verifyAndDecryptInboundPrivateMediaReleaseRequestEnvelope(event, {
          nip44Wire,
          localAccountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
        });
        await applyInboundPrivateMediaReleaseRequestNonFatal(envelope);
      } catch (err) {
        console.error("fedos-beta: private media-release REQUEST discovery -- one candidate event failed (non-fatal, skipped):", err);
      }
    }
  } catch (err) {
    console.error("fedos-beta: private media-release REQUEST discovery query failed (non-fatal):", err);
  }
}

/** Buyer-side discovery: mirrors the REQUEST discovery function immediately above, for RESPONSE events. */
async function commercePrivateMediaReleaseDiscoverAndApplyNonFatal(): Promise<void> {
  if (commerceNetworkProfile === "local-only") return;
  if (activeNostrSigningAuthority === null || activeRelays.length === 0 || activeMasterSeedAuthority === null) return;
  const relayUrl = activeRelays[0]?.url;
  if (relayUrl === undefined || relayUrl.length === 0) return;

  const m = requireModules();
  const signer = activeNostrSigningAuthority;
  const nip44Wire = activeMasterSeedAuthority;
  try {
    const ownIdentity = await signer.publicIdentityForAccount(COMMERCE_NOSTR_ACCOUNT_INDEX);
    if (ownIdentity === null) return;
    const subscriber = new m.CommerceNostr.WebSocketRelayAdapter(relayUrl, {
      factory: m.createNodeWebSocketRelaySocketFactory(),
      timeoutMs: COMMERCE_NOSTR_DISCOVERY_TIMEOUT_MS,
    });
    const events = await subscriber.query([
      { kinds: [1], "#t": [m.CommerceNostr.COMMERCE_PRIVATE_MEDIA_RELEASE_TAG], "#p": [ownIdentity.publicKeyHex], limit: COMMERCE_NOSTR_DISCOVERY_EVENT_LIMIT },
    ]);
    const ordered = [...events].sort((a, b) => {
      const aAt = typeof (a as { created_at?: unknown })?.created_at === "number" ? (a as { created_at: number }).created_at : 0;
      const bAt = typeof (b as { created_at?: unknown })?.created_at === "number" ? (b as { created_at: number }).created_at : 0;
      return aAt - bAt;
    });
    for (const event of ordered) {
      try {
        const envelope = await m.CommerceNostr.verifyAndDecryptInboundPrivateMediaReleaseEnvelope(event, {
          nip44Wire,
          localAccountIndex: COMMERCE_NOSTR_ACCOUNT_INDEX,
        });
        await applyInboundPrivateMediaReleaseResponseNonFatal(envelope);
      } catch (err) {
        console.error("fedos-beta: private media-release RESPONSE discovery -- one candidate event failed (non-fatal, skipped):", err);
      }
    }
  } catch (err) {
    console.error("fedos-beta: private media-release RESPONSE discovery query failed (non-fatal):", err);
  }
}

function requireModules(): RootModules {
  if (modules === null) throw new Error("fedos-beta: root modules not loaded");
  return modules;
}

function baseTrayMenuItems(): readonly FedosElectronBadgeTrayMenuItemLike[] {
  return requireModules().fedosDesktopTrayMenuItems();
}

/** Forwards a clicked Tray action's own string to `TrayCoordinator.dispatch()`, then refreshes the badge (mirrors `fedos_electron_badge_main.cts`'s own `handleTrayAction`). */
async function handleTrayAction(candidate: unknown): Promise<unknown> {
  if (activeAssembly === null) return { action: "rejected", outcome: "unavailable", reason: "no profile is unlocked" };
  const outcome = await activeAssembly.trayCoordinator.dispatch(candidate);
  if (outcome.action === "exit") {
    await performCleanShutdown();
  } else {
    void activeAssembly.badgeCoordinator.refresh();
  }
  return outcome;
}

function onTrayMenuAction(action: string): void {
  void handleTrayAction({ action });
}

function refreshTrayMenu(): void {
  if (!trayCreated) return;
  trayAdapter.render(baseTrayMenuItems(), onTrayMenuAction);
}

/**
 * Secure Runtime Alpha 5161-5240 — builds a fresh, independent Coordinator
 * (mirrors `fedos_electron_unlock_main.cts`'s own `buildFreshCoordinator()`
 * exactly), NOW ALSO constructing the ONE `FedosDeviceSyncEventBridge` for
 * this attempt and threading its `wrapAttemptFn()` into the Coordinator's
 * own additive `deviceSyncSchedulerEnabled`/`deviceSyncAttemptFn`
 * dependencies (Phase E) — so the Runtime this Coordinator starts during
 * `createProfile()`/`unlockProfile()` has the Scheduler enabled from the
 * very first construction, never a second, later Runtime just to turn it on.
 *
 * Secure Runtime Alpha 6761-6840 — ALSO reads the SAME persisted Settings
 * descriptor `startAssembly()` already loads later (a second, independent,
 * stateless `.load()` of the same file-backed store — never a second
 * owner: neither call holds any state, both just re-read the one durable
 * file), BEFORE constructing the Coordinator, so a genuinely user-
 * configured `relays` list can be threaded into Runtime construction
 * itself (the ONLY point `conversationTransportRelays` can ever be set —
 * `relays`/`defaultRelay` are classified `runtime-restart` by this
 * repository's own `fedos_settings_application_class.ts`, exactly because
 * `FedosConversationRelaySet` is immutable after construction). When
 * `relays.length > 0`, real `WebSocketRelay` instances (Node's own global
 * `WebSocket`, no mock, no `NullRelay`) are constructed for each
 * configured URL and `privateTransportEnabled`/`directRatchetEnabled`/
 * `peerCapabilityEnabled`/`identityTransitionEnabled`/`deletionRequestEnabled`
 * are enabled — the SAME conservative, never-auto-accept policy values
 * `test/secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`
 * already establishes, reused verbatim, never a new policy. When NO relay
 * is configured (the honest default on every fresh profile), every one of
 * these stays disabled — never a fabricated placeholder relay, matching
 * this Arc's own "no fake Relay configuration" rule; the user must
 * genuinely configure a relay via Settings, then relaunch (the existing,
 * accepted `runtime-restart` UX this repository already reports), before
 * these subsystems activate.
 */
async function buildFreshCoordinator(): Promise<{
  coordinator: CoordinatorLike;
  masterSeedAuthority: MasterSeedAuthorityLike;
  eventBridge: DeviceSyncEventBridgeLike;
  /** FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- the SAME real
   * Nostr signing authority `secureRuntimeBundleConfig()` already threads
   * into Direct Ratchet/Conversation Transport below, additionally
   * returned here so a successful create/unlock can retain it as
   * `activeNostrSigningAuthority` -- the one collaborator
   * `RealCommerceNostrEventTransport` needs that this function already
   * constructs but previously never surfaced past its own local scope. */
  signer: NostrSigningAuthorityLike;
} | null> {
  const m = requireModules();
  const attestation = m.createElectronMainHostAttestation({ appId: APP_ID, appVersion: APP_VERSION });
  // Commerce Product-Media Sync + Truthful Completion mega-arc (Agent S
  // Task 3 / Wave B) — gate FEDOS_ELECTRON_BETA_ARTIFACT_DIR behind an
  // explicit test-mode signal (never honored unconditionally in a normal
  // production launch) and pin the expected crate identity, closing the
  // previously-unexploited "self-consistent but unanchored" verification
  // gap. See fedos_production_wasm_artifact_verify_before_execute.ts.
  const artifactDirDecision = m.fedosResolveProductionArtifactDir({
    overrideArtifactDirEnvValue: process.env.FEDOS_ELECTRON_BETA_ARTIFACT_DIR,
    testGateActive: AUTOTEST_MODE.length > 0,
    defaultArtifactDir: artifactDir(),
  });
  if (artifactDirDecision.outcome === "override-rejected-not-test-gated") {
    recordDiagnosticEvent("artifact-dir-override-rejected", { reason: artifactDirDecision.reason });
  }
  const activation = await m.activateFedosProductionProfileMasterSeed({
    attestation,
    artifactDir: artifactDirDecision.artifactDir,
    expectedCrate: m.fedosExpectedProductionWasmCrate(),
    importGlue: (specifier: string) => import(pathToFileURL(specifier).href),
  });
  if (activation.outcome !== "activated") {
    console.error(`fedos-beta: production activation blocked (${activation.decision})`);
    return null;
  }
  const masterSeedAuthority = activation.masterSeedAuthority;
  const signer = new m.NostrSigningAuthority(masterSeedAuthority) as NostrSigningAuthorityLike;
  const paths = m.planFedosLocalProfilePaths(dataDir());
  if (paths === null) return null;
  m.ensureFedosLocalProfileDirectories(paths);
  // The event bridge's own listener reads `activeAssembly` (set only AFTER a successful
  // create/unlock + startAssembly()) -- identical indirection to `fedos_electron_badge_main.cts`'s
  // own `wiring`/`eventBridge` pair, since the Wiring itself cannot exist before the assembly does.
  const eventBridge = new m.DeviceSyncEventBridge({
    listener: (event) => {
      if (activeAssembly !== null) void activeAssembly.deviceSyncPresentationWiring.handleEvent(event);
    },
    abandonmentMaxAttempts: DEVICE_SYNC_ABANDONMENT_POLICY.maxAttempts,
  });
  const secureRuntimeBundle = secureRuntimeBundleConfig(m, signer);
  const coordinator = new m.Coordinator({
    paths,
    profilePersistence: new m.ProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new m.SealedSeedPersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority,
    accountSigningAuthority: signer,
    deviceSyncSchedulerEnabled: true,
    deviceSyncAbandonmentPolicy: DEVICE_SYNC_ABANDONMENT_POLICY,
    deviceSyncAttemptFn: eventBridge.wrapAttemptFn(),
    ...secureRuntimeBundle,
  });
  return { coordinator, masterSeedAuthority, eventBridge, signer };
}

/**
 * Secure Runtime Alpha 6761-6840 — reads the persisted Settings descriptor's
 * own `relays` (real, user-configured relay URLs only) and returns the
 * additive Coordinator dependency fields that activate Direct Ratchet /
 * Peer Capability / Identity Transition / Deletion Request, or an empty
 * object when no relay is configured (fail closed, never fabricated).
 * Pure with respect to Runtime/Electron state; its only side effect is one
 * stateless settings-file read.
 */
function secureRuntimeBundleConfig(m: RootModules, signer: unknown): Record<string, unknown> {
  const settingsController = m.createFileBackedSettingsController(settingsFilePath());
  const loaded = settingsController.load();
  const relayUrls = loaded.outcome === "ok" && loaded.value !== undefined ? loaded.value.relays : [];
  if (relayUrls.length === 0) {
    console.log("fedos-beta: no relay configured in Settings -- Direct Ratchet/Peer Capability/Identity Transition/Deletion Request stay honestly disabled until the user configures one and relaunches.");
    return {};
  }
  const socketFactory = m.createNodeWebSocketRelaySocketFactory();
  const relays = relayUrls.map((url) => new m.WebSocketRelay(url, socketFactory));
  // Secure Runtime Alpha 8121-8200 -- captured here (the ONE real
  // construction site) so the ordinary UI can honestly report per-Relay
  // connectivity later. Safe even though this function is also called by
  // the throwaway status-check path (`handleStatus()`'s own
  // `buildFreshCoordinator()` call, which never starts a real Runtime and
  // is always discarded): by the time any `fedos-app:*` command reads
  // `activeRelays` (gated on a real unlocked profile), a real
  // `handleCreate()`/`handleUnlock()` success is guaranteed to have run
  // this same line last, since each attempt calls this function exactly
  // once and only a successful attempt ever sets `activeAssembly`.
  activeRelays = relays;
  // Secure Runtime Alpha 7001-7080 -- see `FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef`'s
  // own doc comment. TEST-INJECTION ONLY, mirrors `AUTOTEST_SECRET`'s own
  // discipline exactly -- unset on every ordinary launch, so `sendMessage()`
  // keeps using the legacy static route for every real user by default.
  const messageDeliveryRemoteDeviceRef = process.env.FEDOS_BETA_DIRECT_RATCHET_MESSAGE_DELIVERY_REMOTE_DEVICE_REF;
  // Verified Secure Session UI mega-arc (Coordinator) -- captured here (the
  // SAME real read site as the config value immediately below) so
  // `boundary.securityState` can be told the exact same value right after
  // `activeAssembly` is set -- see the two `activeAssembly = assembly;`
  // call sites below.
  activeMessageDeliveryRemoteDeviceRef = messageDeliveryRemoteDeviceRef !== undefined && messageDeliveryRemoteDeviceRef.length > 0 ? messageDeliveryRemoteDeviceRef : null;
  return {
    privateTransportEnabled: true,
    conversationTransportRelays: relays,
    conversationTransportSigningAuthority: signer,
    directRatchetEnabled: true,
    directRatchetMessageDeliveryRemoteDeviceRef: messageDeliveryRemoteDeviceRef !== undefined && messageDeliveryRemoteDeviceRef.length > 0 ? messageDeliveryRemoteDeviceRef : undefined,
    peerCapabilityEnabled: true,
    peerCapabilityLocallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
    // FedOS Peer Device Discovery Arc -- mirrors peerCapabilityEnabled's
    // own activation condition exactly (same relay-configured gate). The
    // durable identity file path itself is sourced from `paths` inside
    // `FedosProfileInitializationCoordinator#buildRuntimeConfig()`
    // (mirrors `peerCapabilityObservationLogPath`'s own identical
    // "path threaded from `paths`, not from this function" convention)
    // -- this local device's own announced identity is stable across
    // restarts.
    peerDeviceAnnouncementEnabled: true,
    peerDeviceAnnouncementLocallySupportedCapabilities: [],
    identityTransitionEnabled: true,
    identityTransitionLocalPolicy: { autoAcceptOldKeyContinuity: false },
    deletionRequestEnabled: true,
    deletionRequestResolveLocalPolicy: () => "always-review",
    // Secure Runtime Alpha 7321-7400 -- these five flags already existed
    // on `FedosDesktopRuntimeConfig`/`FedosProfileInitializationDependencies`
    // (Alpha 7161-7240/7081-7160/1691-1760) and are already proven real,
    // no-substitution production-reachable by that Arc's own vertical
    // slice tests -- this canonical packaged entry point simply never
    // enabled them (Release Readiness Review, B-1/B-2/B-7). Enabling them
    // here is the direct fix: a real, packaged, unlocked profile can now
    // genuinely send an invitation, have it delivered over the real relay,
    // exchange real encrypted messages via the standard NIP-17 route, and
    // export/import a real Archive -- never merely "sent-locally".
    conversationCanonicalCryptoEnabled: true,
    conversationDirectMessageDeliveryRoute: "nostr-nip17-v1",
    conversationTransportInboundEnabled: true,
    conversationInvitationEnabled: true,
    archiveEnabled: true,
    // Secure Runtime Alpha 7321-7400 -- TEST-INJECTION ONLY, mirrors
    // `messageDeliveryRemoteDeviceRef`'s own identical discipline exactly:
    // unset on every ordinary launch, so a real user gets the Coordinator's
    // own real default production cadence. Lets this Arc's own real
    // packaged vertical slice test exchange several real messages within a
    // sane test time budget without waiting on that production cadence.
    conversationTransportIntervalMs: (() => {
      const raw = process.env.FEDOS_BETA_CONVERSATION_TRANSPORT_INTERVAL_MS;
      const parsed = raw !== undefined ? Number(raw) : NaN;
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    })(),
  };
}

/** Phase C/D/E — composes the ONE Shell/Boundary/Navigation/Tray/Badge/Background/DeviceSyncWiring + Settings Application Coordinator over the just-unlocked Runtime. Never called before a successful create/unlock. */
function startAssembly(coordinator: CoordinatorLike, readyView: ReadyView): AssemblyLike | null {
  const m = requireModules();
  const settingsController = m.createFileBackedSettingsController(settingsFilePath());
  badgeAdapter = new FedosElectronBadgeAdapter(trayAdapter, () => BrowserWindow.getAllWindows(), baseTrayMenuItems, onTrayMenuAction);
  const viewerParticipant: ParticipantRefLike = { authority: "nostr", publicIdentifier: readyView.accountPublicIdentifier, identityId: null };
  const result = m.BetaApplicationAssembly.start({
    coordinator,
    settingsController,
    notificationPort: notificationAdapter,
    badgePort: badgeAdapter,
    trayStatusSink: trayAdapter,
    viewerParticipant,
    navigationLogPath: navigationLogPath(),
  });
  if (result.outcome !== "ok" || !("value" in result)) {
    console.error(`fedos-beta: application assembly failed to start (${result.outcome})`);
    return null;
  }
  return result.value;
}

// ---------------------------------------------------------------------
// Payload validation — reused verbatim from fedos_electron_unlock_main.cts.
// ---------------------------------------------------------------------

function validatedLabel(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const keys = Object.keys(payload);
  if (!keys.every((k) => k === "label" || k === "secret")) return null;
  const label = (payload as { label?: unknown }).label;
  if (typeof label !== "string") return null;
  const trimmed = label.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LABEL_CHARS) return null;
  return trimmed;
}

function validatedSecretBytes(payload: unknown, allowedKeys: readonly string[]): Uint8Array | null {
  if (typeof payload !== "object" || payload === null) return null;
  const keys = Object.keys(payload);
  if (!keys.every((k) => allowedKeys.includes(k))) return null;
  const secret = (payload as { secret?: unknown }).secret;
  if (typeof secret !== "string" || secret.length === 0) return null;
  const bytes = new TextEncoder().encode(secret);
  if (bytes.length > MAX_SECRET_BYTES) {
    bytes.fill(0);
    return null;
  }
  return bytes;
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

// ---------------------------------------------------------------------
// Command handlers.
// ---------------------------------------------------------------------

function readyResult(view: ReadyView) {
  return {
    outcome: "ok" as const,
    ready: {
      displayLabel: view.displayLabel,
      accountPublicIdentifier: view.accountPublicIdentifier,
      localDeviceId: view.localDeviceId,
      deviceTrustState: view.deviceTrustState,
    },
  };
}

async function handleStatus(): Promise<StatusView> {
  if (activeCoordinator !== null) return sanitizeStatus(activeCoordinator.status());
  const built = await buildFreshCoordinator();
  if (built === null) return absentStatus();
  const detect = built.coordinator.detectProfileState();
  await built.masterSeedAuthority.clear();
  if (detect.outcome === "ok" && "value" in detect) return sanitizeStatus(detect.value);
  return absentStatus();
}

function absentStatus(): StatusView {
  return { lifecycleState: "absent", presence: "absent", displayLabel: null, accountPublicIdentifier: null, localDeviceId: null, runtimeRunning: false, recoveryReason: null };
}

function sanitizeStatus(view: StatusView): StatusView {
  return {
    lifecycleState: view.lifecycleState,
    presence: view.presence,
    displayLabel: view.displayLabel,
    accountPublicIdentifier: view.accountPublicIdentifier,
    localDeviceId: view.localDeviceId,
    runtimeRunning: view.runtimeRunning,
    recoveryReason: view.recoveryReason ?? null,
  };
}

/** Secure Runtime Alpha 5161-5240 — registers the ONE existing Beta window with the fresh Navigation Registry, creates the ONE shared Tray icon (idempotent), and renders its initial menu + badge. Called exactly once per successful create/unlock. */
async function attachPresentationLayer(assembly: AssemblyLike): Promise<void> {
  if (mainWindow !== null) {
    assembly.navigationRegistry.createWindow(String(mainWindow.id));
  }
  if (!trayCreated) {
    trayAdapter.create("FedOS Desktop Beta");
    trayCreated = true;
  }
  refreshTrayMenu();
  await assembly.badgeCoordinator.refresh();
}

async function handleCreate(payload: unknown) {
  // The "profile-lifecycle" group guard on this channel's registerHandle()
  // registration already serializes create/unlock/lock against each other —
  // see fedos_electron_ipc_command_registry.ts.
  if (activeCoordinator !== null) return { outcome: "already-exists", reason: "a profile is already active" };
  const label = validatedLabel(payload);
  const secretBytes = validatedSecretBytes(payload, ["label", "secret"]);
  if (label === null || secretBytes === null) {
    if (secretBytes !== null) secretBytes.fill(0);
    return { outcome: "invalid-input", reason: "malformed create request" };
  }
  try {
    const built = await buildFreshCoordinator();
    if (built === null) {
      secretBytes.fill(0);
      return { outcome: "seed-unavailable", reason: "production crypto unavailable" };
    }
    const secret = new (requireModules().UnlockSecret)(secretBytes);
    const result = await built.coordinator.createProfile({ displayLabel: label }, secret);
    if (result.outcome === "ok" && "value" in result) {
      const assembly = startAssembly(built.coordinator, result.value);
      if (assembly === null) {
        await built.coordinator.lock();
        return { outcome: "failed", reason: "profile created but application assembly failed to start" };
      }
      activeCoordinator = built.coordinator;
      activeAssembly = assembly;
      activeAssembly.boundary.securityState.setMessageDeliveryRemoteDeviceRef(activeMessageDeliveryRemoteDeviceRef);
      ipcCommands.bumpGeneration(); // a new assembly now exists — discard any stale-generation in-flight results
      activeViewerParticipant = { authority: "nostr", publicIdentifier: result.value.accountPublicIdentifier, identityId: null };
      activeLocalIdentity = { displayLabel: result.value.displayLabel, accountPublicIdentifier: result.value.accountPublicIdentifier };
      activeMasterSeedAuthority = built.masterSeedAuthority;
      activeNostrSigningAuthority = built.signer;
      // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- forces
      // `commerceMediaStoreFor()` to (re)construct NOW, against the real
      // authority/signer just activated above, rather than waiting for a
      // first caller that may never come this session -- proves the real
      // Master Seed Authority injection (and the outbound Nostr Port's
      // real signer/relay wiring) is genuinely live immediately on every
      // successful create/unlock, not merely "would be live if called".
      initializeCommerceNetworkProfileFromRelayConfig();
      commerceMediaStoreFor();
      commerceNostrOutboundPortFor();
      await attachPresentationLayer(assembly);
      return readyResult(result.value);
    }
    await built.masterSeedAuthority.clear();
    return { outcome: result.outcome, reason: "create did not complete" };
  } finally {
    // concurrency guard is now owned by ipcCommands' "profile-lifecycle" group
  }
}

async function handleUnlock(payload: unknown) {
  // The "profile-lifecycle" group guard on this channel's registerHandle()
  // registration already serializes create/unlock/lock against each other —
  // see fedos_electron_ipc_command_registry.ts.
  if (activeCoordinator !== null) return { outcome: "ok", reason: "already unlocked" };
  const secretBytes = validatedSecretBytes(payload, ["secret"]);
  if (secretBytes === null) return { outcome: "invalid-input", reason: "malformed unlock request" };
  try {
    const built = await buildFreshCoordinator();
    if (built === null) {
      secretBytes.fill(0);
      return { outcome: "seed-unavailable", reason: "production crypto unavailable" };
    }
    built.coordinator.detectProfileState();
    const secret = new (requireModules().UnlockSecret)(secretBytes);
    const result = await built.coordinator.unlockProfile(secret);
    if (result.outcome === "ok" && "value" in result) {
      const assembly = startAssembly(built.coordinator, result.value);
      if (assembly === null) {
        await built.coordinator.lock();
        return { outcome: "failed", reason: "unlocked but application assembly failed to start" };
      }
      activeCoordinator = built.coordinator;
      activeAssembly = assembly;
      activeAssembly.boundary.securityState.setMessageDeliveryRemoteDeviceRef(activeMessageDeliveryRemoteDeviceRef);
      ipcCommands.bumpGeneration(); // a new assembly now exists — discard any stale-generation in-flight results
      activeViewerParticipant = { authority: "nostr", publicIdentifier: result.value.accountPublicIdentifier, identityId: null };
      activeLocalIdentity = { displayLabel: result.value.displayLabel, accountPublicIdentifier: result.value.accountPublicIdentifier };
      activeMasterSeedAuthority = built.masterSeedAuthority;
      activeNostrSigningAuthority = built.signer;
      // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- forces
      // `commerceMediaStoreFor()` to (re)construct NOW, against the real
      // authority/signer just activated above, rather than waiting for a
      // first caller that may never come this session -- proves the real
      // Master Seed Authority injection (and the outbound Nostr Port's
      // real signer/relay wiring) is genuinely live immediately on every
      // successful create/unlock, not merely "would be live if called".
      initializeCommerceNetworkProfileFromRelayConfig();
      commerceMediaStoreFor();
      commerceNostrOutboundPortFor();
      await attachPresentationLayer(assembly);
      return readyResult(result.value);
    }
    await built.masterSeedAuthority.clear();
    return { outcome: result.outcome === "recovery-required" || result.outcome === "corrupt" ? result.outcome : "unlock-failed", reason: "unlock did not complete" };
  } finally {
    // concurrency guard is now owned by ipcCommands' "profile-lifecycle" group
  }
}

/** Phase G — Lock: stops background sync + the ONE Runtime (via the assembly), clears badge/tray to their inert "no active sensitive work" state, THEN the Coordinator's own lock() (safe second call). */
async function handleLock() {
  // The "profile-lifecycle" group guard on this channel's registerHandle()
  // registration already serializes create/unlock/lock against each other —
  // see fedos_electron_ipc_command_registry.ts.
  if (activeCoordinator === null) return { outcome: "ok", reason: "already locked" };
  // Bounded wait for any in-flight fedos-app:*/fedos-acceptance:* command to
  // finish BEFORE the assembly is torn down — without this, a command that
  // captured the (about-to-be-stale) assembly reference before Lock began
  // could still return decrypted content read under the OLD profile after
  // Lock completes. Bounded rather than unbounded: the page polls chat/relay
  // status on timers, so an unbounded wait could hang Lock indefinitely.
  // bumpGeneration() below is the second, independent backstop for anything
  // still running past this deadline.
  await ipcCommands.drain(2000);
  try {
    const coordinator = activeCoordinator;
    const assembly = activeAssembly;
    activeCoordinator = null;
    activeAssembly = null;
    ipcCommands.bumpGeneration(); // the assembly is being destroyed — discard any still-in-flight results
    activeViewerParticipant = null;
    activeLocalIdentity = null;
    activeRelays = [];
    activeMasterSeedAuthority = null;
    activeNostrSigningAuthority = null;
    if (assembly !== null) await assembly.shutdown();
    await coordinator.lock();
    if (badgeAdapter !== null) {
      badgeAdapter.render({ state: "none", count: 0, reason: "profile locked" });
    }
    refreshTrayMenu();
    return { outcome: "ok" };
  } finally {
    // concurrency guard is now owned by ipcCommands' "profile-lifecycle" group
  }
}

/**
 * FedOS Peer Device Discovery Arc P0 Closure (Agent F) — "Start Over" on
 * the recovery screen. Refuses (`{outcome:"reset-refused",...}`) whenever a
 * profile is currently unlocked (`activeCoordinator !== null` — there is
 * nothing to reset while genuinely `ready`; this mirrors `handleCreate()`/
 * `handleUnlock()`'s own identical guard). Otherwise builds a fresh,
 * throwaway Coordinator (the SAME real activation `handleStatus()` already
 * uses for a pre-unlock read) purely to call its own guarded
 * `resetInterruptedProfile()` — that method is itself the sole authority on
 * whether the reset is safe (never trusted to this handler). No assembly
 * is ever started here, so `activeCoordinator`/`activeAssembly` are never
 * touched and no generation bump is needed.
 */
async function handleResetInterruptedProfile() {
  // The "profile-lifecycle" group guard on this channel's registerHandle()
  // registration already serializes create/unlock/lock/reset against each
  // other -- see fedos_electron_ipc_command_registry.ts.
  if (activeCoordinator !== null) return { outcome: "reset-refused", reason: "a profile is currently unlocked" };
  try {
    const built = await buildFreshCoordinator();
    if (built === null) {
      return { outcome: "seed-unavailable", reason: "production crypto unavailable" };
    }
    try {
      built.coordinator.detectProfileState();
      const result = await built.coordinator.resetInterruptedProfile();
      if (result.outcome === "ok") return { outcome: "ok" };
      return { outcome: result.outcome, reason: "reset did not complete" };
    } finally {
      await built.masterSeedAuthority.clear();
    }
  } finally {
    // concurrency guard is now owned by ipcCommands' "profile-lifecycle" group
  }
}

/**
 * FedOS Installed Startup Root-Cause Arc — the SIBLING "Start Over" on the
 * recovery screen, for the OPPOSITE shape from `handleResetInterruptedProfile()`
 * above: a descriptor that DID durably reach `"ready"`, but whose sealed
 * Master Seed envelope is verifiably, structurally missing/corrupt (never
 * reachable by an ordinary wrong-passphrase retry — see
 * `FedosProfileInitializationCoordinator#resetCorruptReadyProfile()`'s own
 * header, root `src/`, for the full guard). Mirrors
 * `handleResetInterruptedProfile()`'s own structure exactly: refuses while
 * a profile is currently unlocked, builds a fresh throwaway Coordinator
 * purely to call its own guarded reset method (the sole authority on
 * safety), and never touches `activeCoordinator`/`activeAssembly`.
 */
async function handleResetCorruptReadyProfile() {
  // The "profile-lifecycle" group guard on this channel's registerHandle()
  // registration already serializes create/unlock/lock/reset against each
  // other -- see fedos_electron_ipc_command_registry.ts.
  if (activeCoordinator !== null) return { outcome: "reset-refused", reason: "a profile is currently unlocked" };
  try {
    const built = await buildFreshCoordinator();
    if (built === null) {
      return { outcome: "seed-unavailable", reason: "production crypto unavailable" };
    }
    try {
      built.coordinator.detectProfileState();
      const result = await built.coordinator.resetCorruptReadyProfile();
      if (result.outcome === "ok") return { outcome: "ok" };
      return { outcome: result.outcome, reason: "reset did not complete" };
    } finally {
      await built.masterSeedAuthority.clear();
    }
  } finally {
    // concurrency guard is now owned by ipcCommands' "profile-lifecycle" group
  }
}

/** Phase H — the Beta Home/status surface: real, non-secret facts only. Never exposes a raw Settings descriptor, a raw error, or a WASM handle. */
async function handleBetaStatus() {
  const m = requireModules();
  const profileStatus = await handleStatus();
  const settingsEffectiveState = activeAssembly?.settingsCoordinator.effectiveState() ?? null;
  let navigation: unknown = null;
  let badge: unknown = null;
  let background: { canRunBackgroundSync: boolean; canDeliverBackgroundNotifications: boolean } | null = null;
  let deviceSyncStatus: string | null = null;
  if (activeAssembly !== null) {
    navigation = activeAssembly.navigationRegistry.sessionState();
    badge = activeAssembly.badgeCoordinator.lastView;
    background = {
      canRunBackgroundSync: activeAssembly.backgroundLifecycle.canRunBackgroundSync(),
      canDeliverBackgroundNotifications: activeAssembly.backgroundLifecycle.canDeliverBackgroundNotifications(),
    };
    deviceSyncStatus = activeAssembly.deviceSyncPresentationWiring.currentTrayStatus;
  }
  return {
    profile: profileStatus,
    settingsEffectiveState,
    navigation,
    badge,
    background,
    trayActive: trayCreated,
    deviceSyncStatus,
    capabilities: m.betaCapabilityManifestV1(),
    release: m.betaReleaseConfigurationV1(),
    limitations: m.betaLimitationsV1(),
  };
}

/**
 * Secure Runtime Alpha 6681-6760 — AUTOTEST-only, READ-ONLY reachability
 * diagnostic proving this packaged process's own real Runtime is the SAME
 * unified configuration graph the reconciled 70bbd6e8/8a33045e lineages
 * produce: Direct Ratchet, Peer Capability, Identity Transition, and
 * Deletion Request all resolve through the SAME `conversationRuntime()`
 * this Coordinator already constructs (never a second Runtime/Coordinator
 * built just for this check), and `productionCryptoStatus()` proves the
 * Store-backed crypto authority from 8a33045e is live -- through the SAME
 * Shell every other command in this file uses. Reads existing accessors
 * only; mutates nothing; never returns a raw Runtime/handle/secret, only
 * booleans and the Shell's own already-safe status outcome string.
 */
function unifiedGraphDiagnostics(): {
  readonly runtimeReachable: boolean;
  readonly deviceTrustReachable: boolean;
  readonly directRatchetConfigured: boolean;
  readonly peerCapabilityConfigured: boolean;
  readonly identityTransitionConfigured: boolean;
  readonly deletionRequestConfigured: boolean;
  readonly productionCryptoStatusOutcome: string | null;
} {
  const runtime = activeCoordinator?.runningRuntime() ?? null;
  if (runtime === null) {
    return {
      runtimeReachable: false,
      deviceTrustReachable: false,
      directRatchetConfigured: false,
      peerCapabilityConfigured: false,
      identityTransitionConfigured: false,
      deletionRequestConfigured: false,
      productionCryptoStatusOutcome: null,
    };
  }
  const cr = runtime.conversationRuntime();
  let deviceTrustReachable = false;
  try {
    runtime.deviceTrust();
    deviceTrustReachable = true;
  } catch {
    deviceTrustReachable = false;
  }
  return {
    runtimeReachable: true,
    deviceTrustReachable,
    directRatchetConfigured: cr.directRatchet() !== null,
    peerCapabilityConfigured: cr.peerCapability() !== null,
    identityTransitionConfigured: cr.identityTransition() !== null,
    deletionRequestConfigured: cr.deletionRequest() !== null,
    productionCryptoStatusOutcome: activeAssembly?.shell.productionCryptoStatus().outcome ?? null,
  };
}

async function handleSettingsPlan(candidate: unknown) {
  if (activeAssembly === null) return { outcome: "unavailable", reason: "no profile is unlocked" };
  return activeAssembly.settingsCoordinator.previewPlan(candidate);
}

async function handleSettingsApply(candidate: unknown) {
  if (activeAssembly === null) return { outcome: "unavailable", reason: "no profile is unlocked" };
  const result = await activeAssembly.settingsCoordinator.apply(candidate);
  refreshTrayMenu();
  return result;
}

async function handleBadgeMarkViewed(payload: unknown) {
  if (activeAssembly === null) return { outcome: "unavailable", reason: "no profile is unlocked" };
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isSafeId(conversationId)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  activeAssembly.navigationRegistry.recordConversationOpened(conversationId);
  const view = await activeAssembly.badgeCoordinator.refresh();
  return { outcome: "ok", view };
}

async function performCleanShutdown(): Promise<void> {
  // Synchronously refuse every NEW IPC invocation from this instant on —
  // closes the gap where a handleCreate()/handleUnlock() invoked after
  // shutdown begins could still install a brand-new live assembly AFTER
  // app.quit(), which this function's own `if (shutdownInitiated) return;`
  // guard would then never run again to tear back down. Then bound-wait for
  // whatever was already in flight when close() was called.
  ipcCommands.close();
  await ipcCommands.drain(2000);
  if (shutdownInitiated) return;
  shutdownInitiated = true;
  if (activeCoordinator !== null) {
    const coordinator = activeCoordinator;
    const assembly = activeAssembly;
    activeCoordinator = null;
    activeAssembly = null;
    ipcCommands.bumpGeneration(); // the assembly is being destroyed — discard any still-in-flight results
    activeViewerParticipant = null;
    activeLocalIdentity = null;
    activeRelays = [];
    activeMasterSeedAuthority = null;
    activeNostrSigningAuthority = null;
    try {
      if (assembly !== null) await assembly.shutdown();
      await coordinator.lock();
    } catch {
      /* never throws */
    }
  }
  if (badgeAdapter !== null) {
    badgeAdapter.render({ state: "none", count: 0, reason: "process shutting down" });
  }
  trayAdapter.destroy();
  console.log("fedos-beta: shutdown clean");
  app.quit();
}

// ---------------------------------------------------------------------
// Secure Runtime Alpha 7001-7080 — Phase C: the closed `fedos-acceptance:*`
// command vocabulary; EXTENDED by Secure Runtime Alpha 7321-7400 with
// createConversationInvitation/search/archive/safety-center-overview
// (Release Readiness Review B-2/B-7). Every command below is REJECTED
// (`{outcome: "unavailable", reason: "acceptance-only"}`, structurally
// identical to every other "unavailable" outcome this file already
// produces — no new failure shape) whenever no real profile is currently
// unlocked (`requireShell()`/`requireBoundary()`) — the SAME real
// precondition every other command in this file already requires. Prior
// to Alpha 7321-7400 this vocabulary was ADDITIONALLY gated behind
// `AUTOTEST_MODE`, making it unreachable in ordinary packaged production
// mode even with a real profile unlocked — that gap is what this Arc
// closes (Release Readiness Review B-3); the name `"acceptance-only"`
// is kept as the existing, stable outcome-reason string (Phase P "do not
// rename existing accepted surfaces"), even though the gate it now
// describes is real-profile-required, not AUTOTEST-required. Every
// command delegates ENTIRELY to an ALREADY-REAL `FedosDesktopApplicationShell`/
// `FedosSafetyCenterController` method (never a raw Runtime/Store/handle,
// never a second business-logic implementation) and validates its own
// JSON payload shape before calling it — malformed input never reaches
// the Shell.
// ---------------------------------------------------------------------

function acceptanceGateRejection(): { readonly outcome: "unavailable"; readonly reason: string } {
  return { outcome: "unavailable", reason: "acceptance-only" };
}

/**
 * Secure Runtime Alpha 7321-7400 — real production reachability fix
 * (Release Readiness Review B-3): the ONLY gate is now "is a real profile
 * genuinely unlocked" — the SAME real precondition every other command in
 * this file already requires (`fedos-beta:*`/`fedos-profile:*`). The prior
 * `AUTOTEST_MODE.length === 0` check made this entire vocabulary
 * unreachable in ordinary packaged production mode by design; that was
 * itself the reachability gap this Arc's own mission exists to close. No
 * other change: still `null` before any create/unlock, still delegates
 * entirely to the SAME already-real `FedosDesktopApplicationShell`.
 */
function requireShell(): ShellDiagnosticLike | null {
  if (activeAssembly === null) return null;
  return activeAssembly.shell;
}

/** Secure Runtime Alpha 7321-7400 — mirrors `requireShell()`'s own identical discipline exactly, for Safety Center's own real presentation boundary. */
function requireBoundary(): BoundaryLike | null {
  if (activeAssembly === null) return null;
  return activeAssembly.boundary;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

async function handleAcceptanceCreateDirectConversation(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  if (typeof payload !== "object" || payload === null) return { outcome: "invalid-input", reason: "malformed create-direct-conversation request" };
  const recipient = (payload as { recipient?: unknown }).recipient;
  if (typeof recipient !== "object" || recipient === null) return { outcome: "invalid-input", reason: "missing recipient" };
  const authority = (recipient as { authority?: unknown }).authority;
  const publicIdentifier = (recipient as { publicIdentifier?: unknown }).publicIdentifier;
  if (typeof authority !== "string" || !isBoundedString(publicIdentifier, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed recipient" };
  }
  return shell.createDirectConversation({ recipient: { authority: authority as never, publicIdentifier } });
}

async function handleAcceptanceActivateDirectConversation(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  return shell.activateDirectConversation(conversationId);
}

async function handleAcceptanceDevicePairingCreate(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const deviceId = (payload as { deviceId?: unknown } | null)?.deviceId;
  const expectedAccountRef = (payload as { expectedAccountRef?: unknown } | null)?.expectedAccountRef;
  if (!isBoundedString(deviceId, MAX_ID_LENGTH) || typeof expectedAccountRef !== "object" || expectedAccountRef === null) {
    return { outcome: "invalid-input", reason: "malformed device-pairing-create request" };
  }
  return shell.devicePairingCreate(deviceId, expectedAccountRef);
}

async function handleAcceptanceDevicePairingInspect(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const encodedRequest = (payload as { encodedRequest?: unknown } | null)?.encodedRequest;
  if (!isBoundedString(encodedRequest, MAX_PAIRING_ENVELOPE_CHARS)) return { outcome: "invalid-input", reason: "malformed encodedRequest" };
  return shell.devicePairingInspect(encodedRequest);
}

async function handleAcceptanceDevicePairingApprove(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const encodedRequest = (payload as { encodedRequest?: unknown } | null)?.encodedRequest;
  if (!isBoundedString(encodedRequest, MAX_PAIRING_ENVELOPE_CHARS)) return { outcome: "invalid-input", reason: "malformed encodedRequest" };
  return shell.devicePairingApprove(encodedRequest);
}

async function handleAcceptanceDevicePairingComplete(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const pairingId = (payload as { pairingId?: unknown } | null)?.pairingId;
  const encodedApproval = (payload as { encodedApproval?: unknown } | null)?.encodedApproval;
  if (!isBoundedString(pairingId, MAX_ID_LENGTH) || !isBoundedString(encodedApproval, MAX_PAIRING_ENVELOPE_CHARS)) {
    return { outcome: "invalid-input", reason: "malformed device-pairing-complete request" };
  }
  return shell.devicePairingComplete(pairingId, encodedApproval);
}

async function handleAcceptanceEstablishDirectRatchetSession(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const remoteDeviceRef = (payload as { remoteDeviceRef?: unknown } | null)?.remoteDeviceRef;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || !isBoundedString(remoteDeviceRef, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed establish-session request" };
  }
  return shell.establishDirectRatchetSession(conversationId, remoteDeviceRef);
}

async function handleAcceptanceSendMessage(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const sender = (payload as { sender?: unknown } | null)?.sender;
  const body = (payload as { body?: unknown } | null)?.body;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || typeof sender !== "object" || sender === null || !isBoundedString(body, MAX_MESSAGE_BODY_CHARS)) {
    return { outcome: "invalid-input", reason: "malformed send-message request" };
  }
  return shell.sendMessage(conversationId, sender, body);
}

async function handleAcceptanceListMessages(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  return shell.listMessages(conversationId);
}

async function handleAcceptanceReadMessage(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const messageId = (payload as { messageId?: unknown } | null)?.messageId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || !isBoundedString(messageId, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed read-message request" };
  }
  return shell.readMessage(conversationId, messageId);
}

async function handleAcceptanceDirectRatchetStatus(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const remoteDeviceRef = (payload as { remoteDeviceRef?: unknown } | null)?.remoteDeviceRef;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || !isBoundedString(remoteDeviceRef, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed status request" };
  }
  return { outcome: "ok", value: shell.directRatchetStatus(conversationId, remoteDeviceRef) };
}

/**
 * Direct Ratchet Identity-Space Unification arc -- acceptance-mode-only
 * (`ACCEPTANCE_MODE_ENABLED` gate, same as every other `fedos-acceptance:*`
 * handler) real poll-until-condition-or-timeout status check. Genuine
 * inbound session establishment (a real relay round-trip plus real WASM
 * session construction) is a bounded but non-instant async pipeline --
 * this polls the SAME real `shell.directRatchetStatus()` this file's own
 * ordinary status handler already exposes, repeatedly, inside ONE
 * continuously-running process (never restarting the Runtime mid-poll,
 * which would restart the whole subscribe/resolve pipeline from scratch),
 * stopping as soon as it observes "active" or a bounded ceiling elapses --
 * never an unbounded wait. Reports real elapsed time and attempt count so
 * a caller gets real latency data, not just a pass/fail.
 */
async function handleAcceptanceDirectRatchetStatusPollUntilActive(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const remoteDeviceRef = (payload as { remoteDeviceRef?: unknown } | null)?.remoteDeviceRef;
  const timeoutMs = (payload as { timeoutMs?: unknown } | null)?.timeoutMs;
  const intervalMs = (payload as { intervalMs?: unknown } | null)?.intervalMs;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || !isBoundedString(remoteDeviceRef, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed status request" };
  }
  const ceilingMs = typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000;
  const pollEveryMs = typeof intervalMs === "number" && Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 1500;
  const startedAt = Date.now();
  let attempts = 1;
  let lastResult = shell.directRatchetStatus(conversationId, remoteDeviceRef);
  while (lastResult.outcome === "ok" && lastResult.value !== "active" && Date.now() - startedAt < ceilingMs) {
    await new Promise((resolve) => setTimeout(resolve, pollEveryMs));
    lastResult = shell.directRatchetStatus(conversationId, remoteDeviceRef);
    attempts += 1;
  }
  return { outcome: "ok", value: { status: lastResult, elapsedMs: Date.now() - startedAt, attempts } };
}

/**
 * Direct Ratchet Identity-Space Unification arc -- mirrors
 * `handleAcceptanceDirectRatchetStatusPollUntilActive()`'s own genuine
 * poll-until-condition-or-timeout shape exactly, for the SAME real reason:
 * a freshly-launched process's first-ever live delivery of a Rumor over
 * the real relay (session-init OR an ordinary message) was root-caused to
 * be a real, bounded, non-instant async pipeline (see this arc's own
 * report) -- polling `shell.listMessages()` here, repeatedly inside ONE
 * continuously-running process, until it observes at least `minCount`
 * messages or a bounded ceiling elapses, is the same honest treatment for
 * message-count assertions that were previously waiting on a fixed,
 * guessed `wait` duration.
 */
async function handleAcceptanceListMessagesPollUntilCount(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const minCount = (payload as { minCount?: unknown } | null)?.minCount;
  const timeoutMs = (payload as { timeoutMs?: unknown } | null)?.timeoutMs;
  const intervalMs = (payload as { intervalMs?: unknown } | null)?.intervalMs;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || typeof minCount !== "number" || !Number.isInteger(minCount) || minCount < 0) {
    return { outcome: "invalid-input", reason: "malformed list-messages-poll-until-count request" };
  }
  const ceilingMs = typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000;
  const pollEveryMs = typeof intervalMs === "number" && Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 1500;
  const startedAt = Date.now();
  let attempts = 1;
  let lastResult = shell.listMessages(conversationId) as { readonly outcome: string; readonly value?: readonly unknown[] };
  while (
    lastResult.outcome === "ok" &&
    (lastResult.value === undefined || lastResult.value.length < minCount) &&
    Date.now() - startedAt < ceilingMs
  ) {
    await new Promise((resolve) => setTimeout(resolve, pollEveryMs));
    lastResult = shell.listMessages(conversationId) as { readonly outcome: string; readonly value?: readonly unknown[] };
    attempts += 1;
  }
  return { outcome: "ok", value: { result: lastResult, elapsedMs: Date.now() - startedAt, attempts } };
}

/**
 * Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-2:
 * `createConversationInvitation()` had zero IPC/preload exposure anywhere.
 * Delegates ENTIRELY to the already-real `FedosDesktopApplicationShell.createConversationInvitation()`
 * (Alpha 7081-7160, unmodified) — creates a brand-new Direct conversation
 * and sends a real, signed invitation over the real relay.
 */
async function handleAcceptanceCreateConversationInvitation(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  if (typeof payload !== "object" || payload === null) return { outcome: "invalid-input", reason: "malformed create-conversation-invitation request" };
  const invitee = (payload as { invitee?: unknown }).invitee;
  if (typeof invitee !== "object" || invitee === null) return { outcome: "invalid-input", reason: "missing invitee" };
  const authority = (invitee as { authority?: unknown }).authority;
  const publicIdentifier = (invitee as { publicIdentifier?: unknown }).publicIdentifier;
  if (typeof authority !== "string" || !isBoundedString(publicIdentifier, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed invitee" };
  }
  const expiresInMs = (payload as { expiresInMs?: unknown }).expiresInMs;
  return shell.createConversationInvitation({ authority: authority as never, publicIdentifier, identityId: null }, typeof expiresInMs === "number" ? expiresInMs : undefined);
}

/**
 * Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7
 * (Search): delegates ENTIRELY to the already-real, unconditionally-
 * constructed `FedosDesktopApplicationShell.search()` (Alpha 3081-3160,
 * unmodified) — real, retention-gated keyword search over locally-held
 * plaintext.
 */
async function handleAcceptanceSearch(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const query = (payload as { query?: unknown } | null)?.query;
  if (!isBoundedString(query, MAX_SEARCH_QUERY_CHARS)) return { outcome: "invalid-input", reason: "malformed search query" };
  return Promise.resolve(shell.search(query));
}

/**
 * Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7
 * (Archive): delegates ENTIRELY to the already-real `FedosDesktopApplicationShell.archive()`
 * (Alpha 3081-3160, unmodified) — real WASM-backed export/inspect/
 * preflightRestore/restore, exactly the same command shape
 * `FedosContentAccessorArchiveCommand` already defines. Only the closed
 * `operation` discriminant and any bounded path string are validated
 * here — the nested `request` object (export/restore parameters) is
 * passed through to the Shell's own existing validation, mirroring how
 * `sendMessage`'s own `sender` and `devicePairingCreate`'s own
 * `expectedAccountRef` are already handled in this file.
 */
async function handleAcceptanceArchive(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  if (typeof payload !== "object" || payload === null) return { outcome: "invalid-input", reason: "malformed archive request" };
  const operation = (payload as { operation?: unknown }).operation;
  if (operation === "inspect") {
    const sourcePath = (payload as { sourcePath?: unknown }).sourcePath;
    if (!isBoundedString(sourcePath, MAX_ARCHIVE_PATH_CHARS)) return { outcome: "invalid-input", reason: "malformed sourcePath" };
    return shell.archive({ operation: "inspect", sourcePath });
  }
  if (operation === "preflightRestore" || operation === "export" || operation === "restore") {
    const request = (payload as { request?: unknown }).request;
    if (typeof request !== "object" || request === null) return { outcome: "invalid-input", reason: "missing request" };
    return shell.archive({ operation, request } as never);
  }
  return { outcome: "invalid-input", reason: "unknown archive operation" };
}

/**
 * Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7
 * (Safety Center): delegates ENTIRELY to the already-real
 * `FedosSafetyCenterController` (`src/desktop/presentation/safety_center/`,
 * unmodified), reached via `FedosDesktopBetaApplicationAssembly`'s own
 * pre-existing `boundary` getter — no new presentation logic.
 */
async function handleAcceptanceSafetyCenterOverview(): Promise<{ readonly outcome: string; readonly [key: string]: unknown }> {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  await boundary.safetyCenter.refreshOverview([]);
  return { outcome: "ok", value: boundary.safetyCenter.overviewState };
}

// ---------------------------------------------------------------------
// Secure Runtime Alpha 8041-8120 — Phase B-K: the ORDINARY, user-facing
// `fedos-app:*` command vocabulary. This is the FedOS Desktop Beta
// User-Facing Product UI Completion Arc's own closure of the Phase A
// reconciliation report's central finding: `FedosDesktopConversationUiPresentationBoundary`
// (`src/desktop/presentation/`, unmodified) already composes a real
// conversation list/detail, message list/compose, membership/invitation,
// search, archive, device inventory, Identity Transition, and Signed
// Deletion Controller/ViewModel over the SAME Shell/Runtime every
// `fedos-acceptance:*` command already uses -- it was simply never read by
// this file before this Arc. Every handler below is a THIN delegation to
// one of those already-real, already-tested ViewModels/Controllers (never
// a second business-logic implementation, never a raw Runtime/Store/handle)
// and gates on the SAME real-profile-unlocked precondition
// (`requireShell()`/`requireBoundary()`) every other command in this file
// already requires. This vocabulary is the ONLY one the ordinary page may
// ever call -- `fedosAcceptance`/`fedos-acceptance:*` remains untouched,
// reachable only by the pre-existing acceptance-mode test harness (Phase P
// "do not rename existing accepted surfaces"; Phase Q "acceptance API
// remains test-gated/clearly internal").
// ---------------------------------------------------------------------

/** Maps ANY `FedosDesktopViewModelState<T>` (`{status:"idle"|"loading"}` | `{status:"loaded",data}` | `{status:"error",outcome,reason}`) onto the SAME `{outcome:"ok",value}` / `{outcome,reason}` shape every `fedos-acceptance:*`/`fedos-profile:*` result in this file already uses -- one uniform result vocabulary across both command sets, never a second. */
function resultFromViewModelState(state: { readonly status: string; readonly data?: unknown; readonly outcome?: string; readonly reason?: string }): { readonly outcome: string; readonly [key: string]: unknown } {
  if (state.status === "loaded") return { outcome: "ok", value: state.data };
  if (state.status === "error") return { outcome: state.outcome ?? "failed", reason: state.reason ?? "" };
  return { outcome: "unavailable", reason: state.status };
}

function requireViewerParticipant(): ParticipantRefLike | null {
  return activeViewerParticipant;
}

async function handleAppConversationsList() {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  await boundary.conversationList.load();
  return resultFromViewModelState(boundary.conversationList.state);
}

async function handleAppConversationOpen(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  await boundary.conversationDetail.load(conversationId);
  return resultFromViewModelState(boundary.conversationDetail.state);
}

async function handleAppMessagesList(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  await boundary.messageList.load(conversationId);
  return resultFromViewModelState(boundary.messageList.state);
}

async function handleAppMessageReveal(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const messageId = (payload as { messageId?: unknown } | null)?.messageId;
  if (!isBoundedString(messageId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed messageId" };
  await boundary.messageList.reveal(messageId);
  return resultFromViewModelState(boundary.messageList.state);
}

async function handleAppMessageSend(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const viewer = requireViewerParticipant();
  if (viewer === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const body = (payload as { body?: unknown } | null)?.body;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH) || !isBoundedString(body, MAX_MESSAGE_BODY_CHARS)) {
    return { outcome: "invalid-input", reason: "malformed message-send request" };
  }
  boundary.composeMessage.setBody(body);
  await boundary.composeMessage.send(conversationId, viewer);
  return resultFromViewModelState(boundary.composeMessage.state);
}

async function handleAppMembershipList(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  await boundary.membership.load(conversationId);
  return resultFromViewModelState(boundary.membership.state);
}

async function handleAppInvitationsList(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const viewer = requireViewerParticipant();
  if (viewer === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  if (!isBoundedString(conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  await boundary.membership.loadInvitations(conversationId, viewer);
  return resultFromViewModelState(boundary.membership.invitations);
}

async function handleAppArchiveWorkflowWarnings(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const operation = (payload as { operation?: unknown } | null)?.operation;
  if (operation !== "inspect" && operation !== "preflightRestore" && operation !== "export" && operation !== "restore") {
    return { outcome: "invalid-input", reason: "unknown archive operation" };
  }
  return { outcome: "ok", value: boundary.archive.workflowWarnings(operation) };
}

async function handleAppDevicesList() {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  return shell.devicesList();
}

async function handleAppDeviceDetail(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const deviceId = (payload as { deviceId?: unknown } | null)?.deviceId;
  if (!isBoundedString(deviceId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed deviceId" };
  return shell.deviceDetail(deviceId);
}

async function handleAppDeviceRevoke(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const deviceId = (payload as { deviceId?: unknown } | null)?.deviceId;
  const devicePublicKeyHex = (payload as { devicePublicKeyHex?: unknown } | null)?.devicePublicKeyHex;
  if (!isBoundedString(deviceId, MAX_ID_LENGTH) || !isBoundedString(devicePublicKeyHex, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed device-revoke request" };
  }
  return shell.deviceRevoke(deviceId, devicePublicKeyHex);
}

async function handleAppDeviceSyncStatus() {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  return shell.deviceSyncStatus();
}

// Real Digital Delivery mega-arc (Agent U) — Device Sync inventory. Every
// method below already exists, real, on `FedosDesktopApplicationShell`
// (`syncSchedulesList`/`syncTransfersList`/`syncConflictsList`/
// `syncConflictDetail`/`syncConflictAcknowledge`) -- this Arc only reaches
// them from `fedos-app:*` for the first time, mirroring `handleAppDeviceSyncStatus()`'s
// own exact shape immediately above. Pure wiring: no new authority, no new
// protocol message, no cross-account Device discovery -- every row this
// surfaces is this LOCAL account's own already-durable Sync fact.
async function handleAppDeviceSyncSchedulesList() {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  return shell.syncSchedulesList();
}

async function handleAppDeviceSyncTransfersList() {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  return shell.syncTransfersList();
}

async function handleAppDeviceSyncConflictsList(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const includeResolved = (payload as { includeResolved?: unknown } | null)?.includeResolved === true;
  return shell.syncConflictsList(includeResolved);
}

/** Closed action vocabulary only -- mirrors `FedosDeviceSyncConflictResolutionAction`'s own closed union (`accept-identical`/`discard-invalid`/`refresh-missing-dependency`/`acknowledge`); never a generic "resolve" string reaches the Shell. */
const DEVICE_SYNC_CONFLICT_RESOLUTION_ACTIONS = ["accept-identical", "discard-invalid", "refresh-missing-dependency", "acknowledge"] as const;

async function handleAppDeviceSyncConflictAcknowledge(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const conflictId = (payload as { conflictId?: unknown } | null)?.conflictId;
  const action = (payload as { action?: unknown } | null)?.action;
  if (!isBoundedString(conflictId, MAX_ID_LENGTH) || typeof action !== "string" || !(DEVICE_SYNC_CONFLICT_RESOLUTION_ACTIONS as readonly string[]).includes(action)) {
    return { outcome: "invalid-input", reason: "malformed device-sync-conflict-acknowledge request" };
  }
  return shell.syncConflictAcknowledge(conflictId, action);
}

// ---------------------------------------------------------------------
// Commerce Reachable Catalog + Product Surface Phase 1.
//
// Deliberately independent of `requireShell()`/`requireModules()`'s own
// profile-lifecycle gating: Commerce catalog discovery does not require an
// unlocked profile, a Coordinator, or a Runtime -- it only needs `modules`
// (loaded once, unconditionally, in `loadRootModules()`). This is what
// "0 expected network contact" and "Commerce reachable even before a
// profile exists" both cash out to structurally.
//
// Commerce E2E Completion arc (coordinator integration gate) widens the
// catalog from the static `FEDOS_COMMERCE_DEMO_PRODUCTS` array to
// `commerceState().products.listPublished()` -- a REAL, mutable
// `LocalProductRepository` seeded with those exact same products (same
// ids/status, see `commerceState()`'s own header), so Phase 1's 3 demo
// products render byte-identically, while a Merchant's own
// create->publish now ALSO appears here (`listPublished()` already
// applies the same `listViewableProducts()` filter internally). Merchant
// CRUD (`handleCommerceMerchant*` below) is the first `os/commerce`
// surface this main process can actually MUTATE -- still zero network
// contact, zero real payment reachable from any handler in this section.
// ---------------------------------------------------------------------

/**
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
 * "Unknown merchant" P1 fix (`docs/commerce/usability-v3/SELLER-TABLETOP-AFTER.md`
 * friction row: "Seller's own real listing showed 'Unknown merchant'... a
 * real bug, not a demo-data quirk"). Resolution order:
 *   1. The CURRENT process's own unlocked real local Persona
 *      (`activeLocalIdentity`) -- a seller always sees (and buyers viewing
 *      that seller's own listing from the SAME process see) their real,
 *      durable profile label, never "Unknown".
 *   2. The static demo-merchant map (unchanged, for the two demo fixtures).
 *   3. A genuinely unattributed pubkey (e.g. a real OTHER seller discovered
 *      cross-process over Nostr, whose display name this process was never
 *      told -- propagating a real seller's chosen display name into the
 *      Nostr product event itself is a discovery/event-schema change
 *      outside this fix's scope, see this arc's own final report) gets an
 *      honest "a real seller, name not shared yet" label instead of the
 *      alarming, bug-flavored "Unknown merchant" -- still non-fabricated
 *      (never invents a name), just doesn't read as broken.
 */
function commerceMerchantLabelFor(creatorPubkey: string): string {
  if (activeLocalIdentity !== null && creatorPubkey === activeLocalIdentity.accountPublicIdentifier) {
    return activeLocalIdentity.displayLabel;
  }
  const demoLabel = fedosCommerceDemoMerchantLabel(creatorPubkey);
  if (demoLabel !== "Unknown merchant") return demoLabel;
  const shortId = creatorPubkey.length > 10 ? `${creatorPubkey.slice(0, 10)}…` : creatorPubkey;
  return `Independent seller ${shortId} (display name not shared yet)`;
}

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- friction-ledger row #17 / arc §38: a real, Merchant-attached
 * PUBLIC image (via `handleCommerceProductImageAttach()` below) now takes
 * priority over the static Phase 1 demo fallback map. Reads the FIRST
 * `classification: "public"` `ProductMedia` record for `productId` (a
 * Merchant may attach more than one; this surface only shows the primary
 * one, matching every existing single-image product-card/detail
 * rendering already in the renderer). Falls back to the SAME safe
 * missing-image fallback every un-imaged product already rendered before
 * this arc -- never a fake/placeholder photo, never a thrown error.
 */
function commerceProductMediaFor(productId: string): { readonly dataUri: string; readonly mimeType: string; readonly altText: string } | null {
  const attached = commerceProductMediaState()
    .listForProduct(productId)
    .find((item) => item.classification === "public");
  if (attached !== undefined) {
    const stored = commerceMediaStoreFor().get(attached.storageRef);
    if (stored !== null) {
      const base64 = Buffer.from(stored.bytes).toString("base64");
      return { dataUri: `data:${attached.contentType};base64,${base64}`, mimeType: attached.contentType, altText: attached.altText ?? "" };
    }
  }
  return FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA[productId] ?? null;
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (Agent N, discovery wiring pass) --
 * every product this process's OWN Nostr read model currently has applied,
 * `status === "active"` only (an `"archived"` Nostr-discovered product is
 * deliberately excluded from a public catalog listing, same as a local
 * product's own `listPublished()` filter already excludes non-`"active"`
 * local products), EXCLUDING any id already present in `localIds` -- a
 * product this process already has locally (e.g. the merchant's own
 * listing, on the merchant's own process) is always shown from the LOCAL,
 * authoritative copy, never a redundant Nostr-mirrored duplicate.
 */
function commerceNostrDiscoveredActiveProducts(localIds: ReadonlySet<string>): readonly CommerceReadModelProductViewLike[] {
  return commerceNostrReadModelFor()
    .listProducts()
    .filter((view) => view.status === "active" && !localIds.has(view.productId));
}

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * arc mandate item 5 ("Cleanly separate the real synchronized Shop catalog
 * from demo/example fixtures... never silently blended into the real
 * Shop, with no distinguishing signal").
 *
 * SCOPE NOTE, read before "fixing" this into two separate arrays: an
 * earlier version of this pass DID split `products` into a real-only array
 * plus a separate `demoProducts` array (and removed demo items from
 * `#commerce-catalog-list`'s DOM position count entirely). That was
 * reverted after discovering it breaks ~9 pre-existing REAL Electron E2E
 * tests (`commerce_e2e_full_happy_path_real_electron.test.ts` and
 * siblings) that click `#commerce-catalog-list li:nth-child(4) button`,
 * relying on the documented "3 seeded [demo] + 1 new [real]" positional
 * ordering. Rather than force through a DOM-structure change that would
 * require rewriting that many real, expensive, already-passing E2E specs
 * (a call this arc's own "document rather than force through" convention
 * says NOT to force through unilaterally), this pass keeps `products` as
 * ONE array in the EXACT SAME order/count as before (demo items still
 * seeded first, so still occupy the same leading positions), and instead
 * closes the ACTUAL gap the arc mandate names -- "no distinguishing
 * signal" -- by labeling every item with `isDemo`, computed purely from
 * this fixed, closed id set (never a guess/heuristic). The renderer
 * (`fedos_electron_beta_renderer.ts`) renders an explicit "DEMO" pill on
 * every `isDemo: true` row so a real listing can never be mistaken for a
 * demo one or vice versa -- the "silently blended, zero distinguishing
 * signal" problem is fixed; the DOM restructuring is deliberately left
 * undone, documented here and in this arc's own final report.
 */
const COMMERCE_DEMO_PRODUCT_IDS: ReadonlySet<string> = new Set(FEDOS_COMMERCE_DEMO_PRODUCTS.map((p) => p.id));

async function handleCommerceCatalogList() {
  const discoveryAttempt = await commerceNostrDiscoverAndIngestProductsNonFatal();
  const localProducts = commerceState().products.listPublished();
  const localIds = new Set(localProducts.map((product) => product.id));
  const discovered = commerceNostrDiscoveredActiveProducts(localIds);
  const products = [
    ...localProducts.map((product) => ({
      id: product.id,
      title: product.title,
      priceCents: product.priceCents,
      currency: product.currency,
      merchantLabel: commerceMerchantLabelFor(product.creatorPubkey),
      status: product.status,
      hasImage: commerceProductMediaFor(product.id) !== null,
      isDemo: COMMERCE_DEMO_PRODUCT_IDS.has(product.id),
    })),
    ...discovered.map((product) => ({
      id: product.productId,
      title: product.title,
      priceCents: product.priceCents,
      currency: product.currency,
      merchantLabel: commerceMerchantLabelFor(product.creatorPubkeyHex),
      status: product.status,
      // No wired media path for a Nostr-discovered listing yet (same
      // scoping decision `commerceProductMediaFor()`'s own comment
      // already states for an un-imaged local product) -- never a fake
      // placeholder photo.
      hasImage: false,
      // A Nostr-discovered product can never be one of the fixed local demo
      // fixtures (those are never published to Nostr) -- always real.
      isDemo: false,
    })),
  ];
  const realListingCount = products.filter((item) => !item.isDemo).length;
  return {
    outcome: "ok",
    products,
    discoveryAttempt,
    networkProfile: commerceNetworkProfile,
    hasConfiguredRelay: activeRelays.length > 0,
    realListingCount,
  };
}

/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
 * ledger row #24 / arc §30: draft/unpublished product preview. `actorPubkey`
 * is OPTIONAL and additive -- every EXISTING caller (the public Commerce
 * catalog's buyer-facing product-detail view) omits it and gets EXACTLY
 * the prior published-only behavior, unchanged. When supplied, a product
 * absent from `listPublished()` (draft/archived) is still returned, but
 * ONLY if `actorPubkey` matches the product's own `creatorPubkey` -- the
 * same "creator only may view a non-active product" rule
 * `src/os/commerce/catalog/policy.ts`'s `canViewProduct()` already
 * encodes (inlined here as a direct equality check, matching this file's
 * own established convention for creator/owner checks elsewhere, e.g.
 * `handleCommerceDeliveryAcknowledgeReceipt`'s `order.buyerPubkey !==
 * body.actorPubkey` check, rather than adding a new domain-module export
 * seam for one read path). This reuses the SAME renderer render function
 * (`renderCommerceProductDetail`) a buyer's real product view already
 * uses -- never a second, visually-divergent preview implementation.
 */
async function handleCommerceProductDetail(payload: unknown) {
  const body = payload as { productId?: unknown; actorPubkey?: unknown } | null;
  const productId = body?.productId;
  if (!isBoundedString(productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };

  // Real Two-Party Commerce + UX P0/P1 Closure arc (coordinator merge of
  // Agent N's discovery fallback + Agent S's draft/preview fallback --
  // both extend this same read path along independent axes, combined
  // here rather than picking one):
  //   1. Published, locally-known product (both agents' common base case).
  //   2. Agent S (friction ledger row #24 / arc §30): a draft/archived
  //      product is still returned, but ONLY to its own creator
  //      (`actorPubkey === creatorPubkey`) -- lets a seller preview their
  //      own unpublished listing through the SAME renderer a buyer's real
  //      view uses. `isPreview: true` tells the renderer to badge it.
  //   3. Agent N (real two-party data plane): if still not found locally
  //      at all, fall back to a Nostr-discovered listing -- e.g. a buyer
  //      opening the detail view of a product their OWN process never
  //      locally created. Re-runs discovery (idempotent, cheap given the
  //      read model's own dedup) so a deep link straight to a detail view,
  //      without visiting the catalog first, still works.
  const previewActorPubkey = isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) && body.actorPubkey.length > 0 ? body.actorPubkey : undefined;
  let product = commerceState().products.listPublished().find((candidate) => candidate.id === productId);
  let isPreview = false;
  if (product === undefined && previewActorPubkey !== undefined) {
    const candidate = commerceState().products.get(productId);
    if (candidate !== undefined && candidate.creatorPubkey === previewActorPubkey) {
      product = candidate;
      isPreview = true;
    }
  }
  if (product !== undefined) {
    const media = commerceProductMediaFor(product.id);
    return {
      outcome: "ok",
      product: {
        id: product.id,
        title: product.title,
        description: product.description ?? "",
        priceCents: product.priceCents,
        currency: product.currency,
        merchantLabel: commerceMerchantLabelFor(product.creatorPubkey),
        // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- additive
        // field, needed by the renderer's new Seller Reputation panel to
        // query `fedos-app:commerce-persona-board-query` for this product's
        // seller. Never a secret -- `creatorPubkey` is already exposed
        // (indirectly, via `merchantLabel`'s own lookup) and is the same
        // pubkey every Order this product produces already carries as
        // `sellerPubkey`.
        creatorPubkey: product.creatorPubkey,
        status: product.status,
        media: media === null ? null : { dataUri: media.dataUri, mimeType: media.mimeType, altText: media.altText },
        isPreview,
        ...commerceProductMediaDeclarationSummaryFor(product.id, product.creatorPubkey),
      },
    };
  }

  await commerceNostrDiscoverAndIngestProductsNonFatal();
  const discovered = commerceNostrReadModelFor().getProduct(productId) as CommerceReadModelProductViewLike | undefined;
  if (discovered === undefined || discovered.status !== "active") return { outcome: "not-found", reason: "no such product" };
  return {
    outcome: "ok",
    product: {
      id: discovered.productId,
      title: discovered.title,
      description: discovered.description ?? "",
      priceCents: discovered.priceCents,
      currency: discovered.currency,
      merchantLabel: commerceMerchantLabelFor(discovered.creatorPubkeyHex),
      creatorPubkey: discovered.creatorPubkeyHex,
      status: discovered.status,
      media: null,
      // A Nostr-discovered listing is by definition already published
      // (the read model only ever ingests/serves "active" products, see
      // the `discovered.status !== "active"` guard above) -- never a
      // preview of the viewer's OWN draft, so this is always `false` here.
      isPreview: false,
      ...commerceProductMediaDeclarationSummaryFor(discovered.productId, discovered.creatorPubkeyHex),
    },
  };
}

// ---------------------------------------------------------------------
// Merchant Product CRUD (Commerce E2E Completion arc).
//
// `actorPubkey` always travels explicitly with every call, never inferred
// from "currently selected" state (Secure Runtime Alpha 8121-8200's own
// established discipline for exactly this class of bug) -- the renderer's
// demo "acting as" selector (see `fedos_electron_beta_renderer.ts`) is the
// ONLY source of it, and `LocalProductRepository` re-derives+checks
// `canEditProduct()` on every mutating call regardless of what the
// renderer claims.
// ---------------------------------------------------------------------

function commerceProductDto(product: CommerceProductLike) {
  return {
    id: product.id,
    title: product.title,
    description: product.description ?? "",
    priceCents: product.priceCents,
    currency: product.currency,
    status: product.status,
    visibility: product.visibility,
    creatorPubkey: product.creatorPubkey,
    merchantLabel: commerceMerchantLabelFor(product.creatorPubkey),
  };
}

async function handleCommerceMerchantProductsList(payload: unknown) {
  const actorPubkey = (payload as { actorPubkey?: unknown } | null)?.actorPubkey;
  if (!isBoundedString(actorPubkey, MAX_ID_LENGTH) || actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  const products = commerceState().products.listOwnedByMerchant(actorPubkey);
  return { outcome: "ok", products: products.map(commerceProductDto) };
}

/**
 * Buyer Discovery + Digital Content Delivery mega-arc (Agent M) — a
 * read-only, creator-only listing of every `ProductMedia` record attached
 * to a product, plain-language `classification` included, so the seller's
 * own Create/Edit-product UI can show a clear, non-technical "what buyers
 * will see before they pay vs. after" summary BEFORE publish (mandate
 * requirement: "make sure the seller's create-product UI clearly,
 * non-technically communicates which is which"). Never returns
 * `storageRef`/`checksum`/`checksumSubject` — only what a plain-language
 * seller-facing list needs (`role`/`classification`/`contentType`/
 * `label`). `canEditProduct`-equivalent creator-only gate (same direct
 * equality check this file already uses for read paths, e.g.
 * `handleCommerceProductDetail`'s own `creatorPubkey === previewActorPubkey`) —
 * a product's attached-content list is never shown to a non-owner via
 * this channel (a buyer's own separate view of a product's public/
 * protected media is `commerceProductMediaFor()`/`handleCommerceMediaGrantRedeem()`,
 * both already creator-agnostic by design for their own reasons).
 */
async function handleCommerceMerchantProductMediaList(payload: unknown) {
  const body = payload as { actorPubkey?: unknown; productId?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  const product = commerceState().products.get(body.productId);
  if (product === undefined) return { outcome: "not-found", reason: "no such product" };
  if (product.creatorPubkey !== body.actorPubkey) {
    return { outcome: "forbidden", reason: "only this product's own creator may view its attached-content list" };
  }
  const media = commerceProductMediaState().listForProduct(body.productId);
  return {
    outcome: "ok",
    media: media.map((item) => ({
      id: item.id,
      role: item.role,
      classification: item.classification,
      contentType: item.contentType,
      label: item.altText ?? "",
    })),
  };
}

/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
 * ledger row #2 / arc §12: the P0 "Unknown merchant" mis-attributed
 * listing fix. `actorRole` travels explicitly with EVERY create call,
 * exactly the same discipline this section's own header already
 * documents for `actorPubkey` ("always travels explicitly ... never
 * inferred from 'currently selected' state") -- the renderer derives it
 * from whichever identity is actually acting (see
 * `fedos_electron_beta_renderer.ts`'s `onCommerceMerchantCreateSubmit()`),
 * never a hardcoded literal here. This handler is the FIRST enforcement
 * point (fails closed on a malformed/missing role before the domain is
 * even called); `LocalProductRepository`/`DurableProductRepository.create()`
 * (`src/os/commerce/catalog/policy.ts`'s `canCreateProduct()`) is the
 * AUTHORITATIVE second one -- a renderer bug that always sent
 * `actorRole: "merchant"` regardless of the real UI state would defeat
 * this handler-level check, but see that domain function's own header:
 * this is a known, disclosed limitation of asserting capacity without a
 * separate merchant-registration system, not a silent gap.
 */
async function handleCommerceProductCreate(payload: unknown) {
  const body = payload as { actorPubkey?: unknown; actorRole?: unknown; title?: unknown; description?: unknown; priceCents?: unknown; currency?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (body.actorRole !== "customer" && body.actorRole !== "merchant") {
    return { outcome: "invalid-input", reason: "actorRole must be \"customer\" or \"merchant\"" };
  }
  if (!isBoundedString(body.title, MAX_PRODUCT_TITLE_CHARS) || body.title.trim().length === 0) {
    return { outcome: "invalid-input", reason: "malformed title" };
  }
  if (typeof body.priceCents !== "number" || !Number.isInteger(body.priceCents) || body.priceCents < 0) {
    return { outcome: "invalid-input", reason: "priceCents must be a non-negative integer" };
  }
  if (!isBoundedString(body.currency, MAX_CURRENCY_CHARS) || body.currency.trim().length === 0) {
    return { outcome: "invalid-input", reason: "malformed currency" };
  }
  const description = isBoundedString(body.description, MAX_PRODUCT_DESCRIPTION_CHARS) ? body.description : undefined;
  const result = commerceState().products.create(body.actorPubkey, {
    kind: "other",
    title: body.title,
    description,
    priceCents: body.priceCents,
    currency: body.currency,
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
    actorRole: body.actorRole,
  });
  if (result.outcome !== "ok" || result.product === undefined) return { outcome: result.outcome, reason: result.reason };
  return { outcome: "ok", product: commerceProductDto(result.product) };
}

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- friction-ledger row #17 / arc §38: the first real IPC path
 * reaching `LocalProductMediaRepository`/`IpfsMediaStore.putPublic()`
 * (both previously "inert scaffolding, not reachable from the shipped
 * Electron app" per their own file headers). IMAGE-level, PUBLIC media
 * only, by explicit arc scope -- `classification` is always `"public"`
 * here, never caller-suppliable, and `contentType` is checked against a
 * small, real-image-only allowlist (never `application/pdf`/`application/zip`,
 * which `commerceMediaStoreFor()`'s own supported-content-types set
 * permits for OTHER callers but this handler does not offer). Content
 * ownership is enforced by `LocalProductMediaRepository.add()`'s own
 * `canEditProduct()` check (same authority discipline as
 * `handleCommerceProductUpdate` below) -- never trusted as a bare
 * `actorPubkey` claim alone.
 */
async function handleCommerceProductImageAttach(payload: unknown) {
  const body = payload as { actorPubkey?: unknown; productId?: unknown; imageBase64?: unknown; contentType?: unknown; altText?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  if (!isBoundedString(body.contentType, MAX_PRODUCT_IMAGE_CONTENT_TYPE_CHARS) || !COMMERCE_PUBLIC_IMAGE_CONTENT_TYPES.has(body.contentType)) {
    return { outcome: "invalid-input", reason: `contentType must be one of: ${[...COMMERCE_PUBLIC_IMAGE_CONTENT_TYPES].join(", ")}` };
  }
  if (!isBoundedString(body.imageBase64, MAX_PRODUCT_IMAGE_BASE64_CHARS) || body.imageBase64.length === 0) {
    return { outcome: "invalid-input", reason: "malformed or missing image data" };
  }
  const altText = isBoundedString(body.altText, MAX_PRODUCT_IMAGE_ALT_TEXT_CHARS) ? body.altText : undefined;

  const product = commerceState().products.get(body.productId);
  if (product === undefined) return { outcome: "not-found", reason: "no such product" };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(body.imageBase64, "base64"));
  } catch {
    return { outcome: "invalid-input", reason: "image data is not valid base64" };
  }
  if (bytes.length === 0) return { outcome: "invalid-input", reason: "image data decoded to zero bytes" };

  const putResult = commerceMediaStoreFor().putPublic(bytes, body.contentType);
  if (putResult.outcome !== "stored" && putResult.outcome !== "already-present") {
    return { outcome: "rejected", reason: `image storage failed: ${putResult.outcome}` };
  }

  const addResult = commerceProductMediaState().add(body.actorPubkey, product, {
    role: "primary",
    classification: "public",
    contentType: body.contentType,
    sizeBytes: putResult.metadata.sizeBytes,
    checksum: putResult.metadata.checksum,
    checksumSubject: "plaintext",
    altText,
    storageRef: putResult.metadata.key,
  });
  if (addResult.outcome !== "ok") return { outcome: addResult.outcome, reason: addResult.reason };
  await publishCommerceProductMediaDeclarationNonFatal(addResult.media, product.creatorPubkey);

  return {
    outcome: "ok",
    media: { id: addResult.media.id, productId: addResult.media.productId, contentType: addResult.media.contentType, altText: addResult.media.altText ?? "" },
  };
}

/**
 * Buyer Discovery + Digital Content Delivery mega-arc (Agent M) —
 * P0-2's content-creation half: "no production product can currently be
 * marked/provisioned as protected purchased content." This is the first
 * real IPC path that ever calls `commerceMediaStoreFor().putProtected()`
 * with a REAL, caller-chosen `classification: "protected"` — until this
 * handler, `classification` was reachable from exactly one place
 * (`handleCommerceProductImageAttach()` above) and that path always wrote
 * `"public"`, hard-coded. This handler is deliberately SEPARATE from that
 * one, never a shared branch on a caller-suppliable `classification`
 * field — a seller cannot accidentally (or a hostile renderer bug cannot)
 * downgrade a protected upload to public or vice versa by flipping one
 * field; which handler is called IS the classification.
 *
 * SELLER LANGUAGE, NEVER INTERNALS: this handler's own request/response
 * shape never accepts or returns a CID, an AEAD/content-key detail, a
 * `MediaAccessGrant`, or a ciphertext hash — only `contentType`/`label`
 * in, and `media.id`/`media.contentType`/`media.label` out (mirrors
 * `handleCommerceProductImageAttach()`'s own `media` response shape,
 * which likewise never echoes `storageRef`/`checksum`).
 *
 * UNTRUSTED INPUT, validated the same way every other seller-input
 * handler in this file already does (never a new discipline):
 *   - `contentType` is checked against `COMMERCE_PROTECTED_CONTENT_TYPES`
 *     — a small, closed, non-scriptable allowlist (PDF/ZIP, this domain's
 *     own pre-existing "purchased deliverable" MIME precedent,
 *     `sample_products.ts`), never `text/html`/`image/svg+xml`/anything
 *     that could be interpreted as active content by any future viewer.
 *     Resolved through `canonicalCommerceProtectedContentType()`, which
 *     additionally accepts a tiny closed set of platform ALIASES for those
 *     same two types (notably Windows' own `application/x-zip-compressed`
 *     spelling of `.zip`) and always returns the CANONICAL value that is
 *     then used for storage and for the `ProductMedia` record — see that
 *     function's own doc comment. The allowlist itself is unchanged; no
 *     new format is admitted.
 *   - `contentBase64` is bounded BEFORE decode
 *     (`MAX_PRODUCT_CONTENT_BASE64_CHARS`) and `IpfsMediaStore.put()`
 *     itself re-bounds the DECODED ciphertext against
 *     `COMMERCE_MEDIA_MAX_PAYLOAD_BYTES` — belt and suspenders, never a
 *     single source of truth, mirroring the image-attach handler's own
 *     documented discipline.
 *   - `label` (the seller-facing display name, e.g. "Full guide PDF") is
 *     validated by `isSafeProductContentLabel()` — bounded, non-blank,
 *     no path separators, no `..` traversal segment, no control
 *     characters — even though the REAL storage key is always the
 *     content-addressed CID `putProtected()` derives, never this label;
 *     this is defense-in-depth against any future code path that might
 *     someday treat a "file name"-shaped field as a path.
 *   - A malformed base64 payload is caught and reported as
 *     `"invalid-input"`, never an unhandled throw/crash (mirrors
 *     `handleCommerceProductImageAttach()`'s own identical try/catch).
 *
 * REAL ENCRYPTION, NOT A NEW PRIMITIVE: routes through the EXISTING
 * `commerceMediaStoreFor().putProtected()` (`./ipfs_media_store.ts`),
 * which always calls the injected `WasmProductMediaEncryption` first and
 * structurally cannot reach `put()` with plaintext (that file's own
 * header, "ENFORCEMENT MECHANISM"). `checksumSubject: "ciphertext"` is
 * the only value `validateProductMedia()` accepts for `classification:
 * "protected"` (`product_media_types.ts`) — this handler's own literal
 * matches that invariant, never left to caller discipline.
 *
 * COMPATIBILITY WITH THE BUYER-SIDE REDEEM PATH (Agent A's scope, not
 * rebuilt here): `handleCommerceMediaGrantRedeem()` (below) already reads
 * `commerceProductMediaState().listForProduct(...).filter(classification
 * === "protected")` and calls `commerceMediaStoreFor().getProtected(media.storageRef)`
 * — a `ProductMedia` record created here (real `storageRef` from a real
 * `putProtected()` call, real `checksum`/`checksumSubject`) is exactly
 * the shape that path already expects; nothing about that reader was
 * changed by this handler.
 */
async function handleCommerceProductContentAttach(payload: unknown) {
  const body = payload as { actorPubkey?: unknown; productId?: unknown; contentBase64?: unknown; contentType?: unknown; label?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  if (!isBoundedString(body.contentType, MAX_PRODUCT_CONTENT_TYPE_CHARS)) {
    return { outcome: "invalid-input", reason: "malformed contentType" };
  }
  const contentType = canonicalCommerceProtectedContentType(body.contentType);
  if (contentType === null) {
    return { outcome: "invalid-input", reason: "Only PDF and ZIP files can be attached as a purchased file." };
  }
  if (!isBoundedString(body.contentBase64, MAX_PRODUCT_CONTENT_BASE64_CHARS) || body.contentBase64.length === 0) {
    return { outcome: "invalid-input", reason: "malformed or missing content data" };
  }
  if (!isSafeProductContentLabel(body.label)) {
    return { outcome: "invalid-input", reason: "label must be a short, non-blank name with no path separators or control characters" };
  }
  const label = body.label;

  const product = commerceState().products.get(body.productId);
  if (product === undefined) return { outcome: "not-found", reason: "no such product" };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(body.contentBase64, "base64"));
  } catch {
    return { outcome: "invalid-input", reason: "content data is not valid base64" };
  }
  if (bytes.length === 0) return { outcome: "invalid-input", reason: "content data decoded to zero bytes" };

  const putResult = await commerceMediaStoreFor().putProtected(bytes, contentType);
  if (putResult.outcome !== "stored" && putResult.outcome !== "already-present") {
    // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Coordinator
    // validation-gate fix) -- this branch used to emit exactly one string,
    // "protected content storage failed: failed", for every one of these
    // structurally different causes, log nothing anywhere, and leave the
    // seller with no next action. Both halves are fixed: a distinct,
    // actionable sentence per closed-vocabulary outcome, and a real
    // durable diagnostic record (`<dataDir()>/logs/`) plus the console
    // mirror this file already uses everywhere else.
    recordDiagnosticEvent("commerce-protected-content-attach-failed", {
      outcome: putResult.outcome,
      productId: body.productId,
      contentType,
      plaintextBytes: bytes.length,
      profileUnlocked: activeMasterSeedAuthority !== null,
    });
    return { outcome: "rejected", reason: commerceProtectedContentAttachFailureReason(putResult.outcome) };
  }

  const addResult = commerceProductMediaState().add(body.actorPubkey, product, {
    role: "sample",
    classification: "protected",
    contentType,
    sizeBytes: putResult.metadata.sizeBytes,
    checksum: putResult.metadata.checksum,
    checksumSubject: "ciphertext",
    altText: label,
    storageRef: putResult.metadata.key,
  });
  if (addResult.outcome !== "ok") return { outcome: addResult.outcome, reason: addResult.reason };
  // Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) —
  // THE fix for the arc's own headline gap: a buyer's independently-running
  // process previously had no protocol-level way to learn a Product has
  // protected purchased content at all. Best-effort/non-fatal, mirrors
  // every other private/public Nostr publish call site in this file — the
  // local attach itself already succeeded and is never rolled back on a
  // sync failure.
  await publishCommerceProductMediaDeclarationNonFatal(addResult.media, product.creatorPubkey);

  return {
    outcome: "ok",
    media: { id: addResult.media.id, productId: addResult.media.productId, contentType: addResult.media.contentType, label: addResult.media.altText ?? "" },
  };
}

async function handleCommerceProductUpdate(payload: unknown) {
  const body = payload as { actorPubkey?: unknown; productId?: unknown; title?: unknown; description?: unknown; priceCents?: unknown; currency?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!isBoundedString(body.title, MAX_PRODUCT_TITLE_CHARS)) return { outcome: "invalid-input", reason: "malformed title" };
    patch.title = body.title;
  }
  if (body.description !== undefined) {
    if (!isBoundedString(body.description, MAX_PRODUCT_DESCRIPTION_CHARS)) return { outcome: "invalid-input", reason: "malformed description" };
    patch.description = body.description;
  }
  if (body.priceCents !== undefined) {
    if (typeof body.priceCents !== "number" || !Number.isInteger(body.priceCents) || body.priceCents < 0) {
      return { outcome: "invalid-input", reason: "priceCents must be a non-negative integer" };
    }
    patch.priceCents = body.priceCents;
  }
  if (body.currency !== undefined) {
    if (!isBoundedString(body.currency, MAX_CURRENCY_CHARS)) return { outcome: "invalid-input", reason: "malformed currency" };
    patch.currency = body.currency;
  }
  const result = commerceState().products.update(body.actorPubkey, body.productId, patch);
  if (result.outcome !== "ok" || result.product === undefined) return { outcome: result.outcome, reason: result.reason };
  // FedOS Commerce FINAL Closure Mega-Arc (Agent N, discovery wiring pass)
  // -- arc §10 "create/update/unpublish-archive sync": editing an ALREADY
  // PUBLIC product (`status !== "draft"`) must ALSO sync the changed
  // fields to Nostr, exactly like `handleCommerceProductPublish()` already
  // does for publish/unpublish. A still-`"draft"` product's edit is never
  // published -- its metadata is not yet the creator's public word (same
  // discipline `commerce_nostr_event_drafts.ts`'s own header states for
  // why `"draft"` is excluded from `CommercePublicProductStatus`).
  let nostrSyncOutcome: string | undefined;
  if (result.product.status !== "draft" && Object.keys(patch).length > 0) {
    nostrSyncOutcome = await publishCommerceNostrProductFieldUpdateNonFatal(result.product, patch, Math.floor(Date.now() / 1000));
  }
  return { outcome: "ok", product: commerceProductDto(result.product), nostrSyncOutcome };
}

const COMMERCE_NOSTR_PRODUCT_KIND_MIRROR_VALUES: readonly string[] = ["pdf", "zip", "template", "software", "link", "other"];

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- the ONE real
 * caller of `commerceNostrOutboundPortFor()` this pass wires: publishing
 * (or unpublishing) a product ALSO attempts a real, best-effort Nostr
 * announcement. Entirely NON-FATAL relative to the local Commerce
 * transaction that already committed before this is called (mirrors
 * `issueReputationAttestationsForCompletedOrderNonFatal()`'s own
 * discipline exactly) -- and, while `commerceNetworkProfile` stays at its
 * safe `"local-only"` default, this never reaches a network call at all
 * (`CommerceNostrEventPortImpl.publish()`'s own `evaluateNetworkAccess()`
 * gate refuses it before the transport is ever touched).
 */
async function publishCommerceNostrProductEventNonFatal(product: CommerceProductLike, isPublish: boolean, now: number): Promise<string> {
  try {
    const port = commerceNostrOutboundPortFor();
    const productKind = COMMERCE_NOSTR_PRODUCT_KIND_MIRROR_VALUES.includes(product.kind) ? product.kind : "other";
    const draft = isPublish
      ? {
          category: "product-publication" as const,
          formatVersion: 1 as const,
          productId: product.id,
          productKind,
          title: product.title,
          description: product.description,
          creatorPubkey: product.creatorPubkey,
          priceCents: product.priceCents,
          currency: product.currency,
          status: "active" as const,
          publishedAt: now,
        }
      : {
          category: "product-update" as const,
          formatVersion: 1 as const,
          productId: product.id,
          status: "archived" as const,
          updatedAt: now,
        };
    const result = await port.publish(draft);
    return result.outcome;
  } catch (err) {
    console.error("fedos-beta: Nostr Commerce publication attempt failed (non-fatal, local Commerce state unaffected):", err);
    return "transport-error";
  }
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (Agent N, discovery wiring pass) --
 * the `product-update` sibling of `publishCommerceNostrProductEventNonFatal`
 * above, used when an ALREADY-PUBLIC product's fields change (title/
 * description/priceCents/currency), as opposed to a bare publish/unpublish
 * status flip. Same non-fatal discipline: a failure here NEVER unwinds the
 * already-committed local `LocalProductRepository.update()` -- it only
 * affects the OPTIONAL `nostrSyncOutcome` this function's own return value
 * feeds back to the caller (arc §42 "sync pending", never a silent false
 * "published everywhere" claim).
 */
async function publishCommerceNostrProductFieldUpdateNonFatal(
  product: CommerceProductLike,
  patch: Record<string, unknown>,
  now: number,
): Promise<string> {
  try {
    const port = commerceNostrOutboundPortFor();
    const draft: Record<string, unknown> = { category: "product-update", formatVersion: 1, productId: product.id, updatedAt: now };
    if (typeof patch.title === "string") draft.title = patch.title;
    if (typeof patch.description === "string") draft.description = patch.description;
    if (typeof patch.priceCents === "number") draft.priceCents = patch.priceCents;
    if (typeof patch.currency === "string") draft.currency = patch.currency;
    const result = await port.publish(draft);
    return result.outcome;
  } catch (err) {
    console.error("fedos-beta: Nostr Commerce update-sync attempt failed (non-fatal, local Commerce state unaffected):", err);
    return "transport-error";
  }
}

async function handleCommerceProductPublish(payload: unknown, publish: boolean) {
  const body = payload as { actorPubkey?: unknown; productId?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  const repo = commerceState().products;
  const result = publish ? repo.publish(body.actorPubkey, body.productId) : repo.unpublish(body.actorPubkey, body.productId);
  if (result.outcome !== "ok" || result.product === undefined) return { outcome: result.outcome, reason: result.reason };
  const nostrSyncOutcome = await publishCommerceNostrProductEventNonFatal(result.product, publish, Math.floor(Date.now() / 1000));
  return { outcome: "ok", product: commerceProductDto(result.product), nostrSyncOutcome };
}

// ---------------------------------------------------------------------
// Order + Payment (Commerce E2E Completion arc).
//
// CORE INVARIANT, enforced structurally, not by convention: the ONLY
// caller anywhere in this file that constructs an
// `{ kind: "payment_evidence" }` actor is `handleCommercePaymentSimulate`
// below, and ONLY after `commercePaymentLedger.apply()` -- itself only
// ever fed evidence this same process's OWN `DeterministicLocalPaymentProvider`
// produced -- reports `outcome: "transitioned"`. No IPC handler anywhere
// accepts an actor kind, or a raw "mark as paid" boolean, from the
// renderer. See `order_state_machine.ts`'s own module doc for the
// domain-level half of this guarantee (re-checks actor kind against an
// allowlist independent of any caller-suppliable flag).
// ---------------------------------------------------------------------

function commerceOrderDto(order: CommerceOrderLike) {
  return {
    id: order.id,
    productId: order.productId,
    buyerPubkey: order.buyerPubkey,
    sellerPubkey: order.sellerPubkey,
    status: order.status,
    quantity: order.quantity,
    unitPriceCents: order.unitPriceCents,
    currency: order.currency,
    totalCents: order.unitPriceCents * order.quantity,
    paymentId: order.paymentId ?? null,
    deliveryId: order.deliveryId ?? null,
  };
}

function generateCommerceOrderId(): string {
  // Same convention as `generateFedosProductId()` (`product_id.ts`) --
  // random 128-bit lower-hex -- but a composition-root-local generator
  // rather than importing Agent O's file, matching `RootModules.Commerce`'s
  // established "no `import type` from `src/os/commerce/**`" discipline for
  // this file. `randomBytes` is Node's own built-in, already a transitive
  // dependency of Electron's runtime -- no new package.
  return nodeRandomBytes(16).toString("hex");
}

async function handleCommerceOrderCreate(payload: unknown) {
  const body = payload as { buyerPubkey?: unknown; productId?: unknown; quantity?: unknown } | null;
  if (!isBoundedString(body?.buyerPubkey, MAX_ID_LENGTH) || body.buyerPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed buyerPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };
  const quantity = body.quantity === undefined ? 1 : body.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
    return { outcome: "invalid-input", reason: "quantity must be a positive integer" };
  }
  const product = commerceState().products.listPublished().find((candidate) => candidate.id === body.productId);
  // Real Two-Party Commerce + UX P0/P1 Closure arc (coordinator, closing a
  // real gap the two-process E2E agent found and precisely root-caused
  // live): a buyer could VIEW a Nostr-discovered listing
  // (handleCommerceProductDetail already falls back to the read model,
  // see that function's own header) but could never ORDER it, because
  // this handler only ever checked the caller's own LOCAL repository.
  // Mirrors handleCommerceProductDetail's exact fallback: re-run discovery
  // (idempotent, cheap) if the product isn't already local, then map the
  // SAME discovered-product fields that function already uses.
  let sellerPubkey: string;
  let unitPriceCents: number;
  let currency: string;
  if (product !== undefined) {
    sellerPubkey = product.creatorPubkey;
    unitPriceCents = product.priceCents;
    currency = product.currency;
  } else {
    await commerceNostrDiscoverAndIngestProductsNonFatal();
    const discovered = commerceNostrReadModelFor().getProduct(body.productId) as CommerceReadModelProductViewLike | undefined;
    if (discovered === undefined || discovered.status !== "active") return { outcome: "not-found", reason: "no such published product" };
    sellerPubkey = discovered.creatorPubkeyHex;
    unitPriceCents = discovered.priceCents;
    currency = discovered.currency;
  }

  const m = requireModules();
  const result = m.Commerce.createOrder(
    { id: generateCommerceOrderId(), productId: body.productId, sellerPubkey, unitPriceCents, currency, quantity },
    { kind: "customer", pubkey: body.buyerPubkey },
    Math.floor(Date.now() / 1000),
  );
  if (!result.ok || result.order === undefined) return { outcome: "rejected", reason: result.reason };
  commerceState().orders.save(result.order);
  return { outcome: "ok", order: commerceOrderDto(result.order) };
}

/** Shared by submit/accept/reject/fulfill/cancel -- every action here is a bare customer/merchant claim (`actor.kind` is always `"customer"` or `"merchant"`, NEVER `"payment_evidence"`/`"delivery_evidence"`), so `order_state_machine.ts`'s own actor-kind allowlist rejects any attempt to reach `paid`/`delivered` through this path structurally, independent of this handler's own logic. */
async function handleCommerceOrderAction(payload: unknown, actionType: "submit" | "accept" | "reject" | "cancel" | "fulfill", actorKind: "customer" | "merchant") {
  const body = payload as { orderId?: unknown; actorPubkey?: unknown; reason?: unknown } | null;
  if (!isBoundedString(body?.orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };
  if (!isBoundedString(body.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  const orders = commerceState().orders;
  const order = orders.findById(body.orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };

  const action: Record<string, unknown> = { type: actionType, actor: { kind: actorKind, pubkey: body.actorPubkey } };
  if (actionType === "reject" && body.reason !== undefined) {
    if (!isBoundedString(body.reason, MAX_ORDER_REJECTION_REASON_CHARS)) return { outcome: "invalid-input", reason: "malformed reason" };
    action.reason = body.reason;
  }
  const m = requireModules();
  const result = m.Commerce.applyOrderAction(order, action as CommerceOrderActionLike, Math.floor(Date.now() / 1000));
  if (!result.ok || result.order === undefined) return { outcome: "rejected", reason: result.reason };
  orders.save(result.order);
  /** (Coordinator, integration phase) Agent D's `"fulfilling"` delivery-sync outcome, previously discarded -- see `handleCommerceDeliveryAcknowledgeReceipt`'s own note. Stays `undefined` for every non-fulfill action, so the UI shows no delivery note where no delivery send was ever attempted. */
  let deliverySyncOutcome: string | undefined;
  if (actionType === "fulfill") {
    // Commerce E2E Completion arc (coordinator) -- a successful "fulfill" on
    // the Order side ALSO creates+starts the real Delivery record (Agent
    // D's domain), a self-asserted merchant claim only sufficient to reach
    // Delivery's own "fulfilling" status (never "delivered" -- see
    // `delivery_types.ts`'s own module doc for why that specific transition
    // carries no risk). Best-effort: a Delivery-side failure here does not
    // roll back the already-saved Order transition (mirrors this file's
    // existing posture of never partially-reverting an already-persisted
    // domain transition), but IS surfaced in the response for the renderer
    // to show, never silently swallowed.
    const now = Math.floor(Date.now() / 1000);
    const state = commerceState();
    let delivery = state.deliveries.findByOrderId(result.order.id);
    if (delivery === undefined) {
      const created = m.Commerce.createDelivery(
        { id: generateCommerceOrderId(), orderId: result.order.id, buyerPubkey: result.order.buyerPubkey, sellerPubkey: result.order.sellerPubkey, orderPaymentConfirmed: true },
        { kind: "merchant", pubkey: result.order.sellerPubkey },
        now,
      );
      if (created.ok && created.delivery !== undefined) {
        delivery = created.delivery;
        state.deliveries.save(delivery);
      }
    }
    if (delivery !== undefined) {
      const started = m.Commerce.applyDeliveryAction(
        delivery,
        { type: "start_fulfillment", actor: { kind: "merchant", pubkey: result.order.sellerPubkey }, claim: { deliveryId: delivery.id, orderId: result.order.id, claimedAt: now } },
        now,
      );
      if (started.ok && started.delivery !== undefined) {
        state.deliveries.save(started.delivery);
        // FedOS Commerce Purchase Completion mega-arc (Agent D) --
        // "Cross-process delivery": privately notify the REAL buyer's own
        // independent process of this Delivery, so their process can
        // materialize its own local `DeliveryRecord` (it never had one
        // before this call) rather than staying stuck at "no delivery
        // record for this order yet" forever. Best-effort/non-fatal, same
        // posture as `sendPrivateOrderSyncNonFatal()` immediately below.
        deliverySyncOutcome = await sendPrivateDeliverySyncNonFatal(started.delivery, "fulfilling", result.order.buyerPubkey, now);
      }
    }
    // FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
    // (Agent D) -- arc §35-37 / friction-ledger row #15: the ONE real
    // production trigger point for `MediaAccessGrant` issuance. Best-effort,
    // non-fatal (mirrors the Delivery block immediately above and
    // `issueReputationAttestationsForCompletedOrderNonFatal()`'s own
    // established discipline) -- a grant-issuance failure never reverts or
    // blocks the already-committed Order/Delivery transition.
    await issueCommerceMediaAccessGrantsNonFatal(result.order, now);
  }
  // FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
  // Coordinator-directed pass) -- arc items #4/#5: privately notify the
  // OTHER party of this real, already-committed transition. Recipient is
  // always the counterparty of whichever role just acted -- never the
  // acting party themselves.
  const recipientPubkey = actorKind === "customer" ? result.order.sellerPubkey : result.order.buyerPubkey;
  const syncStatus = ORDER_ACTION_TO_PRIVATE_SYNC_STATUS[actionType] ?? actionType;
  const reasonForSync = typeof action.reason === "string" ? action.reason : undefined;
  const nostrSyncOutcome = await sendPrivateOrderSyncNonFatal(result.order, syncStatus, recipientPubkey, Math.floor(Date.now() / 1000), reasonForSync);
  return { outcome: "ok", order: commerceOrderDto(result.order), nostrSyncOutcome, deliverySyncOutcome };
}

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- see `issueMediaAccessGrantsForOrder()`'s own header
 * (`src/os/commerce/media_grant/media_access_grant_issuance.ts`) for the
 * full gating discipline this wraps: qualifying Order status AND a
 * REAL, resolved signing keypair whose public key equals
 * `order.sellerPubkey` LITERALLY -- never a bare claim, never a
 * self-issued/free mapping. `resolveCommerceMediaGrantSigningKeypair()`
 * mints (once, sealed-at-rest) a real keypair PER CLAIMED `order.sellerPubkey`
 * -- for this app's shipped demo actor identities (`COMMERCE_DEMO_ACTORS`,
 * non-cryptographic fixed constants with no real private key anywhere in
 * this system), that minted keypair's own public key can never equal the
 * literal claimed constant, so `"seller-not-grant-capable"` is the
 * EXPECTED, disclosed, honest outcome here today -- never silently
 * reported as success. See this arc's own final report for the full
 * account.
 */
/**
 * Real Digital Delivery mega-arc (Agent G, Grant Custody pass) — closes
 * Blocker 5. Mints (via THIS process's own real Nostr identity signing
 * authority, `activeNostrSigningAuthority`) and immediately, independently
 * re-verifies a media-grant-signing-key delegation certificate naming
 * `delegateKeyPublicHex` as an authorized delegate of `claimedSellerPubkey`
 * — see `commerce_media_grant_signing_key_delegation_bridge.ts`'s own
 * header for the full mechanism and why this is a real cryptographic proof
 * (never a rubber stamp: a process whose own real identity is NOT actually
 * `claimedSellerPubkey` mints a certificate that fails the
 * `event.pubkey === expectedSellerPubkeyHex` check and correctly gets `[]`
 * back here — this is what prevents one profile from ever vouching for a
 * different real seller's identity). Returns the delegate key as a
 * one-element array on success (ready to pass straight into
 * `sellerAuthorizedDelegateSigningKeys`), or `[]` on ANY failure — never a
 * fabricated authorization, never thrown.
 */
async function commerceCertifyMediaGrantDelegateSigningKey(delegateKeyPublicHex: string, claimedSellerPubkey: string, now: number): Promise<readonly string[]> {
  if (activeNostrSigningAuthority === null) return [];
  try {
    const m = requireModules();
    const certEvent = await m.CommerceNostr.signMediaGrantSigningKeyDelegation(activeNostrSigningAuthority, delegateKeyPublicHex, COMMERCE_NOSTR_ACCOUNT_INDEX, now);
    if (certEvent === null) return [];
    const certResult = await m.CommerceNostr.verifyMediaGrantSigningKeyDelegationEvent(certEvent, {
      expectedSellerPubkeyHex: claimedSellerPubkey,
      expectedDelegateKeyPublicHex: delegateKeyPublicHex,
    });
    return certResult.outcome === "valid" ? [delegateKeyPublicHex] : [];
  } catch (err) {
    console.error("fedos-beta: media-grant-signing-key delegation mint/verify failed (non-fatal, falls back to direct-signer-only, which will correctly deny for a real seller today):", err);
    return [];
  }
}

async function issueCommerceMediaAccessGrantsNonFatal(order: CommerceOrderLike, now: number): Promise<void> {
  try {
    const m = requireModules();
    const media = commerceProductMediaState().listForProduct(order.productId);
    const protectedMedia = media.filter((item) => item.classification === "protected");
    if (protectedMedia.length === 0) return;

    const grantState = commerceMediaGrantState();
    const signingKeyResult = await m.Commerce.resolveCommerceMediaGrantSigningKeypair(
      activeMasterSeedAuthority,
      grantState.signingKeyStore,
      order.sellerPubkey,
      true,
      now,
    );
    if (signingKeyResult.outcome !== "restored" && signingKeyResult.outcome !== "created") {
      console.warn(`fedos-beta: Commerce media-grant signing key unavailable for seller (non-fatal, no protected-media grant issued this pass): ${signingKeyResult.outcome}`);
      return;
    }

    const sellerAuthorizedDelegateSigningKeys = await commerceCertifyMediaGrantDelegateSigningKey(signingKeyResult.keypair.publicKeyHex, order.sellerPubkey, now);

    const existingGrants = grantState.persistence.listGrants();
    const outcome = m.Commerce.issueMediaAccessGrantsForOrder({
      order: { id: order.id, productId: order.productId, buyerPubkey: order.buyerPubkey, sellerPubkey: order.sellerPubkey, status: order.status },
      candidateMedia: protectedMedia.map((item) => ({ id: item.id, productId: item.productId, classification: item.classification })),
      sellerSigningKeypair: signingKeyResult.keypair,
      sellerAuthorizedDelegateSigningKeys,
      latestKnownGrantVersionFor: (mediaId) => m.Commerce.latestGrantVersion(existingGrants, mediaId, order.buyerPubkey, order.id),
      now,
    });
    if (outcome.outcome !== "issued") {
      // "no-protected-media"/"order-not-qualifying" are ordinary,
      // non-noteworthy states; "seller-not-grant-capable" is the disclosed,
      // expected outcome for this app's non-cryptographic demo actors (see
      // this function's own header) -- never escalated to an error log.
      return;
    }
    for (const envelope of outcome.envelopes) {
      grantState.persistence.putGrant(envelope);
    }
  } catch (err) {
    console.error("fedos-beta: Commerce media-grant issuance attempt failed (non-fatal, Order/Delivery unaffected):", err);
  }
}

async function handleCommerceOrdersListMine(payload: unknown) {
  const actorPubkey = (payload as { actorPubkey?: unknown } | null)?.actorPubkey;
  if (!isBoundedString(actorPubkey, MAX_ID_LENGTH) || actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  // FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
  // Coordinator-directed pass) -- bounded reliable-refresh: pull any
  // private Order/status updates this process's own pubkey has received
  // before listing, same posture as the public catalog's own
  // discovery-on-load.
  await commercePrivateOrderDiscoverAndApplyNonFatal();
  // FedOS Commerce Purchase Completion mega-arc (Agent D) -- same bounded
  // refresh, for the Delivery-sync channel (arc "Cross-process delivery").
  // FedOS Commerce Purchase Completion mega-arc (Agent P's transport,
  // wired by the Coordinator) -- payment evidence is pulled BEFORE the
  // Delivery pass on purpose: a Delivery event's reconciliation depends on
  // this process's Order having already reached a payment-confirmed status
  // (see `applyInboundPrivatePaymentEvidenceNonFatal()`'s own header).
  await commercePrivatePaymentEvidenceDiscoverAndApplyNonFatal();
  await commercePrivateDeliveryDiscoverAndApplyNonFatal();
  // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- same
  // bounded reliable-refresh, for the media-release request/response
  // channel (seller-side answer, then buyer-side apply).
  await commercePrivateMediaReleaseRequestDiscoverAndRespondNonFatal();
  await commercePrivateMediaReleaseDiscoverAndApplyNonFatal();
  return { outcome: "ok", orders: commerceState().orders.listByBuyer(actorPubkey).map(commerceOrderDto) };
}

async function handleCommerceOrdersListIncoming(payload: unknown) {
  const actorPubkey = (payload as { actorPubkey?: unknown } | null)?.actorPubkey;
  if (!isBoundedString(actorPubkey, MAX_ID_LENGTH) || actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  await commercePrivateOrderDiscoverAndApplyNonFatal();
  // FedOS Commerce Purchase Completion mega-arc (Agent P's transport,
  // wired by the Coordinator) -- payment evidence is pulled BEFORE the
  // Delivery pass on purpose: a Delivery event's reconciliation depends on
  // this process's Order having already reached a payment-confirmed status
  // (see `applyInboundPrivatePaymentEvidenceNonFatal()`'s own header).
  await commercePrivatePaymentEvidenceDiscoverAndApplyNonFatal();
  await commercePrivateDeliveryDiscoverAndApplyNonFatal();
  // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- same
  // bounded reliable-refresh, for the media-release request/response
  // channel (seller-side answer, then buyer-side apply).
  await commercePrivateMediaReleaseRequestDiscoverAndRespondNonFatal();
  await commercePrivateMediaReleaseDiscoverAndApplyNonFatal();
  return { outcome: "ok", orders: commerceState().orders.listBySeller(actorPubkey).map(commerceOrderDto) };
}

async function handleCommercePaymentRequest(payload: unknown) {
  const orderId = (payload as { orderId?: unknown } | null)?.orderId;
  if (!isBoundedString(orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };
  const state = commerceState();
  const order = state.orders.findById(orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };
  if (order.status !== "accepted") return { outcome: "rejected", reason: `order must be "accepted" before a payment request can be made (currently "${order.status}")` };

  // Commerce Real Two-Party UX Closure (Agent U) -- `order.id` is the
  // idempotency key: this is a request to pay THIS order, so any repeat
  // request for the same order (double-click before the button-disable
  // below takes effect, or a retried IPC call) must resolve to the SAME
  // paymentId, never mint a second orphaned one in the durable
  // `DurablePaymentSettlementLedger`. Mirrors `PlaceholderPaymentProvider`'s
  // own established idempotency contract exactly (see
  // `os/commerce/payment/noop_payment.ts`) -- no new mechanism invented.
  const decision = await state.payments.requestPayment({
    productId: order.productId,
    orderId: order.id,
    buyerPubkey: order.buyerPubkey,
    amountCents: order.unitPriceCents * order.quantity,
    currency: order.currency,
    idempotencyKey: order.id,
  });
  if (!decision.allowed || decision.paymentId === undefined) return { outcome: "rejected", reason: decision.reason };
  // Commerce Real Two-Party UX Closure (Agent U) -- an idempotent replay
  // (same `decision.paymentId` as an already-bound request for this same
  // order) must NOT call `bind()` again: `DurablePaymentSettlementLedger`/
  // `PaymentSettlementLedger.bind()` both throw on a duplicate paymentId
  // (see that class's own doc comment) -- without this guard, honoring
  // `idempotencyKey` above would just move the double-click crash from "two
  // orphaned paymentIds" to "an unhandled bind() throw on the second click."
  if (state.ledger.get(decision.paymentId) === undefined) {
    state.ledger.bind(decision.paymentId, order.id, order.productId);
  }
  return { outcome: "ok", paymentId: decision.paymentId, amountCents: order.unitPriceCents * order.quantity, currency: order.currency, reason: decision.reason };
}

/**
 * The ONLY place in this file that can move an Order to `"paid"`. Two
 * independent authoritative-evidence checks stack here: (1) this process's
 * own `DeterministicLocalPaymentProvider.simulateSettlement()` is the ONLY
 * producer of the `PaymentEvidence` fed into `commercePaymentLedger.apply()`
 * (never a renderer-supplied evidence object -- the renderer sends only
 * `orderId`/`paymentId`, never a `verification`/`status` field, see
 * `fedos_electron_beta_preload.cts`), and (2) `commercePaymentLedger.apply()`
 * itself re-derives `PaymentEvidence.verification.source` against
 * `payment/state_machine.ts`'s own allowlist before transitioning. Only
 * once BOTH agree does this handler construct the
 * `{ kind: "payment_evidence" }` order actor.
 */
async function handleCommercePaymentSimulate(payload: unknown) {
  const body = payload as { orderId?: unknown; paymentId?: unknown } | null;
  if (!isBoundedString(body?.orderId, MAX_ID_LENGTH) || !isBoundedString(body.paymentId, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed orderId/paymentId" };
  }
  const state = commerceState();
  const order = state.orders.findById(body.orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };

  // FedOS Commerce "Purchase Completion" mega-arc (Two-Process E2E agent) --
  // REAL BUG FIX, found live by the two-independent-process E2E suite
  // (`packages/fedos-desktop-electron-spike/test/commerce_e2e_two_process_real_electron.test.ts`),
  // pre-existing since `d6c3a942`. This call used to pass `"settled"`,
  // which is NOT a member of `SimulatedSettlementOutcome`
  // (`"paid" | "failed" | "expired" | "refunded" | "disputed"`, see
  // `src/os/commerce/payment/local_simulator.ts`) -- and could not be
  // caught by the compiler because this file's own structural mirror of
  // that provider declared the wrong vocabulary too (now corrected; see
  // `CommerceLocalPaymentProviderLike` above). At runtime the damage was
  // real and entirely silent:
  //
  //   1. `DeterministicLocalPaymentProvider` stored the unrecognized
  //      `"settled"` as the ledger entry's own status, so its private
  //      `statusMap` lookup missed and `PaymentEvidence.status` came back
  //      `undefined`.
  //   2. `applySettlementEvidence()` maps an unrecognized evidence status
  //      through its `default:` arm to `"failed"` -- and `pending -> failed`
  //      IS a legal edge -- so `state.ledger.apply()` returned
  //      `"transitioned"` while durably recording the buyer's own payment
  //      as FAILED. `"failed"` is fully terminal in `ALLOWED_TRANSITIONS`,
  //      so nothing could ever repair it afterwards.
  //   3. This handler nonetheless moved the ORDER to `"paid"`, because the
  //      order action it builds below carries its own hard-coded
  //      `status: "settled"` rather than the provider's real evidence --
  //      leaving the two payment authorities on one device permanently
  //      disagreeing, with no error shown anywhere.
  //   4. `buildOutboundPaymentEvidenceSyncPayload()` then (CORRECTLY)
  //      refused to package that malformed evidence for transport, so the
  //      cross-process PaymentEvidence channel Agent P + the Coordinator
  //      built was dead on arrival: no seller could ever learn a payment
  //      happened. The outbound authority gate was never at fault -- it was
  //      the only layer that noticed.
  //
  // Passing the provider's own real `"paid"` outcome fixes all four. No
  // validation anywhere is relaxed by this change.
  const evidence = await state.payments.simulateSettlement(body.paymentId, "paid");
  const applied = state.ledger.apply(evidence, order.id);
  if (applied.outcome !== "transitioned") return { outcome: "rejected", reason: applied.reason ?? `settlement ledger: ${applied.outcome}` };

  const m = requireModules();
  const paymentEvidenceAction: Record<string, unknown> = {
    type: "confirm_payment",
    actor: { kind: "payment_evidence" },
    evidence: { orderId: order.id, paymentId: body.paymentId, status: "settled", observedAt: evidence.observedAt },
  };
  const result = m.Commerce.applyOrderAction(order, paymentEvidenceAction as CommerceOrderActionLike, Math.floor(Date.now() / 1000));
  if (!result.ok || result.order === undefined) return { outcome: "rejected", reason: result.reason };
  state.orders.save(result.order);

  // FedOS Commerce Purchase Completion mega-arc (Agent P's transport,
  // wired by the Coordinator's integration phase) -- this process's own
  // local Payment authority has now reached a terminal `paid` state, and
  // BOTH independent gates above already agreed (the ledger genuinely
  // transitioned, and `applyOrderAction` accepted the
  // `{ kind: "payment_evidence" }` actor). Only now may the evidence
  // leave this device, and only to the ONE counterparty that has any
  // standing to receive it: this order's own seller, whose independent
  // process previously had no way at all to learn the payment happened.
  //
  // `evidence` here is the object this process's OWN
  // `DeterministicLocalPaymentProvider.simulateSettlement()` produced --
  // never anything renderer-supplied (the preload bridge sends only
  // `orderId`/`paymentId`) -- and `RealPaymentEvidenceTransport` re-checks
  // its authoritativeness once more before packaging it. Best-effort and
  // non-fatal: a send failure leaves the already-saved local settlement
  // and Order completely untouched, and is reported honestly to the UI
  // rather than swallowed.
  const paymentSyncOutcome = await sendPrivatePaymentEvidenceSyncNonFatal(
    evidence,
    { orderId: order.id, amountCents: order.unitPriceCents * order.quantity, currency: order.currency },
    order.sellerPubkey,
  );

  return { outcome: "ok", order: commerceOrderDto(result.order), paymentSyncOutcome };
}

// ---------------------------------------------------------------------
// Delivery + Trust/QR receipt (Commerce E2E Completion arc, Wave B
// integration -- coordinator).
//
// CORE INVARIANT (mirrors the payment section's own): the ONLY place that
// can move a Delivery/Order to "delivered" is
// `handleCommerceDeliveryAcknowledgeReceipt` below, and it constructs
// `verification: { source: "recipient_acknowledgment", authoritative:
// true }` ONLY after confirming the calling actor's pubkey matches the
// Order's OWN `buyerPubkey` -- never a bare merchant claim, never a
// renderer-suppliable `verification`/`authoritative` field (the preload
// bridge sends only `orderId`/`actorPubkey`).
// ---------------------------------------------------------------------

function commerceDeliveryDto(delivery: CommerceDeliveryRecordLike) {
  return { id: delivery.id, orderId: delivery.orderId, status: delivery.status };
}

async function handleCommerceDeliveryStatus(payload: unknown) {
  const orderId = (payload as { orderId?: unknown } | null)?.orderId;
  if (!isBoundedString(orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };
  // FedOS Commerce Purchase Completion mega-arc (Agent D) -- bounded
  // reliable-refresh, same posture as `commercePrivateOrderDiscoverAndApplyNonFatal()`'s
  // own callers: pull any private Order- AND Delivery-sync updates this
  // process's own pubkey has received (e.g. the seller's "fulfilling"
  // claim materializing this process's own local `DeliveryRecord` for the
  // very first time) before reading local state. Order-sync runs FIRST so
  // that when a "recipient_acknowledged" Delivery event is reconciled
  // below, this process's own local Order has already had its best chance
  // to reach "fulfilling" first -- `applyInboundPrivateDeliverySyncNonFatal()`'s
  // own Order-mirror only fires when that is already true (never blindly
  // trusts wire-event ordering).
  await commercePrivateOrderDiscoverAndApplyNonFatal();
  // FedOS Commerce Purchase Completion mega-arc (Agent P's transport,
  // wired by the Coordinator) -- payment evidence is pulled BEFORE the
  // Delivery pass on purpose: a Delivery event's reconciliation depends on
  // this process's Order having already reached a payment-confirmed status
  // (see `applyInboundPrivatePaymentEvidenceNonFatal()`'s own header).
  await commercePrivatePaymentEvidenceDiscoverAndApplyNonFatal();
  await commercePrivateDeliveryDiscoverAndApplyNonFatal();
  // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- same
  // bounded reliable-refresh, for the media-release request/response
  // channel (seller-side answer, then buyer-side apply).
  await commercePrivateMediaReleaseRequestDiscoverAndRespondNonFatal();
  await commercePrivateMediaReleaseDiscoverAndApplyNonFatal();
  const delivery = commerceState().deliveries.findByOrderId(orderId);
  if (delivery === undefined) return { outcome: "not-found", reason: "no delivery record for this order yet" };
  return { outcome: "ok", delivery: commerceDeliveryDto(delivery) };
}

async function handleCommerceDeliveryAcknowledgeReceipt(payload: unknown) {
  const body = payload as { orderId?: unknown; actorPubkey?: unknown } | null;
  if (!isBoundedString(body?.orderId, MAX_ID_LENGTH) || !isBoundedString(body.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed orderId/actorPubkey" };
  }
  // Same bounded refresh as `handleCommerceDeliveryStatus()` -- acts
  // against a freshly-materialized local Delivery record, never a stale or
  // entirely-missing one.
  await commercePrivateOrderDiscoverAndApplyNonFatal();
  // FedOS Commerce Purchase Completion mega-arc (Agent P's transport,
  // wired by the Coordinator) -- payment evidence is pulled BEFORE the
  // Delivery pass on purpose: a Delivery event's reconciliation depends on
  // this process's Order having already reached a payment-confirmed status
  // (see `applyInboundPrivatePaymentEvidenceNonFatal()`'s own header).
  await commercePrivatePaymentEvidenceDiscoverAndApplyNonFatal();
  await commercePrivateDeliveryDiscoverAndApplyNonFatal();
  // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- same
  // bounded reliable-refresh, for the media-release request/response
  // channel (seller-side answer, then buyer-side apply).
  await commercePrivateMediaReleaseRequestDiscoverAndRespondNonFatal();
  await commercePrivateMediaReleaseDiscoverAndApplyNonFatal();
  const state = commerceState();
  const order = state.orders.findById(body.orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };
  if (order.buyerPubkey !== body.actorPubkey) return { outcome: "rejected", reason: "only the order's own buyer may acknowledge receipt" };
  const delivery = state.deliveries.findByOrderId(body.orderId);
  if (delivery === undefined) return { outcome: "not-found", reason: "no delivery record for this order yet" };

  const now = Math.floor(Date.now() / 1000);
  const m = requireModules();
  const evidence = { deliveryId: delivery.id, orderId: order.id, status: "delivered" as const, observedAt: now, reason: "customer acknowledged receipt", verification: { source: "recipient_acknowledgment" as const, authoritative: true as const, acknowledgedBy: body.actorPubkey } };
  const deliveryResult = m.Commerce.applyDeliveryAction(delivery, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence }, now);
  if (!deliveryResult.ok || deliveryResult.delivery === undefined) return { outcome: "rejected", reason: deliveryResult.reason };
  state.deliveries.save(deliveryResult.delivery);

  const orderEvidence = { orderId: order.id, deliveryId: delivery.id, status: "delivered" as const, observedAt: now, reason: "customer acknowledged receipt" };
  const orderResult = m.Commerce.applyOrderAction(order, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: orderEvidence } as CommerceOrderActionLike, now);
  if (!orderResult.ok || orderResult.order === undefined) return { outcome: "rejected", reason: orderResult.reason };
  state.orders.save(orderResult.order);

  // FedOS Commerce Purchase Completion mega-arc (Agent D) -- "Cross-process
  // delivery" / "Delivery authority": privately notify the REAL seller's
  // own independent process that the buyer genuinely acknowledged receipt
  // -- this is the ONE call site anywhere that ever sends a
  // "recipient_acknowledged" wire payload, and it only runs AFTER
  // `body.actorPubkey` has already been confirmed to equal `order.buyerPubkey`
  // above, so a seller's own process can never trigger this send for
  // itself. Best-effort/non-fatal, same posture as every other private
  // sync send in this file.
  // (Coordinator, integration phase) Agent D already sent this; its
  // outcome was previously DISCARDED, so a buyer whose "I received it"
  // never actually reached the seller's process was told nothing at all.
  // Captured and returned now so the UI can report it honestly on the
  // `"delivery"` channel (`cross_process_outcome_text.ts`).
  const deliverySyncOutcome = await sendPrivateDeliverySyncNonFatal(deliveryResult.delivery, "recipient_acknowledged", order.sellerPubkey, now, "customer acknowledged receipt");

  return { outcome: "ok", order: commerceOrderDto(orderResult.order), delivery: commerceDeliveryDto(deliveryResult.delivery), deliverySyncOutcome };
}

async function handleCommerceOrderComplete(payload: unknown) {
  const body = payload as { orderId?: unknown; actorPubkey?: unknown } | null;
  if (!isBoundedString(body?.orderId, MAX_ID_LENGTH) || !isBoundedString(body.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed orderId/actorPubkey" };
  }
  const state = commerceState();
  const order = state.orders.findById(body.orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };
  const actorKind: "customer" | "merchant" = order.buyerPubkey === body.actorPubkey ? "customer" : "merchant";
  const now = Math.floor(Date.now() / 1000);
  const m = requireModules();

  // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) -- THE
  // "digital content delivery invariant" (`media_access_grant_release_channel_policy.ts`'s
  // own header, point 3): an Order for a product carrying ANY protected
  // media may reach `"completed"` ONLY once every one of those items has a
  // REAL, digest-verified release on file for this Order's own buyer.
  // Checked and enforced HERE, BEFORE `applyOrderAction(..., {type:
  // "complete"})` is ever called -- never after, and never as a
  // best-effort/non-fatal side note like the reputation/sync calls further
  // below, because this one is NOT allowed to fail open. A physical-goods
  // Order (no protected media at all) is completely unaffected -- see that
  // function's own header for why this never touches
  // `order_state_machine.ts` itself.
  const { productMedia: productMediaForInvariant, productMediaKnowledge } = await resolveProductMediaForCompletionInvariantWithSync(order.productId, order.sellerPubkey);
  const deliveryInvariant = m.Commerce.evaluateDigitalContentDeliveryInvariantForOrderCompletion({
    productId: order.productId,
    productMedia: productMediaForInvariant,
    hasReleasedContent: (mediaId) => commerceMediaReleaseContentCacheState().hasRelease(order.id, mediaId, order.buyerPubkey),
    productMediaKnowledge,
  });
  if (!deliveryInvariant.satisfied) {
    return {
      outcome: "rejected",
      reason: deliveryInvariant.reason,
      missingMediaIds: "missingMediaIds" in deliveryInvariant ? deliveryInvariant.missingMediaIds : [],
    };
  }

  const orderResult = m.Commerce.applyOrderAction(order, { type: "complete", actor: { kind: actorKind, pubkey: body.actorPubkey } } as CommerceOrderActionLike, now);
  if (!orderResult.ok || orderResult.order === undefined) return { outcome: "rejected", reason: orderResult.reason };
  state.orders.save(orderResult.order);

  const delivery = state.deliveries.findByOrderId(body.orderId);
  let deliveryJustCompleted: CommerceDeliveryRecordLike | undefined;
  if (delivery !== undefined) {
    const deliveryResult = m.Commerce.applyDeliveryAction(delivery, { type: "acknowledge", actor: { kind: actorKind, pubkey: body.actorPubkey } }, now);
    if (deliveryResult.ok && deliveryResult.delivery !== undefined) {
      state.deliveries.save(deliveryResult.delivery);
      deliveryJustCompleted = deliveryResult.delivery;
    }
  }

  // FedOS Commerce FINAL Closure Mega-Arc (coordinator, Agent R's own
  // "wire attestation issuance into the real order-completion path" TODO)
  // -- AFTER the real Order (and, if present, Delivery) state has already
  // committed above. Awaited (so a test can observe it deterministically)
  // but wrapped in its own total try/catch (see that function's own doc
  // comment) -- a reputation-issuance failure can never revert
  // `orderResult.order` having already been saved, and never changes this
  // call's own `outcome` (the CORE transaction -- the Order reaching
  // "completed" -- succeeds either way, per arc §42). Commerce Real
  // Two-Party UX Closure (Agent U): the outcome is no longer discarded --
  // `reputationSyncStatus` below lets the renderer say so truthfully
  // instead of staying silent regardless of what actually happened
  // (Commerce Friction Ledger row 21).
  const reputationRecorded = await issueReputationAttestationsForCompletedOrderNonFatal(orderResult.order, now);

  // FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
  // Coordinator-directed pass) -- arc items #4/#5: notify the OTHER party.
  const recipientPubkey = actorKind === "customer" ? orderResult.order.sellerPubkey : orderResult.order.buyerPubkey;
  const nostrSyncOutcome = await sendPrivateOrderSyncNonFatal(orderResult.order, "completed", recipientPubkey, now);
  // FedOS Commerce Purchase Completion mega-arc (Agent D) -- mirror onto
  // the Delivery-sync channel too, when a real local Delivery record just
  // closed out alongside the Order.
  // (Coordinator, integration phase) outcome captured rather than
  // discarded -- see `handleCommerceDeliveryAcknowledgeReceipt`'s own note.
  // `undefined` (not a fabricated success string) when no local Delivery
  // record closed out alongside the Order, so the UI renders no delivery
  // note at all rather than claiming an attempt that never happened.
  const deliverySyncOutcome =
    deliveryJustCompleted !== undefined
      ? await sendPrivateDeliverySyncNonFatal(deliveryJustCompleted, "completed", recipientPubkey, now)
      : undefined;

  return {
    outcome: "ok",
    order: commerceOrderDto(orderResult.order),
    nostrSyncOutcome,
    deliverySyncOutcome,
    reputationSyncStatus: reputationRecorded ? "recorded" : "unavailable",
  };
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent R's
 * read-only Persona Board query, exposed exactly per that domain layer's
 * own TODO: always the `"PUBLIC"` disclosure layer (never `PSEUDONYMOUS_PROOF`/
 * `"AUTHORIZED"` -- WHO gets a wider layer is an access-control decision
 * this pass deliberately does not make; see `persona_board_query.ts`'s own
 * header). Never fabricates a "no history" view for a pubkey this process
 * has genuinely never seen (`commercePersonaEpochForPubkey(..., false)`
 * only looks up, never creates).
 */
async function handleCommercePersonaBoardQuery(payload: unknown) {
  const subjectPubkey = (payload as { subjectPubkey?: unknown } | null)?.subjectPubkey;
  if (!isBoundedString(subjectPubkey, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed subjectPubkey" };
  const entry = await commercePersonaEpochForPubkey(subjectPubkey, false);
  if (entry === undefined) return { outcome: "not-found", reason: "no persona/reputation history on record for this pubkey yet" };
  const m = requireModules();
  const { registry, store } = commerceReputationState();
  const now = Math.floor(Date.now() / 1000);
  const result = m.Reputation.queryPersonaBoardView(entry.epoch.epochId, "PUBLIC", registry, store, now);
  if (result === undefined) return { outcome: "not-found", reason: "epoch not registered" };
  return { outcome: "ok", view: result.view, verificationState: result.verificationState };
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's minimal
 * Settings surface: view/select the `NetworkProfile` gating Nostr Commerce
 * publication.
 *
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- now
 * durably persisted (see `persistCommerceNetworkProfile()`'s own doc
 * comment); a user's explicit choice survives a restart instead of
 * silently reverting to `"local-only"` every relaunch.
 */
async function handleCommerceNetworkProfileGet() {
  return { outcome: "ok", profile: commerceNetworkProfile };
}

async function handleCommerceNetworkProfileSet(payload: unknown) {
  const profile = (payload as { profile?: unknown } | null)?.profile;
  if (typeof profile !== "string" || !(COMMERCE_NETWORK_PROFILE_VALUES as readonly string[]).includes(profile)) {
    return { outcome: "invalid-input", reason: `profile must be one of ${COMMERCE_NETWORK_PROFILE_VALUES.join(", ")}` };
  }
  commerceNetworkProfile = profile as CommerceNetworkProfileValue;
  persistCommerceNetworkProfile(commerceNetworkProfile);
  return { outcome: "ok", profile: commerceNetworkProfile };
}

/**
 * Issues a real signed `TradeReceiptProof` for a `"completed"` order,
 * encodes it as QR text, and immediately decodes+verifies it back --
 * proving the real Trust sign -> QR -> verify pipeline round-trips before
 * ever handing anything to the renderer. `PLAINTEXT` bindings deliberately
 * stay coarse (opaque ids only, see `receipt_types.ts`'s own field
 * comments) -- never the product's title/price, never exact payment
 * metadata beyond the opaque `paymentId` reference.
 *
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- TWO real fixes, friction-ledger rows #5 and #11:
 *
 *   1. PERSISTENCE (row #5 / arc §33): `commerceReceiptState()` (a real
 *      `DurableReceiptStore`) is checked FIRST. A `"completed"` order that
 *      already has a durably-stored receipt returns THAT SAME envelope
 *      (re-verified live, never re-signed) -- never a second, freshly
 *      re-signed envelope with a different `issuedAt`/signature. Only the
 *      FIRST successful issuance for an `orderId` ever calls
 *      `issueSignedTradeReceiptProof()`. This is what makes a receipt
 *      survive a real app restart with the SAME proof the user already
 *      saw, not merely "still independently re-verifiable" (which the
 *      prior, already-durable receipt-issuer signing KEY alone provided).
 *   2. REAL QR IMAGE (row #11 / arc §34): `renderFedosTrustQrTextToPngDataUrl()`
 *      renders the ALREADY-signed `qrText` as a real scannable PNG data
 *      URL -- the underlying signed text remains authoritative; the image
 *      is presentation/transport only, exactly like `qrText` itself always
 *      was. Rendering failure is non-fatal to the (already-durable) text
 *      proof -- `qrImageDataUrl` is simply omitted, never a fabricated
 *      placeholder image.
 */
async function handleCommerceReceiptIssue(payload: unknown) {
  const orderId = (payload as { orderId?: unknown } | null)?.orderId;
  if (!isBoundedString(orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };
  const state = commerceState();
  const order = state.orders.findById(orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };
  if (order.status !== "completed") return { outcome: "rejected", reason: `order must be "completed" before a receipt can be issued (currently "${order.status}")` };

  const m = requireModules();
  const now = Math.floor(Date.now() / 1000);
  const signingState = await commerceReceiptSigningState();
  if (signingState.outcome === "issuer-identity-corrupted") {
    return { outcome: "rejected", reason: `receipt issuer identity is corrupted and cannot safely issue new receipts: ${signingState.reason}` };
  }
  const { policy } = signingState;
  const receiptStore = commerceReceiptState();

  let envelope: unknown;
  const existing = receiptStore.getByOrderId(orderId);
  if (existing !== undefined) {
    envelope = existing.envelope;
  } else {
    const { issuerId, keypair } = signingState;
    // BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) --
    // arc mandate item 7: when this Order's product carried protected media
    // that were genuinely released to (and digest-verified by) this Order's
    // own buyer, the receipt references that DELIVERY EVIDENCE via the
    // existing, already-signed `DeliveryReceiptProofPayload.deliveryConfirmationRef`
    // opaque string field (`../../../../src/os/commerce/receipt/receipt_types.ts` --
    // never a new field; `issueSignedDeliveryReceiptProof()`/
    // `verifySignedDeliveryReceiptProof()` are ALREADY real, already-tested,
    // just never wired to a production caller before now). This proves
    // ONLY that a real release with this digest occurred -- never that the
    // content is authentic/high-quality/matches the listing, exactly the
    // limitation `receipt_types.ts`'s own header already documents for
    // every opaque reference field it carries. A physical-goods Order (no
    // protected media) is unaffected -- still a plain `trade_completion`
    // receipt, exactly as before.
    const releasedMediaRefs = commerceProductMediaState()
      .listForProduct(order.productId)
      .filter((item) => item.classification === "protected")
      .map((item) => commerceMediaReleaseContentCacheState().getRelease(order.id, item.id, order.buyerPubkey))
      .filter((record): record is CommerceMediaReleaseContentRecordLike => record !== undefined)
      .map((record) => `${record.mediaId}:${record.contentDigest}`);
    let deliveryConfirmationRef: string | undefined;
    if (releasedMediaRefs.length > 0) {
      const joined = `media-release:${releasedMediaRefs.join(",")}`;
      // Bounded to receipt_types.ts's own COMMERCE_RECEIPT_MAX_FIELD_LENGTH
      // (512) -- falls back to a bounded count-only reference rather than
      // ever truncating a digest (a truncated digest would be worse than no
      // reference at all: it would look verifiable but not actually be).
      deliveryConfirmationRef = joined.length <= 480 ? joined : `media-release-count:${releasedMediaRefs.length}`;
    }

    const payloadRecord =
      deliveryConfirmationRef !== undefined
        ? {
            kind: "delivery_confirmation" as const,
            orderId: order.id,
            productRef: order.productId,
            buyerRef: order.buyerPubkey,
            sellerRef: order.sellerPubkey,
            paymentEvidenceRef: order.paymentId ?? undefined,
            completedAt: now,
            formatVersion: 1 as const,
            deliveryConfirmationRef,
          }
        : {
            kind: "trade_completion" as const,
            orderId: order.id,
            productRef: order.productId,
            buyerRef: order.buyerPubkey,
            sellerRef: order.sellerPubkey,
            paymentEvidenceRef: order.paymentId ?? undefined,
            completedAt: now,
            formatVersion: 1 as const,
          };
    try {
      envelope =
        deliveryConfirmationRef !== undefined
          ? m.Commerce.issueSignedDeliveryReceiptProof(payloadRecord, { keypair, issuer: issuerId }, { issuedAt: now })
          : m.Commerce.issueSignedTradeReceiptProof(payloadRecord, { keypair, issuer: issuerId }, { issuedAt: now });
    } catch (err) {
      return { outcome: "rejected", reason: err instanceof Error ? err.message : "receipt issuance failed" };
    }
    // Idempotent: if a concurrent call already won the race, `putIfAbsent`
    // reports "already-present" and this in-memory `envelope` is simply
    // discarded in favor of re-reading the durably-won one below, so two
    // concurrent issuances for the SAME orderId can never both "win".
    const putResult = receiptStore.putIfAbsent(orderId, envelope, now);
    if (putResult === "already-present") {
      envelope = receiptStore.getByOrderId(orderId)?.envelope ?? envelope;
    }
  }

  const qrText = m.Commerce.encodeCommerceReceiptProofToQrText(envelope);
  const decoded = m.Commerce.decodeCommerceReceiptProofFromQrText(qrText);
  // Kind-agnostic verify: try the (far more common) trade_completion shape
  // first, fall back to delivery_confirmation only on a shape mismatch --
  // never assumed from local state, since `envelope` may be one durably
  // issued by an EARLIER call (or an earlier arc's build) under either kind.
  let verified = m.Commerce.verifySignedTradeReceiptProof(decoded, policy);
  if (verified.status === "INVALID_PAYLOAD_SHAPE") {
    verified = m.Commerce.verifySignedDeliveryReceiptProof(decoded, policy);
  }

  let qrImageDataUrl: string | undefined;
  try {
    qrImageDataUrl = await m.Trust.renderFedosTrustQrTextToPngDataUrl(qrText);
  } catch (err) {
    console.error("fedos-beta: QR image rendering failed (non-fatal, the signed text receipt above remains authoritative):", err);
  }

  return { outcome: "ok", qrText, qrImageDataUrl, verifyStatus: verified.status };
}

/**
 * FedOS Commerce Purchase Completion mega-arc (Agent R) -- READ-ONLY
 * companion to `handleCommerceReceiptIssue()` above, closing the real,
 * live-reproduced dev-vs-packaged restart discrepancy this arc
 * investigated: `DurableReceiptStore.putIfAbsent()` (Agent D, friction
 * ledger row #5 / arc §33) already makes an issued receipt survive a real
 * restart byte-for-byte -- confirmed identical between a dev-style launch
 * and the installed NSIS binary, since both run this exact file against
 * the exact same `dataDir()`/`commerceDurableFilePath()` logic. The
 * ACTUAL first divergence was never a storage-path/environment mismatch
 * between dev and packaged launches at all: it was that the renderer had
 * NO way to discover an already-issued receipt except by clicking "Issue
 * Signed Receipt" again (`renderCommerceOrderScreen()` never queried one).
 * A real user -- unlike this arc's own scripted E2E harnesses, which
 * always click "Issue" explicitly in every launch -- reopening a
 * `"completed"` order (after a restart, or simply after navigating away
 * and back) therefore always saw a pristine, unissued-looking panel, even
 * though the backend had never lost anything (`docs/commerce/usability-v2/
 * BUYER-TABLETOP-AFTER.md`'s live-reproduced P1 finding, "Signed receipt is
 * not durably persisted across a restart, with no warning").
 *
 * This handler looks up `DurableReceiptStore.getByOrderId()` and, if a
 * receipt already exists, decodes+verifies it (the SAME production
 * pipeline `handleCommerceReceiptIssue()` uses) so the renderer can render
 * it immediately on open -- but it NEVER calls
 * `issueSignedTradeReceiptProof()` and NEVER calls `putIfAbsent()`: an
 * order that genuinely never had a receipt issued stays that way, never
 * silently minted one just by being viewed.
 */
async function handleCommerceReceiptLookup(payload: unknown) {
  const orderId = (payload as { orderId?: unknown } | null)?.orderId;
  if (!isBoundedString(orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };

  const receiptStore = commerceReceiptState();
  const existing = receiptStore.getByOrderId(orderId);
  if (existing === undefined) return { outcome: "not-found" };

  const m = requireModules();
  const signingState = await commerceReceiptSigningState();
  if (signingState.outcome === "issuer-identity-corrupted") {
    return { outcome: "rejected", reason: `receipt issuer identity is corrupted and cannot safely issue new receipts: ${signingState.reason}` };
  }
  const { policy } = signingState;

  const qrText = m.Commerce.encodeCommerceReceiptProofToQrText(existing.envelope);
  const decoded = m.Commerce.decodeCommerceReceiptProofFromQrText(qrText);
  const verified = m.Commerce.verifySignedTradeReceiptProof(decoded, policy);

  let qrImageDataUrl: string | undefined;
  try {
    qrImageDataUrl = await m.Trust.renderFedosTrustQrTextToPngDataUrl(qrText);
  } catch (err) {
    console.error("fedos-beta: QR image rendering failed (non-fatal, the signed text receipt above remains authoritative):", err);
  }

  return { outcome: "ok", qrText, qrImageDataUrl, verifyStatus: verified.status };
}

const MAX_SHARE_QR_TEXT_CHARS = 20000;

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * arc mandate item 3, SELLER side: "Bob... Share Product -> FedOS emits a
 * signed deep-link/QR/compact code". Only the product's own established
 * `creatorPubkey` may issue a share for it (mirrors every other
 * owner-only-mutation check in this file, e.g.
 * `handleCommerceProductUpdate`'s equivalent gate) -- a share link can
 * never be minted on someone else's behalf. Reuses the SAME durable
 * Commerce Trust issuer identity `commerceReceiptSigningState()` already
 * establishes for receipts (see that function's own header) -- no second
 * signing identity, no new key-management surface. See
 * `src/os/commerce/share/commerce_trust_share_adapter.ts`'s own header for
 * exactly what a resulting "VALID" verification on the RECEIVING end does
 * and does not prove.
 */
async function handleCommerceShareProductIssue(payload: unknown) {
  const body = payload as { actorPubkey?: unknown; productId?: unknown } | null;
  if (!isBoundedString(body?.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  if (!isBoundedString(body.productId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed productId" };

  const product = commerceState().products.get(body.productId);
  if (product === undefined) return { outcome: "not-found", reason: "no such product" };
  if (product.creatorPubkey !== body.actorPubkey) {
    return { outcome: "forbidden", reason: "only this product's own creator may issue a share link for it" };
  }

  const m = requireModules();
  const now = Math.floor(Date.now() / 1000);
  const signingState = await commerceReceiptSigningState();
  if (signingState.outcome === "issuer-identity-corrupted") {
    return { outcome: "rejected", reason: `local Commerce Trust issuer identity is corrupted and cannot safely issue a share link: ${signingState.reason}` };
  }
  const { issuerId, keypair } = signingState;

  const sharePayload = {
    kind: "product_share" as const,
    productId: product.id,
    title: product.title,
    priceCents: product.priceCents,
    currency: product.currency,
    sellerPubkey: product.creatorPubkey,
    issuedAt: now,
    formatVersion: 1 as const,
  };

  let envelope: unknown;
  try {
    envelope = m.Commerce.issueSignedProductShareProof(sharePayload, { keypair, issuer: issuerId }, { issuedAt: now });
  } catch (err) {
    return { outcome: "rejected", reason: err instanceof Error ? err.message : "share proof issuance failed" };
  }
  const qrText = m.Commerce.encodeCommerceShareProofToQrText(envelope);

  let qrImageDataUrl: string | undefined;
  try {
    qrImageDataUrl = await m.Trust.renderFedosTrustQrTextToPngDataUrl(qrText);
  } catch (err) {
    console.error("fedos-beta: share proof QR image rendering failed (non-fatal, the signed text code above remains authoritative):", err);
  }

  return { outcome: "ok", qrText, qrImageDataUrl, productId: product.id, title: product.title };
}

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * arc mandate item 3, BUYER side: "Alice: Scan/Paste/Open -> verifies
 * seller/product identity via SIGNATURE (never trust the link/QR content
 * itself) -> subscribes/fetches via the existing network layer -> Product
 * Detail". Implements the TWO-LAYER trust model
 * `commerce_trust_share_adapter.ts`'s own header documents in full:
 *
 *   1. `verifySelfAssertedProductShareProof()` -- rejects any
 *      malformed/tampered/corrupted code outright (`"invalid"` below).
 *      This alone proves only internal self-consistency, NEVER seller
 *      identity (see that adapter's own "Case F" test).
 *   2. THIS function's own mandatory cross-check: triggers the SAME real
 *      discovery query `handleCommerceCatalogList()` uses
 *      (`commerceNostrDiscoverAndIngestProductsNonFatal()`), then looks
 *      for `productId` in EITHER this process's own local, authoritative
 *      `LocalProductRepository`/`DurableProductRepository` (covers the
 *      same-process merchant/buyer tabletop path, and a product this
 *      buyer already separately discovered before) OR the real,
 *      signature-verified `CommerceNostrProductReadModel` (covers a
 *      genuinely independent buyer). ONLY if a record is found AND its
 *      own real `creatorPubkey` matches the share artifact's CLAIMED
 *      `sellerPubkey` is the result ever reported `confirmed: true` --
 *      this is the step that actually proves seller identity, delegated
 *      entirely to the ALREADY-HARDENED verification this app's Nostr
 *      discovery pipeline already performs (never re-implemented here).
 *
 * NEVER returns full product details to the renderer directly -- on
 * `confirmed: true` the renderer is expected to call the EXISTING
 * `commerceProductDetail(productId)` IPC (same as clicking "View" from the
 * ordinary catalog) to open Product Detail from the real, authoritative
 * record, never from this handler's own preview copy.
 */
async function handleCommerceShareOpen(payload: unknown) {
  const qrText = (payload as { qrText?: unknown } | null)?.qrText;
  if (!isBoundedString(qrText, MAX_SHARE_QR_TEXT_CHARS) || qrText.length === 0) {
    return { outcome: "invalid-input", reason: "malformed or missing share code" };
  }

  const m = requireModules();
  const decoded = m.Commerce.decodeCommerceShareProofFromQrText(qrText);
  const verified = m.Commerce.verifySelfAssertedProductShareProof(decoded);
  if (verified.status !== "VALID" || verified.payload === undefined) {
    return { outcome: "invalid", reason: `share code failed verification: ${verified.status}` };
  }
  const preview = verified.payload as {
    readonly productId: string;
    readonly title: string;
    readonly priceCents: number;
    readonly currency: string;
    readonly sellerPubkey: string;
  };

  // Mandatory cross-check (step 2 above) -- never skipped, never optional.
  await commerceNostrDiscoverAndIngestProductsNonFatal();
  const localMatch = commerceState().products.get(preview.productId);
  const discoveredMatch = commerceNostrReadModelFor().getProduct(preview.productId) as CommerceReadModelProductViewLike | undefined;

  const realCreatorPubkey = localMatch !== undefined ? localMatch.creatorPubkey : discoveredMatch?.creatorPubkeyHex;
  if (realCreatorPubkey === undefined) {
    return {
      outcome: "ok",
      confirmed: false,
      reason: "not yet confirmed on the network -- could not independently verify this seller/product",
      preview,
    };
  }
  if (realCreatorPubkey !== preview.sellerPubkey) {
    return {
      outcome: "rejected",
      reason: "seller mismatch -- this share code's claimed seller does not match the real, network-verified record. Rejected.",
      preview,
    };
  }
  return { outcome: "ok", confirmed: true, productId: preview.productId, preview };
}

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- friction-ledger row #15 / arc §35-37: the buyer-side
 * REDEEM path, the ONLY code reaching `commerceMediaStoreFor().getProtected()`
 * anywhere in this file (grep-verifiable) -- there is no IPC channel that
 * exposes that store's `getProtected()`/decrypt capability directly. The
 * gate order below is fixed and cannot be reordered by a caller:
 *   1. Look up the REAL Order via the durable repository (never a
 *      caller-supplied Order shape) and the REAL `ProductMedia` record.
 *   2. Check the buyer's OWN durable `DurableMediaReleaseContentCache`
 *      first -- a release already digest-verified via a REAL cross-process
 *      round trip on an earlier call/poll returns immediately, including
 *      after a full process restart (this arc's own mandate item 6). This
 *      is the ONLY success path this handler has -- there is no
 *      same-process shortcut.
 *   3. If nothing is cached yet, runs one bounded discover-and-apply pass
 *      in EACH direction (in case a seller's response, or this seller
 *      process's own not-yet-answered request, is already sitting on the
 *      relay) and re-checks the cache.
 *   4. Still nothing: consults the in-memory `commerceMediaReleaseLastKnownDenial`
 *      hint for a truthful, specific denial reason already observed on an
 *      earlier poll; otherwise sends a FRESH
 *      `private-media-release-request` (best-effort) and returns
 *      `outcome: "pending"` -- never a false `"ok"`, never a silent hang,
 *      never an ask for the buyer to blindly attest receipt (arc mandate
 *      item 4).
 *
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A): this
 * handler is the REAL cross-process production caller this arc's brief
 * asked for -- see `docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md`
 * ("Blocker 3") for the single-process wrap/unwrap stand-in this replaces
 * (it called `wrapMediaAccessGrantRelease()` bound to the buyer's pubkey,
 * then immediately `decryptNip44Wire()`d with the SELLER as counterparty --
 * structurally only self-consistent when buyer === seller). This handler
 * now NEVER calls `wrapMediaAccessGrantRelease()`/`evaluateMediaAccessGrant()`/
 * `commerceMediaStoreFor().getProtected()` directly at all -- every one of
 * those only ever runs inside `buildOutboundPrivateMediaReleaseResponse()`
 * (`applyInboundPrivateMediaReleaseRequestNonFatal()`, seller-process-only),
 * gated by the real, cryptographically-verified requesting buyer's own
 * identity -- see that function's own header. This handler also never calls
 * the raw `resolveCommerceMediaKey()` primitive (it never even imports
 * anything that could) -- this arc's own mandate item 2.
 */
/**
 * Coordinator security review (BUYER DISCOVERY + DIGITAL CONTENT DELIVERY
 * mega-arc) -- `PrivateMediaReleaseReleasedPayload.contentType` is REMOTE,
 * SELLER-SUPPLIED input. `isWellFormedPrivateMediaReleasePayload()`
 * (`src/os/commerce/events/commerce_private_media_release_sync.ts`) bounds it
 * to 128 chars but deliberately does NOT allowlist it ("generous, never
 * trusted as a real sniffed type", that file's own comment), and the buyer's
 * renderer interpolates whatever arrives straight into a `data:` URL media
 * type AND into the download filename's extension
 * (`onCommerceOpenPurchasedContentClick()`,
 * `fedos_electron_beta_renderer.ts`). A hostile or modified seller process
 * could therefore claim `text/html`/`image/svg+xml`/anything for bytes it
 * controls and turn a "purchased file" into active content (or steer the
 * suggested filename with `/`-bearing junk). This handler is the ONE place
 * that value crosses back to the renderer, so it is normalized here against
 * the SAME closed, non-scriptable allowlist the seller-side attach path
 * itself enforces (`COMMERCE_PROTECTED_CONTENT_TYPES`). Anything else becomes
 * the inert `application/octet-stream` -- never a rejection (the bytes are
 * genuinely this buyer's and were digest-verified before ever being cached;
 * only the seller's unverifiable CLAIM about their type is dropped).
 */
function commerceSafePurchasedContentType(claimed: unknown): string {
  return typeof claimed === "string" && COMMERCE_PROTECTED_CONTENT_TYPES.has(claimed) ? claimed : "application/octet-stream";
}

async function handleCommerceMediaGrantRedeem(payload: unknown) {
  const body = payload as { orderId?: unknown; actorPubkey?: unknown } | null;
  if (!isBoundedString(body?.orderId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed orderId" };
  if (!isBoundedString(body.actorPubkey, MAX_ID_LENGTH) || body.actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  const order = commerceState().orders.findById(body.orderId);
  if (order === undefined) return { outcome: "not-found", reason: "no such order" };
  // Coordinator security review (this arc): `actorPubkey` is a RENDERER-ASSERTED
  // claim ("Acting as"), never a verified identity -- every other order-scoped
  // handler in this file that acts on the buyer's behalf already re-checks it
  // against the real, locally-stored Order (see
  // `handleCommerceDeliveryAcknowledgeReceipt()`'s own identical gate), and this
  // one did not. Without this check the main process would sign and publish a
  // `private-media-release-request` whose `buyerPubkey` field claims an identity
  // this device does not control (the seller's own
  // `evaluateInboundMediaReleaseRequestAuthorization()` correctly refuses it as
  // `sender-mismatch`, so this was never a content-disclosure hole -- but a
  // signed, published false claim attributable to this user is not something a
  // renderer bug should be able to mint). `"buyer-mismatch"` reuses the
  // renderer's own existing closed denial vocabulary
  // (`COMMERCE_PURCHASED_CONTENT_DENIAL_TEXT`), which already tells the user to
  // switch "Acting as" to the identity that placed the order.
  if (order.buyerPubkey !== body.actorPubkey) {
    return { outcome: "rejected", reason: "buyer-mismatch" };
  }
  const actorPubkey = body.actorPubkey;
  const cache = commerceMediaReleaseContentCacheState();

  // CROSS-PROCESS COMPLETION SYNC + BUYER RESTART CONTENT RE-ACCESS mega-arc
  // (Coordinator) -- Finding 2 fix. Check the buyer's OWN already-durable
  // release cache FIRST, directly by (orderId, buyerPubkey), BEFORE ever
  // consulting this process's own ProductMedia knowledge. Closes the
  // buyer-restart gap: a genuinely already-verified, already-cached release
  // must never be shadowed by a momentarily "unsynced" ProductMedia view
  // right after a fresh process start (see
  // docs/commerce/SELLER-SIDE-COMPLETION-SYNC-INVARIANT-GAP.md, Finding 2 --
  // the ProductMedia gate below used to run BEFORE this cache check, so an
  // early "availability-unknown" return meant an already-cached release was
  // never even reached, even though it was sitting durably on disk the
  // whole time). Uses ONLY data already durably held on THIS buyer's own
  // device -- no new sync, no new protocol, no cross-process code touched
  // -- and does not weaken the ProductMedia gate below, which remains fully
  // intact as the fallback for a genuinely-first-time redeem.
  const alreadyCachedRelease = cache.listReleasesForOrder(order.id, actorPubkey)[0];
  if (alreadyCachedRelease !== undefined) {
    return {
      outcome: "ok",
      contentBase64: alreadyCachedRelease.contentBase64,
      contentType: commerceSafePurchasedContentType(alreadyCachedRelease.contentType),
      source: "cache",
    };
  }

  // Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) --
  // was: "local-only `commerceProductMediaState()`", which made this
  // short-circuit to "this product has no protected content" on a genuine
  // buyer's own process before ever attempting a real release request --
  // the exact false-negative this arc exists to close. Now merges in
  // Agent M's real cross-process declaration sync (authoritative on the
  // seller's own process, honestly "unsynced" everywhere else -- see
  // `resolveProductMediaForCompletionInvariant()`'s own header).
  const { productMedia: knownMedia, productMediaKnowledge } = resolveProductMediaForCompletionInvariant(order.productId, order.sellerPubkey);
  const protectedMedia = knownMedia.filter((item) => item.classification === "protected");
  if (protectedMedia.length === 0) {
    return productMediaKnowledge === "unsynced"
      ? { outcome: "not-found", reason: "availability-unknown" }
      : { outcome: "not-found", reason: "this product has no protected content" };
  }
  const media = protectedMedia[0];
  if (media === undefined) return { outcome: "not-found", reason: "this product has no protected content" };

  const cached = cache.getRelease(order.id, media.id, actorPubkey);
  if (cached !== undefined) {
    return { outcome: "ok", contentBase64: cached.contentBase64, contentType: commerceSafePurchasedContentType(cached.contentType), source: "cache" };
  }

  // Bounded reliable-refresh, same posture as every other cross-process
  // handler in this file: a response (or an unanswered request THIS
  // process itself owes, if it is the seller) may already be sitting on
  // the relay from an earlier poll.
  await commercePrivateMediaReleaseRequestDiscoverAndRespondNonFatal();
  await commercePrivateMediaReleaseDiscoverAndApplyNonFatal();

  const cachedAfterRefresh = cache.getRelease(order.id, media.id, actorPubkey);
  if (cachedAfterRefresh !== undefined) {
    return { outcome: "ok", contentBase64: cachedAfterRefresh.contentBase64, contentType: commerceSafePurchasedContentType(cachedAfterRefresh.contentType), source: "cache" };
  }

  const denialKey = mediaReleaseDenialKey(order.id, media.id, actorPubkey);
  const knownDenial = commerceMediaReleaseLastKnownDenial.get(denialKey);
  if (knownDenial !== undefined) {
    return { outcome: "denied", reason: knownDenial.reason };
  }

  const now = Math.floor(Date.now() / 1000);
  const requestSyncOutcome = await sendPrivateMediaReleaseRequestNonFatal(order.id, media.id, actorPubkey, order.sellerPubkey, now);
  // One more immediate pass -- covers a fast/local relay where the
  // seller's own process (or this SAME process acting in a different role
  // in a single-process demo/test topology) can answer within the same
  // call. Genuinely cross-machine two-party flows will not resolve here;
  // that is honestly reported as `"pending"` below, not `"ok"`.
  await commercePrivateMediaReleaseRequestDiscoverAndRespondNonFatal();
  await commercePrivateMediaReleaseDiscoverAndApplyNonFatal();
  const cachedAfterRequest = cache.getRelease(order.id, media.id, actorPubkey);
  if (cachedAfterRequest !== undefined) {
    return { outcome: "ok", contentBase64: cachedAfterRequest.contentBase64, contentType: commerceSafePurchasedContentType(cachedAfterRequest.contentType), source: "cache" };
  }
  const denialAfterRequest = commerceMediaReleaseLastKnownDenial.get(denialKey);
  if (denialAfterRequest !== undefined) {
    return { outcome: "denied", reason: denialAfterRequest.reason };
  }

  return { outcome: "pending", reason: "requested-awaiting-seller-response", requestSyncOutcome };
}

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- friction-ledger row #14 / arc §32/§36: the real DATA query
 * a badge/nav-chrome UI (Agent U's territory, or this file's own minimal
 * fallback below) needs -- new submitted orders, orders awaiting
 * acceptance, paid-ready-to-fulfill, delivery/completion states, ready
 * receipts, per role. Computed fresh from the real, durable Order
 * repository every call -- never cached, never a stub.
 */
async function handleCommerceActivitySummary(payload: unknown) {
  const actorPubkey = (payload as { actorPubkey?: unknown } | null)?.actorPubkey;
  if (!isBoundedString(actorPubkey, MAX_ID_LENGTH) || actorPubkey.length === 0) {
    return { outcome: "invalid-input", reason: "malformed actorPubkey" };
  }
  const m = requireModules();
  const orders = commerceState().orders;
  const asBuyerOrders = orders.listByBuyer(actorPubkey);
  const asSellerOrders = orders.listBySeller(actorPubkey);
  const receiptStore = commerceReceiptState();
  const hasReceipt = (orderId: string) => receiptStore.getByOrderId(orderId) !== undefined;

  return {
    outcome: "ok",
    asBuyer: m.Commerce.computeCommerceBuyerActivitySummary(asBuyerOrders, hasReceipt),
    asSeller: m.Commerce.computeCommerceSellerActivitySummary(asSellerOrders, hasReceipt),
  };
}

/**
 * Secure Runtime Alpha 8041-8120 — see `BoundaryLike`'s own updated header
 * comment: `identityTransitionList()`/its Controller-built inbox item never
 * carries the `(peerAccountRef, peerDeviceRef)` pair `openTransition()`/
 * `Accept()`/`Reject()`/`Defer()` require as input -- no Shell/Controller
 * listing call returns that pair directly on this base. This handler
 * reconciles two ALREADY-REAL, already-public read-only calls
 * (`identityTransitionList()`'s own inbox items plus `peerCapabilityListObserved()`'s
 * known peer Device pairs, cross-referenced via the ALREADY-PUBLIC
 * `identityTransitionStatus()` probe) to attach the pair each item needs --
 * inventing no new identity-transition business rule, mirroring
 * `FedosSafetyCenterController`'s own established cross-domain
 * reconciliation style. An item with no resolvable pair is marked
 * `openable: false` (fail closed) rather than fabricated.
 */
async function handleAppIdentityTransitionList(payload: unknown) {
  const boundary = requireBoundary();
  const shell = requireShell();
  if (boundary === null || shell === null) return acceptanceGateRejection();
  const limit = (payload as { limit?: unknown } | null)?.limit;
  const offset = (payload as { offset?: unknown } | null)?.offset;
  await boundary.identityTransitions.refreshInbox(typeof limit === "number" ? limit : 50, typeof offset === "number" ? offset : 0);
  const inbox = boundary.identityTransitions.inboxState;
  if (inbox.status !== "loaded") return resultFromViewModelState(inbox);
  const peersResult = shell.peerCapabilityListObserved();
  const peers = (peersResult.outcome === "ok" ? (peersResult as unknown as { readonly value: readonly { readonly peerAccountRef: unknown; readonly peerDeviceRef: string }[] }).value : []) ?? [];
  const items = (inbox.data as readonly { readonly transitionId: string; readonly [key: string]: unknown }[]) ?? [];
  const enriched = items.map((item) => {
    for (const peer of peers) {
      const statusResult = shell.identityTransitionStatus(peer.peerAccountRef, peer.peerDeviceRef, item.transitionId);
      if (statusResult.outcome === "ok" && (statusResult as unknown as { readonly value: unknown }).value !== null) {
        return { ...item, openable: true, peerAccountRef: peer.peerAccountRef, peerDeviceRef: peer.peerDeviceRef };
      }
    }
    return { ...item, openable: false, peerAccountRef: null, peerDeviceRef: null };
  });
  return { outcome: "ok", value: enriched };
}

async function handleAppIdentityTransitionOpen(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const peerAccountRef = (payload as { peerAccountRef?: unknown } | null)?.peerAccountRef;
  const peerDeviceRef = (payload as { peerDeviceRef?: unknown } | null)?.peerDeviceRef;
  const transitionId = (payload as { transitionId?: unknown } | null)?.transitionId;
  if (typeof peerAccountRef !== "object" || peerAccountRef === null || !isBoundedString(peerDeviceRef, MAX_ID_LENGTH) || !isBoundedString(transitionId, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed identity-transition-open request" };
  }
  await boundary.identityTransitions.openTransition(peerAccountRef, peerDeviceRef, transitionId);
  return resultFromViewModelState(boundary.identityTransitions.detailState);
}

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 3 (`6873d24f`): now
 * requires the exact identifying tuple in `payload`, validated the SAME
 * way `handleAppIdentityTransitionOpen()` already validates it, and
 * dispatches to the Controller's own exact-id `accept()`/`reject()`/
 * `defer()` methods -- never `acceptSelected()`/`rejectSelected()`/
 * `deferSelected()` (which trust a mutable "currently selected" field).
 * A stale/mismatched id still fails closed: the Shell's own real
 * transition lookup (unchanged) rejects an id that no longer exists or
 * no longer matches, exactly as it always has for `identityTransitionOpen()`.
 */
async function handleAppIdentityTransitionDecide(decision: "accept" | "reject" | "defer", payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const peerAccountRef = (payload as { peerAccountRef?: unknown } | null)?.peerAccountRef;
  const peerDeviceRef = (payload as { peerDeviceRef?: unknown } | null)?.peerDeviceRef;
  const transitionId = (payload as { transitionId?: unknown } | null)?.transitionId;
  if (typeof peerAccountRef !== "object" || peerAccountRef === null || !isBoundedString(peerDeviceRef, MAX_ID_LENGTH) || !isBoundedString(transitionId, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed identity-transition-decide request" };
  }
  if (decision === "accept") await boundary.identityTransitions.accept(peerAccountRef as never, peerDeviceRef, transitionId);
  else if (decision === "reject") await boundary.identityTransitions.reject(peerAccountRef as never, peerDeviceRef, transitionId);
  else await boundary.identityTransitions.defer(peerAccountRef as never, peerDeviceRef, transitionId);
  return resultFromViewModelState(boundary.identityTransitions.detailState);
}

async function handleAppIdentityTransitionRecordManualVerification(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const method = (payload as { method?: unknown } | null)?.method;
  const noteCode = (payload as { noteCode?: unknown } | null)?.noteCode;
  if (typeof method !== "string" || typeof noteCode !== "string") return { outcome: "invalid-input", reason: "malformed manual-verification request" };
  await boundary.identityTransitions.recordManualVerification(method, Date.now(), noteCode);
  return resultFromViewModelState(boundary.identityTransitions.manualVerificationState);
}

/** Loosens `resultFromViewModelState`'s own (deliberately narrow, structural) parameter type to `unknown` for the dependency-injected handler factories below, which are written to accept any ViewModelState shape rather than import this file's own local type. Pure adapter — no behavior change. */
const resultFromViewModelStateUnknown = (state: unknown): unknown => resultFromViewModelState(state as Parameters<typeof resultFromViewModelState>[0]);

// Commerce Product-Media Sync + Truthful Completion mega-arc (Agent I /
// Wave B) — Identity Replacement two-step Ratchet-reset confirmation. Step
// 1 (assess-continuity) is read-only; step 2 (authorize-ratchet-reset) is
// the ONE call that actually resets a Ratchet session, and refuses unless
// step 1's own `canAuthorize` was true. See
// fedos_electron_identity_transition_ratchet_reset_ipc.ts for the full
// design/audit rationale.
const identityTransitionRatchetResetDeps = {
  requireBoundary,
  isBoundedString,
  resultFromViewModelState: resultFromViewModelStateUnknown,
  acceptanceGateRejection,
  maxIdLength: MAX_ID_LENGTH,
  resolveAffectedSessions: async (
    oldAccountIdentity: { readonly authority: string; readonly publicIdentifier: string; readonly identityId: string | null },
    pairs: readonly { readonly conversationId: string; readonly remoteDeviceRef: string }[],
  ) => {
    const shell = requireShell();
    if (shell === null) return [];
    const result = shell.identityTransitionRatchetImpact(oldAccountIdentity);
    if (result.outcome !== "ok") return [];
    const sessions = result.value as readonly {
      readonly sessionId: string;
      readonly conversationId: string;
      readonly remoteAccountRef: { readonly authority: string; readonly publicIdentifier: string; readonly identityId: string | null };
      readonly remoteDeviceRef: string;
    }[];
    const wanted = new Set(pairs.map((p) => `${p.conversationId}:${p.remoteDeviceRef}`));
    return sessions.filter((s) => wanted.has(`${s.conversationId}:${s.remoteDeviceRef}`));
  },
};
const handleAppIdentityTransitionAssessContinuity = createFedosIdentityTransitionAssessContinuityHandler(identityTransitionRatchetResetDeps);
const handleAppIdentityTransitionAuthorizeRatchetReset = createFedosIdentityTransitionAuthorizeRatchetResetHandler(identityTransitionRatchetResetDeps);

/** Secure Runtime Alpha 8041-8120 — a dedicated `fedos-app:*` wrapper, distinct from `handleAcceptanceSafetyCenterOverview()` above: that handler returns `boundary.safetyCenter.overviewState` RAW (a `{status,data}` ViewModelState nested one level inside `value`, matching the `fedos-acceptance:*` vocabulary's own established shape for this one call) — flattened here via `resultFromViewModelState()` so `fedos-app:*` keeps ONE consistent `{outcome:"ok",value:<content>}` shape across every command, never two different unwrapping conventions for the ordinary page to guess between. */
async function handleAppSafetyCenterOverview() {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  await boundary.safetyCenter.refreshOverview([]);
  return resultFromViewModelState(boundary.safetyCenter.overviewState);
}

/**
 * Verified Secure Session UI mega-arc (Coordinator) -- the conversation
 * security-state read. `counterpartyAccountRef` is renderer-supplied
 * (mirrors `handleAppIdentityTransitionOpen()`'s own established
 * "renderer already resolved and displays this identity for its own
 * header, so it already has this value" precedent) -- `null` is a valid,
 * honest input for a conversation whose counterparty this process cannot
 * currently resolve; every axis degrades to UNKNOWN/UNAVAILABLE rather
 * than guessing. Delegates entirely to `boundary.securityState`, which
 * itself delegates entirely to already-real Shell methods -- no new
 * business logic in this function.
 */
async function handleAppConversationSecurityState(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const body = payload as { conversationId?: unknown; counterpartyAccountRef?: unknown } | null;
  if (!isBoundedString(body?.conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  let counterpartyAccountRef: { readonly authority: string; readonly publicIdentifier: string; readonly identityId: string | null } | null = null;
  const rawRef = body.counterpartyAccountRef;
  if (typeof rawRef === "object" && rawRef !== null) {
    const r = rawRef as Record<string, unknown>;
    if (typeof r.authority === "string" && isBoundedString(r.publicIdentifier, MAX_ID_LENGTH)) {
      counterpartyAccountRef = { authority: r.authority, publicIdentifier: r.publicIdentifier, identityId: typeof r.identityId === "string" ? r.identityId : null };
    }
  }
  return { outcome: "ok", value: boundary.securityState.getSecurityState(body.conversationId, counterpartyAccountRef, Date.now()) };
}

/**
 * FedOS Peer Device Discovery Arc — publishes a real, signed announcement
 * of this local device's own protocol-scoped identity to `recipientAccountRef`
 * over `conversationId`'s already-established transport. `epoch` is
 * renderer/caller-supplied (defaults to `0`, safe for a genuinely first
 * announcement to a given recipient) — this handler invents no policy of
 * its own beyond input validation; delegates entirely to
 * `shell.peerDeviceAnnounce()`.
 */
async function handleAppPeerDeviceAnnounce(payload: unknown) {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  const body = payload as { conversationId?: unknown; recipientAccountRef?: unknown; epoch?: unknown } | null;
  if (!isBoundedString(body?.conversationId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed conversationId" };
  const rawRef = body.recipientAccountRef;
  if (typeof rawRef !== "object" || rawRef === null) return { outcome: "invalid-input", reason: "malformed recipientAccountRef" };
  const r = rawRef as Record<string, unknown>;
  if (typeof r.authority !== "string" || !isBoundedString(r.publicIdentifier, MAX_ID_LENGTH)) {
    return { outcome: "invalid-input", reason: "malformed recipientAccountRef" };
  }
  const recipientAccountRef = { authority: r.authority, publicIdentifier: r.publicIdentifier, identityId: typeof r.identityId === "string" ? r.identityId : null };
  const epoch = typeof body.epoch === "number" && Number.isInteger(body.epoch) && body.epoch >= 0 ? body.epoch : 0;
  // `shell.peerDeviceAnnounce()` already returns a `FedosDesktopShellResult`-
  // shaped `{outcome, value}` -- returned directly, never re-wrapped
  // (mirrors `handleAcceptanceCreateDirectConversation()`'s own
  // `return shell.createDirectConversation({...})` convention exactly).
  return await shell.peerDeviceAnnounce(recipientAccountRef, body.conversationId, epoch);
}

/** FedOS Peer Device Discovery Arc — every peer device this local Device has ever observed an announcement from, with a LIVE Device Registry trust-state lookup. Delegates entirely to `shell.peerDeviceAnnouncementListObserved()`, returned directly (already `FedosDesktopShellResult`-shaped). */
function handleAppPeerDeviceAnnouncementListObserved() {
  const shell = requireShell();
  if (shell === null) return acceptanceGateRejection();
  return shell.peerDeviceAnnouncementListObserved();
}

// Commerce Product-Media Sync + Truthful Completion mega-arc (Agent I /
// Wave B) — Signed Deletion sender-side. The recipient side (approve/
// reject, below) already exists; this supplies the missing send half. See
// fedos_electron_deletion_request_send_ipc.ts for the full design/audit
// rationale — NEVER claims "deleted everywhere," a remote peer/relay
// accepting delivery of a request is not the same as complying with it.
const handleAppDeletionRequestCreate = createFedosDeletionRequestSendHandler({
  requireBoundary,
  requireShell,
  requireViewerParticipant,
  isBoundedString,
  resultFromViewModelState: resultFromViewModelStateUnknown,
  acceptanceGateRejection,
  maxIdLength: MAX_ID_LENGTH,
});

// Real Digital Delivery mega-arc (Agent U) — sender-side STATUS read, the
// same shared deps as the sender's own `createRequest()` above (identical
// recipient-resolution rule, never a second one). See
// `createFedosDeletionRequestSentStatusHandler()`'s own header.
const handleAppDeletionRequestSentStatus = createFedosDeletionRequestSentStatusHandler({
  requireBoundary,
  requireShell,
  requireViewerParticipant,
  isBoundedString,
  resultFromViewModelState: resultFromViewModelStateUnknown,
  acceptanceGateRejection,
  maxIdLength: MAX_ID_LENGTH,
});

async function handleAppDeletionRequestListReceived() {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  await boundary.deletionRequests.openReceivedInbox();
  return resultFromViewModelState(boundary.deletionRequests.inboxState);
}

/** The recipient-side local review policy is fixed to `"always-review"` -- the SAME conservative, never-auto-accept value `secureRuntimeBundleConfig()` already configures Runtime-wide (`deletionRequestResolveLocalPolicy`); a per-click UI override of this trust policy is deliberately never offered. */
async function handleAppDeletionRequestOpen(payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const requestId = (payload as { requestId?: unknown } | null)?.requestId;
  if (!isBoundedString(requestId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed requestId" };
  await boundary.deletionRequests.openReceivedRequest(requestId, "always-review");
  return resultFromViewModelState(boundary.deletionRequests.consentDetailState);
}

/** Secure Runtime Alpha 8121-8200 — Security Finding 3 (`6873d24f`): requires the exact `requestId` in `payload`, dispatches to the Controller's own exact-id `approve()`/`reject()`, never `approveSelected()`/`rejectSelected()`. */
async function handleAppDeletionRequestDecide(decision: "approve" | "reject", payload: unknown) {
  const boundary = requireBoundary();
  if (boundary === null) return acceptanceGateRejection();
  const requestId = (payload as { requestId?: unknown } | null)?.requestId;
  if (!isBoundedString(requestId, MAX_ID_LENGTH)) return { outcome: "invalid-input", reason: "malformed deletion-request-decide request" };
  if (decision === "approve") await boundary.deletionRequests.approve(requestId);
  else await boundary.deletionRequests.reject(requestId);
  return resultFromViewModelState(boundary.deletionRequests.inboxState);
}

/**
 * Secure Runtime Alpha 8041-8120 — Phase G's own "choose destination through
 * an existing safe path boundary" requirement: no file/save picker existed
 * anywhere in this package before this Arc (confirmed by the Phase A
 * reconciliation report's own file inventory). A native OS picker, gated
 * behind ONE specific named channel that returns ONE user-chosen path back
 * to the caller, is the safe primitive Phase G names -- never a generic
 * "read/write arbitrary path" IPC command (the prohibited kind): the
 * renderer receives only the chosen path string, and that string is only
 * ever accepted afterward by the ALREADY-VALIDATED `fedos-app:archive`
 * export/restore commands, never used for any other file operation.
 */
async function handleAppArchiveChooseExportDestination(payload: unknown): Promise<{ readonly outcome: string; readonly path?: string }> {
  if (activeAssembly === null || mainWindow === null) return acceptanceGateRejection();
  const conversationId = (payload as { conversationId?: unknown } | null)?.conversationId;
  const safeName = isBoundedString(conversationId, MAX_ID_LENGTH) ? conversationId.replace(/[^a-zA-Z0-9_-]/g, "_") : "conversation";
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Conversation Archive",
    defaultPath: `${safeName}.fedosarchive`,
    filters: [{ name: "FedOS Archive", extensions: ["fedosarchive"] }],
  });
  if (result.canceled || result.filePath === undefined) return { outcome: "cancelled" };
  return { outcome: "ok", path: result.filePath };
}

async function handleAppArchiveChooseSource(): Promise<{ readonly outcome: string; readonly path?: string }> {
  if (activeAssembly === null || mainWindow === null) return acceptanceGateRejection();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a FedOS Archive",
    properties: ["openFile"],
    filters: [{ name: "FedOS Archive", extensions: ["fedosarchive"] }, { name: "All Files", extensions: ["*"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return { outcome: "cancelled" };
  return { outcome: "ok", path: result.filePaths[0] };
}

/** Reads current persisted Settings fresh -- mirrors `secureRuntimeBundleConfig()`'s own established "construct one stateless, file-backed controller, `.load()`, discard" pattern exactly; never a second, divergent Settings owner. */
async function handleAppSettingsLoad() {
  if (activeAssembly === null) return acceptanceGateRejection();
  const m = requireModules();
  const controller = m.createFileBackedSettingsController(settingsFilePath());
  return controller.load();
}

/**
 * Secure Runtime Alpha 8121-8200 -- real, disclosed Phase K gap this Arc's
 * own extended vertical slice found live: the nav bar's own `#app-status-area`
 * was wired in the renderer but never actually populated with real Relay
 * connectivity, so "one unreachable Relay does not invalidate the whole
 * profile" had no VISIBLE confirmation anywhere in the shipped UI. Fixed
 * with a thin, read-only wrapper over the ALREADY-REAL, ALREADY-PUBLIC
 * `WebSocketRelay.isConnected()` accessor (Alpha 215, unmodified) -- never
 * a new connection, never a new protocol, never a second Relay set.
 */
async function handleAppRelayStatus() {
  if (activeAssembly === null) return acceptanceGateRejection();
  return { outcome: "ok", value: activeRelays.map((r) => ({ url: r.url, connected: r.isConnected() })) };
}

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 1 (`6873d24f`):
 * the ACCEPTANCE-mode counterpart to the `ui-script` mode's own
 * `readGlobal` action (see that block's own comment) — same closed
 * allowlist, same `typeof window[<name>]` check, reached here via
 * `mainWindow.webContents.executeJavaScript()` since acceptance mode's
 * own command loop otherwise never touches the DOM. Exists ONLY to let
 * this Arc's own test suite prove `window.fedosAcceptance` genuinely IS
 * present when acceptance mode is the very thing that's active — never
 * reachable from the ordinary page itself.
 */
async function handleAcceptanceReadGlobal(payload: unknown) {
  const name = (payload as { name?: unknown } | null)?.name;
  const allowedGlobals = new Set(["fedosProfile", "fedosBeta", "fedosAcceptance", "fedosApp"]);
  if (typeof name !== "string" || !allowedGlobals.has(name)) return { outcome: "invalid-input", reason: "unrecognized readGlobal selector" };
  if (mainWindow === null) return { outcome: "unavailable", reason: "no window" };
  const value = await mainWindow.webContents.executeJavaScript(`typeof window[${JSON.stringify(name)}]`);
  return { outcome: "ok", value };
}

// ---------------------------------------------------------------------
// IPC — `fedos-profile:*` REUSED verbatim (Phase P). Additive `fedos-beta:*`
// namespace for status/settings-application/tray/badge/background.
// ---------------------------------------------------------------------

function registerIpcHandlers(): void {
  ipcCommands.registerHandle(ipcMain, "fedos-profile:status", async () => handleStatus(), { allowConcurrentSelf: true });
  // `bumpsOwnGeneration: true` -- each of these three handlers calls
  // `ipcCommands.bumpGeneration()` on its OWN success/teardown path (see
  // each handler's own body). Without this flag the registry's stale-
  // generation check would incorrectly discard every one of THEIR OWN
  // results, including successful ones -- found via a real reproduced
  // acceptance-test failure (Create silently returning `stale-generation`
  // instead of `ok`), not a theoretical review; see
  // fedos_electron_ipc_command_registry.ts's own header for why this is
  // safe (every OTHER channel keeps full stale-generation protection).
  ipcCommands.registerHandle(ipcMain, "fedos-profile:create", (payload: unknown) => handleCreate(payload), { group: "profile-lifecycle", bumpsOwnGeneration: true });
  ipcCommands.registerHandle(ipcMain, "fedos-profile:unlock", (payload: unknown) => handleUnlock(payload), { group: "profile-lifecycle", bumpsOwnGeneration: true });
  ipcCommands.registerHandle(ipcMain, "fedos-profile:lock", async () => handleLock(), { group: "profile-lifecycle", bumpsOwnGeneration: true });
  // FedOS Peer Device Discovery Arc P0 Closure (Agent F) -- "Start Over" on
  // the recovery screen. Same "profile-lifecycle" serialization group as
  // create/unlock/lock; no `bumpsOwnGeneration` since this handler never
  // touches `activeCoordinator`/`activeAssembly` (see `handleResetInterruptedProfile()`'s
  // own header).
  ipcCommands.registerHandle(ipcMain, "fedos-profile:reset-interrupted", async () => handleResetInterruptedProfile(), { group: "profile-lifecycle" });
  // FedOS Installed Startup Root-Cause Arc -- the SIBLING "Start Over" for
  // a "ready" descriptor with a structurally corrupt/missing sealed seed.
  // Same "profile-lifecycle" serialization group, same no-`bumpsOwnGeneration`
  // reasoning as `fedos-profile:reset-interrupted` above (see
  // `handleResetCorruptReadyProfile()`'s own header).
  ipcCommands.registerHandle(ipcMain, "fedos-profile:reset-corrupt-ready", async () => handleResetCorruptReadyProfile(), { group: "profile-lifecycle" });
  ipcMain.handle("fedos-profile:quit", async () => {
    void performCleanShutdown();
    return { ok: true };
  });

  ipcCommands.registerHandle(ipcMain, "fedos-beta:status", async () => handleBetaStatus(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-beta:settings-plan", (candidate: unknown) => handleSettingsPlan(candidate));
  ipcCommands.registerHandle(ipcMain, "fedos-beta:settings-apply", (candidate: unknown) => handleSettingsApply(candidate));
  ipcCommands.registerHandle(ipcMain, "fedos-beta:tray-action", (candidate: unknown) => handleTrayAction(candidate));
  ipcCommands.registerHandle(ipcMain, "fedos-beta:badge-mark-viewed", (payload: unknown) => handleBadgeMarkViewed(payload));

  // Secure Runtime Alpha 7001-7080 — Phase C closed acceptance vocabulary.
  //
  // Secure Runtime Alpha 8121-8200 — Security Finding 1 (`6873d24f`):
  // these channels are now registered ONLY when `ACCEPTANCE_MODE_ENABLED`
  // (see its own header comment above). In an ordinary packaged
  // production launch, or in any OTHER AUTOTEST_MODE value (`create`,
  // `unlock`, `ui-script`), `ipcMain.handle` is never called for any
  // `fedos-acceptance:*` channel at all — `ipcRenderer.invoke()` against
  // one of these channel names then rejects with Electron's own real "no
  // handler registered" error, a genuine absence, not a UI-layer hint.
  // The acceptance-mode SCRIPT RUNNER below (`AUTOTEST_MODE === "acceptance"`)
  // is entirely unaffected either way: it calls each handler FUNCTION
  // directly from its own command map, never through `ipcMain`/
  // `ipcRenderer` — confirmed by direct read of that block, so this gate
  // narrows only the renderer-reachable IPC surface, never the test
  // harness's own internal capability.
  if (ACCEPTANCE_MODE_ENABLED) {
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:create-direct-conversation", (payload: unknown) => handleAcceptanceCreateDirectConversation(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:activate-direct-conversation", (payload: unknown) => handleAcceptanceActivateDirectConversation(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:device-pairing-create", (payload: unknown) => handleAcceptanceDevicePairingCreate(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:device-pairing-inspect", (payload: unknown) => handleAcceptanceDevicePairingInspect(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:device-pairing-approve", (payload: unknown) => handleAcceptanceDevicePairingApprove(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:device-pairing-complete", (payload: unknown) => handleAcceptanceDevicePairingComplete(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:establish-direct-ratchet-session", (payload: unknown) => handleAcceptanceEstablishDirectRatchetSession(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:send-message", (payload: unknown) => handleAcceptanceSendMessage(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:list-messages", (payload: unknown) => handleAcceptanceListMessages(payload), { allowConcurrentSelf: true });
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:read-message", (payload: unknown) => handleAcceptanceReadMessage(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:direct-ratchet-status", (payload: unknown) => handleAcceptanceDirectRatchetStatus(payload), { allowConcurrentSelf: true });
    // Secure Runtime Alpha 7321-7400 -- these four channels close Release
    // Readiness Review B-2/B-7; Secure Runtime Alpha 8121-8200 narrows
    // "reachable whenever a real profile is unlocked, in ANY mode" (the
    // ORIGINAL 7321-7400 wording) to the same `ACCEPTANCE_MODE_ENABLED`
    // gate as every other `fedos-acceptance:*` channel above -- the
    // ordinary UI has had its own equivalent `fedos-app:*` channel for
    // each of these four since Alpha 8041-8120 (`create-invitation`,
    // `search`, `archive`, `safety-center-overview`), so no real
    // capability is lost, only the SECOND, acceptance-only path to it.
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:create-conversation-invitation", (payload: unknown) => handleAcceptanceCreateConversationInvitation(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:search", (payload: unknown) => handleAcceptanceSearch(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:archive", (payload: unknown) => handleAcceptanceArchive(payload));
    ipcCommands.registerHandle(ipcMain, "fedos-acceptance:safety-center-overview", async () => handleAcceptanceSafetyCenterOverview());
  }

  // Secure Runtime Alpha 8041-8120 -- Phase B-K: the ordinary, user-facing
  // `fedos-app:*` vocabulary. Every handler is registered unconditionally
  // (mirrors every channel above); the security boundary is each handler's
  // own `requireShell()`/`requireBoundary()` runtime check, not whether the
  // channel itself was registered.
  ipcCommands.registerHandle(ipcMain, "fedos-app:conversations-list", async () => handleAppConversationsList(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:conversation-open", (payload: unknown) => handleAppConversationOpen(payload));
  // Phase E -- a genuinely restarted Runtime must re-activate a Direct
  // conversation before it can send/receive (a real, per-Runtime-lifetime
  // precondition -- Alpha 2041-2120, unmodified, unrelated to this Arc);
  // reuses the SAME handler `fedos-acceptance:activate-direct-conversation`
  // already dispatches to, never a second implementation.
  ipcCommands.registerHandle(ipcMain, "fedos-app:conversation-activate", (payload: unknown) => handleAcceptanceActivateDirectConversation(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:messages-list", (payload: unknown) => handleAppMessagesList(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:message-reveal", (payload: unknown) => handleAppMessageReveal(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:message-send", (payload: unknown) => handleAppMessageSend(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:membership-list", (payload: unknown) => handleAppMembershipList(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:invitations-list", (payload: unknown) => handleAppInvitationsList(payload), { allowConcurrentSelf: true });
  // Phase D -- creating an invitation IS creating the Direct conversation and
  // sending it over the real relay; reuses the SAME handler
  // `fedos-acceptance:create-conversation-invitation` already dispatches to,
  // never a second implementation.
  ipcCommands.registerHandle(ipcMain, "fedos-app:create-invitation", (payload: unknown) => handleAcceptanceCreateConversationInvitation(payload));
  // Phase F/G -- reuse the SAME handlers `fedos-acceptance:search`/`:archive` already dispatch to.
  ipcCommands.registerHandle(ipcMain, "fedos-app:search", (payload: unknown) => handleAcceptanceSearch(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:archive", (payload: unknown) => handleAcceptanceArchive(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:archive-workflow-warnings", (payload: unknown) => handleAppArchiveWorkflowWarnings(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:archive-choose-export-destination", (payload: unknown) => handleAppArchiveChooseExportDestination(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:archive-choose-source", async () => handleAppArchiveChooseSource());
  // Phase H -- Device management.
  ipcCommands.registerHandle(ipcMain, "fedos-app:devices-list", async () => handleAppDevicesList(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-detail", (payload: unknown) => handleAppDeviceDetail(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-revoke", (payload: unknown) => handleAppDeviceRevoke(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-sync-status", async () => handleAppDeviceSyncStatus(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-sync-schedules-list", async () => handleAppDeviceSyncSchedulesList(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-sync-transfers-list", async () => handleAppDeviceSyncTransfersList(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-sync-conflicts-list", (payload: unknown) => handleAppDeviceSyncConflictsList(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-sync-conflict-acknowledge", (payload: unknown) => handleAppDeviceSyncConflictAcknowledge(payload));
  // Phase H (pairing) -- reuse the SAME handlers the acceptance vocabulary already dispatches to.
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-pairing-create", (payload: unknown) => handleAcceptanceDevicePairingCreate(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-pairing-inspect", (payload: unknown) => handleAcceptanceDevicePairingInspect(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-pairing-approve", (payload: unknown) => handleAcceptanceDevicePairingApprove(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:device-pairing-complete", (payload: unknown) => handleAcceptanceDevicePairingComplete(payload));
  // Phase I -- Identity Replacement.
  ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-list", (payload: unknown) => handleAppIdentityTransitionList(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-open", (payload: unknown) => handleAppIdentityTransitionOpen(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-accept", (payload: unknown) => handleAppIdentityTransitionDecide("accept", payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-reject", (payload: unknown) => handleAppIdentityTransitionDecide("reject", payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-defer", (payload: unknown) => handleAppIdentityTransitionDecide("defer", payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-record-manual-verification", (payload: unknown) => handleAppIdentityTransitionRecordManualVerification(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-assess-continuity", (payload: unknown) => handleAppIdentityTransitionAssessContinuity(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-authorize-ratchet-reset", (payload: unknown) => handleAppIdentityTransitionAuthorizeRatchetReset(payload));
  // Phase J -- Signed Deletion.
  ipcCommands.registerHandle(ipcMain, "fedos-app:deletion-request-list-received", async () => handleAppDeletionRequestListReceived(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:deletion-request-open", (payload: unknown) => handleAppDeletionRequestOpen(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:deletion-request-approve", (payload: unknown) => handleAppDeletionRequestDecide("approve", payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:deletion-request-reject", (payload: unknown) => handleAppDeletionRequestDecide("reject", payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:deletion-request-create", (payload: unknown) => handleAppDeletionRequestCreate(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:deletion-request-sent-status", (payload: unknown) => handleAppDeletionRequestSentStatus(payload), { allowConcurrentSelf: true });
  // Phase K -- reuse the SAME handler `fedos-acceptance:safety-center-overview` already dispatches to.
  ipcCommands.registerHandle(ipcMain, "fedos-app:safety-center-overview", async () => handleAppSafetyCenterOverview(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:conversation-security-state", (payload: unknown) => handleAppConversationSecurityState(payload), { allowConcurrentSelf: true });
  // FedOS Peer Device Discovery Arc.
  ipcCommands.registerHandle(ipcMain, "fedos-app:peer-device-announce", (payload: unknown) => handleAppPeerDeviceAnnounce(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:peer-device-announcement-list-observed", async () => handleAppPeerDeviceAnnouncementListObserved(), { allowConcurrentSelf: true });
  // Phase C -- Settings read (write already exists as `fedos-beta:settings-plan`/`:settings-apply`).
  ipcCommands.registerHandle(ipcMain, "fedos-app:settings-load", async () => handleAppSettingsLoad(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:relay-status", async () => handleAppRelayStatus(), { allowConcurrentSelf: true });
  // Commerce Reachable Catalog + Product Surface Phase 1 -- exactly one
  // new, bounded IPC channel family. Read-only; never gated on shell/
  // profile readiness (see the handlers' own header comment).
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-catalog-list", async () => handleCommerceCatalogList(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-product-detail", (payload: unknown) => handleCommerceProductDetail(payload), { allowConcurrentSelf: true });
  // Commerce E2E Completion arc (coordinator integration gate) — Merchant
  // Product CRUD + Order + local Payment simulator. Same bounded, named-
  // channel, single-purpose-handler discipline as every other `fedos-app:*`
  // registration in this function.
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-merchant-products-list", (payload: unknown) => handleCommerceMerchantProductsList(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-product-create", (payload: unknown) => handleCommerceProductCreate(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-product-update", (payload: unknown) => handleCommerceProductUpdate(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-product-publish", (payload: unknown) => handleCommerceProductPublish(payload, true));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-product-unpublish", (payload: unknown) => handleCommerceProductPublish(payload, false));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-order-create", (payload: unknown) => handleCommerceOrderCreate(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-order-submit", (payload: unknown) => handleCommerceOrderAction(payload, "submit", "customer"));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-order-cancel", (payload: unknown) => handleCommerceOrderAction(payload, "cancel", "customer"));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-order-accept", (payload: unknown) => handleCommerceOrderAction(payload, "accept", "merchant"));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-order-reject", (payload: unknown) => handleCommerceOrderAction(payload, "reject", "merchant"));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-order-fulfill", (payload: unknown) => handleCommerceOrderAction(payload, "fulfill", "merchant"));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-orders-list-mine", (payload: unknown) => handleCommerceOrdersListMine(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-orders-list-incoming", (payload: unknown) => handleCommerceOrdersListIncoming(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-payment-request", (payload: unknown) => handleCommercePaymentRequest(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-payment-simulate", (payload: unknown) => handleCommercePaymentSimulate(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-delivery-status", (payload: unknown) => handleCommerceDeliveryStatus(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-delivery-acknowledge-receipt", (payload: unknown) => handleCommerceDeliveryAcknowledgeReceipt(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-order-complete", (payload: unknown) => handleCommerceOrderComplete(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-receipt-issue", (payload: unknown) => handleCommerceReceiptIssue(payload));
  // FedOS Commerce Purchase Completion mega-arc (Agent R) -- read-only receipt lookup (never mints), closes the dev-vs-packaged restart-visibility gap.
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-receipt-lookup", (payload: unknown) => handleCommerceReceiptLookup(payload), { allowConcurrentSelf: true });
  // FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
  // arc mandate item 3: signed Product Share Proof issue (seller) + open (buyer).
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-share-product-issue", (payload: unknown) => handleCommerceShareProductIssue(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-share-open", (payload: unknown) => handleCommerceShareOpen(payload));
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent R's read-only Persona Board query.
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-persona-board-query", (payload: unknown) => handleCommercePersonaBoardQuery(payload), { allowConcurrentSelf: true });
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's minimal NetworkProfile Settings surface.
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-network-profile-get", async () => handleCommerceNetworkProfileGet(), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-network-profile-set", (payload: unknown) => handleCommerceNetworkProfileSet(payload));
  // FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
  // (Agent D) -- new production IPC channels: protected-media redemption
  // (arc §35-37), public product-image attach (arc §38), and the real
  // activity/badge data query (arc §32/§36).
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-product-image-attach", (payload: unknown) => handleCommerceProductImageAttach(payload));
  // Buyer Discovery + Digital Content Delivery mega-arc (Agent M) --
  // protected ("buyers only") content attach, and the creator-only
  // plain-language attached-content list.
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-product-content-attach", (payload: unknown) => handleCommerceProductContentAttach(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-merchant-product-media-list", (payload: unknown) => handleCommerceMerchantProductMediaList(payload), { allowConcurrentSelf: true });
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-media-grant-redeem", (payload: unknown) => handleCommerceMediaGrantRedeem(payload));
  ipcCommands.registerHandle(ipcMain, "fedos-app:commerce-activity-summary", (payload: unknown) => handleCommerceActivitySummary(payload), { allowConcurrentSelf: true });
}

// ---------------------------------------------------------------------
// Window — identical secure policy to every prior package main.
// ---------------------------------------------------------------------

function applySecureWindowPolicy(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
  if (DEV_TOOLS_ENABLED) window.webContents.openDevTools();
}

function createBetaWindow(): BrowserWindow {
  const offscreen = AUTOTEST_MODE.length > 0;
  const window = new BrowserWindow({
    width: 760,
    height: 680,
    show: !offscreen,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      offscreen,
      preload: path.join(__dirname, "fedos_electron_beta_preload.cjs"),
    },
  });
  applySecureWindowPolicy(window);
  if (AUTOTEST_MODE.length > 0) {
    // Test-only: forwards the real page's own `console.*` calls into this
    // process's stdout so a spawned-subprocess test (`ui-script`/`acceptance`)
    // can see a renderer-side error without a devtools window. Never active
    // on an ordinary launch (`AUTOTEST_MODE` is always empty then).
    window.webContents.on("console-message", (_e, _level, message) => {
      console.log(`FEDOS_ELECTRON_BETA_RENDERER_CONSOLE:${message}`);
    });
  }
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
    if (activeAssembly !== null) {
      activeAssembly.navigationRegistry.disposeWindow(String(window.id));
      activeAssembly.backgroundLifecycle.windowClosed();
      void activeAssembly.badgeCoordinator.refresh();
    }
  });
  void window.loadFile(path.join(__dirname, "fedos_electron_beta_page.html"));
  if (activeAssembly !== null) {
    activeAssembly.backgroundLifecycle.windowOpened();
  }
  return window;
}

// ---------------------------------------------------------------------
// Startup.
// ---------------------------------------------------------------------

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    // Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
    // real Commerce Network Profile durability fix; see
    // `loadPersistedCommerceNetworkProfile()`'s own header for why this is
    // loaded here (post-ready) rather than eagerly at module scope.
    commerceNetworkProfile = loadPersistedCommerceNetworkProfile();
    modules = await loadRootModules();
    registerIpcHandlers();
    mainWindow = createBetaWindow();
    console.log("fedos-beta: host started");
    logCheckpoint("host-started");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("fedos-beta: startup failed", message);
    // Commerce Durability arc (coordinator, live-run finding) -- the
    // packaged binary MUST launch with `stdio: "ignore"` (Part 1 of
    // `docs/commerce/COMMERCE-PACKAGED-BINARY-E2E-CLOSURE.md`), which
    // silently discards this exact `console.error` on every real boot
    // failure -- previously making a startup CRASH indistinguishable from
    // a slow/hung app to any harness watching only for the
    // `FEDOS_BETA_UI_STEP_LOG_FILE` checkpoint stream. Best-effort, never
    // read/written on a real production launch (empty `UI_STEP_LOG_FILE`
    // by default, same gating as `logCheckpoint()` itself).
    logCheckpoint(`startup-failed:${message.slice(0, 200)}`);
    app.quit();
    return;
  }

  if (AUTOTEST_MODE === "create" || AUTOTEST_MODE === "unlock") {
    // This file's own autotest mode exercises the real IPC commands directly, headless, and logs a
    // coarse pass/fail marker the acceptance harness can grep for.
    void (async () => {
      try {
        const secretPayload = { label: "Beta Autotest", secret: AUTOTEST_SECRET };
        const result = AUTOTEST_MODE === "create" ? await handleCreate(secretPayload) : await handleUnlock({ secret: AUTOTEST_SECRET });
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_RESULT:${result.outcome}`);
        const status = await handleBetaStatus();
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_STATUS:${JSON.stringify(status.profile)}`);
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_COMPOSITION:${JSON.stringify({ navigation: status.navigation !== null, badge: status.badge !== null, tray: status.trayActive, deviceSyncStatus: status.deviceSyncStatus })}`);
        console.log(`FEDOS_ELECTRON_BETA_AUTOTEST_UNIFIED_GRAPH:${JSON.stringify(unifiedGraphDiagnostics())}`);
      } catch (err) {
        console.error("fedos-beta: autotest error", err instanceof Error ? err.message : String(err));
      } finally {
        await performCleanShutdown();
      }
    })();
  }

  if (AUTOTEST_MODE === "acceptance") {
    // Secure Runtime Alpha 7001-7080 -- Phase C/G/H/J/K. No precedent
    // exists anywhere in this repository for a live, multi-command IPC
    // session with a running Electron subprocess from an external Node
    // test driver (confirmed by the Phase A reconciliation report). This
    // mode reads an ORDERED SCRIPT of steps (`FEDOS_BETA_ACCEPTANCE_SCRIPT`,
    // a JSON array of `{command, payload}`), and calls the SAME internal
    // handler function each named command already dispatches to via
    // `registerIpcHandlers()` above -- never a second implementation. Each
    // step's result is logged as one JSON line the test driver parses;
    // an unknown command name fails that ONE step closed
    // (`{outcome:"unavailable", reason:"unknown-acceptance-script-command"}`)
    // without aborting the remaining steps, so a script can assert on a
    // failure mid-sequence exactly like a real multi-step user flow would.
    void (async () => {
      const commands: Record<string, (payload: unknown) => Promise<unknown>> = {
        "profile-create": (payload) => handleCreate(payload),
        "profile-unlock": (payload) => handleUnlock(payload),
        "profile-lock": () => handleLock(),
        "beta-status": () => handleBetaStatus(),
        "unified-graph": () => Promise.resolve(unifiedGraphDiagnostics()),
        "acceptance-create-direct-conversation": (payload) => handleAcceptanceCreateDirectConversation(payload),
        "acceptance-activate-direct-conversation": (payload) => handleAcceptanceActivateDirectConversation(payload),
        "acceptance-device-pairing-create": (payload) => handleAcceptanceDevicePairingCreate(payload),
        "acceptance-device-pairing-inspect": (payload) => handleAcceptanceDevicePairingInspect(payload),
        "acceptance-device-pairing-approve": (payload) => handleAcceptanceDevicePairingApprove(payload),
        "acceptance-device-pairing-complete": (payload) => handleAcceptanceDevicePairingComplete(payload),
        "acceptance-establish-direct-ratchet-session": (payload) => handleAcceptanceEstablishDirectRatchetSession(payload),
        "acceptance-send-message": (payload) => handleAcceptanceSendMessage(payload),
        "acceptance-list-messages": (payload) => handleAcceptanceListMessages(payload),
        "acceptance-read-message": (payload) => handleAcceptanceReadMessage(payload),
        "acceptance-direct-ratchet-status": (payload) => handleAcceptanceDirectRatchetStatus(payload),
        "acceptance-direct-ratchet-status-poll-until-active": (payload) => handleAcceptanceDirectRatchetStatusPollUntilActive(payload),
        "acceptance-list-messages-poll-until-count": (payload) => handleAcceptanceListMessagesPollUntilCount(payload),
        "acceptance-create-conversation-invitation": (payload) => handleAcceptanceCreateConversationInvitation(payload),
        "acceptance-search": (payload) => handleAcceptanceSearch(payload),
        "acceptance-archive": (payload) => handleAcceptanceArchive(payload),
        // FedOS Peer Device Discovery Arc -- the SAME real handler functions `registerIpcHandlers()` also registers for a real renderer to call.
        "acceptance-peer-device-announce": (payload) => handleAppPeerDeviceAnnounce(payload),
        "acceptance-peer-device-announcement-list-observed": () => Promise.resolve(handleAppPeerDeviceAnnouncementListObserved()),
        // Secure Runtime Alpha 8041-8120 -- non-DOM regression coverage for
        // the SAME `fedos-app:*` handler functions the real page's own
        // `window.fedosApp` bridge calls; useful both as a lower-level
        // regression suite (Phase O's own "a lower-level acceptance suite
        // may remain as regression coverage") and to isolate a main-process
        // handler bug from a renderer/DOM bug during development.
        "app-conversations-list": () => handleAppConversationsList(),
        "app-conversation-open": (payload) => handleAppConversationOpen(payload),
        "app-messages-list": (payload) => handleAppMessagesList(payload),
        "app-message-send": (payload) => handleAppMessageSend(payload),
        "app-devices-list": () => handleAppDevicesList(),
        "app-device-revoke": (payload) => handleAppDeviceRevoke(payload),
        "app-identity-transition-list": (payload) => handleAppIdentityTransitionList(payload),
        "app-deletion-request-list-received": () => handleAppDeletionRequestListReceived(),
        "app-safety-center-overview": () => handleAppSafetyCenterOverview(),
        "app-conversation-security-state": (payload) => handleAppConversationSecurityState(payload),
        "app-peer-device-announce": (payload) => handleAppPeerDeviceAnnounce(payload),
        "app-peer-device-announcement-list-observed": async () => handleAppPeerDeviceAnnouncementListObserved(),
        "app-settings-load": () => handleAppSettingsLoad(),
        "app-relay-status": () => handleAppRelayStatus(),
        "acceptance-safety-center-overview": () => handleAcceptanceSafetyCenterOverview(),
        "read-global": (payload) => handleAcceptanceReadGlobal(payload),
      };
      try {
        const scriptRaw = process.env.FEDOS_BETA_ACCEPTANCE_SCRIPT ?? "[]";
        const script: ReadonlyArray<{ readonly command: string; readonly payload?: unknown }> = JSON.parse(scriptRaw);
        for (let i = 0; i < script.length; i++) {
          const step = script[i]!;
          // Secure Runtime Alpha 7321-7400 -- "wait" is the ONE pseudo-command
          // this script interpreter recognizes that never reaches a Shell/
          // IPC handler: a real, live, two-party relay-delivered flow needs
          // a genuine settle window for the durable Outbox Scheduler's own
          // NEXT real tick (Alpha 1471-1540, unmodified) before this process
          // exits -- exactly the same "standard NIP-01 client discipline"
          // settle wait every real vertical-slice test elsewhere in this
          // repository already uses, just expressed as a scripted step here
          // since this process has no test harness of its own to await from
          // the outside.
          if (step.command === "wait") {
            const ms = (step.payload as { ms?: unknown } | null)?.ms;
            await new Promise((resolve) => setTimeout(resolve, typeof ms === "number" && ms > 0 && ms <= 30000 ? ms : 0));
            const waitLine = `FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:${i}:${step.command}:${JSON.stringify({ outcome: "ok" })}`;
            console.log(waitLine);
            if (UI_STEP_LOG_FILE.length > 0) {
              // FedOS Peer Device Discovery Arc -- reuses the SAME
              // best-effort disk mirror the ui-script mode already
              // established (see that mode's own comment above), so an
              // acceptance script can ALSO be driven against the real
              // packaged binary (stdio:"ignore", stdout unobservable),
              // never a second logging mechanism.
              try {
                fs.appendFileSync(UI_STEP_LOG_FILE, waitLine + "\n");
              } catch (fileErr) {
                console.error("fedos-beta: acceptance step log file write failed", fileErr instanceof Error ? fileErr.message : String(fileErr));
              }
            }
            continue;
          }
          const fn = commands[step.command];
          const result = fn === undefined ? { outcome: "unavailable", reason: "unknown-acceptance-script-command" } : await fn(step.payload);
          const stepLine = `FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:${i}:${step.command}:${JSON.stringify(result)}`;
          console.log(stepLine);
          if (UI_STEP_LOG_FILE.length > 0) {
            try {
              fs.appendFileSync(UI_STEP_LOG_FILE, stepLine + "\n");
            } catch (fileErr) {
              console.error("fedos-beta: acceptance step log file write failed", fileErr instanceof Error ? fileErr.message : String(fileErr));
            }
          }
        }
      } catch (err) {
        console.error("fedos-beta: acceptance script error", err instanceof Error ? err.message : String(err));
      } finally {
        await performCleanShutdown();
      }
    })();
  }

  if (AUTOTEST_MODE === "ui-script") {
    // Secure Runtime Alpha 8041-8120 -- Phase O's own explicit requirement:
    // "the headline test must interact with visible user-facing controls...
    // do not substitute webContents calls directly into internal acceptance
    // methods for user-facing proof." Unlike `AUTOTEST_MODE=acceptance`
    // above (which calls this file's own internal handler functions
    // directly, bypassing the DOM entirely), this mode drives the REAL
    // rendered page through `webContents.executeJavaScript()` -- filling
    // real `<input>`/`<textarea>` elements, dispatching real `click()` calls
    // on real `<button>` elements, and reading back real rendered
    // `textContent`/`value` -- the exact same DOM `fedos_electron_beta_renderer.ts`
    // itself listens on, so every action still traverses the real
    // preload bridge -> real IPC channel -> real handler path, never a
    // shortcut around it. Test-only (`AUTOTEST_MODE` is never set on an
    // ordinary launch); does not weaken `contextIsolation`/`sandbox` for the
    // page itself -- `executeJavaScript` is a main-process-initiated
    // DevTools-protocol-level injection into the page's own world, the same
    // technique every Electron UI test harness (Spectron/Playwright) uses,
    // not a new capability exposed TO the page.
    void (async () => {
      logCheckpoint("ui-script-iife-start");
      const window = mainWindow;
      if (window === null) {
        logCheckpoint("ui-script-no-window");
        await performCleanShutdown();
        return;
      }
      logCheckpoint(`ui-script-have-window-isLoadingMainFrame=${String(window.webContents.isLoadingMainFrame())}`);
      if (window.webContents.isLoadingMainFrame()) {
        await new Promise<void>((resolve) => window.webContents.once("did-finish-load", () => resolve()));
      }
      logCheckpoint("ui-script-page-loaded");
      if (UI_STEP_LOG_FILE.length > 0) {
        try {
          fs.mkdirSync(path.dirname(UI_STEP_LOG_FILE), { recursive: true });
        } catch (mkdirErr) {
          console.error("fedos-beta: ui-script step log dir create failed", mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr));
        }
      }
      try {
        const scriptRaw = process.env.FEDOS_BETA_UI_SCRIPT ?? "[]";
        const script: ReadonlyArray<{ readonly action: "fill" | "click" | "doubleClick" | "read" | "readGlobal" | "wait" | "copy" | "screenshot" | "attachFile"; readonly selector?: string; readonly value?: string; readonly as?: "text" | "value" | "href"; readonly ms?: number; readonly targetSelector?: string; readonly fileName?: string; readonly fileType?: string }> = JSON.parse(scriptRaw);
        for (let i = 0; i < script.length; i++) {
          const step = script[i]!;
          if (step.action === "wait") {
            const ms = step.ms;
            await new Promise((resolve) => setTimeout(resolve, typeof ms === "number" && ms > 0 && ms <= 30000 ? ms : 0));
            console.log(`FEDOS_ELECTRON_BETA_UI_STEP_JSON:${JSON.stringify({ index: i, action: "wait", selector: "", result: { outcome: "ok" } })}`);
            continue;
          }
          const selector = step.selector ?? "";
          let result: unknown;
          if (step.action === "fill") {
            const value = step.value ?? "";
            result = await window.webContents.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { outcome: "not-found" }; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", { bubbles: true })); return { outcome: "ok" }; })()`,
            );
          } else if (step.action === "attachFile") {
            // Buyer Discovery + Digital Content Delivery mega-arc
            // (Coordinator validation-gate bug fix) -- the ONE thing this
            // `ui-script` harness could not previously do, and therefore the
            // reason a 100%-reproducible real-app failure in the protected
            // "Attach Purchased File" control had ZERO automated coverage:
            // populate a real `<input type="file">`. `fill` cannot do it
            // (assigning `.value` on a file input throws in every browser),
            // so this action builds a REAL `File` object from the caller's
            // base64 bytes and installs it via the page's own real
            // `DataTransfer`/`FileList` API -- exactly what a real OS file
            // picker hands the page. Everything downstream (the renderer's
            // own `FileReader` read, `file.type`, the real preload bridge,
            // the real IPC channel, the real main-process handler) is then
            // byte-for-byte the same path a human user drives; nothing here
            // reaches around the renderer. Test-only, same `AUTOTEST_MODE`
            // gate as every other action in this loop.
            const fileBase64 = step.value ?? "";
            const fileName = step.fileName ?? "attachment.bin";
            const fileType = step.fileType ?? "application/octet-stream";
            result = await window.webContents.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { outcome: "not-found" }; const bin = atob(${JSON.stringify(fileBase64)}); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); const file = new File([bytes], ${JSON.stringify(fileName)}, { type: ${JSON.stringify(fileType)} }); const dt = new DataTransfer(); dt.items.add(file); el.files = dt.files; el.dispatchEvent(new Event("change", { bubbles: true })); return { outcome: "ok", value: String(el.files.length) + ":" + String(el.files[0] ? el.files[0].size : 0) + ":" + String(el.files[0] ? el.files[0].type : "") }; })()`,
            );
          } else if (step.action === "click") {
            result = await window.webContents.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { outcome: "not-found" }; el.click(); return { outcome: "ok" }; })()`,
            );
          } else if (step.action === "doubleClick") {
            // Secure Runtime Alpha 8121-8200 -- Security Finding 2
            // (`6873d24f`): fires TWO real `.click()` calls back-to-back,
            // synchronously, with NO await between them -- the real
            // browser DOM dispatches the first click's own listener
            // synchronously up to its first `await`, so this genuinely
            // exercises "does the SECOND click reach the handler before
            // the first one's own disable-while-in-flight guard takes
            // effect," never a scripted delay that would hide a real race.
            result = await window.webContents.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { outcome: "not-found" }; el.click(); el.click(); return { outcome: "ok" }; })()`,
            );
          } else if (step.action === "copy") {
            // Secure Runtime Alpha 8201-8280 -- a purely client-side
            // "copy the visible text/value from one element into another
            // element's `.value`" step, added ONLY to this pre-existing
            // `ui-script` autotest execution loop (same gate as every other
            // action here). Stands in for the real, manual copy/paste a
            // human performs when moving a pairing request/approval string
            // between two Devices (or, as this Arc's own Device Pairing
            // vertical slice uses it, between two fields on the SAME real
            // rendered page within one script run) -- never a Node-side
            // round-trip, never a shortcut around the real DOM/IPC path any
            // other step in this file already takes.
            const targetSelector = step.targetSelector ?? "";
            const as = step.as ?? "value";
            result = await window.webContents.executeJavaScript(
              `(() => { const src = document.querySelector(${JSON.stringify(selector)}); const dst = document.querySelector(${JSON.stringify(targetSelector)}); if (!src || !dst) return { outcome: "not-found" }; const v = ${as === "text" ? "src.textContent" : "src.value"}; dst.value = v; dst.dispatchEvent(new Event("input", { bubbles: true })); return { outcome: "ok", value: v }; })()`,
            );
          } else if (step.action === "screenshot") {
            // Commerce E2E Completion arc -- captures a real PNG of the
            // CURRENT window contents via Electron's own `capturePage()`
            // (real compositor output, not a DOM serialization/mock).
            // Fails closed (never silently no-ops) on two independent
            // conditions: (1) no `FEDOS_ELECTRON_BETA_SCREENSHOT_DIR` env
            // var configured (mirrors every other `FEDOS_ELECTRON_BETA_*`
            // override's own opt-in-only posture -- an ordinary launch,
            // and every OTHER `ui-script` run that doesn't need
            // screenshots, never writes to disk), and (2) `step.value`
            // (the filename stem) failing a bounded, allowlisted-charset
            // check -- never an arbitrary path from the script (no `..`,
            // no path separators, no absolute path), even though this
            // harness is already gated behind `AUTOTEST_MODE`/test-only
            // use, matching this file's own "fail closed, never trust an
            // input's shape" discipline elsewhere.
            const screenshotDir = process.env.FEDOS_ELECTRON_BETA_SCREENSHOT_DIR ?? "";
            const stem = step.value ?? "";
            if (screenshotDir.length === 0) {
              result = { outcome: "unavailable", reason: "FEDOS_ELECTRON_BETA_SCREENSHOT_DIR not configured" };
            } else if (!/^[a-zA-Z0-9_-]{1,80}$/.test(stem)) {
              result = { outcome: "invalid-input", reason: "screenshot filename stem must match ^[a-zA-Z0-9_-]{1,80}$" };
            } else {
              // An optional `selector` scrolls that element into view first
              // (`capturePage()` only ever captures the current, possibly
              // scrolled, viewport -- never the full document) -- best
              // effort, never fails the step if the element is absent.
              if (selector.length > 0) {
                await window.webContents.executeJavaScript(
                  `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.scrollIntoView({ block: "start" }); })()`,
                );
              }
              const image = await window.webContents.capturePage();
              const outPath = path.join(screenshotDir, `${stem}.png`);
              fs.mkdirSync(screenshotDir, { recursive: true });
              fs.writeFileSync(outPath, image.toPNG());
              result = { outcome: "ok", value: outPath };
            }
          } else if (step.action === "readGlobal") {
            // Secure Runtime Alpha 8121-8200 -- Security Finding 1
            // (`6873d24f`): reads `typeof window[<selector>]` for a small,
            // closed set of top-level bridge names ONLY (never an
            // arbitrary property path, never a value read) -- exists
            // solely to prove a bridge is genuinely ABSENT (`"undefined"`)
            // or genuinely PRESENT (`"object"`) from a real running page,
            // the same DevTools-injection technique every other action in
            // this block already uses, just checking presence rather than
            // DOM text.
            const allowedGlobals = new Set(["fedosProfile", "fedosBeta", "fedosAcceptance", "fedosApp"]);
            result = allowedGlobals.has(selector)
              ? { outcome: "ok", value: await window.webContents.executeJavaScript(`typeof window[${JSON.stringify(selector)}]`) }
              : { outcome: "invalid-input", reason: "unrecognized readGlobal selector" };
          } else {
            // Real Digital Delivery mega-arc (Coordinator, positive E2E) --
            // `as: "href"` reads a real `<a>` element's resolved `.href`
            // (never `getAttribute("href")`, which would return the raw,
            // possibly-relative attribute text) -- the ONE way this harness
            // can pull the buyer's real received purchased-content
            // `data:` URL (`#commerce-order-purchased-content-link`) out of
            // a live page for byte-for-byte SHA-256 verification against a
            // known digest, without adding any new IPC surface or touching
            // renderer code. Test-only, same `AUTOTEST_MODE` gate as every
            // other action in this loop.
            const as = step.as ?? "text";
            const accessor = as === "value" ? "el.value" : as === "href" ? "el.href" : "el.textContent";
            result = await window.webContents.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { outcome: "not-found" }; return { outcome: "ok", value: ${accessor} }; })()`,
            );
          }
          const stepLine = `FEDOS_ELECTRON_BETA_UI_STEP_JSON:${JSON.stringify({ index: i, action: step.action, selector, result })}`;
          console.log(stepLine);
          if (UI_STEP_LOG_FILE.length > 0) {
            // See `UI_STEP_LOG_FILE`'s own doc comment above -- best-effort,
            // additive disk mirror of the exact same line, never a second
            // source of truth (same string, same content, same order).
            try {
              fs.appendFileSync(UI_STEP_LOG_FILE, stepLine + "\n");
            } catch (fileErr) {
              console.error("fedos-beta: ui-script step log file write failed", fileErr instanceof Error ? fileErr.message : String(fileErr));
            }
          }
        }
      } catch (err) {
        console.error("fedos-beta: ui-script error", err instanceof Error ? err.message : String(err));
      } finally {
        await performCleanShutdown();
      }
    })();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createBetaWindow();
    }
  });
});

app.on("window-all-closed", () => {
  void performCleanShutdown();
});
