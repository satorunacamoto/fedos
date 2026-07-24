# 15. Updates

## Options compared

- **No auto-update V1** — ship versioned, manually-downloaded builds;
  users reinstall/replace to upgrade. Zero new dependency, zero new
  infrastructure, zero new attack surface (`17`'s own "update-channel
  compromise" risk is simply not applicable).
- **Signed manual download** — the same as above, plus a real download
  page/location and (ideally) code signing (`14`) so the download is
  trusted. Still no auto-update CODE.
- **Built-in auto-update (`electron-updater` or similar)** — requires a
  signed update feed and SOME hosting location for update artifacts/
  manifests. Hosting an update feed is itself a form of "remote
  infrastructure this application depends on" — worth naming plainly:
  this sits close to, though is distinct from, the "no cloud sync"/"no
  remote web hosting" Absolute Prohibitions this stack's own Arcs have
  repeated throughout — an update FEED is not the same thing as a
  message-sync/relay service, but it is still new, real, externally-hosted
  infrastructure this project does not currently have or need for
  anything else.
- **Package-manager distribution (winget/Chocolatey/etc.)** — still
  requires code signing (`14`) plus manifest submission/maintenance to a
  third-party repository; defers the update MECHANISM to that
  package manager, at the cost of a submission/review process this
  review cannot evaluate without knowing the actual distribution intent.

## Recommendation

**No auto-update for V1.** Manual, versioned, signed-when-a-certificate-is-available
portable builds only (`12`). This is the smallest honest V1: it requires
no new hosting infrastructure, no update-feed signing scheme, and defers
the real question ("who distributes this, and how, long-term?") until
there is evidence to answer it (`12`'s own reasoning applies identically
here). Auto-update should be revisited only once a real distribution
channel/hosting decision has independently been made — not bundled into
an initial Electron adoption Arc.
