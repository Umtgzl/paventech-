// Tüm şirket (kiracı) tablolarında ortak kolonlar.
// drizzle "snake_case" casing ile çalışıyoruz: kolon adı verilmeyen alanlar
// otomatik olarak snake_case olur (tenantId -> tenant_id).
import { numeric, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const pk = () => uuid().primaryKey().defaultRandom();

/** Kaydın ait olduğu şirket. Şirket silinirse verisi de silinir. */
export const tenantRef = () =>
  text()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

export const createdAt = () =>
  timestamp({ withTimezone: true }).defaultNow().notNull();

export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/** Para tutarı: 18 basamak, 2 ondalık. JS tarafında string döner, decimal.js ile işlenir. */
export const money = () => numeric({ precision: 18, scale: 2 }).notNull().default("0");

/** Miktar ve birim fiyat: 4 ondalık. */
export const qty = () => numeric({ precision: 18, scale: 4 }).notNull().default("0");

/** Yüzde oranlar (KDV, iskonto): 5 basamak, 2 ondalık. */
export const rate = () => numeric({ precision: 5, scale: 2 }).notNull().default("0");
