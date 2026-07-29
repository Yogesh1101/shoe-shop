# Shoe Shop

An online storefront for a shoe business currently run through Instagram DMs and
phone calls. Customers browse the catalog with live per-size stock, order
themselves, and pay by Razorpay or cash on delivery. Orders land in one admin
dashboard with GST invoices.

> **Status:** under construction — the shop is browsable but does not yet
> take payments. See the phase checklist at the bottom.

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

## Scripts

| Command                | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Server and client together, both watching             |
| `npm run build`        | Build shared, then server, then client                |
| `npm run seed`         | Seed the admin account and sample products            |
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
- [ ] 7 — Pricing, GST, checkout
- [ ] 8 — Payments, orders, invoices, emails
- [ ] 9 — Admin panel
- [ ] 10 — Policy pages, deployment, docs

Deployment instructions and the full account-setup walkthrough land in phase 10.
