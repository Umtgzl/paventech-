"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, formatNumber, formatQty } from "@/lib/format";
import { ENTITIES, entityDetailHref } from "@/lib/entities/registry";
import type { EntityRow, FieldDef } from "@/lib/entities/types";

/** Bir alan değerini tür bilgisine göre biçimlendirir (liste, kart, detay). */
export function CellValue({ field, row }: { field: FieldDef; row: EntityRow }) {
  const v = row[field.name];

  switch (field.type) {
    case "select": {
      if (v === null || v === "") return <Empty />;
      const opt = field.options?.find((o) => o.value === v);
      return <Badge variant={opt?.tone ?? "secondary"}>{opt?.label ?? String(v)}</Badge>;
    }
    case "boolean":
      if (field.name === "isActive") {
        return v ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Pasif</Badge>;
      }
      return v ? <span>Evet</span> : <span className="text-muted-foreground">Hayır</span>;
    case "money":
      return <span className="num block">{formatMoney(v as string)}</span>;
    case "decimal":
      return <span className="num block">{formatQty(v as string)}</span>;
    case "integer":
      return <span className="num block">{formatNumber(v as number, 0)}</span>;
    case "percent":
      return <span className="num block">%{formatNumber(v as string)}</span>;
    case "date":
      return v ? <span>{formatDate(String(v))}</span> : <Empty />;
    case "relation": {
      const label = row[`${field.name}__label`];
      if (!v || !label) return <Empty />;
      const rel = field.relation ? ENTITIES[field.relation.entity] : null;
      const href = rel ? entityDetailHref(rel, String(v)) : null;
      return href ? (
        <Link href={href} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {String(label)}
        </Link>
      ) : (
        <span>{String(label)}</span>
      );
    }
    case "email":
      return v ? (
        <a href={`mailto:${v}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
          {String(v)}
        </a>
      ) : (
        <Empty />
      );
    case "phone":
      return v ? (
        <a href={`tel:${String(v).replace(/\s/g, "")}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
          {String(v)}
        </a>
      ) : (
        <Empty />
      );
    case "textarea":
      return v ? <span className="block max-w-xs truncate">{String(v)}</span> : <Empty />;
    default:
      return v === null || v === "" ? <Empty /> : <span>{String(v)}</span>;
  }
}

function Empty() {
  return <span className="text-muted-foreground/50">—</span>;
}
