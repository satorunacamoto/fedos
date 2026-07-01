# Runtime Diagnostics — Safety Rules (binding)

**Status: this document adds no code.** It fixes, in writing, the safety
contract that `src/render/runtime_status.ts` and the `?runtimeStatus=1` Worker
route (Stages 50–54) already implement, so future extensions to Runtime
diagnostics cannot accidentally regress it. If a future change to this area
would violate a rule below, the rule wins — change the code, not this
document, or open a new Stage to renegotiate the rule explicitly.

This is a safety contract, not a marketing claim. Nothing here should be read
as "secure", "audited", or "complete" — it states what the diagnostics layer
does and does not do, and why.

---

## 1. Purpose

Runtime diagnostics exist for exactly one job: **read-only inspection of which
implementation `createRuntime(env)` selected** for each of the ten `AppRuntime`
boundaries (`eventCache`, `assetCache`, `spaceDirectory`, `metadataIndex`,
`signatureVerifier`, `promotionProvider`, `recommendationProvider`,
`relayPublisher`, `notificationBridge`, `paymentProvider`).

- **Read-only inspection.** Diagnostics report a snapshot of already-constructed
  objects. They never change runtime state, never write anywhere, and never
  issue a request on the caller's behalf.
- **Selected component TYPE LABELS only.** The unit of information is "which
  class is this" (e.g. `"InMemoryEventCache"`, `"EdgeRecPromotionProvider"`,
  `"NoopPaymentProvider"`) — never that component's internal data, configuration,
  or content.
- **No health probing.** Diagnostics never call a provider/cache/bridge method
  to check if it is "healthy", "reachable", or "authenticated". A component that
  is selected but misconfigured (e.g. a real endpoint that would 500) looks
  identical here to one that is perfectly fine — that is by design. Health
  probing is explicitly a *future, separate, disabled-by-default* boundary (see
  §8), not something this layer does today or should grow into silently.
- **No external calls.** Building or rendering a diagnostics view issues no
  `fetch`, opens no socket, and contacts no external system, ever.

## 2. What MAY be shown

Only the following, and nothing else, may appear in the HTML page
(`renderRuntimeStatusPage`) or the JSON export (`renderRuntimeStatusJson`):

- **Runtime mode** — `AppRuntime.mode` (`"test"` | `"local"` | `"cloudflare"`).
- **Component name** — the fixed `AppRuntime` field name (e.g. `"eventCache"`),
  from the fixed `COMPONENT_FIELDS` list.
- **Component category** — one of the five fixed `RuntimeComponentCategory`
  values: `"cache"`, `"storage"`, `"provider"`, `"bridge"`, `"security"`.
- **Constructor label, or the safe fallback** — the implementation's
  `constructor.name` (a property READ, never a method call), or the fixed
  string `"(unnamed implementation)"` when the component is a plain object
  literal (today: only `signatureVerifier`, since `NobleSignatureVerifier` is
  not a class instance).
- **Coarse grouping** — the cache/storage/provider/bridge/security sections
  themselves, and their fixed display order.

Nothing else is read from `RuntimeEnv` or `AppRuntime` by this layer. If a
future field is added to either type, it does not automatically appear here —
someone has to deliberately wire it in, and when they do, §8 applies.

## 3. What MUST NEVER be shown

The following must never appear in the HTML page, the JSON export, a log line
this layer emits, or any future extension of it:

- API keys (e.g. `PROMOTION_API_KEY`, `RECOMMENDATION_API_KEY`).
- Endpoint URLs (e.g. `PROMOTION_ENDPOINT`, `RECOMMENDATION_ENDPOINT`, any
  `https://`/`http://` string sourced from env).
- Tokens (bearer tokens, session tokens, auth headers of any kind).
- Secrets of any kind (seeds, private keys, passphrases, encrypted blobs).
- Raw `RuntimeEnv`/`Env` values — the diagnostics layer never reads `env`
  directly at all; it only ever receives the already-constructed `AppRuntime`.
- Actor/viewer pubkeys — even when present on the incoming request (e.g.
  `?actor=`), diagnostics never read or forward it.
- Payment metadata — amounts, currencies, rails, `PaymentRequest`/
  `PaymentDecision` contents.
- Notification payloads — titles, bodies, channels, targets.
- Asset bytes — no `ArrayBuffer`, no base64, no `data:` URI, nothing an
  `AssetCache` holds.
- Provider response bodies — a real `EdgeRecPromotionProvider`'s HTTP response,
  parsed or raw, must never reach this layer.
- Stack traces — including from a provider/cache method throwing; diagnostics
  do not catch or surface exceptions from components it does not call (and it
  calls none — see §4).

If implementing a future feature would require any of the above to appear on
this page, it does not belong on this page. Build it as its own explicitly
gated boundary instead (mirroring how payment/notification/promotion previews
were built as separate, disabled-by-default seams in Stages 44–53).

## 4. What MUST NEVER be called

Building (`buildRuntimeStatusView`) or rendering
(`renderRuntimeStatusPage`/`renderRuntimeStatusJson`/
`serializeRuntimeStatusView`) a diagnostics view must never invoke:

- `promotionProvider.getPromotions` / `recommendationProvider.getRecommendations`
- `paymentProvider.requestPayment`
- `notificationBridge.notify`
- `relayPublisher.publish`
- `assetCache.get` / `.put` / `.has` / `.delete` / `.clear`
- `eventCache.get` / `.set` (or any cache read/write)
- Any `spaceDirectory`/`metadataIndex` lookup (`.list()`, `.get()`,
  `.queryEvents()`, etc.)
