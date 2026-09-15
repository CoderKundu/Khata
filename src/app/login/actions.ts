"use server";

import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { passwordMatches } from "@/lib/session";

export type LoginState = { error: string | null };

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0) {
    return { error: "Password daaliye" };
  }

  if (!passwordMatches(password)) {
    // Deliberately vague, and identical for every kind of wrong input.
    return { error: "Password galat hai" };
  }

  await startSession();
  redirect(safeNext(formData.get("next")));
}
