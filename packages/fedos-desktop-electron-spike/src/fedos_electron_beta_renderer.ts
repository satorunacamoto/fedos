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
    title.innerHTML = "";
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
      revokeBtn.addEventListener("click", () => void onDeviceRevoke(d.deviceId, d.devicePublicKeyRef as string, d.label ?? d.deviceId));
      li.appendChild(revokeBtn);
    }
    list.appendChild(li);
  }
}

async function onDeviceRevoke(deviceId: string, devicePublicKeyHex: string, label: string): Promise<void> {
  if (!window.confirm(`Revoke "${label}"? This removes its trust for future messages. It does not delete copies that Device already has.`)) return;
  const result = await window.fedosApp.deviceRevoke(deviceId, devicePublicKeyHex);
  if (result.outcome !== "ok") {
    showError("devices-error", result);
    return;
  }
  await refreshDevicesList();
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
  renderIdentityTransitionDetail(result);
}

function renderIdentityTransitionDetail(result: { readonly outcome: string; readonly value?: unknown; readonly reason?: string }): void {
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
  acceptBtn.addEventListener("click", () => void decideIdentityTransition("accept"));
  container.appendChild(acceptBtn);
  const rejectBtn = document.createElement("button");
  rejectBtn.type = "button";
  rejectBtn.textContent = "Reject";
  rejectBtn.addEventListener("click", () => void decideIdentityTransition("reject"));
  container.appendChild(rejectBtn);
  const deferBtn = document.createElement("button");
  deferBtn.type = "button";
  deferBtn.textContent = "Defer";
  deferBtn.addEventListener("click", () => void decideIdentityTransition("defer"));
  container.appendChild(deferBtn);
}

async function decideIdentityTransition(decision: "accept" | "reject" | "defer"): Promise<void> {
  if (currentIdentityTransitionSelection === null) return;
  if (decision === "accept" && !window.confirm("Accept this new identity? This is a trust decision you make yourself — it cannot be undone automatically.")) return;
  const result =
    decision === "accept" ? await window.fedosApp.identityTransitionAccept() : decision === "reject" ? await window.fedosApp.identityTransitionReject() : await window.fedosApp.identityTransitionDefer();
  renderIdentityTransitionDetail(result);
  await refreshIdentityTransitionList();
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
  renderDeletionRequestDetail(result);
}

function renderDeletionRequestDetail(result: { readonly outcome: string; readonly value?: unknown }): void {
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
    approveBtn.addEventListener("click", () => void decideDeletionRequest("approve"));
    container.appendChild(approveBtn);
    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.textContent = "Reject";
    rejectBtn.addEventListener("click", () => void decideDeletionRequest("reject"));
    container.appendChild(rejectBtn);
  }
}

async function decideDeletionRequest(decision: "approve" | "reject"): Promise<void> {
  if (currentDeletionRequestId === null) return;
  if (decision === "approve" && !window.confirm("Approve this deletion request? This never guarantees removal everywhere — see the warnings above.")) return;
  await (decision === "approve" ? window.fedosApp.deletionRequestApprove() : window.fedosApp.deletionRequestReject());
  byId("deletion-request-detail").textContent = "";
  await refreshDeletionRequestList();
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
    if (report.outcome === "persisted-pending-runtime-restart" || report.outcome === "persisted-pending-application-restart") {
      byId("settings-report").textContent = "Saved. Restart the application for Relay changes to take effect.";
    } else if (report.outcome === "persisted-and-applied" || report.outcome === "no-change") {
      byId("settings-report").textContent = "Saved.";
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
  showScreen("ready");
  void renderBetaStatus();
  showAppScreen("conversations");
  void refreshConversationsList();
  setAppStatus("");
}

function routeByStatus(status: FedosProfileStatusResult): void {
  if (status.presence === "ready") {
    byId("ready-label").textContent = status.displayLabel ?? "";
    byId("ready-account").textContent = status.accountPublicIdentifier ?? "";
    byId("ready-device").textContent = status.localDeviceId ?? "";
    localAccountPublicIdentifier = status.accountPublicIdentifier ?? "";
    showScreen("ready");
    void renderBetaStatus();
    showAppScreen("conversations");
    void refreshConversationsList();
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
  byId("recovery-explain").textContent = RECOVERY_EXPLANATIONS[outcomeCode] ?? "This profile could not be unlocked. You can retry, restore from an Archive, or quit.";
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

async function onLock(): Promise<void> {
  stopChatPolling();
  setBusy(true, "lock-btn");
  try {
    await window.fedosProfile.lock();
  } finally {
    setBusy(false, "lock-btn");
  }
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

// Search.
byId<HTMLButtonElement>("search-submit").addEventListener("click", () => void onSearchSubmit());

// Archive.
byId<HTMLButtonElement>("archive-export-choose-dest").addEventListener("click", () => void onArchiveChooseExportDestination());
byId<HTMLButtonElement>("archive-export-submit").addEventListener("click", () => void onArchiveExportSubmit());
byId<HTMLButtonElement>("archive-restore-choose-source").addEventListener("click", () => void onArchiveChooseSource());
byId<HTMLButtonElement>("archive-restore-inspect").addEventListener("click", () => void onArchiveRestoreInspect());
byId<HTMLButtonElement>("archive-restore-submit").addEventListener("click", () => void onArchiveRestoreSubmit());

// Settings.
byId<HTMLButtonElement>("settings-relay-add").addEventListener("click", onSettingsRelayAdd);
byId<HTMLButtonElement>("settings-save").addEventListener("click", () => void onSettingsSave());

void refreshFromStatus();
})();
