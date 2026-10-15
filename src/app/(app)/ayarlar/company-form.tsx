"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Field } from "@/components/page/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { updateCompanyAction, type CompanyInput } from "@/server/services/settings-actions";

type Values = Required<{ [K in keyof CompanyInput]: string }>;

export function CompanyForm({ initial, readOnly }: { initial: Values; readOnly: boolean }) {
  const [v, setV] = useState(initial);
  const { pending, run, fieldErrors } = useAction();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateCompanyAction(v));
      }}
    >
      <fieldset disabled={readOnly || pending} className="contents">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Görünen ad" htmlFor="c-name" error={fieldErrors.name} required>
            <Input id="c-name" value={v.name} onChange={set("name")} />
          </Field>
          <Field label="Ticari unvan" htmlFor="c-legal" help="Fatura ve irsaliye çıktılarının üstünde yazar" error={fieldErrors.legalName}>
            <Input id="c-legal" value={v.legalName} onChange={set("legalName")} />
          </Field>
          <Field label="Vergi dairesi" htmlFor="c-to" error={fieldErrors.taxOffice}>
            <Input id="c-to" value={v.taxOffice} onChange={set("taxOffice")} />
          </Field>
          <Field label="Vergi / TC kimlik no" htmlFor="c-tn" error={fieldErrors.taxNumber}>
            <Input id="c-tn" inputMode="numeric" value={v.taxNumber} onChange={set("taxNumber")} />
          </Field>
          <Field label="Telefon" htmlFor="c-phone" error={fieldErrors.phone}>
            <Input id="c-phone" type="tel" value={v.phone} onChange={set("phone")} />
          </Field>
          <Field label="E-posta" htmlFor="c-email" error={fieldErrors.email}>
            <Input id="c-email" type="email" value={v.email} onChange={set("email")} />
          </Field>
          <Field label="Adres" htmlFor="c-address" error={fieldErrors.address} className="sm:col-span-2">
            <Textarea id="c-address" rows={2} value={v.address} onChange={set("address")} />
          </Field>
          <Field label="İl" htmlFor="c-city" error={fieldErrors.city}>
            <Input id="c-city" value={v.city} onChange={set("city")} />
          </Field>
        </div>
        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit">
              {pending && <Loader2 className="animate-spin" />}
              Kaydet
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
