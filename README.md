# Shoe Shop

An online storefront for a shoe business currently run through Instagram DMs and
phone calls. Customers browse the catalog with live per-size stock, order
themselves, and pay by Razorpay or cash on delivery. Orders land in one admin
dashboard with GST invoices.

> **Status:** feature-complete. Every build phase below is done — the
> storefront, checkout, payments, admin panel, policy pages and deployment
> config are all in place. Deploying it live from here on is account setup
> and filling in environment variables; see **Deploying** below.

---

## Stack

| Layer    | Choice                                                    |
| -------- | --------------------------------------------------------- |
| Frontend | React 19 + Vite + TypeScript, Tailwind v4, shadcn-style UI |
| State    | Redux Toolkit + RTK Query; cart in a persisted RTK slice   |
| Backend  | Node 22 + Express 5 + TypeScript                           |
| Database | MongoDB (Mongoose) — Atlas M0 in production                |
| Images   | Cloudinary                                                 |
| Payments | Razorpay + Cash on Delivery                                |
| Email    | Brevo SMTP via Nodemailer                                  |
| Hosting  | Vercel (client) · Render (API) · Atlas (database)          |

All three hosting tiers are free.

---

## Repository layout

```
apps/
  client/     React storefront + admin panel   → Vercel
  server/     Express API                      → Render
packages/
  shared/     Zod schemas, types, money helpers, constants
```

`packages/shared` is the API contract. A single Zod schema defines each payload;
the server validates requests with it and the client validates its forms with the
same schema. Rename a field and **both sides fail to compile** instead of silently
breaking checkout.

`shared` must be built before either app — every script below and every CI job
does this for you.

---

## Getting started

Requires **Node 22+** and a MongoDB you can reach (local `mongod`, Docker, or an
Atlas connection string).

```bash
git clone <this repo>
cd shoe-shop
npm ci

# Fill in your own values in both files
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env

npm run build:shared     # compile the contract package
npm run seed             # create the admin user + sample shoes
npm run dev              # server on :5000, client on :5173
```

Running MongoDB locally with Docker, if you need one:

```bash
docker run -d --name shoe-shop-db -p 27017:27017 mongo:7
```

---

## Deploying

Three free tiers, wired together. Do these roughly in order — Cloudinary,
Razorpay and Brevo have no dependency on each other, but Render and Vercel each
need to know the other's URL, so there's one round trip at the end where you
come back and fill in a value you didn't have yet.

### 1. Accounts

- **MongoDB Atlas** — create a free **M0** cluster. Under Database Access, add
  a user with a strong password. Under Network Access, allow `0.0.0.0/0` —
  Render's free tier has no static outbound IP, so anything narrower will
  intermittently refuse connections. Copy the connection string from
  Database → Connect → Drivers; this is `MONGODB_URI`.
- **Cloudinary** — create a free account. `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are all on the dashboard's
  landing page.
- **Razorpay** — create an account. Test mode works immediately with the
  `rzp_test_...` key pair from Settings → API Keys — enough to develop and
  demo checkout. **Live keys require KYC approval**, and that review checks
  that Terms, Privacy, Refund, Shipping and Contact pages are reachable on
  your live domain — which is exactly what phase 10 added, so deploy those
  first. Once you have a key pair (test or live), set
  `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`. The webhook secret
  (`RAZORPAY_WEBHOOK_SECRET`) comes later, in step 3, once the API has a real
  URL to register.
- **Brevo** — create a free account (300 emails/day). Under SMTP & API → SMTP,
  copy the login as `SMTP_USER` and generate an SMTP key as `SMTP_PASS`.
  `MAIL_FROM` must be a sender address verified in Brevo; `OWNER_EMAIL` is
  just your own inbox, for new-order alerts.

### 2. API → Render

This repo includes `render.yaml`, so Render can set the service up from the
blueprint rather than by hand:

1. [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints) → New Blueprint Instance → point it at this
   repo. Render reads `render.yaml` and creates the `shoe-shop-api` web
   service with the build/start commands and health check already filled in.
2. Fill in every environment variable the blueprint marked `sync: false` —
   `MONGODB_URI`, `JWT_SECRET` (generate with `openssl rand -base64 48`),
   `ADMIN_EMAIL`/`ADMIN_PASSWORD`, the Cloudinary, Razorpay and Brevo values
   from step 1, and `CLIENT_URL`. You won't have the real Vercel URL yet —
   use `http://localhost:5173` for now and come back once step 3 gives you
   the real one, or deploy Vercel first if you'd rather fill this in
   correctly the first time.
3. Deploy. Once it's live, note the service URL
   (`https://shoe-shop-api-xxxx.onrender.com`) — that's `VITE_API_URL` for
   the client.
4. **Keep it warm.** Render's free tier sleeps after 15 minutes idle, and the
   first request after that can take up to a minute while it wakes — a bad
   first impression for someone arriving from an Instagram link. Point a free
   [UptimeRobot](https://uptimerobot.com) HTTP(S) monitor at
   `https://<your-api>/api/health` on a 5-minute interval; the health check
   already reports database connectivity, so a monitor failure means
   something is actually wrong, not just that Atlas hiccuped.

### 3. Storefront → Vercel

1. Import this repo as a new Vercel project. Leave **Root Directory** at the
   repository root — the committed `vercel.json` overrides the build and
   output directory for the npm-workspaces layout, so Vercel's own framework
   auto-detection would otherwise get this wrong.
2. Set the project's environment variables: `VITE_API_URL` (the Render URL
   from step 2) and `VITE_RAZORPAY_KEY_ID` (the public key id — never the
   secret — from step 1).
