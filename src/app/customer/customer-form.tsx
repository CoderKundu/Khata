"use client";

import { useActionState } from "react";
import {
  type CustomerFormState,
  emptyCustomerFormState,
} from "@/lib/customer-form";

type CustomerAction = (
  previous: CustomerFormState,
  formData: FormData,
) => Promise<CustomerFormState>;

export type CustomerFormValues = {
  id?: string;
  name?: string;
  phone?: string;
  note?: string | null;
};

/** Shared by "naya grahak" and "badlav" — the fields are identical. */
export function CustomerForm({
  action,
  values = {},
  submitLabel,
}: {
  action: CustomerAction;
  values?: CustomerFormValues;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    emptyCustomerFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5 px-4 py-6">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <Field
        id="name"
        label="Name"
        error={state.errors.name}
        defaultValue={values.name}
        autoFocus={!values.id}
        autoCapitalize="words"
        autoComplete="name"
      />

      <Field
        id="phone"
        label="Mobile number"
        error={state.errors.phone}
        defaultValue={values.phone}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        hint="10 digits, no +91"
      />

      <Field
        id="note"
        label="Note"
        defaultValue={values.note ?? undefined}
        autoCapitalize="sentences"
        hint="e.g. Sharma Construction, Alambagh site"
        optional
      />

      {state.formError ? (
        <p role="alert" className="text-due font-medium">
          {state.formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="tap h-14 rounded-xl bg-brand text-white text-lg font-semibold
                   active:bg-brand-dark disabled:opacity-60"
      >
        {isPending ? "Ruko…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  optional,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft mb-2">
        {label}
        {optional ? (
          <span className="font-normal text-ink-faint"> (optional)</span>
        ) : null}
      </label>

      <input
        id={id}
        name={id}
        // 18px so iOS does not zoom the page in when the field is focused.
        className={`w-full tap h-14 rounded-xl border bg-surface px-4 text-lg outline-none
                    focus:ring-2 focus:ring-brand/20 ${
                      error ? "border-due" : "border-line focus:border-brand"
                    }`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />

      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-due font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-sm text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
