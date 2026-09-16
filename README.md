# Khata

A credit ledger for a hardware and building-materials shop, replacing the paper
khata — one page per customer, with a running balance.

Contractors and masons buy on credit through the month and settle later. This
app keeps that ledger, and adds the one thing paper cannot: it generates a
Razorpay payment link for the outstanding balance and hands it to WhatsApp.

Built for one person on one Android phone. Mobile-first at 380px, short labels,
minimal typing.

---

## What it does

- **Customer list** — search by name or number, total outstanding pinned at the
  top, sorted by who owes most, balance in red when owing and grey when settled.
- **Ledger** — date, details, debit, credit and a running balance, newest first.
  Payment links that have not been paid are marked *Pending*.
- **Add goods / Record payment** — a bottom sheet with a big amount field, an
  optional note, and a date that defaults to today.
- **Send payment link** — prefilled with the full outstanding, editable down to
  a part payment, then handed to WhatsApp as a ready-to-send message.
- **Webhook** — Razorpay tells the app when a link is paid, cancelled or
  expired, and the balance updates.

---

## Requirements

- **Node 20.9 or newer** (developed on 24.19)
- A **Neon** Postgres database (free tier is plenty)
- A **Razorpay** account in **test mode**

---

## Setup

```bash
npm install
cp .env.example .env    # then fill it in, see below
npm run db:deploy       # create the tables
npm run db:seed         # optional: three fake contractors to click around
npm run dev
```

Open http://localhost:3000 and log in with whatever you set as
`ADMIN_PASSWORD`.

To use it from your phone on the same wifi, `next dev` also prints a
`http://192.168.x.x:3000` address.

---

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

Generate `SESSION_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Why two database URLs

Vercel can start a new serverless function per request, and direct Postgres
connections run out. So the app uses Neon's pooled endpoint. But that pooler
runs PgBouncer in transaction mode, which cannot execute the schema changes a
migration needs — so the Prisma CLI uses the direct one. `DIRECT_URL` falls
back to `DATABASE_URL` if you leave it empty.

### A note on `sslmode`

Neon hands you a string ending `sslmode=require`. Change it to
`sslmode=verify-full`. Today's `pg` driver treats them identically, but a
future major version will make plain `require` **stop verifying the
certificate**. Spelling it out keeps the connection checked when that lands.

---

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

Razorpay Dashboard → confirm the **Test Mode** toggle is on → Settings → API
Keys → Generate. Put them in `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

The app calls the Payment Links REST API directly with `fetch` and HTTP Basic
auth. There is no Razorpay SDK dependency.

### Pointing the webhook at your deployed URL

The webhook is how a payment actually reaches the ledger. Without it a customer
can pay and the balance will never move.

1. Deploy first — you need a public URL. `localhost` will not work; Razorpay
   has to be able to reach it.
2. Razorpay Dashboard → Settings → **Webhooks** → Add New Webhook.
3. **Webhook URL**: `https://your-app.vercel.app/api/webhooks/razorpay`
4. **Secret**: type a random string, and put the **exact same string** in
   `RAZORPAY_WEBHOOK_SECRET`. If they differ, every delivery fails signature
   verification and is rejected with a 400.
5. **Active Events** — tick exactly these three:
   - `payment_link.paid`
   - `payment_link.cancelled`
   - `payment_link.expired`
6. Save, then use Razorpay's **Test Webhook** button to send a sample. You
   should get a 200.

To test the whole loop: create a link from a customer's ledger, open it, and pay
with Razorpay's test card `4111 1111 1111 1111`, any future expiry, any CVV.
The entry should flip from *Pending* and the balance should drop.

---

## Deploying to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add **every** variable from the table above in Project Settings →
   Environment Variables. The app will not start without them.
3. Deploy. `prisma generate` runs as part of the build; no extra config needed.
4. Run the migration against your production database once:
   ```bash
   npm run db:deploy
   ```
5. Then create the webhook, using the deployed URL (above).

---

## Tests

```bash
npm test
```

97 tests, no database required — they cover the parts where being wrong costs
money: paise arithmetic, the balance rules, running-balance ordering, session
signing, the Razorpay request body, webhook signature verification, and webhook
idempotency.

---

## How the money works

Three rules hold the whole thing up.

**Money is an integer count of paise.** Never a float. `parseFloat("1234.35") *
100` is `123434.99999999999`, and a ledger that quietly loses a paisa per entry
is a ledger nobody trusts. Rupees exist only as text the user types or reads.

**There is no balance column.** A customer's outstanding is always recomputed
from their entries. A stored balance is a second source of truth, and second
sources of truth drift.

**A payment link that has been sent is not a payment.** It is recorded as a
credit with status `CREATED` and excluded from every calculation until Razorpay
confirms it `PAID`. Cash handed over in the shop has no status and counts
immediately.

---

## Limits — read this part

This is a real app, but it is a small one, and it has real limits.

**It runs in Razorpay test mode.** No real money moves. Going live requires
completing Razorpay's KYC — business documents, bank account, PAN, GST where
applicable — and then swapping the test keys for live ones and re-creating the
webhook with the live URL. Until that is done, payment links are play money.

**There is one shared password and no user accounts.** Anyone with the password
is the shop. There is **no audit trail of who made an entry** — the ledger
records what happened, never who recorded it. If more than one person ever uses
this, you cannot tell their entries apart, and that is a real limitation for
financial data.

**Login has no rate limiting.** A single password can be guessed at without
limit. On serverless, an in-memory counter is close to useless because each
instance has its own, so a real fix needs the database or an external store. It
has not been built.

**Deleting is a soft delete with no way back.** Entries are struck off, not
removed — `deletedAt` is set and every calculation ignores them. The data
survives, but there is no "undo" in the app. Recovering an entry means editing
the database by hand.

**Balances are computed in JavaScript, not summed in SQL.** Every customer's
entries are loaded to compute what they owe. This keeps the rule in exactly one
tested place instead of restating it as a query that can drift. It is
comfortable for hundreds of customers and thousands of entries. It would not be
for millions.

**Partial payments are disabled.** A payment link is paid in full or not at all.
The ledger has no entry type for a partially paid link.

**The webhook trusts our own amount.** It marks the entry paid without
reconciling against the amount Razorpay reports. With partial payments off
these are always equal, but it is an assumption, not a check.

**Neon's free tier sleeps.** After a period of no traffic the first request has
to wake the database and can take several seconds, or fail — which is what the
"Something went wrong / Try again" screen is for.

**No offline support.** The shop needs a working internet connection. A paper
khata does not.

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
