/**
 * Secure Runtime Alpha 5061-5160 — the Beta renderer page script. Runs
 * inside the loaded page's isolated Chromium context (NOT the preload/Node
 * context) — no `import` of any kind, reads ONLY `window.fedosProfile` /
 * `window.fedosBeta` / `window.fedosApp` (the frozen bridges the preload
 * placed there), writes DOM. Mirrors `fedos_electron_unlock_renderer.ts`'s
 * own onboarding flow exactly, extended with the Phase H/I Beta status +
 * limitations render once the profile reaches `ready`.
 *
 * SECRET DISCIPLINE: identical to `fedos_electron_unlock_renderer.ts` — see
 * that file's own header. Never duplicated here beyond restating the rule.
 *
 * Secure Runtime Alpha 8041-8120 (FedOS Desktop Beta User-Facing Product UI
 * Completion Arc) — extends this file (never replaces it) with the ordinary,
 * user-facing Conversations/Search/Archive/Devices/Safety Center/Settings
 * screens, driven ENTIRELY through `window.fedosApp` (Phase B-K). This file
 * never reads `window.fedosAcceptance` — that bridge remains reachable only
 * by the pre-existing acceptance-mode test harness (Phase Q).
 */

(() => {
window.addEventListener("error", (e) => { console.error("fedos-beta renderer window error:", e.message, e.error?.stack); });
window.addEventListener("unhandledrejection", (e) => { console.error("fedos-beta renderer unhandled rejection:", e.reason); });
type ScreenName =
  | "loading"
  | "welcome"
  | "create"
  | "unlock"
  | "initializing"
  | "unlock-failed"
  | "recovery"
  | "ready";

type AppScreenName =
  | "conversations"
  | "chat"
  | "commerce"
  | "commerce-detail"
  | "commerce-order"
  | "commerce-merchant"
  | "search"
  | "archive"
  | "devices"
  | "safety"
  | "settings";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`fedos-beta renderer: missing element #${id}`);
  return el as T;
}

function showScreen(name: ScreenName): void {
  for (const section of Array.from(document.querySelectorAll("section"))) {
    section.classList.remove("active");
  }
  byId(`screen-${name}`).classList.add("active");
  // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 12
  // (arc §26): `textContent` is ALWAYS kept current (never gated) -- several
  // real E2E tests read it directly via `document.querySelector`. Only the
  // ROW's visibility (`#current-screen-row`'s own `hidden` attribute,
  // toggled once at startup below) is gated behind
  // `window.fedosBeta.debugInstrumentationEnabled`.
  byId("current-screen").textContent = name;
}

function clearField(id: string): void {
  byId<HTMLInputElement>(id).value = "";
}

/**
 * Direct Ratchet P1 arc -- display truncation only, never a new identity/
 * fingerprint primitive (none exists in this codebase to reuse -- no
 * npub/bech32 encoder is present in `src/`). Full value is always still
 * reachable (title attribute / a `<details>` disclosure at each real call
 * site), never lost -- only de-emphasized as the PRIMARY label on
 * high-stakes trust surfaces and conversation rows.
 */
