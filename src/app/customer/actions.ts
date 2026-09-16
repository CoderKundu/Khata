"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  type CustomerFormState,
  parseCustomerForm,
} from "@/lib/customer-form";
import { getCustomer } from "@/lib/customers";
import { prisma } from "@/lib/prisma";

export async function createCustomer(
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  // Actions are reachable by direct POST, so this is a real check, not a
  // formality that proxy.ts already handled.
  await requireSession();

  const parsed = parseCustomerForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, formError: null };

  let created: { id: string };
  try {
    created = await prisma.customer.create({ data: parsed.value });
  } catch (error) {
    // A thrown action never reaches useActionState; the form would hang on
    // "Saving…" with no way to tell whether the customer was created.
    console.error("createCustomer failed", error);
    return {
      errors: {},
      formError: "Could not save. Check the connection and try again.",
    };
  }

  revalidatePath("/");
  redirect(`/customer/${created.id}`);
}

export async function updateCustomer(
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireSession();

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") {
    return { errors: {}, formError: "Customer not found" };
  }

  const parsed = parseCustomerForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, formError: null };

  const existing = await getCustomer(id);
  if (!existing) return { errors: {}, formError: "Customer not found" };

  await prisma.customer.update({ where: { id }, data: parsed.value });

  revalidatePath("/");
  revalidatePath(`/customer/${id}`);
  redirect(`/customer/${id}`);
}

/**
 * Archiving hides a customer from the list. It is refused while money is
 * outstanding: a hidden debtor is a forgotten debtor, and the total at the top
 * of the list would silently stop matching what the shop is actually owed.
 */
export async function archiveCustomer(formData: FormData): Promise<void> {
  await requireSession();

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;

  const customer = await getCustomer(id);
  if (!customer) return;

  if (customer.outstandingPaise !== 0) {
    redirect(`/customer/${id}/edit?error=balance`);
  }

  await prisma.customer.update({ where: { id }, data: { archived: true } });

  revalidatePath("/");
  redirect("/");
}
