import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">P</span>
          <span className="text-lg font-semibold tracking-tight">Paventech</span>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-xs">
          <h1 className="text-base font-semibold">Giriş</h1>
          <Suspense>
            <LoginForm demo={process.env.NEXT_PUBLIC_DEMO === "1"} />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Paventech ERP</p>
      </div>
    </div>
  );
}
