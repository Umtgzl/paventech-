import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { Brand } from "@/components/shell/brand";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Brand />
          <span className="flex items-center gap-1.5 rounded-md bg-plus/12 px-2 py-1 text-xs font-semibold text-plus">
            <Shield className="size-3.5" /> Super Admin
          </span>
          <div className="flex-1" />
          <Link href="/panel" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Uygulamaya dön
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
