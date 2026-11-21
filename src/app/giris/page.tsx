import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

const POINTS = [
  "Cari, stok, satış ve kasa tek ekranda",
  "Modüller ihtiyaca göre açılır, kapanır",
  "Kurulum yok: tarayıcıdan, her cihazdan",
  "Belge okuyan ve eşleştiren yapay zekâ",
];

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15 font-bold">P</span>
          <span className="text-lg font-semibold">Paventech ERP Plus</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold">İşletmenizin tamamı, tek ve modern bir yerde.</h2>
          <ul className="mt-6 flex flex-col gap-3 text-primary-foreground/90">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <CheckCircle2 className="size-5 shrink-0 opacity-80" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">Prototip sürüm · Paventech</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Giriş yap</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hesabınızla devam edin.</p>
          <Suspense>
            <LoginForm demo={process.env.NEXT_PUBLIC_DEMO === "1"} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
