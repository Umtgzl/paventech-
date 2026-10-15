"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Field } from "@/components/page/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { entityDetailHref } from "@/lib/entities/registry";
import type { EntityDef, EntityRow, FieldDef } from "@/lib/entities/types";
import { dec } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteEntityAction, saveEntityAction } from "@/server/entities/actions";

export type RelationOptions = Record<string, { value: string; label: string }[]>;
type FormValues = Record<string, string | boolean>;

/** Veritabanı değerini form girdisine çevirir ("1250.5000" -> "1250,5"). */
function toInput(f: FieldDef, v: unknown): string | boolean {
  if (f.type === "boolean") return v === true;
  if (v === null || v === undefined) return "";
  if (f.type === "decimal" || f.type === "money" || f.type === "percent") {
    return dec(String(v)).toString().replace(".", ",");
  }
  return String(v);
}

function initialValues(def: EntityDef, row: EntityRow | null): FormValues {
  const out: FormValues = {};
  for (const f of def.fields) {
    if (f.hideInForm) continue;
    if (row) out[f.name] = toInput(f, row[f.name]);
    else out[f.name] = f.type === "boolean" ? f.defaultValue === true : typeof f.defaultValue === "string" ? f.defaultValue : "";
  }
  return out;
}

/**
 * Alan tanımlarından otomatik oluşan kayıt formu (yan panel).
 * Yeni kayıt için row=null verilir.
 */
export function EntityFormSheet({
  def,
  row,
  open,
  onOpenChange,
  relationOptions,
  onSaved,
}: {
  def: EntityDef;
  row: EntityRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationOptions: RelationOptions;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => initialValues(def, row));
  const { pending, run, fieldErrors, setFieldErrors } = useAction();
  const del = useAction();

  // Panel her açıldığında formu seçilen kayda göre sıfırla (efekt yerine render sırasında:
  // eski değerler bir an bile görünmez)
  const openKey = open ? (row?.id ?? "yeni") : null;
  const [shownKey, setShownKey] = useState(openKey);
  if (openKey !== shownKey) {
    setShownKey(openKey);
    if (openKey !== null) {
      setValues(initialValues(def, row));
      setFieldErrors({});
    }
  }

  const set = (name: string, v: string | boolean) => setValues((p) => ({ ...p, [name]: v }));
  const detail = row ? entityDetailHref(def, row.id) : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(() => saveEntityAction(def.key, row?.id ?? null, values), {
      onSuccess: (d) => {
        onOpenChange(false);
        onSaved?.(d.id);
        router.refresh();
      },
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{row ? `${def.label} düzenle` : `Yeni ${def.label.toLocaleLowerCase("tr-TR")}`}</SheetTitle>
          <SheetDescription>
            {row ? String(row[def.titleField] ?? "") : (def.description ?? "Zorunlu alanlar * ile işaretlidir.")}
          </SheetDescription>
        </SheetHeader>
        <form id={`form-${def.key}`} onSubmit={onSubmit} className="grid flex-1 content-start gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          {def.fields
            .filter((f) => !f.hideInForm)
            .map((f) => (
              <Field
                key={f.name}
                label={f.label}
                htmlFor={`f-${f.name}`}
                required={f.required}
                error={fieldErrors[f.name]}
                help={f.help}
                className={cn((f.wide || f.type === "textarea") && "sm:col-span-2", f.type === "boolean" && "justify-end")}
              >
                <FieldInput
                  field={f}
                  value={values[f.name]}
                  onChange={(v) => set(f.name, v)}
                  options={relationOptions[f.name] ?? []}
                  invalid={!!fieldErrors[f.name]}
                />
              </Field>
            ))}
        </form>
        <SheetFooter className="items-center">
          {row && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={del.pending}>
                  <Trash2 /> Sil
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Kayıt silinsin mi?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &quot;{String(row[def.titleField] ?? "")}&quot; kalıcı olarak silinecek. Başka kayıtlarda kullanılıyorsa
                    silme engellenir; bu durumda pasife alabilirsiniz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() =>
                      del.run(() => deleteEntityAction(def.key, row.id), {
                        onSuccess: () => {
                          onOpenChange(false);
                          router.refresh();
                        },
                      })
                    }
                  >
                    Sil
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {detail && (
            <Button type="button" variant="ghost" onClick={() => router.push(detail)}>
              <ExternalLink /> Detaya git
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form={`form-${def.key}`} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Kaydet
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function FieldInput({
  field: f,
  value,
  onChange,
  options,
  invalid,
}: {
  field: FieldDef;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
  options: { value: string; label: string }[];
  invalid?: boolean;
}) {
  const id = `f-${f.name}`;
  const text = typeof value === "string" ? value : "";

  switch (f.type) {
    case "boolean":
      return (
        <div className="flex h-9 items-center">
          <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} />
        </div>
      );
    case "select":
      return (
        <NativeSelect id={id} value={text} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
          {!f.required && <option value="">Seçin...</option>}
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      );
    case "relation":
      return (
        <Combobox
          id={id}
          value={text || null}
          onChange={(v) => onChange(v ?? "")}
          options={options}
          invalid={invalid}
          clearable={!f.required}
          emptyText="Kayıt bulunamadı. Önce ilgili kartı açın."
        />
      );
    case "textarea":
      return <Textarea id={id} value={text} onChange={(e) => onChange(e.target.value)} rows={3} aria-invalid={invalid} />;
    case "date":
      return <Input id={id} type="date" value={text} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} />;
    case "integer":
    case "decimal":
    case "money":
    case "percent":
      return (
        <Input
          id={id}
          inputMode="decimal"
          className="text-right tabular-nums"
          value={text}
          placeholder={f.type === "money" ? "0,00" : "0"}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
        />
      );
    default:
      return (
        <Input
          id={id}
          type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
          value={text}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
        />
      );
  }
}
