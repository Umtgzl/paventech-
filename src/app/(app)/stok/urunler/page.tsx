import { suspensePage } from "@/components/page/suspense-page";
import { EntityListView } from "@/components/entity/entity-list-view";

export default suspensePage(async function UrunlerPage(props: PageProps<"/stok/urunler">) {
  return <EntityListView entityKey="urun" searchParams={props.searchParams} />;
});
