# ZeusTek Diving

Editable source for the ZeusTek dive logbook, planning dashboard, and offline PWA.

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
