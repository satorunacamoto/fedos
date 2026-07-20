/**
 * Secure Runtime Alpha 4181-4260 — page script (Phase E). Runs inside the
 * loaded page itself (an isolated Chromium page context, NOT the preload/
 * Node context) — has NO import of any kind, mirroring
 * `fedos_electron_spike_renderer.ts`'s own convention exactly: it reads
 * ONLY `window.fedosNavigation` (the frozen bridge the preload already
 * placed there) and writes DOM. No business logic — every branch below
 * reads a field the Controller's own `render()`/`sessionState()` output
 * already computed; nothing here re-derives a fact.
 *
 * Plain script (not a module): compiles to un-wrapped global-scope JS, so
 * it loads via a plain `<script src="...">` tag with no bundler.
 */

let currentConversationId: string | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`fedos-nav renderer: missing element #${id}`);
  return el as T;
}

function setStatus(message: string): void {
  byId("status").textContent = message;
}

function renderModel(model: unknown): void {
  if (model === null || typeof model !== "object") return;
  const m = model as Record<string, unknown>;

  const titleEl = byId("window-title");
  if (typeof m.title === "string") {
    titleEl.textContent = m.title;
    document.title = m.title;
  }

  const navState = m.navigationState as Record<string, unknown> | undefined;
  const navStateEl = byId("navigation-state");
  if (navState !== undefined && typeof navState.kind === "string") {
    currentConversationId = typeof navState.conversationId === "string" ? navState.conversationId : null;
    navStateEl.textContent =
      navState.kind === "open-failed"
        ? `${navState.kind}: ${String(navState.conversationId)} (${String(navState.outcome)}: ${String(navState.reason)})`
        : navState.kind === "empty"
          ? "empty"
          : `${navState.kind}: ${String(navState.conversationId)}`;
  }

  byId<HTMLButtonElement>("back-btn").disabled = m.canGoBack !== true;
  byId<HTMLButtonElement>("forward-btn").disabled = m.canGoForward !== true;

  const detailEl = byId("detail");
  const detail = m.conversationDetail as Record<string, unknown> | undefined;
  detailEl.textContent = detail !== undefined && detail.kind === "content" ? JSON.stringify(detail.content, null, 2) : "";

  const list = m.conversationList as Record<string, unknown> | undefined;
  const listEl = byId<HTMLUListElement>("conversation-list");
  listEl.textContent = "";
  if (list !== undefined && list.kind === "content") {
    const content = list.content as { items?: readonly Record<string, unknown>[] };
    for (const item of content.items ?? []) {
      const li = document.createElement("li");
      li.textContent = String(item.conversationId);
      const idValue = item.conversationId;
      li.addEventListener("click", () => {
        void openOrSwitch(typeof idValue === "string" ? idValue : "");
      });
      listEl.appendChild(li);
    }
  }
}

async function openOrSwitch(conversationId: string): Promise<void> {
  if (conversationId.length === 0) return;
  setStatus("");
  const model = currentConversationId === null ? await window.fedosNavigation.openConversation(conversationId) : await window.fedosNavigation.switchConversation(conversationId);
  renderModel(model);
}

async function refreshList(): Promise<void> {
  renderModel(await window.fedosNavigation.listConversations());
}

byId<HTMLButtonElement>("back-btn").addEventListener("click", () => {
  void window.fedosNavigation.back().then(renderModel);
});
byId<HTMLButtonElement>("forward-btn").addEventListener("click", () => {
  void window.fedosNavigation.forward().then(renderModel);
});
byId<HTMLButtonElement>("close-btn").addEventListener("click", () => {
  void window.fedosNavigation.closeConversation().then(renderModel);
});
byId<HTMLButtonElement>("pin-btn").addEventListener("click", () => {
  if (currentConversationId === null) {
    setStatus("no conversation open to pin/unpin");
    return;
  }
  void window.fedosNavigation.pinConversation(currentConversationId).then(renderModel);
});
byId<HTMLButtonElement>("new-window-btn").addEventListener("click", () => {
  void window.fedosNavigation.newWindow();
});
byId<HTMLButtonElement>("refresh-list-btn").addEventListener("click", () => {
  void refreshList();
});

void refreshList();
