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
    meta.textContent = `${c.conversationId} – ${lifecycle}`;
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

async function onInviteSubmit(): Promise<void> {
  const identifier = byId<HTMLInputElement>("invite-identifier").value.trim();
  clearError("invite-error");
  if (identifier.length === 0) {
    byId("invite-error").textContent = "Enter the contact's public identifier.";
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

function renderChatMessages(messages: readonly { readonly messageId: string; readonly senderMembershipId: string; readonly createdAt: number; readonly plaintext: { readonly state: string; readonly text?: string; readonly reason?: string }; readonly localDeliveryState: string; readonly retentionState: string }[], localMembershipIds: ReadonlySet<string>): void {
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
    li.className = `chat-msg ${localMembershipIds.has(m.senderMembershipId) ? "mine" : "theirs"}`;
    const cachedText = revealedMessagePlaintext.get(m.messageId);
    if (m.retentionState === "tombstoned" || m.retentionState === "payload-removed") {
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
    list.appendChild(li);
  }
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

async function openConversation(conversationId: string): Promise<void> {
  if (currentConversationId !== conversationId) revealedMessagePlaintext.clear();
  currentConversationId = conversationId;
  showAppScreen("chat");
  clearError("chat-error");
  byId("chat-title").textContent = "Conversation";
  byId("chat-meta").textContent = conversationId;
  const detail = await window.fedosApp.conversationOpen(conversationId);
  if (detail.outcome === "ok") {
    const view = detail.value as { readonly mode: string; readonly lifecycleState: string; readonly activationStatus: string };
    byId("chat-title").textContent = `${view.mode} conversation`;
    byId("chat-meta").textContent = `${conversationId} – ${view.lifecycleState} – ${view.activationStatus}`;
  }
  // A freshly-started Runtime must re-activate a Direct conversation before
  // it can send/receive -- a real, per-Runtime-lifetime precondition, not a
  // fabricated step. Already-active is a safe no-op; a genuine failure here
  // still lets the user see messages, only sending will then fail closed.
  await window.fedosApp.conversationActivate(conversationId);
  await loadChatMessages();
  startChatPolling();
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
    byId("chat-send-feedback").textContent = "Sent.";
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
  const result = await runCommerceAction([], "commerce-error", () => window.fedosApp.commerceCatalogList());
  if (result === undefined) {
    commerceCatalogCache = [];
    renderCommerceCatalogList();
  } else if (result.outcome !== "ok") {
    showError("commerce-error", result);
    commerceCatalogCache = [];
    renderCommerceCatalogList();
  } else {
    commerceCatalogCache = result.products ?? [];
    renderCommerceCatalogList();
  }
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
    showError("commerce-detail-error", result);
    return;
  }
  renderCommerceProductDetail(result.product);
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
  const isCustomer = commerceActorRole(commerceActingAsPubkey) === "customer";
  byId("commerce-detail-order-form").toggleAttribute("hidden", !isCustomer || product.isPreview);
  byId("commerce-detail-order-unavailable-note").toggleAttribute("hidden", isCustomer || product.isPreview);
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
// the fictional fixtures rather than merged/renamed into them. Acting as
// your real identity always asserts a MERCHANT capacity (creating/
// managing your OWN store's listings) — this build has no separate real
// "become a customer" identity concept yet, so real-identity purchases
// are not offered here; the demo customer persona remains the only way
// to exercise a buyer flow in this single-process build.
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

/** Every selectable "Acting as" actor: the real local Persona first (when available), then the demo fixtures — so the real production identity is never buried below fictional ones. */
function commerceActingAsOptions(): readonly CommerceActingAsActor[] {
  const real = commerceRealActor();
  return real === null ? COMMERCE_DEMO_ACTORS : [real, ...COMMERCE_DEMO_ACTORS];
}

/** The asserted role for a given "Acting as" pubkey, across BOTH the real identity and the demo fixtures — `undefined` for an unrecognized pubkey (never defaults to a privileged role). */
function commerceActorRole(pubkey: string): "customer" | "merchant" | undefined {
  return commerceActingAsOptions().find((a) => a.pubkey === pubkey)?.role;
}

let commerceActingAsPubkey: string = COMMERCE_DEMO_ACTORS[0]?.pubkey ?? "";

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
  const noteId = selectId === "commerce-acting-as" ? "commerce-acting-as-note" : "commerce-merchant-acting-as-note";
  const noteEl = document.getElementById(noteId);
  if (noteEl !== null) {
    const active = commerceActingAsOptions().find((a) => a.pubkey === select.value);
    noteEl.textContent =
      active === undefined
        ? ""
        : active.isDemo
          ? "Demo fixture identity — not your real profile, not a real merchant/customer."
          : "Your real local profile, acting as this store's merchant.";
  }
}

/** Keeps the Commerce screen's and Merchant screen's selectors mirrored to ONE shared identity — see this section's own header for why two selectors exist at all (both screens need the control visible without cross-navigating). */
function setCommerceActingAs(pubkey: string): void {
  commerceActingAsPubkey = pubkey;
  byId<HTMLSelectElement>("commerce-acting-as").value = pubkey;
  byId<HTMLSelectElement>("commerce-merchant-acting-as").value = pubkey;
}

/** Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — re-populates BOTH "Acting as" selectors so the real local-identity option appears the moment a profile becomes ready, mirroring the startup call's own "populate both, unconditionally" discipline (see that call's own comment further below) rather than only lazily on next screen visit. */
function refreshCommerceActorOptionsForRealIdentity(): void {
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
    return "Waiting on the buyer to review and submit this order. You can safely close this and come back later — nothing is lost. Reopen this order to see whether they've submitted it.";
  }
  if (status === "submitted" && isBuyer && !isSeller) {
    return "Submitted — waiting on the seller to accept or reject. You can safely close this and come back later; reopen this order to see their decision.";
  }
  if (status === "accepted" && isSeller && !isBuyer) {
    return "Accepted — waiting on the buyer to pay. Reopen this order later to see whether payment has arrived.";
  }
  if (status === "paid" && isBuyer && !isSeller) {
    return "Payment confirmed — waiting on the seller to fulfill your order. Reopen this order later to check progress.";
  }
  if (status === "fulfilling" && isSeller && !isBuyer) {
    return "Marked fulfilling — waiting on the buyer to confirm they received it. Reopen this order later to see whether they have.";
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
async function onCommerceOpenPurchasedContentClick(): Promise<void> {
  if (currentCommerceOrder === null) return;
  clearError("commerce-order-purchased-content-error");
  const btn = byId<HTMLButtonElement>("commerce-order-purchased-content-btn");
  btn.disabled = true;
  try {
    const result = await window.fedosApp.commerceMediaGrantRedeem(currentCommerceOrder.id, commerceActingAsPubkey);
    if (result.outcome !== "ok" || result.contentBase64 === undefined) {
      const reason = result.reason === "no-grant-on-file" || result.reason === "order-not-qualifying"
        ? "No protected digital content is available for this order yet."
        : (result.reason ?? result.outcome);
      showCommerceError("commerce-order-purchased-content-error", { outcome: result.outcome, reason });
      return;
    }
    byId("commerce-order-purchased-content-result").removeAttribute("hidden");
    const link = byId<HTMLAnchorElement>("commerce-order-purchased-content-link");
    link.href = `data:${result.contentType ?? "application/octet-stream"};base64,${result.contentBase64}`;
    link.download = "purchased-content";
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
  showAppScreen("commerce-order");
  renderCommerceOrderScreen();
  void refreshCommerceDeliveryStatus();
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
  void refreshCommerceDeliveryStatus();
  void refreshCommerceMyOrdersList();
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

async function refreshCommerceMyOrdersList(): Promise<void> {
  const result = await runCommerceAction([], "commerce-error", () => window.fedosApp.commerceOrdersListMine(commerceActingAsPubkey));
  const orders = result !== undefined && result.outcome === "ok" ? result.orders ?? [] : [];
  renderCommerceMyOrdersList(orders);
  updateCommerceNavBadge("commerce-my-orders-badge", orders);
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
  return li;
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
  if (action === "unpublish" && !window.confirm("Unpublish this listing? It will stop appearing in the Shop catalog for buyers immediately. You can publish it again later.")) {
    return;
  }
  if (btn.disabled) return;
  btn.disabled = true;
  clearError("commerce-merchant-products-error");
  try {
    const result =
      action === "publish"
        ? await window.fedosApp.commerceProductPublish(commerceActingAsPubkey, productId)
        : await window.fedosApp.commerceProductUnpublish(commerceActingAsPubkey, productId);
    if (result.outcome !== "ok") {
      showCommerceError("commerce-merchant-products-error", result);
      return;
    }
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
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg";
  wrap.appendChild(fileInput);
  const attachBtn = document.createElement("button");
  attachBtn.type = "button";
  attachBtn.textContent = "Attach Image";
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
          errorEl.textContent = result.reason ?? `attach failed: ${result.outcome}`;
          return;
        }
        fileInput.value = "";
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

async function refreshCommerceMerchantOrdersList(): Promise<void> {
  const result = await runCommerceAction([], "commerce-merchant-orders-error", () => window.fedosApp.commerceOrdersListIncoming(commerceActingAsPubkey));
  const list = byId("commerce-merchant-orders-list");
  list.textContent = "";
  if (result === undefined) {
    renderCommerceMerchantAttention([]);
    updateCommerceNavBadge("commerce-incoming-orders-badge", []);
    return;
  }
  if (result.outcome !== "ok") {
    showCommerceError("commerce-merchant-orders-error", result);
    renderCommerceMerchantAttention([]);
    updateCommerceNavBadge("commerce-incoming-orders-badge", []);
    return;
  }
  const orders = result.orders ?? [];
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
  if (!window.confirm(`Revoke "${label}"? This removes its trust for future messages. It does not delete copies that Device already has.`)) return;
  if (revokeBtn.disabled) return;
  revokeBtn.disabled = true;
  try {
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
  const items = (result.value as readonly { readonly transitionId: string; readonly acceptanceState: string; readonly openable: boolean; readonly peerAccountRef: unknown; readonly peerDeviceRef: string | null }[]) ?? [];
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No pending Identity Replacement items.";
    list.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    const glyph = IDENTITY_ACCEPTANCE_GLYPH[item.acceptanceState] ?? "–";
    li.textContent = `${glyph} Transition ${item.transitionId} – ${item.acceptanceState}`;
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
  if (decision === "accept" && !window.confirm("Accept this new identity? This is a trust decision you make yourself — it cannot be undone automatically.")) return;
  if (decisionButtons.some((b) => b.disabled)) return;
  for (const b of decisionButtons) b.disabled = true;
  try {
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
  } finally {
    for (const b of decisionButtons) b.disabled = false;
  }
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
  if (decision === "approve" && !window.confirm("Approve this deletion request? This never guarantees removal everywhere — see the warnings above.")) return;
  if (decisionButtons.some((b) => b.disabled)) return;
  for (const b of decisionButtons) b.disabled = true;
  try {
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

async function refreshSettings(): Promise<void> {
  clearError("settings-error");
  byId("settings-report").textContent = "";
  await reloadSettingsData();
  await refreshCommerceNetworkProfile();
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
  byId("commerce-network-profile-report").textContent = "Saved for this session. Resets to Local Only on the next launch.";
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

function renderReady(ready: FedosProfileCommandResult["ready"]): void {
  if (ready === undefined) return;
  byId("ready-label").textContent = ready.displayLabel;
  byId("ready-account").textContent = ready.accountPublicIdentifier;
  byId("ready-device").textContent = ready.localDeviceId;
  byId("ready-trust").textContent = ready.deviceTrustState;
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
    return;
  }
  if (status.presence === "absent") {
    showScreen("welcome");
    return;
  }
  if (status.presence === "recovery-required") {
    renderRecoveryScreen("recovery-required");
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
    setBusy(false, "create-submit");
  }

  if (result.outcome === "ok") {
    byId<HTMLInputElement>("create-label").value = "";
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
    setBusy(false, "unlock-submit");
  }

  if (result.outcome === "ok") {
    renderReady(result.ready);
  } else if (result.outcome === "recovery-required") {
    renderRecoveryScreen(coarseErrorCode(result));
  } else {
    byId("unlock-failed-reason").textContent = "The profile remains locked.";
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

byId<HTMLButtonElement>("welcome-create-btn").addEventListener("click", () => {
  showScreen("create");
});
byId<HTMLButtonElement>("create-submit").addEventListener("click", () => {
  void onCreateSubmit();
});
byId<HTMLButtonElement>("unlock-submit").addEventListener("click", () => {
  void onUnlockSubmit();
});
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
});
byId<HTMLButtonElement>("nav-commerce").addEventListener("click", () => {
  showAppScreen("commerce");
  void refreshCommerceCatalogList();
});
byId<HTMLButtonElement>("nav-commerce-merchant").addEventListener("click", () => {
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

// Conversations / chat.
byId<HTMLInputElement>("conversations-filter").addEventListener("input", () => {
  renderConversationsList(byId<HTMLInputElement>("conversations-filter").value);
});
byId<HTMLButtonElement>("invite-submit").addEventListener("click", () => void onInviteSubmit());
byId<HTMLButtonElement>("chat-back").addEventListener("click", () => {
  currentConversationId = null;
  showAppScreen("conversations");
  void refreshConversationsList();
});
byId<HTMLButtonElement>("chat-send").addEventListener("click", () => void onChatSend());

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