function truncateIdentifier(value: string): string {
  return value.length <= 16 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

/**
 * Direct Ratchet P1 arc -- plain local UI behavior only: flips the
 * `type` of one or more password inputs between `"password"`/`"text"`.
 * No persistence, no logging, no clipboard automation; default is always
 * hidden (set by the static HTML `type="password"`).
 */
function togglePasswordVisibility(toggleButtonId: string, ...inputIds: string[]): void {
  const button = byId<HTMLButtonElement>(toggleButtonId);
  const nowVisible = button.getAttribute("aria-pressed") !== "true";
  for (const id of inputIds) byId<HTMLInputElement>(id).type = nowVisible ? "text" : "password";
  button.setAttribute("aria-pressed", String(nowVisible));
  button.textContent = nowVisible ? "Hide passphrase" : "Show passphrase";
}

function resetPasswordVisibility(toggleButtonId: string, ...inputIds: string[]): void {
  const button = byId<HTMLButtonElement>(toggleButtonId);
  for (const id of inputIds) byId<HTMLInputElement>(id).type = "password";
  button.setAttribute("aria-pressed", "false");
  button.textContent = "Show passphrase";
}

/**
 * Direct Ratchet P1 arc -- an unrecoverable-passphrase acknowledgement is
 * required before the profile can actually be created; reuses the exact
 * warning copy already on screen (`screen-create`'s own `.warn` paragraph)
 * rather than introducing new claims.
 */
function refreshCreateSubmitEnabled(): void {
  byId<HTMLButtonElement>("create-submit").disabled = !byId<HTMLInputElement>("create-pass-ack").checked;
}

function setBusy(busy: boolean, ...buttonIds: string[]): void {
  for (const id of buttonIds) {
    byId<HTMLButtonElement>(id).disabled = busy;
  }
}

// ---------------------------------------------------------------------
// Phase N — the ONE UI translation layer for every closed backend result
// code this renderer ever receives. Never a stack trace or raw exception
// string; every branch here is a safe, non-secret, user-facing sentence.
// ---------------------------------------------------------------------

const OUTCOME_TEXT: Readonly<Record<string, string>> = {
  unavailable: "This isn't available right now.",
  "seed-unavailable": "Secure crypto isn't available on this device.",
  locked: "Please unlock your profile first.",
  stopped: "The secure Runtime is stopped.",
  "invalid-input": "Please check your input and try again.",
  "not-configured": "This isn't configured yet — see Settings.",
  "relay-offline": "The Relay is unreachable right now.",
  retrying: "Retrying…",
  denied: "This action was denied.",
  conflict: "This conflicts with existing state.",
  duplicate: "This already exists.",
  "unsupported-version": "This uses an unsupported version.",
  unsupported: "This isn't supported on this build.",
  corrupted: "The stored data appears corrupted.",
  "restart-required": "Restart the application for this to take effect.",
  partial: "This only partially completed.",
  "not-found": "Not found.",
  busy: "Another action is already in progress.",
  cancelled: "Cancelled.",
  failed: "Something went wrong. Please try again.",
  "requires-activation": "This conversation is still finishing setup.",
  "requires-unlock": "Please unlock first.",
  "acceptance-only": "This isn't available right now.",
  malformed: "That pairing text looks corrupted or incomplete. Copy it again in full.",
  expired: "This pairing request has expired. Start over on the new Device.",
  replayed: "This pairing request was already used.",
  revoked: "This Device was previously revoked and cannot be re-trusted.",
  "wrong-account": "This approval is from a different account than expected.",
  disabled: "This Device cannot approve or revoke pairings — no account signing capability is configured here.",
  // Real, currently-reachable outcome for Device Pairing specifically:
  // `FedosDesktopApplicationShell` translates the facade's own
  // `"wrong-account"` into this Shell-layer name before it ever reaches
  // `window.fedosApp` (`DEVICE_PAIRING_OUTCOME_TO_SHELL_OUTCOME` in
  // `fedos_desktop_application_shell.ts`) -- found live by this Arc's own
  // real visible-control pairing test, which got the unhelpful generic
  // fallback text here before this entry existed.
  unauthorized: "This approval is from a different account than expected.",
  // Real Digital Delivery mega-arc (Agent U) -- Signed Deletion sender-side
  // failure codes (`FedosDeletionRequestOutboundCoordinator`'s own closed
  // outcome vocabulary, `resolveFedosDeletionRequestRecipient()`'s own
  // `"recipient-device-unknown"`).
  "recipient-device-unknown": "This contact hasn't confirmed a device yet — try again once they have.",
  "recipient-device-revoked": "This contact's device was revoked and can no longer receive this.",
  "local-device-revoked": "This device has been revoked and can't send this.",
  "not-author": "You can only request this for a message you sent.",
  "route-unavailable": "No delivery route is available right now.",
  "persistence-failed": "Couldn't save this locally. Try again.",
  "signing-unavailable": "Signing isn't available right now.",
  "runtime-stopped": "The secure Runtime is stopped.",
};

function describeOutcome(outcome: string): string {
  return OUTCOME_TEXT[outcome] ?? "Something went wrong. Please try again.";
}

function showError(elementId: string, result: { readonly outcome: string; readonly reason?: string }): void {
  byId(elementId).textContent = describeOutcome(result.outcome);
}

function clearError(elementId: string): void {
  byId(elementId).textContent = "";
}

// ---------------------------------------------------------------------
// Buyer Discovery + Digital Content Delivery mega-arc (post-report
// follow-up fix) -- the ONE confirmation primitive this renderer uses for
// destructive actions.
//
// ROOT CAUSE THIS REPLACES: `window.confirm()` in an Electron renderer is
// a SYNCHRONOUS blocking primitive. Chromium suspends the renderer's JS
// main thread for the entire time the native dialog is open, so nothing
// else in the page runs at all -- no timers, no IPC replies, no repaint,
// and (reproduced live on `2a21ef17`, three times, in production mode on
// a fresh profile) not even a bare `Runtime.evaluate("1+1")` over CDP,
// which never returned inside a 100s budget while the browser process
// itself answered normally. Clicking "Unpublish" therefore looked like a
// permanently frozen app to anything driving the UI programmatically, and
// the unpublish never committed. `armDevicePairingApproveConfirm()` below
// already documents this exact hazard for Device Pairing (Secure Runtime
// Alpha 8201-8280 removed `window.confirm()` there for the same reason);
// this helper generalises that fix so no call site can reintroduce it --
// `..._agent_s_structural_guards.test.ts` now fails if `window.confirm(`
// reappears anywhere in this file.
//
// The replacement is ordinary DOM: it resolves on a real click, so the
// caller simply `await`s it and the JS thread stays free throughout.
// ---------------------------------------------------------------------

let appConfirmPendingResolve: ((confirmed: boolean) => void) | undefined;

/**
 * Shows the shared in-page confirmation dialog and resolves `true` only if
 * the user really clicked its confirm button. Never blocks the JS thread.
 *
 * Re-entrancy: if a confirmation is somehow already open, this resolves
 * `false` immediately rather than stacking dialogs or orphaning the first
 * one's promise -- refusing is always the safe answer for a destructive
 * action.
 */
function confirmInPage(title: string, body: string, confirmLabel: string): Promise<boolean> {
  if (appConfirmPendingResolve !== undefined) return Promise.resolve(false);
  byId("app-confirm-title").textContent = title;
  byId("app-confirm-body").textContent = body;
  byId<HTMLButtonElement>("app-confirm-accept").textContent = confirmLabel;
  byId("app-confirm-overlay").hidden = false;
  byId<HTMLButtonElement>("app-confirm-accept").focus();
  return new Promise<boolean>((resolve) => {
    appConfirmPendingResolve = resolve;
  });
}

function settleAppConfirm(confirmed: boolean): void {
  const resolve = appConfirmPendingResolve;
  appConfirmPendingResolve = undefined;
  byId("app-confirm-overlay").hidden = true;
  if (resolve !== undefined) resolve(confirmed);
}

/**
 * Commerce E2E Completion arc — Commerce/Order/Payment handlers return a
 * specific, developer-authored `reason` string for their `"rejected"`/
 * `"invalid-input"`/`"not-found"`/`"forbidden"` outcomes (e.g. `"actor kind
 * \"customer\" is not authorized to perform \"confirm_payment\""`), unlike
 * `describeOutcome()`'s generic Phase N vocabulary above. Every such
 * `reason` is already documented at its source as a safe, non-secret,
 * developer-facing explanation (see `PaymentDecision.reason`'s own header:
 * "Never echoes secret/card/wallet content") — safe to render directly.
 * Falls back to `describeOutcome()` only when no `reason` was supplied.
 */
function showCommerceError(elementId: string, result: { readonly outcome: string; readonly reason?: string }): void {
  byId(elementId).textContent = result.reason !== undefined && result.reason.length > 0 ? result.reason : describeOutcome(result.outcome);
}

/**
 * Real Digital Delivery mega-arc (Agent U) -- `deletionRequestCreate()`'s
 * failure shape carries the FINE-GRAINED reason two different ways
 * depending on where it was rejected: `resolveFedosDeletionRequestRecipient()`'s
 * own early check returns it directly as `outcome` (e.g.
 * `"recipient-device-unknown"`), while a rejection from deeper in
 * `FedosDeletionRequestOutboundCoordinator` is coarsened to `outcome:
 * "unauthorized"|"unavailable"|"failed"|"invalid-input"` by the Shell's own
 * `mapDeletionRequestOutboundOutcomeKind()`, with the ORIGINAL fine-grained
 * code preserved verbatim in `reason` (see that mapper's own source). This
 * tries `reason` as a known code FIRST, then falls back to the coarse
 * `outcome` -- covering both shapes with the SAME `OUTCOME_TEXT` table,
 * never a second copy of the same strings.
 */
function describeDeletionRequestCreateFailure(result: { readonly outcome: string; readonly reason?: string }): string {
  if (result.reason !== undefined && Object.prototype.hasOwnProperty.call(OUTCOME_TEXT, result.reason)) return OUTCOME_TEXT[result.reason]!;
  return describeOutcome(result.outcome);
}

/**
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- item 7
 * (grant denied / content missing / content corrupted error-recovery copy).
 * `commerceMediaGrantRedeem()`'s closed-vocabulary denial `reason` (see
 * `handleCommerceMediaGrantRedeem()`/`evaluateMediaAccessGrant()` in
 * `fedos_electron_beta_main.cts`/`src/os/commerce/media_grant/media_access_grant_policy.ts`)
 * was previously shown to a buyer verbatim for every case except two —
 * technically accurate, but jargon (`"wrong-signer"`, `"media-id-mismatch"`,
 * `"superseded"`) a non-technical buyer cannot act on. Every branch here
 * maps to a real, user-actionable next step; the final fallback still never
 * fabricates a reason it wasn't given.
 */
const COMMERCE_PURCHASED_CONTENT_DENIAL_TEXT: Readonly<Record<string, string>> = {
  "no-grant-on-file": "No protected digital content is available for this order yet.",
  "order-not-qualifying": "No protected digital content is available for this order yet.",
  "content-unavailable": "The seller's stored content for this order appears to be missing or corrupted, and could not be retrieved. This is not something you can fix from here — contact the seller.",
  "wrap-unavailable": "Couldn't unlock this content right now (a required security key isn't available in this session). Try again after unlocking your profile fresh; if it keeps happening, this content may not be retrievable from this device.",
  "buyer-mismatch": "This content grant was issued to a different buyer identity than the one you're currently acting as. Switch \"Acting as\" to the identity that placed this order.",
  "order-id-mismatch": "This content grant doesn't match this order. Contact the seller — this looks like a data inconsistency on their side.",
  "media-id-mismatch": "This content grant doesn't match this product's content. Contact the seller — this looks like a data inconsistency on their side.",
  "product-id-mismatch": "This content grant doesn't match this product. Contact the seller — this looks like a data inconsistency on their side.",
  "order-not-found": "The order behind this content grant could not be found. Contact the seller.",
  "wrong-signer": "This content grant wasn't signed by this product's seller and was rejected. Contact the seller — this looks like a data inconsistency or tampering, not something you did wrong.",
  "not-yet-valid": "This content grant isn't active yet. Try again in a moment; if it persists, contact the seller.",
  expired: "This content grant has expired. Contact the seller to ask them to reissue access.",
  revoked: "The seller has revoked access to this content for this order. Contact the seller if you believe this is a mistake.",
  superseded: "This content grant was replaced by a newer one. Reopen this order and try again.",
  // Coordinator integration pass: these two entries are migrated in from
  // Agent A's `commerceMediaGrantRedeemFriendlyReason()`, which covered the
  // outcomes A's NEW cross-process release channel introduced and which
  // Agent U (on a branch that predated that channel) could not have known
  // about. A's function is removed in favour of this single table so there
  // is exactly one denial vocabulary, but neither agent's copy is lost.
  "requested-awaiting-seller-response":
    "Requested from the seller — this can take a moment. Click again shortly to check.",
  "content-corrupt":
    "The content received did not match what the seller signed for — treated as undelivered, not opened.",
};

/** Friendly text for a `commerceMediaGrantRedeem()` denial `reason` — see `COMMERCE_PURCHASED_CONTENT_DENIAL_TEXT`'s own header. Falls back to the raw reason (or `describeOutcome()`) for anything outside the closed vocabulary above, exactly like `showCommerceError()`'s own established fallback discipline — never invents a reason it wasn't given. */
function commercePurchasedContentDenialText(outcome: string, reason: string | undefined): string {
  if (reason !== undefined && reason in COMMERCE_PURCHASED_CONTENT_DENIAL_TEXT) {
    return COMMERCE_PURCHASED_CONTENT_DENIAL_TEXT[reason] as string;
  }
  // Coordinator integration pass: `outcome: "pending"` is Agent A's new
  // cross-process release-channel state (the seller has been asked and has
  // not answered yet) -- it is an OUTCOME, not a denial `reason`, so it must
  // be handled outside the table above. Without this, A's own
  // "click again shortly" affordance would degrade to a bare
  // `describeOutcome()` string and a buyer would have no idea the request is
  // still in flight. The table already covers the specific
  // `requested-awaiting-seller-response` reason; this is the guard for any
  // other pending reason the channel may report.
  if (outcome === "pending") {
    return "Requested from the seller — this can take a moment. Click again shortly to check.";
  }
  return reason !== undefined && reason.length > 0 ? reason : describeOutcome(outcome);
}

// ---------------------------------------------------------------------
// FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- honest
// cross-process sync-outcome copy + sync-state derivation for any bounded
// Commerce data view (My Orders, Incoming Orders). INLINED here, never
// imported -- this file's own header: "no `import` of any kind, reads
// ONLY window.fedosProfile/window.fedosBeta/window.fedosApp" (a real
// sandboxing constraint of the isolated renderer context, not a style
// choice). The TESTED spec these mirror lives in
// `src/os/commerce/order/cross_process_outcome_text.ts` /
// `src/os/commerce/order/sync_state.ts` (see those files' own headers) --
// same discipline this file's own pre-existing `OUTCOME_TEXT` already
// uses (a closed vocabulary re-declared here rather than importing
// `OrderRejectionCode`). Any behavior change to the algorithm belongs in
// BOTH places; the tested module is the source of truth to keep this
// inline copy honest against.
// ---------------------------------------------------------------------

/**
 * Closed vocabulary for `nostrSyncOutcome` (see `FedosCommerceOrderResult`/
 * `FedosCommerceProductMutationResult`'s own doc comments,
 * `fedos_electron_beta_window.d.ts`) -- a real cross-process sync failure
 * (the counterparty was never actually notified, or a listing never
 * actually reached the Relay) was silently dropped at the UI layer before
 * this arc (confirmed by grep: zero prior occurrences of `nostrSyncOutcome`
 * anywhere in this file). `sendPrivateOrderSyncNonFatal()`
 * (`fedos_electron_beta_main.cts`) can also return an ARBITRARY transport-
 * supplied message string on this same field -- `describeCommerceSyncOutcome()`
 * below NEVER echoes an unrecognized string back verbatim, exactly like
 * `describeOutcome()`'s own unknown-outcome fallback.
 */
const COMMERCE_SYNC_OUTCOME_TEXT: Readonly<Record<string, string>> = {
  published: "Synced to your configured Relay.",
  duplicate: "Already synced to your configured Relay.",
  rejected: "The Relay rejected this update. Your local copy is unaffected — you can try again later.",
  "transport-error": "Couldn't reach your configured Relay just now. Your local copy is unaffected — this will not retry automatically.",
  "network-disabled": "Network sync is off for this profile (see Settings → Network). Your local copy is unaffected.",
  // FedOS Commerce "Purchase Completion" mega-arc (Coordinator, integration
  // phase) -- two outcomes only the payment-evidence channel can produce.
  // `"evidence-not-transportable"` is the OUTBOUND authority gate refusing
  // to package non-authoritative evidence (a security refusal, NOT a
  // network failure -- describing it as one would be dishonest in exactly
  // the direction that matters).
  "evidence-not-transportable":
    "Not sent: this was not backed by authoritative settlement evidence, so it was refused before anything left this device. Your local copy is unaffected.",
  "no-counterparty": "Not sent: no counterparty identity is known for this order yet. Your local copy is unaffected.",
};

/**
 * FedOS Commerce "Purchase Completion" mega-arc (Coordinator, integration
 * phase) -- which real cross-process channel an outcome came from. Three
 * exist post-integration (order / Agent P's PaymentEvidence / Agent D's
 * Delivery), each an independent send with an independent result; the
 * prefix is what lets a user tell which one a note is about when several
 * are shown on the same order screen. `"order"` maps to the empty string
 * so the pre-integration channel's text is unchanged.
 */
type CommerceSyncChannel = "order" | "payment-evidence" | "delivery";

const COMMERCE_SYNC_CHANNEL_PREFIX: Readonly<Record<CommerceSyncChannel, string>> = {
  order: "",
  "payment-evidence": "Payment confirmation — ",
  delivery: "Delivery update — ",
};

/** `undefined` in (no sync attempt happened) -> `undefined` out, never a fabricated claim either way. Any other unrecognized string -> the safe generic fallback, never echoed verbatim. */
function describeCommerceSyncOutcome(outcome: string | undefined, channel: CommerceSyncChannel = "order"): string | undefined {
  if (outcome === undefined) return undefined;
  const base = COMMERCE_SYNC_OUTCOME_TEXT[outcome] ?? "Couldn't confirm this synced to your configured Relay. Your local copy is unaffected.";
  return `${COMMERCE_SYNC_CHANNEL_PREFIX[channel] ?? ""}${base}`;
}

/** Renders one channel's sync-outcome note into `elementId`, or clears it when `outcome` is `undefined` (no attempt happened -- never leaves a stale note from a prior action visible). */
function renderCommerceSyncOutcomeNote(elementId: string, outcome: string | undefined, channel: CommerceSyncChannel = "order"): void {
  byId(elementId).textContent = describeCommerceSyncOutcome(outcome, channel) ?? "";
}

/**
 * The five honest states a Commerce data view may report -- matches the
 * mega-arc brief's own required vocabulary verbatim ("Distinguish
 * connected / syncing / offline / sync failed / up to date — without
 * exposing implementation jargon"). See `sync_state.ts`'s own header for
 * the full honesty contract this mirrors.
 */
type CommerceSyncStatus = "offline" | "syncing" | "sync-failed" | "up-to-date" | "connected";

const COMMERCE_SYNC_STATUS_TEXT: Readonly<Record<CommerceSyncStatus, string>> = {
  offline: "You're offline. Showing the last known information.",
  syncing: "Checking for updates…",
  "sync-failed": "Couldn't check for updates just now. Showing the last known information — try Refresh.",
  "up-to-date": "Up to date.",
  connected: "Connected. Refresh to check for the latest.",
};

/** This app has no push/poll for Commerce data (Refresh is always explicit) -- a success may only claim freshness for this long afterward. Mirrors `sync_state.ts`'s own `FRESH_WINDOW_MS`. */
const COMMERCE_SYNC_FRESH_WINDOW_MS = 15_000;

/** Tiny per-list sync bookkeeping (one instance per Commerce data view) -- mirrors `CommerceSyncTracker` (`sync_state.ts`, tested there) exactly. */
class CommerceRendererSyncTracker {
  inFlight = false;
  lastAttemptAt: number | null = null;
  lastAttemptSucceeded: boolean | null = null;

  begin(): void {
    this.inFlight = true;
  }

  complete(succeeded: boolean, at: number): void {
    this.inFlight = false;
    this.lastAttemptAt = at;
    this.lastAttemptSucceeded = succeeded;
  }

  /**
   * `navigator.onLine` is a REAL browser signal (this renderer runs in an
   * ordinary, if sandboxed, Chromium context) -- never fabricated -- but it
   * only reflects the OS network-interface state, not actual Relay
   * reachability (mirrors `refreshRelayStatus()`'s own honesty about what
   * it can and cannot know). `now` is caller-supplied so this stays
   * consistent with `deriveCommerceSyncStatus()`'s own pure/testable
   * design even though this copy is not itself unit-tested (no DOM/jsdom
   * harness exists in this package -- see this arc's own structural-guard
   * tests for how this wiring is proven instead).
   */
  status(now: number): CommerceSyncStatus {
    if (!navigator.onLine) return "offline";
    if (this.inFlight) return "syncing";
    if (this.lastAttemptSucceeded === false) return "sync-failed";
    if (this.lastAttemptSucceeded === true && this.lastAttemptAt !== null) {
      const age = now - this.lastAttemptAt;
      if (age >= 0 && age <= COMMERCE_SYNC_FRESH_WINDOW_MS) return "up-to-date";
    }
    return "connected";
  }
}

const commerceMyOrdersSyncTracker = new CommerceRendererSyncTracker();
const commerceMerchantOrdersSyncTracker = new CommerceRendererSyncTracker();

function renderCommerceSyncStatus(elementId: string, tracker: CommerceRendererSyncTracker): void {
  byId(elementId).textContent = COMMERCE_SYNC_STATUS_TEXT[tracker.status(Date.now())];
}

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * arc mandate item 2: the Shop screen's own discovery-connection status.
 * Mirrors `os/commerce/catalog/discovery_state.ts` (tested there) exactly
 * -- reimplemented here, NOT imported, for the same reason
 * `CommerceRendererSyncTracker` above is a reimplementation rather than an
 * import: this file runs in an isolated renderer context with no `import`
 * of any kind (see this file's own top-of-file header).
 */
type CommerceDiscoveryStatus = "local-demo" | "offline" | "connecting" | "syncing" | "connected" | "sync-failed";

const COMMERCE_DISCOVERY_STATUS_TEXT: Readonly<Record<CommerceDiscoveryStatus, { readonly badge: string; readonly detail: string }>> = {
  "local-demo": {
    badge: "LOCAL DEMO",
    detail: "Network discovery is turned off for Shop. You're seeing only your own local listings and tutorial/demo items — not real sellers on the network.",
  },
  offline: {
    badge: "OFFLINE",
    detail: "You haven't connected to a network yet. Connect to discover real sellers' listings.",
  },
  connecting: { badge: "CONNECTING", detail: "Connecting to look for sellers…" },
  syncing: { badge: "SYNCING", detail: "Checking for new listings…" },
  connected: { badge: "CONNECTED", detail: "Connected. Showing listings synced from the network." },
  "sync-failed": {
    badge: "SYNC FAILED",
    detail: "Could not reach the network just now. Showing your own local listings only — try again.",
  },
};

class CommerceDiscoveryTracker {
  inFlight = false;
  hasEverAttempted = false;
  lastAttemptSucceeded: boolean | null = null;

  begin(): void {
    this.inFlight = true;
  }

  complete(succeeded: boolean): void {
    this.inFlight = false;
    this.hasEverAttempted = true;
    this.lastAttemptSucceeded = succeeded;
  }

  status(networkProfile: "local-only" | "direct" | "tor-optional", hasConfiguredRelay: boolean): CommerceDiscoveryStatus {
    if (networkProfile === "local-only") return "local-demo";
    if (!hasConfiguredRelay) return "offline";
    if (this.inFlight) return this.hasEverAttempted ? "syncing" : "connecting";
    if (this.lastAttemptSucceeded === false) return "sync-failed";
    return "connected";
  }
}

const commerceDiscoveryTracker = new CommerceDiscoveryTracker();
let commerceLastNetworkProfile: "local-only" | "direct" | "tor-optional" = "local-only";
let commerceLastHasConfiguredRelay = false;

function renderCommerceDiscoveryBanner(noListings: boolean): void {
  const status = commerceDiscoveryTracker.status(commerceLastNetworkProfile, commerceLastHasConfiguredRelay);
  const text = COMMERCE_DISCOVERY_STATUS_TEXT[status];
  byId("commerce-discovery-badge").textContent = text.badge;
  byId("commerce-discovery-detail").textContent = text.detail;
  byId("commerce-no-listings-note").toggleAttribute("hidden", !noListings);
  const connectBtn = byId<HTMLButtonElement>("commerce-discovery-connect-btn");
  if (status === "offline") {
    connectBtn.textContent = "Go to Relay Settings";
    connectBtn.removeAttribute("hidden");
  } else if (status === "local-demo") {
    connectBtn.textContent = "Enable network discovery";
    connectBtn.removeAttribute("hidden");
  } else {
    connectBtn.setAttribute("hidden", "");
  }
}

/** Click handler for `#commerce-discovery-connect-btn` -- its action depends on WHY discovery is currently unavailable (no Relay configured at all vs. deliberately turned off), recomputed fresh rather than parsed from the button's own label text. */
async function onCommerceDiscoveryConnectClick(): Promise<void> {
  const status = commerceDiscoveryTracker.status(commerceLastNetworkProfile, commerceLastHasConfiguredRelay);
  if (status === "offline") {
    showAppScreen("settings");
    return;
  }
  if (status === "local-demo") {
    const result = await window.fedosApp.commerceNetworkProfileSet("direct");
    if (result.outcome === "ok") {
      void refreshCommerceCatalogList();
    }
  }
}

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * arc mandate item 3, buyer side. Decodes+verifies the pasted/scanned
 * share code (main-process side, `handleCommerceShareOpen()` -- this
 * function never parses or trusts the text itself) and, ONLY on a genuine
 * `confirmed: true` result, opens the REAL Product Detail via the SAME
 * `openCommerceProduct()` path the ordinary catalog's own "View" button
 * uses -- never a screen built from this handler's own unconfirmed preview
 * copy.
 */
async function onCommerceShareOpenClick(): Promise<void> {
  const btn = byId<HTMLButtonElement>("commerce-share-open-btn");
  if (btn.disabled) return;
  const input = byId<HTMLTextAreaElement>("commerce-share-open-input");
  const statusEl = byId("commerce-share-open-status");
  clearError("commerce-share-open-error");
  statusEl.textContent = "";
  const text = input.value.trim();
  if (text.length === 0) {
    byId("commerce-share-open-error").textContent = "Paste a share code first.";
    return;
  }
  btn.disabled = true;
  try {
    const result = await window.fedosApp.commerceShareOpen(text);
    if (result.outcome === "invalid-input" || result.outcome === "invalid") {
      byId("commerce-share-open-error").textContent = result.reason ?? "That doesn't look like a valid share code.";
      return;
    }
    if (result.outcome === "rejected") {
      byId("commerce-share-open-error").textContent = result.reason ?? "This share code was rejected.";
      return;
    }
    if (result.confirmed === true && result.productId !== undefined) {
      statusEl.textContent = `Confirmed — opening ${result.preview?.title ?? "this product"}…`;
      input.value = "";
      await openCommerceProduct(result.productId);
      return;
    }
    // outcome "ok" but confirmed !== true -- a structurally valid,
    // self-consistent code that could not (yet) be independently
    // corroborated against a real network record. Shown as an honest
    // preview, NEVER treated as equivalent to a confirmed listing.
    statusEl.textContent = `Unconfirmed preview: "${result.preview?.title ?? "unknown product"}" — ${result.reason ?? "could not verify this against the network yet."}`;
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------
// Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 21
// (arc §22, §41-42): "SYSTEMATIC action-handler robustness" for every
// Commerce IPC call site, buyer and seller actions alike. Before this arc,
// ZERO Commerce call site had any error handling beyond checking
// `result.outcome` on a SUCCESSFULLY-resolved promise -- a genuinely thrown/
// rejected call (main process killed mid-call, a bug in a handler, etc.)
// produced an uncaught rejection with no user-facing feedback at all, and
// no button was ever disabled while a call was in flight (so a fast
// double-click could reach the SAME handler twice concurrently -- the exact
// shape of the "double-click mints a second paymentId" bug this arc also
// fixed at its root cause, see `payment/local_simulator.ts`'s own
// idempotency fix; this helper is defense-in-depth on top of that, not a
// replacement for it).
//
// Mirrors Chat/Search/Archive/Device/Settings' own already-correct
// established pattern (`setBusy()` + try/finally around each handler,
// confirmed by direct source inspection before writing this) rather than
// inventing a new one -- extended with one genuinely new element: a real
// `catch`, so an unexpected thrown error still produces a recoverable,
// human-readable message (never a stack trace) instead of silence.
// ---------------------------------------------------------------------

/**
 * Runs one Commerce IPC action with the shared robustness contract every
 * Commerce call site now uses:
 *   1. disables `busyButtonIds` for the call's duration -- ALSO the
 *      duplicate-invocation guard: a second click while disabled never
 *      re-enters `action()` (mirrors `setBusy()`'s existing role elsewhere
 *      in this file exactly; empty array is a valid no-op for a screen-load
 *      query with no single triggering button);
 *   2. clears `errorElementId` before calling, matching every other
 *      screen's own convention;
 *   3. on a genuine thrown/rejected error, shows a generic safe message
 *      (never a stack trace/raw exception string) and returns `undefined`
 *      so the caller can distinguish "never got a result" from "got a
 *      result whose own `outcome` says something failed";
 *   4. always re-enables `busyButtonIds` in a `finally`, success or not.
 * Callers still check `result.outcome`/`showCommerceError()` themselves
 * exactly as before for an ORDINARY `{outcome: "rejected"|...}` result --
 * this helper only adds the outer safety net + busy-state bracketing.
 *
 * `busyButtons` accepts a static `#id` string (looked up via `byId()`,
 * matching `setBusy()`'s own convention) OR a direct `HTMLButtonElement`
 * reference -- needed for the per-row Publish/Unpublish and "View"/"Open"
 * buttons this file builds dynamically in a loop and never assigns a
 * static id to.
 */
async function runCommerceAction<T>(
  busyButtons: readonly (string | HTMLButtonElement)[],
  errorElementId: string,
  action: () => Promise<T>,
): Promise<T | undefined> {
  const buttons = busyButtons.map((b) => (typeof b === "string" ? byId<HTMLButtonElement>(b) : b));
  clearError(errorElementId);
  for (const b of buttons) b.disabled = true;
  try {
    return await action();
  } catch (err) {
    console.error("fedos-beta: Commerce action failed unexpectedly:", err);
    byId(errorElementId).textContent = "Something went wrong. Please try again.";
    return undefined;
  } finally {
    for (const b of buttons) b.disabled = false;
  }
}

// ---------------------------------------------------------------------
// Beta status (Ready details) — unchanged from the pre-8041 renderer.
// ---------------------------------------------------------------------

async function renderBetaStatus(): Promise<void> {
  const status = await window.fedosBeta.status();

  const capabilitiesList = byId("capabilities-list");
  capabilitiesList.textContent = "";
  const capabilities = (status.capabilities as { capabilities?: readonly { capabilityId: string; status: string; userVisibleLabel: string }[] } | null)?.capabilities ?? [];
  for (const c of capabilities) {
    const li = document.createElement("li");
    const badge = document.createElement("span");
    badge.className = `status-badge status-${c.status}`;
    badge.textContent = c.status;
    li.appendChild(document.createTextNode(`${c.userVisibleLabel} `));
    li.appendChild(badge);
    capabilitiesList.appendChild(li);
  }

  const limitationsList = byId("limitations-list");
  limitationsList.textContent = "";
  const limitations = (status.limitations as { limitations?: readonly { statement: string; surfaces: readonly string[] }[] } | null)?.limitations ?? [];
  for (const l of limitations) {
    if (!l.surfaces.includes("beta-status")) continue;
    const li = document.createElement("li");
    li.textContent = l.statement;
    limitationsList.appendChild(li);
  }

  const release = status.release as { productName?: string; version?: string; stability?: string } | null;
  byId("release-info").textContent = release !== null
    ? `${release.productName ?? "FedOS Desktop"} ${release.version ?? ""} (${release.stability ?? "beta"})`
    : "";
}

// ---------------------------------------------------------------------
// Secure Runtime Alpha 8041-8120 — module-level, in-memory-only session
// state. Never persisted, never logged; lost on lock/relaunch like every
// other presentation-layer draft state in this codebase.
// ---------------------------------------------------------------------

let localAccountPublicIdentifier = "";
/** Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) -- mirrors `localAccountPublicIdentifier`'s own set/clear points exactly; used only to label the REAL local-identity "Acting as" option (see the Commerce section below), never anything security-relevant. */
let localDisplayLabel = "";
let currentConversationId: string | null = null;
let conversationsCache: readonly { readonly conversationId: string; readonly [key: string]: unknown }[] = [];
let currentIdentityTransitionSelection: { readonly peerAccountRef: unknown; readonly peerDeviceRef: string; readonly transitionId: string } | null = null;
let currentDeletionRequestId: string | null = null;
/**
 * FedOS Peer Device Discovery Arc -- Peer-Device UX entry point closure
 * (`10_P0_CLOSURE_COORDINATOR_FREEZE.md` §4). A real, honest, never-
 * wall-clock, strictly-incrementing counter for this call site's own
 * `epoch` argument -- session-scoped (resets on relaunch like every other
 * state in this block), mirroring the SAME "local monotonic, never wall-
 * clock" contract as the durable identity file's own `nextEpoch`
 * (`fedos_local_peer_device_announcement_identity.ts`). The ACTUAL epoch
 * a real announcement is signed and sent with is always sourced
 * authoritatively from that durable file inside the Runtime
 * (`FedosPeerDeviceAnnouncementRuntime.announceLocalDevice()`), which
 * stays correct across restarts regardless of this renderer-local value --
 * this counter only needs to be real and non-wall-clock at THIS call site,
 * never the sole source of truth.
 */
let peerDeviceAnnouncementLocalEpochCounter = 0;
/**
 * Direct Ratchet P1 arc -- re-announcement throttling. Session-scoped (in-
 * memory only, mirrors this whole block's own discipline): tracks which
 * counterparty accounts this local Device has already successfully
 * announced to SINCE THIS PROCESS STARTED, so `openConversation()` does not
 * re-send a Device announcement on every repeated open of the same
 * conversation -- "first availability" (this process's first open of a
 * given counterparty) still always announces; a later open of the SAME
 * counterparty in the SAME process is a no-op unless the user explicitly
 * asks for a refresh (`chat-refresh-device-announcement`). Deliberately NOT
 * durable/persisted -- see this arc's own design note: a durable "never
 * announce again" flag would leave a peer whose own Registry got reset
 * unreachable without an explicit refresh action, which is exactly why an
 * explicit refresh affordance ships alongside this throttle rather than
 * being deferred. Never wall-clock; keyed on the account identity fields
 * actually used for equality elsewhere in this codebase.
 */
const peerDeviceAnnouncementSentThisSession = new Set<string>();
let currentChatCounterpartyAccountRef: ChatCounterpartyAccountRef | null = null;

function peerDeviceAnnouncementSessionKey(accountRef: ChatCounterpartyAccountRef): string {
  return JSON.stringify([accountRef.authority, accountRef.publicIdentifier, accountRef.identityId]);
}

/**
 * The one real send path for a local Device announcement. `force` bypasses
 * the per-session throttle (the explicit refresh condition mandate section
 * 15 requires alongside any throttle); a normal `openConversation()` call
 * never sets it. Only marks the throttle key as satisfied once the send
 * itself did not throw -- a failed attempt is never treated as "already
 * announced" and remains eligible to retry on the next open.
 */
async function announcePeerDeviceIfNeeded(counterpartyAccountRef: ChatCounterpartyAccountRef, conversationId: string, force: boolean): Promise<boolean> {
  const key = peerDeviceAnnouncementSessionKey(counterpartyAccountRef);
  if (!force && peerDeviceAnnouncementSentThisSession.has(key)) return false;
  const epoch = peerDeviceAnnouncementLocalEpochCounter;
  peerDeviceAnnouncementLocalEpochCounter += 1;
  try {
    await window.fedosApp.peerDeviceAnnounce(counterpartyAccountRef, conversationId, epoch);
    peerDeviceAnnouncementSentThisSession.add(key);
    return true;
  } catch {
    /* best-effort -- never blocks the chat screen; a genuine failure to send is safely retried on the next eligible attempt */
    return false;
  }
}

/**
 * Real Digital Delivery mega-arc (Agent U) -- Signed Deletion SENDER-side
 * per-message presentation state, session-only (never persisted, mirrors
 * `revealedMessagePlaintext`'s own "in-memory-only, lost on lock/relaunch"
 * discipline above). Keyed by `messageId`. A message with no entry has
 * never had a deletion requested from this renderer session -- the
 * "Request deletion" button is offered. `"requested"` NEVER by itself means
 * remote deletion occurred; `statusText`, when present, is this renderer's
 * own last fetched, honest per-Device aggregate (see
 * `describeDeletionRequestSentStatus()` below) -- absent means "not yet
 * checked", never "declined"/"applied".
 */
type FedosDeletionRequestUiState =
  | { readonly kind: "requesting" }
  | { readonly kind: "requested"; readonly statusText: string | null; readonly checkingStatus: boolean }
  | { readonly kind: "failed"; readonly result: { readonly outcome: string; readonly reason?: string } };
const deletionRequestUiState = new Map<string, FedosDeletionRequestUiState>();
let archiveExportDestinationPath: string | null = null;
let archiveRestoreSourcePath: string | null = null;
/**
 * A message arriving over the real relay in the background (the SAME
 * inbound subscription/Outbox Scheduler this codebase already runs) is
 * durably imported by the Runtime on its own -- but nothing pushes an event
 * to this renderer when that happens (no such channel exists, and adding
 * one would be a new IPC/event surface beyond this Arc's own scope). A
 * short, bounded poll while the chat screen is genuinely open is the
 * pragmatic, safe, additive presentation-layer fix: it calls the SAME
 * already-real `messagesList` command a manual re-open already calls,
 * never a new capability. Cleared whenever the user leaves the chat screen
 * (Phase G "no hidden background polling" -- Safety Center's own docs
 * discuss Relay polling for delivery, not the renderer; this interval is
 * scoped to ONE open chat screen, stopped the instant it is left).
 */
let chatPollIntervalId: ReturnType<typeof setInterval> | null = null;
function stopChatPolling(): void {
  if (chatPollIntervalId !== null) {
    clearInterval(chatPollIntervalId);
    chatPollIntervalId = null;
  }
}
function startChatPolling(): void {
  stopChatPolling();
  chatPollIntervalId = setInterval(() => {
    if (currentConversationId !== null) void loadChatMessages();
  }, 2000);
}

function showAppScreen(name: AppScreenName): void {
  if (name !== "chat") stopChatPolling();
  for (const el of Array.from(document.querySelectorAll(".app-screen"))) {
    el.classList.remove("active");
  }
  byId(`app-screen-${name}`).classList.add("active");
  for (const btn of Array.from(document.querySelectorAll("#app-nav button[id^='nav-']"))) {
    btn.removeAttribute("aria-current");
  }
  const navMap: Partial<Record<AppScreenName, string>> = {
    conversations: "nav-conversations",
    chat: "nav-conversations",
    commerce: "nav-commerce",
    "commerce-detail": "nav-commerce",
    "commerce-order": "nav-commerce",
    "commerce-merchant": "nav-commerce-merchant",
    search: "nav-search",
    archive: "nav-archive",
    devices: "nav-devices",
    safety: "nav-safety",
    settings: "nav-settings",
  };
  const navId = navMap[name];
  if (navId !== undefined) byId(navId).setAttribute("aria-current", "page");
}

function setAppStatus(text: string): void {
  byId("app-status-area").textContent = text;
}

/**
 * Secure Runtime Alpha 8121-8200 -- real, disclosed gap this Arc's own
 * extended vertical slice found live: `#app-status-area` existed in the
 * nav bar but was never populated with real Relay connectivity, so "one
 * unreachable Relay does not invalidate the whole profile" had no visible
 * confirmation anywhere. Polls the SAME real `relayStatus()` command a
 * manual check would call; a bounded interval (not a hidden background
 * timer beyond this ONE nav-bar area), started once at Ready and never
 * stopped by screen navigation (unlike the chat-only message poll) since
 * the nav bar itself is always visible once unlocked.
 */
async function refreshRelayStatus(): Promise<void> {
  const result = await window.fedosApp.relayStatus();
  if (result.outcome !== "ok") {
    setAppStatus("");
    return;
  }
  const relays = (result.value as readonly { readonly url: string; readonly connected: boolean }[]) ?? [];
  if (relays.length === 0) {
    setAppStatus("No Relay configured");
    return;
  }
  const connectedCount = relays.filter((r) => r.connected).length;
  // Honest copy only: this Runtime's own `WebSocketRelay` (Alpha 214/215,
  // `src/desktop/websocket_relay.ts`) has "NO automatic reconnect, retry,
  // storage, or global event bus of its own" -- a deliberate, repeatedly-
  // documented contract, not an oversight (see also `fedos_conversation_relay_set.ts`:
  // "no reconnect/backoff policy of any kind"). A disconnected Relay stays
  // disconnected until the user locks and unlocks again (each unlock builds
  // a fresh `WebSocketRelay` and reconnects it) -- there is no passive
  // background retry to describe, so this text must never claim one.
  setAppStatus(connectedCount === relays.length ? `${connectedCount}/${relays.length} Relay connected` : `${connectedCount}/${relays.length} Relay connected — lock and unlock again to retry`);
}

let relayStatusIntervalId: ReturnType<typeof setInterval> | null = null;
function startRelayStatusPolling(): void {
  if (relayStatusIntervalId !== null) return;
  void refreshRelayStatus();
  relayStatusIntervalId = setInterval(() => void refreshRelayStatus(), 3000);
}

// ---------------------------------------------------------------------
// Phase E — Conversations list + chat.
// ---------------------------------------------------------------------

function renderConversationsList(filterText: string): void {
  const list = byId("conversations-list");
  list.textContent = "";
  const needle = filterText.trim().toLowerCase();
  const rows = conversationsCache.filter((c) => needle.length === 0 || c.conversationId.toLowerCase().includes(needle));
  if (rows.length === 0) {
    const li = document.createElement("li");
    li.textContent = conversationsCache.length === 0 ? "No conversations yet — invite a contact below." : "No conversations match this filter.";
    list.appendChild(li);
    return;
  }
  for (const c of rows) {
    const li = document.createElement("li");
    const mode = String(c.mode ?? "direct");
    const lifecycle = String(c.lifecycleState ?? "");
    const activation = String(c.activationStatus ?? "");
    const title = document.createElement("div");
    title.appendChild(document.createTextNode(`${mode} conversation `));
    const badge = document.createElement("span");
    badge.className = `status-badge status-${activation === "ready" ? "available" : "available-development-only"}`;
    badge.textContent = `${activation === "ready" ? "✓ " : "⚠ "}${activation}`;
    title.appendChild(badge);
    li.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "muted field";
    // Direct Ratchet P1 arc -- the conversations LIST view has no
    // per-row counterparty identity available (unlike the chat header,
    // which already resolves `counterpartyAccountRef` via
    // `conversationOpen()`'s own membership data) without a new list-API
    // round trip per row, which this P1 cleanup does not add. Truncating
    // the raw id itself is the honest minimal fix here; the full id is
    // still reachable via the `title` attribute and inside the chat
    // header's own technical-details disclosure once opened.
    meta.textContent = `${truncateIdentifier(c.conversationId)} – ${lifecycle}`;
    meta.title = c.conversationId;
    li.appendChild(meta);
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Open";
    openBtn.setAttribute("aria-label", `Open conversation ${c.conversationId}`);
    openBtn.addEventListener("click", () => void openConversation(c.conversationId));
    li.appendChild(openBtn);
    list.appendChild(li);
  }
}

async function refreshConversationsList(): Promise<void> {
  clearError("conversations-error");
  const result = await window.fedosApp.conversationsList();
  if (result.outcome !== "ok") {
    showError("conversations-error", result);
    conversationsCache = [];
    renderConversationsList(byId<HTMLInputElement>("conversations-filter").value);
    return;
  }
  conversationsCache = (result.value as readonly { readonly conversationId: string; readonly [key: string]: unknown }[]) ?? [];
  renderConversationsList(byId<HTMLInputElement>("conversations-filter").value);
}

/**
 * Direct Ratchet P1 arc -- a nostr pubkey (hex form) is exactly 32 bytes,
 * 64 lowercase hex characters. No npub/bech32 decoder exists anywhere in
 * this codebase (`src/`) to reuse, so npub input is genuinely deferred
 * (would require adding a new decoding primitive, out of scope for this
 * minimal fix) -- see mandate's own "no new fingerprint algorithm"
 * constraint. This only tightens validation of the SAME raw-hex input
 * already accepted; it adds no new trust semantic.
 */
const NOSTR_HEX_PUBKEY_PATTERN = /^[0-9a-f]{64}$/;

async function onInviteSubmit(): Promise<void> {
  const identifier = byId<HTMLInputElement>("invite-identifier").value.trim().toLowerCase();
  clearError("invite-error");
  if (identifier.length === 0) {
    byId("invite-error").textContent = "Enter the contact's public identifier.";
    return;
  }
  if (!NOSTR_HEX_PUBKEY_PATTERN.test(identifier)) {
    byId("invite-error").textContent = "That doesn't look like a valid public identifier -- it should be 64 hex characters (0-9, a-f).";
    return;
  }
  setBusy(true, "invite-submit");
  try {
    const result = await window.fedosApp.createInvitation({ authority: "nostr", publicIdentifier: identifier });
    if (result.outcome !== "ok") {
      showError("invite-error", result);
      return;
    }
    clearField("invite-identifier");
    await refreshConversationsList();
  } finally {
    setBusy(false, "invite-submit");
  }
}

/**
 * `listMessages()`/`messagesList()` NEVER decrypts (Alpha 1139's own
 * unchanged rule) -- every fresh list load (including this Arc's own
 * background chat poll) reports every message as `plaintext.state ===
 * "unavailable"` again, regardless of an earlier `readMessage()`/reveal.
 * This client-side, in-memory-only cache (never persisted, cleared on
 * conversation switch) is what lets an already-revealed message STAY
 * revealed across a poll tick, without bulk-decrypting anything itself --
 * it only re-displays plaintext this SAME renderer already legitimately
 * received via one explicit `revealMessage()` click.
 */
const revealedMessagePlaintext = new Map<string, string>();

type FedosChatMessageView = { readonly messageId: string; readonly senderMembershipId: string; readonly createdAt: number; readonly plaintext: { readonly state: string; readonly text?: string; readonly reason?: string }; readonly localDeliveryState: string; readonly retentionState: string };

/** Last-rendered chat data, so `redrawChatMessages()` (Signed Deletion state changes) can re-draw without a fresh, non-decrypting `messagesList()` round trip -- mirrors `revealedMessagePlaintext`'s own "session-only cache, redraw from what we already have" discipline. */
let lastChatMessages: readonly FedosChatMessageView[] = [];
let lastChatLocalMembershipIds: ReadonlySet<string> = new Set();

function renderChatMessages(messages: readonly FedosChatMessageView[], localMembershipIds: ReadonlySet<string>): void {
  lastChatMessages = messages;
  lastChatLocalMembershipIds = localMembershipIds;
  const list = byId("chat-messages");
  list.textContent = "";
  for (const m of messages) {
    if (m.plaintext.state === "available") revealedMessagePlaintext.set(m.messageId, m.plaintext.text ?? "");
  }
  if (messages.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No messages yet.";
    list.appendChild(li);
    return;
  }
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  for (const m of sorted) {
    const li = document.createElement("li");
    const mine = localMembershipIds.has(m.senderMembershipId);
    li.className = `chat-msg ${mine ? "mine" : "theirs"}`;
    const cachedText = revealedMessagePlaintext.get(m.messageId);
    const deleted = m.retentionState === "tombstoned" || m.retentionState === "payload-removed";
    if (deleted) {
      li.textContent = "[This message was deleted.]";
    } else if (m.plaintext.state === "available") {
      li.textContent = m.plaintext.text ?? "";
    } else if (cachedText !== undefined) {
      li.textContent = cachedText;
    } else {
      const revealBtn = document.createElement("button");
      revealBtn.type = "button";
      revealBtn.textContent = "Show message";
      revealBtn.addEventListener("click", () => void revealMessage(m.messageId));
      li.appendChild(revealBtn);
    }
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${new Date(m.createdAt * 1000 > Date.now() * 2 ? m.createdAt : m.createdAt * 1000).toLocaleString()} · ${m.localDeliveryState}`;
    li.appendChild(meta);
    // Real Digital Delivery mega-arc (Agent U) -- Signed Deletion is a
    // sender action only (`FedosDeletionRequestOutboundCoordinator`'s own
    // "verify requester is original author" pre-publish self-check, Phase
    // C step 3) -- offered only on this local sender's OWN messages, and
    // never on one already locally shown as deleted.
    if (mine && !deleted) li.appendChild(buildDeletionRequestControl(m.messageId));
    list.appendChild(li);
  }
}

/** Re-renders the chat list from the LAST real data this renderer fetched, without a fresh network/IPC round trip -- used after a purely local Signed Deletion UI state change (requesting/requested/failed). */
function redrawChatMessages(): void {
  renderChatMessages(lastChatMessages, lastChatLocalMembershipIds);
}

/**
 * Real Digital Delivery mega-arc (Agent U) -- per-Device sent-status codes
 * (`FedosDeletionRequestDeviceStatus`, `fedos_deletion_request_device_status.ts`)
 * translated to plain, honest sentences. Every branch stays within what
 * that pure function's own header guarantees it can produce -- never
 * "deleted everywhere"/"account-deleted"/"erased".
 */
const DELETION_REQUEST_SENT_STATUS_TEXT: Readonly<Record<string, string>> = {
  "not-requested": "Not yet requested.",
  draft: "Preparing the request…",
  "pending-delivery": "Requested — waiting for delivery.",
  "relay-acknowledged": "Requested — delivered, waiting for a response.",
  "recipient-received": "Requested — the recipient's device received it.",
  "awaiting-recipient-decision": "Requested — the recipient is reviewing it.",
  approved: "The recipient approved this request.",
  rejected: "The recipient declined this request.",
  "applied-local-history": "The recipient's device reports it applied the request to its local history.",
  "applied-local-history-and-index": "The recipient's device reports it applied the request (history and index).",
  "partially-applied": "The recipient's device reports it partially applied the request.",
  expired: "This request expired before the recipient responded.",
  failed: "This request failed.",
  "revoked-device": "The recipient's device was revoked — this can't be confirmed.",
  "unknown-device": "No known device is on file for the recipient yet.",
  "offline-or-unobserved": "The recipient's device hasn't been observed yet.",
  unverifiable: "A response arrived but its outcome couldn't be verified.",
};

function describeDeletionRequestSentStatus(result: { readonly outcome: string; readonly value?: unknown }): string {
  if (result.outcome !== "ok") return describeOutcome(result.outcome);
  const view = result.value as { readonly perDevice?: readonly { readonly status: string }[] } | undefined;
  const status = view?.perDevice?.[0]?.status;
  if (status === undefined) return "No response yet.";
  return DELETION_REQUEST_SENT_STATUS_TEXT[status] ?? "No response yet.";
}

function buildDeletionRequestControl(messageId: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "deletion-request-control";
  const state = deletionRequestUiState.get(messageId);
  if (state?.kind === "requested") {
    const note = document.createElement("span");
    note.className = "muted";
    note.textContent = state.statusText ?? "Deletion requested";
    wrap.appendChild(note);
    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.textContent = state.checkingStatus ? "Checking…" : "Check status";
    checkBtn.disabled = state.checkingStatus;
    checkBtn.addEventListener("click", () => void onCheckDeletionRequestStatus(messageId, checkBtn));
    wrap.appendChild(checkBtn);
    return wrap;
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = state?.kind === "requesting" ? "Requesting…" : "Request deletion";
  btn.disabled = state?.kind === "requesting";
  btn.addEventListener("click", () => void onRequestDeletion(messageId, btn));
  wrap.appendChild(btn);
  if (state?.kind === "failed") {
    const err = document.createElement("span");
    err.className = "warn";
    err.textContent = describeDeletionRequestCreateFailure(state.result);
    wrap.appendChild(err);
  }
  return wrap;
}

/**
 * Real Digital Delivery mega-arc (Agent U) -- Signed Deletion, sender side.
 * NEVER worded "Delete for everyone"/"Erase remotely": this sends a signed
 * REQUEST -- the recipient may decline it, and it cannot reach copies
 * outside FedOS. Idempotency (double-click must not create two requests):
 * (1) `btn.disabled` is set synchronously before the (awaited) confirmation
 * even opens, mirroring `decideDeletionRequest()`'s/`onDeviceRevoke()`'s
 * own established pattern one screen over; (2) the REAL, authoritative
 * guard is `fedos-app:deletion-request-create`'s own per-channel IPC
 * in-flight guard (`FedosIpcCommandRegistry`, default guard, no
 * `allowConcurrentSelf`) -- a second concurrent call while the first is
 * still in flight gets `{outcome:"busy"}` back, never a second real
 * request, exactly like every other mutating `fedos-app:*` command.
 */
async function onRequestDeletion(messageId: string, btn: HTMLButtonElement): Promise<void> {
  if (btn.disabled || currentConversationId === null) return;
  btn.disabled = true;
  try {
    const confirmed = await confirmInPage(
      "Request deletion?",
      "This sends a signed request asking the other person to remove their own local copy of this message. They may decline it. It can't remove copies outside FedOS (screenshots, backups, exports), copies on their other Devices, or the encrypted copy already on a Relay.",
      "Yes, request deletion",
    );
    if (!confirmed) return;
    deletionRequestUiState.set(messageId, { kind: "requesting" });
    redrawChatMessages();
    const result = await window.fedosApp.deletionRequestCreate(currentConversationId, messageId, "local-history-and-index", null, null);
    deletionRequestUiState.set(messageId, result.outcome === "ok" ? { kind: "requested", statusText: null, checkingStatus: false } : { kind: "failed", result });
    redrawChatMessages();
  } finally {
    btn.disabled = false;
  }
}

async function onCheckDeletionRequestStatus(messageId: string, btn: HTMLButtonElement): Promise<void> {
  if (btn.disabled || currentConversationId === null) return;
  const current = deletionRequestUiState.get(messageId);
  if (current?.kind !== "requested") return;
  deletionRequestUiState.set(messageId, { ...current, checkingStatus: true });
  redrawChatMessages();
  const result = await window.fedosApp.deletionRequestSentStatus(currentConversationId, messageId);
  const latest = deletionRequestUiState.get(messageId);
  if (latest?.kind === "requested") {
    deletionRequestUiState.set(messageId, { kind: "requested", statusText: describeDeletionRequestSentStatus(result), checkingStatus: false });
  }
  redrawChatMessages();
}

async function loadChatMessages(): Promise<void> {
  if (currentConversationId === null) return;
  clearError("chat-error");
  const membershipResult = await window.fedosApp.membershipList(currentConversationId);
  const localIds = new Set<string>();
  if (membershipResult.outcome === "ok") {
    const view = membershipResult.value as { readonly memberships: readonly { readonly id: string; readonly participant: { readonly publicIdentifier: string } }[] };
    for (const m of view.memberships) {
      if (m.participant.publicIdentifier === localAccountPublicIdentifier) localIds.add(m.id);
    }
  }
  const result = await window.fedosApp.messagesList(currentConversationId);
  if (result.outcome !== "ok") {
    showError("chat-error", result);
    renderChatMessages([], localIds);
    return;
  }
  renderChatMessages((result.value as readonly never[]) ?? [], localIds);
}

async function revealMessage(messageId: string): Promise<void> {
  if (currentConversationId === null) return;
  const result = await window.fedosApp.messageReveal(messageId);
  if (result.outcome !== "ok") {
    showError("chat-error", result);
    return;
  }
  // `messageReveal()` already returns the FULL message list with THIS one
  // message's plaintext merged in (`FedosDesktopMessageListViewModel.reveal()`,
  // unmodified) -- rendering it directly here, rather than re-calling
  // `loadChatMessages()` (a fresh, non-decrypting `messagesList()` load),
  // is required: a fresh list call would otherwise immediately discard the
  // very reveal this function just performed.
  const membershipResult = await window.fedosApp.membershipList(currentConversationId);
  const localIds = new Set<string>();
  if (membershipResult.outcome === "ok") {
    const view = membershipResult.value as { readonly memberships: readonly { readonly id: string; readonly participant: { readonly publicIdentifier: string } }[] };
    for (const m of view.memberships) {
      if (m.participant.publicIdentifier === localAccountPublicIdentifier) localIds.add(m.id);
    }
  }
  renderChatMessages((result.value as readonly never[]) ?? [], localIds);
}

interface ChatCounterpartyAccountRef {
  readonly authority: string;
  readonly publicIdentifier: string;
  readonly identityId: string | null;
}

async function openConversation(conversationId: string): Promise<void> {
  if (currentConversationId !== conversationId) revealedMessagePlaintext.clear();
  currentConversationId = conversationId;
  showAppScreen("chat");
  clearError("chat-error");
  byId("chat-title").textContent = "Conversation";
  byId("chat-meta").textContent = "Loading…";
  // Direct Ratchet P1 arc -- the raw conversationId is no longer the
  // PRIMARY label (see the friendly-label assignment below); it still
  // always populates the collapsed technical-details disclosure, moved
  // out of the way rather than deleted (mirrors Commerce's own
  // `#commerce-order-technical-details` precedent).
  byId("chat-conversation-id").textContent = `Conversation ID: ${conversationId}`;
  const detail = await window.fedosApp.conversationOpen(conversationId);
  let counterpartyAccountRef: ChatCounterpartyAccountRef | null = null;
  if (detail.outcome === "ok") {
    const view = detail.value as {
      readonly mode: string;
      readonly lifecycleState: string;
      readonly activationStatus: string;
      readonly memberships?: readonly { readonly participant: ChatCounterpartyAccountRef; readonly state: string }[];
    };
    byId("chat-title").textContent = `${view.mode} conversation`;
    // FedOS Peer Device Discovery Arc (fix for a P0 the Messenger/Security
    // release-readiness reassessment found this arc: the Security Details
    // panel's own Encryption/Forward-secrecy/Device-knowledge axes were
    // structurally dead in the shipped UI because this call site always
    // passed `null` for counterpartyAccountRef, despite `conversationOpen()`
    // already returning exactly the membership data needed -- it was just
    // discarded. Resolve the ONE non-local, currently-active member (a
    // Direct conversation has exactly one) -- never a guess, never the
    // local account itself.
    const counterpartyMembership = view.memberships?.find((m) => m.state === "active" && m.participant.publicIdentifier !== localAccountPublicIdentifier);
    counterpartyAccountRef = counterpartyMembership?.participant ?? null;
    // Direct Ratchet P1 arc -- friendly identity label PRIMARY, raw hex
    // moved to the technical-details disclosure above, matching Commerce's
    // own already-established "friendly label primary, raw id secondary"
    // pattern (`fedos_electron_beta_page.html`'s own `#commerce-order-parties`
    // comment). No new fingerprint/identity primitive -- this is display
    // truncation only, over the SAME `publicIdentifier` already used for
    // every real trust decision.
    const counterpartyLabel = counterpartyAccountRef === null ? "Unknown contact" : truncateIdentifier(counterpartyAccountRef.publicIdentifier);
    byId("chat-meta").textContent = `${counterpartyLabel} – ${view.lifecycleState} – ${view.activationStatus}`;
  } else {
    byId("chat-meta").textContent = "Conversation unavailable";
  }
  // A freshly-started Runtime must re-activate a Direct conversation before
  // it can send/receive -- a real, per-Runtime-lifetime precondition, not a
  // fabricated step. Already-active is a safe no-op; a genuine failure here
  // still lets the user see messages, only sending will then fail closed.
  await window.fedosApp.conversationActivate(conversationId);
  await loadChatMessages();
  await refreshChatSecurityState(conversationId, counterpartyAccountRef);
  currentChatCounterpartyAccountRef = counterpartyAccountRef;
  // FedOS Peer Device Discovery Arc -- Peer-Device UX entry point closure
  // (10_P0_CLOSURE_COORDINATOR_FREEZE.md §4). Direct Ratchet P1 arc --
  // throttled: a repeated open of the SAME conversation in the SAME
  // process is now a no-op (`announcePeerDeviceIfNeeded()`'s own session
  // throttle); "first availability" (this process's first open of this
  // counterparty) still always announces, and an explicit refresh action
  // (`chat-refresh-device-announcement`) always bypasses the throttle. A
  // stale/duplicate re-announce is separately already handled safely by
  // the receiving side's own acceptance policy (rejected as stale) even
  // when it does fire, so a best-effort failure here is bounded and safe;
  // it must never block the chat screen from opening.
  if (counterpartyAccountRef !== null) {
    await announcePeerDeviceIfNeeded(counterpartyAccountRef, conversationId, false);
  }
  startChatPolling();
}

async function onRefreshDeviceAnnouncementClick(): Promise<void> {
  const feedback = byId("chat-refresh-device-announcement-feedback");
  if (currentConversationId === null || currentChatCounterpartyAccountRef === null) {
    feedback.textContent = "No counterparty device known yet for this conversation.";
    return;
  }
  feedback.textContent = "Refreshing...";
  const sent = await announcePeerDeviceIfNeeded(currentChatCounterpartyAccountRef, currentConversationId, true);
  feedback.textContent = sent ? "Device announcement re-sent." : "Could not send right now -- it will be retried automatically.";
}

// ---------------------------------------------------------------------------
// Verified Secure Session UI mega-arc (Coordinator) -- compact conversation
// security indicator + expandable Security Details panel. NO single
// collapsed "Secure"/"Verified" claim anywhere here -- each axis renders its
// own honest, independent status text, mirroring the Safety Center's own
// "each section keeps its OWN independent state" convention.
// ---------------------------------------------------------------------------

const CHAT_SECURITY_AXIS_LABELS: Record<string, string> = {
  identityContinuity: "Identity",
  encryption: "Encryption",
  forwardSecrecy: "Forward secrecy",
  deviceKnowledge: "Device knowledge",
  evidenceIntegrity: "Recent security events",
  metadataExposure: "Metadata",
};

/** state -> {glyph, word} -- glyph always paired with text, never color alone. */
const CHAT_SECURITY_STATE_GLYPH: Record<string, { readonly glyph: string; readonly word: string }> = {
  good: { glyph: "✓", word: "OK" },
  attention: { glyph: "⚠", word: "Attention" },
  unknown: { glyph: "?", word: "Unknown" },
  unavailable: { glyph: "–", word: "Unavailable" },
  "not-applicable": { glyph: "–", word: "Not applicable" },
};

/** Closed-vocabulary reasonCode -> a specific, factual sentence. Never a claim stronger than the runtime proves -- see docs/reviews/fedos-verified-secure-session-ui-current-readiness/05_SECURITY_CLAIM_BOUNDARIES.md for the full audited list this mirrors. */
const CHAT_SECURITY_REASON_TEXT: Record<string, string> = {
  "no-identity-change-observed": "Same identity as when this contact was first added to this conversation — no unexplained change observed.",
  "no-history-for-this-contact": "FedOS has no history for this contact's identity yet.",
  "identity-replacement-auto-accepted-without-asking": "This contact's identity changed and FedOS accepted the new key automatically, without asking you. Confirm with them out of band that they really did change identity.",
  "identity-change-unresolved": "This contact's identity changed and is waiting for your review.",
  "identity-change-reviewed-and-accepted": "This contact's identity change was reviewed and accepted.",
  "identity-change-rejected": "A claimed identity change for this contact was rejected.",
  "identity-change-conflicting": "Conflicting identity information was received for this contact.",
  "identity-change-rollback-detected": "A suspicious identity rollback was detected for this contact.",
  "identity-change-stale": "Identity change evidence for this contact is stale.",
  "identity-continuity-state-unresolved": "Identity continuity state could not be resolved.",
  "ratchet-status-unavailable": "Direct Ratchet status is not available for this conversation.",
  "ratchet-session-active": "A Direct Ratchet session is active for this conversation.",
  "ratchet-pending": "A Direct Ratchet session is being established for this conversation.",
  "ratchet-initialization-required": "A Direct Ratchet session has not been established for this conversation yet.",
  "ratchet-reset-required": "The secure session for this conversation needs to be re-established.",
  "ratchet-peer-incompatible": "This contact's device is not compatible with Direct Ratchet.",
  "ratchet-revoked": "The Direct Ratchet session for this conversation was revoked.",
  "ratchet-unsupported": "Direct Ratchet is not supported for this conversation.",
  "ratchet-unavailable": "Direct Ratchet is not available for this conversation.",
  "forward-secrecy-route-unavailable": "Forward-secrecy status is not available for this conversation.",
  "messages-routed-through-ratchet": "Messages are sent through the Ratchet — a later key compromise would not expose them.",
  "no-forward-secrecy-ratchet-not-configured": "Messages in this conversation do NOT currently have forward secrecy — a later key compromise could expose them.",
  "no-forward-secrecy-no-session-for-conversation": "Messages in this conversation do NOT currently have forward secrecy — no secure session is established with this contact.",
  "no-forward-secrecy-remote-device-unknown": "Messages in this conversation do NOT currently have forward secrecy — this contact's device is not known.",
  "no-forward-secrecy-remote-device-revoked": "Messages in this conversation do NOT currently have forward secrecy — this contact's device was revoked.",
  "no-forward-secrecy-remote-device-not-trusted": "Messages in this conversation do NOT currently have forward secrecy — this contact's device is not trusted.",
  "no-forward-secrecy-ambiguous-remote-device": "Messages in this conversation do NOT currently have forward secrecy — more than one device is known and none was chosen.",
  "no-device-observed": "FedOS has not observed a device for this contact yet.",
  "observed-device-revoked": "A device observed for this contact was revoked.",
  "observed-device-registration-unavailable": "A device announcement was received for this contact, but it could not be durably registered.",
  "observed-device-not-yet-trusted": "A device was observed for this contact, but it is not yet trusted.",
  "observed-devices-trusted": "The device(s) this conversation has used are cryptographically trusted and known.",
  "observed-devices-trusted-first-seen-only": "The device this conversation has used is cryptographically valid, but FedOS has only seen it once — this is not the same as independently verifying it.",
  "observed-device-conflicting-rekey-rejected": "A device claiming to replace one already known for this contact was rejected — FedOS kept trusting the earlier device. Confirm with this contact out of band if they say they changed devices.",
  "no-rejected-security-evidence": "No recent security evidence for this conversation was rejected.",
  "relay-connected-metadata-exposed": "Relays can see that this conversation is happening. Encryption does not hide that.",
  "no-relay-connected-metadata-still-exposed-when-connected": "No relay is currently connected. When one is, it can see that this conversation is happening.",
};

function chatSecurityReasonText(reasonCode: string): string {
  return CHAT_SECURITY_REASON_TEXT[reasonCode] ?? (reasonCode.startsWith("evidence-rejected-") ? "A recent security event for this contact could not be verified and was rejected." : reasonCode);
}

async function refreshChatSecurityState(conversationId: string, counterpartyAccountRef: ChatCounterpartyAccountRef | null): Promise<void> {
  const indicatorText = byId("chat-security-indicator-text");
  const axesList = byId("chat-security-axes");
  indicatorText.textContent = "checking…";
  const result = await window.fedosApp.conversationSecurityState(conversationId, counterpartyAccountRef);
  if (result.outcome !== "ok") {
    indicatorText.textContent = "unavailable";
    axesList.textContent = "";
    return;
  }
  const state = result.value as Record<string, { readonly state: string; readonly reasonCode: string }>;
  const axisKeys = ["identityContinuity", "encryption", "forwardSecrecy", "deviceKnowledge", "evidenceIntegrity", "metadataExposure"];
  const attentionCount = axisKeys.filter((k) => state[k]?.state === "attention").length;
  indicatorText.textContent = attentionCount > 0 ? `${String(attentionCount)} need${attentionCount === 1 ? "s" : ""} attention` : "no attention needed";

  axesList.textContent = "";
  for (const key of axisKeys) {
    const axis = state[key];
    if (axis === undefined) continue;
    const glyphInfo = CHAT_SECURITY_STATE_GLYPH[axis.state] ?? { glyph: "?", word: axis.state };
    const li = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = `${glyphInfo.glyph} ${CHAT_SECURITY_AXIS_LABELS[key] ?? key}: ${glyphInfo.word}`;
    li.appendChild(label);
    const explanation = document.createElement("div");
    explanation.className = "muted";
    explanation.textContent = chatSecurityReasonText(axis.reasonCode);
    li.appendChild(explanation);
    axesList.appendChild(li);
  }
}

function onChatSecurityIndicatorClick(): void {
  const panel = byId("chat-security-details");
  const button = byId<HTMLButtonElement>("chat-security-indicator");
  const nowHidden = !panel.hidden;
  panel.hidden = nowHidden;
  button.setAttribute("aria-expanded", nowHidden ? "false" : "true");
}

/**
 * FedOS Message Delivery Truth arc (renderer boundary closure) --
 * `FedosContentAccessorDeliveryFact.state` (see
 * `src/os/messenger/desktop/content_accessor/fedos_desktop_conversation_content_accessor_result.ts`'s
 * own header): `"queued"` is the BEST outcome this architecture can ever
 * synchronously prove -- never a relay ACK, never "the recipient received
 * it" -- so it is deliberately never rendered as "Sent." here either, to
 * avoid re-introducing the exact over-claim this arc exists to remove.
 * `route`/`reason` carried on the fact are Direct-only and absent for a
 * Group send (`fanout` covers that axis instead).
 */
type ChatSendDeliveryFact = { readonly route: string; readonly state: string; readonly reason?: string };

/** Closed-vocabulary delivery state -> a specific, honest sentence. Never "Sent." for anything less than a real transport hand-off, and never claims delivery for a state this architecture cannot prove. */
const CHAT_SEND_DELIVERY_STATE_TEXT: Record<string, string> = {
  queued: "Queued for delivery…",
  "route-unavailable": "Saved on this device — not sent yet (no delivery route available).",
  unavailable: "Saved on this device — not sent yet (delivery unavailable).",
  failed: "Saved on this device — delivery failed.",
};

/** `undefined` means no delivery dependency was configured for this send at all (e.g. a Group send, which reports its own outcome via `fanout` instead) -- an honest "saved, delivery unknown", never coerced into `"queued"` or "Sent." */
function chatSendFeedbackText(delivery: ChatSendDeliveryFact | undefined): string {
  if (delivery === undefined) return "Saved on this device.";
  return CHAT_SEND_DELIVERY_STATE_TEXT[delivery.state] ?? "Saved on this device.";
}

async function onChatSend(): Promise<void> {
  if (currentConversationId === null) return;
  const body = byId<HTMLTextAreaElement>("chat-compose").value;
  clearError("chat-error");
  byId("chat-send-feedback").textContent = "";
  if (body.trim().length === 0) {
    byId("chat-error").textContent = "Enter a message.";
    return;
  }
  setBusy(true, "chat-send");
  try {
    const result = await window.fedosApp.messageSend(currentConversationId, body);
    if (result.outcome !== "ok") {
      showError("chat-error", result);
      return;
    }
    byId<HTMLTextAreaElement>("chat-compose").value = "";
    const value = result.value as { readonly delivery?: ChatSendDeliveryFact } | undefined;
    const delivery = value?.delivery;
    byId("chat-send-feedback").textContent = chatSendFeedbackText(delivery);
    if (delivery !== undefined && delivery.state !== "queued") {
      byId("chat-error").textContent = delivery.reason ?? describeOutcome(delivery.state);
    }
    await loadChatMessages();
  } finally {
    setBusy(false, "chat-send");
  }
}

// ---------------------------------------------------------------------
// Commerce Reachable Catalog + Product Surface Phase 1.
//
// Read-only. No ordering/payment/delivery/Trust/QR wiring — see the
// disabled "Ordering not available yet" pill in the HTML, never a fake
// working Buy button.
//
// Media safety: this renderer treats every `dataUri` it receives from
// `window.fedosApp.commerceCatalogList()`/`commerceProductDetail()` as
// UNTRUSTED, exactly like any other IPC response. Rendering never uses
// `innerHTML`, never navigates the renderer, and the ONE allowed image
// mechanism (`isSafeCommerceImageDataUri`) accepts only an exact
// `data:image/png;base64,` prefix — no `javascript:`, no `file://`, no
// `data:image/svg+xml` (SVG-as-image script-execution ambiguity, never
// risked), no `https:`/remote scheme of any kind. A rejected or failing
// image always falls back to the same safe initials placeholder used for
// products with no media at all — a broken/malicious image can never
// crash or blank either screen.
// ---------------------------------------------------------------------

let commerceCatalogCache: readonly FedosCommerceCatalogListItem[] = [];
/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- last
 * successfully-fetched My Orders list, kept so a FAILED refresh can
 * honestly keep showing "the last known information" (per this arc's own
 * sync-state requirement) instead of clearing the list to a fabricated
 * empty state. `undefined` only before the very first fetch attempt ever
 * completes.
 */
let commerceMyOrdersCache: readonly FedosCommerceOrder[] | undefined = undefined;
let commerceMerchantOrdersCache: readonly FedosCommerceOrder[] | undefined = undefined;
/** Set by `openCommerceProduct()`, read by `onCommerceOrderCreateSubmit()` — the id of whichever product Product Detail currently shows (mirrors `currentConversationId`'s own module-state convention above). */
let currentCommerceDetailProductId: string | null = null;

/** The ONLY scheme this renderer will ever hand to an `<img src>` — see this section's own header. */
function isSafeCommerceImageDataUri(value: string): boolean {
  return value.startsWith("data:image/png;base64,") && value.length > "data:image/png;base64,".length;
}

function commerceProductInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter((w) => w.length > 0);
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/** Builds either a safe `<img>` (validated data: URI, with an onerror fallback) or the initials placeholder — used by both the catalog list and product detail. */
function buildCommerceMediaElement(
  media: { readonly dataUri: string; readonly altText: string } | null,
  title: string,
  imgClass: string,
  fallbackClass: string,
): HTMLElement {
  if (media !== null && isSafeCommerceImageDataUri(media.dataUri)) {
    const img = document.createElement("img");
    img.className = imgClass;
    img.src = media.dataUri;
    img.alt = media.altText;
    img.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = fallbackClass;
      fallback.textContent = commerceProductInitials(title);
      img.replaceWith(fallback);
    });
    return img;
  }
  const fallback = document.createElement("div");
  fallback.className = fallbackClass;
  fallback.textContent = commerceProductInitials(title);
  return fallback;
}

function formatCommercePrice(priceCents: number, currency: string): string {
  return `${(priceCents / 100).toFixed(2)} ${currency}`;
}

function renderCommerceCatalogList(): void {
  const list = byId("commerce-catalog-list");
  list.textContent = "";
  if (commerceCatalogCache.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No products available.";
    list.appendChild(li);
    return;
  }
  for (const product of commerceCatalogCache) {
    const li = document.createElement("li");
    // Catalog rows never carry the real media dataUri (only `hasImage`) —
    // the list view intentionally shows the safe fallback for every row;
    // the real image loads only on Product Detail, keeping the catalog
    // response small and avoiding rendering N untrusted images at once.
    li.appendChild(buildCommerceMediaElement(null, product.title, "commerce-thumb", "commerce-thumb-fallback"));
    const title = document.createElement("div");
    title.textContent = product.title;
    li.appendChild(title);
    const price = document.createElement("div");
    price.className = "commerce-price";
    price.textContent = formatCommercePrice(product.priceCents, product.currency);
    li.appendChild(price);
    const merchant = document.createElement("div");
    merchant.className = "muted field";
    merchant.textContent = product.merchantLabel;
    li.appendChild(merchant);
    // FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D)
    // -- arc mandate item 5: every demo/tutorial fixture is now explicitly,
    // individually labeled -- never silently blended with zero
    // distinguishing signal, even though (see `handleCommerceCatalogList()`'s
    // own header for why) it still shares this same list/DOM position with
    // real listings.
    if (product.isDemo) {
      const demoPill = document.createElement("span");
      demoPill.className = "commerce-sim-pill";
      demoPill.textContent = "DEMO";
      li.appendChild(demoPill);
    }
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "View";
    openBtn.setAttribute("aria-label", `View ${product.title}`);
    openBtn.addEventListener("click", () => void openCommerceProduct(product.id));
    li.appendChild(openBtn);
    list.appendChild(li);
  }
}

async function refreshCommerceCatalogList(): Promise<void> {
  populateCommerceActorSelect("commerce-acting-as");
  commerceDiscoveryTracker.begin();
  renderCommerceDiscoveryBanner(commerceCatalogCache.filter((p) => !p.isDemo).length === 0);
  const result = await runCommerceAction([], "commerce-error", () => window.fedosApp.commerceCatalogList());
  if (result === undefined) {
    commerceCatalogCache = [];
    commerceDiscoveryTracker.complete(false);
    renderCommerceCatalogList();
  } else if (result.outcome !== "ok") {
    showError("commerce-error", result);
    commerceCatalogCache = [];
    commerceDiscoveryTracker.complete(false);
    renderCommerceCatalogList();
  } else {
    commerceCatalogCache = result.products ?? [];
    commerceLastNetworkProfile = result.networkProfile ?? "local-only";
    commerceLastHasConfiguredRelay = result.hasConfiguredRelay ?? false;
    // FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D)
    // -- a discovery ATTEMPT that was deliberately skipped (local-only / no
    // relay configured) is not a FAILURE -- only `outcome: "failed"` (a
    // genuine query error) counts as `sync-failed`; skipped states are
    // reported through `commerceLastNetworkProfile`/`commerceLastHasConfiguredRelay`
    // instead (see `renderCommerceDiscoveryBanner()`'s own priority order).
    commerceDiscoveryTracker.complete(result.discoveryAttempt?.outcome !== "failed");
    renderCommerceCatalogList();
  }
  renderCommerceDiscoveryBanner((result?.realListingCount ?? 0) === 0);
  void refreshCommerceMyOrdersList();
  void refreshCommerceBuyerActivitySummary();
}

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- friction-ledger row #14 / arc §32/§36: a minimal, real
 * "do I have anything to act on?" summary for the buyer role, backed by
 * `commerceActivitySummary()`'s real repository-derived counts (never a
 * stub). Agent U owns the actual badge/nav-chrome UI treatment — this is
 * this file's own minimal fallback if that isn't visible/ready.
 */
async function refreshCommerceBuyerActivitySummary(): Promise<void> {
  const el = byId("commerce-my-orders-activity-summary");
  const result = await window.fedosApp.commerceActivitySummary(commerceActingAsPubkey);
  if (result.outcome !== "ok" || result.asBuyer === undefined) {
    el.textContent = "";
    return;
  }
  const b = result.asBuyer;
  const parts: string[] = [];
  if (b.awaitingSellerAcceptance > 0) parts.push(`${b.awaitingSellerAcceptance} awaiting seller acceptance`);
  if (b.readyToPay > 0) parts.push(`${b.readyToPay} ready to pay`);
  if (b.readyToAcknowledge > 0) parts.push(`${b.readyToAcknowledge} ready to acknowledge receipt`);
  if (b.readyToComplete > 0) parts.push(`${b.readyToComplete} ready to complete`);
  if (b.readyReceipts > 0) parts.push(`${b.readyReceipts} receipt(s) ready`);
  el.textContent = parts.length > 0 ? parts.join(" · ") : "Nothing needs your attention right now.";
}

/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- "where is my
 * order?" landing-screen pointer (AFTER usability report row #7, P2: "no
 * pointer back to an in-progress or just-completed order" after unlock or
 * restart -- see `#commerce-landing-pointer`'s own HTML comment). Reuses
 * the SAME `commerceActivitySummary()` call the buyer/seller activity
 * summaries above already make -- no new IPC call. Mirrors
 * `buildCommerceLandingPointer()`'s tested algorithm
 * (`src/os/commerce/order/landing_pointer.ts`) exactly; inlined here for
 * the same sandboxing reason as this file's other inlined-not-imported
 * helpers (see this file's own header).
 */
function pluralizeCommerceLandingCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

async function refreshCommerceLandingPointer(): Promise<void> {
  const el = byId("commerce-landing-pointer");
  // Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
  // item 6: the "Go to Shop"/"Go to My Store" action buttons alongside the
  // text -- see their own HTML comment for why text-only wasn't enough.
  const shopBtn = byId<HTMLButtonElement>("commerce-landing-pointer-shop-btn");
  const storeBtn = byId<HTMLButtonElement>("commerce-landing-pointer-store-btn");
  const result = await window.fedosApp.commerceActivitySummary(commerceActingAsPubkey);
  if (result.outcome !== "ok") {
    el.setAttribute("hidden", "");
    el.textContent = "";
    shopBtn.setAttribute("hidden", "");
    storeBtn.setAttribute("hidden", "");
    return;
  }
  const lines: string[] = [];
  let hasBuyerActivity = false;
  const b = result.asBuyer;
  if (b !== undefined) {
    const parts: string[] = [];
    if (b.readyToPay > 0) parts.push(`${pluralizeCommerceLandingCount(b.readyToPay, "order")} ready to pay`);
    if (b.readyToAcknowledge > 0) parts.push(`${pluralizeCommerceLandingCount(b.readyToAcknowledge, "order")} ready to acknowledge`);
    if (b.readyToComplete > 0) parts.push(`${pluralizeCommerceLandingCount(b.readyToComplete, "order")} ready to complete`);
    if (b.readyReceipts > 0) parts.push(`${pluralizeCommerceLandingCount(b.readyReceipts, "receipt")} ready`);
    if (parts.length === 0 && b.awaitingSellerAcceptance > 0) {
      parts.push(`${pluralizeCommerceLandingCount(b.awaitingSellerAcceptance, "order")} awaiting seller acceptance`);
    }
    if (parts.length > 0) {
      lines.push(`Shop: ${parts.join(", ")}.`);
      hasBuyerActivity = true;
    }
  }
  let hasSellerActivity = false;
  const s = result.asSeller;
  if (s !== undefined) {
    const parts: string[] = [];
    if (s.newSubmitted > 0) parts.push(pluralizeCommerceLandingCount(s.newSubmitted, "new order"));
    if (s.unpaid > 0) parts.push(`${pluralizeCommerceLandingCount(s.unpaid, "order")} awaiting buyer payment`);
    if (s.paidReadyToFulfill > 0) parts.push(`${pluralizeCommerceLandingCount(s.paidReadyToFulfill, "order")} paid, ready to fulfill`);
    if (s.fulfillingInProgress > 0) parts.push(`${pluralizeCommerceLandingCount(s.fulfillingInProgress, "order")} awaiting buyer confirmation`);
    if (parts.length > 0) {
      lines.push(`My Store: ${parts.join(", ")}.`);
      hasSellerActivity = true;
    }
  }
  shopBtn.toggleAttribute("hidden", !hasBuyerActivity);
  storeBtn.toggleAttribute("hidden", !hasSellerActivity);
  if (lines.length === 0) {
    el.setAttribute("hidden", "");
    el.textContent = "";
    return;
  }
  el.textContent = lines.join(" ");
  el.removeAttribute("hidden");
}

/** Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — which screen "← Back" returns to: the ordinary buyer catalog, or (for a merchant's own draft/unpublished Preview, friction ledger row #24) the Merchant screen it was opened from. */
let commerceDetailReturnScreen: "commerce" | "commerce-merchant" = "commerce";

async function openCommerceProductDetailScreen(productId: string, previewActorPubkey?: string): Promise<void> {
  currentCommerceDetailProductId = productId;
  showAppScreen("commerce-detail");
  clearError("commerce-order-create-error");
  // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 4,
  // arc §23 (P0): the order-form quantity (and any other per-product
  // order-form state added later) MUST reset whenever the underlying
  // product identity changes -- before this fix, navigating Product A
  // (qty=5) -> Product B silently carried qty=5 into B with no validation
  // catching it. `openCommerceProduct()` is the ONLY place
  // `currentCommerceDetailProductId` changes, so resetting here covers
  // every navigation path to Product Detail (catalog "View", order-screen
  // "Back to Commerce" then a different product, etc.), not just one entry
  // point. See `commerce_quantity_reset_on_product_change.test.ts`.
  byId<HTMLInputElement>("commerce-order-quantity").value = "1";
  byId("commerce-detail-title").textContent = "Loading…";
  byId("commerce-detail-media-area").textContent = "";
  byId("commerce-detail-price").textContent = "";
  byId("commerce-detail-merchant").textContent = "";
  byId("commerce-detail-status").textContent = "";
  byId("commerce-detail-description").textContent = "";
  byId("commerce-detail-reputation-summary").textContent = "";
  byId("commerce-detail-preview-banner").setAttribute("hidden", "");
  const result = await runCommerceAction([], "commerce-detail-error", () =>
    window.fedosApp.commerceProductDetail(productId, previewActorPubkey),
  );
  if (result === undefined) {
    byId("commerce-detail-title").textContent = "Product";
    return;
  }
  if (result.outcome !== "ok" || result.product === undefined) {
    byId("commerce-detail-title").textContent = "Product";
    showCommerceProductDetailNotFoundError(result);
    return;
  }
  renderCommerceProductDetail(result.product);
}

/**
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- item 7
 * ("seller not found"/"listing unavailable" error-recovery copy), split out
 * of `openCommerceProductDetailScreen()` to keep that function's own body
 * short (a real structural test bounds its length). `handleCommerceProductDetail()`
 * reports every not-found case (a genuinely nonexistent id, an unpublished/
 * archived listing, or a Nostr-discovery miss for a seller this process
 * couldn't reach) as one `"not-found"` outcome -- this build has no signal
 * to tell those apart, so this honestly covers all of them rather than
 * guessing which one happened.
 */
function showCommerceProductDetailNotFoundError(result: { readonly outcome: string; readonly reason?: string }): void {
  const reason =
    result.outcome === "not-found"
      ? "This listing isn't available. It may have been removed or unpublished by the seller, or the seller may not be reachable from this device right now — try again later, or ask the seller to re-share it."
      : result.reason;
  showCommerceError("commerce-detail-error", { outcome: result.outcome, reason });
}

async function openCommerceProduct(productId: string): Promise<void> {
  commerceDetailReturnScreen = "commerce";
  await openCommerceProductDetailScreen(productId);
}

/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
 * ledger row #24 / arc §30: lets a merchant preview a draft/unpublished
 * product of their OWN exactly as a buyer would see it, before
 * publishing. Feeds the SAME `renderCommerceProductDetail()` a real
 * buyer's Product Detail view already uses — never a second,
 * visually-divergent preview renderer.
 */
async function openCommerceProductPreview(productId: string): Promise<void> {
  commerceDetailReturnScreen = "commerce-merchant";
  await openCommerceProductDetailScreen(productId, commerceActingAsPubkey);
}

/**
 * Buyer Discovery + Digital Content Delivery mega-arc (Coordinator
 * validation-gate fix) -- decides whether Product Detail offers its
 * "Create Order" form, and if not, the ONE honest reason why.
 *
 * THE BUG THIS REPLACES (live-reproduced on a real production launch,
 * fresh profile, real relay-discovered listing): the gate used to read
 *
 *     const isCustomer = commerceActorRole(commerceActingAsPubkey) === "customer";
 *
 * i.e. it asked "is the selected 'Acting as' identity one of the actors
 * this build labels `role: "customer"`?". The ONLY actor that has ever
 * carried `role: "customer"` is the synthetic demo fixture
 * `COMMERCE_DEMO_ACTORS[0]` (`"c".repeat(64)`, "Customer -- Alice (demo)") --
 * `commerceRealActor()` hard-codes EVERY real local Persona to
 * `role: "merchant"` (it is that identity's *store* capacity). So the
 * moment this arc's own item 1 correctly gated the demo fixtures behind
 * `commerceDemoActorsVisible()` (production launches never set
 * `FEDOS_ELECTRON_BETA_AUTOTEST`), `commerceActingAsOptions()` on a real
 * launch became `[realActor]` alone -- every option `role: "merchant"`,
 * so `isCustomer` was UNCONDITIONALLY false and the order form was
 * UNCONDITIONALLY hidden. No real user could order ANY product, including
 * the built-in demo listings. The demo-persona gate was right; this gate
 * was the one still depending on the removed demo-customer concept.
 *
 * THE CORRECT CONDITION, and the one implemented here: buying is not a
 * separate identity concept at all. A person's real local Persona is the
 * same pubkey whether they are selling their own listings or buying
 * someone else's; "customer" vs "merchant" is a per-ORDER capacity, not a
 * property of an identity. So any real local identity may order any
 * product it does NOT itself own.
 *
 * SELF-DEALING is still blocked, and now on the REAL property rather than
 * demo-fixture-list membership: `commerceActingAsPubkey === product.creatorPubkey`.
 * That mirrors exactly what the domain layer independently and
 * unbypassably enforces -- `createOrder()`'s own
 * `actor.pubkey === input.sellerPubkey` -> `"self_dealing"` rejection in
 * `src/os/commerce/order/order_state_machine.ts`, reached through
 * `handleCommerceOrderCreate()`, which sets `sellerPubkey` from the
 * product's own `creatorPubkey` on BOTH its local and its
 * Nostr-discovered branch. This UI gate is therefore a truthful mirror of
 * the real rule, never the enforcement boundary itself.
 *
 * `product.isPreview` (a seller previewing their own draft through the
 * buyer renderer, Agent S's friction-ledger row #24) is deliberately kept
 * silent: the screen already carries `#commerce-detail-preview-banner`
 * explaining the state, so a second "you can't order this" line would be
 * noise. It is also always a self-owned draft, so it is redundant.
 */
function commerceProductOrderAvailability(product: FedosCommerceProductDetail): { readonly canOrder: boolean; readonly blockedReason: string } {
  if (product.isPreview) return { canOrder: false, blockedReason: "" };
  if (commerceActingAsPubkey.length === 0) {
    return { canOrder: false, blockedReason: "FedOS is still loading your local identity — an order is always placed as a real identity of yours, so this will become available in a moment." };
  }
  if (commerceActingAsPubkey === product.creatorPubkey) {
    return {
      canOrder: false,
      blockedReason: 'This is your own listing — you cannot place an order with yourself. Manage it from "My Store" instead. (If you meant to order as a different identity of yours, change "Acting as".)',
    };
  }
  return { canOrder: true, blockedReason: "" };
}

function renderCommerceProductDetail(product: FedosCommerceProductDetail): void {
  byId("commerce-detail-title").textContent = product.title;
  byId("commerce-detail-preview-banner").toggleAttribute("hidden", !product.isPreview);
  const mediaArea = byId("commerce-detail-media-area");
  mediaArea.textContent = "";
  mediaArea.appendChild(buildCommerceMediaElement(product.media, product.title, "commerce-detail-media", "commerce-detail-media-fallback"));
  byId("commerce-detail-price").textContent = formatCommercePrice(product.priceCents, product.currency);
  byId("commerce-detail-merchant").textContent = `Sold by ${product.merchantLabel}`;
  byId("commerce-detail-status").textContent = `Status: ${product.status}`;
  byId("commerce-detail-description").textContent = product.description;
  const availability = commerceProductOrderAvailability(product);
  byId("commerce-detail-order-form").toggleAttribute("hidden", !availability.canOrder);
  const unavailableNote = byId("commerce-detail-order-unavailable-note");
  unavailableNote.textContent = availability.blockedReason;
  unavailableNote.toggleAttribute("hidden", availability.blockedReason.length === 0);
  // Commerce Product-Media Sync + Truthful Completion mega-arc (Wave B) --
  // THE truthful pre-purchase declaration (§16/§67) this build previously
  // had no per-product signal for (see the superseded comment this
  // replaces, still visible in git history). Never claims content exists
  // when this process genuinely cannot know yet -- "unknown" renders as an
  // honest "not confirmed yet", never a false "no protected content".
  const declarationEl = byId("commerce-detail-media-declaration");
  if (product.protectedContent === "present") {
    declarationEl.textContent = "Includes protected digital content — available to you after your order is confirmed and the seller fulfills it.";
  } else if (product.protectedContent === "unknown") {
    declarationEl.textContent = "Whether this listing includes protected digital content hasn't synced to this device yet — check back, or view again after reconnecting.";
  } else {
    declarationEl.textContent = "";
  }
  // Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
  // item 5: a clear delivery expectation shown BEFORE checkout, never only
  // discovered after paying. Mirrors this app's own existing, already-honest
  // post-purchase copy ("Digital content from this purchase, if the seller
  // attached any.", `#commerce-order-purchased-content-actions`) rather than
  // inventing a second, differently-worded promise; explains the REAL
  // mechanics (pay -> seller fulfills -> you confirm receipt yourself) that
  // apply to every order regardless of the declaration above.
  // Deliberately avoids the words "pay"/"paid": this screen's own structural
  // guard (`commerce_reachable_catalog_phase1_structural_guards.test.ts`,
  // "no 'Buy Now'/instant-purchase button, and PAID is never one click away
  // from Product Detail") asserts the WHOLE Product Detail screen never
  // mentions payment at all -- Create Order is the only action here, and
  // the actual pay/confirm step correctly lives one screen later, on the
  // Order screen.
  const deliveryExpectationText =
    "Digital item — any protected content the seller has attached becomes available to you (Order screen → \"Open Purchased Content\") once your order is confirmed and the seller marks this fulfilled. You confirm receipt yourself; nothing is marked delivered on the seller's say-so alone.";
  byId("commerce-detail-delivery-expectation").textContent = deliveryExpectationText;
  byId("commerce-detail-order-form-delivery-note").textContent = deliveryExpectationText;
  void renderCommerceSellerReputation(product.creatorPubkey);
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- minimal read-only
 * Seller Reputation panel: pseudonymous persona id, coarse verified-trade
 * bucket, coarse primary category, and verification state. Always queries
 * the "PUBLIC" disclosure layer (the preload/main bridge never accepts a
 * layer argument from this renderer -- see `commercePersonaBoardQuery`'s
 * own doc comments). A pubkey with no reputation history yet (the common
 * case for every demo product's first order) renders a plain, honest
 * "no history yet" message -- never a fabricated zero/empty board.
 */
/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
 * ledger row #13 / arc §40: the SAME reputation query+formatting used by
 * both the buyer-facing Product Detail "Seller Reputation" panel AND
 * (new) the Merchant/My Store dashboard's "My Reputation" panel — one
 * shared function, `targetElementId` is the only thing that differs, so
 * there is exactly one place that calls `commercePersonaBoardQuery()`
 * and exactly one place that formats its result, never a duplicated copy.
 */
async function renderCommercePersonaReputation(subjectPubkey: string, targetElementId: string): Promise<void> {
  const el = byId(targetElementId);
  el.textContent = "Loading reputation…";
  // No dedicated error element for this read-only panel -- a genuine
  // thrown/rejected call still falls back to the SAME honest "no history"
  // text a normal not-found/unavailable outcome already produces below,
  // never a stack trace (this panel has no separate `.error` region to
  // render one into, and inventing one for a single non-critical read-only
  // summary would be disproportionate — see `runCommerceAction()`'s own
  // header for the general policy this is a deliberate, narrow exception to).
  const result = await runCommerceAction([], "commerce-detail-error", () => window.fedosApp.commercePersonaBoardQuery(subjectPubkey));
  if (result === undefined || result.outcome !== "ok" || result.view === undefined) {
    el.textContent = "No reputation history on record for this seller yet.";
    return;
  }
  const view = result.view;
  const bucket = view.verifiedTradeCountBucket ?? "unknown";
  const category = view.primaryCategory ?? "no category on record";
  const epochLabel = view.epochId.length > 12 ? `${view.epochId.slice(0, 12)}…` : view.epochId;
  const validity = result.verificationState?.epochCurrentlyValid === true ? "currently valid" : "not currently valid";
  el.textContent = `Persona ${epochLabel} — ${bucket} verified trades — mostly ${category} — persona epoch ${validity}. Reputation is pseudonymous, self-reported by trading counterparties, and not a guarantee of identity or Sybil resistance.`;
}

/** Buyer-facing wrapper — unchanged call shape for existing callers. */
async function renderCommerceSellerReputation(creatorPubkey: string): Promise<void> {
  await renderCommercePersonaReputation(creatorPubkey, "commerce-detail-reputation-summary");
}

/** Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — the Merchant/My Store dashboard's own reputation panel, same query+formatting as above, keyed to whichever identity is currently acting as merchant. */
async function renderCommerceMerchantReputation(): Promise<void> {
  await renderCommercePersonaReputation(commerceActingAsPubkey, "commerce-merchant-reputation-summary");
}

// ---------------------------------------------------------------------
// Commerce E2E Completion arc — Merchant Product CRUD, Order, local
// Payment simulator.
//
// Demo actor identity: this ordinary (non-acceptance-mode) build has no
// multi-account/persona-switch UI anywhere else in the product — a single
// Electron process represents one local identity. To let ONE local session
// walk through the full documented tabletop (Bob Merchant + Alice
// Customer) without a second running instance, this section adds a
// LOCAL-ONLY, LOUDLY-labeled "Acting as" demo selector — never presented
// as a real multi-identity/account-switching feature, never touching
// `window.fedosProfile`'s real single local profile. The three pubkeys
// below are the SAME synthetic values `fedos_electron_beta_commerce_demo_catalog.ts`
// already used for its two merchant personas (`"a".repeat(64)`/`"b".repeat(64)`)
// plus one new synthetic customer persona (`"c".repeat(64)`) — this file
// cannot `import` that module (see this file's own header), so the values
// are restated here, structurally identical.
//
// Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
// ledger row #2 / arc §8 / arc §12 ("Bob's own actual profile identity
// can never be used as a seller identity"): `COMMERCE_DEMO_ACTORS` below
// is KEPT exactly as a test/dev fixture (never deleted — still the only
// way to exercise a two-role tabletop in one process), but it is no
// longer the ONLY identity source. `commerceActingAsOptions()` ADDITIVELY
// appends the REAL local Persona (`localAccountPublicIdentifier` /
// `localDisplayLabel`, the same identity `window.fedosProfile.status()`
// already established elsewhere in this file) as a distinct, clearly
// non-demo "My Store" option whenever a profile is unlocked — this is
// the real production merchant identity the brief asks for, structurally
// separated (own array, own `isDemo: false` flag, own label prefix) from
// the fictional fixtures rather than merged/renamed into them.
//
// Buyer Discovery + Digital Content Delivery mega-arc (Coordinator
// validation-gate fix) — CORRECTING what this header used to claim. It
// used to say "Acting as your real identity always asserts a MERCHANT
// capacity... so real-identity purchases are not offered here; the demo
// customer persona remains the only way to exercise a buyer flow". That
// was only ever true of the single-process demo-persona era, and once
// this arc's item 1 correctly hid the demo fixtures from production it
// became a live, total blocker: NO real user could order ANYTHING. The
// real model is: `role` is a per-ORDER capacity, never a property of an
// identity. One real Persona is simultaneously the merchant of its own
// listings and a perfectly ordinary buyer of everyone else's, on the same
// pubkey. `role` below is therefore only consulted where a MERCHANT
// capacity is genuinely being asserted (creating a product, see
// `onCommerceMerchantCreateSubmit()` + `canCreateProduct()`); the buyer
// side asks the real question instead — "is this product one I do not
// own?" — in `commerceProductOrderAvailability()`.
// ---------------------------------------------------------------------

interface CommerceActingAsActor {
  readonly pubkey: string;
  readonly label: string;
  readonly role: "customer" | "merchant";
  readonly isDemo: boolean;
}

const COMMERCE_DEMO_ACTORS: readonly CommerceActingAsActor[] = [
  { pubkey: "c".repeat(64), label: "Customer — Alice (demo)", role: "customer", isDemo: true },
  { pubkey: "a".repeat(64), label: "Merchant — Northlight Studio (demo)", role: "merchant", isDemo: true },
  { pubkey: "b".repeat(64), label: "Merchant — Riverbend Makerspace (demo)", role: "merchant", isDemo: true },
];

/** The real local Persona as a Commerce actor, or `null` before a profile is unlocked. Never a demo fixture — see this section's own header. */
function commerceRealActor(): CommerceActingAsActor | null {
  if (localAccountPublicIdentifier.length === 0) return null;
  const label = localDisplayLabel.length > 0 ? localDisplayLabel : "your profile";
  return { pubkey: localAccountPublicIdentifier, label: `My Store — ${label} (real profile)`, role: "merchant", isDemo: false };
}

/**
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- item 1
 * ("Remove demo-persona dependence from the normal flow... A demo selector
 * may remain, but gated to an explicit test/demo mode only"). Reuses the
 * SAME `window.fedosBeta.debugInstrumentationEnabled` flag every other
 * test-only affordance in this file already gates on (a plain synchronous
 * property backed by `FEDOS_ELECTRON_BETA_AUTOTEST`, see that property's own
 * doc comment in `fedos_electron_beta_window.d.ts`) -- unset on every real
 * production launch, so an ordinary user's "Acting as" selector NEVER offers
 * "Alice"/"Northlight Studio"/"Riverbend Makerspace". Every existing
 * automated test/E2E harness in this package already sets
 * `FEDOS_ELECTRON_BETA_AUTOTEST` to launch Electron at all, so this is a
 * pure production-vs-test gate, not a behavior change for any existing
 * test.
 */
function commerceDemoActorsVisible(): boolean {
  return window.fedosBeta.debugInstrumentationEnabled;
}

/** Every selectable "Acting as" actor: the real local Persona first (when available), then the demo fixtures -- ONLY when demo mode is explicitly active (`commerceDemoActorsVisible()`) -- so the real production identity is never buried below fictional ones, and a real production build never offers a fictional one at all. */
function commerceActingAsOptions(): readonly CommerceActingAsActor[] {
  const real = commerceRealActor();
  const demoActors = commerceDemoActorsVisible() ? COMMERCE_DEMO_ACTORS : [];
  return real === null ? demoActors : [real, ...demoActors];
}

/** The asserted role for a given "Acting as" pubkey, across BOTH the real identity and the demo fixtures — `undefined` for an unrecognized pubkey (never defaults to a privileged role). */
function commerceActorRole(pubkey: string): "customer" | "merchant" | undefined {
  return commerceActingAsOptions().find((a) => a.pubkey === pubkey)?.role;
}

/**
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- item 1
 * / item 6 (order recovery): starts EMPTY (never defaulted to the demo
 * customer fixture). `refreshCommerceActorOptionsForRealIdentity()` below
 * fills this in with the real local Persona the moment one is available,
 * UNLESS the user has explicitly picked something themselves this session
 * (`commerceActingAsUserExplicitlyChosen`) -- see that flag's own doc
 * comment. This was the actual root cause of two separately-reported
 * tabletop bugs that read as unrelated: SELLER-TABLETOP-AFTER.md's "Does
 * 'Acting as' remember your last selection across a reload? NO... the same
 * disorienting default a brand-new seller hits on their very first visit"
 * AND the final report's own named P1 "restart doesn't land on/point back
 * to the in-progress order" -- `refreshCommerceLandingPointer()`/
 * `refreshCommerceMyOrdersList()`/`refreshCommerceMerchantOrdersList()` all
 * key off `commerceActingAsPubkey`, so silently re-defaulting to the demo
 * Alice fixture on every restart meant every one of those views queried the
 * WRONG identity for a real user, every single time.
 */
let commerceActingAsPubkey = "";

/**
 * True only once a user has ACTUALLY interacted with an "Acting as"
 * selector this session (`setCommerceActingAs()` below is called ONLY from
 * the two selects' own "change"/"input" listeners -- never programmatically
 * elsewhere in this file). While `false`, `refreshCommerceActorOptionsForRealIdentity()`
 * is free to keep re-defaulting `commerceActingAsPubkey` to the real local
 * Persona as it becomes available; once `true`, a user's own explicit
 * choice (including deliberately switching to a demo fixture, when demo
 * mode is active) is never silently overridden.
 */
let commerceActingAsUserExplicitlyChosen = false;

/**
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- item
 * 2/3: the last-known `commerceNetworkProfile` (Local Only / Nostr
 * Optional / Serverless Privacy), fetched once at Ready
 * (`refreshCommerceNetworkProfileCache()` below) and refreshed whenever the
 * Settings screen's own Network Profile panel loads/saves — cached rather
 * than re-fetched synchronously inside `renderCommerceCatalogModeBanner()`
 * (that function must stay synchronous: it runs inline inside
 * `populateCommerceActorSelect()`, which many synchronous call sites
 * depend on). `null` only before the very first fetch resolves — the
 * banner renders an honest "checking…" state for that brief window, never
 * a guessed value.
 */
let commerceNetworkProfileCache: FedosCommerceNetworkProfile | null = null;

const COMMERCE_DEMO_MODE_BANNER_HTML =
  'Fictional/local demo data only — nothing here is a real product, merchant, or payment. <span class="commerce-sim-pill">LOCAL DEMO</span>';

/**
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- item
 * 3 ("never let an apparently-working empty/demo catalog silently
 * substitute for real discovery... you own the copy/visual truthfulness").
 * Renders `#commerce-mode-banner` (Shop) and `#commerce-merchant-mode-banner`
 * (My Store) truthfully based on the CURRENTLY selected "Acting as"
 * identity, instead of the old unconditional static "LOCAL DEMO" claim
 * that used to render even directly over a seller's own real, just-created
 * listing (SELLER-TABLETOP-AFTER.md: "I had just clicked into my own store
 * and was immediately looking at it as a fake customer"). Never claims
 * network reachability it hasn't actually checked -- the real-mode copy
 * distinguishes "stored only on this device" (Local Only) from "shared to
 * your configured Relay" (Nostr Optional/Serverless Privacy) using the
 * SAME `commerceNetworkProfile` Settings already exposes, never a second,
 * separately-derived sync claim.
 */
function renderCommerceCatalogModeBanner(): void {
  const active = commerceActingAsOptions().find((a) => a.pubkey === commerceActingAsPubkey);
  let html: string;
  if (active === undefined) {
    html = "Loading your store…";
  } else if (active.isDemo) {
    html = COMMERCE_DEMO_MODE_BANNER_HTML;
  } else if (commerceNetworkProfileCache === null) {
    html = "Your real listings and orders, stored on this device. Checking network publish status…";
  } else if (commerceNetworkProfileCache === "local-only") {
    html =
      'Your real listings and orders, stored only on this device. <strong>Not</strong> published to the network yet — other people cannot discover them until you enable Nostr publication (Settings → Commerce Nostr Publication). <span class="commerce-sim-pill">LOCAL ONLY</span>';
  } else {
    html = "Your real listings and orders. Nostr publication is on (Settings → Commerce Nostr Publication) — new or updated listings are sent to your configured Relay.";
  }
  for (const id of ["commerce-mode-banner", "commerce-merchant-mode-banner"]) {
    const el = document.getElementById(id);
    if (el !== null) el.innerHTML = html;
  }
}

/** Fetches the real Commerce Network Profile once (Ready / Settings load/save) and re-renders the Shop/My Store mode banners against it — see `commerceNetworkProfileCache`'s own doc comment. Never blocks/guesses in the meantime. */
async function refreshCommerceNetworkProfileCache(): Promise<void> {
  const result = await window.fedosApp.commerceNetworkProfileGet();
  if (result.outcome === "ok" && result.profile !== undefined) {
    commerceNetworkProfileCache = result.profile;
    renderCommerceCatalogModeBanner();
  }
}

function populateCommerceActorSelect(selectId: string): void {
  const select = byId<HTMLSelectElement>(selectId);
  select.textContent = "";
  for (const actor of commerceActingAsOptions()) {
    const option = document.createElement("option");
    option.value = actor.pubkey;
    option.textContent = actor.label;
    select.appendChild(option);
  }
  select.value = commerceActingAsPubkey;
  const isShopScreen = selectId === "commerce-acting-as";
  const noteId = isShopScreen ? "commerce-acting-as-note" : "commerce-merchant-acting-as-note";
  const noteEl = document.getElementById(noteId);
  if (noteEl !== null) {
    const active = commerceActingAsOptions().find((a) => a.pubkey === select.value);
    // Buyer Discovery + Digital Content Delivery mega-arc (Coordinator
    // validation-gate fix): the real-identity caption used to read
    // "Your real local profile, acting as this store's merchant." on BOTH
    // screens. On Shop that was actively misleading -- it is the screen
    // where you BUY other people's listings, and reading a merchant-only
    // caption next to a merchant-labelled single option is exactly what
    // told the fresh-buyer tester there must be some other "customer
    // identity" they were missing. There is not: the same real pubkey
    // buys and sells. Each screen now describes the capacity that screen
    // actually exercises.
    noteEl.textContent =
      active === undefined
        ? ""
        : active.isDemo
          ? "Demo fixture identity — not your real profile, not a real merchant/customer."
          : isShopScreen
            ? "Your real local profile. Orders you place here are placed as this identity."
            : "Your real local profile, acting as this store's merchant.";
  }
  renderCommerceCatalogModeBanner();
}

/** Keeps the Commerce screen's and Merchant screen's selectors mirrored to ONE shared identity — see this section's own header for why two selectors exist at all (both screens need the control visible without cross-navigating). Called ONLY from a real user "change"/"input" event (see `commerceActingAsUserExplicitlyChosen`'s own doc comment) -- marks the choice as explicit so it is never silently overridden by the real-identity auto-default below. */
function setCommerceActingAs(pubkey: string): void {
  commerceActingAsPubkey = pubkey;
  commerceActingAsUserExplicitlyChosen = true;
  byId<HTMLSelectElement>("commerce-acting-as").value = pubkey;
  byId<HTMLSelectElement>("commerce-merchant-acting-as").value = pubkey;
}

/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — re-populates
 * BOTH "Acting as" selectors so the real local-identity option appears the
 * moment a profile becomes ready, mirroring the startup call's own
 * "populate both, unconditionally" discipline (see that call's own comment
 * further below) rather than only lazily on next screen visit.
 *
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
 * additionally DEFAULTS `commerceActingAsPubkey` to the real local Persona
 * the instant one is available, as long as the user hasn't explicitly
 * picked something themselves yet this session -- see
 * `commerceActingAsUserExplicitlyChosen`'s own doc comment for why this is
 * the real fix for both the "Acting as doesn't remember your selection"
 * seller-tabletop complaint AND the "restart doesn't land on the
 * in-progress order" P1.
 */
function refreshCommerceActorOptionsForRealIdentity(): void {
  const real = commerceRealActor();
  if (real !== null && !commerceActingAsUserExplicitlyChosen) {
    commerceActingAsPubkey = real.pubkey;
  }
  populateCommerceActorSelect("commerce-acting-as");
  populateCommerceActorSelect("commerce-merchant-acting-as");
}

/**
 * Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 9
 * (arc §27): reuses the SAME friendly `COMMERCE_DEMO_ACTORS` labels this
 * file already computes for the "Acting as" selectors, as the PRIMARY
 * human-readable identity everywhere a buyer/seller pubkey would otherwise
 * render as a raw 64-char hex string (order parties, order lists). Falls
 * back to a short, non-full hex fragment for a pubkey outside the closed
 * demo-actor set -- should not happen in this local-demo-only build, but
 * never crashes or blanks the screen if it does. Raw hex stays reachable
 * everywhere via the `<details>` "Technical details" disclosure this arc
 * also added -- this never deletes the cryptographic id, only demotes it
 * from primary label to secondary/advanced.
 */
function commerceActorLabel(pubkey: string): string {
  if (pubkey.length > 0 && pubkey === localAccountPublicIdentifier) return localDisplayLabel.length > 0 ? localDisplayLabel : "You";
  const actor = COMMERCE_DEMO_ACTORS.find((a) => a.pubkey === pubkey);
  if (actor !== undefined) return actor.label;
  return pubkey.length > 12 ? `${pubkey.slice(0, 12)}…` : pubkey;
}

let currentCommerceOrder: FedosCommerceOrder | null = null;
let currentCommercePendingPayment: { readonly paymentId: string; readonly amountCents: number; readonly currency: string } | null = null;
/** Commerce E2E Completion arc (Wave B integration) — the Delivery record bound to `currentCommerceOrder`, if one exists yet (created only once the merchant fulfills). Refetched every time the Order screen (re)renders. */
let currentCommerceDelivery: FedosCommerceDelivery | null = null;

function commerceOrderSummaryText(order: FedosCommerceOrder): string {
  return `${order.quantity} × ${formatCommercePrice(order.unitPriceCents, order.currency)} = ${formatCommercePrice(order.totalCents, order.currency)}`;
}

/**
 * Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 7
 * (arc §25): every actionless core Order state gets real, symmetric,
 * non-jargon copy explaining what happened, who acts next, that it's safe
 * to leave/restart, and how the screen updates (reopening this order --
 * this codebase has no push/poll for Commerce state, so that is the
 * honest answer, never a fabricated "we'll notify you"). Returns `""`
 * (hidden by `#commerce-order-waiting:empty`) whenever the CURRENT actor
 * has their own action available on this screen (that action's own `<div>`
 * already explains what to do) or the order is in a state/role combination
 * outside this function's own scope (e.g. a genuinely uninvolved viewer).
 */
function commerceOrderWaitingText(status: string, isBuyer: boolean, isSeller: boolean): string {
  if (status === "created" && isSeller && !isBuyer) {
    return "Waiting on the buyer to review and submit this order. You can safely close this and come back later — nothing is lost or expires if they're offline. Reopen this order to see whether they've submitted it.";
  }
  if (status === "submitted" && isBuyer && !isSeller) {
    return "Submitted — waiting on the seller to accept or reject. If they're offline, this simply waits for them; reopen this order later to see their decision.";
  }
  if (status === "accepted" && isSeller && !isBuyer) {
    return "Accepted — waiting on the buyer to pay. If they're offline, this simply waits; reopen this order later to see whether payment has arrived.";
  }
  if (status === "paid" && isBuyer && !isSeller) {
    return "Payment confirmed — waiting on the seller to fulfill your order. If they're offline, this simply waits; reopen this order later to check progress.";
  }
  if (status === "fulfilling" && isSeller && !isBuyer) {
    return "Marked fulfilling — waiting on the buyer to confirm they received it. If they're offline, this simply waits; reopen this order later to see whether they have.";
  }
  if (!isBuyer && !isSeller) {
    return "You're viewing this order under an identity that is neither its buyer nor its seller — no action is available to you here.";
  }
  return "";
}

function renderCommerceOrderScreen(): void {
  const order = currentCommerceOrder;
  clearError("commerce-order-error");
  clearError("commerce-order-payment-error");
  if (order === null) return;
  const statusText = byId("commerce-order-status-text");
  statusText.textContent = order.status;
  statusText.className = `commerce-order-status commerce-order-status-${order.status}`;
  byId("commerce-order-summary").textContent = commerceOrderSummaryText(order);

  const isBuyer = commerceActingAsPubkey === order.buyerPubkey;
  const isSeller = commerceActingAsPubkey === order.sellerPubkey;

  // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 9
  // (arc §27): friendly buyer/seller names as the PRIMARY label, reusing
  // the SAME resolution the "Acting as" selectors already use.
  byId("commerce-order-parties-text").textContent = `Buyer: ${commerceActorLabel(order.buyerPubkey)} · Seller: ${commerceActorLabel(order.sellerPubkey)}`;
  byId("commerce-order-waiting").textContent = commerceOrderWaitingText(order.status, isBuyer, isSeller);

  byId("commerce-order-review-actions").toggleAttribute("hidden", !(order.status === "created" && isBuyer));
  byId("commerce-order-merchant-actions").toggleAttribute("hidden", !(order.status === "submitted" && isSeller));
  const showsPaymentActions = order.status === "accepted" && isBuyer;
  byId("commerce-order-payment-actions").toggleAttribute("hidden", !showsPaymentActions);
  if (!showsPaymentActions) currentCommercePendingPayment = null;
  byId("commerce-order-payment-pending").toggleAttribute("hidden", currentCommercePendingPayment === null);
  if (currentCommercePendingPayment !== null) {
    byId("commerce-order-payment-id").textContent = currentCommercePendingPayment.paymentId;
    byId("commerce-order-payment-amount").textContent = formatCommercePrice(currentCommercePendingPayment.amountCents, currentCommercePendingPayment.currency);
  }
  byId("commerce-order-paid-banner").toggleAttribute("hidden", !["paid", "fulfilling", "delivered", "completed"].includes(order.status));
  byId("commerce-order-fulfill-actions").toggleAttribute("hidden", !(order.status === "paid" && isSeller));

  const delivery = currentCommerceDelivery;
  byId("commerce-order-delivery-status").textContent = delivery !== null ? `Delivery status: ${delivery.status}` : "";
  byId("commerce-order-acknowledge-actions").toggleAttribute("hidden", !(order.status === "fulfilling" && isBuyer));
  byId("commerce-order-complete-actions").toggleAttribute("hidden", !(order.status === "delivered" && (isBuyer || isSeller)));
  byId("commerce-order-receipt-actions").toggleAttribute("hidden", order.status !== "completed");
  if (order.status !== "completed") {
    byId("commerce-order-receipt-result").setAttribute("hidden", "");
    byId("commerce-order-completion-note").textContent = "";
  }

  // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 9:
  // raw hex ids demoted from primary label to this "Technical details"
  // disclosure -- never deleted, see `commerceActorLabel()`'s own header.
  // Kept as the FULL, untruncated ids here (rather than Agent D's
  // abbreviated `…`-suffixed variant) since this element lives inside the
  // "Technical details" disclosure specifically to keep full cryptographic
  // traceability reachable somewhere (arc §27) -- primary/friendly labels
  // elsewhere already show the short/friendly form.
  byId("commerce-order-id").textContent = `Order id: ${order.id}`;
  byId("commerce-order-history").textContent = `Product id: ${order.productId} — buyer pubkey: ${order.buyerPubkey} — seller pubkey: ${order.sellerPubkey}`;

  // FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
  // (Agent D) -- friction-ledger row #15 / arc §36: an obvious buyer-facing
  // action once the Order reaches a qualifying (paid-or-later) state —
  // mirrors `isQualifyingOrderStatusForMediaAccess()`'s own allowed
  // statuses exactly. Never claims content exists; the redeem call itself
  // honestly reports "no protected content for this product" when there
  // is none.
  const qualifiesForPurchasedContent = ["paid", "fulfilling", "delivered", "completed"].includes(order.status) && isBuyer;
  byId("commerce-order-purchased-content-actions").toggleAttribute("hidden", !qualifiesForPurchasedContent);
  if (!qualifiesForPurchasedContent) byId("commerce-order-purchased-content-result").setAttribute("hidden", "");
}

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- friction-ledger row #15 / arc §36: the buyer-facing
 * "receive the digital product I bought" action. NEVER exposes the
 * `MediaAccessGrant` envelope, a content key, AEAD internals, or a CID —
 * only the plain content bytes (as a downloadable data URL) once the
 * grant-gated redeem call succeeds, or an honest denial reason.
 */
/*
 * Coordinator integration pass: Agent A's
 * `commerceMediaGrantRedeemFriendlyReason()` used to live here. Agent A and
 * Agent U independently wrote competing friendly-denial-text mappers for this
 * exact call site (neither could see the other's branch). Rather than pick a
 * side, A's function was removed and every state it covered that U's table did
 * not -- the `pending` outcome and the `content-corrupt` /
 * `requested-awaiting-seller-response` reasons, all introduced by A's own new
 * cross-process release channel -- was migrated into
 * `COMMERCE_PURCHASED_CONTENT_DENIAL_TEXT` /
 * `commercePurchasedContentDenialText()` above. U's table is otherwise a
 * strict superset (14 entries drawn from the real closed vocabulary in
 * `media_access_grant_policy.ts` vs A's 8 branches), and U's structural guard
 * 23 requires this call site to route through it, so consolidating on U's
 * mapper keeps exactly one denial vocabulary with zero behaviour lost.
 */

async function onCommerceOpenPurchasedContentClick(): Promise<void> {
  if (currentCommerceOrder === null) return;
  clearError("commerce-order-purchased-content-error");
  const btn = byId<HTMLButtonElement>("commerce-order-purchased-content-btn");
  btn.disabled = true;
  try {
    const result = await window.fedosApp.commerceMediaGrantRedeem(currentCommerceOrder.id, commerceActingAsPubkey);
    if (result.outcome !== "ok" || result.contentBase64 === undefined) {
      const reason = commercePurchasedContentDenialText(result.outcome, result.reason);
      showCommerceError("commerce-order-purchased-content-error", { outcome: result.outcome, reason });
      byId("commerce-order-purchased-content-result").setAttribute("hidden", "");
      return;
    }
    byId("commerce-order-purchased-content-result").removeAttribute("hidden");
    const contentType = result.contentType ?? "application/octet-stream";
    const link = byId<HTMLAnchorElement>("commerce-order-purchased-content-link");
    link.href = `data:${contentType};base64,${result.contentBase64}`;
    const extension = contentType.includes("/") ? contentType.split("/")[1]?.split(";")[0] ?? "" : "";
    link.download = extension.length > 0 ? `purchased-content.${extension}` : "purchased-content";
    const statusEl = document.getElementById("commerce-order-purchased-content-status");
    if (statusEl !== null) {
      statusEl.textContent = result.source === "cache" ? `Content type: ${contentType} — already on this device` : `Content type: ${contentType} — received from seller`;
    }
  } catch (err) {
    showCommerceError("commerce-order-purchased-content-error", { outcome: "error", reason: err instanceof Error ? err.message : "purchased content request failed unexpectedly" });
  } finally {
    btn.disabled = false;
  }
}

async function refreshCommerceDeliveryStatus(): Promise<void> {
  if (currentCommerceOrder === null) return;
  const orderId = currentCommerceOrder.id;
  const result = await runCommerceAction([], "commerce-order-error", () => window.fedosApp.commerceDeliveryStatus(orderId));
  currentCommerceDelivery = result !== undefined && result.outcome === "ok" ? result.delivery ?? null : null;
  renderCommerceOrderScreen();
}

function openCommerceOrderScreen(order: FedosCommerceOrder): void {
  currentCommerceOrder = order;
  currentCommercePendingPayment = null;
  currentCommerceDelivery = null;
  byId("commerce-order-completion-note").textContent = "";
  // Reset unconditionally (not just when `order.status !== "completed"`,
  // which `renderCommerceOrderScreen()` already handles) -- otherwise a
  // PRIOR completed order's receipt panel could stay visibly stale for a
  // few ms while THIS order's own `refreshCommerceReceiptStatus()` lookup
  // is still in flight, or permanently if this order turns out to have no
  // receipt of its own yet.
  byId("commerce-order-receipt-result").setAttribute("hidden", "");
  // (Agent U) Same reasoning for the cross-process sync note: it is
  // per-order, so a prior order's note must never survive into this one.
  byId("commerce-order-sync-note").textContent = "";
  // (Coordinator, integration phase) ...and the same for the two other
  // cross-process channels' notes, for the identical reason.
  byId("commerce-order-payment-sync-note").textContent = "";
  byId("commerce-order-delivery-sync-note").textContent = "";
  showAppScreen("commerce-order");
  renderCommerceOrderScreen();
  void refreshCommerceDeliveryStatus();
  void refreshCommerceReceiptStatus();
}

async function onCommerceDeliveryAcknowledgeReceiptClick(): Promise<void> {
  if (currentCommerceOrder === null) return;
  const orderId = currentCommerceOrder.id;
  const result = await runCommerceAction(["commerce-order-acknowledge-receipt-btn"], "commerce-order-error", () =>
    window.fedosApp.commerceDeliveryAcknowledgeReceipt(orderId, commerceActingAsPubkey),
  );
  if (result === undefined) return;
  if (result.outcome !== "ok" || result.order === undefined) {
    showCommerceError("commerce-order-error", result);
    return;
  }
  currentCommerceOrder = result.order;
  currentCommerceDelivery = result.delivery ?? currentCommerceDelivery;
  renderCommerceOrderScreen();
  // (Coordinator, integration phase) Agent D performed this send but
  // discarded its result -- a buyer whose "I received it" never reached
  // the seller's process was told nothing at all. Now reported honestly.
  renderCommerceSyncOutcomeNote("commerce-order-delivery-sync-note", result.deliverySyncOutcome, "delivery");
  void refreshCommerceMyOrdersList();
}

/**
 * Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 21
 * (arc §42): `result.reputationSyncStatus` truthfully reports whether the
 * SECONDARY, non-fatal reputation-attestation issuance actually succeeded.
 * The Order reaching "completed" (this call's own `outcome`) is the CORE
 * transaction and is never blocked by that secondary one failing -- but the
 * UI must say so honestly rather than staying silent either way (never
 * "Published everywhere" if it didn't).
 */
async function onCommerceOrderCompleteClick(): Promise<void> {
  if (currentCommerceOrder === null) return;
  const orderId = currentCommerceOrder.id;
  const result = await runCommerceAction(["commerce-order-complete-btn"], "commerce-order-error", () =>
    window.fedosApp.commerceOrderComplete(orderId, commerceActingAsPubkey),
  );
  if (result === undefined) return;
  if (result.outcome !== "ok" || result.order === undefined) {
    showCommerceError("commerce-order-error", result);
    return;
  }
  currentCommerceOrder = result.order;
  renderCommerceOrderScreen();
  byId("commerce-order-completion-note").textContent =
    result.reputationSyncStatus === "unavailable"
      ? "Order completed. Note: a reputation record for this trade could not be saved just now — your completed order itself is unaffected."
      : "Order completed. Reputation records were saved for both parties.";
  renderCommerceSyncOutcomeNote("commerce-order-sync-note", result.nostrSyncOutcome);
  // (Coordinator, integration phase) Agent D's delivery channel is an
  // INDEPENDENT send with an independent result -- `undefined` here clears
  // the element rather than claiming anything, so an action that attempted
  // no delivery send shows no delivery note.
  renderCommerceSyncOutcomeNote("commerce-order-delivery-sync-note", result.deliverySyncOutcome, "delivery");
  void refreshCommerceDeliveryStatus();
  void refreshCommerceMyOrdersList();
}

/**
 * Shared render step for both `onCommerceReceiptIssueClick()` (explicit
 * click, may mint a new receipt) and `refreshCommerceReceiptStatus()`
 * (silent auto-lookup on order open, never mints) -- same fields, same
 * DOM targets, so the "already issued, restored on open" case renders
 * byte-identically to the "just issued" case.
 */
function renderCommerceReceiptResult(result: { readonly qrText: string; readonly qrImageDataUrl?: string; readonly verifyStatus?: string }): void {
  byId("commerce-order-receipt-result").removeAttribute("hidden");
  byId("commerce-order-receipt-verify-status").textContent = result.verifyStatus ?? "";
  byId<HTMLTextAreaElement>("commerce-order-receipt-qr-text").value = result.qrText;
  // FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
  // (Agent D) -- friction-ledger row #11 / arc §34: a real, rendered QR
  // image, not merely the label claiming one exists.
  const qrImage = byId<HTMLImageElement>("commerce-order-receipt-qr-image");
  if (result.qrImageDataUrl !== undefined) {
    qrImage.src = result.qrImageDataUrl;
    qrImage.removeAttribute("hidden");
  } else {
    qrImage.setAttribute("hidden", "");
    qrImage.removeAttribute("src");
  }
}

async function onCommerceReceiptIssueClick(): Promise<void> {
  if (currentCommerceOrder === null) return;
  const orderId = currentCommerceOrder.id;
  const result = await runCommerceAction(["commerce-order-receipt-issue-btn"], "commerce-order-receipt-error", () =>
    window.fedosApp.commerceReceiptIssue(orderId),
  );
  if (result === undefined) return;
  if (result.outcome !== "ok" || result.qrText === undefined) {
    showCommerceError("commerce-order-receipt-error", result);
    return;
  }
  renderCommerceReceiptResult({ qrText: result.qrText, qrImageDataUrl: result.qrImageDataUrl, verifyStatus: result.verifyStatus });
}

/**
 * FedOS Commerce Purchase Completion mega-arc (Agent R) -- automatically
 * checks whether the currently open, `"completed"` order already has a
 * durably-persisted receipt (`DurableReceiptStore`, survives a real
 * restart byte-for-byte -- see `handleCommerceReceiptLookup()`,
 * `fedos_electron_beta_main.cts`) and, if so, renders it immediately --
 * WITHOUT the user needing to click "Issue Signed Receipt" again. Purely
 * read-only: never mints a receipt for an order that was never issued
 * one (`outcome: "not-found"` is a normal, silent no-op here). Mirrors
 * `refreshCommerceDeliveryStatus()`'s own "fetch on open, re-render"
 * pattern. Guards against a stale response landing after the user has
 * already navigated away to a different order.
 */
async function refreshCommerceReceiptStatus(): Promise<void> {
  if (currentCommerceOrder === null || currentCommerceOrder.status !== "completed") return;
  const orderId = currentCommerceOrder.id;
  const result = await runCommerceAction([], "commerce-order-receipt-error", () => window.fedosApp.commerceReceiptLookup(orderId));
  if (result === undefined || result.outcome !== "ok" || result.qrText === undefined) return;
  if (currentCommerceOrder === null || currentCommerceOrder.id !== orderId) return; // stale -- user navigated to a different order while this was in flight
  renderCommerceReceiptResult({ qrText: result.qrText, qrImageDataUrl: result.qrImageDataUrl, verifyStatus: result.verifyStatus });
}

async function onCommerceOrderCreateSubmit(): Promise<void> {
  const productId = currentCommerceDetailProductId;
  const quantityRaw = byId<HTMLInputElement>("commerce-order-quantity").value;
  const quantity = Number.parseInt(quantityRaw, 10);
  if (productId === null) {
    clearError("commerce-order-create-error");
    showCommerceError("commerce-order-create-error", { outcome: "invalid-input", reason: "no product selected" });
    return;
  }
  const result = await runCommerceAction(["commerce-order-create-submit"], "commerce-order-create-error", () =>
    window.fedosApp.commerceOrderCreate(commerceActingAsPubkey, productId, Number.isFinite(quantity) ? quantity : undefined),
  );
  if (result === undefined) return;
  if (result.outcome !== "ok" || result.order === undefined) {
    showCommerceError("commerce-order-create-error", result);
    return;
  }
  openCommerceOrderScreen(result.order);
}

async function onCommerceOrderActionClick(
  action: (orderId: string, actorPubkey: string) => Promise<FedosCommerceOrderResult>,
  errorElementId: string,
  busyButtonId: string,
): Promise<void> {
  if (currentCommerceOrder === null) return;
  const orderId = currentCommerceOrder.id;
  const result = await runCommerceAction([busyButtonId], errorElementId, () => action(orderId, commerceActingAsPubkey));
  if (result === undefined) return;
  if (result.outcome !== "ok" || result.order === undefined) {
    showCommerceError(errorElementId, result);
    return;
  }
  currentCommerceOrder = result.order;
  renderCommerceOrderScreen();
  // FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- honest,
  // non-blocking note on whether the counterparty was actually notified of
  // THIS action (never blocks/reverts the transition itself, which is
  // already committed above -- mirrors `reputationSyncStatus`'s own
  // established "core transaction succeeds regardless" discipline).
  renderCommerceSyncOutcomeNote("commerce-order-sync-note", result.nostrSyncOutcome);
  // (Coordinator, integration phase) Agent D's delivery channel is an
  // INDEPENDENT send with an independent result -- `undefined` here clears
  // the element rather than claiming anything, so an action that attempted
  // no delivery send shows no delivery note.
  renderCommerceSyncOutcomeNote("commerce-order-delivery-sync-note", result.deliverySyncOutcome, "delivery");
  void refreshCommerceDeliveryStatus();
  void refreshCommerceMyOrdersList();
}

async function onCommerceOrderRejectClick(): Promise<void> {
  if (currentCommerceOrder === null) return;
  const orderId = currentCommerceOrder.id;
  const reason = byId<HTMLInputElement>("commerce-order-reject-reason").value;
  const result = await runCommerceAction(["commerce-order-reject-btn"], "commerce-order-error", () =>
    window.fedosApp.commerceOrderReject(orderId, commerceActingAsPubkey, reason.length > 0 ? reason : undefined),
  );
  if (result === undefined) return;
  if (result.outcome !== "ok" || result.order === undefined) {
    showCommerceError("commerce-order-error", result);
    return;
  }
  currentCommerceOrder = result.order;
  renderCommerceOrderScreen();
  renderCommerceSyncOutcomeNote("commerce-order-sync-note", result.nostrSyncOutcome);
  // (Coordinator, integration phase) Agent D's delivery channel is an
  // INDEPENDENT send with an independent result -- `undefined` here clears
  // the element rather than claiming anything, so an action that attempted
  // no delivery send shows no delivery note.
  renderCommerceSyncOutcomeNote("commerce-order-delivery-sync-note", result.deliverySyncOutcome, "delivery");
  void refreshCommerceMyOrdersList();
}

async function onCommercePaymentRequestClick(): Promise<void> {
  if (currentCommerceOrder === null) return;
  const orderId = currentCommerceOrder.id;
  const result = await runCommerceAction(["commerce-order-payment-request-btn"], "commerce-order-payment-error", () =>
    window.fedosApp.commercePaymentRequest(orderId),
  );
  if (result === undefined) return;
  if (result.outcome !== "ok" || result.paymentId === undefined || result.amountCents === undefined || result.currency === undefined) {
    showCommerceError("commerce-order-payment-error", result);
    return;
  }
  currentCommercePendingPayment = { paymentId: result.paymentId, amountCents: result.amountCents, currency: result.currency };
  renderCommerceOrderScreen();
}

/**
 * The renderer sends ONLY `orderId`/`paymentId` — never a status, never a
 * `verification`/evidence shape (see `fedos_electron_beta_preload.cts`'s
 * own `commercePaymentSimulate` bound-string signature: two id strings,
 * nothing else can travel over this channel). The main process alone
 * decides the outcome — this button can request a simulated settlement,
 * it cannot dictate what that settlement says.
 */
async function onCommercePaymentSimulateClick(): Promise<void> {
  if (currentCommerceOrder === null || currentCommercePendingPayment === null) return;
  const orderId = currentCommerceOrder.id;
  const paymentId = currentCommercePendingPayment.paymentId;
  const result = await runCommerceAction(["commerce-order-payment-simulate-btn"], "commerce-order-payment-error", () =>
    window.fedosApp.commercePaymentSimulate(orderId, paymentId),
  );
  if (result === undefined) return;
  if (result.outcome !== "ok" || result.order === undefined) {
    showCommerceError("commerce-order-payment-error", result);
    return;
  }
  currentCommerceOrder = result.order;
  currentCommercePendingPayment = null;
  renderCommerceOrderScreen();
  // FedOS Commerce "Purchase Completion" mega-arc (Coordinator, integration
  // phase) -- Agent P's PaymentEvidence channel. This is the ONE action in
  // the whole app that ever sends payment evidence, and the buyer needs to
  // know honestly whether the seller's independent process was actually
  // told: "your local order says paid" and "the seller knows you paid" are
  // genuinely different facts, and only the first is guaranteed here.
  renderCommerceSyncOutcomeNote("commerce-order-payment-sync-note", result.paymentSyncOutcome, "payment-evidence");
  void refreshCommerceMyOrdersList();
}

/**
 * Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 14
 * (badge-UI half only; Agent D owns the underlying activity DATA this only
 * renders a count from -- reads the SAME already-fetched order lists every
 * Commerce/Merchant screen already fetches, never a new IPC call or a new
 * background poll). "Active" means not yet in a terminal state.
 */
const COMMERCE_TERMINAL_ORDER_STATUSES: readonly string[] = ["completed", "rejected", "cancelled"];

function updateCommerceNavBadge(elementId: string, orders: readonly FedosCommerceOrder[]): void {
  const active = orders.filter((o) => !COMMERCE_TERMINAL_ORDER_STATUSES.includes(o.status)).length;
  const el = byId(elementId);
  el.textContent = String(active);
  el.toggleAttribute("hidden", active === 0);
}

function renderCommerceMyOrdersList(orders: readonly FedosCommerceOrder[]): void {
  const list = byId("commerce-my-orders-list");
  list.textContent = "";
  if (orders.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No orders yet.";
    list.appendChild(li);
    return;
  }
  // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 8/
  // arc §32 (buyer order recovery): active orders sort first, so "where is
  // my order?" never requires scanning past finished/rejected/cancelled
  // ones -- especially after a restart, when this is the first thing a
  // returning buyer sees on the Commerce screen.
  const sorted = [...orders].sort((a, b) => {
    const aActive = COMMERCE_TERMINAL_ORDER_STATUSES.includes(a.status) ? 1 : 0;
    const bActive = COMMERCE_TERMINAL_ORDER_STATUSES.includes(b.status) ? 1 : 0;
    return aActive - bActive;
  });
  for (const order of sorted) {
    const li = document.createElement("li");
    const title = document.createElement("div");
    // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 9:
    // friendly seller name as the primary label, reusing the SAME
    // resolution the "Acting as" selectors already use; raw order id
    // demoted to a smaller, muted line rather than deleted.
    title.textContent = `${commerceActorLabel(order.sellerPubkey)} — ${order.status}`;
    li.appendChild(title);
    const idLine = document.createElement("div");
    idLine.className = "muted";
    idLine.textContent = `Order ${order.id.slice(0, 12)}…`;
    li.appendChild(idLine);
    const summary = document.createElement("div");
    summary.className = "muted";
    summary.textContent = commerceOrderSummaryText(order);
    li.appendChild(summary);
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => openCommerceOrderScreen(order));
    li.appendChild(openBtn);
    list.appendChild(li);
  }
}

/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- wraps the
 * fetch with `commerceMyOrdersSyncTracker` so `#commerce-my-orders-sync-status`
 * is always honest about whether this list's data actually just refreshed,
 * is refreshing now, or failed to refresh (never silently stale with no
 * signal either way -- see `CommerceRendererSyncTracker`'s own header).
 */
async function refreshCommerceMyOrdersList(): Promise<void> {
  commerceMyOrdersSyncTracker.begin();
  renderCommerceSyncStatus("commerce-my-orders-sync-status", commerceMyOrdersSyncTracker);
  const result = await runCommerceAction([], "commerce-error", () => window.fedosApp.commerceOrdersListMine(commerceActingAsPubkey));
  const succeeded = result !== undefined && result.outcome === "ok";
  const orders = succeeded ? result.orders ?? [] : [];
  commerceMyOrdersSyncTracker.complete(succeeded, Date.now());
  renderCommerceSyncStatus("commerce-my-orders-sync-status", commerceMyOrdersSyncTracker);
  // A failed refresh keeps showing the LAST rendered list rather than
  // clearing it to empty -- "showing the last known information", exactly
  // what the sync-status text just promised, never a fabricated "no
  // orders" on a mere fetch failure.
  if (succeeded || commerceMyOrdersCache === undefined) {
    commerceMyOrdersCache = orders;
  }
  renderCommerceMyOrdersList(commerceMyOrdersCache);
  updateCommerceNavBadge("commerce-my-orders-badge", commerceMyOrdersCache);
}

// --- Merchant screen: My Products + Create Product + Incoming Orders ---

/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
 * ledger row #18 / arc §29: safe decimal-string -> integer-cents parsing.
 * Deliberately string/integer-based (split on ".", pad the fractional
 * part, then integer-multiply/add) rather than `Number.parseFloat(x) *
 * 100`, which is the classic float-money bug class (e.g. some inputs
 * round to `...999999999998` instead of an exact integer). Returns
 * `null` for anything that is not a non-negative amount with at most 2
 * decimal places — never silently clamps or guesses.
 */
function parseCommerceDecimalPriceToCents(raw: string): number | null {
  const trimmed = raw.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (match === null) return null;
  const wholePart = match[1] ?? "0";
  const fractionPart = (match[2] ?? "").padEnd(2, "0");
  const wholeUnits = Number.parseInt(wholePart, 10);
  const fractionCents = Number.parseInt(fractionPart, 10);
  if (!Number.isSafeInteger(wholeUnits) || wholeUnits < 0) return null;
  const wholeCents = wholeUnits * 100; // exact: integer * integer, well within Number.isSafeInteger range for any realistic price.
  if (!Number.isSafeInteger(wholeCents)) return null;
  return wholeCents + fractionCents;
}

/** Live `= $18.00 USD`-style preview alongside a price/currency input pair — friction ledger row #18. */
function commerceUpdatePricePreview(priceInputId: string, currencySelectId: string, previewId: string): void {
  const raw = byId<HTMLInputElement>(priceInputId).value;
  const currency = byId<HTMLSelectElement>(currencySelectId).value;
  const cents = parseCommerceDecimalPriceToCents(raw);
  byId(previewId).textContent = cents === null ? "Enter a valid amount, e.g. 18.00" : `= ${formatCommercePrice(cents, currency)}`;
}

function commerceMerchantProductRow(product: FedosCommerceMerchantProduct): HTMLLIElement {
  const li = document.createElement("li");
  const title = document.createElement("div");
  title.textContent = `${product.title} — ${product.status}`;
  li.appendChild(title);
  const price = document.createElement("div");
  price.className = "commerce-price";
  price.textContent = formatCommercePrice(product.priceCents, product.currency);
  li.appendChild(price);

  // friction ledger row #24 / arc §30 — Preview reuses the SAME product-detail
  // render path a buyer's real view already uses (`openCommerceProductPreview`).
  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "commerce-btn-preview";
  previewBtn.textContent = "Preview";
  previewBtn.setAttribute("aria-label", `Preview ${product.title} as a buyer would see it`);
  previewBtn.addEventListener("click", () => void openCommerceProductPreview(product.id));
  li.appendChild(previewBtn);

  // friction ledger row #16 / arc §13 — Edit.
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "commerce-btn-edit";
  editBtn.textContent = "Edit";
  editBtn.setAttribute("aria-label", `Edit ${product.title}`);
  editBtn.addEventListener("click", () => onCommerceMerchantEditOpen(product));
  li.appendChild(editBtn);

  // friction ledger row #3 P0 fix / arc §14 — explicit, SEPARATE Publish
  // and Unpublish buttons (never one dual-purpose label), each disabled
  // for the duration of its own in-flight call, mirroring the established
  // `onDeviceRevoke()` "if (btn.disabled) return; btn.disabled = true;
  // try { ... } finally { btn.disabled = false; }" guard pattern
  // (`secure_runtime_alpha_8121_8200_double_submit_guards.test.ts` proves
  // that exact mechanism live). This closes the rapid-double-click
  // draft->active->archived bug the tabletop found: only ONE of these two
  // buttons is ever rendered for a given product, so there is no shared
  // label/state to race on.
  const isPublished = product.status === "active";
  // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 23
  // (arc §44), layered on top of Agent S's own two-separate-buttons P0 fix
  // (never one dual-purpose toggle -- see this block's own header comment
  // above): each button ALSO gets a primary/secondary visual-hierarchy
  // class (weight + padding, not color alone) in addition to S's own
  // distinct publish/unpublish color classes. Publish (draft/archived ->
  // active) reads as the primary/constructive action; Unpublish (takes a
  // LIVE listing down) reads as the more cautious, secondary one.
  if (isPublished) {
    const unpublishBtn = document.createElement("button");
    unpublishBtn.type = "button";
    unpublishBtn.className = "commerce-btn-unpublish commerce-btn-secondary";
    unpublishBtn.textContent = "Unpublish";
    unpublishBtn.addEventListener("click", () => void onCommercePublishAction(product.id, "unpublish", unpublishBtn));
    li.appendChild(unpublishBtn);
  } else {
    const publishBtn = document.createElement("button");
    publishBtn.type = "button";
    publishBtn.className = "commerce-btn-publish commerce-btn-primary";
    publishBtn.textContent = "Publish";
    publishBtn.addEventListener("click", () => void onCommercePublishAction(product.id, "publish", publishBtn));
    li.appendChild(publishBtn);
  }
  // FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
  // (Agent D) -- friction-ledger row #17 / arc §38: per-product image
  // attach control, independent of publish state.
  li.appendChild(commerceMerchantProductImageAttachControls(product.id));
  // Buyer Discovery + Digital Content Delivery mega-arc (Agent M) -- P0-2
  // content-creation half: per-product PROTECTED content attach control
  // (a purchased file / buyers-only sample), plus a plain-language summary
  // of what's currently attached and who can see it -- both additive,
  // independent of publish state, same posture as the image control above.
  li.appendChild(commerceMerchantProductContentAttachControls(product.id));
  const summaryContainer = document.createElement("div");
  summaryContainer.className = "commerce-product-media-summary";
  summaryContainer.id = `commerce-product-media-summary-${product.id}`;
  li.appendChild(summaryContainer);
  // Buyer Discovery + Digital Content Delivery mega-arc (Coordinator
  // validation-gate fix) -- pass the container ELEMENT, never rely on a
  // `document.getElementById()` lookup here. This `li` is not yet in the
  // document at this point (the caller appends it after this function
  // returns), and `refreshCommerceMerchantProductMediaSummary()` reads its
  // container BEFORE its first `await` -- i.e. synchronously, while the
  // row is still detached -- so the lookup returned `null` and the summary
  // silently never rendered for ANY product, ever. Reproduced live: every
  // row's summary was empty even with real attached content, which is why a
  // seller had no visible confirmation their purchased file was attached.
  void refreshCommerceMerchantProductMediaSummary(product.id, summaryContainer);

  // FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
  // arc mandate item 3: "Share Product" -- emits a signed deep-link/QR/
  // compact code a real, independent buyer can Scan/Paste/Open to discover
  // this exact product, verified via signature (never a raw pubkey typed
  // by hand).
  // Coordinator integration pass: D's Share control and M's protected-content
  // controls are disjoint additions to the same merchant row; both are kept,
  // Share last so it reads as a row-level action after the content controls.
  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "commerce-btn-secondary";
  shareBtn.textContent = "Share Product";
  shareBtn.setAttribute("aria-label", `Share ${product.title}`);
  shareBtn.addEventListener("click", () => void onCommerceShareProductIssue(product.id, shareBtn));
  li.appendChild(shareBtn);
  // Coordinator integration pass: Agent U's own "Copy Share Info" control is
  // ALSO kept. U wrote it as a deliberately honest UI-surface-only stand-in
  // (its own doc comment says the signed plumbing "is Agent D's territory in
  // a sibling worktree; the Coordinator wires the two together"), and its
  // disclaimer is accurate about what THAT button emits: unsigned plain text
  // for out-of-band sharing, as opposed to D's signed proof above. Neither is
  // dropped here, because dropping either would delete tested work on one
  // agent's say-so. The resulting two-share-buttons redundancy is a real UX
  // question, not a merge question -- flagged for the fresh usability rerun.
  li.appendChild(commerceMerchantProductShareControls(product));
  return li;
}

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * issues a signed share proof for `productId` (only ever reachable for a
 * product `commerceActingAsPubkey` genuinely owns -- enforced main-process
 * side too, this is not the only gate) and renders the resulting QR/text
 * into the ONE shared result panel below the merchant product list.
 */
async function onCommerceShareProductIssue(productId: string, btn: HTMLButtonElement): Promise<void> {
  if (btn.disabled) return;
  btn.disabled = true;
  const errorId = "commerce-share-issue-error";
  clearError(errorId);
  byId("commerce-share-issue-result").setAttribute("hidden", "");
  try {
    const result = await window.fedosApp.commerceShareProductIssue(commerceActingAsPubkey, productId);
    if (result.outcome !== "ok" || result.qrText === undefined) {
      showCommerceError(errorId, result);
      return;
    }
    byId("commerce-share-issue-title").textContent = result.title ?? "";
    byId<HTMLTextAreaElement>("commerce-share-issue-qr-text").value = result.qrText;
    const img = byId<HTMLImageElement>("commerce-share-issue-qr-image");
    if (result.qrImageDataUrl !== undefined && isSafeCommerceImageDataUri(result.qrImageDataUrl)) {
      img.src = result.qrImageDataUrl;
      img.removeAttribute("hidden");
    } else {
      img.setAttribute("hidden", "");
    }
    byId("commerce-share-issue-result").removeAttribute("hidden");
  } finally {
    btn.disabled = false;
  }
}

/**
 * Buyer Discovery + Digital Content Delivery mega-arc (Agent M) -- plain,
 * non-technical, seller-facing summary of a product's attached media,
 * clearly separating what EVERYONE sees (public preview) from what ONLY a
 * paying buyer unlocks (protected/buyers-only) -- mandate requirement:
 * "make sure the seller's create-product UI clearly, non-technically
 * communicates which is which before they publish." Never renders a CID,
 * checksum, or any other internal detail -- `FedosCommerceProductMediaListItem`
 * itself never carries one (see `fedos_electron_beta_window.d.ts`).
 */
async function refreshCommerceMerchantProductMediaSummary(productId: string, containerEl?: HTMLElement): Promise<void> {
  // `containerEl` is the caller's own freshly-built element when the row is
  // not yet mounted (see `commerceMerchantProductRow()`'s own comment at the
  // call site); the id lookup remains the fallback for an already-mounted row.
  const container = containerEl ?? document.getElementById(`commerce-product-media-summary-${productId}`);
  if (container === null) return; // row no longer mounted (list re-rendered/removed) -- nothing to update.
  try {
    const result = await window.fedosApp.commerceMerchantProductMediaList(commerceActingAsPubkey, productId);
    if (result.outcome !== "ok" || result.media === undefined) {
      // Buyer Discovery + Digital Content Delivery mega-arc (Coordinator
      // validation-gate fix) -- a refused/failed listing used to blank the
      // container, which is visually identical to "nothing attached yet" and
      // is the reason this control could fail totally silently. Say so.
      container.textContent = "Couldn't load what's attached to this product.";
      return;
    }
    container.textContent = "";
    if (result.media.length === 0) {
      const none = document.createElement("div");
      none.className = "commerce-product-media-summary-empty";
      none.textContent = "No content attached yet.";
      container.appendChild(none);
      return;
    }
    const list = document.createElement("ul");
    list.className = "commerce-product-media-summary-list";
    for (const item of result.media) {
      const row = document.createElement("li");
      const badge = document.createElement("span");
      badge.className = item.classification === "protected" ? "commerce-media-badge-protected" : "commerce-media-badge-public";
      // Plain seller language only -- never "classification"/"AEAD"/"CID"/"content key" (mandate: ordinary seller language, never internals in the normal UI).
      badge.textContent = item.classification === "protected" ? "Buyers only (unlocked after purchase)" : "Shown to everyone (public preview)";
      row.appendChild(badge);
      const label = document.createElement("span");
      label.className = "commerce-product-media-summary-label";
      label.textContent = ` ${item.label.length > 0 ? item.label : "(untitled)"}`;
      row.appendChild(label);
      list.appendChild(row);
    }
    container.appendChild(list);
  } catch {
    container.textContent = "Couldn't load what's attached to this product.";
  }
}

/**
 * Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- item
 * 2 ("how do I share my store/product?"). This is deliberately the UI
 * SURFACE and honest copy only -- the underlying signed-artifact/QR
 * plumbing (a verifiable "here's my real listing" object a buyer could
 * scan/import) is Agent D's territory in a sibling worktree; the
 * Coordinator wires the two together. Until that lands, this copies the
 * plain product id + seller pubkey a buyer can be given out-of-band, WITH
 * an explicit, honest caveat about what that recipient still needs (a
 * working relay connection to actually discover it) -- never implies this
 * is already a one-tap "share" that Just Works end-to-end.
 */
function commerceMerchantProductShareControls(product: FedosCommerceMerchantProduct): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "commerce-product-share";
  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.textContent = "Copy Share Info";
  shareBtn.setAttribute("aria-label", `Copy share info for ${product.title}`);
  const feedbackEl = document.createElement("span");
  feedbackEl.className = "muted";
  feedbackEl.setAttribute("role", "status");
  feedbackEl.setAttribute("aria-live", "polite");
  shareBtn.addEventListener("click", () => {
    void (async () => {
      const shareText = `FedOS product: "${product.title}" (id ${product.id}) — seller ${product.creatorPubkey}. The recipient needs a working Relay connection to find this listing; this is not yet a verified/signed proof of the listing.`;
      try {
        await navigator.clipboard.writeText(shareText);
        feedbackEl.textContent = "Copied. Note: the recipient still needs a working Relay connection to actually find this listing.";
      } catch {
        feedbackEl.textContent = "Couldn't copy to clipboard.";
      }
    })();
  });
  wrap.appendChild(shareBtn);
  wrap.appendChild(feedbackEl);
  return wrap;
}

// Real Two-Party Commerce + UX P0/P1 Closure arc (coordinator merge note):
// Both Agent U and Agent D independently wrote their OWN competing
// publish/unpublish handler (`onCommerceProductPublishToggle`, a
// single-toggle design), each without visibility into Agent S's sibling
// worktree, where S had already closed this exact P0 (friction ledger row
// #3) with two separate, explicitly-labeled buttons and its own manual
// disable/confirm/try-finally guard (mirroring the established
// `onDeviceRevoke()` pattern). S's two-button design is arc §14's own
// explicit direction ("prefer separate semantics... rather than one
// ambiguous toggle") -- kept below; both competing single-toggle handlers
// were dropped as dead code rather than kept alongside it.
async function onCommercePublishAction(productId: string, action: "publish" | "unpublish", btn: HTMLButtonElement): Promise<void> {
  // A product only ever offers "Unpublish" while `status === "active"` (see
  // `commerceMerchantProductRow` above), so every unpublish action IS a
  // currently-LIVE listing leaving buyer view — confirm every time, per
  // arc §14 ("removing something real from view is different from
  // never-published-yet draft state"). Publish (draft/archived -> active)
  // never needs this — nothing real is being taken away from a buyer.
  //
  // Buyer Discovery + Digital Content Delivery mega-arc (post-report
  // follow-up fix): this confirmation used to be `window.confirm()`, which
  // froze the entire renderer JS thread for as long as the native dialog
  // stayed open — see `confirmInPage()`'s own header for the live evidence.
  // The button is now disabled BEFORE the (asynchronous) confirmation is
  // shown, so the double-submit guard still covers the whole action
  // including the time the dialog is on screen, and the existing
  // `finally { btn.disabled = false; }` still releases it on every path.
  if (btn.disabled) return;
  btn.disabled = true;
  clearError("commerce-merchant-products-error");
  try {
    if (
      action === "unpublish" &&
      !(await confirmInPage(
        "Unpublish this listing?",
        "It will stop appearing in the Shop catalog for buyers immediately. You can publish it again later.",
        "Yes, unpublish it",
      ))
    ) {
      return;
    }
    const result =
      action === "publish"
        ? await window.fedosApp.commerceProductPublish(commerceActingAsPubkey, productId)
        : await window.fedosApp.commerceProductUnpublish(commerceActingAsPubkey, productId);
    if (result.outcome !== "ok") {
      showCommerceError("commerce-merchant-products-error", result);
      return;
    }
    // FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- see
    // `#commerce-order-sync-note`'s own comment for the full rationale;
    // same honest, non-blocking note, here for publish/unpublish.
    renderCommerceSyncOutcomeNote("commerce-merchant-products-sync-note", result.nostrSyncOutcome);
    void refreshCommerceMerchantProductsList();
    void refreshCommerceCatalogList();
  } finally {
    btn.disabled = false;
  }
}

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- friction-ledger row #17 / arc §38: a small, additive
 * per-product image-attach control (file picker + button + error area),
 * reading the file via the ordinary browser `File`/`FileReader` API
 * (available in this sandboxed renderer without any Node integration —
 * no new capability exposed) and sending it as base64 over the existing
 * bounded-string IPC discipline (`commerceProductImageAttach`).
 */
function commerceMerchantProductImageAttachControls(productId: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "commerce-product-image-attach";
  // Buyer Discovery + Digital Content Delivery mega-arc (Agent M) -- plain
  // seller-facing label, clarifying this control is the PUBLIC side
  // (mandate: the create-product UI must clearly, non-technically say
  // which control is which BEFORE publish).
  const label = document.createElement("div");
  label.className = "commerce-product-image-attach-label";
  label.textContent = "Product image — shown to everyone browsing the Shop.";
  wrap.appendChild(label);
  // Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
  // SELLER-TABLETOP-AFTER.md: "'Attach Image' is a red herring for
  // delivery... it is a product-photo uploader, not a deliverable-content
  // uploader. I never found any control... that lets a seller attach the
  // actual thing a buyer is paying for." U's caption is kept because it
  // still does the disambiguating work M's label alone does not (M says who
  // SEES this; U says what this is NOT).
  //
  // Coordinator integration pass -- CORRECTED: U wrote its caption on a
  // branch where "this build genuinely has no deliverable-content upload
  // path anywhere" was true. Agent M has since built exactly that control
  // (`commerceMerchantProductContentAttachControls()`), and it is rendered
  // immediately below this one in the same merchant row. U's original
  // parenthetical "(this build has no control for that yet)" is therefore
  // now FALSE, and shipping it would actively mislead a seller away from a
  // control that exists. The disambiguating half of the sentence -- the part
  // U's structural guard 34 pins -- is preserved verbatim; only the stale
  // parenthetical is replaced with a pointer to M's real control.
  const captionEl = document.createElement("div");
  captionEl.className = "muted";
  captionEl.textContent = "Product photo only — this is not where you attach the digital content buyers will receive (use “Purchased file” below for that).";
  wrap.appendChild(captionEl);
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg";
  wrap.appendChild(fileInput);
  const attachBtn = document.createElement("button");
  attachBtn.type = "button";
  attachBtn.textContent = "Attach Photo";
  wrap.appendChild(attachBtn);
  const errorEl = document.createElement("div");
  errorEl.className = "error";
  errorEl.setAttribute("role", "alert");
  wrap.appendChild(errorEl);

  attachBtn.addEventListener("click", () => {
    void (async () => {
      errorEl.textContent = "";
      const file = fileInput.files?.[0];
      if (file === undefined) {
        errorEl.textContent = "Choose a PNG or JPEG image file first.";
        return;
      }
      attachBtn.disabled = true;
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("failed to read the selected file"));
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        const result = await window.fedosApp.commerceProductImageAttach(commerceActingAsPubkey, productId, base64, file.type);
        if (result.outcome !== "ok") {
          // Commerce Discovery + Digital Content Delivery mega-arc (Agent U)
          // -- item 7 (content upload rejected). The two most common real
          // rejections get a plain-language translation; anything else
          // still shows the real reason `handleCommerceProductImageAttach()`
          // gave (never fabricated, never a bare outcome code).
          errorEl.textContent =
            result.reason !== undefined && result.reason.startsWith("contentType must be one of")
              ? "This file type isn't supported. Only PNG or JPEG images can be attached."
              : result.reason === "malformed or missing image data" || result.reason === "image data is not valid base64" || result.reason === "image data decoded to zero bytes"
                ? "Couldn't read that image file — it may be corrupted or empty. Try a different file."
                : (result.reason ?? describeOutcome(result.outcome));
          return;
        }
        fileInput.value = "";
        // `refreshCommerceMerchantProductsList()` rebuilds this product's
        // whole row (`commerceMerchantProductRow()`), which itself already
        // kicks off a fresh `refreshCommerceMerchantProductMediaSummary()`
        // call -- no separate explicit refresh needed here.
        void refreshCommerceMerchantProductsList();
        void refreshCommerceCatalogList();
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : "image attach failed unexpectedly";
      } finally {
        attachBtn.disabled = false;
      }
    })();
  });

  return wrap;
}

/**
 * Buyer Discovery + Digital Content Delivery mega-arc (Agent M) — P0-2's
 * content-creation half: mirrors `commerceMerchantProductImageAttachControls()`
 * exactly (file picker + label input + button + error area, `File`/
 * `FileReader` read, bounded-string IPC), but attaches PROTECTED
 * ("buyers only") content via the SEPARATE `commerceProductContentAttach`
 * channel/method — never a `classification` toggle on the same control,
 * so a UI bug can never silently downgrade a purchased file to public or
 * vice versa (see `handleCommerceProductContentAttach()`'s own header,
 * main process). `accept=".pdf,.zip,application/pdf,application/zip"`
 * matches `COMMERCE_PROTECTED_CONTENT_TYPES` exactly (main process) — the
 * file picker itself is the first, advisory line of defense; the real
 * enforcement is server-side (main process contentType allowlist).
 *
 * Plain seller language throughout, per this arc's own mandate: "Purchased
 * file" / "Buyers only" — never "protected media" / "classification" /
 * "ciphertext" anywhere in this control's own copy.
 */
function commerceMerchantProductContentAttachControls(productId: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "commerce-product-content-attach";
  const labelHint = document.createElement("div");
  labelHint.className = "commerce-product-content-attach-label";
  labelHint.textContent = "Purchased file — only buyers who complete payment for this product can open it.";
  wrap.appendChild(labelHint);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "What should buyers see this called? e.g. \"Full guide (PDF)\"";
  nameInput.maxLength = 300;
  wrap.appendChild(nameInput);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".pdf,.zip,application/pdf,application/zip";
  wrap.appendChild(fileInput);

  const attachBtn = document.createElement("button");
  attachBtn.type = "button";
  attachBtn.textContent = "Attach Purchased File";
  wrap.appendChild(attachBtn);

  const errorEl = document.createElement("div");
  errorEl.className = "error";
  errorEl.setAttribute("role", "alert");
  wrap.appendChild(errorEl);

  attachBtn.addEventListener("click", () => {
    void (async () => {
      errorEl.textContent = "";
      const file = fileInput.files?.[0];
      if (file === undefined) {
        errorEl.textContent = "Choose a PDF or ZIP file first.";
        return;
      }
      const label = nameInput.value.trim();
      if (label.length === 0) {
        errorEl.textContent = "Give buyers a short name for this file first.";
        return;
      }
      attachBtn.disabled = true;
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("failed to read the selected file"));
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        const result = await window.fedosApp.commerceProductContentAttach(commerceActingAsPubkey, productId, base64, file.type, label);
        if (result.outcome !== "ok") {
          errorEl.textContent = result.reason ?? `attach failed: ${result.outcome}`;
          return;
        }
        fileInput.value = "";
        nameInput.value = "";
        // Same reasoning as the image control's own identical comment: the
        // full list rebuild already re-triggers the media summary refresh
        // for this product's row.
        void refreshCommerceMerchantProductsList();
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : "content attach failed unexpectedly";
      } finally {
        attachBtn.disabled = false;
      }
    })();
  });

  return wrap;
}

