import { Suspense } from "react";
import { PageSkeleton } from "./page-skeleton";

/**
 * Sayfayı kendi <Suspense> sınırıyla sarar. Next.js 16 (Cache Components) ile
 * sayfa geçişleri anında olur: iskelet hemen görünür, veri akarak gelir.
 * Kullanım: export default suspensePage(async function Sayfa(props) { ... })
 */
export function suspensePage<P extends object>(
  Inner: (props: P) => Promise<React.ReactNode>,
  fallback: React.ReactNode = <PageSkeleton />,
) {
  // JSX ile çağrılmalı (fonksiyon olarak değil); veri erişimi Suspense'in içinde başlasın.
  const Content = Inner as unknown as React.ComponentType<P>;
  function Page(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Content {...props} />
      </Suspense>
    );
  }
  Page.displayName = `SuspensePage(${Inner.name || "Page"})`;
  return Page;
}
