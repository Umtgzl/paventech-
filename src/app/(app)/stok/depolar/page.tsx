import { suspensePage } from "@/components/page/suspense-page";
import { EntityListView } from "@/components/entity/entity-list-view";

export default suspensePage(async function DepolarPage(props: PageProps<"/stok/depolar">) {
  return <EntityListView entityKey="depo" searchParams={props.searchParams} editInPlace />;
});