async function refreshCommerceMerchantProductsList(): Promise<void> {
  const result = await runCommerceAction([], "commerce-merchant-products-error", () => window.fedosApp.commerceMerchantProductsList(commerceActingAsPubkey));
  const list = byId("commerce-merchant-products-list");
  list.textContent = "";
  if (result === undefined) return;
  if (result.outcome !== "ok") {
    showCommerceError("commerce-merchant-products-error", result);
    return;
  }
  const products = result.products ?? [];
  if (products.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No products yet — create one below.";
    list.appendChild(li);
    return;
  }
  for (const product of products) list.appendChild(commerceMerchantProductRow(product));
}

/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
 * ledger row #16 / arc §13: opens the (single, shared) Edit form for one
 * product. `commerceProductUpdate` (already wired end-to-end: preload +
 * `handleCommerceProductUpdate` + `LocalProductRepository.update()`'s
 * existing `canEditProduct()` creator-only check) had no renderer caller
 * before this — this is that caller, never a new authority mechanism.
 */
let commerceEditingProductId: string | null = null;

function onCommerceMerchantEditOpen(product: FedosCommerceMerchantProduct): void {
  commerceEditingProductId = product.id;
  clearError("commerce-merchant-edit-error");
  byId("commerce-merchant-edit-title-label").textContent = `Editing "${product.title}"`;
  byId<HTMLInputElement>("commerce-merchant-edit-title").value = product.title;
  byId<HTMLTextAreaElement>("commerce-merchant-edit-description").value = product.description;
  byId<HTMLInputElement>("commerce-merchant-edit-price").value = (product.priceCents / 100).toFixed(2);
  const currencySelect = byId<HTMLSelectElement>("commerce-merchant-edit-currency");
  if (!Array.from(currencySelect.options).some((o) => o.value === product.currency)) {
    const opt = document.createElement("option");
    opt.value = product.currency;
    opt.textContent = product.currency;
    currencySelect.appendChild(opt);
  }
  currencySelect.value = product.currency;
  commerceUpdatePricePreview("commerce-merchant-edit-price", "commerce-merchant-edit-currency", "commerce-merchant-edit-price-preview");
  byId("commerce-merchant-edit-form").removeAttribute("hidden");
}

