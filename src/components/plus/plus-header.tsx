import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page/page-header";

/** Plus modül sayfa başlığı: rozet + prototip notu. */
export function PlusHeader({
  module,
  title,
  description,
  actions,
  note,
}: {
  module: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  note?: string;
}) {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Plus" }, { label: module }]}
        title={
          <span className="flex items-center gap-2">
            {title} <Badge variant="plus">PLUS</Badge>
          </span>
        }
        description={description}
        actions={actions}
      />
      {note && (
        <div className="mb-5 rounded-lg border border-plus/25 bg-plus/[0.04] px-4 py-2.5 text-sm text-muted-foreground">
          <span className="font-medium text-plus">Prototip notu: </span>
          {note}
        </div>
      )}
    </>
  );
}
