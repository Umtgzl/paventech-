import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { ENTITIES, isEntityKey } from "@/lib/entities/registry";
import type { EntityRow, FieldDef } from "@/lib/entities/types";
import { formatDate } from "@/lib/format";
import { listEntity } from "@/server/entities/service";
import { getTenantContext, hasModule } from "@/server/session";

/**
 * Listeyi Excel'in Türkçe ayarlarıyla açılan CSV olarak indirir
 * (noktalı virgül ayırıcı, ondalık virgül, UTF-8 BOM).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/export/[varlik]">) {
  const { varlik } = await ctx.params;
  if (!isEntityKey(varlik)) return NextResponse.json({ error: "Bilinmeyen kayıt türü" }, { status: 404 });
  const def = ENTITIES[varlik];
  const tenant = await getTenantContext();
  if (!hasModule(tenant, def.module)) return NextResponse.json({ error: "Modül kapalı" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const list = await listEntity(db, tenant.tenantId, def.key, {
    q: sp.get("q") ?? undefined,
    sort: sp.get("sirala") ?? undefined,
    dir: sp.get("yon") === "desc" ? "desc" : "asc",
    pageSize: 5000,
  });

  const fields = def.fields;
  const lines = [fields.map((f) => csv(f.label)).join(";")];
  for (const row of list.rows) lines.push(fields.map((f) => csv(plain(f, row))).join(";"));

  const filename = `${def.plural.replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`;
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

function plain(f: FieldDef, row: EntityRow): string {
  const v = row[f.name];
  if (v === null || v === undefined) return "";
  switch (f.type) {
    case "select":
      return f.options?.find((o) => o.value === v)?.label ?? String(v);
    case "relation":
      return String(row[`${f.name}__label`] ?? "");
    case "boolean":
      return v ? "Evet" : "Hayır";
    case "date":
      return formatDate(String(v));
    case "money":
    case "decimal":
    case "percent":
      return String(v).replace(".", ",");
    default:
      return String(v);
  }
}

function csv(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
