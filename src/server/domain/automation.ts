// Olay tabanlı otomasyon (Plus). Prototipte tek kural gerçekten çalışır:
// "Stok kritik seviyenin altına inince bildirim oluştur".
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { automationRules, notification, products, tenantModule } from "@/server/db/schema";
import { formatQty } from "@/lib/format";
import { stockQuantities } from "@/server/ledger/stock";

export const AUTOMATION_TEMPLATES = [
  {
    template: "kritik_stok",
    name: "Kritik stok uyarısı",
    trigger: "Stok hareketi onaylandığında",
    action: "Ürün kritik seviyenin altındaysa bildirim oluştur",
    live: true,
  },
  {
    template: "vade_hatirlatma",
    name: "Vade hatırlatma",
    trigger: "Her sabah 09:00",
    action: "Vadesi 3 gün içinde dolan alacaklar için müşteriye e-posta taslağı hazırla",
    live: false,
  },
  {
    template: "siparis_kargo",
    name: "Sipariş kargoya verildi",
    trigger: "Satış irsaliyesi onaylandığında",
    action: "Müşteriye SMS / WhatsApp bilgilendirmesi gönder",
    live: false,
  },
  {
    template: "otomatik_satinalma",
    name: "Otomatik satın alma talebi",
    trigger: "Stok kritik seviyeye indiğinde",
    action: "Tedarikçiye taslak satın alma siparişi oluştur",
    live: false,
  },
] as const;

async function ruleEnabled(exec: Executor, tenantId: string, template: string): Promise<boolean> {
  const [mod] = await exec
    .select({ enabled: tenantModule.enabled })
    .from(tenantModule)
    .where(and(eq(tenantModule.tenantId, tenantId), eq(tenantModule.moduleKey, "otomasyon")));
  if (!mod?.enabled) return false;
  const [rule] = await exec
    .select({ enabled: automationRules.enabled })
    .from(automationRules)
    .where(and(eq(automationRules.tenantId, tenantId), eq(automationRules.template, template)));
  return rule?.enabled ?? false;
}

/** Stok hareketi sonrası: kritik seviyenin altındaki ürünler için bildirim (tekrarlamadan). */
export async function onStockChanged(exec: Executor, tenantId: string, productIds: string[]) {
  if (productIds.length === 0 || !(await ruleEnabled(exec, tenantId, "kritik_stok"))) return;
  const list = await exec
    .select({ id: products.id, name: products.name, unit: products.unit, critical: products.criticalLevel })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), inArray(products.id, productIds), sql`${products.criticalLevel} > 0`));
  if (list.length === 0) return;
  const qty = await stockQuantities(exec, tenantId, list.map((p) => p.id));

  for (const p of list) {
    const q = qty.get(p.id);
    if (!q || q.gt(p.critical)) continue;
    const href = `/stok/urunler/${p.id}`;
    const [existing] = await exec
      .select({ id: notification.id })
      .from(notification)
      .where(and(eq(notification.tenantId, tenantId), eq(notification.href, href), isNull(notification.readAt)))
      .limit(1);
    if (existing) continue;
    await exec.insert(notification).values({
      tenantId,
      kind: "kritik_stok",
      title: `Kritik stok: ${p.name}`,
      body: `Kalan ${formatQty(q.toString())} ${p.unit} (kritik seviye ${formatQty(p.critical)})`,
      href,
    });
  }
}
