"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const ERRORS: Record<string, string> = {
  sirket: "Hesabınız henüz bir şirkete bağlı değil. Yöneticinizle görüşün.",
  pasif: "Şirket hesabı pasif durumda. Paventech ile iletişime geçin.",
};

const DEMO_USERS = [
  { label: "Şirket yöneticisi", email: "demo@paventech.local" },
  { label: "Super Admin (Paventech)", email: "admin@paventech.local" },
];

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(ERRORS[params.get("hata") ?? ""] ?? null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await authClient.signIn.email({ email, password });
    if (err) {
      setLoading(false);
      setError(err.status === 401 ? "E-posta veya şifre hatalı." : (err.message ?? "Giriş yapılamadı."));
      return;
    }
    const target = params.get("donus");
    router.push(target && target.startsWith("/") && !target.startsWith("//") ? target : "/panel");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-posta</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Şifre</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Giriş yap
        </Button>
      </form>

      {demo && (
        <div className="mt-8 rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Demo hesapları</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Şifre: demo1234</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                type="button"
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-left hover:bg-accent"
                onClick={() => {
                  setEmail(u.email);
                  setPassword("demo1234");
                }}
              >
                <span>{u.label}</span>
                <span className="text-xs text-muted-foreground">{u.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