function onCommerceMerchantEditCancel(): void {
  commerceEditingProductId = null;
  byId("commerce-merchant-edit-form").setAttribute("hidden", "");
}

async function onCommerceMerchantEditSave(): Promise<void> {
  if (commerceEditingProductId === null) return;
  clearError("commerce-merchant-edit-error");
  const priceCents = parseCommerceDecimalPriceToCents(byId<HTMLInputElement>("commerce-merchant-edit-price").value);
  if (priceCents === null) {
    showCommerceError("commerce-merchant-edit-error", { outcome: "invalid-input", reason: "Enter a valid price, e.g. 18.00" });
    return;
  }
  const title = byId<HTMLInputElement>("commerce-merchant-edit-title").value;
  const description = byId<HTMLTextAreaElement>("commerce-merchant-edit-description").value;
  const currency = byId<HTMLSelectElement>("commerce-merchant-edit-currency").value;
  const btn = byId<HTMLButtonElement>("commerce-merchant-edit-save");
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const result = await window.fedosApp.commerceProductUpdate(commerceActingAsPubkey, commerceEditingProductId, {
      title,
      description: description.length > 0 ? description : undefined,
      priceCents,
      currency,
    });
    if (result.outcome !== "ok") {
      showCommerceError("commerce-merchant-edit-error", result);
      return;
    }
    onCommerceMerchantEditCancel();
    renderCommerceSyncOutcomeNote("commerce-merchant-products-sync-note", result.nostrSyncOutcome);
    void refreshCommerceMerchantProductsList();
    void refreshCommerceCatalogList();
  } finally {
    btn.disabled = false;
  }
}

