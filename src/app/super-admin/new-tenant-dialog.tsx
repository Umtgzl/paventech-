"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Field } from "@/components/page/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/hooks/use-action";
import { PLANS } from "@/lib/modules";
import { createTenantAction } from "@/server/services/super-admin-actions";

const SECTORS = [
  ["genel", "Genel / Ticaret"],
  ["mobilya", "Mobilya & Yatak"],
  ["tekstil", "Tekstil & Konfeksiyon"],
  ["gida", "Gıda"],
  ["metal", "Metal & Makine"],
  ["insaat", "İnşaat Malzemeleri"],
  ["hizmet", "Hizmet"],
] as const;

export function NewTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, run, fieldErrors } = useAction();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    run(
      () =>
        createTenantAction({
          name: get("name"),
          plan: get("plan") as "baslangic",
          sector: get("sector"),
          taxNumber: get("taxNumber"),
          city: get("city"),
          ownerName: get("ownerName"),
          ownerEmail: get("ownerEmail"),
          ownerPassword: get("ownerPassword"),
        }),
      {
        onSuccess: (d) => {
          setOpen(false);
          router.push(`/super-admin/sirket/${d.tenantId}`);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Yeni şirket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Yeni müşteri şirketi</DialogTitle>
          <DialogDescription>
            Şirket saniyeler içinde açılır; seçilen paketin modülleri, bir depo ve bir kasa hazır gelir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Şirket adı" htmlFor="name" required error={fieldErrors.name} className="sm:col-span-2">
            <Input id="name" name="name" required />
          </Field>
          <Field label="Paket" htmlFor="plan">
            <NativeSelect id="plan" name="plan" defaultValue="baslangic">
              {Object.entries(PLANS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label} ({p.modules.length} modül)
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Sektör" htmlFor="sector">
            <NativeSelect id="sector" name="sector" defaultValue="genel">
              {SECTORS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Vergi no" htmlFor="taxNumber">
            <Input id="taxNumber" name="taxNumber" inputMode="numeric" />
          </Field>
          <Field label="Şehir" htmlFor="city">
            <Input id="city" name="city" />
          </Field>
          <div className="border-t pt-4 text-sm font-medium sm:col-span-2">Şirket yetkilisi (ilk kullanıcı)</div>
          <Field label="Ad soyad" htmlFor="ownerName" required error={fieldErrors.ownerName}>
            <Input id="ownerName" name="ownerName" required />
          </Field>
          <Field label="E-posta" htmlFor="ownerEmail" required error={fieldErrors.ownerEmail}>
            <Input id="ownerEmail" name="ownerEmail" type="email" required />
          </Field>
          <Field
            label="Geçici şifre"
            htmlFor="ownerPassword"
            required
            error={fieldErrors.ownerPassword}
            help="En az 8 karakter. İlk girişten sonra değiştirilmeli."
            className="sm:col-span-2"
          >
            <Input id="ownerPassword" name="ownerPassword" type="text" required minLength={8} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Şirketi aç
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
