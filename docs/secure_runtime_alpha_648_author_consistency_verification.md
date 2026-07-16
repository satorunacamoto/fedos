# Secure Runtime Alpha 648 — Author Consistency Verification

Stage 8. Verified by `test/secure_runtime_alpha_648_author_consistency_verification.test.ts`:

- Resolved identity maps deterministically — the SAME
  `FedosIdentityDescriptor` always yields the SAME
  `FedosBoardAuthorReference` fields, byte-for-byte, across repeated
  calls.
- Anonymous-local behavior is explicit — `AnonymousLocalPublicAuthorAuthority`
  always resolves `"anonymous-local"`, never `"resolved"`, regardless of
  what a wrapped `DesktopApplication` might otherwise report (it wraps
  nothing at all).
- The caller cannot supply an author, a `publicIdentifier`, or an
  `identityId` — confirmed by type inspection:
  `CreatePublicThreadCommand`/`ReplyToPublicThreadCommand`
  (`fedos_board_runtime_command_types.ts`) carry no such field, and
  `FedosBoardRuntime`'s own command methods never accept one as a
  parameter.
- The Publisher cannot alter canonical author — no
  `FedosBoardOutboxPublisher` implementation anywhere in this codebase
  receives a `FedosPublicAuthorResolution`/`FedosBoardAuthorReference`
  of any kind (confirmed by source inspection of
  `src/board/outbox/fedos_board_outbox_publisher.ts` and its
  implementations — unmodified by this Arc).
- Independent runtimes do not share injected author state — two
  `FedosDesktopPublicAuthorAuthority` instances constructed over two
  DIFFERENT `FedosDesktopHost`s never observe each other's identity;
  two instances over the SAME Host correctly observe the SAME identity
  (mirrors `FedosBoardRuntime`'s own Alpha 623 "no singleton"
  guarantee).
- An imported protocol post retains its imported author when merely
  read — `FedosBoardRuntime.findPost()`/`recentFeed()`/`thread()`
  (Alpha 632) never call any `FedosPublicAuthorAuthority` — reads never
  touch author resolution.
- A new local post never impersonates an imported author — Authority
  resolution never reads `FedosBoardPost.source` or any existing post;
  it is entirely a function of the CURRENT `DesktopApplication` state,
  never of prior posts.
