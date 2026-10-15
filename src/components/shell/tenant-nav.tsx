import { getTenantContext } from "@/server/session";
import { buildNav } from "./nav-data";
import { SidebarNav } from "./sidebar-nav";

/** Sol menü: şirketin açık modüllerine göre çizilir (<Suspense> içinde). */
export async function TenantNav() {
  const ctx = await getTenantContext();
  return <SidebarNav groups={buildNav(ctx.enabledModules, ctx.showLockedModules)} isSuperAdmin={ctx.isSuperAdmin} />;
}