- Any external `fetch`/`send` of any kind

The only property read permitted on a component is `.constructor.name` (see
`describeComponent` in `src/render/runtime_status.ts`) — a plain JS property
access, not an invocation. This is enforced today by tests that wrap each
component in a call-counting spy and assert every counter stays at `0` after
building/rendering a view (see `test/render_runtime_status.test.ts` and
`test/worker_runtime_status.test.ts`).

## 5. HTML diagnostics rules

- **`escapeHtml` is mandatory** on every displayed string — mode, component
  name, category, and label. No field is trusted, even though today's values
  are all internally-controlled constants/class names.
- **No links to endpoints.** The HTML page never renders an `<a href>` pointing
  at a provider endpoint, and never renders a raw endpoint string at all (see
  §3).
- **No expandable raw object dumps.** The page never serializes or
  pretty-prints an entire component object, `AppRuntime`, or `RuntimeEnv` — only
  the three allowlisted fields per component (name/label/category).
- **No stack traces.** See §3 and §4 — nothing here catches exceptions from a
  component method, because nothing here calls one.

## 6. JSON diagnostics rules

- **Allowlist fields only.** `serializeRuntimeStatusView` reconstructs each
  component/section field-by-field (`name`, `label`, `category`) rather than
  spreading or passing through the view object. Adding a field to
  `RuntimeStatusView` or `AppRuntime` does NOT automatically add it to the JSON
  — someone has to deliberately extend the allowlist, and when they do, §3
  still applies to whatever they add.
- **Never `JSON.stringify` the raw runtime.** Neither `AppRuntime` nor
  `RuntimeEnv` is ever passed directly to `JSON.stringify`. Only the
  purpose-built `RuntimeStatusJson` shape is serialized.
- **No functions/methods.** The serialized shape contains only strings and
  arrays of plain objects — never a function reference, never a class
  instance, never a `Promise`.
- **`generatedAt` is opt-in only.** `serializeRuntimeStatusView(view,
  generatedAt?)` omits `generatedAt` unless a caller explicitly passes one; the
  function itself never calls `Date.now()`. This keeps the export
  deterministic/reproducible when a caller wants that, and avoids silently
  stamping wall-clock time into a read-only diagnostic by default.
- **`format=json` is a strict allowlist, not a denylist.** `worker.ts`'s
  `isRuntimeStatusJsonRequested(url)` returns `true` only for the EXACT string
  `"json"`; any other value (`"xml"`, `"yaml"`, `"JSON"`, `"1"`, an empty
  string, or absence) falls back to the HTML page. A typo or unexpected value
  must never accidentally serve an unintended format — it must always resolve
  to the known-safe default (HTML).

## 7. Test policy for this area

Every change that touches `src/render/runtime_status.ts` or the
`?runtimeStatus=1` Worker route must be covered by tests that:

- **Spy on every component method** the runtime holds (asset cache, promotion/
  recommendation providers, notification bridge, payment provider, relay
  publisher) and assert the call count is `0` after building and rendering a
  view, in both the HTML and JSON paths.
- **Assert secret/endpoint/API-key absence** by constructing a runtime from an
  env that includes fake-but-recognizable secret-shaped values (e.g.
  `PROMOTION_API_KEY: "sk_live_should_never_appear"`,
  `PROMOTION_ENDPOINT: "https://secret-endpoint.example/api"`) and checking the
  rendered HTML/JSON never contains them, and never contains a bare `https://`/
  `http://` substring at all.
- **Assert invalid-`format` fallback** by requesting `?runtimeStatus=1&format=`
  with a range of not-`"json"` values and confirming every one of them returns
  `text/html`, never `application/json`.
- **Assert no raw-runtime stringify** — e.g. that the JSON output never equals
  (or contains as a substring) `JSON.stringify(runtime)` for a runtime carrying
  a distinguishing sentinel object, and that nothing in the output has
  `typeof value === "function"` after a deep walk.

These are enforced today in `test/render_runtime_status.test.ts`,
`test/worker_runtime_status.test.ts`, and `test/runtime_status_json.test.ts`.

## 8. Rules for future extensions

- **New component → category + safe label required.** Before adding a new
  `AppRuntime` field to the diagnostics view, assign it one of the five fixed
  categories (or propose a new category explicitly, as its own decision) and
  confirm `describeComponent` produces a sensible label for it (a real class
  name, or an explicit safe fallback string) — never leave it to print
  `"Object"` or `"[object Object]"`.
- **Calling a status method requires proof of inertness.** If a future
  component exposes something like `getStatus()`/`getCapabilities()` (as
  `NotificationBridge`/`PaymentProvider` already do) and a future stage wants to
  surface it here, it may be called ONLY if it is proven side-effect-free and
  issues no I/O — document that proof next to the call, and it must still obey
  §3 (its return value goes through the same allowlist/escaping, never raw).
  Absent that proof, do not call it from this layer.
- **External health checks are a separate, disabled-by-default Stage.** A
  liveness/reachability check (actually pinging an endpoint, opening a
  connection, calling a provider for real) is explicitly OUT OF SCOPE for this
  diagnostics layer forever. It must ship as its own boundary, gated the way
  Stage 49/52 gated real provider invocation (explicit dual-flag opt-in,
  disabled by default), and must never be silently folded into
  `?runtimeStatus=1`.
- **Diagnostics is not an audit log.** This layer answers "what is currently
  selected", not "what happened". It holds no history, no timestamps beyond an
  optional caller-supplied `generatedAt`, and no request/response record. Do
  not repurpose it as a logging or observability sink — that is a different
  boundary with different (and stricter) data-handling requirements.