function commerceMerchantOrderRow(order: FedosCommerceOrder): HTMLLIElement {
  const li = document.createElement("li");
  const title = document.createElement("div");
  // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 9:
  // friendly buyer name as the primary label -- this is exactly the "who
  // ordered?" case the friction ledger calls out for sellers specifically.
  title.textContent = `${commerceActorLabel(order.buyerPubkey)} — ${order.status}`;
  li.appendChild(title);
  const idLine = document.createElement("div");
  idLine.className = "muted";
  idLine.textContent = `Order ${order.id.slice(0, 12)}…`;
  li.appendChild(idLine);
  const summary = document.createElement("div");
  summary.className = "muted";
  summary.textContent = commerceOrderSummaryText(order);
  li.appendChild(summary);
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.textContent = "Open";
  openBtn.addEventListener("click", () => openCommerceOrderScreen(order));
  li.appendChild(openBtn);
  return li;
}

/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
 * ledger rows #13/#14 / arc §31: "what needs my attention?" Built
 * entirely from the SAME `orders` array `refreshCommerceMerchantOrdersList()`
 * already fetched via `commerceOrdersListIncoming()` — no second IPC
 * call, counts are a pure client-side derivation, never a second source
 * of truth for order state.
 */
const COMMERCE_ATTENTION_STATUS_LABELS: Readonly<Record<string, string>> = {
  submitted: "New order — awaiting your Accept/Reject",
  accepted: "Accepted — awaiting buyer payment",
  paid: "Paid — ready to fulfill",
  fulfilling: "Fulfilling — awaiting buyer's delivery confirmation",
};

