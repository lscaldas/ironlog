# IronLog — Product Roadmap

Goal: turn IronLog into a sellable subscription app (monthly fee).

This document records the work that is **deliberately deferred** because it requires
changing how/where the app is hosted, plus the order to tackle it when ready.
Everything that could be done while staying on plain GitHub Pages (branch-root
deploy, no build step) has already been done — see git history.

---

## Deferred item 1: Real accounts (auth overhaul)

**Current state (not sellable):** profiles are a name + PIN. The Supabase RLS
policies in `supabase.sql` let *any anonymous visitor* select, insert, or
**overwrite any profile row**. Encrypted blobs are publicly readable, so an
attacker can download them and brute-force short PINs offline (PBKDF2-150k does
not protect a 4–6 digit keyspace). Fine for personal/friends use; not for
paying customers.

**Target state:**

1. **Supabase Auth** — email/password + magic links (+ Google/Apple OAuth later).
   Free tier covers this; no separate host needed for auth itself.
2. **RLS keyed to `auth.uid()`** — each user can only read/write rows where
   `user_id = auth.uid()`. Delete the current anon policies entirely.
3. **Encryption decision** (pick one before building):
   - **Option A — keep end-to-end encryption:** marketable ("we cannot read
     your data"), but *forgotten password = data permanently lost*. Support
     nightmare for a paid product.
   - **Option B (recommended) — standard at-rest encryption:** Supabase already
     encrypts at rest; drop client-side crypto, gain normal password reset,
     server-side features (progress emails, coach dashboards, analytics).
4. **Migration path for existing users:** one-time "claim your profile" flow —
   sign up, enter old profile name + PIN, app decrypts locally and re-uploads
   under the new account.

**Why deferred:** needs a real signup/login UX, a data migration, and choices
that are hard to reverse. No new hosting is strictly required (Supabase Auth
works from a static page), but it should be done together with the sync rework
below.

## Deferred item 2: Billing

**Target:** monthly subscription.

1. **Merchant of record — Paddle or Lemon Squeezy (recommended over raw Stripe
   for a solo dev):** they handle global VAT/sales tax, invoices, and chargebacks.
   Stripe is cheaper per transaction but makes *you* the merchant (tax filings).
2. **Entitlements:** a `subscriptions` table in Supabase written by a webhook
   (Supabase Edge Function receiving Paddle/LS/Stripe events), read by the app
   + enforced by RLS (e.g. cloud sync requires active subscription; local-only
   mode stays free — natural free tier).
3. **Requires auth first** — billing keys off `auth.uid()`.

**Why deferred:** depends on item 1; webhooks need Supabase Edge Functions
(deployable from CLI, still no separate host, but real backend surface to
maintain).

## Deferred item 3: Sync rework (single-blob → per-row)

**Current state:** the whole DB is encrypted into ONE JSON blob, upserted
last-write-wins. Logging sets on two devices in the same window silently loses
one device's data.

**Target:** normalized tables (`workouts`, `sets`, `exercises`) with per-row
upserts + `updated_at` conflict handling; local cache in **IndexedDB** instead
of localStorage (iOS Safari can evict localStorage after 7 days for
non-installed sites; ~5MB cap).

**Why deferred:** should be done together with item 1 (schema keys off
`user_id`). Doing it under the current anon model would be wasted work.

## Deferred item 4: Build step (Vite + TypeScript)

**Current state:** no build step — split plain CSS/JS files loaded in order,
sharing global scope. Deployable from branch root on GitHub Pages as-is.

**Target:** Vite + TypeScript, real ES modules, minification. **Still GitHub
Pages compatible** — build in a GitHub Actions workflow and set
Settings → Pages → Source to "GitHub Actions" (one-time settings toggle;
that toggle is the only reason this is deferred).

**Payoff:** type-checking on the data model (`DB.exercises/sets/workouts` is
exactly what silent type bugs corrupt), dead-code elimination, and a sane path
to a framework (Preact/Svelte) and Capacitor app-store wrappers later.

## Deferred item 5: Selling checklist (non-code)

- Privacy policy + Terms of Service pages.
- GDPR: account deletion flow (export already exists), pick Supabase region
  deliberately.
- Separate dev/staging Supabase project so testing never touches customer data.
- App-store presence via Capacitor wrapper (most fitness-app subscription
  revenue is mobile) — after item 4.
- New-user onboarding: the seed program is currently Lucas's personal cable-gym
  routine (`SEED` in the catalog module); replace with a template picker.

---

## Suggested order

1. Auth (item 1) + sync rework (item 3) together — the hard, essential step.
2. Billing (item 2).
3. Build step (item 4) — can happen any time, independent of 1–3.
4. Checklist (item 5) alongside launch prep.