3. Deploy. Note the resulting domain
   (`https://shoe-shop-xxxx.vercel.app`, or your custom domain).
4. Back in Render, update `CLIENT_URL` to this real domain and redeploy —
   this is what CORS and the admin refresh cookie check against, so checkout
   and admin sign-in will fail against a placeholder value.

### 4. Razorpay webhook and going live

Once the API has a stable URL: Razorpay Dashboard → Settings → Webhooks → add
`https://<your-api>/api/webhooks/razorpay`, subscribe to `payment.captured`
and `payment.failed`, and set a webhook secret — put that value in Render as
`RAZORPAY_WEBHOOK_SECRET`. This is the reliable payment-confirmation path; see
`services/order.service.ts` for why it exists alongside the checkout
callback.

When you're ready to accept real money, submit Razorpay's KYC review, swap
`RAZORPAY_KEY_ID`/`_SECRET` for the live pair, and redeploy the API.

### 5. First run in production

```bash
MONGODB_URI="<production connection string>" npm run seed:admin
```

creates the one admin account from `ADMIN_EMAIL`/`ADMIN_PASSWORD` — run it
once against the production database from your own machine (never commit
production credentials to a `.env` file that gets deployed). Sign in at
`https://<your-domain>/admin/login` and add real products; the sample
catalog from `npm run seed` is a local-dev convenience, not something to run
against production.

### Backups

Atlas's free M0 tier has no built-in automated backup. `npm run backup`
(`MONGODB_URI` pointed at production) dumps every collection to timestamped
JSON under `apps/server/backups/` — run it from your own machine, not from
Render, whose disk is wiped on every deploy and every wake from sleep. A
calendar reminder to run it weekly is a reasonable bar for a shop this size.

---

## Scripts

| Command                | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Server and client together, both watching             |
| `npm run build`        | Build shared, then server, then client                |
| `npm run seed`         | Seed the admin account and sample products            |
| `npm run seed:admin`   | Create/reset just the admin account                   |
| `npm run backup`       | Dump every collection to timestamped JSON              |
| `npm run lint`         | ESLint across all workspaces                          |
| `npm run format`       | Prettier write                                        |
| `npm run typecheck`    | `tsc --noEmit` in every workspace                     |
| `npm test`             | Vitest                                                |

---

## Money is stored in paise

Every price, subtotal, tax and total is a **whole number of paise** — in the
database, in the API, and in Redux. Floating-point rupees drift (`0.1 + 0.2` is
not `0.3`), and Razorpay's API takes integer paise regardless.

Money fields carry a `Paise` suffix (`pricePaise`, `totalPaise`) so a unit
mismatch is visible at the call site. Rupee formatting happens once, at render
time, through `formatINR` in `@shoe-shop/shared`.

---

## Known advisory: react-router

`npm audit` reports a **high** advisory against `react-router` 7.12.0–8.2.0
([GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)):
_"RSC Mode CSRF Bypass Allows Action Execution Before 400 Response."_

**We stay on the latest 7.x deliberately.** No fixed version exists — the only
remediation npm offers is downgrading to 7.11.0, which is strictly worse for this
app:

- The advisory is scoped to **RSC mode**, a framework-mode feature involving
  server components and server actions. This client is a static SPA built by Vite
  and served by Vercel's CDN. There is no React Router server, no RSC renderer,
  and no server actions — the vulnerable code path does not exist in our bundle.
- Downgrading to 7.11.0 **reintroduces**
  [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), an
  open redirect via backslash in `<Link>` and `useNavigate`, fixed in 7.18.0.
  That one *does* apply to a plain SPA.

So the choice is an inapplicable RSC issue versus an applicable open redirect.
We take the former. Re-evaluate when react-router ships a release above 8.2.0.

`npm audit` is therefore **not** part of CI — it would fail permanently on a
finding we have consciously accepted. Review advisories manually when upgrading.

---

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `chore:`, `docs:`, `test:`), validated by commitlint in CI.
- **Server** uses relative imports; **client** uses the `@/` alias for `src/`.
- Business logic lives in `apps/server/src/services/` — controllers only parse,
  delegate and respond. That is what keeps the money code unit-testable without
  spinning up HTTP.

---

## Build phases

- [x] 1 — Monorepo scaffold, tooling, CI
- [x] 2 — `shared` package: schemas, types, money helpers
- [x] 3 — Server foundation: env, models, auth, seeds
- [x] 4 — Product API + Cloudinary uploads
- [x] 5 — Client foundation: Vite, Tailwind, store, UI primitives
- [x] 6 — Storefront: home, catalog, product page, cart
- [x] 7 — Pricing, GST, checkout
- [x] 8 — Payments, orders, invoices, emails
- [x] 9 — Admin panel
- [x] 10 — Policy pages, deployment, docs