function renderCommerceMerchantAttention(orders: readonly FedosCommerceOrder[]): void {
  const list = byId("commerce-merchant-attention-list");
  list.textContent = "";
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (!(order.status in COMMERCE_ATTENTION_STATUS_LABELS)) continue;
    counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  }
  const relevantStatuses = Object.keys(COMMERCE_ATTENTION_STATUS_LABELS).filter((status) => (counts.get(status) ?? 0) > 0);
  if (relevantStatuses.length === 0) {
    const li = document.createElement("li");
    li.className = "commerce-attention-empty";
    li.textContent = "Nothing needs your attention right now.";
    list.appendChild(li);
    return;
  }
  for (const status of relevantStatuses) {
    const li = document.createElement("li");
    const badge = document.createElement("span");
    badge.className = "commerce-attention-badge";
    badge.textContent = String(counts.get(status) ?? 0);
    li.appendChild(badge);
    li.appendChild(document.createTextNode(COMMERCE_ATTENTION_STATUS_LABELS[status] ?? status));
    list.appendChild(li);
  }
}

function renderCommerceMerchantOrdersList(orders: readonly FedosCommerceOrder[]): void {
  const list = byId("commerce-merchant-orders-list");
  list.textContent = "";
  renderCommerceMerchantAttention(orders);
  updateCommerceNavBadge("commerce-incoming-orders-badge", orders);
  if (orders.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No incoming orders yet.";
    list.appendChild(li);
    return;
  }
  for (const order of orders) list.appendChild(commerceMerchantOrderRow(order));
}

/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- same honest
 * sync-state tracking + "keep showing the last known information on a
 * failed refresh" discipline as `refreshCommerceMyOrdersList()` above; see
 * that function's own header.
 */
async function refreshCommerceMerchantOrdersList(): Promise<void> {
  commerceMerchantOrdersSyncTracker.begin();
  renderCommerceSyncStatus("commerce-merchant-orders-sync-status", commerceMerchantOrdersSyncTracker);
  const result = await runCommerceAction([], "commerce-merchant-orders-error", () => window.fedosApp.commerceOrdersListIncoming(commerceActingAsPubkey));
  const succeeded = result !== undefined && result.outcome === "ok";
  if (result !== undefined && !succeeded) showCommerceError("commerce-merchant-orders-error", result);
  const orders = succeeded ? result.orders ?? [] : [];
  commerceMerchantOrdersSyncTracker.complete(succeeded, Date.now());
  renderCommerceSyncStatus("commerce-merchant-orders-sync-status", commerceMerchantOrdersSyncTracker);
  if (succeeded || commerceMerchantOrdersCache === undefined) {
    commerceMerchantOrdersCache = orders;
  }
  renderCommerceMerchantOrdersList(commerceMerchantOrdersCache);
}

// Real Two-Party Commerce + UX P0/P1 Closure arc (coordinator merge note):
// Agent S wrote the merchant-role UI guard + the real `actorRole`-carrying
// `commerceProductCreate()` call (matching `handleCommerceProductCreate()`'s
// own new 3-argument signature, friction ledger row #2 P0). Agent U,
// without visibility into S's sibling worktree, wrapped a copy of the OLD
// 2-argument call in the general `runCommerceAction()` robustness helper
// (friction ledger row #21 / arc §22). Both are real and both are kept:
// S's guard/signature, U's disable-while-in-flight + error-catch wrapper.
async function onCommerceMerchantCreateSubmit(): Promise<void> {
  // Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
  // ledger row #2 P0: UI-level guard (fast, no IPC round trip) blocking
  // creation while the currently "Acting as" identity is not asserting a
  // merchant capacity. This is a UX convenience ONLY, not the real
  // enforcement boundary — `handleCommerceProductCreate()` always sends
  // this same `actorRole` explicitly, and `canCreateProduct()`
  // (`src/os/commerce/catalog/policy.ts`) is what actually, unbypassably
  // rejects a non-merchant actor at the domain layer. See those files'
  // own headers for the full rationale.
  const actorRole = commerceActorRole(commerceActingAsPubkey);
  if (actorRole !== "merchant") {
    showCommerceError("commerce-merchant-create-error", {
      outcome: "unauthorized-actor",
      reason: 'The identity currently selected in "Acting as" is not a merchant identity. Switch "Acting as" to a merchant identity (or your own real profile) before creating a product.',
    });
    return;
  }
  const priceCents = parseCommerceDecimalPriceToCents(byId<HTMLInputElement>("commerce-merchant-create-price").value);
  if (priceCents === null) {
    showCommerceError("commerce-merchant-create-error", { outcome: "invalid-input", reason: "Enter a valid price, e.g. 18.00" });
    return;
  }
  const title = byId<HTMLInputElement>("commerce-merchant-create-title").value;
  const description = byId<HTMLTextAreaElement>("commerce-merchant-create-description").value;
  const currency = byId<HTMLSelectElement>("commerce-merchant-create-currency").value;
  const result = await runCommerceAction(["commerce-merchant-create-submit"], "commerce-merchant-create-error", () =>
    window.fedosApp.commerceProductCreate(commerceActingAsPubkey, actorRole, {
      title,
      description: description.length > 0 ? description : undefined,
      priceCents,
      currency,
    }),
  );
  if (result === undefined) return;
  if (result.outcome !== "ok") {
    showCommerceError("commerce-merchant-create-error", result);
    return;
  }
  clearField("commerce-merchant-create-title");
  clearField("commerce-merchant-create-description");
  byId<HTMLInputElement>("commerce-merchant-create-price").value = "0.00";
  commerceUpdatePricePreview("commerce-merchant-create-price", "commerce-merchant-create-currency", "commerce-merchant-create-price-preview");
  void refreshCommerceMerchantProductsList();
}

async function refreshCommerceMerchantScreen(): Promise<void> {
  populateCommerceActorSelect("commerce-merchant-acting-as");
  onCommerceMerchantEditCancel();
  await Promise.all([
    refreshCommerceMerchantProductsList(),
    refreshCommerceMerchantOrdersList(),
    renderCommerceMerchantReputation(),
    refreshCommerceSellerActivitySummary(),
  ]);
}

/** FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent D) -- seller-role mirror of `refreshCommerceBuyerActivitySummary()` above. */
async function refreshCommerceSellerActivitySummary(): Promise<void> {
  const el = byId("commerce-merchant-orders-activity-summary");
  const result = await window.fedosApp.commerceActivitySummary(commerceActingAsPubkey);
  if (result.outcome !== "ok" || result.asSeller === undefined) {
    el.textContent = "";
    return;
  }
  const s = result.asSeller;
  const parts: string[] = [];
  if (s.newSubmitted > 0) parts.push(`${s.newSubmitted} new order(s) awaiting your accept/reject`);
  // FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- the
  // seller's own "which are unpaid?" bucket (`activity_summary.ts`'s newly
  // added `unpaid` field), previously answered only by the separate,
  // untested `renderCommerceMerchantAttention()` "Accepted — awaiting
  // buyer payment" line -- now also surfaced here, from the SAME tested
  // source of truth.
  if (s.unpaid > 0) parts.push(`${s.unpaid} unpaid (awaiting buyer payment)`);
  if (s.paidReadyToFulfill > 0) parts.push(`${s.paidReadyToFulfill} paid, ready to fulfill`);
  if (s.fulfillingInProgress > 0) parts.push(`${s.fulfillingInProgress} fulfilling`);
  if (s.completedAwaitingReceipt > 0) parts.push(`${s.completedAwaitingReceipt} completed, receipt not yet issued`);
  el.textContent = parts.length > 0 ? parts.join(" · ") : "Nothing needs your attention right now.";
}

// ---------------------------------------------------------------------
// Phase F — Search.
// ---------------------------------------------------------------------

async function onSearchSubmit(): Promise<void> {
  const query = byId<HTMLInputElement>("search-query").value;
  clearError("search-error");
  const list = byId("search-results");
  list.textContent = "";
  if (query.trim().length === 0) {
    byId("search-error").textContent = "Enter a search query.";
    return;
  }
  setBusy(true, "search-submit");
  try {
    const result = await window.fedosApp.search(query);
    if (result.outcome !== "ok") {
      showError("search-error", result);
      return;
    }
    const hits = (result.value as readonly { readonly conversationId: string; readonly messageId: string }[]) ?? [];
    if (hits.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No results.";
      list.appendChild(li);
      return;
    }
    for (const hit of hits) {
      const li = document.createElement("li");
      li.textContent = `Conversation ${hit.conversationId}`;
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.textContent = "Open conversation";
      openBtn.addEventListener("click", () => void openConversation(hit.conversationId));
      li.appendChild(openBtn);
      list.appendChild(li);
    }
  } finally {
    setBusy(false, "search-submit");
  }
}

// ---------------------------------------------------------------------
// Phase G — Archive.
// ---------------------------------------------------------------------

async function renderArchiveWarnings(elementId: string, operation: "inspect" | "preflightRestore" | "export" | "restore"): Promise<void> {
  const result = await window.fedosApp.archiveWorkflowWarnings(operation);
  if (result.outcome !== "ok") return;
  const warnings = (result.value as readonly { readonly text?: string }[]) ?? [];
  byId(elementId).textContent = warnings.map((w) => w.text ?? "").filter((t) => t.length > 0).join(" ");
}

async function onArchiveChooseExportDestination(): Promise<void> {
  const conversationId = byId<HTMLInputElement>("archive-export-conversation-id").value.trim();
  const result = await window.fedosApp.archiveChooseExportDestination(conversationId);
  if (result.outcome !== "ok" || result.path === undefined) {
    byId("archive-export-dest-label").textContent = "";
    archiveExportDestinationPath = null;
    byId<HTMLButtonElement>("archive-export-submit").disabled = true;
    return;
  }
  archiveExportDestinationPath = result.path;
  byId("archive-export-dest-label").textContent = `Destination: ${result.path}`;
  byId<HTMLButtonElement>("archive-export-submit").disabled = false;
}

async function onArchiveExportSubmit(): Promise<void> {
  clearError("archive-export-error");
  const conversationId = byId<HTMLInputElement>("archive-export-conversation-id").value.trim();
  if (conversationId.length === 0 || archiveExportDestinationPath === null) {
    byId("archive-export-error").textContent = "Choose a conversation and a destination first.";
    return;
  }
  const membershipResult = await window.fedosApp.membershipList(conversationId);
  if (membershipResult.outcome !== "ok") {
    showError("archive-export-error", membershipResult);
    return;
  }
  const view = membershipResult.value as { readonly memberships: readonly { readonly participant: { readonly publicIdentifier: string } }[] };
  const counterparty = view.memberships.find((m) => m.participant.publicIdentifier !== localAccountPublicIdentifier);
  if (counterparty === undefined) {
    byId("archive-export-error").textContent = "Could not determine the counterparty for this conversation.";
    return;
  }
  setBusy(true, "archive-export-submit");
  try {
    const result = await window.fedosApp.archiveExport({
      conversationId,
      destinationPath: archiveExportDestinationPath,
      localParticipant: { authority: "nostr", publicIdentifier: localAccountPublicIdentifier, identityId: null },
      localAccountIndex: 0,
      counterpartyPublicKeyHex: counterparty.participant.publicIdentifier,
      suite: "ChaCha20Poly1305",
    });
    if (result.outcome !== "ok") {
      showError("archive-export-error", result);
      return;
    }
    byId("archive-export-error").textContent = "";
    byId("archive-export-dest-label").textContent = "Export complete.";
  } finally {
    setBusy(false, "archive-export-submit");
  }
}

async function onArchiveChooseSource(): Promise<void> {
  const result = await window.fedosApp.archiveChooseSource();
  byId("archive-restore-manifest").textContent = "";
  if (result.outcome !== "ok" || result.path === undefined) {
    archiveRestoreSourcePath = null;
    byId("archive-restore-source-label").textContent = "";
    byId<HTMLButtonElement>("archive-restore-inspect").disabled = true;
    byId<HTMLButtonElement>("archive-restore-submit").disabled = true;
    return;
  }
  archiveRestoreSourcePath = result.path;
  byId("archive-restore-source-label").textContent = `Source: ${result.path}`;
  byId<HTMLButtonElement>("archive-restore-inspect").disabled = false;
}

async function onArchiveRestoreInspect(): Promise<void> {
  clearError("archive-restore-error");
  if (archiveRestoreSourcePath === null) return;
  const result = await window.fedosApp.archiveInspect(archiveRestoreSourcePath);
  if (result.outcome !== "ok") {
    showError("archive-restore-error", result);
    return;
  }
  const value = result.value as { readonly result: { readonly outcome: string; readonly manifest?: { readonly conversationId: string; readonly exportedAt: number; readonly membershipCount: number; readonly envelopeCount: number; readonly payloadCount: number } } };
  if (value.result.outcome !== "inspected" || value.result.manifest === undefined) {
    byId("archive-restore-manifest").textContent = "This archive could not be inspected.";
    byId<HTMLButtonElement>("archive-restore-submit").disabled = true;
    return;
  }
  const manifest = value.result.manifest;
  byId("archive-restore-manifest").textContent = `Conversation ${manifest.conversationId} – exported ${new Date(manifest.exportedAt * 1000).toLocaleString()} – ${manifest.membershipCount} membership(s), ${manifest.envelopeCount} message(s), ${manifest.payloadCount} payload(s).`;
  byId<HTMLButtonElement>("archive-restore-submit").disabled = false;
}

async function onArchiveRestoreSubmit(): Promise<void> {
  clearError("archive-restore-error");
  const counterparty = byId<HTMLInputElement>("archive-restore-counterparty").value.trim();
  if (archiveRestoreSourcePath === null || counterparty.length === 0) {
    byId("archive-restore-error").textContent = "Choose an archive file and enter the counterparty's public identifier.";
    return;
  }
  setBusy(true, "archive-restore-submit");
  try {
    const result = await window.fedosApp.archiveRestore({
      sourcePath: archiveRestoreSourcePath,
      localAccountIndex: 0,
      counterpartyPublicKeyHex: counterparty,
      suite: "ChaCha20Poly1305",
    });
    if (result.outcome !== "ok") {
      showError("archive-restore-error", result);
      return;
    }
    const value = result.value as { readonly result: { readonly outcome: string; readonly details?: { readonly [key: string]: unknown } } };
    byId("archive-restore-manifest").textContent = `Restore ${value.result.outcome}.`;
    await refreshConversationsList();
  } finally {
    setBusy(false, "archive-restore-submit");
  }
}

// ---------------------------------------------------------------------
// Phase H — Devices.
// ---------------------------------------------------------------------

async function refreshDevicesList(): Promise<void> {
  clearError("devices-error");
  const result = await window.fedosApp.devicesList();
  const list = byId("devices-list");
  list.textContent = "";
  if (result.outcome !== "ok") {
    showError("devices-error", result);
    return;
  }
  const devices = (result.value as readonly { readonly deviceId: string; readonly label: string | null; readonly trustState: string; readonly isLocal: boolean; readonly devicePublicKeyRef: string | null }[]) ?? [];
  if (devices.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No Devices registered yet.";
    list.appendChild(li);
    return;
  }
  for (const d of devices) {
    const li = document.createElement("li");
    const title = document.createElement("div");
    const glyph = d.trustState === "trusted" ? "✓" : d.trustState === "revoked" ? "✗" : "⚠";
    title.textContent = `${glyph} ${d.label ?? d.deviceId} ${d.isLocal ? "(this device)" : ""} – ${d.trustState}`;
    li.appendChild(title);
    if (!d.isLocal && d.trustState !== "revoked" && d.devicePublicKeyRef !== null) {
      const revokeBtn = document.createElement("button");
      revokeBtn.type = "button";
      revokeBtn.textContent = "Revoke";
      revokeBtn.addEventListener("click", () => void onDeviceRevoke(d.deviceId, d.devicePublicKeyRef as string, d.label ?? d.deviceId, revokeBtn));
      li.appendChild(revokeBtn);
    }
    list.appendChild(li);
  }
}

/**
 * Secure Runtime Alpha 8121-8200 -- Security Finding 2 (external audit
 * delta `6873d24f`): `revokeBtn` is disabled for the duration of the
 * request (mirrors `onChatSend()`'s own established `setBusy()`
 * discipline, applied directly to this dynamically-created button since
 * it has no static id `setBusy()` could look up). This is a UX guard
 * only -- the REAL, authoritative boundary remains the backend's own
 * idempotent revoke handling; disabling the button never substitutes for it.
 */
async function onDeviceRevoke(deviceId: string, devicePublicKeyHex: string, label: string, revokeBtn: HTMLButtonElement): Promise<void> {
  // Buyer Discovery + Digital Content Delivery mega-arc (post-report
  // follow-up fix): was `window.confirm()`, which blocks the renderer's
  // whole JS thread while it is open (see `confirmInPage()`'s header for
  // the live evidence from the Unpublish freeze this same fix closed).
  // Disabled first, so the guard covers the confirmation too.
  if (revokeBtn.disabled) return;
  revokeBtn.disabled = true;
  try {
    if (
      !(await confirmInPage(
        `Revoke "${label}"?`,
        "This removes its trust for future messages. It does not delete copies that Device already has.",
        "Yes, revoke this Device",
      ))
    ) {
      return;
    }
    const result = await window.fedosApp.deviceRevoke(deviceId, devicePublicKeyHex);
    if (result.outcome !== "ok") {
      showError("devices-error", result);
      return;
    }
    await refreshDevicesList();
  } finally {
    revokeBtn.disabled = false;
  }
}

// ---------------------------------------------------------------------
// Real Digital Delivery mega-arc (Agent U) — Device Sync inventory. Pure
// wiring over four already-real `FedosDesktopApplicationShell` reads
// (`deviceSyncStatus`/`syncSchedulesList`/`syncTransfersList`/
// `syncConflictsList`) this renderer never called before, plus one safe,
// closed-vocabulary conflict acknowledgement (`syncConflictAcknowledge`,
// never a generic "resolve"). Every row shown is this LOCAL account's own
// already-durable Sync fact -- never a cross-account Device discovery.
// ---------------------------------------------------------------------

async function refreshDeviceSyncInventory(): Promise<void> {
  clearError("device-sync-error");
  const statusResult = await window.fedosApp.deviceSyncStatus();
  const summaryEl = byId("device-sync-summary");
  if (statusResult.outcome !== "ok") {
    // `"unsupported"` is the real, expected outcome when this Runtime was
    // never configured with Device Sync at all (`config.deviceTrustEnabled`)
    // -- not an error the user needs to act on.
    summaryEl.textContent = statusResult.outcome === "unsupported" ? "Device Sync isn't enabled on this build." : "";
    if (statusResult.outcome !== "unsupported") showError("device-sync-error", statusResult);
    byId("device-sync-conflicts-list").textContent = "";
    byId("device-sync-schedules-list").textContent = "";
    byId("device-sync-transfers-list").textContent = "";
    return;
  }
  const status = statusResult.value as { readonly enabled: boolean; readonly running: boolean; readonly scheduleCount: number; readonly pendingCount: number; readonly inProgressCount: number; readonly completedCount: number; readonly failedCount: number; readonly operatorRequiredCount: number; readonly targetDeviceCount: number };
  summaryEl.textContent = status.enabled
    ? `Sync ${status.running ? "running" : "stopped"} — ${status.targetDeviceCount} device(s), ${status.pendingCount} pending, ${status.inProgressCount} in progress, ${status.completedCount} completed, ${status.failedCount} failed${status.operatorRequiredCount > 0 ? `, ${status.operatorRequiredCount} needing your review` : ""}.`
    : "Sync isn't enabled on this build.";
  await Promise.all([refreshDeviceSyncConflictsList(), refreshDeviceSyncSchedulesList(), refreshDeviceSyncTransfersList()]);
}

async function refreshDeviceSyncConflictsList(): Promise<void> {
  const list = byId("device-sync-conflicts-list");
  list.textContent = "";
  const result = await window.fedosApp.deviceSyncConflictsList(false);
  if (result.outcome !== "ok") return;
  const conflicts = (result.value as readonly { readonly conflictId: string; readonly conversationId: string; readonly conflictKind: string; readonly reason: string; readonly operatorRequired: boolean; readonly availableActions: readonly string[] }[]) ?? [];
  if (conflicts.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No unresolved Sync conflicts.";
    list.appendChild(li);
    return;
  }
  for (const c of conflicts) {
    const li = document.createElement("li");
    const title = document.createElement("div");
    title.textContent = `${c.operatorRequired ? "⚠ " : ""}${c.conflictKind} in conversation ${c.conversationId} — ${c.reason}`;
    li.appendChild(title);
    for (const action of c.availableActions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = SYNC_CONFLICT_ACTION_LABEL[action] ?? action;
      btn.addEventListener("click", () => void onSyncConflictAcknowledge(c.conflictId, action, btn));
      li.appendChild(btn);
    }
    list.appendChild(li);
  }
}

const SYNC_CONFLICT_ACTION_LABEL: Readonly<Record<string, string>> = {
  "accept-identical": "Accept (identical)",
  "discard-invalid": "Discard invalid copy",
  "refresh-missing-dependency": "Refresh missing data",
  acknowledge: "Acknowledge",
};

/** Every action here only updates THIS local account's own record of the conflict -- it never itself notifies or changes the other Device (mirrors the static copy above the list). Confirmed every time, matching `onDeviceRevoke()`'s own "state-changing local decision" discipline. */
async function onSyncConflictAcknowledge(conflictId: string, action: string, btn: HTMLButtonElement): Promise<void> {
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    if (
      !(await confirmInPage(
        `${SYNC_CONFLICT_ACTION_LABEL[action] ?? action}?`,
        "This updates only this Device's own local record of the conflict. It does not notify or change the other Device.",
        "Yes, continue",
      ))
    ) {
      return;
    }
    const result = await window.fedosApp.deviceSyncConflictAcknowledge(conflictId, action);
    if (result.outcome !== "ok") {
      showError("device-sync-error", result);
      return;
    }
    await refreshDeviceSyncConflictsList();
  } finally {
    btn.disabled = false;
  }
}

async function refreshDeviceSyncSchedulesList(): Promise<void> {
  const list = byId("device-sync-schedules-list");
  list.textContent = "";
  const result = await window.fedosApp.deviceSyncSchedulesList();
  if (result.outcome !== "ok") return;
  const schedules = (result.value as readonly { readonly scheduleId: string; readonly sourceDeviceId: string; readonly targetDeviceId: string; readonly state: string; readonly attemptCount: number; readonly lastCoarseOutcome: string | null }[]) ?? [];
  if (schedules.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No Sync schedule entries.";
    list.appendChild(li);
    return;
  }
  for (const s of schedules) {
    const li = document.createElement("li");
    li.textContent = `${s.sourceDeviceId} → ${s.targetDeviceId} — ${s.state} (${s.attemptCount} attempt(s))${s.lastCoarseOutcome !== null ? `, last outcome: ${s.lastCoarseOutcome}` : ""}`;
    list.appendChild(li);
  }
}

async function refreshDeviceSyncTransfersList(): Promise<void> {
  const list = byId("device-sync-transfers-list");
  list.textContent = "";
  const result = await window.fedosApp.deviceSyncTransfersList();
  if (result.outcome !== "ok") return;
  const sessions = (result.value as readonly { readonly transferSessionId: string; readonly sourceDeviceId: string; readonly targetDeviceId: string; readonly state: string; readonly relayAccepted: boolean; readonly deviceImported: boolean }[]) ?? [];
  if (sessions.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No Device transfer sessions.";
    list.appendChild(li);
    return;
  }
  for (const s of sessions) {
    const li = document.createElement("li");
    li.textContent = `${s.sourceDeviceId} → ${s.targetDeviceId} — ${s.state}${s.relayAccepted ? ", Relay accepted" : ""}${s.deviceImported ? ", imported by target Device" : ""}`;
    list.appendChild(li);
  }
}

// ---------------------------------------------------------------------
// Secure Runtime Alpha 8201-8280 (FedOS Desktop Closed-Beta Product Gap
// Closure and Final Polish Arc) — Device Pairing UI. Every method here
// calls the SAME `window.fedosApp.devicePairing*` channels that were
// already wired to the real `FedosDevicePairingFacade` in an earlier Arc
// but had no renderer caller (Phase A of this Arc's own reconciliation
// report, `docs/secure_runtime_alpha_8201_8280_phase_a_reconciliation_report.md`).
// No new IPC channel, no new crypto, no Device private key crosses this
// boundary -- the Joining Device's keypair is generated and held entirely
// in the Electron main process (`FedosDesktopApplicationShell`); this
// renderer only ever sees the bounded, public `encoded`/`encodedApproval`
// strings and a `pairingId`.
// ---------------------------------------------------------------------

/** Remembers this session's own in-process pairing id (Step 1 -> Step 3), mirroring the Shell's own "ephemeral, in-process bookkeeping only" discipline -- lost on restart by design, matching the underlying keypair's own lifetime. */
let pendingDevicePairingId: string | null = null;

async function onDevicePairingCreateSubmit(): Promise<void> {
  clearError("device-pairing-create-error");
  const deviceId = byId<HTMLInputElement>("device-pairing-create-label").value.trim();
  const expectedAccountPublicIdentifier = byId<HTMLInputElement>("device-pairing-create-account").value.trim();
  if (deviceId.length === 0) {
    byId("device-pairing-create-error").textContent = "Enter a Device ID first.";
    return;
  }
  if (expectedAccountPublicIdentifier.length === 0) {
    byId("device-pairing-create-error").textContent = "Enter the account you're joining first.";
    return;
  }
  setBusy(true, "device-pairing-create-submit");
  try {
    const result = await window.fedosApp.devicePairingCreate(deviceId, { authority: "nostr", publicIdentifier: expectedAccountPublicIdentifier });
    if (result.outcome !== "ok") {
      showError("device-pairing-create-error", result);
      byId("device-pairing-create-result").hidden = true;
      return;
    }
    const value = result.value as { readonly pairingId: string; readonly encoded: string };
    pendingDevicePairingId = value.pairingId;
    byId<HTMLTextAreaElement>("device-pairing-create-output").value = value.encoded;
    byId("device-pairing-create-expiry").textContent = `Device ID: ${deviceId} (pairing id ${value.pairingId})`;
    byId("device-pairing-create-copy-feedback").textContent = "";
    byId("device-pairing-create-result").hidden = false;
    byId<HTMLButtonElement>("device-pairing-complete-submit").disabled = false;
  } finally {
    setBusy(false, "device-pairing-create-submit");
  }
}

async function onDevicePairingCreateCopy(): Promise<void> {
  const text = byId<HTMLTextAreaElement>("device-pairing-create-output").value;
  try {
    await navigator.clipboard.writeText(text);
    byId("device-pairing-create-copy-feedback").textContent = "Copied.";
  } catch {
    byId("device-pairing-create-copy-feedback").textContent = "Could not copy automatically — select the text above and copy it manually.";
  }
}

async function onDevicePairingApproveInspect(): Promise<void> {
  clearError("device-pairing-approve-error");
  const encodedRequest = byId<HTMLTextAreaElement>("device-pairing-approve-input").value.trim();
  disarmDevicePairingApproveConfirm();
  byId<HTMLButtonElement>("device-pairing-approve-submit").disabled = true;
  byId("device-pairing-approve-inspection").textContent = "";
  if (encodedRequest.length === 0) {
    byId("device-pairing-approve-error").textContent = "Paste the pairing request first.";
    return;
  }
  setBusy(true, "device-pairing-approve-inspect");
  try {
    const result = await window.fedosApp.devicePairingInspect(encodedRequest);
    if (result.outcome !== "ok") {
      showError("device-pairing-approve-error", result);
      return;
    }
    const view = result.value as { readonly pairingId: string; readonly deviceId: string; readonly devicePublicKeyHex: string; readonly issuedAt: number; readonly expiresAt: number; readonly expired: boolean; readonly deviceProofValid: boolean };
    const issued = new Date(view.issuedAt * 1000).toLocaleString();
    const expires = new Date(view.expiresAt * 1000).toLocaleString();
    byId("device-pairing-approve-inspection").textContent =
      `Device ID: ${view.deviceId} · key ${view.devicePublicKeyHex.slice(0, 16)}… · issued ${issued} · expires ${expires}` +
      (view.expired ? " · EXPIRED" : "") +
      (view.deviceProofValid ? " · device proof valid" : " · device proof INVALID — do not approve");
    byId<HTMLButtonElement>("device-pairing-approve-submit").disabled = view.expired || !view.deviceProofValid;
  } finally {
    setBusy(false, "device-pairing-approve-inspect");
  }
}

/**
 * Secure Runtime Alpha 8201-8280 -- deliberately NOT `window.confirm()`: a
 * native JS dialog in Electron blocks the renderer's own event loop on a
 * synchronous main-process round-trip with no programmatic way to answer
 * it, which this Arc's own real visible-control test discovered hangs
 * indefinitely under scripted/automated control. A real inline two-step
 * confirmation (this function arms it; `onDevicePairingApproveConfirm()`/
 * `onDevicePairingApproveCancel()` resolve it) gives the identical
 * "explain the effect, require a second explicit action" guarantee while
 * remaining fully driven by ordinary DOM clicks -- more accessible than a
 * native dialog too, and consistent with this file's other multi-step
 * confirmations (Archive restore, Signed Deletion) rather than a one-off
 * native-dialog pattern.
 */
function armDevicePairingApproveConfirm(): void {
  byId("device-pairing-approve-confirm-explain").hidden = false;
  byId<HTMLButtonElement>("device-pairing-approve-confirm").hidden = false;
  byId<HTMLButtonElement>("device-pairing-approve-cancel").hidden = false;
  byId<HTMLButtonElement>("device-pairing-approve-submit").hidden = true;
}

function disarmDevicePairingApproveConfirm(): void {
  byId("device-pairing-approve-confirm-explain").hidden = true;
  byId<HTMLButtonElement>("device-pairing-approve-confirm").hidden = true;
  byId<HTMLButtonElement>("device-pairing-approve-cancel").hidden = true;
  byId<HTMLButtonElement>("device-pairing-approve-submit").hidden = false;
}

function onDevicePairingApproveCancel(): void {
  disarmDevicePairingApproveConfirm();
}

async function onDevicePairingApproveConfirm(): Promise<void> {
  clearError("device-pairing-approve-error");
  const encodedRequest = byId<HTMLTextAreaElement>("device-pairing-approve-input").value.trim();
  if (encodedRequest.length === 0) {
    disarmDevicePairingApproveConfirm();
    return;
  }
  const confirmBtn = byId<HTMLButtonElement>("device-pairing-approve-confirm");
  if (confirmBtn.disabled) return;
  confirmBtn.disabled = true;
  byId<HTMLButtonElement>("device-pairing-approve-cancel").disabled = true;
  setBusy(true, "device-pairing-approve-inspect");
  try {
    const result = await window.fedosApp.devicePairingApprove(encodedRequest);
    if (result.outcome !== "ok") {
      showError("device-pairing-approve-error", result);
      return;
    }
    const value = result.value as { readonly encoded: string; readonly localRegistration: string };
    byId<HTMLTextAreaElement>("device-pairing-approve-output").value = value.encoded;
    byId("device-pairing-approve-copy-feedback").textContent = "";
    byId("device-pairing-approve-result").hidden = false;
    await refreshDevicesList();
  } finally {
    confirmBtn.disabled = false;
    byId<HTMLButtonElement>("device-pairing-approve-cancel").disabled = false;
    // Consumed regardless of outcome on success (single-use approval, matches the underlying facade's own "no re-approving the same request" reality); collapses the confirm affordance back either way so a failure leaves the user able to try again from Inspect.
    disarmDevicePairingApproveConfirm();
    setBusy(false, "device-pairing-approve-inspect");
  }
}

async function onDevicePairingApproveCopy(): Promise<void> {
  const text = byId<HTMLTextAreaElement>("device-pairing-approve-output").value;
  try {
    await navigator.clipboard.writeText(text);
    byId("device-pairing-approve-copy-feedback").textContent = "Copied.";
  } catch {
    byId("device-pairing-approve-copy-feedback").textContent = "Could not copy automatically — select the text above and copy it manually.";
  }
}

