// Demo veri: Super Admin, iki örnek şirket ve kullanıcılar.
// Tüm şirket adları ve kişiler kurgusaldır.
import type { DB } from "@/server/db/client";
import { addUserToTenant, createTenant } from "@/server/domain/tenants";

export const DEMO_PASSWORD = "demo1234";

export async function seedDemo(db: DB) {
  console.log("Demo veri yükleniyor...");

  await db.transaction(async (tx) => {
    await addUserToTenant(tx, null, {
      name: "Paventech Yönetici",
      email: "admin@paventech.local",
      password: DEMO_PASSWORD,
      platformAdmin: true,
    });

    const mobilya = await createTenant(tx, {
      name: "Demo Mobilya ve Yatak",
      slug: "demo-mobilya",
      plan: "kurumsal",
      sector: "mobilya",
      legalName: "Demo Mobilya ve Yatak Sanayi Ticaret Ltd. Şti.",
      taxOffice: "Merkez",
      taxNumber: "1234567890",
      city: "Kayseri",
    });
    const gida = await createTenant(tx, {
      name: "Demo Gıda Toptan",
      slug: "demo-gida",
      plan: "baslangic",
      sector: "gida",
      legalName: "Demo Gıda Toptan Ticaret A.Ş.",
      city: "Ankara",
    });

    await addUserToTenant(tx, mobilya, {
      name: "Demo Kullanıcı",
      email: "demo@paventech.local",
      password: DEMO_PASSWORD,
      role: "owner",
    });
    await addUserToTenant(tx, gida, { name: "Demo Kullanıcı", email: "demo@paventech.local", password: DEMO_PASSWORD, role: "owner" });
    await addUserToTenant(tx, mobilya, { name: "Paventech Yönetici", email: "admin@paventech.local", password: "", role: "owner" });
    await addUserToTenant(tx, gida, { name: "Paventech Yönetici", email: "admin@paventech.local", password: "", role: "owner" });
  });

  console.log("  Super Admin: admin@paventech.local");
  console.log("  Demo kullanıcı: demo@paventech.local");
  console.log(`  Şifre: ${DEMO_PASSWORD}`);
}
