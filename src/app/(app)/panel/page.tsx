import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { getTenantContext } from "@/server/session";

export default suspensePage(async function PanelPage() {
  const ctx = await getTenantContext();
  return <PageHeader title={`Hoş geldiniz, ${ctx.userName}`} description={ctx.tenantName} />;
});
