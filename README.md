# ZeusTek Diving

Editable source for the ZeusTek dive logbook, planning dashboard, and offline PWA.

## Current verified baseline for pre-coding

- Live application: **1.0.23 / Sites90**.
- Canonical production: https://zeustek-dashboard.amzeus.chatgpt.site/; PWA start URL `/?source=pwa` on the same origin.
- Canonical Sites project: `appgprj_6a91926878b48191a80d70f1681ef135`.
- Published source: `487ab0bfd36dd04323ad96b7ac674a59f842a04d`.
- Production deployment: `appgdep_6aa874f286888191b17686ee44eb2144`.
- Verified gate: 255 tests / 50 files, TypeScript and production/PWA build PASS; production smoke PASS; all 66 Logbook entries retained.

GitHub main is the source baseline for new pre-coded candidates. The application source matches the verified production release; documentation includes post-publication evidence. Use the current files rather than an older Sites snapshot or draft PR. No secrets, live databases, credentials, user uploads or synthetic test files are included.

T00–T07 are complete. The three Equipment owner snags are released and await owner/Gemma acceptance. **T08 is preserved but BLOCKED_DEPLOYMENT**: its separate rolled-back 1.0.22 candidate overflowed the phone pathway selector. T08 implementation is not part of this healthy baseline; syncing GitHub does not repair or accept it. No later roadmap task is started by this sync.

See [the pre-coding source contract](docs/PRECODING_BASELINE.md), [Equipment release evidence](docs/equipment-owner-snags-release.md), and `ZEUSTEK_Diving_Upgrade_Progress.md` before preparing a candidate.

## Source import

Imported from the original Sites Git repository, using the exact source commit for version 78:

- Site: https://zeustek-dashboard.amzeus.chatgpt.site
- Project: `appgprj_6a91926878b48191a80d70f1681ef135`
- Source commit: `26f1d360916fcf3a6dcca5eb3eff99d99e21567f`
- Import date: 2026-09-13

The import includes authored application code, assets, dependencies and lockfiles, database migrations, configuration, and existing tests. It excludes installed dependencies, local environment files, and production build output. Bundled third-party browser libraries retain their existing license files.

The repository's existing issue templates, CONTRIBUTING.md, and LICENSE are retained. This import does not deploy the site or merge into main.

## Local development

Use Node.js 22.13 or newer and the package manager declared in package.json (pnpm 10.15.1).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm typecheck
pnpm test
pnpm build
```

The app uses Cloudflare Workers with the `DB` D1 binding and `FILES` R2 binding. The hosting manifest retains the existing Sites project identity. Cloud environment values, credentials, live databases, and user uploads are not part of this source import. Build output is ignored; deployment is a separate, explicitly approved operation.

See CONTRIBUTING.md for the existing contribution workflow and docs/ for implementation records.
