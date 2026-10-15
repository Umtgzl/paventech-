import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page/page-header";
import { Badge } from "@/components/ui/badge";
import { ENTITIES, isEntityKey } from "@/lib/entities/registry";
import { MODULE_MAP } from "@/lib/modules";
import { db } from "@/server/db";
import { listEntity, relationOptions } from "@/server/entities/service";
import { requireModule } from "@/server/session";
import { EntityTable } from "./entity-table";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Ortak liste sayfası: arama, sıralama, sayfalama ve (varsa) pano görünümü. */
export async function EntityListView({
  entityKey,
  searchParams,
  title,
  description,
  actions,
  editInPlace,
}: {
  entityKey: string;
  searchParams: Promise<SP>;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  editInPlace?: boolean;
}) {
  if (!isEntityKey(entityKey)) notFound();
  const def = ENTITIES[entityKey];
  const ctx = await requireModule(def.module);
  const sp = await searchParams;

  const view = def.board && one(sp.gorunum) === "pano" ? "pano" : "tablo";
  const page = Number(one(sp.sayfa) ?? "1") || 1;
  const dir = one(sp.yon) === "desc" ? "desc" : "asc";

  const [list, options] = await Promise.all([
    listEntity(db, ctx.tenantId, def.key, {
      q: one(sp.q),
      sort: one(sp.sirala),
      dir,
      page: view === "pano" ? 1 : page,
      pageSize: view === "pano" ? 500 : 25,
    }),
    relationOptions(db, ctx.tenantId, def.key),
  ]);

  const mod = MODULE_MAP[def.module];
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: mod.short }, { label: def.plural }]}
        title={
          <span className="flex items-center gap-2">
            {title ?? def.plural}
            {mod.depth === "temel" && (
              <Badge variant="muted" title="Prototip: kayıt/liste hazır, iş kuralları sonraki aşamada">
                Temel sürüm
              </Badge>
            )}
          </span>
        }
        description={description ?? def.description}
        actions={actions}
      />
      <EntityTable
        def={def}
        rows={list.rows}
        total={list.total}
        page={list.page}
        pageSize={list.pageSize}
        sort={list.sort}
        dir={list.dir}
        q={one(sp.q) ?? ""}
        view={view}
        relationOptions={options}
        editInPlace={editInPlace}
      />
    </>
  );
}
