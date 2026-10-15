"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EntityDef, EntityRow } from "@/lib/entities/types";
import { EntityFormSheet, type RelationOptions } from "./entity-form-sheet";

/** Detay sayfalarında "Düzenle" butonu: ortak formu yan panelde açar. */
export function EditEntityButton({
  def,
  row,
  relationOptions = {},
  label = "Düzenle",
}: {
  def: EntityDef;
  row: EntityRow;
  relationOptions?: RelationOptions;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil /> {label}
      </Button>
      <EntityFormSheet def={def} row={row} open={open} onOpenChange={setOpen} relationOptions={relationOptions} />
    </>
  );
}

/** Liste dışı sayfalarda "Yeni kayıt" butonu. */
export function NewEntityButton({
  def,
  relationOptions = {},
  label,
}: {
  def: EntityDef;
  relationOptions?: RelationOptions;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{label ?? `Yeni ${def.label.toLocaleLowerCase("tr-TR")}`}</Button>
      <EntityFormSheet def={def} row={null} open={open} onOpenChange={setOpen} relationOptions={relationOptions} />
    </>
  );
}
