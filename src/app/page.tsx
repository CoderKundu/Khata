import { requireSession } from "@/lib/auth";
import { logout } from "./login/logout";

const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Khata";

export default async function HomePage() {
  await requireSession();

  return (
    <main className="flex-1 px-5 py-8 max-w-md w-full mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{SHOP_NAME}</h1>
          <p className="text-ink-soft mt-1">Udhaar ka hisaab</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="tap px-3 text-sm font-medium text-ink-soft underline underline-offset-4"
          >
            Band karo
          </button>
        </form>
      </div>

      {/* Step 3 replaces this with the customer list. */}
      <p className="mt-10 text-ink-soft">Grahak ki list yahan aayegi.</p>
    </main>
  );
}
