import { LoginForm } from "./login-form";

const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Khata";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <main className="flex-1 flex flex-col justify-center px-5 py-10 max-w-md w-full mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{SHOP_NAME}</h1>
        <p className="text-ink-soft mt-1">Udhaar ka hisaab</p>
      </div>

      <LoginForm next={next} />
    </main>
  );
}