async function onDevicePairingCompleteSubmit(): Promise<void> {
  clearError("device-pairing-complete-error");
  const encodedApproval = byId<HTMLTextAreaElement>("device-pairing-complete-input").value.trim();
  if (pendingDevicePairingId === null) {
    byId("device-pairing-complete-error").textContent = "Create a pairing request on this Device first (Step 1).";
    return;
  }
  if (encodedApproval.length === 0) {
    byId("device-pairing-complete-error").textContent = "Paste the approval from the other Device first.";
    return;
  }
  setBusy(true, "device-pairing-complete-submit");
  try {
    const result = await window.fedosApp.devicePairingComplete(pendingDevicePairingId, encodedApproval);
    if (result.outcome !== "ok") {
      showError("device-pairing-complete-error", result);
      return;
    }
    const view = result.value as { readonly deviceId: string; readonly trustState: string };
    byId("device-pairing-complete-result").textContent = `Pairing complete — "${view.deviceId}" is now ${view.trustState}.`;
    pendingDevicePairingId = null;
    byId<HTMLButtonElement>("device-pairing-complete-submit").disabled = true;
    byId<HTMLTextAreaElement>("device-pairing-complete-input").value = "";
    await refreshDevicesList();
  } finally {
    setBusy(false, "device-pairing-complete-submit");
  }
}

// ---------------------------------------------------------------------
// Phase K — Safety Center (with Phase I/J Identity Replacement / Signed
// Deletion inboxes nested inside, per this Arc's own Phase B recommendation).
// ---------------------------------------------------------------------

const SAFETY_SECTION_GLYPH: Readonly<Record<string, string>> = {
  ready: "✓",
  loading: "…",
  unavailable: "–",
  attention: "⚠",
  warning: "⚠",
  blocked: "✗",
  error: "✗",
};

async function refreshSafetyCenter(): Promise<void> {
  clearError("safety-error");
  const result = await window.fedosApp.safetyCenterOverview();
  const list = byId("safety-sections");
  list.textContent = "";
  if (result.outcome !== "ok") {
    showError("safety-error", result);
    return;
  }
  const overview = (result.value as { readonly summary: { readonly sections: readonly { readonly section: string; readonly state: string; readonly reason: string | null }[] }; readonly standingWarnings: readonly { readonly text: string }[] });
  for (const s of overview.summary.sections) {
    const li = document.createElement("li");
    const glyph = SAFETY_SECTION_GLYPH[s.state] ?? "–";
    li.textContent = `${glyph} ${s.section}: ${s.state}${s.reason !== null ? ` – ${s.reason}` : ""}`;
    list.appendChild(li);
  }
  for (const w of overview.standingWarnings) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = w.text;
    list.appendChild(li);
  }
}

const IDENTITY_ACCEPTANCE_GLYPH: Readonly<Record<string, string>> = {
  observed: "⚠",
  "structurally-valid": "⚠",
  "proof-verified": "⚠",
  corroborated: "⚠",
  "manual-review-required": "⚠",
  accepted: "✓",
  rejected: "✗",
  conflicting: "✗",
  superseded: "–",
};

async function refreshIdentityTransitionList(): Promise<void> {
  const result = await window.fedosApp.identityTransitionList();
  const list = byId("identity-transition-list");
  list.textContent = "";
  byId("identity-transition-detail").textContent = "";
  if (result.outcome !== "ok") return;
  const items =
    (result.value as readonly {
      readonly transitionId: string;
      readonly acceptanceState: string;
      readonly openable: boolean;
      readonly peerAccountRef: unknown;
      readonly peerDeviceRef: string | null;
      // FedOS Commerce Product-Media Sync + Truthful Completion mega-arc,
      // Wave A (Agent S) — Task 1: old-key continuity auto-accept
      // visibility recovery. Visibility only -- no policy change.
      readonly silentlyAutoAcceptedWithoutAsking?: boolean;
    }[]) ?? [];
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No pending Identity Replacement items.";
    list.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    const glyph = item.silentlyAutoAcceptedWithoutAsking === true ? "⚠✓" : (IDENTITY_ACCEPTANCE_GLYPH[item.acceptanceState] ?? "–");
    li.textContent = `${glyph} Transition ${item.transitionId} – ${item.acceptanceState}`;
    if (item.silentlyAutoAcceptedWithoutAsking === true) {
      const autoAcceptNote = document.createElement("span");
      autoAcceptNote.className = "warn";
      autoAcceptNote.textContent = " — accepted automatically, you were not asked";
      li.appendChild(autoAcceptNote);
    }
    if (item.openable && item.peerDeviceRef !== null) {
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.textContent = "Review";
      openBtn.addEventListener("click", () => void openIdentityTransition(item.peerAccountRef, item.peerDeviceRef as string, item.transitionId));
      li.appendChild(openBtn);
    } else {
      const note = document.createElement("span");
      note.className = "muted";
      note.textContent = " (no known Device evidence to open yet)";
      li.appendChild(note);
    }
    list.appendChild(li);
  }
}

async function openIdentityTransition(peerAccountRef: unknown, peerDeviceRef: string, transitionId: string): Promise<void> {
  currentIdentityTransitionSelection = { peerAccountRef, peerDeviceRef, transitionId };
  const result = await window.fedosApp.identityTransitionOpen(peerAccountRef, peerDeviceRef, transitionId);
  renderIdentityTransitionDetail(result, { peerAccountRef, peerDeviceRef, transitionId });
}

/**
 * Secure Runtime Alpha 8121-8200 -- Security Finding 3 (`6873d24f`):
 * `target` is captured HERE, once, from the exact `openIdentityTransition()`
 * call that produced this render, and closed over by each button below --
 * never re-read from the shared, mutable `currentIdentityTransitionSelection`
 * at click time. If the user opens a DIFFERENT item while this render's
 * own decision is still in flight, `currentIdentityTransitionSelection`
 * may change, but these buttons' own closures cannot: a click always
 * decides the item that was actually on screen when it was clicked.
 */
function renderIdentityTransitionDetail(
  result: { readonly outcome: string; readonly value?: unknown; readonly reason?: string },
  target: { readonly peerAccountRef: unknown; readonly peerDeviceRef: string; readonly transitionId: string },
): void {
  const container = byId("identity-transition-detail");
  container.textContent = "";
  if (result.outcome !== "ok") {
    container.textContent = describeOutcome(result.outcome);
    return;
  }
  const detail = result.value as {
    readonly transitionId: string;
    readonly oldAccountIdentity: { readonly publicIdentifier: string };
    readonly newAccountIdentity: { readonly publicIdentifier: string };
    readonly evidenceOutcome: string;
    readonly acceptanceState: string;
    readonly oldKeyOnlyInsufficientWarning: boolean;
    // FedOS Commerce Product-Media Sync + Truthful Completion mega-arc,
    // Wave A (Agent S) — Task 1: old-key continuity auto-accept
    // visibility recovery. Visibility only -- no policy change.
    readonly silentlyAutoAcceptedWithoutAsking: boolean;
    readonly warningText: readonly string[];
  };
  const summary = document.createElement("p");
  summary.textContent = `Old identity: ${detail.oldAccountIdentity.publicIdentifier}`;
  container.appendChild(summary);
  const summary2 = document.createElement("p");
  summary2.textContent = `New identity: ${detail.newAccountIdentity.publicIdentifier}`;
  container.appendChild(summary2);
  const evidence = document.createElement("p");
  evidence.className = "muted";
  evidence.textContent = `Evidence: ${detail.evidenceOutcome}. Current state: ${detail.acceptanceState}.`;
  container.appendChild(evidence);
  if (detail.oldKeyOnlyInsufficientWarning) {
    const warn = document.createElement("p");
    warn.className = "warn";
    warn.textContent = "The old identity's signature alone is not treated as sufficient here — manual verification is recommended before accepting.";
    container.appendChild(warn);
  }
  if (detail.silentlyAutoAcceptedWithoutAsking) {
    const autoAcceptWarn = document.createElement("p");
    autoAcceptWarn.className = "warn";
    autoAcceptWarn.id = "identity-transition-auto-accepted-warning";
    autoAcceptWarn.textContent =
      "FedOS accepted this identity replacement automatically because it was signed with your contact's previous key — nobody was asked to confirm it first. Consider confirming with this contact through another channel that they really did replace their identity.";
    container.appendChild(autoAcceptWarn);
  }
  for (const text of detail.warningText) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = text;
    container.appendChild(p);
  }
  const acceptBtn = document.createElement("button");
  acceptBtn.type = "button";
  acceptBtn.textContent = "Accept";
  const rejectBtn = document.createElement("button");
  rejectBtn.type = "button";
  rejectBtn.textContent = "Reject";
  const deferBtn = document.createElement("button");
  deferBtn.type = "button";
  deferBtn.textContent = "Defer";
  // Secure Runtime Alpha 8121-8200 -- Security Finding 2: all three
  // buttons are disabled together while ANY one decision on this item is
  // in flight (they are mutually exclusive actions on the SAME item, a
  // rapid click on a different one is exactly as much a double-submit
  // risk as clicking the same one twice). UX guard only -- the real
  // boundary is the Controller's own `#actionInFlight` (Security Finding 3).
  const decisionButtons = [acceptBtn, rejectBtn, deferBtn];
  acceptBtn.addEventListener("click", () => void decideIdentityTransition("accept", target, decisionButtons));
  rejectBtn.addEventListener("click", () => void decideIdentityTransition("reject", target, decisionButtons));
  deferBtn.addEventListener("click", () => void decideIdentityTransition("defer", target, decisionButtons));
  container.appendChild(acceptBtn);
  container.appendChild(rejectBtn);
  container.appendChild(deferBtn);
}

async function decideIdentityTransition(
  decision: "accept" | "reject" | "defer",
  target: { readonly peerAccountRef: unknown; readonly peerDeviceRef: string; readonly transitionId: string },
  decisionButtons: readonly HTMLButtonElement[],
): Promise<void> {
  // Buyer Discovery + Digital Content Delivery mega-arc (post-report
  // follow-up fix): was `window.confirm()` -- see `confirmInPage()`.
  if (decisionButtons.some((b) => b.disabled)) return;
  for (const b of decisionButtons) b.disabled = true;
  try {
    if (
      decision === "accept" &&
      !(await confirmInPage(
        "Accept this new identity?",
        "This is a trust decision you make yourself — it cannot be undone automatically.",
        "Yes, accept this identity",
      ))
    ) {
      return;
    }
    const result =
      decision === "accept"
        ? await window.fedosApp.identityTransitionAccept(target.peerAccountRef, target.peerDeviceRef, target.transitionId)
        : decision === "reject"
          ? await window.fedosApp.identityTransitionReject(target.peerAccountRef, target.peerDeviceRef, target.transitionId)
          : await window.fedosApp.identityTransitionDefer(target.peerAccountRef, target.peerDeviceRef, target.transitionId);
    // Only re-render the detail view if `target` is STILL what's selected --
    // a decision made on an item the user has since navigated away from
    // must never clobber a newer item's own detail view.
    if (
      currentIdentityTransitionSelection !== null &&
      currentIdentityTransitionSelection.transitionId === target.transitionId &&
      currentIdentityTransitionSelection.peerDeviceRef === target.peerDeviceRef
    ) {
      renderIdentityTransitionDetail(result, target);
    }
    await refreshIdentityTransitionList();
    // Real Digital Delivery mega-arc (Agent U) -- Identity Replacement
    // Ratchet-reset. Runs ONLY after Accept itself already succeeded (never
    // on reject/defer, and never if Accept itself failed) -- the decision
    // buttons stay disabled for this WHOLE follow-up sequence too (still
    // inside this same try/finally), mirroring this function's own
    // existing disable-for-the-duration discipline.
    if (decision === "accept" && result.outcome === "ok") {
      await runIdentityTransitionRatchetResetFlow(target);
    }
  } finally {
    for (const b of decisionButtons) b.disabled = false;
  }
}

/**
 * Real Digital Delivery mega-arc (Agent U) -- Identity Replacement
 * Ratchet-reset confirmation. Step 1 (`identityTransitionAssessContinuity`)
 * is read-only and always safe to call. Step 2
 * (`identityTransitionAuthorizeRatchetReset`) is the ONE call that actually
 * resets a Ratchet session, and is called ONLY after a SECOND explicit
 * `confirmInPage()` confirmation -- cancelling it means step 2 is never
 * called at all (negative path: cancel -> no reset).
 *
 * Plain language only: this screen never requires the reader to already
 * know "ratchet"/"key epoch"/"continuity proof" -- the body is built from
 * `assessContinuity()`'s own already-plain `warningText`
 * (`fedosIdentityTransitionWarningText()`'s own strings, e.g. "A brand-new
 * secure session must be established...", never the word "ratchet" itself)
 * plus one plain count sentence this function adds.
 *
 * If nothing live actually needs a reset (`sessions.length === 0`) or the
 * transition somehow isn't `canAuthorize` yet, this returns silently --
 * never an empty/confusing confirmation screen for nothing.
 */
async function runIdentityTransitionRatchetResetFlow(target: { readonly peerAccountRef: unknown; readonly peerDeviceRef: string; readonly transitionId: string }): Promise<void> {
  const assessResult = await window.fedosApp.identityTransitionAssessContinuity(target.peerAccountRef, target.peerDeviceRef, target.transitionId);
  if (assessResult.outcome !== "ok") return;
  const content = assessResult.value as {
    readonly canAuthorize: boolean;
    readonly sessions: readonly { readonly conversationId: string; readonly remoteDeviceRef: string; readonly currentStatus: string; readonly resetRecommended: boolean }[];
    readonly warningText: readonly string[];
  };
  if (!content.canAuthorize || content.sessions.length === 0) return;
  const countSentence = content.sessions.length === 1 ? "1 existing conversation with this contact will start a new secure session automatically." : `${content.sessions.length} existing conversations with this contact will start a new secure session automatically.`;
  const confirmed = await confirmInPage("Start new secure sessions?", [countSentence, ...content.warningText].join(" "), "Yes, start new secure sessions");
  if (!confirmed) return;
  await window.fedosApp.identityTransitionAuthorizeRatchetReset(target.peerAccountRef, target.peerDeviceRef, target.transitionId);
}

const DELETION_WARNING_TEXT: Readonly<Record<string, string>> = {
  "recipient-may-reject": "This asks the recipient to remove a local copy. The recipient may reject the request.",
  "other-devices-may-retain": "Other Devices belonging to the recipient may retain a copy.",
  "archive-backup-may-remain": "Archives and backups may still contain this message even if the request is applied.",
  "relay-ciphertext-may-remain": "Encrypted copies on Relays are not deleted by this request.",
  "external-copies-unverifiable": "Screenshots, exports, notifications, or copies made outside FedOS cannot be verified or affected.",
  "not-physical-erasure-proof": "An acknowledgement is a Device's own signed claim, not proof of physical erasure.",
};

async function refreshDeletionRequestList(): Promise<void> {
  const result = await window.fedosApp.deletionRequestListReceived();
  const list = byId("deletion-request-list");
  list.textContent = "";
  byId("deletion-request-detail").textContent = "";
  if (result.outcome !== "ok") return;
  const items = (result.value as readonly { readonly requestId: string; readonly requesterAccountRef: string; readonly displayStatus: string }[]) ?? [];
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No Signed Deletion requests.";
    list.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = `Request from ${item.requesterAccountRef} – ${item.displayStatus}`;
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Review";
    openBtn.addEventListener("click", () => void openDeletionRequest(item.requestId));
    li.appendChild(openBtn);
    list.appendChild(li);
  }
}

async function openDeletionRequest(requestId: string): Promise<void> {
  currentDeletionRequestId = requestId;
  const result = await window.fedosApp.deletionRequestOpen(requestId);
  renderDeletionRequestDetail(result, requestId);
}

/** Secure Runtime Alpha 8121-8200 -- Security Finding 3: `targetRequestId` is captured from the exact `openDeletionRequest()` call that produced this render and closed over by the buttons below -- mirrors `renderIdentityTransitionDetail()`'s own reasoning exactly. */
function renderDeletionRequestDetail(result: { readonly outcome: string; readonly value?: unknown }, targetRequestId: string): void {
  const container = byId("deletion-request-detail");
  container.textContent = "";
  if (result.outcome !== "ok") {
    container.textContent = describeOutcome(result.outcome);
    return;
  }
  const detail = result.value as {
    readonly requesterAccountRef: string;
    readonly conversationId: string;
    readonly requestedScope: string;
    readonly decisionState: string;
    readonly isTerminal: boolean;
    readonly warnings: readonly string[];
  };
  const p1 = document.createElement("p");
  p1.textContent = `Requested by: ${detail.requesterAccountRef}`;
  container.appendChild(p1);
  const p2 = document.createElement("p");
  p2.className = "muted";
  p2.textContent = `Conversation ${detail.conversationId} – scope: ${detail.requestedScope} – status: ${detail.decisionState}`;
  container.appendChild(p2);
  for (const code of detail.warnings) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = DELETION_WARNING_TEXT[code] ?? code;
    container.appendChild(p);
  }
  if (!detail.isTerminal) {
    const approveBtn = document.createElement("button");
    approveBtn.type = "button";
    approveBtn.textContent = "Approve";
    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.textContent = "Reject";
    // Secure Runtime Alpha 8121-8200 -- Security Finding 2: both buttons
    // disabled together while either decision is in flight -- mirrors
    // `decideIdentityTransition()`'s own reasoning exactly.
    const decisionButtons = [approveBtn, rejectBtn];
    approveBtn.addEventListener("click", () => void decideDeletionRequest("approve", targetRequestId, decisionButtons));
    rejectBtn.addEventListener("click", () => void decideDeletionRequest("reject", targetRequestId, decisionButtons));
    container.appendChild(approveBtn);
    container.appendChild(rejectBtn);
  }
}

async function decideDeletionRequest(decision: "approve" | "reject", targetRequestId: string, decisionButtons: readonly HTMLButtonElement[]): Promise<void> {
  // Buyer Discovery + Digital Content Delivery mega-arc (post-report
  // follow-up fix): was `window.confirm()` -- see `confirmInPage()`.
  if (decisionButtons.some((b) => b.disabled)) return;
  for (const b of decisionButtons) b.disabled = true;
  try {
    if (
      decision === "approve" &&
      !(await confirmInPage(
        "Approve this deletion request?",
        "This never guarantees removal everywhere — see the warnings above.",
        "Yes, approve this deletion request",
      ))
    ) {
      return;
    }
    await (decision === "approve" ? window.fedosApp.deletionRequestApprove(targetRequestId) : window.fedosApp.deletionRequestReject(targetRequestId));
    // Only clear the detail view if `targetRequestId` is STILL what's open --
    // mirrors `decideIdentityTransition()`'s own reasoning.
    if (currentDeletionRequestId === targetRequestId) {
      byId("deletion-request-detail").textContent = "";
    }
    await refreshDeletionRequestList();
  } finally {
    for (const b of decisionButtons) b.disabled = false;
  }
}

// ---------------------------------------------------------------------
// Phase C — Settings (Relay list + preferences).
// ---------------------------------------------------------------------

interface SettingsDescriptor {
  readonly schemaVersion: 1;
  readonly theme: string;
  readonly language: string;
  readonly relays: readonly string[];
  readonly defaultRelay: string;
  readonly notificationsEnabled: boolean;
  readonly backgroundSyncEnabled: boolean;
  readonly archiveDirectory: string;
  readonly autoStart: boolean;
  readonly autoLockTimeoutMinutes: number;
  readonly windowLayout: string;
}

let settingsWorkingCopy: SettingsDescriptor | null = null;

function isValidRelayUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "ws:" || url.protocol === "wss:";
  } catch {
    return false;
  }
}

function renderSettingsForm(): void {
  if (settingsWorkingCopy === null) return;
  const s = settingsWorkingCopy;
  byId<HTMLSelectElement>("settings-theme").value = s.theme;
  byId<HTMLSelectElement>("settings-language").value = s.language;
  byId<HTMLInputElement>("settings-notifications").checked = s.notificationsEnabled;
  byId<HTMLInputElement>("settings-background-sync").checked = s.backgroundSyncEnabled;

  const relayContainer = byId("settings-relay-list");
  relayContainer.textContent = "";
  for (const relay of s.relays) {
    const row = document.createElement("div");
    row.className = "relay-row";
    const span = document.createElement("span");
    span.textContent = relay;
    row.appendChild(span);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.setAttribute("aria-label", `Remove Relay ${relay}`);
    removeBtn.addEventListener("click", () => {
      if (settingsWorkingCopy === null) return;
      settingsWorkingCopy = {
        ...settingsWorkingCopy,
        relays: settingsWorkingCopy.relays.filter((r) => r !== relay),
        defaultRelay: settingsWorkingCopy.defaultRelay === relay ? "" : settingsWorkingCopy.defaultRelay,
      };
      renderSettingsForm();
    });
    row.appendChild(removeBtn);
    relayContainer.appendChild(row);
  }

  const defaultSelect = byId<HTMLSelectElement>("settings-default-relay");
  defaultSelect.textContent = "";
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "(none)";
  defaultSelect.appendChild(noneOpt);
  for (const relay of s.relays) {
    const opt = document.createElement("option");
    opt.value = relay;
    opt.textContent = relay;
    defaultSelect.appendChild(opt);
  }
  defaultSelect.value = s.defaultRelay;
}

/** Reloads the working copy from disk without touching `#settings-report`/`#settings-error` -- used by `onSettingsSave()` right after it sets its OWN save-outcome message, so that message is never immediately wiped by this reload. */
async function reloadSettingsData(): Promise<void> {
  const result = await window.fedosApp.settingsLoad();
  if (result.outcome !== "ok") {
    showError("settings-error", result);
    return;
  }
  settingsWorkingCopy = result.value as SettingsDescriptor;
  renderSettingsForm();
}

/**
 * Public Relay Reliability + Gift-Wrap Subscription Narrowing arc --
 * Tor Security UI (mandate section 17-22). Reads `FedosStrictTransportPolicy`'s
 * own real, live state via `torTransportState()` (`fedos-app:tor-transport-state`,
 * added by the prior arc's own backend-only pass) -- never a cached or
 * derived copy, never persisted across restart (mandate section 22: "no
 * persisted false Ready"). A genuine live IPC call every time the
 * Settings screen is opened, matching this codebase's own established
 * "no push/poll, explicit refresh" convention (see the Commerce Orders
 * refresh functions immediately below) rather than adding a new
 * background polling loop -- disclosed limitation: does not
 * auto-refresh while the user stays parked on this screen without
 * re-entering it.
 */
async function refreshTorTransportStatus(): Promise<void> {
  const el = byId("settings-tor-status");
  const result = await window.fedosApp.torTransportState();
  if (result.outcome !== "ok") {
    el.textContent = "Tor transport: status unavailable";
    return;
  }
  const value = result.value as { readonly enabled: boolean; readonly state: "disabled" | "starting" | "ready" | "degraded" | "failed-closed" };
  if (!value.enabled || value.state === "disabled") {
    el.textContent = "Tor transport: Off";
    return;
  }
  // Mandate section 17/20: only these four truthful labels -- never
  // "Anonymous"/"Untraceable"/"Invisible"/"Fully private" anywhere.
  const label: Record<"starting" | "ready" | "degraded" | "failed-closed", string> = {
    starting: "Starting — network traffic is blocked until Tor is ready",
    ready: "Ready — network traffic is routed through Tor",
    degraded: "Recovering — Tor was ready and is re-checking now; traffic stays blocked",
    "failed-closed": "Unavailable — Tor is not ready; network traffic is blocked (no direct fallback)",
  };
  el.textContent = `Tor transport: ${label[value.state]}`;
}

async function refreshSettings(): Promise<void> {
  clearError("settings-error");
  byId("settings-report").textContent = "";
  await reloadSettingsData();
  await refreshCommerceNetworkProfile();
  await refreshTorTransportStatus();
}

// ---------------------------------------------------------------------
// FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's minimal
// NetworkProfile Settings surface. Deliberately independent of
// `SettingsDescriptor`/`onSettingsSave()` above -- this is in-memory,
// per-process main-process state (see `commerceNetworkProfile`'s own doc
// comment in `fedos_electron_beta_main.cts`), not part of the persisted
// Settings file, so it gets its own small load/save pair rather than
// folding into the existing Settings save flow.
// ---------------------------------------------------------------------

async function refreshCommerceNetworkProfile(): Promise<void> {
  // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 21
  // robustness sweep, applied here too (this is a Commerce IPC call site
  // like any other); the underlying Network Profile feature/copy itself
  // remains Agent N's own territory, untouched beyond this wrapper.
  const result = await runCommerceAction([], "commerce-network-profile-error", () => window.fedosApp.commerceNetworkProfileGet());
  if (result === undefined) return;
  if (result.outcome !== "ok" || result.profile === undefined) {
    showError("commerce-network-profile-error", result);
    return;
  }
  byId<HTMLSelectElement>("commerce-network-profile-select").value = result.profile;
  // Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
  // keep the Shop/My Store mode banners' cached value current whenever
  // this screen re-fetches it too, rather than only at Ready.
  commerceNetworkProfileCache = result.profile;
  renderCommerceCatalogModeBanner();
}

async function onCommerceNetworkProfileSave(): Promise<void> {
  byId("commerce-network-profile-report").textContent = "";
  const value = byId<HTMLSelectElement>("commerce-network-profile-select").value as FedosCommerceNetworkProfile;
  const result = await runCommerceAction(["commerce-network-profile-save"], "commerce-network-profile-error", () => window.fedosApp.commerceNetworkProfileSet(value));
  if (result === undefined) return;
  if (result.outcome !== "ok") {
    showError("commerce-network-profile-error", result);
    return;
  }
  // Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
  // durability fix: this now actually persists (`persistCommerceNetworkProfile()`,
  // `fedos_electron_beta_main.cts`) -- the previous "resets to Local Only
  // on the next launch" copy here was accurate for the OLD in-memory-only
  // behavior and would now be a false claim.
  byId("commerce-network-profile-report").textContent = "Saved — this choice will still be in effect the next time you launch FedOS.";
  if (result.profile !== undefined) commerceNetworkProfileCache = result.profile;
  renderCommerceCatalogModeBanner();
}

function onSettingsRelayAdd(): void {
  clearError("settings-relay-error");
  const input = byId<HTMLInputElement>("settings-relay-new");
  const value = input.value.trim();
  if (value.length === 0) return;
  if (!isValidRelayUrl(value)) {
    byId("settings-relay-error").textContent = "Enter a valid ws:// or wss:// Relay URL.";
    return;
  }
  if (settingsWorkingCopy === null) return;
  if (settingsWorkingCopy.relays.includes(value)) {
    byId("settings-relay-error").textContent = "This Relay is already in your list.";
    return;
  }
  settingsWorkingCopy = { ...settingsWorkingCopy, relays: [...settingsWorkingCopy.relays, value] };
  input.value = "";
  renderSettingsForm();
}

async function onSettingsSave(): Promise<void> {
  clearError("settings-error");
  if (settingsWorkingCopy === null) return;
  const candidate: SettingsDescriptor = {
    ...settingsWorkingCopy,
    theme: byId<HTMLSelectElement>("settings-theme").value,
    language: byId<HTMLSelectElement>("settings-language").value,
    defaultRelay: byId<HTMLSelectElement>("settings-default-relay").value,
    notificationsEnabled: byId<HTMLInputElement>("settings-notifications").checked,
    backgroundSyncEnabled: byId<HTMLInputElement>("settings-background-sync").checked,
  };
  setBusy(true, "settings-save");
  try {
    const report = (await window.fedosBeta.settingsApply(candidate)) as { readonly outcome: string; readonly reason: string };
    // Public Beta Final Readiness Arc -- the backend genuinely persists
    // `language` (candidate.language above) even though this Beta build's
    // interface text stays English-only regardless of the value chosen
    // (no translation layer exists yet). Without this, a plain "Saved."
    // after picking a non-English language reads as if the interface
    // itself was about to change -- a real "persisted, but the change is
    // blocked from having any visible effect" display bug, not merely an
    // undisclosed limitation.
    const languageNote = candidate.language !== "en" ? " Your language preference is saved, but this Beta's interface text stays English-only — it does not change what you see." : "";
    if (report.outcome === "persisted-pending-runtime-restart" || report.outcome === "persisted-pending-application-restart") {
      byId("settings-report").textContent = `Saved. Restart the application for Relay changes to take effect.${languageNote}`;
    } else if (report.outcome === "persisted-and-applied" || report.outcome === "no-change") {
      byId("settings-report").textContent = `Saved.${languageNote}`;
    } else if (report.outcome === "persisted-but-blocked") {
      // Secure Runtime Alpha 8441-8520 -- real, currently-reproducible bug
      // found by an independent Go/No-Go revalidation (review
      // d6cb95d0), confirmed by direct source reading: a save touching
      // ONLY a field with no accepted application boundary (today:
      // language, auto-start, auto-lock -- see SettingsDescriptor)
      // reaches this outcome, which fell through to the generic error
      // branch below even though the save genuinely SUCCEEDED --
      // Alpha 8361-8440's own languageNote fix (bc8482d2, reconciled
      // into this Arc) only covered the two SUCCESS branches above, never
      // this one, so it did not actually close the bug it targeted. This
      // is a real success shown as a real error; fixed here.
      byId("settings-report").textContent = `Saved — this preference is stored, but no part of this Beta currently reads or applies it yet.${languageNote}`;
    } else {
      byId("settings-error").textContent = describeOutcome(report.outcome);
    }
    await reloadSettingsData();
  } finally {
    setBusy(false, "settings-save");
  }
}

// ---------------------------------------------------------------------
// Ready screen routing.
// ---------------------------------------------------------------------

/**
 * Product Durability mega-arc -- renders the real, non-secret backup
 * guidance `buildFedosProfileRecoveryNotice()` already computes
 * (`src/os/messenger/desktop/onboarding/fedos_profile_recovery_notice.ts`).
 * Previously computed end to end and then silently dropped at the
 * `readyResult()` IPC boundary; this is the renderer half of forwarding it.
 * Only file paths and fixed strings -- never a secret, matching that
 * file's own hard guardrails.
 */
function renderReadyRecoveryNotice(notice: FedosProfileRecoveryNoticeView): void {
  const headline = byId("ready-recovery-headline");
  headline.textContent = notice.headline;
  headline.hidden = false;

  const items = byId("ready-recovery-backup-items");
  items.textContent = "";
  for (const item of notice.backupItems) {
    const li = document.createElement("li");
    li.textContent = `${item.label}: ${item.path}`;
    items.appendChild(li);
  }
  items.hidden = notice.backupItems.length === 0;

  const wholeDir = byId("ready-recovery-whole-dir");
  wholeDir.textContent = `${notice.wholeProfileDirectoryRecommendation.text} (${notice.wholeProfileDirectoryRecommendation.path})`;
  wholeDir.hidden = false;
}

function renderReady(ready: FedosProfileCommandResult["ready"]): void {
  if (ready === undefined) return;
  byId("ready-label").textContent = ready.displayLabel;
  byId("ready-account").textContent = ready.accountPublicIdentifier;
  byId("ready-device").textContent = ready.localDeviceId;
  byId("ready-trust").textContent = ready.deviceTrustState;
  renderReadyRecoveryNotice(ready.recoveryNotice);
  localAccountPublicIdentifier = ready.accountPublicIdentifier;
  localDisplayLabel = ready.displayLabel;
  refreshCommerceActorOptionsForRealIdentity();
  showScreen("ready");
  void renderBetaStatus();
  showAppScreen("conversations");
  void refreshConversationsList();
  setAppStatus("");
  startRelayStatusPolling();
  // Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 8 /
  // arc §32 (buyer order recovery): fetch order activity ONCE at Ready
  // (not a recurring poll -- this is the SAME one-shot pattern
  // `refreshConversationsList()` above already uses, just extended to
  // Commerce) so the nav-bar "Shop"/"My Store" badges are already correct
  // the moment a returning user reaches the Ready screen after a restart,
  // rather than only after they manually visit either tab once.
  void refreshCommerceMyOrdersList();
  void refreshCommerceMerchantOrdersList();
  // FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- see
  // `#commerce-landing-pointer`'s own HTML comment / `refreshCommerceLandingPointer()`'s
  // own header.
  void refreshCommerceLandingPointer();
  // Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
  // same one-shot-at-Ready pattern, so the Shop/My Store mode banner's
  // real/local-only-vs-published wording is already correct the moment a
  // returning user reaches either screen, not only after a Settings visit.
  void refreshCommerceNetworkProfileCache();
}

function routeByStatus(status: FedosProfileStatusResult): void {
  if (status.presence === "ready") {
    byId("ready-label").textContent = status.displayLabel ?? "";
    byId("ready-account").textContent = status.accountPublicIdentifier ?? "";
    byId("ready-device").textContent = status.localDeviceId ?? "";
    localAccountPublicIdentifier = status.accountPublicIdentifier ?? "";
    localDisplayLabel = status.displayLabel ?? "";
    refreshCommerceActorOptionsForRealIdentity();
    showScreen("ready");
    void renderBetaStatus();
    showAppScreen("conversations");
    void refreshConversationsList();
    startRelayStatusPolling();
    // Commerce Real Two-Party UX Closure (Agent U) -- see `renderReady()`'s
    // own identical comment above (this is the OTHER Ready-routing path).
    void refreshCommerceMyOrdersList();
    void refreshCommerceMerchantOrdersList();
    void refreshCommerceLandingPointer();
    void refreshCommerceNetworkProfileCache();
    return;
  }
  if (status.presence === "absent") {
    showScreen("welcome");
    return;
  }
  if (status.presence === "recovery-required") {
    // FedOS Installed Startup Root-Cause Arc -- reachable on a FRESH
    // LAUNCH now too (not only after a failed live unlock attempt): a
    // "ready" descriptor with a structurally corrupt/missing sealed seed
    // is detected by the main process's own `detectProfileState()` before
    // this screen is ever shown, and carries `recoveryReason === "corrupt"`
    // straight through here so the SAME honest "corrupt" diagnostic +
    // Start Over action `onUnlockSubmit()` already uses for a live-attempt
    // discovery is shown either way -- never the generic
    // "recovery-required" copy/action for this shape.
    renderRecoveryScreen(status.recoveryReason === "corrupt" ? "corrupt" : "recovery-required");
    return;
  }
  byId("unlock-label").textContent = status.displayLabel ?? "(existing profile)";
  showScreen("unlock");
}

