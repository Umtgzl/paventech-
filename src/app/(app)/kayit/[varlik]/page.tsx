import { suspensePage } from "@/components/page/suspense-page";
import { EntityListView } from "@/components/entity/entity-list-view";

export default suspensePage(async function EntityPage(props: PageProps<"/kayit/[varlik]">) {
  const { varlik } = await props.params;
  return <EntityListView entityKey={varlik} searchParams={props.searchParams} />;
});
