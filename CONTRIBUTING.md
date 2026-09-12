# Contributing to ZeusTek Diving

GitHub Issues are the canonical place to record reproducible bugs, regressions, and defects for this repository.

## Bug workflow

1. Create a **Bug report** issue and complete the reproduction details.
2. Add screenshots or recordings for visual problems where possible.
3. Include the affected route/URL and device/browser/PWA information.
4. A fix should normally be developed on a dedicated branch named `fix/<issue-number>-<short-name>`.
5. The fix should include appropriate tests or verification notes.
6. Open a pull request that references the issue with `Fixes #<issue-number>` when the change is ready.
7. Verify the behaviour in the deployed ZeusTek Diving site/PWA before the issue is considered complete.

## Security and data-loss problems

Mark anything involving possible data loss, corruption, security, or privacy clearly in the issue. Do not paste secrets, credentials, tokens, private keys, recovery material, or other sensitive data into GitHub issues.

## AI-assisted maintenance

Issues may be used as actionable work tickets for an AI coding agent. A useful issue should contain enough information to reproduce the fault without requiring the reporter to restate the problem in chat.
