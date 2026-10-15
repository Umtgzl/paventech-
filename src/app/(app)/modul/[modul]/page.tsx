import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { suspensePage } from "@/components/page/suspense-page";
import { ModuleIcon } from "@/components/shell/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isModuleKey, MODULE_MAP, requiredModules } from "@/lib/modules";
import { getTenantContext, hasModule } from "@/server/session";

/** Kapalı modül: ne işe yaradığını anlatır ve paket yükseltmeye yönlendirir (upsell). */
export default suspensePage(async function ModulePage(props: PageProps<"/modul/[modul]">) {
  const { modul } = await props.params;
  if (!isModuleKey(modul)) notFound();
  const ctx = await getTenantContext();
  const m = MODULE_MAP[modul];
  if (hasModule(ctx, modul)) redirect(m.items[0].href);

  const missingDeps = requiredModules(modul).filter((d) => !hasModule(ctx, d));

  return (
    <div className="mx-auto max-w-2xl py-6">
      <Card>
        <CardContent className="flex flex-col gap-5 p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ModuleIcon name={m.icon} className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">{m.name}</h1>
                {m.tier === "plus" ? <Badge variant="plus">PLUS</Badge> : <Badge variant="secondary">Standart</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
            </div>
          </div>

          <ul className="flex flex-col gap-2 text-sm">
            {m.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                {f}
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Bu modül paketinizde yok.</p>
              <p className="mt-0.5 text-muted-foreground">
                Modül Paventech tarafından tek tıkla açılır; verileriniz ve kullanıcılarınız aynı kalır.
                {missingDeps.length > 0 && (
                  <> Birlikte açılması gerekenler: {missingDeps.map((d) => MODULE_MAP[d].short).join(", ")}.</>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={`mailto:satis@paventech.com?subject=${encodeURIComponent(`${m.name} modülü`)}`}>
                Paketime eklemek istiyorum
              </a>
            </Button>
            {ctx.isSuperAdmin && (
              <Button variant="outline" asChild>
                <a href={`/super-admin/sirket/${ctx.tenantId}`}>Super Admin&apos;den aç</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
