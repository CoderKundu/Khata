"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { getCustomer } from "@/lib/customers";
import {
  type DeleteEntryState,
  type EntryFormState,
  parseEntryForm,
} from "@/lib/entry-form";
import { prisma } from "@/lib/prisma";

/**
 * Adding and striking off entries.
 *
 * Neither of these redirects. The sheet stays on the ledger and the page
 * revalidates underneath it, so the new row and the new balance are simply
 * there when the sheet closes.
 */

function customerIdFrom(formData: FormData): string | null {
  const id = formData.get("customerId");
  return typeof id === "string" && id !== "" ? id : null;
}

async function addEntry(
  type: "DEBIT" | "CREDIT",
  formData: FormData,
): Promise<EntryFormState> {
  await requireSession();

  const customerId = customerIdFrom(formData);
  if (!customerId) return { errors: {}, formError: "Customer not found", saved: false };

  const parsed = parseEntryForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, formError: null, saved: false };

  // Confirm the customer exists and is not archived before writing money
  // against their name.
  const customer = await getCustomer(customerId);
  if (!customer) return { errors: {}, formError: "Customer not found", saved: false };

  await prisma.entry.create({
    data: { ...parsed.value, customerId, type },
  });

  revalidatePath("/");
  revalidatePath(`/customer/${customerId}`);

  return { errors: {}, formError: null, saved: true };
}

/** Goods taken on credit: the balance goes up. */
export async function addGoods(
  _previous: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  return addEntry("DEBIT", formData);
}

/**
 * Cash or UPI handed over in the shop: the balance goes down immediately.
 * paymentStatus stays null, which is what marks it as money already in hand
 * rather than a payment link waiting to be paid.
 */
export async function recordPayment(
  _previous: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  return addEntry("CREDIT", formData);
}

/**
 * Soft delete. The row is struck off, never removed: this is financial
 * history, and a mis-tap should be recoverable from the database rather than
 * gone. Every balance calculation already ignores entries with a deletedAt.
 */
export async function deleteEntry(
  _previous: DeleteEntryState,
  formData: FormData,
): Promise<DeleteEntryState> {
  await requireSession();

  const customerId = customerIdFrom(formData);
  const entryId = formData.get("entryId");
  if (!customerId || typeof entryId !== "string" || entryId === "") {
    return { deleted: false, error: "Entry not found" };
  }

  // Scoped to the customer so a stray id cannot strike off someone else's row.
  const { count } = await prisma.entry.updateMany({
    where: { id: entryId, customerId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (count === 0) return { deleted: false, error: "Entry not found" };

  revalidatePath("/");
  revalidatePath(`/customer/${customerId}`);

  return { deleted: true, error: null };
}
