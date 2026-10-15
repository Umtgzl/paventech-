import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/server/db/client";
import { createTenant } from "@/server/domain/tenants";
import { createEntity, deleteEntity, getEntity, listEntity, updateEntity } from "@/server/entities/service";
import { cleanEntityValues } from "@/lib/entities/validation";
import { ENTITIES } from "@/lib/entities/registry";
import { freshTestDb } from "../helpers/db";

let db: DB;
let close: () => Promise<void>;
let tenantA: string;
let tenantB: string;

function clean(key: keyof typeof ENTITIES, raw: Record<string, unknown>) {
  const r = cleanEntityValues(ENTITIES[key], raw);
  if (!r.ok) throw new Error(JSON.stringify(r.fieldErrors));
  return r.values;
}

beforeAll(async () => {
  ({ db, close } = await freshTestDb());
  tenantA = await createTenant(db, { name: "A Ltd", slug: "a-ltd", plan: "kurumsal" });
  tenantB = await createTenant(db, { name: "B Ltd", slug: "b-ltd", plan: "baslangic" });
});

afterAll(async () => {
  await close();
});

describe("ortak kayıt motoru", () => {
  it("boş kodda sıradaki otomatik kodu verir", async () => {
    const id1 = await createEntity(db, tenantA, "cari", clean("cari", { name: "Yıldız Mobilya", kind: "musteri" }));
    const id2 = await createEntity(db, tenantA, "cari", clean("cari", { name: "Kuzey Ev Tekstili", kind: "musteri" }));
    expect((await getEntity(db, tenantA, "cari", id1))?.code).toBe("C00001");
    expect((await getEntity(db, tenantA, "cari", id2))?.code).toBe("C00002");
  });

  it("elle girilmiş kodla çakışırsa atlar", async () => {
    await createEntity(db, tenantA, "cari", clean("cari", { code: "C00003", name: "Elle Kodlu" }));
    const id = await createEntity(db, tenantA, "cari", clean("cari", { name: "Sonraki" }));
    expect((await getEntity(db, tenantA, "cari", id))?.code).toBe("C00004");
  });

  it("şirketler birbirinin kaydını göremez", async () => {
    await createEntity(db, tenantB, "cari", clean("cari", { name: "B'nin Müşterisi" }));
    const a = await listEntity(db, tenantA, "cari");
    const b = await listEntity(db, tenantB, "cari");
    expect(a.rows.map((r) => r.name)).not.toContain("B'nin Müşterisi");
    expect(b.total).toBe(1);
    // B şirketinin kodu kendi serisinden başlar
    expect(b.rows[0].code).toBe("C00001");
  });

  it("arama, sıralama ve sayfalama", async () => {
    const r = await listEntity(db, tenantA, "cari", { q: "mobilya" });
    expect(r.rows.map((x) => x.name)).toEqual(["Yıldız Mobilya"]);
    const sorted = await listEntity(db, tenantA, "cari", { sort: "code", dir: "desc", pageSize: 2 });
    expect(sorted.rows.map((x) => x.code)).toEqual(["C00004", "C00003"]);
    expect(sorted.total).toBe(4);
  });

  it("ilişki alanlarına etiket ekler", async () => {
    const urun = await createEntity(db, tenantA, "urun", clean("urun", { name: "Ortopedik Yatak 160x200", kind: "mamul" }));
    await createEntity(db, tenantA, "recete", clean("recete", { name: "Ortopedik reçete", productId: urun }));
    const list = await listEntity(db, tenantA, "recete");
    expect(list.rows[0].productId__label).toBe("Ortopedik Yatak 160x200 (U00001)");
  });

  it("günceller ve siler; başka şirketin kaydını güncelleyemez", async () => {
    const id = await createEntity(db, tenantA, "depo", clean("depo", { name: "Şube Depo" }));
    await updateEntity(db, tenantB, "depo", id, clean("depo", { name: "Hack" }));
    expect((await getEntity(db, tenantA, "depo", id))?.name).toBe("Şube Depo");
    await updateEntity(db, tenantA, "depo", id, clean("depo", { name: "Şube Depo 2" }));
    expect((await getEntity(db, tenantA, "depo", id))?.name).toBe("Şube Depo 2");
    await deleteEntity(db, tenantA, "depo", id);
    expect(await getEntity(db, tenantA, "depo", id)).toBeNull();
  });
});
