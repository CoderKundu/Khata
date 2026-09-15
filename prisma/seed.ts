import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Seed data for development: three contractors who buy the way real ones do —
 * a run of material through the month, the odd part payment, and one payment
 * link that has been sent but not paid yet.
 *
 * Amounts are paise. 4500000 is ₹45,000.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Fill it in .env before seeding.");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed: NODE_ENV is production. This wipes data.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Days ago, at a sane hour, so the ledger reads like a month of trading. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(11, 0, 0, 0);
  return d;
}

const customers = [
  {
    name: "Ramesh Yadav",
    phone: "9876543210",
    note: "Sharma Construction, Alambagh site",
    entries: [
      { type: "DEBIT" as const, amountPaise: 4_50_000, note: "Cement 10 bori", daysAgo: 28 },
      { type: "DEBIT" as const, amountPaise: 12_80_000, note: "Sariya 8mm, 2 bundle", daysAgo: 24 },
      { type: "CREDIT" as const, amountPaise: 10_00_000, note: "Cash", daysAgo: 20 },
      { type: "DEBIT" as const, amountPaise: 2_15_000, note: "Baalu 1 tractor", daysAgo: 14 },
      { type: "DEBIT" as const, amountPaise: 3_40_000, note: "Asian Paints, 2 dabba", daysAgo: 6 },
      // Sent over WhatsApp, not paid yet. Must NOT reduce the balance.
      {
        type: "CREDIT" as const,
        amountPaise: 12_85_000,
        note: "Payment link bheja",
        daysAgo: 1,
        razorpayLinkId: "plink_seed_ramesh_pending",
        razorpayLinkUrl: "https://rzp.io/i/seedRamesh",
        paymentStatus: "CREATED" as const,
      },
    ],
  },
  {
    name: "Mohd Irfan",
    phone: "8887654321",
    note: "Mistri, Gomti Nagar slab ka kaam",
    entries: [
      { type: "DEBIT" as const, amountPaise: 1_25_000, note: "Screw aur kabza", daysAgo: 21 },
      { type: "DEBIT" as const, amountPaise: 6_60_000, note: "Gitti 2 tractor", daysAgo: 16 },
      { type: "CREDIT" as const, amountPaise: 5_00_000, note: "PhonePe", daysAgo: 11 },
      { type: "DEBIT" as const, amountPaise: 90_000, note: "Putty 1 bag", daysAgo: 4 },
      // Paid link: this one DID land, so it counts.
      {
        type: "CREDIT" as const,
        amountPaise: 2_00_000,
        note: "Payment link se aaya",
        daysAgo: 2,
        razorpayLinkId: "plink_seed_irfan_paid",
        razorpayLinkUrl: "https://rzp.io/i/seedIrfan",
        paymentStatus: "PAID" as const,
      },
    ],
  },
  {
    name: "Pintu Verma",
    phone: "7012345678",
    note: "Chhota kaam, zyadatar cash",
    entries: [
      { type: "DEBIT" as const, amountPaise: 78_000, note: "Paint brush, tarpin", daysAgo: 9 },
      { type: "CREDIT" as const, amountPaise: 78_000, note: "Cash, pura hisab", daysAgo: 9 },
    ],
  },
];

async function main(): Promise<void> {
  // Entries first: they point at customers.
  await prisma.entry.deleteMany();
  await prisma.customer.deleteMany();

  for (const { entries, ...customer } of customers) {
    const created = await prisma.customer.create({ data: customer });

    for (const entry of entries) {
      const { daysAgo: age, ...rest } = entry;
      await prisma.entry.create({
        data: { ...rest, customerId: created.id, entryDate: daysAgo(age) },
      });
    }

    console.log(`seeded ${created.name} (${entries.length} entries)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
