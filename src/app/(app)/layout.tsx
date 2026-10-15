import { Suspense } from "react";
import { Brand } from "@/components/shell/brand";
import { TenantNav } from "@/components/shell/tenant-nav";
import { Topbar } from "@/components/shell/topbar";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Uygulama kabuğu. Statik kısımlar (logo, iskelet) anında açılır; şirkete bağlı
 * menü ve üst çubuk <Suspense> içinde akar (Next.js Cache Components modeli).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
          <div className="flex h-14 items-center border-b px-4">
            <Brand />
          </div>
          <Suspense fallback={<NavSkeleton />}>
            <TenantNav />
          </Suspense>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
            <Suspense fallback={<div className="h-14" />}>
              <Topbar />
            </Suspense>
          </header>
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function NavSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-6" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}
