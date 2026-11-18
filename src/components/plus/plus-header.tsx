import { PageHeader } from "@/components/page/page-header";

/** Plus modül sayfa başlığı */
export function PlusHeader({
  module,
  title,
  description,
  actions,
}: {
  module: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return <PageHeader breadcrumbs={[{ label: "Plus" }, { label: module }]} title={title} description={description} actions={actions} />;
}
