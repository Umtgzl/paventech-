"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/page/field";
import { ModuleIcon } from "@/components/shell/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { MODULES, PLANS, type ModuleKey, type PlanKey } from "@/lib/modules";
import {
  addTenantUserAction,
  applyPlanAction,
  enterTenantAction,
  toggleModuleAction,
  updateTenantProfileAction,
} from "@/server/services/super-admin-actions";

const DEPTH_LABEL = { cekirdek: "Çekirdek", temel: "Temel", vitrin: "Vitrin" } as const;

export function ModuleSwitches({ tenantId, enabled }: { tenantId: string; enabled: string[] }) {
  const [optimistic, setOptimistic] = useOptimistic(new Set(enabled), (state, action: { key: string; on: boolean }) => {
    const next = new Set(state);
    if (action.on) next.add(action.key);
    else next.delete(action.key);
    return next;
  });
  const [, startTransition] = useTransition();

  function toggle(key: ModuleKey, on: boolean) {
    startTransition(async () => {
      setOptimistic({ key, on });
      const res = await toggleModuleAction(tenantId, key, on);
      if (!res.ok) toast.error(res.error);
      else if (res.data.alsoChanged.length > 0) {
        toast.info(`${on ? "Birlikte açıldı" : "Birlikte kapandı"}: ${res.data.alsoChanged.join(", ")}`);
      }
    });
  }

  const sections = [
    { title: "Standart modüller", tier: "standart" as const },
    { title: "Plus modüller", tier: "plus" as const },
  ];

  return (
    <div className="mt-5 flex flex-col gap-5">
      {sections.map((s) => (
        <div key={s.tier}>
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.title}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULES.filter((m) => m.tier === s.tier).map((m) => {
              const on = optimistic.has(m.key);
              return (
                <label
                  key={m.key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40"
                >
                  <ModuleIcon name={m.icon} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{m.short}</span>
                      {m.tier === "plus" && <Badge variant="plus">PLUS</Badge>}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Prototip: {DEPTH_LABEL[m.depth]}</span>
                  </span>
                  <Switch checked={on} onCheckedChange={(v) => toggle(m.key, v)} aria-label={m.name} />
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlanPicker({ tenantId, current }: { tenantId: string; current: PlanKey }) {
  const { pending, run } = useAction();
  const [plan, setPlan] = useState<PlanKey>(current);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
      <Field label="Hazır paket" htmlFor="plan" className="min-w-48 flex-1">
        <NativeSelect id="plan" value={plan} onChange={(e) => setPlan(e.target.value as PlanKey)}>
          {Object.entries(PLANS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label} ({p.modules.length} modül)
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button variant="outline" disabled={pending} onClick={() => run(() => applyPlanAction(tenantId, plan))}>
        {pending && <Loader2 className="animate-spin" />}
        Paketi uygula
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Paket uygulamak modül listesini paketin içeriğine eşitler; ardından tek tek ekleyip çıkarabilirsiniz.
      </p>
    </div>
  );
}

interface ProfileValues {
  name: string;
  legalName: string;
  taxOffice: string;
  taxNumber: string;
  city: string;
  sector: string;
  userLimit: number;
  aiMonthlyCredits: number;
  showLockedModules: boolean;
  isActive: boolean;
}

export function ProfileForm({ tenantId, initial }: { tenantId: string; initial: ProfileValues }) {
  const [v, setV] = useState(initial);
  const { pending, run, fieldErrors } = useAction();
  const set = <K extends keyof ProfileValues>(k: K, value: ProfileValues[K]) => setV((p) => ({ ...p, [k]: value }));

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateTenantProfileAction(tenantId, v));
      }}
    >
      <Field label="Görünen ad" htmlFor="p-name" error={fieldErrors.name}>
        <Input id="p-name" value={v.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Ticari unvan" htmlFor="p-legal">
        <Input id="p-legal" value={v.legalName} onChange={(e) => set("legalName", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vergi dairesi" htmlFor="p-to">
          <Input id="p-to" value={v.taxOffice} onChange={(e) => set("taxOffice", e.target.value)} />
        </Field>
        <Field label="Vergi no" htmlFor="p-tn">
          <Input id="p-tn" value={v.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} />
        </Field>
        <Field label="Şehir" htmlFor="p-city">
          <Input id="p-city" value={v.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Sektör" htmlFor="p-sector">
          <Input id="p-sector" value={v.sector} onChange={(e) => set("sector", e.target.value)} />
        </Field>
        <Field label="Kullanıcı limiti" htmlFor="p-ul" error={fieldErrors.userLimit}>
          <Input id="p-ul" type="number" min={1} value={v.userLimit} onChange={(e) => set("userLimit", Number(e.target.value))} />
        </Field>
        <Field label="Aylık AI kredisi" htmlFor="p-ai" error={fieldErrors.aiMonthlyCredits}>
          <Input
            id="p-ai"
            type="number"
            min={0}
            value={v.aiMonthlyCredits}
            onChange={(e) => set("aiMonthlyCredits", Number(e.target.value))}
          />
        </Field>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
        <span>
          Kapalı modüller menüde kilitli görünsün
          <span className="block text-xs text-muted-foreground">Kapalıysa tamamen gizlenir.</span>
        </span>
        <Switch checked={v.showLockedModules} onCheckedChange={(c) => set("showLockedModules", c)} />
      </label>
      <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
        <span>Şirket hesabı aktif</span>
        <Switch checked={v.isActive} onCheckedChange={(c) => set("isActive", c)} />
      </label>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Kaydet
      </Button>
    </form>
  );
}

export function AddUserForm({ tenantId }: { tenantId: string }) {
  const { pending, run, fieldErrors } = useAction();
  const [key, setKey] = useState(0);

  return (
    <form
      key={key}
      className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () =>
            addTenantUserAction(tenantId, {
              name: String(f.get("name")),
              email: String(f.get("email")),
              password: String(f.get("password")),
              role: String(f.get("role")) as "member",
            }),
          { onSuccess: () => setKey((k) => k + 1) },
        );
      }}
    >
      <Field label="Ad soyad" htmlFor="u-name" error={fieldErrors.name}>
        <Input id="u-name" name="name" required />
      </Field>
      <Field label="E-posta" htmlFor="u-email" error={fieldErrors.email}>
        <Input id="u-email" name="email" type="email" required />
      </Field>
      <Field label="Geçici şifre" htmlFor="u-pass" error={fieldErrors.password}>
        <Input id="u-pass" name="password" minLength={8} required />
      </Field>
      <Field label="Rol" htmlFor="u-role">
        <NativeSelect id="u-role" name="role" defaultValue="member">
          <option value="member">Kullanıcı</option>
          <option value="admin">Yönetici</option>
          <option value="owner">Sahip</option>
        </NativeSelect>
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Kullanıcı ekle
        </Button>
      </div>
    </form>
  );
}

export function EnterTenantButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        run(() => enterTenantAction(tenantId), {
          silent: true,
          onSuccess: () => {
            router.push("/panel");
            router.refresh();
          },
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
      Şirkete gir
    </Button>
  );
}
