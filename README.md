# Khata

**A credit ledger for a hardware shop, with Razorpay payment links over WhatsApp.**

🔗 **Live:** https://khata-ashen.vercel.app

Contractors and masons buy building materials on credit through the month and
settle later. That ledger lives in a paper *khata* — one page per customer, with
a running balance. This replaces it, and adds the one thing paper cannot:
generating a payment link for the outstanding balance and sending it over
WhatsApp.

Built for one person on one Android phone. Mobile-first at 380px, short labels,
minimal typing.

> The live app is password-protected and the demo credentials are not published,
> because it shares a database with real use and there is no audit trail. To
> explore it, clone and run it locally against your own database — the seed
> script sets up three fake contractors with a month of entries.

---

## Stack

Next.js 16 (App Router) · TypeScript · Prisma 7 · PostgreSQL (Neon) ·
Tailwind CSS v4 · Razorpay Payment Links REST API · Vercel

No component library, no state management library, no Razorpay SDK. Session auth
is about a hundred lines of `node:crypto`.

---

## What it does

**Customer list** — search by name or number, total outstanding pinned at the
top, sorted by who owes most, balance in red when owing and grey when settled.

**Ledger** — date, details, debit, credit and a running balance, newest first.
Payment links that have not been paid yet are marked *Pending*.

**Add goods / Record payment** — a bottom sheet with a big amount field, an
optional note, and a date defaulting to today. Built on the native `<dialog>`,
so Escape, focus trapping and the backdrop come from the browser.

**Send payment link** — prefilled with the full outstanding, editable down to a
part payment, then handed to WhatsApp as a ready-to-send message:

> Namaste Ramesh Yadav, aapka Kundu Hardware ka bakaya ₹500 hai. Yahan se pay
> kar sakte hain: https://rzp.io/rzp/KQK60EI

**Webhook** — Razorpay reports when a link is paid, cancelled or expired, and
the balance updates on its own.

---

## The three rules underneath it

**Money is an integer count of paise. Never a float.**
`parseFloat("1234.35") * 100` is `123434.99999999999`. A ledger that quietly
loses a paisa per entry is a ledger nobody trusts, so parsing is done by string
surgery and rupees exist only as text the user types or reads.

**There is no balance column.** A customer's outstanding is always recomputed
from their entries. A stored balance is a second source of truth, and second
sources of truth drift.

**A payment link that has been sent is not a payment.** It is recorded as a
credit with status `CREATED` and excluded from every calculation until Razorpay
confirms it `PAID`. Cash handed over in the shop has no status and counts
immediately.

---

## The webhook

Two properties matter more than anything else in the app.

**Verify before parsing.** The raw body is read with `req.text()` and checked
with HMAC-SHA256 and `timingSafeEqual` before anything turns it into an object.
The signature covers exact bytes — parsing and re-stringifying to verify
compares a *different* string, since `JSON.stringify` promises neither key order
nor whitespace.

**Idempotency is one conditional write**, not a read followed by a write:

```ts
await prisma.entry.updateMany({
  where: { id: entryId, paymentStatus: "CREATED" },
  data: { paymentStatus: status, razorpayLinkId: linkId, deletedAt: null },
});
```

Razorpay retries, so the same event arrives more than once. The second delivery
matches zero rows and changes nothing. A read-then-write would leave a window
where two concurrent deliveries both pass the check and credit twice. The same
condition makes terminal states final, so a `cancelled` event arriving after the
money landed cannot un-pay it — Razorpay does not guarantee ordering.

Anything the app will not act on answers `200`: unknown links, duplicates,
malformed bodies, unsubscribed events. `5xx` means retry, and retrying an event
that will never be handled is a loop with no exit.

---

## Requirements

- **Node 20.9 or newer** (developed on 24.19)
- A **Neon** Postgres database (free tier is plenty)
- A **Razorpay** account in **test mode**

## Setup

```bash
npm install
cp .env.example .env    # then fill it in, see below
npm run db:deploy       # create the tables
npm run db:seed         # optional: three fake contractors to click around
npm run dev
```

Open http://localhost:3000 and log in with whatever you set as
`ADMIN_PASSWORD`. `next dev` also prints a LAN address, so you can open it on a
real phone on the same wifi.

## Environment variables

Copy `.env.example` to `.env`. It is gitignored; never commit it.

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string — hostname contains `-pooler`. Used by the running app. |
| `DIRECT_URL` | The same database, **unpooled**. Used only by the Prisma CLI. |
| `RAZORPAY_KEY_ID` | Razorpay API key. Test keys start with `rzp_test_`. |
| `RAZORPAY_KEY_SECRET` | Its secret. |
| `RAZORPAY_WEBHOOK_SECRET` | The secret **you type** when creating the webhook. Not the API secret — a different value. |
| `ADMIN_PASSWORD` | The single password used to log in. |
| `SESSION_SECRET` | Random string signing the session cookie. |
| `NEXT_PUBLIC_SHOP_NAME` | Shown in the WhatsApp message and at the top of the app. |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Why two database URLs.** Vercel can start a new serverless function per
request, and direct Postgres connections run out — so the app uses Neon's pooled
endpoint. But that pooler runs PgBouncer in transaction mode, which cannot
execute the schema changes a migration needs, so the Prisma CLI uses the direct
one. `DIRECT_URL` falls back to `DATABASE_URL` if left empty.

