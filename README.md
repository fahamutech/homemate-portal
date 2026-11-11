# homemate-portal

The HomeMate Africa backoffice: the web app HomeMate staff use to run the
marketplace. It is a React + TypeScript single-page app built with Vite,
installable as a PWA, and it talks only to
[homemate-functions](https://github.com/fahamutech/homemate-functions). The
customer, broker and landlord app is
[homemate-mobile](https://github.com/fahamutech/homemate-mobile).

## What it covers

- **Dashboard**: what needs attention today, including partner applications
  waiting for a decision.
- **Users and staff**: customer accounts, their roles, identity checks (KYC)
  and staff access.
- **Partners**: broker and landlord applications, with approval and
  rejection.
- **Properties**: listings, their details, photos and location.
- **Enquiries and rentals**: the customer journey from enquiry to tenancy.
- **Payments**: the payment queue, collections, commissions, disbursements,
  the ledger and the payment methods customers see. A customer's "I have
  paid" settles nothing until it is reconciled here.
- **Dictionaries, settings and audit**: reference data, configuration, and
  who changed what.

## Running it locally

You need Node 22+ and a running `homemate-functions` (by default on
`http://localhost:3001`).

```bash
npm ci
npm run dev        # http://localhost:5173
```

Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` the backend was started
with.

### Which server it talks to

| Build | `VITE_API_BASE_URL` set | Talks to |
|---|---|---|
| `npm run dev` | no | `http://localhost:3001` |
| `npm run build` | no | production (`.env.production`) |
| any | yes | whatever was set |

To point a dev server somewhere else, copy `.env.example` to `.env.local` and
edit it. `.env` and `.env.local` are gitignored; `.env.production` is
committed on purpose because it holds only the public API URL.

## Checks

```bash
npm run lint       # oxlint
npm test           # vitest + Testing Library
npm run build      # typecheck, then the production bundle in dist/
```

Tests run against in-memory fakes of the API (`src/api/*.fake.ts`), so they
need no backend.

## How it is put together

```
src/
  api/             the HTTP client for the admin API, and its fakes
  features/auth/   sign-in and the admin session
  features/admin/  one page per backoffice section
  components/      shared UI
  design-tokens/   colours, type and spacing from the design system
  pwa/             install prompt and the "new version" banner
  config/env.ts    the API URL rules above
```

## Deploying

`main` is protected: changes arrive through a reviewed pull request with
green CI. A push to `main` builds the app and deploys `dist/` to Firebase
Hosting. Open tabs notice the new `version.json` and offer a reload.

## Secrets

This repository is public, and everything in the built bundle is public too.
The portal holds no secret of its own: staff sign in, and the session token
is issued by the API.

- The Firebase deploy credential lives only in GitHub Actions secrets
  (`FIREBASE_SERVICE_ACCOUNT_HOMEMATETZ`).
- Never put a key in a `VITE_*` variable: Vite copies those into the bundle
  anyone can download.
- `.github/workflows/secret-scan.yml` runs [gitleaks](https://github.com/gitleaks/gitleaks)
  over the full history on every push and pull request.
- If a secret is ever committed, **rotate it first**, then remove it.

See [SECURITY.md](SECURITY.md) to report a vulnerability.
