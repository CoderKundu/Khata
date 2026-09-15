import { normalizePhone } from "@/lib/phone";

/**
 * Validation for the customer form, kept pure so it can be tested without a
 * database or a browser. The Server Action calls this; so could a script.
 */

export type CustomerInput = {
  name: string;
  phone: string;
  note: string | null;
};

export type CustomerFieldErrors = {
  name?: string;
  phone?: string;
};

export type CustomerParseResult =
  | { ok: true; value: CustomerInput }
  | { ok: false; errors: CustomerFieldErrors };

/**
 * The shape the form's Server Action hands back to useActionState.
 *
 * This lives here rather than beside the action because a "use server" file may
 * only export async functions — a plain constant in one is a runtime error that
 * TypeScript will not warn you about.
 */
export type CustomerFormState = {
  errors: CustomerFieldErrors;
  formError: string | null;
};

export const emptyCustomerFormState: CustomerFormState = {
  errors: {},
  formError: null,
};

/** Collapse runs of whitespace so "Ramesh   Yadav" and "Ramesh Yadav" match. */
function tidy(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function parseCustomerForm(formData: FormData): CustomerParseResult {
  const name = tidy(formData.get("name"));
  const rawPhone = tidy(formData.get("phone"));
  const note = tidy(formData.get("note"));

  const errors: CustomerFieldErrors = {};

  if (name === "") {
    errors.name = "Naam daaliye";
  } else if (name.length > 80) {
    errors.name = "Naam bahut lamba hai";
  }

  const phone = normalizePhone(rawPhone);
  if (rawPhone === "") {
    errors.phone = "Number daaliye";
  } else if (phone === null) {
    errors.phone = "10 ank ka mobile number daaliye";
  }

  if (errors.name || errors.phone) return { ok: false, errors };

  return {
    ok: true,
    // phone is non-null here: errors.phone would have been set otherwise.
    value: { name, phone: phone as string, note: note === "" ? null : note },
  };
}
