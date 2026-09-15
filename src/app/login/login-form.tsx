"use client";

import { useActionState } from "react";
import { type LoginState, login } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-ink-soft mb-2"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          // Tall and 18px+: iOS zooms the page in on any input under 16px.
          className="w-full tap h-14 rounded-xl border border-line bg-surface px-4 text-lg
                     outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          aria-describedby={state.error ? "password-error" : undefined}
          aria-invalid={state.error ? true : undefined}
        />
      </div>

      {state.error ? (
        <p
          id="password-error"
          role="alert"
          className="text-due text-base font-medium"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="tap h-14 rounded-xl bg-brand text-white text-lg font-semibold
                   active:bg-brand-dark disabled:opacity-60"
      >
        {isPending ? "Ruko…" : "Khulo"}
      </button>
    </form>
  );
}
