import { suspensePage } from "@/components/page/suspense-page";
import { EntityListView } from "@/components/entity/entity-list-view";

export default suspensePage(async function CariPage(props: PageProps<"/cari">) {
  return <EntityListView entityKey="cari" searchParams={props.searchParams} />;
});
