<!--
Thanks for contributing to FedOS.

Please open an Issue or a Discussion before starting substantial work, so
you do not spend effort on something that will be declined for scope
reasons. Small, focused fixes are welcome without prior discussion.

If this PR fixes a SECURITY vulnerability, do NOT describe the
vulnerability here. A public PR description is as public as a public
Issue. Report it privately first (see SECURITY.md) and coordinate the
fix from there.
-->

## What does this change?

<!-- One or two sentences. What is different after this PR? -->

## Why?

<!-- The problem being solved. Link the Issue or Discussion if there is one. -->

Fixes #

## How was it verified?

<!--
Name what you actually ran, and paste the real result — not what you
expect would happen. "Not run" is an acceptable and useful answer;
a false pass is not.
-->

- [ ] `npm run typecheck`
- [ ] `npx vitest run` (or the focused test files relevant to this change)
- [ ] `cargo test --release --manifest-path packages/fedos-core-rust/Cargo.toml`
- [ ] Built and exercised the real packaged app
- [ ] Not applicable, because:

<details>
<summary>Output</summary>

```
paste real output here
```

</details>

## Security and scope review

- [ ] This PR makes **no** change to cryptography, key handling, the
      Master Seed, or the ratchet/protocol layer.
      <!-- If it does, say so explicitly below and expect a slow review. -->
- [ ] This PR adds **no** telemetry, analytics, crash reporting, auto-update,
      or any other new outbound network call.
- [ ] This PR adds **no** new claim about security properties that is not
      already true and demonstrated in the repository.
- [ ] This PR contains **no** secret, private key, real profile data, test
      profile, local absolute path, or personal information.
- [ ] New dependencies: none.
      <!-- If any, list them and why an existing one would not do. -->

## Licensing

- [ ] I am submitting this work under the project's license
      (**MPL-2.0**, see [`LICENSE`](../LICENSE)), and I have the right to
      do so.
- [ ] Any third-party code or data included here is compatible, and its
      origin and license are recorded alongside it — not left implicit.
      <!-- See LICENSE_STATUS.md §4 for how existing third-party data is handled. -->

## Anything reviewers should know?

<!--
Known limitations, things you deliberately left out, parts you are
unsure about. Flagging a weak spot yourself is more useful than having a
reviewer find it.
-->