async function refreshFromStatus(): Promise<void> {
  const status = await window.fedosProfile.status();
  routeByStatus(status);
}

async function onCreateSubmit(): Promise<void> {
  // Secure Runtime Alpha 8121-8200 -- Security Finding 4: defense in
  // depth against any earlier session generation's leftover content
  // (the normal path already clears everything in `onLock()`; this
  // guards the same invariant for a session that reached this screen
  // without a clean lock -- e.g. recovery-required cycling back here).
  clearAllRendererContentState();
  const label = byId<HTMLInputElement>("create-label").value.trim();
  const pass = byId<HTMLInputElement>("create-pass").value;
  const confirm = byId<HTMLInputElement>("create-pass-confirm").value;
  byId("create-error").textContent = "";

  if (label.length === 0) {
    byId("create-error").textContent = "Enter a profile label.";
    return;
  }
  if (pass.length === 0) {
    byId("create-error").textContent = "Enter a passphrase.";
    return;
  }
  if (pass !== confirm) {
    byId("create-error").textContent = "Passphrases do not match.";
    clearField("create-pass");
    clearField("create-pass-confirm");
    return;
  }

  setBusy(true, "create-submit");
  showScreen("initializing");
  let result: FedosProfileCommandResult;
  try {
    result = await window.fedosProfile.create(label, pass);
  } finally {
    clearField("create-pass");
    clearField("create-pass-confirm");
    resetPasswordVisibility("create-pass-show-hide", "create-pass", "create-pass-confirm");
    setBusy(false, "create-submit");
    refreshCreateSubmitEnabled();
  }

  if (result.outcome === "ok") {
    byId<HTMLInputElement>("create-label").value = "";
    byId<HTMLInputElement>("create-pass-ack").checked = false;
    refreshCreateSubmitEnabled();
    renderReady(result.ready);
  } else {
    showScreen("create");
    byId("create-error").textContent = coarseError(result);
  }
}

async function onUnlockSubmit(): Promise<void> {
  // Secure Runtime Alpha 8121-8200 -- Security Finding 4: same defense in
  // depth as `onCreateSubmit()` -- see that call's own comment. Applies
  // whether this unlock succeeds or fails; a WRONG passphrase must not
  // leave any earlier generation's content still cached either.
  clearAllRendererContentState();
  const pass = byId<HTMLInputElement>("unlock-pass").value;
  byId("unlock-error").textContent = "";
  if (pass.length === 0) {
    byId("unlock-error").textContent = "Enter your passphrase.";
    return;
  }

  setBusy(true, "unlock-submit");
  showScreen("initializing");
  let result: FedosProfileCommandResult;
  try {
    result = await window.fedosProfile.unlock(pass);
  } finally {
    clearField("unlock-pass");
    resetPasswordVisibility("unlock-pass-show-hide", "unlock-pass");
    setBusy(false, "unlock-submit");
  }

  if (result.outcome === "ok") {
    renderReady(result.ready);
  } else if (result.outcome === "recovery-required" || result.outcome === "corrupt") {
    // Secure Runtime Alpha (Installed Startup Root-Cause Arc) -- `"corrupt"`
    // is a DISTINCT outcome from an ordinary wrong passphrase (see
    // `FedosProfileInitializationCoordinator#unlockProfile()`'s own header,
    // root `src/`): the sealed Master Seed material itself is
    // structurally missing/corrupt, so no passphrase will ever unlock it
    // again. Routing it here (not the generic wrong-passphrase branch
    // below) shows the honest "corrupt" diagnostic/copy and the real
    // corrupt-profile Start Over action instead of a dead-end "the
    // passphrase did not match" message.
    renderRecoveryScreen(coarseErrorCode(result));
  } else {
    byId("unlock-failed-reason").textContent = "Double-check your passphrase (case and spacing matter) and try again.";
    showScreen("unlock-failed");
  }
}

function coarseErrorCode(result: FedosProfileCommandResult): string {
  return result.outcome;
}

function coarseError(result: FedosProfileCommandResult): string {
  switch (result.outcome) {
    case "already-exists":
      return "A profile already exists on this device.";
    case "weak-secret":
      return "Passphrase is too short. Use at least 8 characters.";
    case "invalid-input":
      return "Please check the label and passphrase.";
    case "recovery-required":
      return "This profile requires recovery.";
    default:
      return "Could not complete. Please try again.";
  }
}

// ---------------------------------------------------------------------
// Phase L — Recovery. Distinguishes the real, closed outcome codes the
// Coordinator can actually produce; never invents an action that cannot
// succeed, never a Master Seed recovery code.
// ---------------------------------------------------------------------

const RECOVERY_EXPLANATIONS: Readonly<Record<string, string>> = {
  "recovery-required": "A partial or corrupt local profile was detected and cannot be unlocked automatically.",
  corrupt: "The locally stored profile data appears corrupted.",
  "seed-unavailable": "Secure crypto (the compiled WASM module) is not available on this device build.",
  "unsupported-version": "This profile was created by an incompatible, newer or older schema version.",
};

function renderRecoveryScreen(outcomeCode: string): void {
  byId("recovery-reason").textContent = outcomeCode;
  byId("recovery-explain").textContent = RECOVERY_EXPLANATIONS[outcomeCode] ?? "This profile could not be unlocked. You can retry, copy the diagnostic code for support, or quit.";
  // FedOS Installed Startup Root-Cause Arc -- `"corrupt"` (a "ready"
  // descriptor with a structurally corrupt/missing sealed seed) is a
  // DIFFERENT shape from every other recovery-required diagnostic code
  // (an interrupted, never-finished setup): the OLD "Start Over" action
  // (`resetInterrupted`) is guaranteed to refuse it, so it must never be
  // offered here -- the NEW corrupt-profile action block is shown
  // instead, with copy honest about data loss rather than a typo.
  const isCorruptReadySeal = outcomeCode === "corrupt";
  byId("recovery-actions").hidden = isCorruptReadySeal;
  byId("recovery-actions-corrupt").hidden = !isCorruptReadySeal;
  showScreen("recovery");
}

async function onRecoveryRetry(): Promise<void> {
  await refreshFromStatus();
}

async function onRecoveryCopyDiagnostic(): Promise<void> {
  const code = byId("recovery-reason").textContent ?? "";
  try {
    await navigator.clipboard.writeText(`FedOS Desktop Beta diagnostic code: ${code}`);
    byId("recovery-copy-feedback").textContent = "Copied.";
  } catch {
    byId("recovery-copy-feedback").textContent = "Could not copy automatically — the code is shown above.";
  }
}

/**
 * FedOS Peer Device Discovery Arc P0 Closure (Agent F) — "Start Over" on
 * the recovery screen. Requires an explicit confirmation step first
 * (irreversible for the interrupted attempt, though by construction it
 * never held recoverable user data — a profile that ever reached "ready"
 * is refused automatically by the main-process Coordinator's own guard,
 * never by this renderer's own judgment). On success, re-derives the
 * screen from a fresh status read (the same `refreshFromStatus()` every
 * other lifecycle transition in this file already uses) rather than
 * assuming "absent" — honest even if the underlying state ever surprises
 * this renderer.
 */
async function onRecoveryStartOver(): Promise<void> {
  const resetInterrupted = window.fedosProfile.resetInterrupted;
  if (resetInterrupted === undefined) {
    byId("recovery-start-over-feedback").textContent = "Start Over is not available in this build.";
    return;
  }
  const confirmed = await confirmInPage(
    "Start over?",
    "This permanently erases the interrupted local profile data on this device. It never finished being set up, so it never held recoverable messages. This cannot be undone. If this profile ever finished setup, Start Over is refused automatically and nothing is changed.",
    "Yes, start over",
  );
  if (!confirmed) return;
  byId("recovery-start-over-feedback").textContent = "";
  setBusy(true, "recovery-start-over-btn");
  let result: FedosProfileCommandResult;
  try {
    result = await resetInterrupted();
  } finally {
    setBusy(false, "recovery-start-over-btn");
  }
  if (result.outcome === "ok") {
    clearAllRendererContentState();
    await refreshFromStatus();
  } else {
    byId("recovery-start-over-feedback").textContent = `Could not start over (${coarseErrorCode(result)}). The profile was not changed.`;
  }
}

/**
 * FedOS Installed Startup Root-Cause Arc — the SIBLING "Start Over" for the
 * OPPOSITE shape from `onRecoveryStartOver()` above: a profile whose
 * descriptor DID finish setup (`"ready"`), but whose locally stored key
 * material is verifiably, structurally missing/corrupt — never a
 * passphrase-dependent judgment, and never reachable by an ordinary
 * wrong-passphrase retry (see `FedosProfileInitializationCoordinator#resetCorruptReadyProfile()`'s
 * own header, root `src/`). The confirmation copy is honest about data
 * loss, not a typo — this profile can never be unlocked again regardless
 * of passphrase. On success, re-derives the screen from a fresh status
 * read, same discipline as `onRecoveryStartOver()`.
 */
async function onRecoveryStartOverCorrupt(): Promise<void> {
  const resetCorruptReady = window.fedosProfile.resetCorruptReady;
  if (resetCorruptReady === undefined) {
    byId("recovery-start-over-corrupt-feedback").textContent = "Start Over is not available in this build.";
    return;
  }
  const confirmed = await confirmInPage(
    "Start over?",
    "This profile finished setup, but the locally stored key material it needs to unlock is missing or corrupted, and no passphrase will ever unlock it again. This permanently erases the remaining local profile data on this device so you can set up a new one. This cannot be undone, and any conversation history not covered by a prior Archive export is not recoverable. If the key material is actually intact, Start Over is refused automatically and nothing is changed.",
    "Yes, start over",
  );
  if (!confirmed) return;
  byId("recovery-start-over-corrupt-feedback").textContent = "";
  setBusy(true, "recovery-start-over-corrupt-btn");
  let result: FedosProfileCommandResult;
  try {
    result = await resetCorruptReady();
  } finally {
    setBusy(false, "recovery-start-over-corrupt-btn");
  }
  if (result.outcome === "ok") {
    clearAllRendererContentState();
    await refreshFromStatus();
  } else {
    byId("recovery-start-over-corrupt-feedback").textContent = `Could not start over (${coarseErrorCode(result)}). The profile was not changed.`;
  }
}

function stopRelayStatusPolling(): void {
  if (relayStatusIntervalId !== null) {
    clearInterval(relayStatusIntervalId);
    relayStatusIntervalId = null;
  }
}

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 4 (external audit
 * delta `6873d24f`): clears every Renderer-held content-shaped value this
 * page accumulates — the revealed-plaintext cache (§6/§11 item 4, the
 * review's own headline concern), every list/detail cache, every
 * content-bearing DOM container, and every free-text input — so no
 * old-generation content can remain visible or re-appear after a fresh
 * unlock (of the SAME or a DIFFERENT profile) without being freshly
 * reloaded through the new Runtime. Called on lock, before create/unlock
 * establishes a new session (defense in depth against any earlier
 * generation's leftover state), and on unlock failure.
 *
 * Best-effort JS-level clearing only (`Map.clear()`, reassigning `[]`,
 * `textContent = ""`, `.value = ""`) — this is NOT a claim of guaranteed
 * physical RAM erasure or garbage-collector timing; V8 may retain freed
 * memory pages until its own GC cycle runs. No raw secret (a
 * `SecretHandle`, Master Seed, or private key) has ever been held by this
 * Renderer to begin with (confirmed: `docs/reviews/.../01_delta_review_alpha_8041_8120.md`
 * §6) — everything cleared here is already-decrypted DISPLAY content
 * (message text, search hits, identity/device labels), which is exactly
 * the class of content this finding is about.
 */
function clearAllRendererContentState(): void {
  stopChatPolling();
  stopRelayStatusPolling();

  // In-memory caches/selections.
  revealedMessagePlaintext.clear();
  conversationsCache = [];
  currentConversationId = null;
  currentIdentityTransitionSelection = null;
  currentDeletionRequestId = null;
  archiveExportDestinationPath = null;
  archiveRestoreSourcePath = null;
  settingsWorkingCopy = null;
  localAccountPublicIdentifier = "";
  localDisplayLabel = "";
  pendingDevicePairingId = null;
  // Commerce Discovery + Digital Content Delivery mega-arc (Agent U) --
  // same defense-in-depth reset as `localAccountPublicIdentifier`/
  // `localDisplayLabel` immediately above: a locked/relocked session must
  // never carry a PRIOR profile's "Acting as" selection (or its "user
  // explicitly chose" flag) into a newly-unlocked one.
  commerceActingAsPubkey = "";
  commerceActingAsUserExplicitlyChosen = false;

  // Content-bearing DOM containers (list/detail views, error text, status/feedback text).
  const textContentOnlyIds = [
    "chat-messages",
    "chat-title",
    "chat-meta",
    "chat-error",
    "chat-send-feedback",
    "conversations-list",
    "conversations-error",
    "search-results",
    "search-error",
    "archive-export-dest-label",
    "archive-export-error",
    "archive-restore-manifest",
    "archive-restore-source-label",
    "archive-restore-counterparty",
    "archive-restore-error",
    "identity-transition-detail",
    "identity-transition-list",
    "deletion-request-detail",
    "deletion-request-list",
    "devices-list",
    "devices-error",
    "device-pairing-create-error",
    "device-pairing-create-expiry",
    "device-pairing-create-copy-feedback",
    "device-pairing-approve-error",
    "device-pairing-approve-inspection",
    "device-pairing-approve-copy-feedback",
    "device-pairing-complete-error",
    "device-pairing-complete-result",
    "safety-sections",
    "safety-error",
    "invite-error",
    "recovery-copy-feedback",
    "recovery-start-over-feedback",
    "settings-report",
    "settings-relay-error",
    "settings-relay-list",
    "ready-account",
    "ready-label",
    "ready-device",
    "ready-trust",
    "app-status-area",
  ];
  for (const id of textContentOnlyIds) {
    const el = document.getElementById(id);
    if (el !== null) el.textContent = "";
  }

  // Free-text input fields a prior session's own typing/paste may have left behind.
  const inputValueOnlyIds = [
    "chat-compose",
    "conversations-filter",
    "search-query",
    "invite-identifier",
    "archive-export-conversation-id",
    "settings-relay-new",
    "device-pairing-create-label",
    "device-pairing-create-account",
    "device-pairing-create-output",
    "device-pairing-approve-input",
    "device-pairing-approve-output",
    "device-pairing-complete-input",
  ];
  for (const id of inputValueOnlyIds) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = "";
  }

  // Pairing is a trust decision -- restart-safe visible state means every
  // stale in-flight affordance from a prior session is closed, never left
  // clickable (the underlying `pendingDevicePairingId`/keypair are already
  // gone by construction -- see the reset above and the Shell's own
  // process-memory-only pairing bookkeeping).
  for (const id of ["device-pairing-approve-submit", "device-pairing-complete-submit"]) {
    const el = document.getElementById(id);
    if (el instanceof HTMLButtonElement) el.disabled = true;
  }
  disarmDevicePairingApproveConfirm();
  for (const id of ["device-pairing-create-result", "device-pairing-approve-result"]) {
    const el = document.getElementById(id);
    if (el !== null) el.hidden = true;
  }
}

async function onLock(): Promise<void> {
  stopChatPolling();
  stopRelayStatusPolling();
  setBusy(true, "lock-btn");
  try {
    await window.fedosProfile.lock();
  } finally {
    setBusy(false, "lock-btn");
  }
  clearAllRendererContentState();
  await refreshFromStatus();
}

// ---------------------------------------------------------------------
// Event wiring.
// ---------------------------------------------------------------------

// Buyer Discovery + Digital Content Delivery mega-arc (post-report
// follow-up fix) -- the shared in-page confirmation dialog (see
// `confirmInPage()`). Escape cancels, exactly as a native dialog would,
// and is listened for on the document (capture phase) because focus may
// sit on either of the two dialog buttons.
byId<HTMLButtonElement>("app-confirm-accept").addEventListener("click", () => settleAppConfirm(true));
byId<HTMLButtonElement>("app-confirm-cancel").addEventListener("click", () => settleAppConfirm(false));
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape" && !byId("app-confirm-overlay").hidden) {
      event.preventDefault();
      settleAppConfirm(false);
    }
  },
  true,
);

byId<HTMLButtonElement>("welcome-create-btn").addEventListener("click", () => {
  showScreen("create");
});
byId<HTMLButtonElement>("create-submit").addEventListener("click", () => {
  void onCreateSubmit();
});
byId<HTMLButtonElement>("unlock-submit").addEventListener("click", () => {
  void onUnlockSubmit();
});
byId<HTMLButtonElement>("create-pass-show-hide").addEventListener("click", () => {
  togglePasswordVisibility("create-pass-show-hide", "create-pass", "create-pass-confirm");
});
byId<HTMLButtonElement>("unlock-pass-show-hide").addEventListener("click", () => {
  togglePasswordVisibility("unlock-pass-show-hide", "unlock-pass");
});
byId<HTMLInputElement>("create-pass-ack").addEventListener("change", refreshCreateSubmitEnabled);
byId<HTMLButtonElement>("retry-btn").addEventListener("click", () => {
  clearField("unlock-pass");
  showScreen("unlock");
});
byId<HTMLButtonElement>("lock-btn").addEventListener("click", () => {
  void onLock();
});
byId<HTMLButtonElement>("quit-btn").addEventListener("click", () => {
  void window.fedosProfile.quit();
});
byId<HTMLButtonElement>("quit-btn-recovery").addEventListener("click", () => {
  void window.fedosProfile.quit();
});
byId<HTMLButtonElement>("recovery-retry-btn").addEventListener("click", () => {
  void onRecoveryRetry();
});
byId<HTMLButtonElement>("recovery-copy-btn").addEventListener("click", () => {
  void onRecoveryCopyDiagnostic();
});
byId<HTMLButtonElement>("recovery-start-over-btn").addEventListener("click", () => {
  void onRecoveryStartOver();
});
byId<HTMLButtonElement>("recovery-start-over-corrupt-btn").addEventListener("click", () => {
  void onRecoveryStartOverCorrupt();
});

// Phase M — Enter submits the focused form's primary action.
for (const [inputId, buttonId] of [
  ["create-pass-confirm", "create-submit"],
  ["unlock-pass", "unlock-submit"],
  ["invite-identifier", "invite-submit"],
  ["search-query", "search-submit"],
  ["settings-relay-new", "settings-relay-add"],
] as const) {
  const input = document.getElementById(inputId);
  if (input !== null) {
    input.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter") {
        (event as KeyboardEvent).preventDefault();
        byId<HTMLButtonElement>(buttonId).click();
      }
    });
  }
}
byId<HTMLTextAreaElement>("chat-compose").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    byId<HTMLButtonElement>("chat-send").click();
  }
});

// Nav.
byId<HTMLButtonElement>("nav-conversations").addEventListener("click", () => {
  showAppScreen("conversations");
  void refreshConversationsList();
  // FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- keep the
  // landing pointer current on every return to this screen, not merely at
  // the moment of unlock/restart (reuses the same one-shot-per-navigation
  // discipline every other screen's own refresh already follows -- never a
  // recurring background poll).
  void refreshCommerceLandingPointer();
});
byId<HTMLButtonElement>("nav-commerce").addEventListener("click", () => {
  showAppScreen("commerce");
  void refreshCommerceCatalogList();
});
byId<HTMLButtonElement>("nav-commerce-merchant").addEventListener("click", () => {
  showAppScreen("commerce-merchant");
  void refreshCommerceMerchantScreen();
});
// Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- item 6
// (order recovery): the landing-pointer action buttons navigate exactly the
// same way their corresponding nav button does (SAME screen/refresh calls
// as `nav-commerce`/`nav-commerce-merchant` immediately above), never a
// second, divergent navigation path.
byId<HTMLButtonElement>("commerce-landing-pointer-shop-btn").addEventListener("click", () => {
  showAppScreen("commerce");
  void refreshCommerceCatalogList();
});
byId<HTMLButtonElement>("commerce-landing-pointer-store-btn").addEventListener("click", () => {
  showAppScreen("commerce-merchant");
  void refreshCommerceMerchantScreen();
});
byId<HTMLButtonElement>("nav-search").addEventListener("click", () => showAppScreen("search"));
byId<HTMLButtonElement>("nav-archive").addEventListener("click", () => {
  showAppScreen("archive");
  void renderArchiveWarnings("archive-export-warnings", "export");
  void renderArchiveWarnings("archive-restore-warnings", "restore");
});
byId<HTMLButtonElement>("nav-devices").addEventListener("click", () => {
  showAppScreen("devices");
  void refreshDevicesList();
  void refreshDeviceSyncInventory();
});
byId<HTMLButtonElement>("nav-safety").addEventListener("click", () => {
  showAppScreen("safety");
  void refreshSafetyCenter();
  void refreshIdentityTransitionList();
  void refreshDeletionRequestList();
});
byId<HTMLButtonElement>("nav-settings").addEventListener("click", () => {
  showAppScreen("settings");
  void refreshSettings();
});

// FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- explicit
// manual refresh for My Orders / Incoming Orders (this app has no push/
// poll for Commerce data -- see `CommerceRendererSyncTracker`'s own
// header). `runCommerceAction()` inside each refresh function already
// disables buttons it is told about; these two ARE that busy-button, so a
// second click mid-refresh is a no-op via the same disable-while-in-flight
// discipline every other Commerce action already uses.
byId<HTMLButtonElement>("commerce-my-orders-refresh").addEventListener("click", () =>
  void runCommerceAction(["commerce-my-orders-refresh"], "commerce-error", () => refreshCommerceMyOrdersList()),
);
// FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
// arc mandate items 1-3: the Shop screen's "Connect to discover sellers"
// call to action and the share-code "Open" control.
byId<HTMLButtonElement>("commerce-discovery-connect-btn").addEventListener("click", () => void onCommerceDiscoveryConnectClick());
byId<HTMLButtonElement>("commerce-share-open-btn").addEventListener("click", () => void onCommerceShareOpenClick());
byId<HTMLButtonElement>("commerce-merchant-orders-refresh").addEventListener("click", () =>
  void runCommerceAction(["commerce-merchant-orders-refresh"], "commerce-merchant-orders-error", () => refreshCommerceMerchantOrdersList()),
);

// Conversations / chat.
byId<HTMLInputElement>("conversations-filter").addEventListener("input", () => {
  renderConversationsList(byId<HTMLInputElement>("conversations-filter").value);
});
byId<HTMLButtonElement>("invite-submit").addEventListener("click", () => void onInviteSubmit());
byId<HTMLButtonElement>("chat-back").addEventListener("click", () => {
  currentConversationId = null;
  currentChatCounterpartyAccountRef = null;
  showAppScreen("conversations");
  void refreshConversationsList();
});
byId<HTMLButtonElement>("chat-send").addEventListener("click", () => void onChatSend());
byId<HTMLButtonElement>("chat-security-indicator").addEventListener("click", onChatSecurityIndicatorClick);
byId<HTMLButtonElement>("chat-refresh-device-announcement").addEventListener("click", () => void onRefreshDeviceAnnouncementClick());

// Commerce.
byId<HTMLButtonElement>("commerce-detail-back").addEventListener("click", () => {
  // Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) -- returns to
  // wherever this detail view was opened FROM (the buyer catalog, or the
  // Merchant screen for a draft Preview, friction ledger row #24) rather
  // than always the buyer catalog.
  if (commerceDetailReturnScreen === "commerce-merchant") {
    showAppScreen("commerce-merchant");
    void refreshCommerceMerchantScreen();
    return;
  }
  showAppScreen("commerce");
  void refreshCommerceCatalogList();
});
// "input" listened alongside "change" -- the real UI only ever fires "change"
// (a native <select>'s own event), but the existing AUTOTEST_MODE=ui-script
// harness's "fill" step (`fedos_electron_beta_main.cts`) only ever dispatches
// "input" when scripting a value change, matching every OTHER scripted field
// in this file (text inputs/textareas do fire "input" natively). Listening
// to both costs nothing extra for a real user (a real <select> never fires
// "input" on its own) and makes this control scriptable the same way every
// other form control in this file already is, with no harness change.
byId<HTMLSelectElement>("commerce-acting-as").addEventListener("change", (e) => {
  setCommerceActingAs((e.target as HTMLSelectElement).value);
  void refreshCommerceCatalogList();
});
byId<HTMLSelectElement>("commerce-acting-as").addEventListener("input", (e) => {
  setCommerceActingAs((e.target as HTMLSelectElement).value);
  void refreshCommerceCatalogList();
});
byId<HTMLSelectElement>("commerce-merchant-acting-as").addEventListener("change", (e) => {
  setCommerceActingAs((e.target as HTMLSelectElement).value);
  void refreshCommerceMerchantScreen();
});
byId<HTMLSelectElement>("commerce-merchant-acting-as").addEventListener("input", (e) => {
  setCommerceActingAs((e.target as HTMLSelectElement).value);
  void refreshCommerceMerchantScreen();
});
byId<HTMLButtonElement>("commerce-order-create-submit").addEventListener("click", () => void onCommerceOrderCreateSubmit());
byId<HTMLButtonElement>("commerce-order-back").addEventListener("click", () => {
  currentCommerceOrder = null;
  currentCommercePendingPayment = null;
  showAppScreen("commerce");
  void refreshCommerceCatalogList();
});
byId<HTMLButtonElement>("commerce-order-submit-btn").addEventListener("click", () =>
  void onCommerceOrderActionClick((id, actor) => window.fedosApp.commerceOrderSubmit(id, actor), "commerce-order-error", "commerce-order-submit-btn"),
);
byId<HTMLButtonElement>("commerce-order-cancel-btn").addEventListener("click", () =>
  void onCommerceOrderActionClick((id, actor) => window.fedosApp.commerceOrderCancel(id, actor), "commerce-order-error", "commerce-order-cancel-btn"),
);
byId<HTMLButtonElement>("commerce-order-accept-btn").addEventListener("click", () =>
  void onCommerceOrderActionClick((id, actor) => window.fedosApp.commerceOrderAccept(id, actor), "commerce-order-error", "commerce-order-accept-btn"),
);
byId<HTMLButtonElement>("commerce-order-reject-btn").addEventListener("click", () => void onCommerceOrderRejectClick());
byId<HTMLButtonElement>("commerce-order-fulfill-btn").addEventListener("click", () =>
  void onCommerceOrderActionClick((id, actor) => window.fedosApp.commerceOrderFulfill(id, actor), "commerce-order-error", "commerce-order-fulfill-btn"),
);
byId<HTMLButtonElement>("commerce-order-payment-request-btn").addEventListener("click", () => void onCommercePaymentRequestClick());
byId<HTMLButtonElement>("commerce-order-payment-simulate-btn").addEventListener("click", () => void onCommercePaymentSimulateClick());
byId<HTMLButtonElement>("commerce-order-acknowledge-receipt-btn").addEventListener("click", () => void onCommerceDeliveryAcknowledgeReceiptClick());
byId<HTMLButtonElement>("commerce-order-complete-btn").addEventListener("click", () => void onCommerceOrderCompleteClick());
byId<HTMLButtonElement>("commerce-order-receipt-issue-btn").addEventListener("click", () => void onCommerceReceiptIssueClick());
byId<HTMLButtonElement>("commerce-order-purchased-content-btn").addEventListener("click", () => void onCommerceOpenPurchasedContentClick());
byId<HTMLButtonElement>("commerce-merchant-create-submit").addEventListener("click", () => void onCommerceMerchantCreateSubmit());
// Commerce Discovery + Digital Content Delivery mega-arc (Agent U) -- item 2
// ("how do I share my store?"); see `commerceMerchantProductShareControls()`'s
// own header for the honest scope of what this can promise today.
byId<HTMLButtonElement>("commerce-merchant-share-store").addEventListener("click", () => {
  void (async () => {
    const feedbackEl = byId("commerce-merchant-share-store-feedback");
    const shareText = `FedOS store: ${commerceActorLabel(commerceActingAsPubkey)} — pubkey ${commerceActingAsPubkey}. The recipient needs a working Relay connection on their own device to actually find your listings; this is not yet a scannable/verified proof.`;
    try {
      await navigator.clipboard.writeText(shareText);
      feedbackEl.textContent = "Copied. Note: the recipient still needs a working Relay connection to find your listings.";
    } catch {
      feedbackEl.textContent = "Couldn't copy to clipboard.";
    }
  })();
});
// Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
// ledger row #18: live formatted price preview as Bob types/changes
// currency, on both the Create and Edit forms. "input" + "change" both
// listened, matching the "Acting as" selects' own documented reasoning
// just above (the ui-script test harness only ever dispatches "input").
byId<HTMLInputElement>("commerce-merchant-create-price").addEventListener("input", () =>
  commerceUpdatePricePreview("commerce-merchant-create-price", "commerce-merchant-create-currency", "commerce-merchant-create-price-preview"),
);
byId<HTMLSelectElement>("commerce-merchant-create-currency").addEventListener("change", () =>
  commerceUpdatePricePreview("commerce-merchant-create-price", "commerce-merchant-create-currency", "commerce-merchant-create-price-preview"),
);
byId<HTMLInputElement>("commerce-merchant-edit-price").addEventListener("input", () =>
  commerceUpdatePricePreview("commerce-merchant-edit-price", "commerce-merchant-edit-currency", "commerce-merchant-edit-price-preview"),
);
byId<HTMLSelectElement>("commerce-merchant-edit-currency").addEventListener("change", () =>
  commerceUpdatePricePreview("commerce-merchant-edit-price", "commerce-merchant-edit-currency", "commerce-merchant-edit-price-preview"),
);
byId<HTMLButtonElement>("commerce-merchant-edit-save").addEventListener("click", () => void onCommerceMerchantEditSave());
byId<HTMLButtonElement>("commerce-merchant-edit-cancel").addEventListener("click", () => onCommerceMerchantEditCancel());

// Search.
byId<HTMLButtonElement>("search-submit").addEventListener("click", () => void onSearchSubmit());

// Archive.
byId<HTMLButtonElement>("archive-export-choose-dest").addEventListener("click", () => void onArchiveChooseExportDestination());
byId<HTMLButtonElement>("archive-export-submit").addEventListener("click", () => void onArchiveExportSubmit());
byId<HTMLButtonElement>("archive-restore-choose-source").addEventListener("click", () => void onArchiveChooseSource());
byId<HTMLButtonElement>("archive-restore-inspect").addEventListener("click", () => void onArchiveRestoreInspect());
byId<HTMLButtonElement>("archive-restore-submit").addEventListener("click", () => void onArchiveRestoreSubmit());

// Device Pairing.
byId<HTMLButtonElement>("device-pairing-create-submit").addEventListener("click", () => void onDevicePairingCreateSubmit());
byId<HTMLButtonElement>("device-pairing-create-copy").addEventListener("click", () => void onDevicePairingCreateCopy());
byId<HTMLButtonElement>("device-pairing-approve-inspect").addEventListener("click", () => void onDevicePairingApproveInspect());
byId<HTMLButtonElement>("device-pairing-approve-submit").addEventListener("click", () => armDevicePairingApproveConfirm());
byId<HTMLButtonElement>("device-pairing-approve-confirm").addEventListener("click", () => void onDevicePairingApproveConfirm());
byId<HTMLButtonElement>("device-pairing-approve-cancel").addEventListener("click", () => onDevicePairingApproveCancel());
byId<HTMLButtonElement>("device-pairing-approve-copy").addEventListener("click", () => void onDevicePairingApproveCopy());
byId<HTMLButtonElement>("device-pairing-complete-submit").addEventListener("click", () => void onDevicePairingCompleteSubmit());

// Settings.
byId<HTMLButtonElement>("settings-relay-add").addEventListener("click", onSettingsRelayAdd);
byId<HTMLButtonElement>("settings-save").addEventListener("click", () => void onSettingsSave());
// FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's minimal NetworkProfile Settings surface.
byId<HTMLButtonElement>("commerce-network-profile-save").addEventListener("click", () => void onCommerceNetworkProfileSave());

// Commerce E2E Completion arc -- populate BOTH "Acting as" selectors once,
// unconditionally, at startup (never lazily only-on-first-visit). Fixes a
// real latent robustness gap: each selector was previously populated only
// inside its OWN screen's first refresh (`refreshCommerceCatalogList()`/
// `refreshCommerceMerchantScreen()`), so `setCommerceActingAs()`'s direct
// `.value = pubkey` assignment on the OTHER, not-yet-visited screen's
// selector would silently no-op (a <select> with zero <option> elements
// cannot take an arbitrary value) -- harmless for a real user (they can
// only ever interact with whichever selector is currently visible), but a
// real inconsistency in `commerceActingAsPubkey`'s reflected DOM state
// regardless of whether a human notices it.
populateCommerceActorSelect("commerce-acting-as");
populateCommerceActorSelect("commerce-merchant-acting-as");
// Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — initial live
// price preview for the Create Product form's default "0.00" value.
commerceUpdatePricePreview("commerce-merchant-create-price", "commerce-merchant-create-currency", "commerce-merchant-create-price-preview");

// Commerce Real Two-Party UX Closure (Agent U) -- friction ledger row 12
// (arc §26): reveal the `Current screen: <state>` debug label ONLY when a
// test harness set `FEDOS_ELECTRON_BETA_AUTOTEST` (see `showScreen()`'s own
// comment above and `fedosBeta.debugInstrumentationEnabled`'s doc comment
// in `fedos_electron_beta_window.d.ts`). A plain synchronous property read
// -- no IPC round-trip, no race with the very first `showScreen()` call.
if (window.fedosBeta.debugInstrumentationEnabled) {
  byId("current-screen-row").hidden = false;
}

void refreshFromStatus();
})();