**On `sslmode`.** Neon hands you a string ending `sslmode=require`. Change it to
`sslmode=verify-full`. Today's `pg` driver treats them identically, but a future
major will make plain `require` **stop verifying the certificate**.

## Database

| Command | |
| --- | --- |
| `npm run db:deploy` | Apply migrations (use this in production) |
| `npm run db:migrate` | Create and apply a new migration after editing the schema |
| `npm run db:seed` | Wipe and reseed with three fake contractors |
| `npm run db:studio` | Browse the data |

`db:seed` **deletes every customer and entry** before inserting. It refuses to
run when `NODE_ENV=production`, but do not point it at real data.

---

## Razorpay

### API keys

Dashboard → confirm the **Test Mode** toggle is on → Settings → API Keys →
Generate. The secret is shown once.

### Pointing the webhook at your deployed URL

Without this, a customer can pay and the balance will never move.

1. Deploy first — Razorpay needs a public URL, `localhost` will not work.
2. Dashboard → Settings → **Webhooks** → Add New Webhook.
3. **URL**: `https://your-app.vercel.app/api/webhooks/razorpay`
4. **Secret**: a random string, and put the **exact same string** in
   `RAZORPAY_WEBHOOK_SECRET`. If they differ, every delivery is rejected with a
   400.
5. **Active Events** — exactly these three:
   `payment_link.paid`, `payment_link.cancelled`, `payment_link.expired`
6. Save, then use Razorpay's **Test Webhook** button. You should get a 200.

### Testing a payment

Create a link from a customer's ledger, open it, and pay with **Netbanking** —
test mode shows a simulated bank page with a Success button. UPI works too, with
the test VPA `success@razorpay`.

Card numbers are account-dependent; a generic Visa test number may be rejected
as an international card. Netbanking is the reliable path.

The entry should flip from *Pending* and the balance should drop.

---

## Deploying to Vercel

1. Push to GitHub and import the repo at vercel.com/new.
2. Add **every** variable from the table above. Vercel's **Import .env** button
   takes the whole file at once.
3. Use a **different** `ADMIN_PASSWORD` and `SESSION_SECRET` than your local
   ones. The deployed app is on the public internet.
4. Deploy. `prisma generate` runs as part of the build.
5. Run `npm run db:deploy` once against the production database.
6. Create the webhook with the deployed URL (above).

Environment variables are read at build time — changing one later requires a
**redeploy** to take effect.

---

## Tests

```bash
npm test
```

97 tests, no database required. They cover the places where being wrong costs
money: paise arithmetic, the balance rules, running-balance ordering, session
signing and tampering, the Razorpay request body, webhook signature
verification, and webhook idempotency — including feeding the same
`payment_link.paid` payload twice and asserting the balance moves once.

The full path has also been exercised in production: a real payment link, a real
Netbanking payment, and a real signed webhook flipping the entry to `PAID`.

---

## Limits — read this part

**It runs in Razorpay test mode.** No real money moves. Going live requires
completing Razorpay's KYC — business documents, bank account, PAN — then
swapping the test keys for live ones and re-creating the webhook with the live
URL. Until then, payment links are play money.

**One shared password, no user accounts.** Anyone with the password is the shop.
There is **no audit trail of who made an entry** — the ledger records what
happened, never who recorded it. If more than one person uses this, you cannot
tell their entries apart, which is a real limitation for financial data.

**Login has no rate limiting.** A single password can be guessed at without
limit. On serverless an in-memory counter is close to useless, since each
instance has its own, so a real fix needs the database or an external store. It
has not been built.

**Deleting is a soft delete with no way back.** Entries are struck off, not
removed — `deletedAt` is set and every calculation ignores them. The data
survives, but there is no undo in the app.

**Balances are computed in JavaScript, not summed in SQL.** Every customer's
entries are loaded to compute what they owe. This keeps the rule in exactly one
tested place instead of restating it as a query that can drift. Comfortable for
hundreds of customers and thousands of entries; not for millions.

**Partial payments are disabled.** A link is paid in full or not at all — the
ledger has no entry type for a partially paid link.

**The webhook trusts our own amount.** It marks the entry paid without
reconciling against the amount Razorpay reports. With partial payments off these
are always equal, but it is an assumption, not a check.

**Neon's free tier sleeps.** After idle time the first request has to wake the
database and can take several seconds, or fail — which is what the "Something
went wrong / Try again" screen is for.

**No offline support.** The shop needs a working internet connection. Paper did
not.

---

## Project layout

```
prisma/schema.prisma          the data model
src/lib/money.ts              paise <-> rupees, string-based, no floats
src/lib/ledger.ts             what counts toward a balance
src/lib/ledger-rows.ts        running balance, oldest-to-newest then reversed
src/lib/razorpay.ts           Payment Links API client
src/lib/razorpay-webhook.ts   signature verification and event parsing
src/lib/webhook-apply.ts      what a webhook does to the ledger
src/proxy.ts                  route guard (Next 16's rename of middleware)
src/app/                      screens
```

`*.test.ts` files sit next to what they test.
